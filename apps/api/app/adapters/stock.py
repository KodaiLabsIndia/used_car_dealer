from uuid import UUID, uuid4

from sqlalchemy import text

from app.adapters.operations import rows
from app.adapters.workflows import WorkflowStore
from app.contracts import Actor
from app.domain.access import require
from app.domain.errors import BusinessError
from app.stock_contracts import StockCommand, StockRecord


class StockStore:
    def __init__(self, workflows: WorkflowStore):
        self.workflows = workflows
        self.engine = workflows.engine

    def get(self, actor: Actor, car_id: UUID, conn=None):
        if conn is None:
            with self.engine.connect() as connection:
                return self.get(actor, car_id, connection)
        car = self.workflows.ops.car(actor, car_id, conn)
        p = {"company": actor.company_id, "car": car_id}
        current = rows(
            conn,
            "SELECT s.custody_kind,u.name AS custodian_name FROM stock_cycles s LEFT JOIN users u ON u.id=s.custodian_id AND u.company_id=s.company_id WHERE s.company_id=:company AND s.id=:car",
            p,
        )[0]
        movements = rows(
            conn,
            """SELECT m.id,m.from_kind,m.from_location,m.to_kind,m.to_location,u.name AS custodian_name,m.receiver_name,m.odometer_km,m.keys_count,m.fuel_percent,m.note,r.name AS recorded_by_name,m.created_at
            FROM stock_movements m JOIN users u ON u.id=m.custodian_id AND u.company_id=m.company_id JOIN users r ON r.id=m.recorded_by AND r.company_id=m.company_id
            WHERE m.company_id=:company AND m.cycle_id=:car ORDER BY m.created_at DESC,m.id DESC LIMIT 100""",
            p,
        )
        holds = rows(
            conn,
            """SELECT h.id,h.kind,h.reason,u.name AS recorded_by_name,h.created_at,r.name AS resolved_by_name,h.resolved_at,h.resolution
            FROM stock_holds h JOIN users u ON u.id=h.recorded_by AND u.company_id=h.company_id LEFT JOIN users r ON r.id=h.resolved_by AND r.company_id=h.company_id
            WHERE h.company_id=:company AND h.cycle_id=:car ORDER BY h.resolved_at NULLS FIRST,h.created_at DESC LIMIT 100""",
            p,
        )
        return StockRecord(
            car=car,
            **current,
            movements=movements,
            holds=holds,
            test_drives=rows(
                conn,
                """SELECT a.id,a.driver_name,a.scheduled_at FROM enquiry_appointments a JOIN enquiries e ON e.id=a.enquiry_id AND e.company_id=a.company_id WHERE a.company_id=:company AND e.cycle_id=:car AND a.kind='test_drive' AND a.status='scheduled' AND a.license_checked ORDER BY a.scheduled_at DESC LIMIT 50""",
                p,
            ),
        )

    def run(self, actor: Actor, car_id: UUID, command: StockCommand):
        if command.action == "move":
            require(actor, "service")
        if command.action == "release_hold":
            require(actor, "review_inspection")

        def execute(conn):
            current = self.get(actor, car_id, conn)
            if command.expected_version != current.car.version:
                raise BusinessError(
                    "VERSION_CONFLICT", "This car changed. Refresh and review your draft.", 409
                )
            p = {"company": actor.company_id, "car": car_id, "actor": actor.id, "id": uuid4()}
            if command.action == "hold":
                if len(command.reason.strip()) < 3:
                    raise BusinessError("REASON_REQUIRED", "Record the reason for the hold.")
                conn.execute(
                    text(
                        "INSERT INTO stock_holds(id,company_id,cycle_id,kind,reason,recorded_by) VALUES(:id,:company,:car,:kind,:reason,:actor)"
                    ),
                    p | {"kind": command.kind, "reason": command.reason.strip()},
                )
                conn.execute(
                    text(
                        "UPDATE stock_cycles SET stage=CASE WHEN stage='ready' THEN 'refurbishment' ELSE stage END,next_action='Resolve active stock hold' WHERE id=:car AND company_id=:company"
                    ),
                    p,
                )
                summary = "Stock hold recorded"
            elif command.action == "release_hold":
                hold = next((h for h in current.holds if h.id == command.hold_id), None)
                if not hold:
                    raise BusinessError("NOT_FOUND", "This hold is unavailable.", 404)
                if hold.resolved_at:
                    raise BusinessError("HOLD_RELEASED", "This hold was already resolved.", 409)
                if len(command.resolution.strip()) < 3:
                    raise BusinessError("RESOLUTION_REQUIRED", "Record what cleared the hold.")
                conn.execute(
                    text(
                        "UPDATE stock_holds SET resolved_by=:actor,resolved_at=now(),resolution=:resolution WHERE id=:hold AND company_id=:company AND cycle_id=:car"
                    ),
                    p | {"hold": command.hold_id, "resolution": command.resolution.strip()},
                )
                summary = "Stock hold resolved; readiness must be reviewed again"
            else:
                self.workflows.active_person(conn, actor, command.custodian_id)
                if (
                    not command.receiver_acknowledged
                    or not command.receiver_name.strip()
                    or not command.to_location.strip()
                ):
                    raise BusinessError(
                        "HANDOVER_REQUIRED", "Confirm the location and receiving person acknowledgement."
                    )
                if command.odometer_km < (current.car.odometer_km or 0):
                    raise BusinessError(
                        "ODOMETER_REVERSED", "This reading is below the last saved observation.", 409
                    )
                if command.to_kind == "customer" and current.car.stage != "delivered":
                    raise BusinessError(
                        "DELIVERY_REQUIRED",
                        "Complete delivery clearance before recording customer custody.",
                        409,
                    )
                if command.to_kind == "workshop":
                    if not rows(
                        conn,
                        "SELECT id FROM workshops WHERE id=:workshop AND company_id=:company AND active=true",
                        p | {"workshop": command.workshop_id},
                    ):
                        raise BusinessError("WORKSHOP_REQUIRED", "Choose the receiving workshop.")
                if command.to_kind == "test_drive":
                    if any(h.resolved_at is None for h in current.holds):
                        raise BusinessError("STOCK_ON_HOLD", "Resolve stock holds before a test drive.", 409)
                    if not rows(
                        conn,
                        """SELECT a.id FROM enquiry_appointments a JOIN enquiries e ON e.id=a.enquiry_id AND e.company_id=a.company_id
                        WHERE a.id=:appointment AND a.company_id=:company AND e.cycle_id=:car AND a.kind='test_drive' AND a.status='scheduled' AND a.license_checked""",
                        p | {"appointment": command.appointment_id},
                    ):
                        raise BusinessError(
                            "TEST_DRIVE_REQUIRED", "Choose the checked test-drive appointment for this car."
                        )
                conn.execute(
                    text("""INSERT INTO stock_movements(id,company_id,cycle_id,from_kind,from_location,to_kind,to_location,custodian_id,receiver_name,odometer_km,keys_count,fuel_percent,note,workshop_id,appointment_id,recorded_by)
                    VALUES(:id,:company,:car,:from_kind,:from_location,:to_kind,:to_location,:custodian,:receiver,:odometer,:keys,:fuel,:note,:workshop,:appointment,:actor)"""),
                    p
                    | {
                        "from_kind": current.custody_kind,
                        "from_location": current.car.location,
                        "to_kind": command.to_kind,
                        "to_location": command.to_location.strip(),
                        "custodian": command.custodian_id,
                        "receiver": command.receiver_name.strip(),
                        "odometer": command.odometer_km,
                        "keys": command.keys_count,
                        "fuel": command.fuel_percent,
                        "note": command.note.strip(),
                        "workshop": command.workshop_id if command.to_kind == "workshop" else None,
                        "appointment": command.appointment_id if command.to_kind == "test_drive" else None,
                    },
                )
                conn.execute(
                    text(
                        "UPDATE stock_cycles SET custody_kind=:kind,custodian_id=:custodian,location=:location WHERE id=:car AND company_id=:company"
                    ),
                    p
                    | {
                        "kind": command.to_kind,
                        "custodian": command.custodian_id,
                        "location": command.to_location.strip(),
                    },
                )
                conn.execute(
                    text(
                        "UPDATE vehicles SET odometer_km=:odometer WHERE id=:vehicle AND company_id=:company"
                    ),
                    p | {"odometer": command.odometer_km, "vehicle": current.car.vehicle_id},
                )
                summary = "Car custody changed"
            conn.execute(
                text(
                    "UPDATE stock_cycles SET version=version+1,updated_at=now() WHERE id=:car AND company_id=:company"
                ),
                p,
            )
            self.workflows.event(
                conn,
                actor,
                car_id,
                "stock." + command.action,
                summary,
                **command.model_dump(mode="json", exclude={"action", "command_id", "expected_version"}),
            )
            return self.get(actor, car_id, conn)

        return self.workflows.commands.run(
            actor,
            command.command_id,
            f"car:{car_id}:stock",
            command,
            StockRecord,
            execute,
            lambda conn: self.workflows.lock_car(conn, actor, car_id),
        )
