from datetime import date
from typing import Annotated
from uuid import UUID

from fastapi import Depends, FastAPI, File, Query, UploadFile
from fastapi.responses import FileResponse
from starlette.concurrency import run_in_threadpool

from app.adapters.workforce import WorkforceStore
from app.contracts import MAX_PHOTO_BYTES, Actor, Contract
from app.workforce_contracts import (
    PublishWorkforcePolicy,
    SalaryPreview,
    WorkforceCommand,
    WorkforcePolicy,
    WorkforceView,
)


class WorkforceProof(Contract):
    id: UUID


def mount_workforce(app: FastAPI, authenticated, store: WorkforceStore):
    User = Annotated[Actor, Depends(authenticated)]

    @app.get("/v1/workforce", response_model=WorkforceView)
    def view(actor: User, user_id: UUID | None = None, as_of: date | None = None):
        return store.view(actor, user_id, as_of)

    @app.post("/v1/workforce/policy", response_model=WorkforcePolicy)
    def policy(actor: User, body: PublishWorkforcePolicy):
        return store.publish(actor, body)

    @app.post("/v1/workforce/{user_id}/commands", response_model=WorkforceView)
    def command(user_id: UUID, actor: User, body: WorkforceCommand):
        return store.run(actor, user_id, body)

    @app.get("/v1/workforce/{user_id}/preview", response_model=SalaryPreview)
    def preview(
        user_id: UUID,
        actor: User,
        as_of: date,
        bonus_paise: int = Query(default=0, ge=0, le=100_000_000_000),
        deduction_paise: int = Query(default=0, ge=0, le=100_000_000_000),
    ):
        return store.preview(actor, user_id, as_of, bonus_paise, deduction_paise)

    @app.post("/v1/workforce/proofs/{id}", response_model=WorkforceProof, status_code=201)
    async def proof(id: UUID, actor: User, file: Annotated[UploadFile, File()]):
        try:
            return await run_in_threadpool(store.save_proof, actor, id, await file.read(MAX_PHOTO_BYTES + 1))
        finally:
            await file.close()

    @app.get("/v1/workforce/proofs/{id}/file", response_class=FileResponse)
    def proof_file(id: UUID, actor: User):
        return FileResponse(
            store.proof(actor, id), media_type="image/jpeg", headers={"Cache-Control": "private, no-store"}
        )
