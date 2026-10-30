import json
from collections.abc import Callable
from datetime import UTC, datetime
from uuid import UUID, uuid4

from sqlalchemy import text
from sqlalchemy.engine import Connection
from sqlalchemy.exc import IntegrityError

from app.adapters.car_state import refresh_car_work
from app.adapters.command_transaction import CommandTransaction
from app.adapters.operations import rows
from app.adapters.purchases import PurchaseStore
from app.commercial_contracts import (
    BusinessCommand,
    BusinessQueue,
    BusinessQueueItem,
    DeliveryRecord,
    LedgerEntry,
    ReadinessCheck,
    SaleBooking,
    SaleDocuments,
    TransferRecord,
    VehicleBusiness,
    WarrantyClaim,
    WarrantyTerms,
)
from app.contracts import Actor
from app.domain.access import require
from app.domain.errors import BusinessError
from app.domain.purchase_policy import documents_clear
from app.domain.warranty import issue_warranty


class CommercialStore:
    def __init__(self, purchases: PurchaseStore):
        self.purchases = purchases
        self.workflows = purchases.workflows
        self.ops = purchases.ops
        self.engine = purchases.engine
        self.commands = CommandTransaction(self.engine)

    def queue(self, actor: Actor, search: str, scope: str, limit: int, offset: int) -> BusinessQueue:
        require(actor, "finance")
        pattern = "%" + search.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%"
        with self.engine.connect() as conn:
            records = rows(
                conn,
                """
                WITH net AS (
                    SELECT l.booking_id,sum(CASE WHEN l.kind='receipt' THEN l.amount_paise ELSE -l.amount_paise END) AS held
                    FROM vehicle_ledger l WHERE l.company_id=:company AND l.booking_id IS NOT NULL
                    AND NOT EXISTS(SELECT 1 FROM vehicle_ledger_reversals r WHERE r.entry_id=l.id)
                    GROUP BY l.booking_id
                ), queue AS (
                    SELECT s.id,s.updated_at,
                    (SELECT b.customer_name FROM sale_bookings b WHERE b.cycle_id=s.id AND b.company_id=s.company_id ORDER BY b.created_at DESC,b.id LIMIT 1) AS customer_name,
                    COALESCE((SELECT sum(COALESCE(n.held,0)) FROM sale_bookings b LEFT JOIN net n ON n.booking_id=b.id WHERE b.cycle_id=s.id AND b.company_id=s.company_id AND b.status='cancelled'),0) AS refund_due_paise,
                    (SELECT count(*) FROM warranty_claims c WHERE c.cycle_id=s.id AND c.company_id=s.company_id AND c.status IN ('open','approved')) AS open_claims,
                    (SELECT min(t.due_at) FROM ownership_transfers t JOIN sale_bookings b ON b.id=t.booking_id AND b.company_id=t.company_id WHERE b.cycle_id=s.id AND t.company_id=s.company_id AND t.status='pending') AS transfer_due_at,
                    EXISTS(SELECT 1 FROM sale_bookings b WHERE b.cycle_id=s.id AND b.company_id=s.company_id AND b.status='booked' AND b.expires_at<=now()) AS expired_booking,
                    s.commercial_status,s.stage
                    FROM stock_cycles s JOIN vehicles v ON v.id=s.vehicle_id AND v.company_id=s.company_id
                    WHERE s.company_id=:company AND (:search='' OR v.registration ILIKE :pattern OR v.make||' '||v.model ILIKE :pattern OR s.stock_number ILIKE :pattern)
                ) SELECT * FROM queue WHERE :scope='all' OR (:scope='booked' AND commercial_status='booked')
                    OR (:scope='support' AND (stage='delivered' OR open_claims>0))
                    OR (:scope='attention' AND (refund_due_paise>0 OR open_claims>0 OR expired_booking OR transfer_due_at<=now()))
                    ORDER BY updated_at DESC,id LIMIT :limit OFFSET :offset
            """,
                {
                    "company": actor.company_id,
                    "search": search,
                    "pattern": pattern,
                    "scope": scope,
                    "limit": limit,
                    "offset": offset,
                },
            )
            return BusinessQueue(
                items=[
                    BusinessQueueItem(
                        car=self.ops.car(actor, r["id"], conn),
                        customer_name=r["customer_name"],
                        refund_due_paise=int(r["refund_due_paise"]),
                        open_claims=r["open_claims"],
                        transfer_due_at=r["transfer_due_at"],
                        expired_booking=r["expired_booking"],
                    )
                    for r in records
                ],
                limit=limit,
                offset=offset,
            )

    def get(self, actor: Actor, car_id: UUID, conn: Connection | None = None) -> VehicleBusiness:
        require(actor, "finance")
        if conn is None:
            with self.engine.connect() as connection:
                return self.get(actor, car_id, connection)
        car = self.ops.car(actor, car_id, conn)
        params = {"company": actor.company_id, "car": car_id}
        records = rows(conn, "SELECT id FROM purchases WHERE company_id=:company AND cycle_id=:car", params)
        purchase = self.purchases.get(actor, records[0]["id"], conn) if records else None
        tasks = rows(
            conn,
            "SELECT id,kind,status,template_approved FROM tasks WHERE company_id=:company AND cycle_id=:car",
            params,
        )
        active_issues = conn.execute(
            text(
                "SELECT count(*) FROM issues WHERE company_id=:company AND cycle_id=:car AND status<>'resolved'"
            ),
            params,
        ).scalar_one()
        active_jobs = conn.execute(
            text(
                "SELECT count(*) FROM repair_jobs WHERE company_id=:company AND cycle_id=:car AND status<>'completed'"
            ),
            params,
        ).scalar_one()

        def inspection_clear(kind):
            relevant = [t for t in tasks if t["kind"] == kind]
            return bool(relevant) and all(t["status"] == "completed" for t in relevant)

        active_holds = conn.execute(
            text(
                "SELECT count(*) FROM stock_holds WHERE company_id=:company AND cycle_id=:car AND resolved_at IS NULL"
            ),
            params,
        ).scalar_one()
        custody = conn.execute(
            text("SELECT custody_kind FROM stock_cycles WHERE company_id=:company AND id=:car"), params
        ).scalar_one()
        readiness = [
            ("custody", "Car physically at the dealership", custody == "yard"),
            ("holds", "No active stock holds", active_holds == 0),
            ("purchase", "Purchase agreement recorded", bool(purchase and purchase.acquired_at)),
            ("receipt", "Car physically received", bool(purchase and purchase.received_at)),
            (
                "documents",
                "Seller ownership and loan checks complete",
                bool(purchase and documents_clear(purchase.documents)),
            ),
            ("pre_purchase", "Pre-purchase inspections accepted", inspection_clear("pre_purchase")),
            ("intake", "Intake inspections accepted", inspection_clear("intake")),
            ("issues", "All issues resolved", active_issues == 0),
            ("repairs", "All repair work and QC accepted", active_jobs == 0),
        ]
        ledger = [
            LedgerEntry.model_validate(r)
            for r in rows(
                conn,
                """
            SELECT l.id,l.kind,l.category,l.amount_paise,l.reference,l.note,l.booking_id,l.claim_id,
            u.name AS recorded_by_name,l.occurred_at,r.created_at AS reversed_at,r.reason AS reversal_reason
            FROM vehicle_ledger l JOIN users u ON u.id=l.recorded_by AND u.company_id=l.company_id
            LEFT JOIN vehicle_ledger_reversals r ON r.entry_id=l.id AND r.company_id=l.company_id
            WHERE l.company_id=:company AND l.cycle_id=:car ORDER BY l.created_at DESC,l.id
        """,
                params,
            )
        ]
        active_ledger = [e for e in ledger if e.reversed_at is None]
        bookings = []
        for b in rows(
            conn,
            "SELECT * FROM sale_bookings WHERE company_id=:company AND cycle_id=:car ORDER BY created_at DESC,id",
            params,
        ):
            collected = sum(
                e.amount_paise for e in active_ledger if e.booking_id == b["id"] and e.kind == "receipt"
            )
            refunded = sum(
                e.amount_paise for e in active_ledger if e.booking_id == b["id"] and e.kind == "refund"
            )
            p = params | {"booking": b["id"]}
            delivered = rows(
                conn,
                """SELECT d.delivered_at,d.odometer_km,d.receipt_reference,d.snapshot,u.name AS recorded_by_name
                FROM sale_deliveries d JOIN users u ON u.id=d.recorded_by AND u.company_id=d.company_id
                WHERE d.company_id=:company AND d.booking_id=:booking""",
                p,
            )
            transfer = rows(
                conn,
                "SELECT status,due_at,reference,completed_at FROM ownership_transfers WHERE company_id=:company AND booking_id=:booking",
                p,
            )
            delivery = None
            if delivered:
                d = delivered[0]
                delivery = DeliveryRecord(
                    delivered_at=d["delivered_at"],
                    odometer_km=d["odometer_km"],
                    receipt_reference=d["receipt_reference"],
                    warranty=WarrantyTerms.model_validate(d["snapshot"]["warranty"]),
                    key_count=d["snapshot"].get("handover", {}).get("keyCount"),
                    accessories=d["snapshot"].get("handover", {}).get("accessories", ""),
                    customer_promises=d["snapshot"].get("handover", {}).get("customerPromises", ""),
                    customer_acknowledged=d["snapshot"]
                    .get("handover", {})
                    .get("customerAcknowledged", False),
                    recorded_by_name=d["recorded_by_name"],
                )
            bookings.append(
                SaleBooking(
                    id=b["id"],
                    customer_name=b["customer_name"],
                    customer_phone=b["customer_phone"],
                    sale_price_paise=b["sale_price_paise"],
                    status=b["status"],
                    expires_at=b["expires_at"],
                    expired=b["status"] == "booked" and b["expires_at"] <= datetime.now(UTC),
                    documents=SaleDocuments.model_validate(b["documents"]),
                    warranty_configuration=b["warranty_configuration"],
                    cancellation_reason=b["cancellation_reason"],
                    collected_paise=collected,
                    refunded_paise=refunded,
                    balance_paise=0
                    if b["status"] == "cancelled"
                    else b["sale_price_paise"] - collected + refunded,
                    refund_due_paise=collected - refunded if b["status"] == "cancelled" else 0,
                    delivery=delivery,
                    transfer=TransferRecord.model_validate(transfer[0]) if transfer else None,
                    created_at=b["created_at"],
                )
            )
        claims = []
        for c in rows(
            conn,
            """SELECT c.*,u.name AS recorded_by_name,i.status AS issue_status FROM warranty_claims c
            JOIN users u ON u.id=c.recorded_by AND u.company_id=c.company_id
            LEFT JOIN issues i ON i.id=c.issue_id AND i.company_id=c.company_id
            WHERE c.company_id=:company AND c.cycle_id=:car ORDER BY c.reported_at DESC,c.id""",
            params,
        ):
            booking = next(b for b in bookings if b.id == c["booking_id"])
            w = booking.delivery.warranty
            observation = (
                "no_warranty"
                if not w.until
                else "outside_recorded_limits"
                if c["reported_at"] > w.until
                or (
                    w.odometer_limit_km is not None
                    and c["odometer_km"] is not None
                    and c["odometer_km"] > w.odometer_limit_km
                )
                else "needs_review"
                if w.odometer_limit_km is not None and c["odometer_km"] is None
                else "within_recorded_limits"
            )
            claims.append(
                WarrantyClaim(
                    id=c["id"],
                    booking_id=c["booking_id"],
                    description=c["description"],
                    odometer_km=c["odometer_km"],
                    status=c["status"],
                    coverage_observation=observation,
                    approved_limit_paise=c["approved_limit_paise"],
                    actual_cost_paise=sum(
                        e.amount_paise for e in active_ledger if e.claim_id == c["id"] and e.kind == "cost"
                    ),
                    decision_reason=c["decision_reason"],
                    issue_id=c["issue_id"],
                    issue_resolved=c["issue_status"] == "resolved",
                    recorded_by_name=c["recorded_by_name"],
                    reported_at=c["reported_at"],
                )
            )
        running = sum(e.amount_paise for e in active_ledger if e.kind == "cost" and e.category != "warranty")
        warranty = sum(e.amount_paise for e in active_ledger if e.kind == "cost" and e.category == "warranty")
        price = purchase.terms.purchase_price_paise if purchase and purchase.acquired_at else 0
        from app.adapters.company import CompanyStore

        documents = CompanyStore(self.workflows).requirements(actor, car_id, conn)
        readiness.append(
            (
                "document_requirements",
                "Required document proof accepted",
                all(s.clear for s in documents.sets if s.enforced and s.stage in ("purchase", "intake")),
            )
        )
        return VehicleBusiness(
            car=car,
            readiness=[ReadinessCheck(id=key, label=label, clear=bool(ok)) for key, label, ok in readiness],
            draft_checklists=any(
                not t["template_approved"]
                for t in tasks
                if t["kind"] in ("pre_purchase", "intake", "repair_qc")
            ),
            delivery_pdi_clear=inspection_clear("delivery"),
            draft_delivery_pdi=any(not t["template_approved"] for t in tasks if t["kind"] == "delivery"),
            purchase_price_paise=price,
            seller_balance_paise=purchase.balance_paise if purchase else 0,
            running_cost_paise=running,
            warranty_cost_paise=warranty,
            invested_paise=price + running + warranty,
            ledger=ledger,
            bookings=bookings,
            claims=claims,
        )

    def execute(
        self,
        actor: Actor,
        car_id: UUID,
        command: BusinessCommand,
        validate: Callable[[VehicleBusiness], None],
    ) -> VehicleBusiness:
        require(actor, "finance")

        def execute(conn):
            current = self.get(actor, car_id, conn)
            if command.action == "deliver":
                booking = next((b for b in current.bookings if b.id == command.booking_id), None)
                if booking and booking.warranty_configuration:
                    delivered_at = conn.execute(text("SELECT now()")).scalar_one()
                    issued = issue_warranty(booking.warranty_configuration, delivered_at)
                    # A changed configuration invalidates the form's car version before this point.
                    command.warranty = issued
            validate(current)
            from app.adapters.company import CompanyStore

            policies = CompanyStore(self.workflows)
            if command.action == "deliver":
                policies.require_clear(conn, actor, car_id, {"purchase", "intake"})
                policies.require_clear(conn, actor, car_id, {"sale", "delivery"}, command.booking_id)
            params = {"company": actor.company_id, "car": car_id, "actor": actor.id}
            action = command.action
            details = command.model_dump(mode="json", by_alias=True, exclude={"command_id", "action"})
            if action in ("cost", "sale_receipt", "sale_refund"):
                kind = "cost" if action == "cost" else "receipt" if action == "sale_receipt" else "refund"
                conn.execute(
                    text("""INSERT INTO vehicle_ledger(id,company_id,cycle_id,kind,category,amount_paise,reference,reference_key,note,booking_id,claim_id,recorded_by,occurred_at)
                    VALUES(:id,:company,:car,:kind,:category,:amount,:reference,:key,:note,:booking,:claim,:actor,:occurred)"""),
                    params
                    | {
                        "id": uuid4(),
                        "kind": kind,
                        "category": command.category if action == "cost" else "customer",
                        "amount": command.amount_paise,
                        "reference": command.reference.strip(),
                        "key": command.reference.strip().casefold(),
                        "note": command.note.strip(),
                        "booking": None if action == "cost" else command.booking_id,
                        "claim": command.claim_id if action == "cost" else None,
                        "occurred": command.occurred_at,
                    },
                )
            elif action == "reverse_entry":
                conn.execute(
                    text("""UPDATE repair_jobs SET version=version+1,updated_at=now() WHERE company_id=:company
                    AND id IN (SELECT job_id FROM repair_invoices WHERE company_id=:company AND ledger_id=:entry)"""),
                    params | {"entry": command.entry_id},
                )
                conn.execute(
                    text(
                        "INSERT INTO vehicle_ledger_reversals(id,company_id,entry_id,reason,recorded_by) VALUES(:id,:company,:entry,:reason,:actor)"
                    ),
                    params | {"id": uuid4(), "entry": command.entry_id, "reason": command.reason.strip()},
                )
            elif action == "mark_ready":
                conn.execute(
                    text(
                        "UPDATE stock_cycles SET stage='ready',next_action='Ready for booking and delivery checks' WHERE company_id=:company AND id=:car"
                    ),
                    params,
                )
                details["requirements"] = [c.model_dump(mode="json") for c in current.readiness]
            elif action == "book":
                booking_id = uuid4()
                conn.execute(
                    text("""INSERT INTO sale_bookings(id,company_id,cycle_id,customer_name,customer_phone,sale_price_paise,status,expires_at,created_by)
                    VALUES(:id,:company,:car,:name,:phone,:price,'booked',:expires,:actor)"""),
                    params
                    | {
                        "id": booking_id,
                        "name": command.customer_name.strip(),
                        "phone": command.customer_phone.strip(),
                        "price": command.sale_price_paise,
                        "expires": command.expires_at,
                    },
                )
                conn.execute(
                    text(
                        "UPDATE stock_cycles SET commercial_status='booked',next_action='Complete booking payments and delivery preparation' WHERE id=:car AND company_id=:company"
                    ),
                    params,
                )
                from app.adapters.company import CompanyStore

                for stage in ("sale", "delivery"):
                    CompanyStore(self.workflows).assign_in_transaction(conn, actor, car_id, stage, booking_id)
                details["bookingId"] = str(booking_id)
            elif action == "extend_booking":
                conn.execute(
                    text(
                        "UPDATE sale_bookings SET expires_at=:expires,updated_at=now() WHERE id=:booking AND company_id=:company AND cycle_id=:car"
                    ),
                    params | {"expires": command.expires_at, "booking": command.booking_id},
                )
            elif action == "cancel_booking":
                conn.execute(
                    text(
                        "UPDATE sale_bookings SET status='cancelled',cancellation_reason=:reason,updated_at=now() WHERE id=:booking AND company_id=:company"
                    ),
                    params | {"booking": command.booking_id, "reason": command.reason.strip()},
                )
                conn.execute(
                    text(
                        "UPDATE stock_cycles SET commercial_status='available',next_action='Review cancelled booking and any refund due' WHERE id=:car AND company_id=:company"
                    ),
                    params,
                )
            elif action == "sale_documents":
                conn.execute(
                    text(
                        "UPDATE sale_bookings SET documents=CAST(:documents AS jsonb),updated_at=now() WHERE id=:booking AND company_id=:company"
                    ),
                    params
                    | {
                        "booking": command.booking_id,
                        "documents": command.documents.model_dump_json(by_alias=True),
                    },
                )
            elif action == "configure_warranty":
                conn.execute(
                    text(
                        "UPDATE sale_bookings SET warranty_configuration=CAST(:warranty AS jsonb) WHERE id=:booking AND company_id=:company"
                    ),
                    params
                    | {
                        "booking": command.booking_id,
                        "warranty": command.warranty.model_dump_json(by_alias=True),
                    },
                )
            elif action == "deliver":
                booking = next(b for b in current.bookings if b.id == command.booking_id)
                snapshot = {
                    "handover": {
                        "keyCount": command.key_count,
                        "accessories": command.accessories,
                        "customerPromises": command.customer_promises,
                        "customerAcknowledged": command.customer_acknowledged,
                    },
                    "warranty": command.warranty.model_dump(mode="json", by_alias=True),
                    "documentRequirements": policies.requirements(actor, car_id, conn).model_dump(
                        mode="json", by_alias=True
                    ),
                    "booking": booking.model_dump(mode="json", by_alias=True),
                    "readiness": [r.model_dump(mode="json") for r in current.readiness],
                    "ledger": [
                        e.model_dump(mode="json", by_alias=True)
                        for e in current.ledger
                        if e.booking_id == booking.id
                    ],
                    "inspectionStamps": [
                        dict(r)
                        for r in rows(
                            conn,
                            "SELECT id,version,kind,status,template_approved FROM tasks WHERE company_id=:company AND cycle_id=:car",
                            params,
                        )
                    ],
                }
                conn.execute(
                    text("""INSERT INTO sale_deliveries(booking_id,company_id,cycle_id,delivered_at,odometer_km,receipt_reference,snapshot,recorded_by)
                    VALUES(:booking,:company,:car,now(),:odo,:reference,CAST(:snapshot AS jsonb),:actor)"""),
                    params
                    | {
                        "booking": booking.id,
                        "odo": command.odometer_km,
                        "reference": command.receipt_reference.strip(),
                        "snapshot": json.dumps(snapshot, default=str),
                    },
                )
                conn.execute(
                    text(
                        "INSERT INTO ownership_transfers(booking_id,company_id,due_at) VALUES(:booking,:company,:due)"
                    ),
                    params | {"booking": booking.id, "due": command.transfer_due_at},
                )
                conn.execute(
                    text(
                        "UPDATE sale_bookings SET status='delivered',updated_at=now() WHERE id=:booking AND company_id=:company"
                    ),
                    params | {"booking": booking.id},
                )
                conn.execute(
                    text(
                        "UPDATE stock_cycles SET stage='delivered',commercial_status='sold',custody_kind='customer',custodian_id=:actor,location='Delivered to customer',next_action='Follow up ownership transfer and issued warranty' WHERE id=:car AND company_id=:company"
                    ),
                    params,
                )
                conn.execute(
                    text("UPDATE vehicles SET odometer_km=:odo WHERE id=:vehicle AND company_id=:company"),
                    params | {"odo": command.odometer_km, "vehicle": current.car.vehicle_id},
                )
            elif action == "complete_transfer":
                conn.execute(
                    text(
                        "UPDATE ownership_transfers SET status='completed',reference=:reference,completed_by=:actor,completed_at=now() WHERE booking_id=:booking AND company_id=:company"
                    ),
                    params | {"booking": command.booking_id, "reference": command.reference.strip()},
                )
            elif action == "open_claim":
                claim_id = uuid4()
                conn.execute(
                    text(
                        "INSERT INTO warranty_claims(id,company_id,cycle_id,booking_id,description,odometer_km,recorded_by) VALUES(:id,:company,:car,:booking,:description,:odo,:actor)"
                    ),
                    params
                    | {
                        "id": claim_id,
                        "booking": command.booking_id,
                        "description": command.description.strip(),
                        "odo": command.odometer_km,
                    },
                )
                details["claimId"] = str(claim_id)
            elif action == "review_claim":
                claim = next(c for c in current.claims if c.id == command.claim_id)
                issue_id = claim.issue_id
                if command.decision == "approve" and issue_id is None:
                    issue_id = uuid4()
                    conn.execute(
                        text(
                            "INSERT INTO issues(id,company_id,cycle_id,description,status,created_by,severity) VALUES(:id,:company,:car,:description,'open',:actor,'normal')"
                        ),
                        params | {"id": issue_id, "description": "Warranty: " + claim.description},
                    )
                    refresh_car_work(conn, actor.company_id, car_id)
                conn.execute(
                    text(
                        "UPDATE warranty_claims SET status=:status,approved_limit_paise=:amount,decision_reason=:reason,issue_id=:issue,reviewed_by=:actor,updated_at=now() WHERE id=:claim AND company_id=:company"
                    ),
                    params
                    | {
                        "status": "approved" if command.decision == "approve" else "rejected",
                        "amount": command.approved_limit_paise if command.decision == "approve" else 0,
                        "reason": command.reason.strip(),
                        "issue": issue_id,
                        "claim": claim.id,
                    },
                )
            elif action == "close_claim":
                conn.execute(
                    text(
                        "UPDATE warranty_claims SET status='closed',updated_at=now() WHERE id=:claim AND company_id=:company"
                    ),
                    params | {"claim": command.claim_id},
                )
            conn.execute(
                text(
                    "UPDATE stock_cycles SET version=version+1,updated_at=now() WHERE id=:car AND company_id=:company"
                ),
                params,
            )
            summaries = {
                "cost": "Vehicle cost recorded",
                "reverse_entry": "Financial entry corrected with original retained",
                "mark_ready": "Stock readiness reviewed",
                "book": "Customer booking recorded",
                "cancel_booking": "Booking cancelled; refund balance retained",
                "extend_booking": "Booking hold extended",
                "sale_receipt": "Customer receipt recorded",
                "sale_refund": "Customer refund recorded",
                "sale_documents": "Delivery documents checked",
                "configure_warranty": "Per-car warranty duration and coverage configured",
                "deliver": "Vehicle delivery and warranty terms recorded",
                "complete_transfer": "Ownership transfer acknowledged",
                "open_claim": "Warranty concern logged",
                "review_claim": "Warranty or goodwill decision recorded",
                "close_claim": "Warranty claim closed after repair QC",
            }
            self.workflows.event(conn, actor, car_id, "business." + action, summaries[action], **details)
            return self.get(actor, car_id, conn)

        try:
            return self.commands.run(
                actor,
                command.command_id,
                f"car:{car_id}:business",
                command,
                VehicleBusiness,
                execute,
                lambda conn: self.workflows.lock_car(conn, actor, car_id),
            )
        except IntegrityError as error:
            constraint = getattr(getattr(error.orig, "diag", None), "constraint_name", "") or ""
            if "reference" in constraint:
                raise BusinessError(
                    "DUPLICATE_REFERENCE",
                    "That reference was already recorded for this type of entry. Use its original record or a new reference.",
                    409,
                ) from error
            raise
