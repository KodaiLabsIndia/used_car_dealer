from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import AwareDatetime

from app.contracts import Contract


class Notification(Contract):
    id: UUID
    kind: str
    target_type: Literal["task", "job", "car", "enquiry", "purchase", "business"]
    target_id: UUID
    created_at: datetime
    read_at: datetime | None


class Inbox(Contract):
    items: list[Notification]
    unread: int
    cutoff: datetime
    limit: int
    offset: int


class ReadNotifications(Contract):
    through: AwareDatetime
    notification_id: UUID | None = None
