from datetime import datetime, timedelta

from app.commercial_contracts import BusinessCommand, VehicleBusiness
from app.contracts import Actor
from app.domain.access import require as require_access
from app.domain.errors import BusinessError
from app.domain.warranty import validate_configuration


def require(condition: bool, code: str, message: str):
    if not condition:
        raise BusinessError(code, message, 409)


def validate_business_command(
    actor: Actor,
    current: VehicleBusiness,
    command: BusinessCommand,
    now: datetime,
    allow_draft_checklists: bool = False,
):
    require_access(actor, "finance")
    require(
        current.car.version == command.expected_version,
        "VERSION_CONFLICT",
        "This car changed. Refresh before continuing.",
    )
    action = command.action
    if action in ("mark_ready", "deliver"):
        require(
            all(c.clear for c in current.readiness),
            "READINESS_BLOCKED",
            "Complete the purchase, intake, documents, repairs and stock hold checks first.",
        )
        if current.draft_checklists or (action == "deliver" and current.draft_delivery_pdi):
            require(
                allow_draft_checklists and command.acknowledge_draft_checklist,
                "CHECKLIST_NOT_APPROVED",
                "Approved checklists are required. A training acknowledgement is available only in development.",
            )
    if action == "mark_ready":
        require(
            current.car.stage != "delivered",
            "ALREADY_DELIVERED",
            "This stock cycle has already been delivered.",
        )
    if action == "book":
        require(
            all(check.clear for check in current.readiness if check.id in ("purchase", "receipt")),
            "PURCHASE_REQUIRED",
            "Record the acquisition and physical receipt before booking this car.",
        )
        require(bool(command.customer_name.strip()), "CUSTOMER_REQUIRED", "Enter the buyer's name.")
        require(
            current.car.stage in ("refurbishment", "ready"),
            "PURCHASE_REQUIRED",
            "Complete acquisition before booking this car.",
        )
        require(
            not any(b.status == "booked" for b in current.bookings),
            "ALREADY_BOOKED",
            "Cancel or expire the current booking before taking another.",
        )
        require(command.expires_at > now, "INVALID_EXPIRY", "Choose a future booking expiry.")
        require(
            (current.car.stage == "ready" and all(c.clear for c in current.readiness))
            or command.acknowledge_not_ready,
            "NOT_READY_ACK_REQUIRED",
            "Acknowledge that preparation is pending before booking this car.",
        )
    if action in ("cost", "sale_receipt", "sale_refund"):
        require(
            bool(command.reference.strip()), "REFERENCE_REQUIRED", "Enter a unique payment or bill reference."
        )
        require(
            command.occurred_at <= now + timedelta(minutes=5),
            "INVALID_DATE",
            "Do not record a future payment or cost.",
        )
    if action in (
        "configure_warranty",
        "cancel_booking",
        "sale_receipt",
        "sale_refund",
        "sale_documents",
        "deliver",
        "complete_transfer",
        "open_claim",
    ):
        booking = next((b for b in current.bookings if b.id == command.booking_id), None)
        if not booking:
            raise BusinessError("NOT_FOUND", "This booking is unavailable.", 404)
        if action in ("configure_warranty", "cancel_booking", "sale_receipt", "sale_documents", "deliver"):
            require(booking.status == "booked", "BOOKING_CLOSED", "This booking is no longer open.")
        if action == "configure_warranty":
            validate_configuration(command.warranty)
        if action in ("sale_receipt", "deliver"):
            require(
                not booking.expired,
                "BOOKING_EXPIRED",
                "Cancel the expired booking and reconcile its deposit before proceeding.",
            )
        if action == "sale_receipt":
            require(
                command.amount_paise <= booking.balance_paise,
                "OVERPAYMENT",
                "The receipt exceeds this booking's remaining balance.",
            )
        if action == "sale_refund":
            require(
                booking.status == "cancelled",
                "CANCEL_FIRST",
                "Cancel the booking before recording its refund.",
            )
            require(
                command.amount_paise <= booking.refund_due_paise,
                "OVER_REFUND",
                "The refund exceeds the amount held for this booking.",
            )
        if action == "deliver":
            require(
                current.car.stage == "ready",
                "MARK_READY_FIRST",
                "Review and mark the car ready before delivery.",
            )
            require(
                current.delivery_pdi_clear,
                "DELIVERY_PDI_REQUIRED",
                "Complete and accept every delivery-PDI check first.",
            )
            require(
                booking.balance_paise == 0 and current.seller_balance_paise == 0,
                "PAYMENT_PENDING",
                "Clear buyer and seller balances before delivery.",
            )
            require(
                booking.documents.buyer_verified
                and booking.documents.registration_ready
                and bool(booking.documents.sale_agreement_reference.strip()),
                "SALE_DOCUMENTS_REQUIRED",
                "Check buyer identity, registration documents and the signed sale agreement.",
            )
            require(
                bool(command.receipt_reference.strip()),
                "RECEIPT_REQUIRED",
                "Record the customer's signed handover reference.",
            )
            require(
                command.odometer_km >= (current.car.odometer_km or 0),
                "ODOMETER_DECREASE",
                "Delivery odometer cannot be below the last recorded reading.",
            )
            require(
                command.transfer_due_at > now,
                "TRANSFER_DATE_REQUIRED",
                "Choose a future ownership-transfer follow-up date.",
            )
            require(
                command.customer_acknowledged,
                "CUSTOMER_ACK_REQUIRED",
                "Confirm the customer received the car, disclosures, promises and issued warranty information.",
            )
            w = command.warranty
            if w.until is None:
                require(
                    w.no_warranty_acknowledged and w.odometer_limit_km is None,
                    "WARRANTY_TERMS_REQUIRED",
                    "Record the issued warranty, or explicitly confirm that no warranty is issued.",
                )
            else:
                require(
                    w.until > now
                    and not w.no_warranty_acknowledged
                    and bool(w.terms.strip())
                    and bool(w.provider.strip())
                    and bool(w.policy_reference.strip()),
                    "WARRANTY_TERMS_REQUIRED",
                    "Enter the actual warranty provider, policy reference, written terms and future end date.",
                )
                require(
                    w.odometer_limit_km is None or w.odometer_limit_km >= command.odometer_km,
                    "INVALID_WARRANTY_DISTANCE",
                    "The warranty odometer limit cannot precede delivery.",
                )
        if action in ("complete_transfer", "open_claim"):
            require(
                booking.status == "delivered" and booking.delivery is not None,
                "DELIVERY_REQUIRED",
                "This action requires a recorded vehicle delivery.",
            )
        if action == "complete_transfer":
            require(
                booking.transfer is not None and booking.transfer.status == "pending",
                "TRANSFER_COMPLETE",
                "Ownership transfer is already recorded.",
            )
            require(
                bool(command.reference.strip()),
                "REFERENCE_REQUIRED",
                "Enter the ownership-transfer acknowledgement reference.",
            )
        if action == "open_claim":
            require(
                bool(command.description.strip()), "DESCRIPTION_REQUIRED", "Describe the customer's concern."
            )
            require(
                command.odometer_km is None or command.odometer_km >= booking.delivery.odometer_km,
                "ODOMETER_DECREASE",
                "Claim odometer cannot precede the delivery reading.",
            )
    if action == "extend_booking":
        booking = next((b for b in current.bookings if b.id == command.booking_id), None)
        require(
            booking is not None and booking.status == "booked",
            "BOOKING_CLOSED",
            "This booking is no longer active.",
        )
        require(
            command.expires_at > now and command.expires_at > booking.expires_at,
            "INVALID_EXPIRY",
            "The extension must be later than the current hold and now.",
        )
        require(len(command.reason.strip()) >= 3, "REASON_REQUIRED", "Record why the hold is being extended.")
    if action == "reverse_entry":
        entry = next((e for e in current.ledger if e.id == command.entry_id), None)
        if not entry:
            raise BusinessError("NOT_FOUND", "This entry is unavailable.", 404)
        require(entry.reversed_at is None, "ALREADY_REVERSED", "This entry is already corrected.")
        if entry.booking_id:
            booking = next(b for b in current.bookings if b.id == entry.booking_id)
            require(
                booking.status != "delivered",
                "DELIVERY_LOCKED",
                "Delivered-sale payments require a separate return or settlement review.",
            )
            if entry.kind == "receipt":
                require(
                    booking.collected_paise - entry.amount_paise >= booking.refunded_paise,
                    "REFUND_RECONCILIATION",
                    "Correct the related refund first so the booking cannot have negative funds held.",
                )
        require(
            len(command.reason.strip()) >= 3, "REASON_REQUIRED", "Record why this entry is being corrected."
        )
    if action in ("review_claim", "close_claim") or (action == "cost" and command.claim_id):
        claim = next((c for c in current.claims if c.id == command.claim_id), None)
        if not claim:
            raise BusinessError("NOT_FOUND", "This warranty claim is unavailable.", 404)
        if action == "review_claim":
            require(
                claim.status in ("open", "approved", "rejected"),
                "CLAIM_CLOSED",
                "A closed claim cannot be reviewed again.",
            )
            require(
                len(command.reason.strip()) >= 3,
                "REASON_REQUIRED",
                "Record the actual warranty or goodwill decision.",
            )
            if command.decision == "approve":
                require(
                    command.approved_limit_paise > 0
                    and command.approved_limit_paise >= claim.actual_cost_paise,
                    "CLAIM_LIMIT_REQUIRED",
                    "Approve a positive amount covering any costs already recorded.",
                )
                require(
                    claim.coverage_observation == "within_recorded_limits"
                    or (claim.coverage_observation == "needs_review" and command.acknowledge_unknown_mileage)
                    or (
                        claim.coverage_observation in ("outside_recorded_limits", "no_warranty")
                        and command.acknowledge_outside_terms
                    ),
                    "GOODWILL_ACK_REQUIRED",
                    "Explicitly acknowledge unknown mileage for provisional review, or goodwill outside the recorded warranty limits.",
                )
            else:
                require(
                    claim.status != "approved",
                    "CLAIM_ALREADY_APPROVED",
                    "An approved claim with linked repair work cannot be silently rejected.",
                )
        elif action == "close_claim":
            require(
                claim.status == "approved" and claim.issue_resolved,
                "CLAIM_WORK_PENDING",
                "Complete the linked repair and accept its QC before closing the claim.",
            )
        else:
            require(
                command.category == "warranty" and claim.status == "approved",
                "CLAIM_APPROVAL_REQUIRED",
                "Record claim costs only against an approved warranty claim.",
            )
            require(
                claim.actual_cost_paise + command.amount_paise <= claim.approved_limit_paise,
                "CLAIM_BUDGET_EXCEEDED",
                "Review the claim's approved amount before adding this cost.",
            )
