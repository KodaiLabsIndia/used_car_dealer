import json
from collections.abc import Callable
from uuid import UUID, uuid4

from sqlalchemy import text
from sqlalchemy.engine import Connection

from app.adapters.command_transaction import CommandTransaction
from app.adapters.operations import rows
from app.adapters.workflows import WorkflowStore
from app.contracts import Actor
from app.domain.access import require
from app.domain.errors import BusinessError
from app.domain.purchase_policy import PurchasePlan, contribution, documents_clear, validate_terms
from app.purchase_contracts import (
    CreatePurchase,
    InspectionStamp,
    Purchase,
    PurchaseApproval,
    PurchaseCommand,
    PurchaseDocuments,
    PurchasePayment,
    PurchaseRevision,
    PurchaseTerms,
)


class PurchaseStore:
    def __init__(self, workflows: WorkflowStore):
        self.workflows = workflows
        self.ops = workflows.ops
        self.engine = workflows.engine
        self.commands = CommandTransaction(self.engine)

    def inspections(self, conn: Connection, actor: Actor, car_id: UUID) -> list[InspectionStamp]:
        return [
            InspectionStamp.model_validate(r)
            for r in rows(
                conn,
                """
            SELECT id,version,status,template_approved FROM tasks
            WHERE company_id=:company AND cycle_id=:car AND kind='pre_purchase' ORDER BY id
        """,
                {"company": actor.company_id, "car": car_id},
            )
        ]

    def get(self, actor: Actor, purchase_id: UUID, conn: Connection | None = None) -> Purchase:
        if conn is None:
            with self.engine.connect() as c:
                return self.get(actor, purchase_id, c)
        records = rows(
            conn,
            """SELECT p.*,u.name AS prepared_by_name FROM purchases p
            JOIN users u ON u.id=p.prepared_by AND u.company_id=p.company_id
            WHERE p.id=:id AND p.company_id=:company""",
            {"id": purchase_id, "company": actor.company_id},
        )
        if not records:
            raise BusinessError("NOT_FOUND", "This purchase is unavailable.", 404)
        data = records[0]
        self.ops.work_car(actor, data["cycle_id"], conn)
        params = {"id": purchase_id, "company": actor.company_id}
        terms = PurchaseTerms.model_validate(data["terms"])
        documents = PurchaseDocuments.model_validate(data["documents"])
        inspections = self.inspections(conn, actor, data["cycle_id"])
        inspection_ready = bool(inspections) and all(t.status == "completed" for t in inspections)
        stamp = [t.model_dump(mode="json", by_alias=True) for t in inspections]
        payments = [
            PurchasePayment.model_validate(p)
            for p in rows(
                conn,
                """
            SELECT p.id,p.amount_paise,p.method,p.reference,p.paid_at,u.name AS recorded_by_name,
            r.created_at AS reversed_at,r.reason AS reversal_reason,ru.name AS reversed_by_name
            FROM purchase_payments p JOIN users u ON u.id=p.recorded_by AND u.company_id=p.company_id
            LEFT JOIN purchase_payment_reversals r ON r.payment_id=p.id AND r.company_id=p.company_id
            LEFT JOIN users ru ON ru.id=r.recorded_by AND ru.company_id=r.company_id
            WHERE p.purchase_id=:id AND p.company_id=:company ORDER BY p.created_at DESC,p.id
        """,
                params,
            )
        ]
        paid = sum(p.amount_paise for p in payments if p.reversed_at is None)
        approvals = [
            PurchaseApproval.model_validate(
                {k: v for k, v in r.items() if k != "snapshot"} | {"terms": r["snapshot"]["terms"]}
            )
            for r in rows(
                conn,
                """
            SELECT a.id,a.terms_version,a.decision,a.reason,u.name AS actor_name,a.self_review,a.snapshot,a.created_at
            FROM purchase_approvals a JOIN users u ON u.id=a.actor_id AND u.company_id=a.company_id
            WHERE a.purchase_id=:id AND a.company_id=:company ORDER BY a.created_at DESC,a.id
        """,
                params,
            )
        ]
        revisions = [
            PurchaseRevision.model_validate(r)
            for r in rows(
                conn,
                """
            SELECT r.terms_version,r.terms,u.name AS prepared_by_name,r.created_at
            FROM purchase_revisions r JOIN users u ON u.id=r.prepared_by AND u.company_id=r.company_id
            WHERE r.purchase_id=:id AND r.company_id=:company ORDER BY r.terms_version DESC
        """,
                params,
            )
        ]
        return Purchase(
            id=data["id"],
            company_id=data["company_id"],
            car_id=data["cycle_id"],
            car=self.ops.work_car(actor, data["cycle_id"], conn),
            status=data["status"],
            version=data["version"],
            terms_version=data["terms_version"],
            terms=terms,
            documents=documents,
            prepared_by=data["prepared_by"],
            prepared_by_name=data["prepared_by_name"],
            submitted_by=data["submitted_by"],
            approved_by=data["approved_by"],
            approval_valid=(
                data["status"] in ("approved", "acquired")
                and data["approved_terms_version"] == data["terms_version"]
                and (
                    data["status"] == "acquired"
                    or (inspection_ready and data["approved_inspections"] == stamp)
                )
            ),
            inspection_ready=inspection_ready,
            draft_inspection=any(not t.template_approved for t in inspections),
            inspections=inspections,
            documents_clear=documents_clear(documents),
            expected_contribution_paise=contribution(terms),
            paid_paise=paid,
            balance_paise=terms.purchase_price_paise - paid,
            payments=payments,
            approvals=approvals,
            revisions=revisions,
            agreement_reference=data["agreement_reference"],
            acquired_at=data["acquired_at"],
            receipt=data["receipt"],
            received_at=data["received_at"],
            intake_task_id=data["intake_task_id"],
            updated_at=data["updated_at"],
        )

    def for_car(self, actor: Actor, car_id: UUID) -> Purchase | None:
        with self.engine.connect() as conn:
            self.ops.work_car(actor, car_id, conn)
            data = rows(
                conn,
                "SELECT id FROM purchases WHERE cycle_id=:car AND company_id=:company",
                {"car": car_id, "company": actor.company_id},
            )
            return self.get(actor, data[0]["id"], conn) if data else None

    def list(self, actor: Actor, decisions: bool = False) -> list[Purchase]:
        require(actor, "finance")
        with self.engine.connect() as conn:
            records = rows(
                conn,
                """SELECT id FROM purchases WHERE company_id=:company
                AND (NOT :decisions OR status='submitted') ORDER BY updated_at DESC,id LIMIT 200""",
                {"company": actor.company_id, "decisions": decisions},
            )
            return [self.get(actor, r["id"], conn) for r in records]

    def revision(self, conn: Connection, actor: Actor, purchase_id: UUID, version: int, terms: PurchaseTerms):
        conn.execute(
            text("""INSERT INTO purchase_revisions(purchase_id,company_id,terms_version,terms,prepared_by)
            VALUES(:id,:company,:version,CAST(:terms AS jsonb),:actor)"""),
            {
                "id": purchase_id,
                "company": actor.company_id,
                "version": version,
                "terms": terms.model_dump_json(by_alias=True),
                "actor": actor.id,
            },
        )

    def create(self, actor: Actor, car_id: UUID, body: CreatePurchase) -> Purchase:
        validate_terms(body.terms)

        def execute(conn):
            car = self.ops.work_car(actor, car_id, conn)
            if car.version != body.expected_version:
                raise BusinessError(
                    "VERSION_CONFLICT", "This car changed. Refresh before preparing the purchase.", 409
                )
            if car.stage not in ("inspection", "purchase"):
                raise BusinessError(
                    "PURCHASE_STAGE",
                    "Create the purchase during acquisition, before service or delivery.",
                    409,
                )
            if rows(
                conn,
                "SELECT id FROM purchases WHERE cycle_id=:car AND company_id=:company",
                {"car": car_id, "company": actor.company_id},
            ):
                raise BusinessError("ALREADY_EXISTS", "This car already has a purchase record.", 409)
            purchase_id = uuid4()
            conn.execute(
                text("""INSERT INTO purchases(id,company_id,cycle_id,terms,prepared_by)
                VALUES(:id,:company,:car,CAST(:terms AS jsonb),:actor)"""),
                {
                    "id": purchase_id,
                    "company": actor.company_id,
                    "car": car_id,
                    "terms": body.terms.model_dump_json(by_alias=True),
                    "actor": actor.id,
                },
            )
            from app.adapters.company import CompanyStore

            CompanyStore(self.workflows).assign_in_transaction(conn, actor, car_id, "purchase")
            self.revision(conn, actor, purchase_id, 1, body.terms)
            self.workflows.event(
                conn,
                actor,
                car_id,
                "purchase.created",
                "Purchase valuation prepared",
                purchaseId=str(purchase_id),
            )
            return self.get(actor, purchase_id, conn)

        return self.commands.run(
            actor,
            body.command_id,
            f"car:{car_id}:purchase",
            body,
            Purchase,
            execute,
            lambda conn: (
                self.workflows.lock_car(conn, actor, car_id),
                self.ops.work_car(actor, car_id, conn),
            ),
        )

    def execute(
        self,
        actor: Actor,
        purchase_id: UUID,
        command: PurchaseCommand,
        planner: Callable[[Purchase], PurchasePlan],
    ) -> Purchase:

        if command.action in ("review", "payment", "reverse_payment", "acquire"):
            require(actor, "finance")

        def authorize(conn):
            current = self.get(actor, purchase_id, conn)
            self.workflows.lock_car(conn, actor, current.car_id)
            conn.execute(
                text("SELECT id FROM purchases WHERE id=:id AND company_id=:company FOR UPDATE"),
                {"id": purchase_id, "company": actor.company_id},
            )

        def execute(conn):
            current = self.get(actor, purchase_id, conn)
            if current.version != command.expected_version:
                raise BusinessError(
                    "VERSION_CONFLICT",
                    "This purchase changed. Refresh to see the latest amounts and approvals.",
                    409,
                )
            plan = planner(current)
            if command.action in ("acquire", "receive"):
                from app.adapters.company import CompanyStore

                CompanyStore(self.workflows).require_clear(
                    conn, actor, current.car_id, {"purchase"} if command.action == "acquire" else {"intake"}
                )
            params = {"id": purchase_id, "company": actor.company_id, "actor": actor.id}
            if plan.revise:
                self.revision(conn, actor, purchase_id, current.terms_version + 1, command.terms)
                conn.execute(
                    text("""UPDATE purchases SET terms=CAST(:terms AS jsonb),terms_version=terms_version+1,
                    prepared_by=:actor,submitted_by=NULL,approved_by=NULL,approved_terms_version=NULL,approved_inspections=NULL
                    WHERE id=:id AND company_id=:company"""),
                    params | {"terms": command.terms.model_dump_json(by_alias=True)},
                )
            if plan.submit:
                conn.execute(
                    text("""UPDATE purchases SET submitted_by=:actor,approved_by=NULL,
                    approved_terms_version=NULL,approved_inspections=NULL WHERE id=:id AND company_id=:company"""),
                    params,
                )
            if plan.review:
                snapshot = {
                    "terms": current.terms.model_dump(mode="json", by_alias=True),
                    "documents": current.documents.model_dump(mode="json", by_alias=True),
                    "inspections": [t.model_dump(mode="json", by_alias=True) for t in current.inspections],
                    "preparedBy": str(current.prepared_by),
                    "submittedBy": str(current.submitted_by),
                    "acknowledgeLoss": command.acknowledge_loss,
                    "acknowledgeDraftChecklist": command.acknowledge_draft_checklist,
                }
                conn.execute(
                    text("""INSERT INTO purchase_approvals(id,company_id,purchase_id,terms_version,decision,reason,actor_id,self_review,snapshot)
                    VALUES(:approval,:company,:id,:terms_version,:decision,:reason,:actor,:self_review,CAST(:snapshot AS jsonb))"""),
                    params
                    | {
                        "approval": uuid4(),
                        "terms_version": current.terms_version,
                        "decision": command.decision,
                        "reason": command.reason.strip(),
                        "self_review": current.submitted_by == actor.id,
                        "snapshot": json.dumps(snapshot),
                    },
                )
                if command.decision == "approve":
                    conn.execute(
                        text("""UPDATE purchases SET approved_by=:actor,approved_terms_version=terms_version,
                        approved_inspections=CAST(:inspections AS jsonb) WHERE id=:id AND company_id=:company"""),
                        params | {"inspections": json.dumps(snapshot["inspections"])},
                    )
            if plan.documents:
                conn.execute(
                    text(
                        "UPDATE purchases SET documents=CAST(:documents AS jsonb) WHERE id=:id AND company_id=:company"
                    ),
                    params | {"documents": command.documents.model_dump_json(by_alias=True)},
                )
            if plan.payment:
                canonical = conn.execute(
                    text("SELECT lower(trim(:reference))"), {"reference": command.reference}
                ).scalar_one()
                conn.execute(
                    text("SELECT pg_advisory_xact_lock(hashtextextended(:key,0))"),
                    {"key": f"payment:{actor.company_id}:{command.method}:{canonical}"},
                )
                if rows(
                    conn,
                    "SELECT active_payment_id FROM purchase_payment_references WHERE company_id=:company AND method=:method AND reference_key=:reference AND active_payment_id IS NOT NULL",
                    {"company": actor.company_id, "method": command.method, "reference": canonical},
                ):
                    raise BusinessError(
                        "DUPLICATE_PAYMENT",
                        "This payment reference is already recorded. Open the existing entry before adding another.",
                        409,
                    )
                payment_id = uuid4()
                conn.execute(
                    text("""INSERT INTO purchase_payments(id,company_id,purchase_id,amount_paise,method,reference,paid_at,recorded_by)
                    VALUES(:payment,:company,:id,:amount,:method,:reference,:paid_at,:actor)"""),
                    params
                    | {
                        "payment": payment_id,
                        "amount": command.amount_paise,
                        "method": command.method,
                        "reference": command.reference.strip(),
                        "paid_at": command.paid_at,
                    },
                )
                conn.execute(
                    text("""INSERT INTO purchase_payment_references(company_id,method,reference_key,active_payment_id)
                    VALUES(:company,:method,:reference,:payment) ON CONFLICT(company_id,method,reference_key)
                    DO UPDATE SET active_payment_id=EXCLUDED.active_payment_id"""),
                    {
                        "company": actor.company_id,
                        "method": command.method,
                        "reference": canonical,
                        "payment": payment_id,
                    },
                )
            if plan.reverse_payment:
                payment = next(p for p in current.payments if p.id == command.payment_id)
                canonical = conn.execute(
                    text("SELECT lower(trim(:reference))"), {"reference": payment.reference}
                ).scalar_one()
                conn.execute(
                    text("SELECT pg_advisory_xact_lock(hashtextextended(:key,0))"),
                    {"key": f"payment:{actor.company_id}:{payment.method}:{canonical}"},
                )
                conn.execute(
                    text("""INSERT INTO purchase_payment_reversals(id,company_id,payment_id,reason,recorded_by)
                    VALUES(:reversal,:company,:payment,:reason,:actor)"""),
                    params
                    | {"reversal": uuid4(), "payment": command.payment_id, "reason": command.reason.strip()},
                )
                conn.execute(
                    text(
                        "UPDATE purchase_payment_references SET active_payment_id=NULL WHERE company_id=:company AND active_payment_id=:payment"
                    ),
                    {"company": actor.company_id, "payment": command.payment_id},
                )
            if plan.acquire:
                conn.execute(
                    text(
                        "UPDATE purchases SET agreement_reference=:reference,acquired_at=now() WHERE id=:id AND company_id=:company"
                    ),
                    params | {"reference": command.agreement_reference.strip()},
                )
            if plan.receive:
                template = self.workflows.template(conn, actor, command.receipt.template_id)
                if template.kind != "intake":
                    raise BusinessError(
                        "INVALID_CHECKLIST", "Choose an intake checklist for the received car."
                    )
                task_id = self.workflows.insert_task(
                    conn, actor, current.car_id, template, command.receipt.assigned_to
                )
                if command.receipt.has_new_issue:
                    issue_id = uuid4()
                    conn.execute(
                        text("""INSERT INTO issues(id,company_id,cycle_id,description,created_by)
                        VALUES(:issue,:company,:car,:description,:actor)"""),
                        {
                            "issue": issue_id,
                            "company": actor.company_id,
                            "car": current.car_id,
                            "description": command.receipt.condition_note.strip(),
                            "actor": actor.id,
                        },
                    )
                    self.workflows.event(
                        conn,
                        actor,
                        current.car_id,
                        "issue.created",
                        "Arrival issue recorded at handover",
                        issueId=str(issue_id),
                        purchaseId=str(purchase_id),
                    )

                conn.execute(
                    text(
                        "UPDATE purchases SET receipt=CAST(:receipt AS jsonb),received_at=now(),intake_task_id=:task WHERE id=:id AND company_id=:company"
                    ),
                    params | {"receipt": command.receipt.model_dump_json(by_alias=True), "task": task_id},
                )
                conn.execute(
                    text(
                        "UPDATE vehicles SET odometer_km=:reading WHERE id=:vehicle AND company_id=:company"
                    ),
                    {
                        "vehicle": current.car.vehicle_id,
                        "company": actor.company_id,
                        "reading": command.receipt.odometer_km,
                    },
                )
            conn.execute(
                text(
                    "UPDATE purchases SET status=:status,version=version+1,updated_at=now() WHERE id=:id AND company_id=:company"
                ),
                params | {"status": plan.status},
            )
            if plan.submit or plan.acquire or (plan.review and command.decision == "approve") or plan.receive:
                next_action = (
                    "Complete intake inspection and repair planning"
                    if plan.receive
                    else "Record physical handover"
                    if plan.acquire
                    else "Complete document checks and record the agreement"
                    if plan.review
                    else "Owner to review purchase proposal"
                )
                conn.execute(
                    text("""UPDATE stock_cycles SET stage=CASE WHEN :received THEN 'refurbishment'
                    WHEN stage='inspection' THEN 'purchase' ELSE stage END,
                    location=COALESCE(:location,location),next_action=:next,version=version+1,updated_at=now()
                    WHERE id=:car AND company_id=:company"""),
                    {
                        "car": current.car_id,
                        "company": actor.company_id,
                        "received": plan.receive,
                        "location": command.receipt.location.strip() if plan.receive else None,
                        "next": next_action,
                    },
                )
            labels = {
                "revise": "Purchase terms revised; fresh approval required",
                "submit": "Purchase sent for owner approval",
                "review": "Purchase approved"
                if plan.status == "approved"
                else "Purchase returned for changes",
                "documents": "Purchase document checks recorded",
                "payment": "Seller payment recorded",
                "reverse_payment": "Mistaken payment entry corrected",
                "acquire": "Purchase agreement recorded",
                "receive": "Car handover recorded and intake assigned",
            }
            self.workflows.event(
                conn,
                actor,
                current.car_id,
                f"purchase.{command.action}",
                labels[command.action],
                purchaseId=str(purchase_id),
                termsVersion=current.terms_version,
                purchaseVersion=current.version + 1,
                commandId=str(command.command_id),
            )
            return self.get(actor, purchase_id, conn)

        return self.commands.run(
            actor,
            command.command_id,
            f"purchase:{purchase_id}:command",
            command,
            Purchase,
            execute,
            authorize,
        )
