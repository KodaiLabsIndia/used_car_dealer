from datetime import datetime
from typing import Annotated, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel

Stage = Literal["inspection", "purchase", "refurbishment", "ready", "delivered"]
STAGES: tuple[Stage, ...] = ("inspection", "purchase", "refurbishment", "ready", "delivered")
MEDIA_PROFILE = "photo-fhd-v1"
MAX_PHOTO_BYTES = 8 * 1024 * 1024


class Contract(BaseModel):
    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        extra="forbid",
        json_schema_serialization_defaults_required=True,
    )


WorkRole = Literal["inspector", "coordinator", "supervisor", "manager", "sales"]


class Actor(Contract):
    id: UUID
    company_id: UUID
    name: str
    role: Literal["owner", "employee"]
    work_roles: list[WorkRole] = Field(default_factory=lambda: ["inspector"])


class VehicleConfiguration(Contract):
    body_type: Literal[
        "unknown", "sedan", "hatchback", "suv", "mpv", "van", "coupe", "convertible", "wagon", "pickup"
    ] = "unknown"
    fuel: Literal["unknown", "petrol", "diesel", "cng", "lpg", "hybrid", "electric"] = "unknown"
    transmission: Literal["unknown", "manual", "automatic", "amt", "cvt", "dct"] = "unknown"
    features: dict[str, bool | None] = Field(default_factory=dict, max_length=30)


class Applicability(Contract):
    fuels: list[str] = Field(default_factory=list, max_length=10)
    transmissions: list[str] = Field(default_factory=list, max_length=10)
    feature: str | None = Field(default=None, max_length=60)


class Car(Contract):
    id: UUID
    vehicle_id: UUID
    stock_number: str
    make: str
    model: str
    registration: str
    year: int
    stage: Stage
    commercial_status: Literal["available", "booked", "sold"]
    service_status: Literal["none", "in_service", "waiting_parts", "done"]
    location: str
    next_action: str
    due_at: datetime | None
    version: int
    updated_at: datetime
    image_key: Literal["sonet", "seltos", "generic"]
    odometer_km: int | None = None


class Evidence(Contract):
    id: UUID
    item_id: str
    width: int
    height: int
    bytes: int
    sha256: str
    profile: Literal["photo-fhd-v1"] = MEDIA_PROFILE


class ChecklistItem(Contract):
    id: str
    title: str
    title_hi: str
    title_mr: str = ""
    instruction: str
    instruction_hi: str
    instruction_mr: str = ""
    order: int
    required: bool
    zone: Literal[
        "general",
        "identity",
        "exterior",
        "visibility",
        "wheels",
        "powertrain",
        "underbody",
        "cabin",
        "electrical",
        "safety",
        "road_test",
    ] = "general"
    component_id: str = Field(default="vehicle", max_length=80)
    method: Literal["visual", "function", "measurement", "document", "diagnostic", "road_test"] = "visual"
    critical: bool = False
    requires_clip: bool = False
    measurement_unit: Literal["mm", "psi", "V", "km"] | None = None
    applicability: Applicability = Field(default_factory=Applicability)
    configuration_pending: bool = False
    applicability_reason: str = ""


class Answer(Contract):
    item_id: str
    result: Literal["ok", "problem", "unable", "not_applicable"]
    note: str = ""
    evidence_id: UUID
    reading: float | None = Field(default=None, ge=0, allow_inf_nan=False)
    applicability_confirmed: bool = False


class Task(Contract):
    id: UUID
    company_id: UUID
    car_id: UUID
    title: str
    assigned_to: UUID
    assignee_name: str
    status: Literal["assigned", "in_progress", "submitted", "completed", "recheck"]
    version: int
    help_open: bool
    due_at: datetime | None
    car: Car
    items: list[ChecklistItem]
    answers: list[Answer]
    evidence: list[Evidence]
    kind: Literal["reference", "pre_purchase", "intake", "repair_qc", "delivery"] = "reference"
    template_name: str = "Reference checklist"
    template_version: int = 1
    template_approved: bool = False
    submitted_by: UUID | None = None
    submitted_at: datetime | None = None
    recheck_items: list[str] = Field(default_factory=list)
    recheck_note: str = ""
    vehicle_configuration: VehicleConfiguration = Field(default_factory=VehicleConfiguration)
    clip_item_ids: list[str] = Field(default_factory=list)


class StageCounts(Contract):
    inspection: int
    purchase: int
    refurbishment: int
    ready: int
    delivered: int


class Dashboard(Contract):
    cars: int
    workshop: int
    booked: int
    decisions: int
    stages: StageCounts
    tasks: list[Task]
    attention: list[Car]


class CommandBase(Contract):
    command_id: UUID
    expected_version: int = Field(ge=1)


class AnswerCommand(CommandBase):
    action: Literal["answer"]
    item_id: str = Field(min_length=1, max_length=80)
    result: Literal["ok", "problem", "unable", "not_applicable"]
    note: str = Field(default="", max_length=1000)
    evidence_id: UUID
    reading: float | None = Field(default=None, ge=0, allow_inf_nan=False)
    applicability_confirmed: bool = False


class SubmitCommand(CommandBase):
    action: Literal["submit"]


class TakeoverCommand(CommandBase):
    action: Literal["takeover"]


class ReassignCommand(CommandBase):
    action: Literal["assign"]
    assigned_to: UUID


class HelpCommand(CommandBase):
    action: Literal["help"]
    item_id: str | None = Field(default=None, max_length=80)
    note: str = Field(default="", max_length=1000)


class ReviewCommand(CommandBase):
    action: Literal["review"]
    decision: Literal["accept", "recheck"]
    recheck_item_ids: list[str] = Field(default_factory=list, max_length=1000)
    note: str = Field(default="", max_length=1000)


TaskCommand = Annotated[
    AnswerCommand | SubmitCommand | TakeoverCommand | ReassignCommand | HelpCommand | ReviewCommand,
    Field(discriminator="action"),
]


class DevSessionInput(Contract):
    access_code: str = Field(min_length=12, max_length=200)
    account: Literal["owner", "employee"]


class Session(Contract):
    token: str
    expires_at: datetime
    actor: Actor
    must_change_secret: bool = False
    authentication: Literal["training", "password"] = "training"


class CarsPage(Contract):
    items: list[Car]
    limit: int
    offset: int


class TasksPage(Contract):
    items: list[Task]
