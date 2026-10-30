from datetime import datetime
from typing import Annotated, Literal
from uuid import UUID

from pydantic import Field

from app.contracts import Car, CommandBase, Contract

CustodyKind = Literal["yard", "workshop", "test_drive", "customer"]


class StockMovement(Contract):
    id: UUID
    from_kind: str
    from_location: str
    to_kind: CustodyKind
    to_location: str
    custodian_name: str
    receiver_name: str
    odometer_km: int
    keys_count: int
    fuel_percent: int
    note: str
    recorded_by_name: str
    created_at: datetime


class StockHold(Contract):
    id: UUID
    kind: Literal["safety", "documents", "other"]
    reason: str
    recorded_by_name: str
    created_at: datetime
    resolved_by_name: str | None
    resolved_at: datetime | None
    resolution: str


class TestDriveOption(Contract):
    id: UUID
    driver_name: str
    scheduled_at: datetime


class StockRecord(Contract):
    car: Car
    custody_kind: CustodyKind
    custodian_name: str | None
    movements: list[StockMovement]
    holds: list[StockHold]
    test_drives: list[TestDriveOption]


class MoveStock(CommandBase):
    action: Literal["move"]
    to_kind: CustodyKind
    to_location: str = Field(min_length=1, max_length=120)
    custodian_id: UUID
    receiver_name: str = Field(min_length=1, max_length=120)
    receiver_acknowledged: bool
    odometer_km: int = Field(ge=0, le=3000000)
    keys_count: int = Field(ge=0, le=10)
    fuel_percent: int = Field(ge=0, le=100)
    note: str = Field(default="", max_length=1000)
    workshop_id: UUID | None = None
    appointment_id: UUID | None = None


class HoldStock(CommandBase):
    action: Literal["hold"]
    kind: Literal["safety", "documents", "other"]
    reason: str = Field(min_length=3, max_length=1000)


class ReleaseStockHold(CommandBase):
    action: Literal["release_hold"]
    hold_id: UUID
    resolution: str = Field(min_length=3, max_length=1000)


StockCommand = Annotated[MoveStock | HoldStock | ReleaseStockHold, Field(discriminator="action")]
