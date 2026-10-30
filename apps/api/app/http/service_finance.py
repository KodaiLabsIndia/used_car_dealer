from typing import Annotated
from uuid import UUID

from fastapi import Depends, FastAPI

from app.adapters.service_finance import ServiceFinanceStore
from app.contracts import Actor
from app.service_finance_contracts import ServiceFinance, ServiceFinanceCommand


def mount_service_finance(app: FastAPI, authenticated, store: ServiceFinanceStore):
    User = Annotated[Actor, Depends(authenticated)]

    @app.get("/v1/jobs/{job_id}/finance", response_model=ServiceFinance)
    def finance(job_id: UUID, actor: User):
        return store.get(actor, job_id)

    @app.post("/v1/jobs/{job_id}/finance/commands", response_model=ServiceFinance)
    def command(job_id: UUID, body: ServiceFinanceCommand, actor: User):
        return store.run(actor, job_id, body)
