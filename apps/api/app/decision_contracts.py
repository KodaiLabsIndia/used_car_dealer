from datetime import datetime
from typing import Literal
from uuid import UUID

from app.contracts import Contract


class DecisionItem(Contract):
    id: UUID
    kind: Literal[
        "inspection",
        "help",
        "purchase",
        "quote",
        "document",
        "claim",
        "hold",
        "workforce_leave",
        "workforce_advance",
        "attendance",
    ]
    car_id: UUID | None
    car_label: str
    subject_label: str = ""
    title: str
    target_type: Literal["task", "purchase", "service_finance", "documents", "business", "stock", "workforce"]
    target_id: UUID
    created_at: datetime


class Decisions(Contract):
    items: list[DecisionItem]
    total: int
    limit: int
    offset: int
