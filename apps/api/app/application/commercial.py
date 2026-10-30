from collections.abc import Callable
from datetime import UTC, datetime
from typing import Protocol
from uuid import UUID

from app.commercial_contracts import BusinessCommand, VehicleBusiness
from app.contracts import Actor
from app.domain.commercial_policy import validate_business_command


class BusinessCommandStore(Protocol):
    def execute(
        self,
        actor: Actor,
        car_id: UUID,
        command: BusinessCommand,
        validate: Callable[[VehicleBusiness], None],
    ) -> VehicleBusiness: ...


class CommercialService:
    def __init__(self, store: BusinessCommandStore, allow_draft_checklists: bool = False):
        self.store = store
        self.allow_draft_checklists = allow_draft_checklists

    def run(self, actor: Actor, car_id: UUID, command: BusinessCommand) -> VehicleBusiness:
        command = command.model_copy(deep=True)
        now = datetime.now(UTC)
        return self.store.execute(
            actor,
            car_id,
            command,
            lambda current: validate_business_command(
                actor, current, command, now, self.allow_draft_checklists
            ),
        )
