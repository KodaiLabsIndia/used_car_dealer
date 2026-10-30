from dataclasses import dataclass
from datetime import datetime, timedelta

from app.contracts import Actor
from app.domain.access import require
from app.domain.errors import BusinessError
from app.purchase_contracts import Purchase, PurchaseCommand, PurchaseDocuments, PurchaseTerms


def contribution(terms: PurchaseTerms) -> int:
    return (
        terms.expected_resale_paise
        - terms.purchase_price_paise
        - terms.repair_budget_paise
        - terms.direct_expenses_paise
    )


def documents_clear(documents: PurchaseDocuments) -> bool:
    return (
        documents.seller_verified
        and documents.registration_verified
        and documents.ownership_verified
        and documents.loan_status in ("no_loan", "cleared")
    )


def validate_terms(terms: PurchaseTerms):
    if not terms.seller_name.strip():
        raise BusinessError("VALIDATION_ERROR", "Enter the seller's name.")


def require_inspection(purchase: Purchase):
    if not purchase.inspection_ready:
        raise BusinessError(
            "INSPECTION_REQUIRED", "Complete and review every pre-purchase inspection first.", 409
        )


def require_approval(purchase: Purchase):
    if purchase.status not in ("approved", "acquired") or not purchase.approval_valid:
        raise BusinessError("APPROVAL_REQUIRED", "The current terms and inspection need owner approval.", 409)


@dataclass(frozen=True)
class PurchasePlan:
    status: str
    revise: bool = False
    submit: bool = False
    review: bool = False
    documents: bool = False
    payment: bool = False
    reverse_payment: bool = False
    acquire: bool = False
    receive: bool = False


def plan_purchase_command(
    actor: Actor,
    purchase: Purchase,
    command: PurchaseCommand,
    now: datetime,
    allow_draft_inspections: bool = False,
) -> PurchasePlan:
    if command.action in ("review", "payment", "reverse_payment", "acquire"):
        require(actor, "finance")
    if purchase.company_id != actor.company_id:
        raise BusinessError("NOT_FOUND", "This purchase is unavailable.", 404)
    status = purchase.status
    if command.action == "revise":
        if status in ("submitted", "acquired"):
            raise BusinessError(
                "PURCHASE_LOCKED",
                "Return the proposal for changes, or use a purchase correction after acquisition.",
                409,
            )
        validate_terms(command.terms)
        if command.terms.purchase_price_paise < purchase.paid_paise:
            raise BusinessError(
                "PAYMENT_EXCEEDS_PRICE",
                "Correct mistaken payment entries before reducing this price below recorded payments.",
                409,
            )
        return PurchasePlan("draft", revise=True)
    if command.action == "submit":
        if status not in ("draft", "rejected", "approved"):
            raise BusinessError("CONFLICT", "This purchase cannot be submitted in its current state.", 409)
        require_inspection(purchase)
        return PurchasePlan("submitted", submit=True)
    if command.action == "review":
        if status != "submitted":
            raise BusinessError("CONFLICT", "Send the current proposal for review first.", 409)
        if command.decision == "reject":
            if len(command.reason.strip()) < 3:
                raise BusinessError("REASON_REQUIRED", "Add a short reason for returning this purchase.")
            return PurchasePlan("rejected", review=True)
        require_inspection(purchase)
        if purchase.draft_inspection and not (
            allow_draft_inspections and command.acknowledge_draft_checklist
        ):
            raise BusinessError(
                "CHECKLIST_NOT_APPROVED",
                "The inspection uses a draft checklist. Approval is restricted to acknowledged training use.",
                409,
            )
        if purchase.expected_contribution_paise < 0 and not command.acknowledge_loss:
            raise BusinessError(
                "LOSS_ACKNOWLEDGEMENT", "Acknowledge the projected loss before approving.", 409
            )
        return PurchasePlan("approved", review=True)
    if command.action == "documents":
        return PurchasePlan(status, documents=True)
    if command.action == "payment":
        require_approval(purchase)
        if command.amount_paise > purchase.balance_paise:
            raise BusinessError("OVERPAYMENT", "This exceeds the remaining purchase balance.", 409)
        if not command.reference.strip():
            raise BusinessError("REFERENCE_REQUIRED", "Enter the transaction or cash-voucher reference.")
        if command.paid_at > now + timedelta(minutes=5):
            raise BusinessError("PAYMENT_DATE", "Record a completed payment, not a future payment.")
        return PurchasePlan(status, payment=True)
    if command.action == "reverse_payment":
        payment = next((p for p in purchase.payments if p.id == command.payment_id), None)
        if not payment:
            raise BusinessError("NOT_FOUND", "That payment is unavailable.", 404)
        if payment.reversed_at:
            raise BusinessError("CONFLICT", "This entry already has a correction.", 409)
        if len(command.reason.strip()) < 3:
            raise BusinessError("REASON_REQUIRED", "Add the reason for correcting this entry.")
        return PurchasePlan(status, reverse_payment=True)
    if command.action == "acquire":
        if purchase.car.stage == "delivered":
            raise BusinessError("PURCHASE_STAGE", "A delivered stock cycle cannot be acquired again.", 409)
        if status != "approved":
            raise BusinessError("CONFLICT", "This purchase is not awaiting agreement recording.", 409)
        require_approval(purchase)
        if not purchase.documents_clear:
            raise BusinessError(
                "DOCUMENTS_PENDING", "Complete the seller, ownership and loan checks first.", 409
            )
        if not command.agreement_reference.strip():
            raise BusinessError("REFERENCE_REQUIRED", "Enter the signed agreement reference.")
        return PurchasePlan("acquired", acquire=True)
    if status != "acquired" or purchase.received_at or purchase.car.stage == "delivered":
        raise BusinessError(
            "CONFLICT", "Record the purchase agreement first. A handover can only be recorded once.", 409
        )
    if not purchase.documents_clear:
        raise BusinessError(
            "DOCUMENTS_PENDING", "Resolve the outstanding document checks before handover.", 409
        )
    if purchase.car.odometer_km is not None and command.receipt.odometer_km < purchase.car.odometer_km:
        raise BusinessError(
            "ODOMETER_CONFLICT", "The handover reading is below the previous observation.", 409
        )
    if not command.receipt.location.strip() or not command.receipt.handover_reference.strip():
        raise BusinessError("REFERENCE_REQUIRED", "Enter the handover reference and receiving location.")
    if command.receipt.has_new_issue and not command.receipt.condition_note.strip():
        raise BusinessError("ISSUE_NOTE_REQUIRED", "Describe the issue found at handover.")
    return PurchasePlan(status, receive=True)
