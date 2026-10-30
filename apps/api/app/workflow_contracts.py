from datetime import datetime
from typing import Annotated, Literal
from uuid import UUID

from pydantic import AwareDatetime, Field

from app.contracts import Car, ChecklistItem, CommandBase, Contract, Task, VehicleConfiguration

InspectionKind = Literal["pre_purchase", "intake", "repair_qc", "delivery"]


class ChecklistTemplate(Contract):
    id: UUID
    name: str
    kind: InspectionKind
    version: int
    approved: bool
    items: list[ChecklistItem]


class TemplatePage(Contract):
    items: list[ChecklistTemplate]


class Person(Contract):
    id: UUID
    name: str
    role: Literal["owner", "employee"]


class PeoplePage(Contract):
    items: list[Person]


class CreateCar(Contract):
    command_id: UUID
    make: str = Field(min_length=1, max_length=60)
    model: str = Field(min_length=1, max_length=80)
    registration: str = Field(min_length=3, max_length=24)
    year: int = Field(ge=1900, le=2200)
    odometer_km: int | None = Field(default=None, ge=0, le=3000000)
    location: str = Field(min_length=1, max_length=120)
    assigned_to: UUID
    template_id: UUID
    due_at: AwareDatetime | None = None
    configuration: VehicleConfiguration = Field(default_factory=VehicleConfiguration)
    catalogue_model_id: UUID | None = None


class CarCreated(Contract):
    car: Car
    task: Task


class CreateInspection(Contract):
    command_id: UUID
    template_id: UUID
    configuration: VehicleConfiguration = Field(default_factory=VehicleConfiguration)
    assigned_to: UUID
    due_at: AwareDatetime | None = None


class Issue(Contract):
    id: UUID
    car_id: UUID
    description: str
    severity: Literal["normal", "urgent"]
    status: Literal["open", "in_repair", "resolved"]
    version: int
    source_task_id: UUID | None
    source_item_id: str | None
    evidence_id: UUID | None
    job_id: UUID | None
    created_at: datetime


class IssuesPage(Contract):
    items: list[Issue]


class CreateIssue(CommandBase):
    description: str = Field(min_length=1, max_length=1000)
    severity: Literal["normal", "urgent"] = "normal"


class Workshop(Contract):
    id: UUID
    name: str
    phone: str


class WorkshopsPage(Contract):
    items: list[Workshop]


class CreateWorkshop(Contract):
    command_id: UUID
    name: str = Field(min_length=1, max_length=120)
    phone: str = Field(default="", max_length=30)


class Part(Contract):
    id: UUID
    name: str
    status: Literal["requested", "received"]
    expected_at: datetime | None


class RepairJob(Contract):
    id: UUID
    company_id: UUID
    car_id: UUID
    car: Car
    issue_id: UUID
    title: str
    assigned_to: UUID
    assignee_name: str
    workshop_id: UUID | None
    workshop_name: str | None
    status: Literal["assigned", "in_progress", "waiting_parts", "awaiting_qc", "completed"]
    blocker: str
    due_at: datetime | None
    version: int
    qc_task_id: UUID | None
    parts: list[Part]
    updated_at: datetime


class JobsPage(Contract):
    items: list[RepairJob]


class CreateJob(CommandBase):
    assigned_to: UUID
    workshop_id: UUID | None = None
    due_at: AwareDatetime | None = None


class StartJob(CommandBase):
    action: Literal["start"]


class WaitForParts(CommandBase):
    action: Literal["wait_parts"]
    part_name: str = Field(default="", max_length=160)
    expected_at: AwareDatetime | None = None


class ReceivePart(CommandBase):
    action: Literal["receive_part"]
    part_id: UUID


class SubmitRepair(CommandBase):
    action: Literal["submit_repair"]


class ReopenJob(CommandBase):
    action: Literal["reopen"]


class AssignJob(CommandBase):
    action: Literal["assign"]
    assigned_to: UUID


JobCommand = Annotated[
    StartJob | WaitForParts | ReceivePart | SubmitRepair | ReopenJob | AssignJob,
    Field(discriminator="action"),
]


class HistoryEntry(Contract):
    id: UUID
    actor_name: str
    action: str
    summary: str
    created_at: datetime


class HistoryPage(Contract):
    items: list[HistoryEntry]
