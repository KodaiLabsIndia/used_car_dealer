import json
from uuid import uuid4

from sqlalchemy import text

from app.adapters.command_transaction import CommandTransaction
from app.adapters.operations import rows
from app.company_contracts import (
    AssignRequirements,
    CarRequirements,
    DocumentPolicy,
    DocumentRule,
    LinkRequirement,
    PublishDocumentPolicy,
    Requirement,
    RequirementSet,
)
from app.contracts import Actor
from app.domain.document_defaults import starter_policy
from app.domain.errors import BusinessError
from app.domain.workshop_policy import require_owner


class CompanyStore:
    def __init__(self, workflows):
        self.workflows, self.engine = workflows, workflows.engine
        self.commands = CommandTransaction(self.engine)

    def policy(self, actor, conn=None):
        if conn is None:
            with self.engine.connect() as connection:
                return self.policy(actor, connection)
        records = rows(
            conn,
            """SELECT p.version,p.rules,p.reason,p.published_at,u.name published_by_name
            FROM document_policies p JOIN users u ON u.id=p.published_by AND u.company_id=p.company_id
            WHERE p.company_id=:company ORDER BY version DESC LIMIT 1""",
            {"company": actor.company_id},
        )
        return DocumentPolicy.model_validate(records[0]) if records else starter_policy()

    def publish(self, actor: Actor, body: PublishDocumentPolicy):
        require_owner(actor)
        if (
            len({r.id for r in body.rules}) != len(body.rules)
            or not body.reason.strip()
            or any(not all(v.strip() for v in [r.title, r.title_hi, r.title_mr]) for r in body.rules)
        ):
            raise BusinessError(
                "INVALID_POLICY", "Use unique identifiers and wording in all three languages."
            )

        def execute(conn):
            conn.execute(
                text("SELECT pg_advisory_xact_lock(hashtextextended(:key,0))"),
                {"key": f"document-policy:{actor.company_id}"},
            )
            current = self.policy(actor, conn)
            if current.version != body.expected_version:
                raise BusinessError(
                    "VERSION_CONFLICT", "Document policy changed. Review the latest version.", 409
                )
            conn.execute(
                text("""INSERT INTO document_policies(company_id,version,rules,reason,published_by)
                VALUES(:company,:version,CAST(:rules AS jsonb),:reason,:actor)"""),
                {
                    "company": actor.company_id,
                    "version": current.version + 1,
                    "rules": json.dumps([r.model_dump(mode="json", by_alias=True) for r in body.rules]),
                    "reason": body.reason.strip(),
                    "actor": actor.id,
                },
            )
            self.workflows.ops.audit(
                conn,
                actor,
                actor.company_id,
                "company.document_policy_published",
                {"version": current.version + 1, "reason": body.reason},
            )
            return self.policy(actor, conn)

        return self.commands.run(
            actor, body.command_id, "company:document-policy", body, DocumentPolicy, execute
        )

    def assign_in_transaction(self, conn, actor, car_id, stage, booking_id=None):
        policy = self.policy(actor, conn)
        existing = rows(
            conn,
            """SELECT id FROM document_requirement_sets WHERE company_id=:company AND cycle_id=:car
            AND stage=:stage AND booking_id IS NOT DISTINCT FROM CAST(:booking AS uuid)""",
            {"company": actor.company_id, "car": car_id, "stage": stage, "booking": booking_id},
        )
        if existing:
            return
        id = uuid4()
        conn.execute(
            text("""INSERT INTO document_requirement_sets(id,company_id,cycle_id,stage,booking_id,policy_version,rules,assigned_by)
            VALUES(:id,:company,:car,:stage,:booking,:version,CAST(:rules AS jsonb),:actor)"""),
            {
                "id": id,
                "company": actor.company_id,
                "car": car_id,
                "stage": stage,
                "booking": booking_id,
                "version": policy.version,
                "rules": json.dumps(
                    [r.model_dump(mode="json", by_alias=True) for r in policy.rules if r.stage == stage]
                ),
                "actor": actor.id,
            },
        )
        self.workflows.event(
            conn,
            actor,
            car_id,
            "document.requirements_assigned",
            "Document requirements assigned",
            setId=str(id),
            stage=stage,
            policyVersion=policy.version,
        )

    def requirements(self, actor, car_id, conn=None):
        if conn is None:
            with self.engine.connect() as connection:
                return self.requirements(actor, car_id, connection)
        car = self.workflows.ops.work_car(actor, car_id, conn)
        records = rows(
            conn,
            "SELECT * FROM document_requirement_sets WHERE company_id=:company AND cycle_id=:car ORDER BY created_at,id",
            {"company": actor.company_id, "car": car_id},
        )
        purchases = rows(
            conn,
            "SELECT status,received_at FROM purchases WHERE company_id=:company AND cycle_id=:car",
            {"company": actor.company_id, "car": car_id},
        )
        bookings = rows(
            conn,
            "SELECT id,customer_name,status FROM sale_bookings WHERE company_id=:company AND cycle_id=:car",
            {"company": actor.company_id, "car": car_id},
        )
        by_booking = {b["id"]: b for b in bookings}
        sets = []
        for record in records:
            booking = by_booking.get(record["booking_id"])
            locked = (
                car.stage == "delivered"
                or (booking is not None and booking["status"] != "booked")
                or (record["stage"] == "purchase" and purchases and purchases[0]["status"] == "acquired")
                or (record["stage"] == "intake" and purchases and purchases[0]["received_at"] is not None)
            )
            links = rows(
                conn,
                """SELECT DISTINCT ON (l.requirement_id) l.requirement_id,d.id,d.title,
                COALESCE(r.decision,'pending') status,u.name reviewer
                FROM document_requirement_links l JOIN documents d ON d.id=l.document_id AND d.company_id=l.company_id
                LEFT JOIN document_reviews r ON r.document_id=d.id AND r.company_id=d.company_id
                LEFT JOIN users u ON u.id=r.recorded_by AND u.company_id=r.company_id
                WHERE l.set_id=:id AND l.company_id=:company ORDER BY l.requirement_id,l.id DESC""",
                {"id": record["id"], "company": actor.company_id},
            )
            by_rule = {link["requirement_id"]: link for link in links}
            items = []
            for raw in record["rules"]:
                rule = DocumentRule.model_validate(raw)
                link = by_rule.get(rule.id)
                items.append(
                    Requirement(
                        rule=rule,
                        status=link["status"] if link else "missing",
                        document_id=link["id"] if link else None,
                        document_title=link["title"] if link else None,
                        reviewed_by_name=link["reviewer"] if link else None,
                    )
                )
            sets.append(
                RequirementSet(
                    id=record["id"],
                    stage=record["stage"],
                    booking_id=record["booking_id"],
                    booking_label=booking["customer_name"] if booking else None,
                    locked=bool(locked),
                    policy_version=record["policy_version"],
                    enforced=record["policy_version"] > 0,
                    items=items,
                    clear=all(not i.rule.required or i.status == "accepted" for i in items),
                )
            )
        assigned_stages = {record["stage"] for record in records}
        purchase = purchases[0] if purchases else None
        assignable = []
        if car.stage != "delivered":
            if "purchase" not in assigned_stages and (not purchase or purchase["status"] != "acquired"):
                assignable.append("purchase")
            if "intake" not in assigned_stages and (not purchase or purchase["received_at"] is None):
                assignable.append("intake")
        return CarRequirements(sets=sets, assignable_stages=assignable)

    def assign(self, actor, car_id, body: AssignRequirements):
        def execute(conn):
            self.workflows.lock_car(conn, actor, car_id)
            if self.workflows.ops.work_car(actor, car_id, conn).stage == "delivered":
                raise BusinessError(
                    "DOCUMENTS_FROZEN", "This delivery is finalized. Add later documents separately.", 409
                )
            if body.stage in ("sale", "delivery"):
                self.check_booking(conn, actor, car_id, body.booking_id)
            elif body.booking_id:
                raise BusinessError(
                    "INVALID_SCOPE", "Purchase and intake requirements belong to the stock cycle."
                )
            if body.stage in ("purchase", "intake"):
                current = self.requirements(actor, car_id, conn)
                if (
                    not any(assigned.stage == body.stage for assigned in current.sets)
                    and body.stage not in current.assignable_stages
                ):
                    raise BusinessError(
                        "DOCUMENTS_FROZEN",
                        "This stage is finalized. Add later pages as support documents without changing its requirements.",
                        409,
                    )
            self.assign_in_transaction(conn, actor, car_id, body.stage, body.booking_id)
            return self.requirements(actor, car_id, conn)

        return self.commands.run(
            actor,
            body.command_id,
            f"car:{car_id}:document-requirements",
            body,
            CarRequirements,
            execute,
            lambda conn: (
                self.workflows.lock_car(conn, actor, car_id),
                self.workflows.ops.work_car(actor, car_id, conn),
            ),
        )

    def check_booking(self, conn, actor, car_id, booking_id):
        if not rows(
            conn,
            "SELECT id FROM sale_bookings WHERE id=:booking AND company_id=:company AND cycle_id=:car AND status='booked'",
            {"booking": booking_id, "company": actor.company_id, "car": car_id},
        ):
            raise BusinessError("BOOKING_CLOSED", "Choose an open booking for this car.", 409)

    def link(self, actor, car_id, set_id, body: LinkRequirement):
        def execute(conn):
            self.workflows.lock_car(conn, actor, car_id)
            sets = self.requirements(actor, car_id, conn)
            target = next((s for s in sets.sets if s.id == set_id), None)
            if not target or body.requirement_id not in {i.rule.id for i in target.items}:
                raise BusinessError("NOT_FOUND", "This document requirement is unavailable.", 404)
            if target.locked:
                raise BusinessError(
                    "DOCUMENTS_FROZEN",
                    "The finalized stage retains its document proofs. Add later pages as support documents.",
                    409,
                )
            if target.booking_id:
                self.check_booking(conn, actor, car_id, target.booking_id)
            if self.workflows.ops.work_car(actor, car_id, conn).stage == "delivered":
                raise BusinessError(
                    "DOCUMENTS_FROZEN",
                    "Issued delivery requirements are retained. Add support documents separately.",
                    409,
                )
            document = rows(
                conn,
                "SELECT id,booking_id FROM documents WHERE id=:id AND company_id=:company AND cycle_id=:car",
                {"id": body.document_id, "company": actor.company_id, "car": car_id},
            )
            if not document or (document[0]["booking_id"] and document[0]["booking_id"] != target.booking_id):
                raise BusinessError("NOT_FOUND", "Choose a document from this car and sale.", 404)
            conn.execute(
                text(
                    "INSERT INTO document_requirement_links(company_id,set_id,requirement_id,document_id,recorded_by) VALUES(:company,:set,:rule,:doc,:actor)"
                ),
                {
                    "company": actor.company_id,
                    "set": set_id,
                    "rule": body.requirement_id,
                    "doc": body.document_id,
                    "actor": actor.id,
                },
            )
            self.workflows.event(
                conn,
                actor,
                car_id,
                "document.requirement_linked",
                "Document proof linked to requirement",
                setId=str(set_id),
                requirementId=body.requirement_id,
                documentId=str(body.document_id),
            )
            return self.requirements(actor, car_id, conn)

        return self.commands.run(
            actor,
            body.command_id,
            f"car:{car_id}:requirements:{set_id}:link",
            body,
            CarRequirements,
            execute,
            lambda conn: (
                self.workflows.lock_car(conn, actor, car_id),
                self.workflows.ops.work_car(actor, car_id, conn),
            ),
        )

    def require_clear(self, conn, actor, car_id, stages, booking_id=None):
        for assigned in self.requirements(actor, car_id, conn).sets:
            if (
                assigned.enforced
                and assigned.stage in stages
                and assigned.booking_id == booking_id
                and not assigned.clear
            ):
                raise BusinessError(
                    "DOCUMENT_REQUIREMENTS_PENDING",
                    "Upload and obtain review of the required document pages before this commitment.",
                    409,
                )
