from datetime import UTC, datetime
from uuid import UUID, uuid4

from sqlalchemy import text

from app.adapters.operations import rows
from app.adapters.workflows import WorkflowStore
from app.contracts import Actor
from app.domain.access import can, require
from app.domain.errors import BusinessError
from app.enquiry_contracts import CreateEnquiry, Enquiries, Enquiry, EnquiryCommand, EnquiryDetail


class EnquiryStore:
    def __init__(self, workflows: WorkflowStore):
        self.workflows = workflows
        self.engine = workflows.engine

    def params(self, actor: Actor):
        require(actor, "leads")
        return {"company": actor.company_id, "actor": actor.id, "all": can(actor, "lead_admin")}

    def list(self, actor: Actor, scope="mine", kind=None, search="", limit=30, offset=0):
        p = self.params(actor) | {
            "scope": scope,
            "kind": kind,
            "query": "%" + search.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%",
            "limit": limit,
            "offset": offset,
        }
        with self.engine.connect() as conn:
            records = rows(
                conn,
                """SELECT e.id FROM enquiries e WHERE e.company_id=:company AND (:all OR e.assigned_to=:actor)
                AND (:scope<>'mine' OR e.assigned_to=:actor) AND (:scope<>'due' OR (e.status NOT IN ('won','lost') AND e.next_follow_up_at<=now()))
                AND (CAST(:kind AS text) IS NULL OR e.kind=:kind) AND (e.name ILIKE :query OR e.phone ILIKE :query OR e.interest ILIKE :query)
                ORDER BY e.next_follow_up_at NULLS LAST,e.updated_at DESC,e.id LIMIT :limit OFFSET :offset""",
                p,
            )
            return Enquiries(
                items=[self.get(actor, x["id"], conn).enquiry for x in records], limit=limit, offset=offset
            )

    def get(self, actor: Actor, enquiry_id: UUID, conn=None):
        if conn is None:
            with self.engine.connect() as connection:
                return self.get(actor, enquiry_id, connection)
        p = self.params(actor) | {"id": enquiry_id}
        items = rows(
            conn,
            """SELECT e.id,e.kind,e.name,e.phone,e.source,e.interest,e.cycle_id AS car_id,e.status,e.assigned_to,u.name AS assignee_name,
            e.next_follow_up_at,e.last_contact_at,e.version,e.created_at,e.updated_at FROM enquiries e
            JOIN users u ON u.id=e.assigned_to AND u.company_id=e.company_id
            WHERE e.company_id=:company AND e.id=:id AND (:all OR e.assigned_to=:actor)""",
            p,
        )
        if not items:
            raise BusinessError("NOT_FOUND", "This enquiry is unavailable.", 404)
        return EnquiryDetail(
            enquiry=Enquiry.model_validate(items[0]),
            events=rows(
                conn,
                """SELECT e.id,e.kind,e.note,u.name AS recorded_by_name,e.created_at
            FROM enquiry_events e JOIN users u ON u.id=e.recorded_by AND u.company_id=e.company_id
            WHERE e.company_id=:company AND e.enquiry_id=:id ORDER BY e.created_at DESC,e.id DESC LIMIT 100""",
                p,
            ),
            appointments=rows(
                conn,
                """SELECT id,kind,scheduled_at,status,driver_name,license_checked,outcome,completed_at
            FROM enquiry_appointments WHERE company_id=:company AND enquiry_id=:id ORDER BY scheduled_at DESC LIMIT 100""",
                p,
            ),
        )

    def event(self, conn, actor, enquiry_id, kind, note):
        conn.execute(
            text(
                "INSERT INTO enquiry_events(id,company_id,enquiry_id,kind,note,recorded_by) VALUES(:id,:company,:enquiry,:kind,:note,:actor)"
            ),
            {
                "id": uuid4(),
                "company": actor.company_id,
                "enquiry": enquiry_id,
                "kind": kind,
                "note": note,
                "actor": actor.id,
            },
        )
        self.workflows.ops.audit(conn, actor, enquiry_id, "enquiry." + kind, {"note": note})
        conn.execute(
            text(
                "INSERT INTO outbox(id,company_id,kind,payload) VALUES(:id,:company,'enquiry.updated',CAST(:payload AS jsonb))"
            ),
            {
                "id": uuid4(),
                "company": actor.company_id,
                "payload": '{"enquiryId":"' + str(enquiry_id) + '"}',
            },
        )

    def assignee(self, conn, actor, person_id):
        self.workflows.active_person(conn, actor, person_id)
        person = rows(
            conn,
            "SELECT id,company_id,name,role,work_roles FROM users WHERE id=:id AND company_id=:company",
            {"id": person_id, "company": actor.company_id},
        )[0]
        if not can(Actor.model_validate(person), "leads"):
            raise BusinessError(
                "RESPONSIBILITY_REQUIRED",
                "Give this person the Sales or Manager responsibility before assigning enquiries.",
                409,
            )

    def future(self, value):
        if value <= datetime.now(UTC):
            raise BusinessError("FUTURE_DATE_REQUIRED", "Choose a future follow-up or appointment.")

    def create(self, actor: Actor, body: CreateEnquiry):
        self.params(actor)

        def execute(conn):
            self.future(body.next_follow_up_at)
            if not body.name.strip() or not body.phone.strip():
                raise BusinessError("CONTACT_REQUIRED", "Enter the contact name and phone.")
            if not can(actor, "lead_admin") and body.assigned_to != actor.id:
                raise BusinessError("FORBIDDEN", "A manager must assign enquiries to other people.", 403)
            self.assignee(conn, actor, body.assigned_to)
            if body.car_id:
                self.workflows.ops.car(actor, body.car_id, conn)
            id = uuid4()
            conn.execute(
                text("""INSERT INTO enquiries(id,company_id,kind,name,phone,source,interest,cycle_id,assigned_to,next_follow_up_at,created_by)
                VALUES(:id,:company,:kind,:name,:phone,:source,:interest,:car,:assigned,:due,:actor)"""),
                {
                    "id": id,
                    "company": actor.company_id,
                    "kind": body.kind,
                    "name": body.name.strip(),
                    "phone": body.phone.strip(),
                    "source": body.source.strip(),
                    "interest": body.interest.strip(),
                    "car": body.car_id,
                    "assigned": body.assigned_to,
                    "due": body.next_follow_up_at,
                    "actor": actor.id,
                },
            )
            self.event(conn, actor, id, "created", "Enquiry recorded")
            return self.get(actor, id, conn)

        return self.workflows.commands.run(
            actor, body.command_id, "enquiry.create", body, EnquiryDetail, execute
        )

    def run(self, actor: Actor, enquiry_id: UUID, command: EnquiryCommand):
        self.params(actor)

        def authorize(conn):
            self.get(actor, enquiry_id, conn)
            conn.execute(
                text("SELECT id FROM enquiries WHERE company_id=:company AND id=:id FOR UPDATE"),
                {"company": actor.company_id, "id": enquiry_id},
            )

        def execute(conn):
            current = self.get(actor, enquiry_id, conn).enquiry
            if current.version != command.expected_version:
                raise BusinessError("VERSION_CONFLICT", "This enquiry changed. Refresh first.", 409)
            p = {"company": actor.company_id, "id": enquiry_id, "actor": actor.id}
            if command.action == "contact":
                self.future(command.next_follow_up_at)
                if not command.note.strip():
                    raise BusinessError("NOTE_REQUIRED", "Record what happened.")
                conn.execute(
                    text(
                        "UPDATE enquiries SET next_follow_up_at=:due,last_contact_at=now() WHERE id=:id AND company_id=:company"
                    ),
                    p | {"due": command.next_follow_up_at},
                )
                note = command.channel + ": " + command.note.strip()
            elif command.action == "status":
                if len(command.reason.strip()) < 3:
                    raise BusinessError("REASON_REQUIRED", "Record a reason.")
                conn.execute(
                    text(
                        "UPDATE enquiries SET status=:status,next_follow_up_at=next_follow_up_at WHERE id=:id AND company_id=:company"
                    ),
                    p | {"status": command.status},
                )
                note = command.status + ": " + command.reason.strip()
            elif command.action == "assign":
                require(actor, "lead_admin")
                self.assignee(conn, actor, command.assigned_to)
                if len(command.reason.strip()) < 3:
                    raise BusinessError("REASON_REQUIRED", "Record why responsibility changed.")
                conn.execute(
                    text("UPDATE enquiries SET assigned_to=:assigned WHERE id=:id AND company_id=:company"),
                    p | {"assigned": command.assigned_to},
                )
                note = (
                    f"Assigned from {current.assigned_to} to {command.assigned_to}: {command.reason.strip()}"
                )
            elif command.action == "link_car":
                self.workflows.ops.car(actor, command.car_id, conn)
                conn.execute(
                    text("UPDATE enquiries SET cycle_id=:car WHERE id=:id AND company_id=:company"),
                    p | {"car": command.car_id},
                )
                note = "Car linked: " + str(command.car_id)
            elif command.action == "appointment":
                self.future(command.scheduled_at)
                if current.status in ("won", "lost"):
                    raise BusinessError(
                        "ENQUIRY_CLOSED", "Reopen the enquiry before scheduling a visit.", 409
                    )
                if command.kind == "test_drive" and (
                    not command.license_checked or not command.driver_name.strip() or current.car_id is None
                ):
                    raise BusinessError(
                        "DRIVER_CHECK_REQUIRED",
                        "Link the car and verify the named driver before scheduling a test drive.",
                    )
                conn.execute(
                    text("""INSERT INTO enquiry_appointments(id,company_id,enquiry_id,kind,scheduled_at,driver_name,license_checked,recorded_by)
                    VALUES(:appointment,:company,:id,:kind,:at,:driver,:license,:actor)"""),
                    p
                    | {
                        "appointment": uuid4(),
                        "kind": command.kind,
                        "at": command.scheduled_at,
                        "driver": command.driver_name.strip(),
                        "license": command.license_checked,
                    },
                )
                conn.execute(
                    text(
                        "UPDATE enquiries SET status='appointment',next_follow_up_at=:at WHERE id=:id AND company_id=:company"
                    ),
                    p | {"at": command.scheduled_at},
                )
                note = command.kind + " scheduled: " + command.scheduled_at.isoformat()
            else:
                appointments = self.get(actor, enquiry_id, conn).appointments
                appointment = next((x for x in appointments if x.id == command.appointment_id), None)
                if not appointment:
                    raise BusinessError("NOT_FOUND", "This appointment is unavailable.", 404)
                if command.status == "completed" and appointment.scheduled_at > datetime.now(UTC):
                    raise BusinessError(
                        "APPOINTMENT_NOT_STARTED", "A future appointment cannot be marked completed.", 409
                    )
                if appointment.status != "scheduled":
                    raise BusinessError("APPOINTMENT_CLOSED", "This appointment was already closed.", 409)
                if len(command.outcome.strip()) < 3:
                    raise BusinessError("OUTCOME_REQUIRED", "Record the visit outcome.")
                conn.execute(
                    text(
                        "UPDATE enquiry_appointments SET status=:status,outcome=:outcome,completed_by=:actor,completed_at=now() WHERE id=:appointment AND company_id=:company AND enquiry_id=:id"
                    ),
                    p
                    | {
                        "appointment": command.appointment_id,
                        "status": command.status,
                        "outcome": command.outcome.strip(),
                    },
                )
                note = appointment.kind + " " + command.status + ": " + command.outcome.strip()
            conn.execute(
                text(
                    "UPDATE enquiries SET version=version+1,updated_at=now() WHERE id=:id AND company_id=:company"
                ),
                p,
            )
            self.event(conn, actor, enquiry_id, command.action, note)
            # Assignment can remove the actor's scope; return the visible saved result using manager capability only when authorised.
            return self.get(actor, enquiry_id, conn)

        return self.workflows.commands.run(
            actor, command.command_id, f"enquiry:{enquiry_id}", command, EnquiryDetail, execute, authorize
        )
