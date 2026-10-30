from typing import Annotated, Literal
from uuid import UUID

from pydantic import Field

from app.contracts import Contract, WorkRole


class LoginInput(Contract):
    dealer_code: str = Field(min_length=3, max_length=50)
    username: str = Field(min_length=2, max_length=50)
    secret: str = Field(min_length=1, max_length=200)


class AuthOptions(Contract):
    staff_login: bool = True
    training_login: bool


class Member(Contract):
    id: UUID
    name: str
    role: Literal["owner", "employee"]
    work_roles: list[WorkRole] = Field(default_factory=lambda: ["inspector"], min_length=1, max_length=5)
    active: bool
    version: int
    username: str | None
    must_change_secret: bool


class Team(Contract):
    dealer_code: str
    items: list[Member]


class CreateStaff(Contract):
    command_id: UUID
    name: str = Field(min_length=1, max_length=120)
    username: str = Field(pattern=r"^[a-zA-Z0-9._-]{2,40}$")
    temporary_secret: str = Field(min_length=8, max_length=200)
    work_roles: list[WorkRole] = Field(default_factory=lambda: ["inspector"], min_length=1, max_length=5)


class UpdateStaff(Contract):
    action: Literal["profile"]
    command_id: UUID
    expected_version: int = Field(ge=1)
    name: str = Field(min_length=1, max_length=120)
    active: bool
    work_roles: list[WorkRole] | None = Field(default=None, min_length=1, max_length=5)


class ResetStaffSecret(Contract):
    action: Literal["reset_secret"]
    command_id: UUID
    expected_version: int = Field(ge=1)
    temporary_secret: str = Field(min_length=8, max_length=200)


TeamCommand = Annotated[UpdateStaff | ResetStaffSecret, Field(discriminator="action")]


class SetupOwnLogin(Contract):
    command_id: UUID
    username: str = Field(pattern=r"^[a-zA-Z0-9._-]{2,40}$")
    secret: str = Field(min_length=12, max_length=200)


class ChangeSecret(Contract):
    current_secret: str = Field(min_length=1, max_length=200)
    new_secret: str = Field(min_length=8, max_length=200)
