import json
from uuid import UUID, uuid4

from sqlalchemy import text

from app.adapters.command_transaction import CommandTransaction
from app.adapters.operations import OperationsStore, rows
from app.adapters.workflows import WorkflowStore
from app.checklist_contracts import (
    ApproveChecklist,
    ChecklistApproval,
    CreateChecklistRevision,
    ManagedChecklist,
)
from app.contracts import Actor
from app.domain.errors import BusinessError


class ChecklistStore:
    def __init__(self, operations: OperationsStore):
        self.ops = operations
        self.engine = operations.engine
        self.workflows = WorkflowStore(operations)
        self.commands = CommandTransaction(self.engine)

    def owner(self, actor):
        if actor.role != "owner":
            raise BusinessError("FORBIDDEN", "Only the owner can manage checklist versions.", 403)

    def record(self, conn, actor, template_id):
        template = self.workflows.template(conn, actor, template_id)
        data = rows(
            conn,
            """SELECT t.based_on_id,t.created_by,u.name creator_name,t.created_at,t.revision_reason
            FROM checklist_templates t LEFT JOIN users u ON u.id=t.created_by AND u.company_id=t.company_id
            WHERE t.id=:id AND t.company_id=:company""",
            {"id": template_id, "company": actor.company_id},
        )[0]
        reviews = rows(
            conn,
            """SELECT a.approved_by,u.name reviewer_name,a.reason,a.created_at
            FROM checklist_approvals a JOIN users u ON u.id=a.approved_by AND u.company_id=a.company_id
            WHERE a.template_id=:id AND a.company_id=:company""",
            {"id": template_id, "company": actor.company_id},
        )
        return ManagedChecklist(
            template=template,
            **data,
            approval=ChecklistApproval.model_validate(reviews[0]) if reviews else None,
        )

    def list(self, actor):
        self.owner(actor)
        with self.engine.connect() as conn:
            ids = rows(
                conn,
                "SELECT id FROM checklist_templates WHERE company_id=:company ORDER BY kind,lower(name),version DESC",
                {"company": actor.company_id},
            )
            return [self.record(conn, actor, row["id"]) for row in ids]

    def create(self, actor: Actor, body: CreateChecklistRevision):
        self.owner(actor)
        name = body.name.strip()
        if not name or not body.reason.strip() or len({i.id for i in body.items}) != len(body.items):
            raise BusinessError(
                "INVALID_CHECKLIST",
                "Give the checklist a name, revision reason and unique check identifiers.",
                400,
            )
        if not any(i.required for i in body.items):
            raise BusinessError("INVALID_CHECKLIST", "Include at least one required check.", 400)
        if len({i.order for i in body.items}) != len(body.items):
            raise BusinessError("INVALID_CHECKLIST", "Each check needs a distinct position.")
        for item in body.items:
            if item.method == "measurement" and item.measurement_unit is None:
                raise BusinessError("INVALID_CHECKLIST", "Measurement checks need a measurement unit.")
            if not set(item.applicability.fuels) <= {
                "petrol",
                "diesel",
                "cng",
                "lpg",
                "hybrid",
                "electric",
            } or not set(item.applicability.transmissions) <= {"manual", "automatic", "amt", "cvt", "dct"}:
                raise BusinessError("INVALID_CHECKLIST", "Choose supported fuel and transmission rules.")
            if not all(v.strip() for v in [item.title, item.title_hi, item.instruction, item.instruction_hi]):
                raise BusinessError(
                    "INVALID_CHECKLIST",
                    "Each check needs a short title and instructions in English and Hindi.",
                    400,
                )

        def execute(conn):
            conn.execute(
                text("SELECT pg_advisory_xact_lock(hashtextextended(:key,0))"),
                {"key": f"checklist:{actor.company_id}:{name.lower()}"},
            )
            if body.based_on_id:
                previous = self.workflows.template(conn, actor, body.based_on_id)
                if previous.kind != body.kind or previous.name.lower() != name.lower():
                    raise BusinessError(
                        "INVALID_REVISION",
                        "Keep the original checklist name and stage when creating a revision.",
                        400,
                    )
            latest = rows(
                conn,
                "SELECT id,version,kind FROM checklist_templates WHERE company_id=:company AND lower(name)=lower(:name) ORDER BY version DESC LIMIT 1",
                {"company": actor.company_id, "name": name},
            )
            if latest and (not body.based_on_id or latest[0]["id"] != body.based_on_id):
                raise BusinessError(
                    "VERSION_CONFLICT", "Start from the latest checklist version and retry.", 409
                )
            version = latest[0]["version"] + 1 if latest else 1
            id = uuid4()
            items = [
                item.model_dump(mode="json", by_alias=True) | {"order": n}
                for n, item in enumerate(body.items, 1)
            ]
            conn.execute(
                text("""INSERT INTO checklist_templates(id,company_id,name,kind,version,items,based_on_id,created_by,revision_reason)
                VALUES(:id,:company,:name,:kind,:version,CAST(:items AS jsonb),:base,:actor,:reason)"""),
                {
                    "id": id,
                    "company": actor.company_id,
                    "name": name,
                    "kind": body.kind,
                    "version": version,
                    "items": json.dumps(items),
                    "base": body.based_on_id,
                    "actor": actor.id,
                    "reason": body.reason.strip(),
                },
            )
            self.ops.audit(
                conn,
                actor,
                id,
                "checklist.revision_created",
                {
                    "summary": "Checklist revision saved",
                    "name": name,
                    "version": version,
                    "basedOnId": str(body.based_on_id) if body.based_on_id else None,
                    "reason": body.reason.strip(),
                },
            )
            return self.record(conn, actor, id)

        return self.commands.run(actor, body.command_id, "checklist.create", body, ManagedChecklist, execute)

    def approve(self, actor: Actor, id: UUID, body: ApproveChecklist):
        self.owner(actor)
        if not body.instructions_reviewed or not body.reason.strip():
            raise BusinessError(
                "REVIEW_REQUIRED", "Review every instruction and record why this version is approved.", 400
            )

        def execute(conn):
            initial = self.workflows.template(conn, actor, id)
            conn.execute(
                text("SELECT pg_advisory_xact_lock(hashtextextended(:key,0))"),
                {"key": f"checklist:{actor.company_id}:{initial.name.lower()}"},
            )
            conn.execute(
                text("SELECT id FROM checklist_templates WHERE id=:id AND company_id=:company FOR UPDATE"),
                {"id": id, "company": actor.company_id},
            )
            current = self.workflows.template(conn, actor, id)
            latest = rows(
                conn,
                "SELECT max(version) version FROM checklist_templates WHERE company_id=:company AND lower(name)=lower(:name)",
                {"company": actor.company_id, "name": current.name},
            )[0]["version"]
            if current.version != body.expected_version or current.approved or current.version != latest:
                raise BusinessError(
                    "VERSION_CONFLICT",
                    "This version was already approved or changed. Refresh the checklist.",
                    409,
                )
            conn.execute(
                text(
                    "INSERT INTO checklist_approvals(id,company_id,template_id,approved_by,reason) VALUES(:review,:company,:id,:actor,:reason)"
                ),
                {
                    "review": uuid4(),
                    "company": actor.company_id,
                    "id": id,
                    "actor": actor.id,
                    "reason": body.reason.strip(),
                },
            )
            conn.execute(
                text("UPDATE checklist_templates SET approved=true WHERE id=:id AND company_id=:company"),
                {"id": id, "company": actor.company_id},
            )
            self.ops.audit(
                conn,
                actor,
                id,
                "checklist.approved",
                {
                    "summary": "Checklist version approved by owner",
                    "version": current.version,
                    "reason": body.reason.strip(),
                    "selfReview": rows(
                        conn, "SELECT created_by FROM checklist_templates WHERE id=:id", {"id": id}
                    )[0]["created_by"]
                    == actor.id,
                },
            )
            return self.record(conn, actor, id)

        return self.commands.run(
            actor, body.command_id, f"checklist.approve:{id}", body, ManagedChecklist, execute
        )
