from datetime import datetime
from typing import Annotated, Literal
from uuid import UUID

from pydantic import AwareDatetime, Field, StrictInt

from app.contracts import Car, CommandBase, Contract
from app.purchase_contracts import Money, PositiveMoney


class ReadinessCheck(Contract):
    id: str
    label: str
    clear: bool


class LedgerEntry(Contract):
    id: UUID
    kind: Literal["cost", "receipt", "refund"]
    category: Literal["repair", "parts", "transport", "documents", "other", "warranty", "customer"]
    amount_paise: PositiveMoney
    reference: str
    note: str
    booking_id: UUID | None
    claim_id: UUID | None
    recorded_by_name: str
    occurred_at: datetime
    reversed_at: datetime | None
    reversal_reason: str | None


class SaleDocuments(Contract):
    buyer_verified: bool = False
    registration_ready: bool = False
    sale_agreement_reference: str = Field(default="", max_length=120)


class WarrantyConfiguration(Contract):
    duration_months: Literal[3, 6, 12]
    covered_components: list[str] = Field(min_length=1, max_length=40)
    exclusions: str = Field(default="", max_length=2000)
    terms: str = Field(min_length=3, max_length=3000)
    provider: str = Field(min_length=1, max_length=120)
    policy_reference: str = Field(min_length=1, max_length=120)
    odometer_limit_km: Annotated[StrictInt, Field(ge=0, le=3000000)] | None = None


class WarrantyTerms(Contract):
    duration_months: Literal[3, 6, 12] | None = None
    covered_components: list[str] = Field(default_factory=list, max_length=40)
    provider: str = Field(default="", max_length=120)
    policy_reference: str = Field(default="", max_length=120)
    exclusions: str = Field(default="", max_length=2000)
    until: AwareDatetime | None = None
    odometer_limit_km: Annotated[StrictInt, Field(ge=0, le=3000000)] | None = None
    terms: str = Field(default="", max_length=3000)
    no_warranty_acknowledged: bool = False


class DeliveryRecord(Contract):
    key_count: int | None
    accessories: str
    customer_promises: str
    customer_acknowledged: bool
    delivered_at: datetime
    odometer_km: int
    receipt_reference: str
    warranty: WarrantyTerms
    recorded_by_name: str


class TransferRecord(Contract):
    status: Literal["pending", "completed"]
    due_at: datetime
    reference: str
    completed_at: datetime | None


class SaleBooking(Contract):
    warranty_configuration: WarrantyConfiguration | None = None
    id: UUID
    customer_name: str
    customer_phone: str
    sale_price_paise: PositiveMoney
    status: Literal["booked", "cancelled", "delivered"]
    expires_at: datetime
    expired: bool
    documents: SaleDocuments
    cancellation_reason: str | None
    collected_paise: Money
    refunded_paise: Money
    balance_paise: Money
    refund_due_paise: Money
    delivery: DeliveryRecord | None
    transfer: TransferRecord | None
    created_at: datetime


class WarrantyClaim(Contract):
    id: UUID
    booking_id: UUID
    description: str
    odometer_km: int | None
    status: Literal["open", "approved", "rejected", "closed"]
    coverage_observation: Literal[
        "within_recorded_limits", "outside_recorded_limits", "no_warranty", "needs_review"
    ]
    approved_limit_paise: Money
    actual_cost_paise: Money
    decision_reason: str
    issue_id: UUID | None
    issue_resolved: bool
    recorded_by_name: str
    reported_at: datetime


class VehicleBusiness(Contract):
    car: Car
    readiness: list[ReadinessCheck]
    draft_checklists: bool
    delivery_pdi_clear: bool
    draft_delivery_pdi: bool
    purchase_price_paise: Money
    seller_balance_paise: Money
    running_cost_paise: Money
    warranty_cost_paise: Money
    invested_paise: Money
    ledger: list[LedgerEntry]
    bookings: list[SaleBooking]
    claims: list[WarrantyClaim]


class BusinessQueueItem(Contract):
    car: Car
    customer_name: str | None
    refund_due_paise: Money
    open_claims: int
    transfer_due_at: datetime | None
    expired_booking: bool


class BusinessQueue(Contract):
    items: list[BusinessQueueItem]
    limit: int
    offset: int


class MarkStockReady(CommandBase):
    action: Literal["mark_ready"]
    acknowledge_draft_checklist: bool = False


class RecordVehicleCost(CommandBase):
    action: Literal["cost"]
    category: Literal["repair", "parts", "transport", "documents", "other", "warranty"]
    amount_paise: PositiveMoney
    reference: str = Field(min_length=1, max_length=120)
    note: str = Field(default="", max_length=1000)
    occurred_at: AwareDatetime
    claim_id: UUID | None = None


class ReverseLedgerEntry(CommandBase):
    action: Literal["reverse_entry"]
    entry_id: UUID
    reason: str = Field(min_length=3, max_length=1000)


class BookVehicle(CommandBase):
    action: Literal["book"]
    customer_name: str = Field(min_length=1, max_length=120)
    customer_phone: str = Field(default="", max_length=30)
    sale_price_paise: PositiveMoney
    expires_at: AwareDatetime
    acknowledge_not_ready: bool = False


class ExtendBooking(CommandBase):
    action: Literal["extend_booking"]
    booking_id: UUID
    expires_at: AwareDatetime
    reason: str = Field(min_length=3, max_length=1000)


class CancelBooking(CommandBase):
    action: Literal["cancel_booking"]
    booking_id: UUID
    reason: str = Field(min_length=3, max_length=1000)


class SaleMoney(CommandBase):
    action: Literal["sale_receipt", "sale_refund"]
    booking_id: UUID
    amount_paise: PositiveMoney
    reference: str = Field(min_length=1, max_length=120)
    note: str = Field(default="", max_length=1000)
    occurred_at: AwareDatetime


class CheckSaleDocuments(CommandBase):
    action: Literal["sale_documents"]
    booking_id: UUID
    documents: SaleDocuments


class ConfigureWarranty(CommandBase):
    action: Literal["configure_warranty"]
    booking_id: UUID
    warranty: WarrantyConfiguration


class DeliverVehicle(CommandBase):
    key_count: Annotated[StrictInt, Field(ge=0, le=10)]
    accessories: str = Field(default="", max_length=1000)
    customer_promises: str = Field(default="", max_length=2000)
    customer_acknowledged: bool
    action: Literal["deliver"]
    booking_id: UUID
    odometer_km: Annotated[StrictInt, Field(ge=0, le=3000000)]
    receipt_reference: str = Field(min_length=1, max_length=120)
    transfer_due_at: AwareDatetime
    warranty: WarrantyTerms
    acknowledge_draft_checklist: bool = False


class CompleteOwnershipTransfer(CommandBase):
    action: Literal["complete_transfer"]
    booking_id: UUID
    reference: str = Field(min_length=1, max_length=120)


class OpenWarrantyClaim(CommandBase):
    action: Literal["open_claim"]
    booking_id: UUID
    description: str = Field(min_length=3, max_length=2000)
    odometer_km: Annotated[StrictInt, Field(ge=0, le=3000000)] | None = None


class ReviewWarrantyClaim(CommandBase):
    action: Literal["review_claim"]
    claim_id: UUID
    decision: Literal["approve", "reject"]
    reason: str = Field(min_length=3, max_length=1000)
    approved_limit_paise: Money = 0
    acknowledge_outside_terms: bool = False
    acknowledge_unknown_mileage: bool = False


class CloseWarrantyClaim(CommandBase):
    action: Literal["close_claim"]
    claim_id: UUID


BusinessCommand = Annotated[
    MarkStockReady
    | RecordVehicleCost
    | ReverseLedgerEntry
    | BookVehicle
    | CancelBooking
    | ExtendBooking
    | SaleMoney
    | CheckSaleDocuments
    | ConfigureWarranty
    | DeliverVehicle
    | CompleteOwnershipTransfer
    | OpenWarrantyClaim
    | ReviewWarrantyClaim
    | CloseWarrantyClaim,
    Field(discriminator="action"),
]
