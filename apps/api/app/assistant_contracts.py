from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import Field

from app.contracts import Contract

AICapability = Literal[
    "voice_log",
    "scan_fields",
    "evidence_guide",
    "owner_brief",
    "quote_review",
    "voice_task",
    "repair_compare",
    "handover_brief",
]


class AssistantInput(Contract):
    command_id: UUID
    capability: AICapability
    language: Literal["en", "hi"] = "en"
    text: str = Field(default="", max_length=4000)
    car_id: UUID | None = None
    task_id: UUID | None = None
    item_id: str | None = Field(default=None, max_length=80)
    evidence_ids: list[UUID] = Field(default_factory=list, max_length=2)
    document_ids: list[UUID] = Field(default_factory=list, max_length=2)


class AIField(Contract):
    name: str = Field(min_length=1, max_length=60)
    value: str | None = Field(max_length=1000)
    basis: Literal["reported", "observed", "uncertain"]
    source_ids: list[str] = Field(min_length=1, max_length=5)


class AIContent(Contract):
    summary: str = Field(max_length=1600)
    fields: list[AIField] = Field(max_length=12)
    unknowns: list[str] = Field(max_length=8)
    checks: list[str] = Field(max_length=8)
    source_ids: list[str] = Field(min_length=1, max_length=12)


class AISource(Contract):
    id: str
    label: str
    target_type: Literal["car", "task", "business", "document", "input", "dashboard"]
    target_id: UUID | None
    version: int | None


class AssistantDraft(Contract):
    id: UUID
    capability: AICapability
    status: Literal["queued", "running", "completed", "failed", "stale"]
    content: AIContent | None
    sources: list[AISource]
    cutoff: datetime
    source_hash: str
    stale: bool
    review: Literal["accepted", "rejected"] | None
    error_code: str | None
    model: str
    prompt_version: str
    input_tokens: int
    output_tokens: int


class ReviewAssistant(Contract):
    decision: Literal["accepted", "rejected"]
    note: str = Field(default="", max_length=1000)
    human_reviewed: bool


class AssistantOptions(Contract):
    enabled: bool
    model: str
    capabilities: list[AICapability]
    max_images: int = 2
    requests_per_day: int
