from typing import Annotated
from uuid import UUID

from fastapi import Depends, FastAPI

from app.allocation_contracts import AllocateChecks
from app.contracts import Actor, Task


def mount_inspection_allocations(app: FastAPI, authenticated, store):
    User = Annotated[Actor, Depends(authenticated)]

    @app.post("/v1/tasks/{task_id}/allocations", response_model=Task)
    def allocate(task_id: UUID, actor: User, body: AllocateChecks):
        return store.allocate(actor, task_id, body)
