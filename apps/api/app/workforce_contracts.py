"""Workforce wire contracts. All amounts are integer INR paise."""

from datetime import date, datetime
from typing import Annotated, Literal
from uuid import UUID

from pydantic import Field, model_validator

from app.contracts import CommandBase, Contract

# Individual entries keep the existing app limit; aggregate outputs stay safe in JavaScript.
Money = Annotated[int, Field(strict=True, ge=0, le=9_007_199_254_740_991)]
InputMoney = Annotated[int, Field(strict=True, ge=0, le=100_000_000_000)]


class Schedule(Contract):
    timezone: Literal["Asia/Kolkata"] = "Asia/Kolkata"
    start: str = Field(default="10:00", pattern=r"^(?:[01][0-9]|2[0-3]):[0-5][0-9]$")
    end: str = Field(default="19:00", pattern=r"^(?:[01][0-9]|2[0-3]):[0-5][0-9]$")
    weekdays: list[int] = Field(default_factory=lambda: list(range(6)), min_length=1, max_length=7)
    grace_minutes: int = Field(default=15, ge=0, le=180)

    @model_validator(mode="after")
    def valid(self):
        if (
            self.start == self.end
            or len(set(self.weekdays)) != len(self.weekdays)
            or any(d < 0 or d > 6 for d in self.weekdays)
        ):
            raise ValueError("Use distinct working days and different shift times.")
        from app.domain.workforce_time import attendance_shift_window

        attendance_shift_window(date(2026, 1, 1), self.timezone, self.start, self.end)
        return self


class Holiday(Contract):
    day: date
    name: str = Field(min_length=1, max_length=120)
    paid: bool = True


class WorkforcePolicy(Contract):
    version: int = 0
    effective_from: date = date(2026, 1, 1)
    schedule: Schedule = Field(default_factory=Schedule)
    paid_leave_half_days: int = Field(default=24, ge=0, le=732)
    holidays: list[Holiday] = Field(default_factory=list, max_length=366)
    collect_location: bool = False
    selfie_required: bool = False
    latitude: float | None = Field(default=None, ge=-90, le=90, allow_inf_nan=False)
    longitude: float | None = Field(default=None, ge=-180, le=180, allow_inf_nan=False)
    radius_m: int = Field(default=150, ge=50, le=5000)

    @model_validator(mode="after")
    def valid(self):
        if (self.latitude is None) != (self.longitude is None) or len({h.day for h in self.holidays}) != len(
            self.holidays
        ):
            raise ValueError("Use a complete location and unique holiday dates.")
        return self


class PublishWorkforcePolicy(CommandBase):
    expected_version: int = Field(ge=0)
    policy: WorkforcePolicy
    reason: str = Field(min_length=3, max_length=500)


class PayTerms(Contract):
    effective_from: date
    basis: Literal["daily", "weekly", "monthly", "hourly"]
    cycle: Literal["daily", "weekly", "monthly"]
    rate_paise: InputMoney
    payout_delay_days: int = Field(default=1, ge=0, le=31)
    schedule: Schedule | None = None

    @model_validator(mode="after")
    def valid(self):
        if self.rate_paise <= 0:
            raise ValueError("Pay rate must be positive.")
        return self


class WorkforcePerson(Contract):
    id: UUID
    name: str
    active: bool
    attendance_status: str = "not_punched"


class AttendanceRecord(Contract):
    id: UUID
    user_id: UUID
    work_date: date
    punched_in_at: datetime
    punched_out_at: datetime | None
    status: Literal["open", "closed", "missed_out"]
    minutes: int | None
    version: int
    schedule: Schedule
    policy_version: int
    selfie_required: bool
    source_signature: str = ""
    starts_at: datetime
    ends_at: datetime
    cutoff_at: datetime
    flags: list[str]
    proof_id: UUID | None
    out_proof_id: UUID | None = None


class DayReview(Contract):
    id: UUID
    work_date: date
    half_days: int
    minutes: int | None
    reason: str
    reviewed_by: str
    source_signature: str


class LeaveRecord(Contract):
    id: UUID
    start: date
    end: date
    half_days_per_day: int
    paid: bool
    reason: str
    status: Literal["pending", "approved", "rejected"]
    version: int
    review_reason: str | None


class AdvanceRecord(Contract):
    id: UUID
    amount_paise: Money
    reason: str
    status: Literal["pending", "approved", "rejected", "paid"]
    version: int
    reference: str | None


class AdvancePlan(Contract):
    id: UUID
    mode: Literal["full", "skip", "partial", "split"]
    portion_paise: Money
    starts_on: date
    payment_ids: list[str]
    reason: str


class PayDay(Contract):
    day: date
    source: str
    half_days: int
    minutes: int | None
    earnings_paise: Money
    warnings: list[str]


class SalaryPreview(Contract):
    user_id: UUID
    start: date
    end: date
    due_on: date
    terms: PayTerms
    source_days: list[PayDay]
    base_paise: Money
    bonus_paise: Money
    deduction_paise: Money
    advance_balance_paise: Money
    advance_recovery_paise: Money
    net_paise: Money
    blockers: list[str]
    fingerprint: str


class SalaryRecord(Contract):
    id: UUID
    start: date
    end: date
    revision: int
    snapshot: SalaryPreview
    confirmed_by: str
    confirmed_at: datetime
    paid_paise: Money
    status: Literal["confirmed", "paid", "void"]


class PayEvent(Contract):
    id: UUID
    kind: Literal["advance_payment", "salary_payment", "reversal", "void"]
    amount_paise: Money
    target_id: UUID
    reverses_id: UUID | None
    reference: str
    reason: str
    occurred_at: datetime
    recorded_by: str
    reversed: bool


class WorkforceView(Contract):
    server_now: datetime
    today: date
    empty_day_signature: str
    people: list[WorkforcePerson]
    selected_user_id: UUID
    policy: WorkforcePolicy
    profile_version: int
    pay_terms: PayTerms | None
    attendance: list[AttendanceRecord]
    reviews: list[DayReview]
    leaves: list[LeaveRecord]
    leave_used_half_days: int
    advances: list[AdvanceRecord]
    advance_plan: AdvancePlan | None
    advance_balance_paise: Money
    salaries: list[SalaryRecord]
    payments: list[PayEvent]


class Punch(Contract):
    latitude: float | None = Field(default=None, ge=-90, le=90, allow_inf_nan=False)
    longitude: float | None = Field(default=None, ge=-180, le=180, allow_inf_nan=False)
    accuracy_m: float | None = Field(default=None, ge=0, le=100000, allow_inf_nan=False)
    mocked: bool = False
    client_time: datetime | None = None
    proof_id: UUID | None = None

    @model_validator(mode="after")
    def valid(self):
        if self.client_time and self.client_time.tzinfo is None:
            raise ValueError("Use an aware client time.")
        if (self.latitude is None) != (self.longitude is None):
            raise ValueError("Location is incomplete.")
        return self


class WorkforceCommand(CommandBase):
    action: Literal[
        "punch_in",
        "punch_out",
        "save_profile",
        "review_day",
        "request_leave",
        "review_leave",
        "request_advance",
        "review_advance",
        "pay_advance",
        "save_advance_plan",
        "confirm_salary",
        "pay_salary",
        "reverse_payment",
        "void_salary",
    ]
    expected_version: int = Field(default=0, ge=0)
    punch: Punch | None = None
    session_id: UUID | None = None
    terms: PayTerms | None = None
    work_date: date | None = None
    half_days: int = Field(default=2, ge=0, le=2)
    minutes: int | None = Field(default=None, ge=0, le=1440)
    start: date | None = None
    end: date | None = None
    paid: bool = True
    reason: str = Field(default="", max_length=500)
    target_id: UUID | None = None
    decision: Literal["approved", "rejected"] = "approved"
    amount_paise: InputMoney = 0
    reference: str = Field(default="", max_length=120)
    occurred_at: datetime | None = None
    plan_mode: Literal["full", "skip", "partial", "split"] = "full"
    installments: int = Field(default=1, ge=1, le=24)
    as_of: date | None = None
    fingerprint: str = Field(default="", max_length=64)
    bonus_paise: InputMoney = 0
    deduction_paise: InputMoney = 0
