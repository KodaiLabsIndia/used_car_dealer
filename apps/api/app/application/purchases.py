from collections.abc import Callable
from datetime import UTC, datetime
from typing import Protocol
from uuid import UUID

from app.contracts import Actor
from app.domain.purchase_policy import PurchasePlan, plan_purchase_command
from app.purchase_contracts import Purchase, PurchaseCommand


class PurchaseCommandStore(Protocol):
    def execute(
        self,
        actor: Actor,
        purchase_id: UUID,
        command: PurchaseCommand,
        planner: Callable[[Purchase], PurchasePlan],
    ) -> Purchase: ...


class PurchaseService:
    def __init__(self, store: PurchaseCommandStore, allow_draft_inspections: bool = False):
        self.store = store
        self.allow_draft_inspections = allow_draft_inspections

    def run(self, actor: Actor, purchase_id: UUID, command: PurchaseCommand) -> Purchase:
        now = datetime.now(UTC)
        return self.store.execute(
            actor,
            purchase_id,
            command,
            lambda purchase: plan_purchase_command(
                actor, purchase, command, now, self.allow_draft_inspections
            ),
        )
