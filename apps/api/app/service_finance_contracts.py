from datetime import datetime
from typing import Annotated, Literal
from uuid import UUID

from pydantic import AwareDatetime, Field, StrictInt

from app.contracts import CommandBase, Contract
from app.purchase_contracts import Money, PositiveMoney
from app.workflow_contracts import RepairJob


class QuoteLine(Contract):
    description: str = Field(min_length=1, max_length=200)
    quantity: Annotated[StrictInt, Field(ge=1, le=10000)]
    unit_paise: PositiveMoney


class RepairQuote(Contract):
    id: UUID
    revision: int
    lines: list[QuoteLine]
    charges_paise: Money
    total_paise: PositiveMoney
    note: str
    decision: Literal["pending", "approved", "rejected"]
    reason: str
    recorded_by_name: str
    approved_by_name: str | None
    created_at: datetime


class ServiceInvoice(Contract):
    id: UUID
    reference: str
    amount_paise: PositiveMoney
    occurred_at: datetime
    recorded_by_name: str
    quote_id: UUID
    reversed: bool


class VendorPayment(Contract):
    reversed: bool
    id: UUID
    reference: str
    amount_paise: PositiveMoney
    note: str
    occurred_at: datetime
    recorded_by_name: str


class ServiceFinance(Contract):
    job: RepairJob
    quotes: list[RepairQuote]
    invoices: list[ServiceInvoice]
    payments: list[VendorPayment]
    invoice_total_paise: Money
    paid_paise: Money
    balance_paise: Money
    advance_paise: Money


class ProposeRepairQuote(CommandBase):
    action: Literal["quote"]
    lines: list[QuoteLine] = Field(min_length=1, max_length=80)
    charges_paise: Money = 0
    note: str = Field(default="", max_length=1000)


class DecideRepairQuote(CommandBase):
    action: Literal["decide_quote"]
    quote_id: UUID
    decision: Literal["approved", "rejected"]
    reason: str = Field(min_length=3, max_length=1000)


class RecordRepairInvoice(CommandBase):
    action: Literal["invoice"]
    quote_id: UUID
    amount_paise: PositiveMoney
    reference: str = Field(min_length=1, max_length=120)
    occurred_at: AwareDatetime


class RecordVendorPayment(CommandBase):
    action: Literal["vendor_payment"]
    quote_id: UUID
    amount_paise: PositiveMoney
    reference: str = Field(min_length=1, max_length=120)
    occurred_at: AwareDatetime
    note: str = Field(default="", max_length=1000)
    advance_acknowledged: bool = False


class CorrectVendorPayment(CommandBase):
    action: Literal["correct_vendor_payment"]
    payment_id: UUID
    reason: str = Field(min_length=3, max_length=1000)


ServiceFinanceCommand = Annotated[
    ProposeRepairQuote | DecideRepairQuote | RecordRepairInvoice | RecordVendorPayment | CorrectVendorPayment,
    Field(discriminator="action"),
]
