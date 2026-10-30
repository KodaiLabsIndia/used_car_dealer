import hashlib
import json
from pathlib import Path

from sqlalchemy import text

from app.adapters.media import inspect_photo
from app.adapters.operations import rows
from app.application.assistant import SourceBundle
from app.assistant_contracts import AISource, AssistantInput
from app.contracts import Actor
from app.domain.assistant_policy import authorize_assistant
from app.domain.errors import BusinessError


class AssistantContext:
    def __init__(self, workflows, commercial, documents, root: Path):
        self.workflows, self.commercial, self.documents, self.root = workflows, commercial, documents, root

    def build(self, actor: Actor, body: AssistantInput, with_images=False) -> SourceBundle:
        authorize_assistant(actor, body)
        facts = []
        sources = []
        images = []

        def add(id, label, kind, data, target=None, version=None):
            sources.append(AISource(id=id, label=label, target_type=kind, target_id=target, version=version))
            facts.append({"sourceId": id, "data": data})

        with self.workflows.engine.connect().execution_options(isolation_level="REPEATABLE READ") as conn:
            with conn.begin():
                cutoff = conn.execute(text("SELECT clock_timestamp()")).scalar_one()
                task = self.workflows.ops.task(actor, body.task_id, conn) if body.task_id else None
                car_id = body.car_id or (task.car_id if task else None)
                if task and body.car_id and body.car_id != task.car_id:
                    raise BusinessError("WRONG_CAR", "This inspection belongs to another car.")
                if body.item_id and (not task or not any(item.id == body.item_id for item in task.items)):
                    raise BusinessError("INVALID_ITEM", "This check is unavailable.")
                if car_id:
                    car = self.workflows.ops.car(actor, car_id, conn)
                    add(
                        "car:" + str(car.id),
                        car.make + " " + car.model + " · " + car.registration,
                        "car",
                        car.model_dump(mode="json", by_alias=True),
                        car.id,
                        car.version,
                    )
                elif body.capability != "owner_brief":
                    raise BusinessError("CAR_REQUIRED", "Open the car before using this assistant.")
                else:
                    counts = rows(
                        conn,
                        "SELECT stage,count(*) AS count FROM stock_cycles WHERE company_id=:company GROUP BY stage",
                        {"company": actor.company_id},
                    )
                    add(
                        "dashboard",
                        "Company stock totals",
                        "dashboard",
                        {"stages": counts, "total": sum(c["count"] for c in counts), "sampleLimit": 20},
                    )
                    for car in self.workflows.ops.list_cars(actor, limit=20, conn=conn):
                        add(
                            "car:" + str(car.id),
                            car.make + " " + car.model + " · " + car.registration,
                            "car",
                            car.model_dump(mode="json", by_alias=True),
                            car.id,
                            car.version,
                        )
                if task:
                    items = [
                        {
                            "id": i.id,
                            "title": i.title_hi if body.language == "hi" else i.title,
                            "instruction": i.instruction_hi if body.language == "hi" else i.instruction,
                            "required": i.required,
                        }
                        for i in task.items
                        if not body.item_id or i.id == body.item_id
                    ]
                    add(
                        "task:" + str(task.id),
                        task.title,
                        "task",
                        {
                            "id": str(task.id),
                            "version": task.version,
                            "status": task.status,
                            "assignedTo": str(task.assigned_to),
                            "assigneeName": task.assignee_name,
                            "kind": task.kind,
                            "approvedTemplate": task.template_approved,
                            "items": items,
                            "answers": [
                                a.model_dump(mode="json", by_alias=True)
                                for a in task.answers
                                if not body.item_id or a.item_id == body.item_id
                            ],
                        },
                        task.id,
                        task.version,
                    )
                if body.capability in ("owner_brief", "quote_review", "handover_brief") and car_id:
                    business = self.commercial.get(actor, car_id, conn)
                    values = business.model_dump(mode="json", by_alias=True, exclude={"car", "ledger"})
                    for booking in values["bookings"]:
                        booking.pop("customerPhone", None)
                    add(
                        "business:" + str(car_id),
                        "Recorded costs, sale and warranty",
                        "business",
                        values,
                        car_id,
                        business.car.version,
                    )
                if body.capability == "voice_task":
                    people = rows(
                        conn,
                        "SELECT id,name FROM users WHERE company_id=:company AND active=true ORDER BY name LIMIT 60",
                        {"company": actor.company_id},
                    )
                    add("people", "Available staff", "input", people)
                for id in body.evidence_ids:
                    evidence = self.workflows.ops.evidence(actor, id)
                    linked = conn.execute(
                        text("SELECT cycle_id FROM tasks WHERE id=:id AND company_id=:company"),
                        {"id": evidence["task_id"], "company": actor.company_id},
                    ).scalar_one()
                    if linked != car_id:
                        raise BusinessError("WRONG_CAR", "Choose photos belonging to this car.")
                    add(
                        "photo:" + str(id),
                        "Inspection photo · " + evidence["item_id"],
                        "task",
                        {
                            "sha256": evidence["sha256"],
                            "width": evidence["width"],
                            "height": evidence["height"],
                            "itemId": evidence["item_id"],
                        },
                        evidence["task_id"],
                    )
                    if with_images:
                        images.append(self.image(evidence["storage_key"], evidence["sha256"]))
                for id in body.document_ids:
                    document = self.documents.get(actor, id, conn)
                    if document.car_id != car_id:
                        raise BusinessError("WRONG_CAR", "Choose pages belonging to this car.")
                    add(
                        "document:" + str(id),
                        document.title,
                        "document",
                        document.model_dump(mode="json", by_alias=True),
                        id,
                        document.version,
                    )
                    if with_images:
                        key = conn.execute(
                            text("SELECT storage_key FROM documents WHERE id=:id AND company_id=:company"),
                            {"id": id, "company": actor.company_id},
                        ).scalar_one()
                        images.append(self.image(key, document.sha256))
                if body.text.strip():
                    add(
                        "input",
                        "Typed / dictated user report",
                        "input",
                        {
                            "report": body.text.strip(),
                            "verification": "User report; not independently verified",
                        },
                    )
        raw = json.dumps(facts, sort_keys=True, ensure_ascii=False, default=str)
        if len(raw) > 30000:
            raise BusinessError(
                "AI_CONTEXT_TOO_LARGE", "Choose one car or a smaller set of photos and records."
            )
        digest = hashlib.sha256(raw.encode()).hexdigest()
        return SourceBundle(
            text=json.dumps(
                {
                    "capability": body.capability,
                    "cutoff": str(cutoff),
                    "records": facts,
                    "imageSourceIds": [
                        source.id
                        for source in sources
                        if source.id.startswith(("photo:", "evidence:", "document:"))
                    ],
                },
                ensure_ascii=False,
                default=str,
            ),
            source_hash=digest,
            sources=sources,
            cutoff=cutoff,
            images=images,
        )

    def image(self, key, sha):
        path = (self.root / key).resolve()
        if path.parent != self.root.resolve() or not path.is_file():
            raise BusinessError(
                "MEDIA_MISSING", "A selected photo is unavailable. Choose another photo.", 404
            )
        data = path.read_bytes()
        if inspect_photo(data)["sha256"] != sha:
            raise BusinessError("MEDIA_CHANGED", "The selected photo failed its integrity check.", 409)
        return data
