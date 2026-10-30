from datetime import UTC, datetime

from app.domain.errors import BusinessError
from app.service_finance_contracts import ServiceFinance, ServiceFinanceCommand


def validate_service_finance(current: ServiceFinance, command: ServiceFinanceCommand):
    if current.job.version != command.expected_version:
        raise BusinessError("VERSION_CONFLICT", "This repair changed. Refresh and review your draft.", 409)
    if command.action == "correct_vendor_payment":
        payment = next((p for p in current.payments if p.id == command.payment_id), None)
        if not payment:
            raise BusinessError("NOT_FOUND", "This payment is unavailable.", 404)
        if payment.reversed:
            raise BusinessError("ALREADY_CORRECTED", "This payment was already corrected.", 409)
        if len(command.reason.strip()) < 3:
            raise BusinessError("REASON_REQUIRED", "Record why this entry is incorrect.")
        return
    if command.action == "quote":
        total = sum(line.quantity * line.unit_paise for line in command.lines) + command.charges_paise
        if total > 100000000000 or any(not line.description.strip() for line in command.lines):
            raise BusinessError("INVALID_QUOTE", "Review the quote lines and total.")
        if total < max(current.invoice_total_paise, current.paid_paise):
            raise BusinessError(
                "COMMITTED_COST", "A revised quote cannot be lower than existing invoices or payments.", 409
            )
        return
    quote = next((q for q in current.quotes if q.id == command.quote_id), None)
    if quote is None:
        raise BusinessError("NOT_FOUND", "This quote is unavailable.", 404)
    if quote != current.quotes[0]:
        raise BusinessError("QUOTE_REVISED", "Use the latest quote revision.", 409)
    if command.action == "decide_quote":
        if quote.decision != "pending":
            raise BusinessError(
                "ALREADY_REVIEWED", "This revision was already reviewed. Create a new revision.", 409
            )
        if not command.reason.strip():
            raise BusinessError("REASON_REQUIRED", "Record the approval or rejection reason.")
        return
    if quote.decision != "approved":
        raise BusinessError(
            "QUOTE_APPROVAL_REQUIRED", "Approve the latest quote before recording invoices or payments.", 409
        )
    if command.occurred_at > datetime.now(UTC):
        raise BusinessError("FUTURE_PAYMENT", "Record only invoices or payments already made.")
    if not command.reference.strip():
        raise BusinessError("REFERENCE_REQUIRED", "Enter the invoice or payment reference.")
    if command.action == "invoice" and current.invoice_total_paise + command.amount_paise > quote.total_paise:
        raise BusinessError(
            "QUOTE_LIMIT", "This invoice exceeds the approved quote. Approve a revised quote first.", 409
        )
    if command.action == "vendor_payment":
        if current.paid_paise + command.amount_paise > quote.total_paise:
            raise BusinessError("QUOTE_LIMIT", "This payment exceeds the approved quote.", 409)
        if (
            current.paid_paise + command.amount_paise > current.invoice_total_paise
            and not command.advance_acknowledged
        ):
            raise BusinessError(
                "ADVANCE_ACKNOWLEDGEMENT",
                "Confirm that the amount above recorded invoices is a vendor advance.",
                409,
            )
