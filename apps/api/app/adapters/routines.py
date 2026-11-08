"""SBOSS daily-work lifecycle adapted to immutable Arihant routines.

A due time never fabricates completion. Today's first step freezes the assigned
person and checklist. Later edits/pause affect future starts, not recorded work.
"""

from datetime import date
from uuid import UUID

from sqlalchemy import text

from app.adapters.command_transaction import CommandTransaction
from app.adapters.operations import rows
from app.domain.access import can, require
from app.domain.errors import BusinessError
from app.domain.workforce_time import business_local_date
from app.routine_contracts import (
    RoutineBoard,
    RoutineDefinition,
    RoutineItem,
    RoutineStepCommand,
    SaveRoutine,
)


class RoutineStore:
    def __init__(self, workflows):
        self.engine = workflows.engine
        self.workflows = workflows
        self.commands = CommandTransaction(self.engine)

    def today(self, conn):
        return business_local_date(
            conn.execute(text("SELECT clock_timestamp()")).scalar_one(), "Asia/Kolkata"
        )

    def definitions(self, conn, actor):
        return rows(
            conn,
            "SELECT DISTINCT ON(id) * FROM staff_routines WHERE company_id=:company ORDER BY id,version DESC",
            {"company": actor.company_id},
        )

    def lock(self, conn, actor):
        conn.execute(
            text("SELECT pg_advisory_xact_lock(hashtextextended(:key,0))"),
            {"key": f"routines:{actor.company_id}"},
        )

    def board(self, actor, day: date | None = None, conn=None):
        if conn is None:
            with self.engine.connect().execution_options(isolation_level="REPEATABLE READ") as c:
                with c.begin():
                    return self.board(actor, day, c)
        today = self.today(conn)
        day = day or today
        p = {"company": actor.company_id, "day": day}
        definitions = {r["id"]: r for r in self.definitions(conn, actor)}
        runs = {
            r["routine_id"]: r
            for r in rows(conn, "SELECT * FROM routine_runs WHERE company_id=:company AND work_date=:day", p)
        }
        names = {
            r["id"]: r["name"] for r in rows(conn, "SELECT id,name FROM users WHERE company_id=:company", p)
        }
        items = []
        for id in definitions.keys() | runs.keys():
            current = definitions[id]
            run = runs.get(id)
            definition = RoutineDefinition.model_validate(run["snapshot"] if run else current["definition"])
            if not can(actor, "overview") and definition.assigned_to != actor.id:
                continue
            # Past dates expose saved work only; do not infer assignments from current templates.
            if day != today and run is None:
                continue
            events = rows(
                conn,
                "SELECT e.version,e.step,e.done,e.note,e.created_at,u.name by_name FROM routine_step_events e JOIN users u ON u.id=e.recorded_by AND u.company_id=e.company_id WHERE e.company_id=:company AND e.routine_id=:id AND e.work_date=:day ORDER BY e.version",
                p | {"id": id},
            )
            completed = set()
            for event in events:
                completed.add(event["step"]) if event["done"] else completed.discard(event["step"])
            items.append(
                RoutineItem(
                    template_version=current["version"],
                    current_definition=RoutineDefinition.model_validate(current["definition"]),
                    id=id,
                    version=run["definition_version"] if run else current["version"],
                    definition=definition,
                    assignee_name=names[definition.assigned_to],
                    work_date=day,
                    run_version=len(events),
                    completed_steps=sorted(completed),
                    events=events,
                    started=run is not None,
                    due_today=bool(run or (definition.active and day.weekday() in definition.weekdays)),
                )
            )
        return RoutineBoard(
            today=today, items=sorted(items, key=lambda i: (not i.due_today, i.definition.title, str(i.id)))
        )

    def save(self, actor, id: UUID, body: SaveRoutine):
        require(actor, "overview")

        def execute(conn):
            self.lock(conn, actor)
            previous = next((r for r in self.definitions(conn, actor) if r["id"] == id), None)
            if body.expected_version != (previous["version"] if previous else 0):
                raise BusinessError("VERSION_CONFLICT", "This routine changed. Refresh before saving.", 409)
            person = rows(
                conn,
                "SELECT id FROM users WHERE id=:user AND company_id=:company AND active",
                {"user": body.definition.assigned_to, "company": actor.company_id},
            )
            if not person:
                raise BusinessError("NOT_FOUND", "Choose an active team member.", 404)
            conn.execute(
                text(
                    "INSERT INTO staff_routines(id,company_id,version,definition,assigned_to,active,reason,recorded_by) VALUES(:id,:company,:version,CAST(:definition AS jsonb),:user,:active,:reason,:actor)"
                ),
                {
                    "id": id,
                    "company": actor.company_id,
                    "version": body.expected_version + 1,
                    "definition": body.definition.model_dump_json(by_alias=True),
                    "user": body.definition.assigned_to,
                    "active": body.definition.active,
                    "reason": body.reason,
                    "actor": actor.id,
                },
            )
            self.workflows.ops.audit(
                conn,
                actor,
                id,
                "routine.saved",
                {"version": body.expected_version + 1, "reason": body.reason},
            )
            return self.board(actor, conn=conn)

        return self.commands.run(actor, body.command_id, f"routine:{id}:save", body, RoutineBoard, execute)

    def step(self, actor, id: UUID, body: RoutineStepCommand):
        def authorize(conn):
            self.lock(conn, actor)
            board = self.board(actor, body.work_date, conn)
            item = next((i for i in board.items if i.id == id), None)
            if not item:
                raise BusinessError("NOT_FOUND", "This routine is unavailable.", 404)
            if item.definition.assigned_to != actor.id:
                raise BusinessError("FORBIDDEN", "Only the assigned person can log these steps.", 403)

        def execute(conn):
            board = self.board(actor, body.work_date, conn)
            item = next(i for i in board.items if i.id == id)
            if body.work_date != board.today:
                raise BusinessError("DAY_CLOSED", "Past work stays unchanged. Log today's work instead.", 409)
            if not item.due_today:
                raise BusinessError("NOT_DUE", "This routine is paused or not due today.", 409)
            if item.version != body.definition_version or item.run_version != body.expected_version:
                raise BusinessError("VERSION_CONFLICT", "This routine changed. Refresh its steps.", 409)
            if body.step >= len(item.definition.steps):
                raise BusinessError("INVALID_STEP", "Choose a saved routine step.", 400)
            if body.action == "reopen" and len(body.note.strip()) < 3:
                raise BusinessError("REASON_REQUIRED", "Record why this step needs doing again.", 400)
            if (body.step in item.completed_steps) == (body.action == "done"):
                raise BusinessError("VERSION_CONFLICT", "This step already has that result. Refresh.", 409)
            p = {"id": id, "company": actor.company_id, "day": body.work_date}
            if not item.started:
                conn.execute(
                    text(
                        "INSERT INTO routine_runs(routine_id,company_id,work_date,definition_version,assigned_to,snapshot) VALUES(:id,:company,:day,:version,:user,CAST(:snapshot AS jsonb))"
                    ),
                    p
                    | {
                        "version": item.version,
                        "user": actor.id,
                        "snapshot": item.definition.model_dump_json(by_alias=True),
                    },
                )
            conn.execute(
                text(
                    "INSERT INTO routine_step_events(routine_id,company_id,work_date,version,step,done,note,recorded_by) VALUES(:id,:company,:day,:version,:step,:done,:note,:actor)"
                ),
                p
                | {
                    "version": item.run_version + 1,
                    "step": body.step,
                    "done": body.action == "done",
                    "note": body.note.strip(),
                    "actor": actor.id,
                },
            )
            self.workflows.ops.audit(
                conn,
                actor,
                id,
                "routine." + body.action,
                {"workDate": str(body.work_date), "step": body.step, "note": body.note},
            )
            return self.board(actor, conn=conn)

        return self.commands.run(
            actor, body.command_id, f"routine:{id}:step", body, RoutineBoard, execute, authorize
        )
