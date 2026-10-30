from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import Field

from app.contracts import Car, CommandBase, Contract

Category = Literal["registration", "purchase", "invoice", "payment", "sale", "warranty", "transfer", "other"]


class DocumentUpload(Contract):
    category: Category
    title: str = Field(min_length=1, max_length=160)
    reference: str = Field(default="", max_length=120)
    job_id: UUID | None = None
    booking_id: UUID | None = None
    supersedes_id: UUID | None = None


class Document(Contract):
    recorded_by_id: UUID
    id: UUID
    car_id: UUID
    category: Category
    title: str
    reference: str
    job_id: UUID | None
    booking_id: UUID | None
    supersedes_id: UUID | None
    width: int
    height: int
    bytes: int
    sha256: str
    profile: Literal["photo-fhd-v1"]
    recorded_by_name: str
    created_at: datetime
    status: Literal["uploaded", "accepted", "rejected"]
    version: int
    reviewed_by_name: str | None
    reviewed_at: datetime | None
    review_reason: str
    self_review: bool


class Documents(Contract):
    car: Car
    items: list[Document]
    limit: int
    offset: int


class ReviewDocument(CommandBase):
    decision: Literal["accepted", "rejected"]
    reason: str = Field(min_length=3, max_length=1000)
    original_checked: bool = False
