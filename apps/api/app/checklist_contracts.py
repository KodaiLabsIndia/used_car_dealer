from datetime import datetime
from uuid import UUID

from pydantic import Field

from app.contracts import ChecklistItem, Contract
from app.workflow_contracts import ChecklistTemplate, InspectionKind


class ChecklistItemInput(ChecklistItem):
    id: str = Field(pattern=r"^[a-zA-Z0-9_-]{1,80}$")
    title: str = Field(min_length=1, max_length=160)
    title_hi: str = Field(min_length=1, max_length=160)
    instruction: str = Field(min_length=1, max_length=1000)
    instruction_hi: str = Field(min_length=1, max_length=1000)
    order: int = Field(ge=1, le=1000)


class CreateChecklistRevision(Contract):
    command_id: UUID
    name: str = Field(min_length=1, max_length=120)
    kind: InspectionKind
    based_on_id: UUID | None
    reason: str = Field(min_length=1, max_length=1000)
    items: list[ChecklistItemInput] = Field(min_length=1, max_length=1000)


class ApproveChecklist(Contract):
    command_id: UUID
    expected_version: int = Field(ge=1)
    reason: str = Field(min_length=1, max_length=1000)
    instructions_reviewed: bool


class ChecklistApproval(Contract):
    approved_by: UUID
    reviewer_name: str
    reason: str
    created_at: datetime


class ManagedChecklist(Contract):
    template: ChecklistTemplate
    based_on_id: UUID | None
    created_by: UUID | None
    creator_name: str | None
    created_at: datetime
    revision_reason: str
    approval: ChecklistApproval | None


class ManagedChecklists(Contract):
    items: list[ManagedChecklist]
