from datetime import datetime
from typing import Literal
from uuid import UUID

from app.contracts import Contract


class DecisionItem(Contract):
    id: UUID
    kind: Literal["inspection", "help", "purchase", "quote", "document", "claim", "hold"]
    car_id: UUID
    car_label: str
    title: str
    target_type: Literal["task", "purchase", "service_finance", "documents", "business", "stock"]
    target_id: UUID
    created_at: datetime


class Decisions(Contract):
    items: list[DecisionItem]
    total: int
    limit: int
    offset: int
