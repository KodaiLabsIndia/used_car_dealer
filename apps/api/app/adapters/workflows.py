import json
import re
from collections.abc import Callable
from uuid import UUID, uuid4

from sqlalchemy import text
from sqlalchemy.engine import Connection

from app.adapters.car_state import refresh_car_work
from app.adapters.command_transaction import CommandTransaction
from app.adapters.operations import OperationsStore, actor_params, rows
from app.contracts import Actor, Task, VehicleConfiguration
from app.domain.access import require
from app.domain.errors import BusinessError
from app.domain.inspection import resolve_checks
from app.domain.workshop_policy import JobPlan
from app.workflow_contracts import (
    CarCreated,
    ChecklistTemplate,
    CreateCar,
    CreateInspection,
    CreateIssue,
    CreateJob,
    CreateWorkshop,
    HistoryEntry,
    Issue,
    JobCommand,
    Person,
    RepairJob,
    Workshop,
)


class WorkflowStore:
    def __init__(self, operations: OperationsStore):
        self.ops = operations
        self.engine = operations.engine
        self.commands = CommandTransaction(self.engine)

    def lock_car(self, conn: Connection, actor: Actor, car_id: UUID):
        self.ops.car(actor, car_id, conn)
        conn.execute(
            text("SELECT id FROM stock_cycles WHERE id=:id AND company_id=:company FOR UPDATE"),
            {"id": car_id, "company": actor.company_id},
        )

    def active_person(self, conn: Connection, actor: Actor, person_id: UUID):
        data = rows(
            conn,
            "SELECT id FROM users WHERE id=:id AND company_id=:company AND active=true",
            {"id": person_id, "company": actor.company_id},
        )
        if not data:
            raise BusinessError("NOT_FOUND", "Choose an active person from this business.", 404)

    def event(self, conn: Connection, actor: Actor, car_id: UUID, action: str, summary: str, **details):
        payload = {"summary": summary, **details}
        self.ops.audit(conn, actor, car_id, action, payload)
        conn.execute(
            text(
                "INSERT INTO outbox(id,company_id,kind,payload) VALUES(:id,:company,:kind,CAST(:payload AS jsonb))"
            ),
            {
                "id": uuid4(),
                "company": actor.company_id,
                "kind": action,
                "payload": json.dumps(
                    {"carId": str(car_id), "actorId": str(actor.id), **payload}, default=str
                ),
            },
        )

    def people(self, actor: Actor) -> list[Person]:
        require(actor, "overview")
        with self.engine.connect() as conn:
            return [
                Person.model_validate(r)
                for r in rows(
                    conn,
                    "SELECT id,name,role FROM users WHERE company_id=:company AND active=true ORDER BY role DESC,name",
                    {"company": actor.company_id},
                )
            ]

    def templates(self, actor: Actor) -> list[ChecklistTemplate]:
        require(actor, "overview")
        with self.engine.connect() as conn:
            return [
                ChecklistTemplate.model_validate(r)
                for r in rows(
                    conn,
                    "SELECT id,name,kind,version,approved,items FROM checklist_templates WHERE company_id=:company ORDER BY kind,name,version DESC",
                    {"company": actor.company_id},
                )
            ]

    def template(self, conn: Connection, actor: Actor, template_id: UUID) -> ChecklistTemplate:
        result = rows(
            conn,
            "SELECT id,name,kind,version,approved,items FROM checklist_templates WHERE id=:id AND company_id=:company",
            {"id": template_id, "company": actor.company_id},
        )
        if not result:
            raise BusinessError("NOT_FOUND", "This checklist is unavailable.", 404)
        return ChecklistTemplate.model_validate(result[0])

    def insert_task(
        self,
        conn: Connection,
        actor: Actor,
        car_id: UUID,
        template: ChecklistTemplate,
        assigned_to: UUID,
        due_at=None,
        title: str | None = None,
        configuration: VehicleConfiguration | None = None,
    ) -> UUID:
        self.active_person(conn, actor, assigned_to)
        task_id = uuid4()
        configuration = configuration or VehicleConfiguration()
        resolved = resolve_checks(template.items, configuration)
        if not resolved:
            raise BusinessError("INVALID_CHECKLIST", "No checks apply to this configuration.")
        conn.execute(
            text("""
            INSERT INTO tasks(id,company_id,cycle_id,title,assigned_to,items,due_at,kind,
                template_id,template_name,template_version,template_approved,vehicle_configuration)
            VALUES(:id,:company,:car,:title,:assigned,CAST(:items AS jsonb),:due,:kind,:template,:name,:version,:approved,CAST(:configuration AS jsonb))
        """),
            {
                "id": task_id,
                "company": actor.company_id,
                "car": car_id,
                "title": title or template.name,
                "assigned": assigned_to,
                "items": json.dumps([i.model_dump(mode="json", by_alias=True) for i in resolved]),
                "configuration": configuration.model_dump_json(by_alias=True),
                "due": due_at,
                "kind": template.kind,
                "template": template.id,
                "name": template.name,
                "version": template.version,
                "approved": template.approved,
            },
        )
        return task_id

    def create_car(self, actor: Actor, body: CreateCar) -> CarCreated:
        require(actor, "intake")
        registration = re.sub(r"[^A-Z0-9]", "", body.registration.upper())
        if (
            not 3 <= len(registration) <= 20
            or not body.make.strip()
            or not body.model.strip()
            or not body.location.strip()
        ):
            raise BusinessError("VALIDATION_ERROR", "Enter the car, registration and location.")

        def execute(conn):
            conn.execute(
                text("SELECT pg_advisory_xact_lock(hashtextextended(:key,0))"),
                {"key": f"registration:{actor.company_id}:{registration}"},
            )
            self.active_person(conn, actor, body.assigned_to)
            template = self.template(conn, actor, body.template_id)
            if body.catalogue_model_id:
                matched = rows(
                    conn,
                    """SELECT m.name model,k.name make FROM vehicle_catalogue_models m
                    JOIN vehicle_catalogue_makes k ON k.id=m.make_id WHERE m.id=:id""",
                    {"id": body.catalogue_model_id},
                )
                if not matched or (matched[0]["make"].casefold(), matched[0]["model"].casefold()) != (
                    body.make.strip().casefold(),
                    body.model.strip().casefold(),
                ):
                    raise BusinessError(
                        "IDENTITY_CONFLICT", "The selected catalogue entry differs from the car name."
                    )
            if template.kind not in ("pre_purchase", "intake"):
                raise BusinessError("INVALID_CHECKLIST", "Choose a pre-purchase or intake checklist.")
            previous = rows(
                conn,
                "SELECT id,make,model,year,odometer_km FROM vehicles WHERE company_id=:company AND regexp_replace(upper(registration),'[^A-Z0-9]','','g')=:registration FOR UPDATE",
                {"company": actor.company_id, "registration": registration},
            )
            vehicle_id = previous[0]["id"] if previous else uuid4()
            if previous:
                old = previous[0]
                if rows(
                    conn,
                    "SELECT id FROM stock_cycles WHERE vehicle_id=:vehicle AND company_id=:company AND stage<>'delivered'",
                    {"vehicle": vehicle_id, "company": actor.company_id},
                ):
                    raise BusinessError(
                        "ALREADY_IN_STOCK",
                        "This car already has an active stock record. Open it from Cars.",
                        409,
                    )
                if (old["make"].casefold(), old["model"].casefold(), old["year"]) != (
                    body.make.strip().casefold(),
                    body.model.strip().casefold(),
                    body.year,
                ):
                    raise BusinessError(
                        "IDENTITY_CONFLICT",
                        "This registration has different saved car details. Review its history.",
                        409,
                    )
                if (
                    body.odometer_km is not None
                    and old["odometer_km"] is not None
                    and body.odometer_km < old["odometer_km"]
                ):
                    raise BusinessError(
                        "ODOMETER_CONFLICT",
                        "This reading is below the previous observation. Review the car details.",
                        409,
                    )
                if body.odometer_km is not None:
                    conn.execute(
                        text("UPDATE vehicles SET odometer_km=:reading WHERE id=:id AND company_id=:company"),
                        {"reading": body.odometer_km, "id": vehicle_id, "company": actor.company_id},
                    )
            else:
                conn.execute(
                    text("""
                    INSERT INTO vehicles(id,company_id,make,model,registration,year,image_key,odometer_km,catalogue_model_id)
                    VALUES(:id,:company,:make,:model,:registration,:year,'generic',:odometer,:catalogue)
                """),
                    {
                        "id": vehicle_id,
                        "company": actor.company_id,
                        "make": body.make.strip(),
                        "model": body.model.strip(),
                        "registration": registration,
                        "year": body.year,
                        "odometer": body.odometer_km,
                        "catalogue": body.catalogue_model_id,
                    },
                )
            stock = conn.execute(
                text("""
                INSERT INTO company_counters(company_id,next_stock) VALUES(:company,1001)
                ON CONFLICT(company_id) DO UPDATE SET next_stock=company_counters.next_stock+1 RETURNING next_stock-1
            """),
                {"company": actor.company_id},
            ).scalar_one()
            car_id = uuid4()
            conn.execute(
                text("""
                INSERT INTO stock_cycles(id,company_id,vehicle_id,stock_number,stage,commercial_status,service_status,location,next_action,due_at)
                VALUES(:id,:company,:vehicle,:stock,'inspection','available','none',:location,'Complete assigned inspection',:due)
            """),
                {
                    "id": car_id,
                    "company": actor.company_id,
                    "vehicle": vehicle_id,
                    "stock": f"AC-{stock:05d}",
                    "location": body.location.strip(),
                    "due": body.due_at,
                },
            )
            task_id = self.insert_task(
                conn, actor, car_id, template, body.assigned_to, body.due_at, configuration=body.configuration
            )
            self.event(
                conn,
                actor,
                car_id,
                "car.created",
                "Car added and inspection assigned",
                taskId=str(task_id),
                assignedTo=str(body.assigned_to),
                stockNumber=f"AC-{stock:05d}",
            )
            return CarCreated(car=self.ops.car(actor, car_id, conn), task=self.ops.task(actor, task_id, conn))

        return self.commands.run(actor, body.command_id, "car.create", body, CarCreated, execute)

    def create_inspection(self, actor: Actor, car_id: UUID, body: CreateInspection) -> Task:
        require(actor, "assign_inspection")

        def execute(conn):
            template = self.template(conn, actor, body.template_id)
            if template.kind == "pre_purchase" and rows(
                conn,
                "SELECT id FROM purchases WHERE company_id=:company AND cycle_id=:car AND status='acquired'",
                {"company": actor.company_id, "car": car_id},
            ):
                raise BusinessError(
                    "USE_INTAKE_CHECKLIST",
                    "This purchase is recorded. Use an intake inspection for new findings.",
                    409,
                )
            if template.kind == "repair_qc":
                raise BusinessError("USE_REPAIR_JOB", "Repair QC is created from its repair job.")
            task_id = self.insert_task(
                conn, actor, car_id, template, body.assigned_to, body.due_at, configuration=body.configuration
            )
            self.event(
                conn,
                actor,
                car_id,
                "inspection.assigned",
                "Inspection assigned",
                taskId=str(task_id),
                assignedTo=str(body.assigned_to),
            )
            return self.ops.task(actor, task_id, conn)

        return self.commands.run(
            actor,
            body.command_id,
            f"car:{car_id}:inspection",
            body,
            Task,
            execute,
            lambda conn: self.lock_car(conn, actor, car_id),
        )

    def issues(self, actor: Actor, car_id: UUID, conn=None) -> list[Issue]:
        if conn is None:
            with self.engine.connect() as c:
                return self.issues(actor, car_id, c)
        self.ops.car(actor, car_id, conn)
        return [
            Issue.model_validate(r)
            for r in rows(
                conn,
                """
            SELECT i.id,i.cycle_id AS car_id,i.description,i.severity,i.status,i.version,
                i.task_id AS source_task_id,i.item_id AS source_item_id,i.evidence_id,i.created_at,
                (SELECT j.id FROM repair_jobs j WHERE j.issue_id=i.id AND j.company_id=i.company_id ORDER BY j.created_at DESC LIMIT 1) AS job_id
            FROM issues i WHERE i.company_id=:company AND i.cycle_id=:car ORDER BY i.created_at DESC,i.id
        """,
                {"company": actor.company_id, "car": car_id},
            )
        ]

    def create_issue(self, actor: Actor, car_id: UUID, body: CreateIssue) -> Issue:
        def execute(conn):
            car = self.ops.car(actor, car_id, conn)
            if car.version != body.expected_version:
                raise BusinessError(
                    "VERSION_CONFLICT", "This car changed. Refresh before adding the issue.", 409
                )
            if not body.description.strip():
                raise BusinessError("VALIDATION_ERROR", "Choose or describe the issue.")
            issue_id = uuid4()
            conn.execute(
                text(
                    "INSERT INTO issues(id,company_id,cycle_id,description,severity,created_by) VALUES(:id,:company,:car,:description,:severity,:actor)"
                ),
                actor_params(actor)
                | {
                    "id": issue_id,
                    "car": car_id,
                    "description": body.description.strip(),
                    "severity": body.severity,
                },
            )
            refresh_car_work(conn, actor.company_id, car_id)
            self.event(
                conn,
                actor,
                car_id,
                "issue.created",
                "Issue recorded",
                issueId=str(issue_id),
                description=body.description,
                severity=body.severity,
            )
            return next(i for i in self.issues(actor, car_id, conn) if i.id == issue_id)

        return self.commands.run(
            actor,
            body.command_id,
            f"car:{car_id}:issue",
            body,
            Issue,
            execute,
            lambda conn: self.lock_car(conn, actor, car_id),
        )

    def workshops(self, actor: Actor) -> list[Workshop]:
        require(actor, "service")
        with self.engine.connect() as conn:
            return [
                Workshop.model_validate(r)
                for r in rows(
                    conn,
                    "SELECT id,name,phone FROM workshops WHERE company_id=:company AND active=true ORDER BY name",
                    {"company": actor.company_id},
                )
            ]

    def create_workshop(self, actor: Actor, body: CreateWorkshop) -> Workshop:
        require(actor, "service")

        def execute(conn):
            name = body.name.strip()
            if not name:
                raise BusinessError("VALIDATION_ERROR", "Enter the workshop name.")
            conn.execute(
                text("SELECT pg_advisory_xact_lock(hashtextextended(:key,0))"),
                {"key": f"workshop:{actor.company_id}:{name.casefold()}"},
            )
            if rows(
                conn,
                "SELECT id FROM workshops WHERE company_id=:company AND lower(name)=lower(:name)",
                {"company": actor.company_id, "name": name},
            ):
                raise BusinessError("ALREADY_EXISTS", "This workshop is already listed.", 409)
            workshop = Workshop(id=uuid4(), name=name, phone=body.phone.strip())
            conn.execute(
                text("INSERT INTO workshops(id,company_id,name,phone) VALUES(:id,:company,:name,:phone)"),
                {
                    "id": workshop.id,
                    "company": actor.company_id,
                    "name": workshop.name,
                    "phone": workshop.phone,
                },
            )
            self.ops.audit(
                conn, actor, workshop.id, "workshop.created", {"summary": "Workshop added", "name": name}
            )
            return workshop

        return self.commands.run(actor, body.command_id, "workshop.create", body, Workshop, execute)

    def job(self, actor: Actor, job_id: UUID, conn=None) -> RepairJob:
        if conn is None:
            with self.engine.connect() as c:
                return self.job(actor, job_id, c)
        result = rows(
            conn,
            """
            SELECT j.id,j.company_id,j.cycle_id AS car_id,j.issue_id,j.title,j.assigned_to,u.name AS assignee_name,
                j.workshop_id,w.name AS workshop_name,j.status,j.blocker,j.due_at,j.version,j.qc_task_id,j.updated_at
            FROM repair_jobs j JOIN users u ON u.id=j.assigned_to AND u.company_id=j.company_id
            LEFT JOIN workshops w ON w.id=j.workshop_id AND w.company_id=j.company_id
            WHERE j.id=:id AND j.company_id=:company AND (:owner OR j.assigned_to=:actor)
        """,
            actor_params(actor) | {"id": job_id},
        )
        if not result:
            raise BusinessError("NOT_FOUND", "This repair is unavailable.", 404)
        data = result[0]
        return RepairJob.model_validate(
            data
            | {
                "car": self.ops.car(actor, data["car_id"], conn),
                "parts": rows(
                    conn,
                    "SELECT id,name,status,expected_at FROM part_requests WHERE job_id=:id AND company_id=:company ORDER BY created_at,id",
                    {"id": job_id, "company": actor.company_id},
                ),
            }
        )

    def jobs(self, actor: Actor, car_id: UUID | None = None) -> list[RepairJob]:
        with self.engine.connect() as conn:
            if car_id:
                self.ops.car(actor, car_id, conn)
            result = rows(
                conn,
                """SELECT id FROM repair_jobs WHERE company_id=:company
                AND (:owner OR assigned_to=:actor) AND (CAST(:car AS uuid) IS NULL OR cycle_id=:car)
                ORDER BY CASE WHEN status='completed' THEN 1 ELSE 0 END,updated_at DESC LIMIT 200""",
                actor_params(actor) | {"car": car_id},
            )
            return [self.job(actor, r["id"], conn) for r in result]

    def create_job(self, actor: Actor, issue_id: UUID, body: CreateJob) -> RepairJob:
        require(actor, "service")

        def authorize(conn):
            data = rows(
                conn,
                "SELECT cycle_id FROM issues WHERE id=:id AND company_id=:company",
                {"id": issue_id, "company": actor.company_id},
            )
            if not data:
                raise BusinessError("NOT_FOUND", "This issue is unavailable.", 404)
            self.lock_car(conn, actor, data[0]["cycle_id"])

        def execute(conn):
            issue = rows(
                conn,
                "SELECT * FROM issues WHERE id=:id AND company_id=:company FOR UPDATE",
                {"id": issue_id, "company": actor.company_id},
            )[0]
            if issue["version"] != body.expected_version:
                raise BusinessError(
                    "VERSION_CONFLICT", "This issue changed. Refresh before assigning it.", 409
                )
            if issue["status"] == "resolved" or rows(
                conn,
                "SELECT id FROM repair_jobs WHERE issue_id=:id AND status<>'completed'",
                {"id": issue_id},
            ):
                raise BusinessError("REPAIR_EXISTS", "Open the existing repair for this issue.", 409)
            self.active_person(conn, actor, body.assigned_to)
            if body.workshop_id and not rows(
                conn,
                "SELECT id FROM workshops WHERE id=:id AND company_id=:company AND active=true",
                {"id": body.workshop_id, "company": actor.company_id},
            ):
                raise BusinessError("NOT_FOUND", "This workshop is unavailable.", 404)
            job_id = uuid4()
            conn.execute(
                text("""INSERT INTO repair_jobs(id,company_id,cycle_id,issue_id,title,assigned_to,workshop_id,due_at)
                VALUES(:id,:company,:car,:issue,:title,:assigned,:workshop,:due)"""),
                {
                    "id": job_id,
                    "company": actor.company_id,
                    "car": issue["cycle_id"],
                    "issue": issue_id,
                    "title": issue["description"],
                    "assigned": body.assigned_to,
                    "workshop": body.workshop_id,
                    "due": body.due_at,
                },
            )
            conn.execute(
                text(
                    "UPDATE issues SET status='in_repair',version=version+1 WHERE id=:id AND company_id=:company"
                ),
                {"id": issue_id, "company": actor.company_id},
            )
            refresh_car_work(conn, actor.company_id, issue["cycle_id"])
            self.event(
                conn,
                actor,
                issue["cycle_id"],
                "repair.assigned",
                "Repair assigned",
                jobId=str(job_id),
                issueId=str(issue_id),
                assignedTo=str(body.assigned_to),
            )
            return self.job(actor, job_id, conn)

        return self.commands.run(
            actor, body.command_id, f"issue:{issue_id}:repair", body, RepairJob, execute, authorize
        )

    def execute_job(
        self, actor: Actor, job_id: UUID, command: JobCommand, planner: Callable[[RepairJob], JobPlan]
    ) -> RepairJob:
        def authorize(conn):
            current = self.job(actor, job_id, conn)
            self.lock_car(conn, actor, current.car_id)
            conn.execute(
                text("SELECT id FROM repair_jobs WHERE id=:id AND company_id=:company FOR UPDATE"),
                {"id": job_id, "company": actor.company_id},
            )

        def execute(conn):
            current = self.job(actor, job_id, conn)
            if current.version != command.expected_version:
                raise BusinessError(
                    "VERSION_CONFLICT", "This repair changed. Refresh to see the latest work.", 409
                )
            if command.action == "start":
                quote = rows(
                    conn,
                    """SELECT COALESCE(a.decision,'pending') AS decision FROM repair_quotes q
                    LEFT JOIN repair_quote_approvals a ON a.quote_id=q.id AND a.company_id=q.company_id
                    WHERE q.company_id=:company AND q.job_id=:job ORDER BY revision DESC LIMIT 1""",
                    {"company": actor.company_id, "job": job_id},
                )
                if quote and quote[0]["decision"] != "approved":
                    raise BusinessError(
                        "QUOTE_APPROVAL_REQUIRED",
                        "The latest repair quote needs owner approval before work starts.",
                        409,
                    )
            plan = planner(current)
            qc_task = current.qc_task_id
            params = {"id": job_id, "company": actor.company_id}
            if plan.assigned_to:
                self.active_person(conn, actor, plan.assigned_to)
                if qc_task:
                    task = self.ops.task(actor, qc_task, conn)
                    if task.status == "submitted":
                        raise BusinessError(
                            "CONFLICT", "Review the submitted QC before reassigning this repair.", 409
                        )
                    if task.status != "completed":
                        conn.execute(
                            text(
                                "UPDATE tasks SET assigned_to=:assigned,version=version+1,updated_at=now() WHERE id=:task AND company_id=:company"
                            ),
                            {"assigned": plan.assigned_to, "task": qc_task, "company": actor.company_id},
                        )
            if plan.create_part:
                conn.execute(
                    text(
                        "INSERT INTO part_requests(id,company_id,job_id,name,expected_at) VALUES(:part,:company,:job,:name,:expected)"
                    ),
                    {
                        "part": uuid4(),
                        "company": actor.company_id,
                        "job": job_id,
                        "name": command.part_name.strip(),
                        "expected": command.expected_at,
                    },
                )
            if plan.receive_part:
                conn.execute(
                    text(
                        "UPDATE part_requests SET status='received',received_at=now() WHERE id=:part AND job_id=:job AND company_id=:company"
                    ),
                    {"part": plan.receive_part, "job": job_id, "company": actor.company_id},
                )
            if plan.reopen:
                qc_task = None
                conn.execute(
                    text(
                        "UPDATE issues SET status='in_repair',version=version+1 WHERE id=:issue AND company_id=:company"
                    ),
                    {"issue": current.issue_id, "company": actor.company_id},
                )
            if plan.create_qc and not qc_task:
                templates = rows(
                    conn,
                    "SELECT id FROM checklist_templates WHERE company_id=:company AND kind='repair_qc' ORDER BY approved DESC,version DESC,id LIMIT 1",
                    {"company": actor.company_id},
                )
                if not templates:
                    raise BusinessError("SETUP_REQUIRED", "The repair QC checklist is missing.", 503)
                template = self.template(conn, actor, templates[0]["id"])
                qc_task = self.insert_task(
                    conn,
                    actor,
                    current.car_id,
                    template,
                    current.assigned_to,
                    current.due_at,
                    title=f"Repair QC · {current.title[:80]}",
                )
            blocker = (
                "Waiting for " + command.part_name.strip()
                if command.action == "wait_parts" and command.part_name.strip()
                else "Waiting for part details"
                if command.action == "wait_parts"
                else ""
                if plan.status != "waiting_parts"
                else current.blocker
            )
            conn.execute(
                text("""UPDATE repair_jobs SET status=:status,assigned_to=:assigned,blocker=:blocker,qc_task_id=:qc,
                version=version+1,updated_at=now() WHERE id=:id AND company_id=:company"""),
                params
                | {
                    "status": plan.status,
                    "assigned": plan.assigned_to or current.assigned_to,
                    "blocker": blocker,
                    "qc": qc_task,
                },
            )
            refresh_car_work(conn, actor.company_id, current.car_id)
            self.event(
                conn,
                actor,
                current.car_id,
                f"repair.{command.action}",
                {
                    "start": "Repair started",
                    "wait_parts": "Repair waiting for parts",
                    "receive_part": "Part received",
                    "submit_repair": "Repair sent for evidence and QC",
                    "reopen": "Accepted repair reopened",
                    "assign": "Repair reassigned",
                }[command.action],
                jobId=str(job_id),
                previousAssignee=str(current.assigned_to),
                assignedTo=str(plan.assigned_to or current.assigned_to),
                status=plan.status,
                partName=getattr(command, "part_name", None),
            )
            return self.job(actor, job_id, conn)

        return self.commands.run(
            actor, command.command_id, f"repair:{job_id}:command", command, RepairJob, execute, authorize
        )

    def history(self, actor: Actor, car_id: UUID) -> list[HistoryEntry]:
        with self.engine.connect() as conn:
            self.ops.car(actor, car_id, conn)
            entries = rows(
                conn,
                """SELECT e.id,u.name AS actor_name,e.action,e.created_at,e.details
                FROM audit_events e JOIN users u ON u.id=e.actor_id AND u.company_id=e.company_id
                WHERE e.company_id=:company AND e.aggregate_id=:car
                AND (:finance OR (e.action NOT LIKE 'purchase.%' AND e.action NOT LIKE 'business.%' AND e.action NOT LIKE 'service_finance.%')) ORDER BY e.created_at DESC,e.id DESC LIMIT 100""",
                {"company": actor.company_id, "car": car_id, "finance": actor.role == "owner"},
            )
            if actor.role == "owner":
                system = rows(
                    conn,
                    "SELECT id,'Automation' AS actor_name,action,created_at,jsonb_build_object('summary',summary) AS details FROM system_events WHERE company_id=:company AND aggregate_id=:car ORDER BY created_at DESC,id DESC LIMIT 100",
                    {"company": actor.company_id, "car": car_id},
                )
                entries = sorted(
                    entries + system, key=lambda e: (e["created_at"], str(e["id"])), reverse=True
                )[:100]
            labels = {
                "task.answer": "Inspection check recorded",
                "task.submit": "Inspection submitted",
                "task.review": "Inspection reviewed",
                "task.help": "Help requested",
                "task.takeover": "Task taken over",
                "task.assign": "Task reassigned",
                "evidence.received": "Photo received",
            }
            return [
                HistoryEntry.model_validate(
                    {k: v for k, v in entry.items() if k != "details"}
                    | {
                        "summary": entry["details"].get(
                            "summary", labels.get(entry["action"], "Car record updated")
                        )
                    }
                )
                for entry in entries
            ]
