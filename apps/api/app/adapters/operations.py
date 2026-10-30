import hashlib
import json
from collections.abc import Callable
from dataclasses import asdict
from uuid import UUID, uuid4

from sqlalchemy import text
from sqlalchemy.engine import Connection, Engine

from app.adapters.car_state import refresh_car_work
from app.adapters.decisions import decision_count
from app.contracts import STAGES, Actor, Car, Dashboard, Evidence, Task, TaskCommand
from app.domain.access import can
from app.domain.errors import BusinessError
from app.domain.task_policy import TaskPlan

CAR_SELECT = """SELECT s.id,v.id AS vehicle_id,s.stock_number,v.make,v.model,v.registration,v.year,
s.stage,s.commercial_status,s.service_status,s.location,s.next_action,s.due_at,s.version,s.updated_at,v.image_key,v.odometer_km
FROM stock_cycles s JOIN vehicles v ON v.id=s.vehicle_id AND v.company_id=s.company_id"""
VISIBILITY = """s.company_id=:company AND (:owner OR :catalog OR EXISTS(SELECT 1 FROM tasks visible
WHERE visible.cycle_id=s.id AND visible.company_id=s.company_id AND visible.assigned_to=:actor)
OR EXISTS(SELECT 1 FROM repair_jobs visible_job WHERE visible_job.cycle_id=s.id
AND visible_job.company_id=s.company_id AND visible_job.assigned_to=:actor)
OR EXISTS(SELECT 1 FROM enquiries lead WHERE lead.cycle_id=s.id AND lead.company_id=s.company_id AND lead.assigned_to=:actor))"""


def actor_params(actor: Actor) -> dict:
    return {
        "company": actor.company_id,
        "owner": can(actor, "overview"),
        "catalog": can(actor, "leads"),
        "actor": actor.id,
    }


def rows(conn: Connection, query: str, params: dict | None = None) -> list[dict]:
    return [dict(r) for r in conn.execute(text(query), params or {}).mappings()]


class OperationsStore:
    def __init__(self, engine: Engine):
        self.engine = engine

    def actor_for_token(self, token: str) -> Actor | None:
        with self.engine.connect() as conn:
            data = rows(
                conn,
                """SELECT u.id,u.company_id,u.name,u.role,u.work_roles FROM sessions s JOIN users u ON u.id=s.user_id
                WHERE s.token_hash=:hash AND s.expires_at>now() AND u.active=true""",
                {"hash": hashlib.sha256(token.encode()).hexdigest()},
            )
            return Actor.model_validate(data[0]) if data else None

    def list_cars(
        self,
        actor: Actor,
        stage: str | None = None,
        search: str = "",
        limit: int = 50,
        offset: int = 0,
        conn: Connection | None = None,
    ) -> list[Car]:
        if conn is None:
            with self.engine.connect() as connection:
                return self.list_cars(actor, stage, search, limit, offset, connection)
        params = actor_params(actor) | {"limit": limit, "offset": offset}
        where = VISIBILITY
        if stage:
            where += " AND s.stage=:stage"
            params["stage"] = stage
        if search:
            where += " AND (v.registration ILIKE :search OR v.make||' '||v.model ILIKE :search OR s.stock_number ILIKE :search)"
            params["search"] = (
                "%" + search.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%"
            )
        return [
            Car.model_validate(r)
            for r in rows(
                conn,
                f"{CAR_SELECT} WHERE {where} ORDER BY s.updated_at DESC,s.id LIMIT :limit OFFSET :offset",
                params,
            )
        ]

    def car(self, actor: Actor, car_id: UUID, conn: Connection | None = None) -> Car:
        if conn is None:
            with self.engine.connect() as connection:
                return self.car(actor, car_id, connection)
        result = rows(
            conn, f"{CAR_SELECT} WHERE {VISIBILITY} AND s.id=:id", actor_params(actor) | {"id": car_id}
        )
        if not result:
            raise BusinessError("NOT_FOUND", "This car is unavailable.", 404)
        return Car.model_validate(result[0])

    def task(self, actor: Actor, task_id: UUID, conn: Connection | None = None) -> Task:
        if conn is None:
            with self.engine.connect() as connection:
                return self.task(actor, task_id, connection)
        result = rows(
            conn,
            """SELECT t.id,t.company_id,t.cycle_id AS car_id,t.title,t.assigned_to,u.name AS assignee_name,
            t.status,t.version,t.due_at,t.items,t.kind,t.template_name,t.template_version,t.template_approved,
            t.submitted_by,t.submitted_at,t.recheck_items,t.recheck_note,t.vehicle_configuration,
            EXISTS(SELECT 1 FROM help_requests h WHERE h.task_id=t.id AND h.status='open') AS help_open
            FROM tasks t JOIN users u ON u.id=t.assigned_to AND u.company_id=t.company_id
            WHERE t.id=:id AND t.company_id=:company AND (:owner OR t.assigned_to=:actor)""",
            actor_params(actor) | {"id": task_id},
        )
        if not result:
            raise BusinessError("NOT_FOUND", "This work is unavailable.", 404)
        data = result[0]
        params = {"id": task_id, "company": actor.company_id}
        return Task.model_validate(
            data
            | {
                "car": self.car(actor, data["car_id"], conn),
                "answers": rows(
                    conn,
                    "SELECT item_id,result,note,evidence_id,reading,applicability_confirmed FROM inspection_answers WHERE task_id=:id AND company_id=:company",
                    params,
                ),
                "evidence": rows(
                    conn,
                    "SELECT id,item_id,width,height,bytes,sha256,profile FROM evidence WHERE task_id=:id AND company_id=:company",
                    params,
                ),
                "clip_item_ids": [
                    r["item_id"]
                    for r in rows(
                        conn,
                        """SELECT DISTINCT v.item_id FROM video_clips v WHERE v.task_id=:id AND v.company_id=:company
                    AND v.created_at > COALESCE((SELECT max(r.created_at) FROM task_reviews r WHERE r.task_id=v.task_id
                        AND r.decision='recheck' AND (r.recheck_items='[]'::jsonb OR r.recheck_items ? v.item_id)), '-infinity'::timestamptz)""",
                        params,
                    )
                ],
            }
        )

    def list_tasks(self, actor: Actor, scope: str = "all") -> list[Task]:
        with self.engine.connect() as conn:
            data = rows(
                conn,
                """SELECT id FROM tasks WHERE company_id=:company AND (:owner OR assigned_to=:actor)
                AND (:scope!='mine' OR assigned_to=:actor) AND (:scope!='decisions' OR status='submitted'
                OR EXISTS(SELECT 1 FROM help_requests h WHERE h.task_id=tasks.id AND h.status='open'))
                ORDER BY updated_at DESC,id LIMIT 100""",
                actor_params(actor) | {"scope": scope},
            )
            return [self.task(actor, r["id"], conn) for r in data]

    def dashboard(self, actor: Actor) -> Dashboard:
        with self.engine.connect() as conn:
            counts = rows(
                conn,
                f"""SELECT count(*) AS cars,
                count(*) FILTER(WHERE s.service_status IN ('in_service','waiting_parts')) AS workshop,
                count(*) FILTER(WHERE s.commercial_status='booked') AS booked,
                count(*) FILTER(WHERE s.stage='inspection') AS inspection,
                count(*) FILTER(WHERE s.stage='purchase') AS purchase,
                count(*) FILTER(WHERE s.stage='refurbishment') AS refurbishment,
                count(*) FILTER(WHERE s.stage='ready') AS ready,
                count(*) FILTER(WHERE s.stage='delivered') AS delivered
                FROM stock_cycles s WHERE {VISIBILITY}""",
                actor_params(actor),
            )[0]
            decisions = decision_count(conn, actor)
        tasks = self.list_tasks(actor)
        return Dashboard(
            cars=counts["cars"],
            workshop=counts["workshop"],
            booked=counts["booked"],
            decisions=decisions,
            stages={stage: counts[stage] for stage in STAGES},
            tasks=tasks,
            attention=[Car.model_validate(row) for row in self.attention_rows(actor)],
        )

    def attention_rows(self, actor):
        with self.engine.connect() as conn:
            return rows(
                conn,
                CAR_SELECT
                + " WHERE "
                + VISIBILITY
                + " AND s.service_status='waiting_parts' ORDER BY s.due_at NULLS LAST,s.id LIMIT 8",
                actor_params(actor),
            )

    def execute(
        self, actor: Actor, task_id: UUID, command: TaskCommand, planner: Callable[[Task], TaskPlan]
    ) -> Task:
        fingerprint = hashlib.sha256(
            json.dumps(
                {"id": str(task_id), "command": command.model_dump(mode="json")}, sort_keys=True
            ).encode()
        ).hexdigest()
        with self.engine.begin() as conn:
            conn.execute(
                text("SELECT pg_advisory_xact_lock(hashtextextended(:key,0))"),
                {"key": f"{actor.id}:{command.command_id}"},
            )
            conn.execute(
                text("""SELECT s.id FROM stock_cycles s JOIN tasks t ON t.cycle_id=s.id AND t.company_id=s.company_id
                WHERE t.id=:id AND t.company_id=:company FOR UPDATE OF s"""),
                {"id": task_id, "company": actor.company_id},
            )
            conn.execute(
                text("SELECT id FROM tasks WHERE id=:id AND company_id=:company FOR UPDATE"),
                {"id": task_id, "company": actor.company_id},
            )
            current = self.task(actor, task_id, conn)
            previous = rows(
                conn,
                "SELECT fingerprint,response FROM command_receipts WHERE actor_id=:actor AND command_id=:command",
                {"actor": actor.id, "command": command.command_id},
            )
            if previous:
                if previous[0]["fingerprint"] != fingerprint:
                    raise BusinessError(
                        "IDEMPOTENCY_CONFLICT", "That action reference was used for different work.", 409
                    )
                return Task.model_validate(previous[0]["response"])
            if current.version != command.expected_version:
                raise BusinessError(
                    "VERSION_CONFLICT", "This work changed. Refresh to see the latest version.", 409
                )
            plan = planner(current)
            if plan.assigned_to and not rows(
                conn,
                "SELECT id FROM users WHERE id=:id AND company_id=:company AND active=true",
                {"id": plan.assigned_to, "company": actor.company_id},
            ):
                raise BusinessError("NOT_FOUND", "Choose an active person from this business.", 404)
            common = {
                "company": actor.company_id,
                "task": task_id,
                "actor": actor.id,
                "cycle": current.car_id,
            }
            if plan.answer:
                a = plan.answer
                conn.execute(
                    text("""INSERT INTO inspection_answers(company_id,task_id,item_id,result,note,evidence_id,recorded_by,reading,applicability_confirmed)
                    VALUES(:company,:task,:item,:result,:note,:evidence,:actor,:reading,:confirmed) ON CONFLICT(task_id,item_id)
                    DO UPDATE SET result=EXCLUDED.result,note=EXCLUDED.note,evidence_id=EXCLUDED.evidence_id,
                    reading=EXCLUDED.reading,applicability_confirmed=EXCLUDED.applicability_confirmed,
                    recorded_by=EXCLUDED.recorded_by,updated_at=now()"""),
                    common
                    | {
                        "item": a.item_id,
                        "result": a.result,
                        "note": a.note,
                        "evidence": a.evidence_id,
                        "reading": a.reading,
                        "confirmed": a.applicability_confirmed,
                    },
                )
            if plan.help_request:
                conn.execute(
                    text("""INSERT INTO help_requests(id,company_id,task_id,item_id,requested_by,note)
                    VALUES(:id,:company,:task,:item,:actor,:note) ON CONFLICT(task_id) WHERE status='open' DO NOTHING"""),
                    common
                    | {"id": uuid4(), "item": plan.help_request["itemId"], "note": plan.help_request["note"]},
                )
            if plan.submit and current.kind != "repair_qc":
                for answer in current.answers:
                    if answer.result == "problem":
                        conn.execute(
                            text("""INSERT INTO issues(id,company_id,cycle_id,task_id,item_id,description,evidence_id,created_by,severity)
                            VALUES(:id,:company,:cycle,:task,:item,:description,:evidence,:actor,:severity) ON CONFLICT(task_id,item_id) DO NOTHING"""),
                            common
                            | {
                                "id": uuid4(),
                                "item": answer.item_id,
                                "evidence": answer.evidence_id,
                                "severity": "urgent"
                                if next(i.critical for i in current.items if i.id == answer.item_id)
                                else "normal",
                                "description": answer.note
                                or next(i.title for i in current.items if i.id == answer.item_id),
                            },
                        )
            if plan.review:
                conn.execute(
                    text(
                        "UPDATE help_requests SET status='resolved' WHERE task_id=:task AND company_id=:company AND status='open'"
                    ),
                    common,
                )
            conn.execute(
                text("""UPDATE tasks SET status=:status,assigned_to=:assigned,version=version+1,updated_at=now()
                WHERE id=:task AND company_id=:company"""),
                common
                | {
                    "status": plan.status or current.status,
                    "assigned": plan.assigned_to or current.assigned_to,
                },
            )
            if plan.recheck_items is not None:
                conn.execute(
                    text(
                        "UPDATE tasks SET recheck_items=CAST(:items AS jsonb) WHERE id=:task AND company_id=:company"
                    ),
                    common | {"items": json.dumps(plan.recheck_items)},
                )
            if plan.submit:
                conn.execute(
                    text(
                        "UPDATE tasks SET submitted_by=:actor,submitted_at=now() WHERE id=:task AND company_id=:company"
                    ),
                    common,
                )
                if current.kind != "repair_qc" and any(a.result == "problem" for a in current.answers):
                    refresh_car_work(conn, actor.company_id, current.car_id)
            if current.kind == "repair_qc" and (plan.submit or plan.review):
                job = rows(
                    conn,
                    "SELECT id,issue_id FROM repair_jobs WHERE qc_task_id=:task AND company_id=:company AND cycle_id=:cycle FOR UPDATE",
                    common,
                )
                if not job:
                    raise BusinessError(
                        "REPAIR_UNAVAILABLE", "The repair linked to this QC is unavailable.", 409
                    )
                status = (
                    "awaiting_qc"
                    if plan.submit
                    else "completed"
                    if plan.review["decision"] == "accept"
                    else "in_progress"
                )
                conn.execute(
                    text(
                        "UPDATE repair_jobs SET status=:status,version=version+1,updated_at=now() WHERE id=:id AND company_id=:company"
                    ),
                    {"status": status, "id": job[0]["id"], "company": actor.company_id},
                )
                if status == "completed":
                    conn.execute(
                        text(
                            "UPDATE issues SET status='resolved',version=version+1 WHERE id=:id AND company_id=:company"
                        ),
                        {"id": job[0]["issue_id"], "company": actor.company_id},
                    )
                refresh_car_work(conn, actor.company_id, current.car_id)
            if plan.review:
                conn.execute(
                    text("UPDATE tasks SET recheck_note=:note WHERE id=:task AND company_id=:company"),
                    common | {"note": command.note.strip() if command.decision == "recheck" else ""},
                )
                conn.execute(
                    text("""INSERT INTO task_reviews(id,task_id,submitted_version,reviewer_id,decision,self_review,note,recheck_items)
                    VALUES(:id,:task,:version,:actor,:decision,:self_review,:note,CAST(:items AS jsonb))"""),
                    common
                    | {
                        "id": uuid4(),
                        "version": current.version,
                        "decision": plan.review["decision"],
                        "self_review": plan.review["selfReview"],
                        "note": command.note.strip(),
                        "items": json.dumps(plan.recheck_items or []),
                    },
                )
            details = asdict(plan) | {
                "commandId": str(command.command_id),
                "priorVersion": current.version,
                "newVersion": current.version + 1,
                "previousAssignee": str(current.assigned_to),
            }
            if plan.answer:
                details["answer"] = plan.answer.model_dump(mode="json", by_alias=True)
            self.audit(conn, actor, current.car_id, f"task.{command.action}", details)
            conn.execute(
                text(
                    "INSERT INTO outbox(id,company_id,kind,payload) VALUES(:id,:company,:kind,CAST(:payload AS jsonb))"
                ),
                {
                    "id": uuid4(),
                    "company": actor.company_id,
                    "kind": f"task.{command.action}",
                    "payload": json.dumps(
                        {
                            "taskId": str(task_id),
                            "actorId": str(actor.id),
                            "version": current.version + 1,
                            "previousAssignedTo": str(current.assigned_to),
                        }
                    ),
                },
            )
            updated = self.task(actor, task_id, conn)
            if plan.submit:
                snapshot = updated.model_dump(mode="json", by_alias=True)
                snapshot["videoClips"] = [
                    dict(row)
                    for row in conn.execute(
                        text(
                            "SELECT id,item_id,width,height,duration_ms,sha256,profile,recorded_by,created_at FROM video_clips WHERE task_id=:task AND company_id=:company ORDER BY created_at,id"
                        ),
                        common,
                    ).mappings()
                ]
                conn.execute(
                    text("""INSERT INTO task_submissions(task_id,task_version,submitted_by,snapshot)
                    VALUES(:task,:version,:actor,CAST(:snapshot AS jsonb))"""),
                    common | {"version": updated.version, "snapshot": json.dumps(snapshot, default=str)},
                )
            conn.execute(
                text(
                    "INSERT INTO command_receipts(actor_id,command_id,fingerprint,response) VALUES(:actor,:command,:fingerprint,CAST(:response AS jsonb))"
                ),
                {
                    "actor": actor.id,
                    "command": command.command_id,
                    "fingerprint": fingerprint,
                    "response": updated.model_dump_json(by_alias=True),
                },
            )
            return updated

    def audit(self, conn: Connection, actor: Actor, aggregate_id: UUID, action: str, details: dict) -> None:
        conn.execute(
            text(
                "INSERT INTO audit_events(id,company_id,actor_id,aggregate_id,action,details) VALUES(:id,:company,:actor,:aggregate,:action,CAST(:details AS jsonb))"
            ),
            {
                "id": uuid4(),
                "company": actor.company_id,
                "actor": actor.id,
                "aggregate": aggregate_id,
                "action": action,
                "details": json.dumps(details, default=str),
            },
        )

    def evidence(self, actor: Actor, evidence_id: UUID) -> dict:
        with self.engine.connect() as conn:
            data = rows(
                conn,
                """SELECT e.* FROM evidence e JOIN tasks t ON t.id=e.task_id AND t.company_id=e.company_id
                WHERE e.id=:id AND e.company_id=:company AND (:owner OR t.assigned_to=:actor OR EXISTS(
                    SELECT 1 FROM issues i JOIN repair_jobs j ON j.issue_id=i.id AND j.company_id=i.company_id
                    WHERE i.evidence_id=e.id AND i.company_id=e.company_id AND j.assigned_to=:actor))""",
                actor_params(actor) | {"id": evidence_id},
            )
            if not data:
                raise BusinessError("NOT_FOUND", "This photo is unavailable.", 404)
            return data[0]

    def record_evidence(self, actor: Actor, task_id: UUID, evidence: Evidence, storage_key: str) -> bool:
        with self.engine.begin() as conn:
            conn.execute(
                text("SELECT id FROM tasks WHERE id=:id AND company_id=:company FOR UPDATE"),
                {"id": task_id, "company": actor.company_id},
            )
            task = self.task(actor, task_id, conn)
            if task.assigned_to != actor.id:
                raise BusinessError("TAKEOVER_REQUIRED", "Take over this task before adding a photo.", 409)
            if task.status in ("submitted", "completed"):
                raise BusinessError("CONFLICT", "This check was already sent.", 409)
            if not any(i.id == evidence.item_id for i in task.items):
                raise BusinessError("INVALID_ITEM", "That check is not part of this task.")
            existing = rows(
                conn,
                "SELECT company_id,task_id,item_id,sha256 FROM evidence WHERE id=:id",
                {"id": evidence.id},
            )
            if existing:
                old = existing[0]
                if (
                    old["company_id"] != actor.company_id
                    or old["task_id"] != task_id
                    or old["item_id"] != evidence.item_id
                    or old["sha256"] != evidence.sha256
                ):
                    raise BusinessError(
                        "IDEMPOTENCY_CONFLICT", "A different photo already uses this reference.", 409
                    )
                return False
            conn.execute(
                text("""INSERT INTO evidence(id,company_id,task_id,item_id,uploaded_by,storage_key,width,height,bytes,sha256,profile)
                VALUES(:id,:company,:task,:item,:actor,:key,:width,:height,:bytes,:sha256,:profile)"""),
                {
                    "id": evidence.id,
                    "company": actor.company_id,
                    "task": task_id,
                    "item": evidence.item_id,
                    "actor": actor.id,
                    "key": storage_key,
                    "width": evidence.width,
                    "height": evidence.height,
                    "bytes": evidence.bytes,
                    "sha256": evidence.sha256,
                    "profile": evidence.profile,
                },
            )
            self.audit(
                conn, actor, task.car_id, "evidence.received", evidence.model_dump(mode="json", by_alias=True)
            )
            return True
