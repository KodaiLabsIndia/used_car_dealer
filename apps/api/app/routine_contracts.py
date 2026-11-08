"""Daily staff routines: SBOSS recurring-work concepts, Arihant identity/audit."""

from datetime import date, datetime
from typing import Literal
from uuid import UUID

from pydantic import Field, model_validator

from app.contracts import CommandBase, Contract


class RoutineDefinition(Contract):
    title: str = Field(min_length=3, max_length=120)
    assigned_to: UUID
    weekdays: list[int] = Field(min_length=1, max_length=7)
    steps: list[str] = Field(min_length=1, max_length=20)
    active: bool = True

    @model_validator(mode="after")
    def valid(self):
        self.title = self.title.strip()
        self.steps = [s.strip() for s in self.steps]
        if len(self.title) < 3 or any(not s or len(s) > 240 for s in self.steps):
            raise ValueError("Give each routine step a short, clear instruction.")
        if len(set(self.weekdays)) != len(self.weekdays) or any(d < 0 or d > 6 for d in self.weekdays):
            raise ValueError("Choose distinct working weekdays.")
        return self


class SaveRoutine(CommandBase):
    expected_version: int = Field(ge=0)
    definition: RoutineDefinition
    reason: str = Field(min_length=3, max_length=500)


class RoutineEvent(Contract):
    version: int
    step: int
    done: bool
    note: str
    by_name: str
    created_at: datetime


class RoutineItem(Contract):
    template_version: int
    current_definition: RoutineDefinition
    id: UUID
    version: int
    definition: RoutineDefinition
    assignee_name: str
    work_date: date
    run_version: int
    completed_steps: list[int]
    events: list[RoutineEvent]
    started: bool
    due_today: bool


class RoutineBoard(Contract):
    today: date
    items: list[RoutineItem]


class RoutineStepCommand(CommandBase):
    expected_version: int = Field(ge=0)
    definition_version: int = Field(ge=1)
    work_date: date
    step: int = Field(ge=0, le=19)
    action: Literal["done", "reopen"]
    note: str = Field(default="", max_length=500)
