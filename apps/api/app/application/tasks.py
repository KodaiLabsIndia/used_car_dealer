from collections.abc import Callable
from typing import Protocol
from uuid import UUID

from app.contracts import Actor, Task, TaskCommand
from app.domain.task_policy import TaskPlan, plan_task_command


class TaskCommandStore(Protocol):
    def execute(
        self, actor: Actor, task_id: UUID, command: TaskCommand, planner: Callable[[Task], TaskPlan]
    ) -> Task: ...


class TaskService:
    def __init__(self, store: TaskCommandStore):
        self.store = store

    def run(self, actor: Actor, task_id: UUID, command: TaskCommand) -> Task:
        return self.store.execute(
            actor, task_id, command, lambda task: plan_task_command(actor, task, command)
        )
