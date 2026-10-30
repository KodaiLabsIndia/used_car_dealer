from datetime import datetime
from typing import Annotated, Literal
from uuid import UUID

from pydantic import AwareDatetime, Field, StrictInt

from app.contracts import Car, CommandBase, Contract

Money = Annotated[StrictInt, Field(ge=0, le=100000000000)]
PositiveMoney = Annotated[StrictInt, Field(gt=0, le=100000000000)]


class PurchaseTerms(Contract):
    seller_name: str = Field(min_length=1, max_length=120)
    seller_phone: str = Field(default="", max_length=30)
    asking_price_paise: Money | None = None
    purchase_price_paise: PositiveMoney
    expected_resale_paise: PositiveMoney
    repair_budget_paise: Money
    direct_expenses_paise: Money
    notes: str = Field(default="", max_length=2000)


class PurchaseDocuments(Contract):
    seller_verified: bool = False
    registration_verified: bool = False
    ownership_verified: bool = False
    loan_status: Literal["unknown", "no_loan", "pending", "cleared"] = "unknown"


class InspectionStamp(Contract):
    id: UUID
    version: int
    status: str
    template_approved: bool


class PurchaseApproval(Contract):
    id: UUID
    terms_version: int
    decision: Literal["approve", "reject"]
    reason: str
    actor_name: str
    self_review: bool
    terms: PurchaseTerms
    created_at: datetime


class PurchaseRevision(Contract):
    terms_version: int
    terms: PurchaseTerms
    prepared_by_name: str
    created_at: datetime


class PurchasePayment(Contract):
    id: UUID
    amount_paise: PositiveMoney
    method: Literal["bank_transfer", "upi", "cash"]
    reference: str
    paid_at: datetime
    recorded_by_name: str
    reversed_at: datetime | None
    reversal_reason: str | None
    reversed_by_name: str | None


class PurchaseReceipt(Contract):
    location: str = Field(min_length=1, max_length=120)
    odometer_km: int = Field(ge=0, le=3000000)
    fuel: Literal["unknown", "empty", "quarter", "half", "three_quarters", "full"]
    key_count: int = Field(ge=0, le=4)
    accessories: str = Field(default="", max_length=1000)
    condition_note: str = Field(default="", max_length=1000)
    has_new_issue: bool = False
    handover_reference: str = Field(min_length=1, max_length=120)
    template_id: UUID
    assigned_to: UUID


class Purchase(Contract):
    id: UUID
    company_id: UUID
    car_id: UUID
    car: Car
    status: Literal["draft", "submitted", "approved", "rejected", "acquired"]
    version: int
    terms_version: int
    currency: Literal["INR"] = "INR"
    terms: PurchaseTerms
    documents: PurchaseDocuments
    prepared_by: UUID
    prepared_by_name: str
    submitted_by: UUID | None
    approved_by: UUID | None
    approval_valid: bool
    inspection_ready: bool
    draft_inspection: bool
    inspections: list[InspectionStamp]
    documents_clear: bool
    expected_contribution_paise: int
    paid_paise: Money
    balance_paise: Money
    payments: list[PurchasePayment]
    approvals: list[PurchaseApproval]
    revisions: list[PurchaseRevision]
    agreement_reference: str | None
    acquired_at: datetime | None
    receipt: PurchaseReceipt | None
    received_at: datetime | None
    intake_task_id: UUID | None
    updated_at: datetime


class PurchasePage(Contract):
    items: list[Purchase]


class PurchaseLookup(Contract):
    purchase: Purchase | None


class CreatePurchase(CommandBase):
    terms: PurchaseTerms


class RevisePurchase(CommandBase):
    action: Literal["revise"]
    terms: PurchaseTerms


class SubmitPurchase(CommandBase):
    action: Literal["submit"]


class ReviewPurchase(CommandBase):
    action: Literal["review"]
    decision: Literal["approve", "reject"]
    reason: str = Field(default="", max_length=1000)
    acknowledge_loss: bool = False
    acknowledge_draft_checklist: bool = False


class CheckPurchaseDocuments(CommandBase):
    action: Literal["documents"]
    documents: PurchaseDocuments


class RecordPurchasePayment(CommandBase):
    action: Literal["payment"]
    amount_paise: PositiveMoney
    method: Literal["bank_transfer", "upi", "cash"]
    reference: str = Field(min_length=1, max_length=120)
    paid_at: AwareDatetime


class ReversePurchasePayment(CommandBase):
    action: Literal["reverse_payment"]
    payment_id: UUID
    reason: str = Field(min_length=3, max_length=1000)


class AcquirePurchase(CommandBase):
    action: Literal["acquire"]
    agreement_reference: str = Field(min_length=1, max_length=120)


class ReceivePurchase(CommandBase):
    action: Literal["receive"]
    receipt: PurchaseReceipt


PurchaseCommand = Annotated[
    RevisePurchase
    | SubmitPurchase
    | ReviewPurchase
    | CheckPurchaseDocuments
    | RecordPurchasePayment
    | ReversePurchasePayment
    | AcquirePurchase
    | ReceivePurchase,
    Field(discriminator="action"),
]
