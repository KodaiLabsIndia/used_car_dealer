from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import Field

from app.contracts import CommandBase, Contract

DocumentStage = Literal["purchase", "intake", "sale", "delivery"]


class DocumentRule(Contract):
    id: str = Field(pattern=r"^[a-zA-Z0-9_-]{1,80}$")
    stage: DocumentStage
    title: str = Field(min_length=1, max_length=160)
    title_hi: str = Field(min_length=1, max_length=160)
    title_mr: str = Field(min_length=1, max_length=160)
    required: bool = True
    applicability: str = Field(default="", max_length=500)


class DocumentPolicy(Contract):
    version: int
    rules: list[DocumentRule]
    published_by_name: str | None = None
    published_at: datetime | None = None
    reason: str = ""


class PublishDocumentPolicy(CommandBase):
    expected_version: int = Field(ge=0)
    rules: list[DocumentRule] = Field(min_length=1, max_length=100)
    reason: str = Field(min_length=3, max_length=1000)


class Requirement(Contract):
    rule: DocumentRule
    status: Literal["missing", "pending", "rejected", "accepted"]
    document_id: UUID | None = None
    document_title: str | None = None
    reviewed_by_name: str | None = None


class RequirementSet(Contract):
    id: UUID
    stage: DocumentStage
    booking_id: UUID | None
    booking_label: str | None = None
    locked: bool = False
    policy_version: int
    enforced: bool
    items: list[Requirement]
    clear: bool


class CarRequirements(Contract):
    sets: list[RequirementSet]


class AssignRequirements(Contract):
    command_id: UUID
    stage: DocumentStage
    booking_id: UUID | None = None


class LinkRequirement(Contract):
    command_id: UUID
    requirement_id: str
    document_id: UUID
