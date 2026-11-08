"""Transactional section/check allocation and immediately persisted work routines."""

import json
from uuid import uuid4

from sqlalchemy import text

from app.adapters.command_transaction import CommandTransaction
from app.adapters.inspection_access import allocations
from app.adapters.operations import rows
from app.contracts import Task
from app.domain.access import require
from app.domain.errors import BusinessError
from app.domain.inspection_allocation import master_status


class InspectionAllocationStore:
    def __init__(self, ops):
        self.ops = ops
        self.engine = ops.engine
        self.commands = CommandTransaction(self.engine)

    def allocate(self, actor, task_id, body):
        require(actor, "assign_inspection")

        def execute(conn):
            p = {"task": task_id, "company": actor.company_id}
            conn.execute(
                text(
                    "SELECT s.id FROM stock_cycles s JOIN tasks t ON t.cycle_id=s.id AND t.company_id=s.company_id WHERE t.id=:task AND t.company_id=:company FOR UPDATE OF s"
                ),
                p,
            )
            conn.execute(text("SELECT id FROM tasks WHERE id=:task AND company_id=:company FOR UPDATE"), p)
            task = self.ops.task(actor, task_id, conn)
            if task.version != body.expected_version:
                raise BusinessError("VERSION_CONFLICT", "Inspection allocations changed. Refresh.", 409)
            if task.status in ("submitted", "completed") and not task.collaborative:
                raise BusinessError(
                    "REVIEW_REQUIRED", "Return the legacy submission before changing its allocation.", 409
                )
            if task.status == "completed":
                raise BusinessError(
                    "INSPECTION_CLOSED", "A completed inspection keeps its allocation history.", 409
                )
            if not task.collaborative:
                conn.execute(
                    text("""UPDATE inspection_check_allocations c SET state=CASE
                WHEN t.recheck_items ? c.item_id THEN 'recheck'
                WHEN EXISTS(SELECT 1 FROM inspection_answers a WHERE a.task_id=c.task_id AND a.item_id=c.item_id) THEN 'in_progress'
                ELSE 'assigned' END FROM tasks t WHERE t.id=c.task_id AND c.task_id=:task AND c.company_id=:company"""),
                    p,
                )
            current = {a.item_id: a for a in allocations(conn, actor.company_id, task_id)}
            ids = {i.id for i in task.items}
            changed = set()
            if not task.collaborative and body.unallocate_unmentioned:
                selected = {i for c in body.changes for i in c.item_ids}
                # Preserve started work and admitted proof when enabling team allocation.
                started = {a.item_id for a in task.answers} | {e.item_id for e in task.evidence}
                started |= {
                    r["item_id"]
                    for r in rows(
                        conn,
                        "SELECT DISTINCT item_id FROM video_clips WHERE task_id=:task AND company_id=:company",
                        p,
                    )
                }
                for item_id in ids - selected - started:
                    conn.execute(
                        text(
                            "UPDATE inspection_check_allocations SET assigned_to=NULL,state='unassigned',assignment_version=assignment_version+1,version=version+1 WHERE task_id=:task AND company_id=:company AND item_id=:item"
                        ),
                        p | {"item": item_id},
                    )
                    changed.add(item_id)
            for change in body.changes:
                if not set(change.item_ids) <= ids:
                    raise BusinessError("INVALID_ITEM", "Choose checks from this inspection only.", 400)
                if change.assigned_to:
                    if not rows(
                        conn,
                        "SELECT id FROM users WHERE id=:user AND company_id=:company AND active",
                        p | {"user": change.assigned_to},
                    ):
                        raise BusinessError("NOT_FOUND", "Choose an active person from this company.", 404)
                    conn.execute(
                        text(
                            "INSERT INTO inspection_work_assignments(company_id,task_id,user_id,created_by,origin) VALUES(:company,:task,:user,:actor,'allocation') ON CONFLICT(task_id,user_id) DO NOTHING"
                        ),
                        p | {"user": change.assigned_to, "actor": actor.id},
                    )
                for item_id in change.item_ids:
                    old = current[item_id]
                    if old.assigned_to == change.assigned_to:
                        continue
                    if old.state in ("submitted", "accepted", "waived"):
                        raise BusinessError(
                            "REVIEW_REQUIRED",
                            "Return reviewed/submitted checks before handing them over.",
                            409,
                        )
                    state = (
                        "unassigned"
                        if change.assigned_to is None
                        else "recheck"
                        if old.state == "recheck"
                        else "in_progress"
                        if old.answered_by
                        else "assigned"
                    )
                    conn.execute(
                        text(
                            "UPDATE inspection_check_allocations SET assigned_to=:user,assignment_version=assignment_version+1,version=version+1,state=:state WHERE task_id=:task AND company_id=:company AND item_id=:item"
                        ),
                        p | {"item": item_id, "user": change.assigned_to, "state": state},
                    )
                    changed.add(item_id)
            after = {a.item_id: a for a in allocations(conn, actor.company_id, task_id)}
            for item_id in sorted(changed):
                conn.execute(
                    text(
                        "INSERT INTO inspection_check_events(company_id,task_id,item_id,action,before_state,after_state,reason,recorded_by) VALUES(:company,:task,:item,'allocate',CAST(:before AS jsonb),CAST(:after AS jsonb),:reason,:actor)"
                    ),
                    p
                    | {
                        "item": item_id,
                        "before": current[item_id].model_dump_json(by_alias=True),
                        "after": after[item_id].model_dump_json(by_alias=True),
                        "reason": body.reason.strip(),
                        "actor": actor.id,
                    },
                )
            status = master_status(after.values())
            conn.execute(
                text(
                    "UPDATE tasks SET collaborative=true,status=:status,version=version+1,updated_at=now() WHERE id=:task AND company_id=:company"
                ),
                p | {"status": status},
            )
            self.ops.audit(
                conn,
                actor,
                task.car_id,
                "inspection.allocated",
                {
                    "taskId": str(task_id),
                    "changes": body.model_dump(mode="json", by_alias=True),
                    "priorVersion": task.version,
                },
            )
            conn.execute(
                text(
                    "INSERT INTO outbox(id,company_id,kind,payload) VALUES(:id,:company,'task.allocated',CAST(:payload AS jsonb))"
                ),
                p
                | {
                    "id": uuid4(),
                    "payload": json.dumps(
                        {"taskId": str(task_id), "actorId": str(actor.id), "version": task.version + 1}
                    ),
                },
            )
            return self.ops.task(actor, task_id, conn)

        return self.commands.run(
            actor, body.command_id, f"inspection:{task_id}:allocation", body, Task, execute
        )
