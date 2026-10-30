from collections.abc import Callable
from typing import Protocol
from uuid import UUID

from app.contracts import Actor
from app.domain.workshop_policy import JobPlan, plan_job_command
from app.workflow_contracts import JobCommand, RepairJob


class RepairCommandStore(Protocol):
    def execute_job(
        self, actor: Actor, job_id: UUID, command: JobCommand, planner: Callable[[RepairJob], JobPlan]
    ) -> RepairJob: ...


class WorkshopService:
    def __init__(self, store: RepairCommandStore):
        self.store = store

    def run(self, actor: Actor, job_id: UUID, command: JobCommand) -> RepairJob:
        return self.store.execute_job(
            actor, job_id, command, lambda job: plan_job_command(actor, job, command)
        )
