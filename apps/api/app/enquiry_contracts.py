from datetime import datetime
from typing import Annotated, Literal
from uuid import UUID

from pydantic import AwareDatetime, Field

from app.contracts import CommandBase, Contract


class ContactEvent(Contract):
    id: UUID
    kind: str
    note: str
    recorded_by_name: str
    created_at: datetime


class Appointment(Contract):
    id: UUID
    kind: Literal["viewing", "inspection", "test_drive"]
    scheduled_at: datetime
    status: Literal["scheduled", "completed", "cancelled"]
    driver_name: str
    license_checked: bool
    outcome: str
    completed_at: datetime | None


class Enquiry(Contract):
    id: UUID
    kind: Literal["seller", "buyer"]
    name: str
    phone: str
    source: str
    interest: str
    car_id: UUID | None
    status: Literal["open", "appointment", "negotiation", "won", "lost"]
    assigned_to: UUID
    assignee_name: str
    next_follow_up_at: datetime | None
    last_contact_at: datetime | None
    version: int
    created_at: datetime
    updated_at: datetime


class EnquiryDetail(Contract):
    enquiry: Enquiry
    events: list[ContactEvent]
    appointments: list[Appointment]


class Enquiries(Contract):
    items: list[Enquiry]
    limit: int
    offset: int


class CreateEnquiry(Contract):
    command_id: UUID
    kind: Literal["seller", "buyer"]
    name: str = Field(min_length=1, max_length=120)
    phone: str = Field(min_length=3, max_length=40)
    source: str = Field(default="", max_length=120)
    interest: str = Field(default="", max_length=2000)
    car_id: UUID | None = None
    assigned_to: UUID
    next_follow_up_at: AwareDatetime


class RecordContact(CommandBase):
    action: Literal["contact"]
    channel: Literal["call", "visit", "message", "other"]
    note: str = Field(min_length=1, max_length=2000)
    next_follow_up_at: AwareDatetime


class EnquiryStatus(CommandBase):
    action: Literal["status"]
    status: Literal["open", "negotiation", "won", "lost"]
    reason: str = Field(min_length=3, max_length=2000)


class AssignEnquiry(CommandBase):
    action: Literal["assign"]
    assigned_to: UUID
    reason: str = Field(min_length=3, max_length=1000)


class LinkEnquiryCar(CommandBase):
    action: Literal["link_car"]
    car_id: UUID


class ScheduleAppointment(CommandBase):
    action: Literal["appointment"]
    kind: Literal["viewing", "inspection", "test_drive"]
    scheduled_at: AwareDatetime
    driver_name: str = Field(default="", max_length=120)
    license_checked: bool = False


class FinishAppointment(CommandBase):
    action: Literal["finish_appointment"]
    appointment_id: UUID
    status: Literal["completed", "cancelled"]
    outcome: str = Field(min_length=3, max_length=2000)


EnquiryCommand = Annotated[
    RecordContact | EnquiryStatus | AssignEnquiry | LinkEnquiryCar | ScheduleAppointment | FinishAppointment,
    Field(discriminator="action"),
]
