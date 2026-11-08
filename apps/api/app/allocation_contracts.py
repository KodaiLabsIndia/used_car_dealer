from uuid import UUID

from pydantic import Field, field_validator, model_validator

from app.contracts import CommandBase, Contract


class AllocationChange(Contract):
    item_ids: list[str] = Field(min_length=1, max_length=1000)
    assigned_to: UUID | None


class AllocateChecks(CommandBase):
    unallocate_unmentioned: bool = True
    changes: list[AllocationChange] = Field(min_length=1, max_length=1000)
    reason: str = Field(min_length=3, max_length=1000)

    @field_validator("reason")
    @classmethod
    def meaningful_reason(cls, value):
        value = value.strip()
        if len(value) < 3:
            raise ValueError("Record a reason for this allocation.")
        return value

    @model_validator(mode="after")
    def unique(self):
        ids = [id for c in self.changes for id in c.item_ids]
        if len(ids) != len(set(ids)) or len(ids) > 1000:
            raise ValueError("Choose each check once per allocation.")
        return self
