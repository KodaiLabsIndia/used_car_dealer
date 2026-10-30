from typing import Annotated
from uuid import UUID

from fastapi import Depends, FastAPI

from app.adapters.checklists import ChecklistStore
from app.checklist_contracts import (
    ApproveChecklist,
    CreateChecklistRevision,
    ManagedChecklist,
    ManagedChecklists,
)
from app.contracts import Actor


def mount_checklists(app: FastAPI, authenticated, store: ChecklistStore):
    User = Annotated[Actor, Depends(authenticated)]

    @app.get("/v1/checklists/manage", response_model=ManagedChecklists)
    def managed_checklists(actor: User):
        return ManagedChecklists(items=store.list(actor))

    @app.post("/v1/checklists/revisions", response_model=ManagedChecklist, status_code=201)
    def create_checklist(body: CreateChecklistRevision, actor: User):
        return store.create(actor, body)

    @app.post("/v1/checklists/{id}/approve", response_model=ManagedChecklist)
    def approve_checklist(id: UUID, body: ApproveChecklist, actor: User):
        return store.approve(actor, id, body)
