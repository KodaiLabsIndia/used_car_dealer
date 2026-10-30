from typing import Annotated
from uuid import UUID

from fastapi import Depends, FastAPI

from app.adapters.company import CompanyStore
from app.company_contracts import (
    AssignRequirements,
    CarRequirements,
    DocumentPolicy,
    LinkRequirement,
    PublishDocumentPolicy,
)
from app.contracts import Actor


def mount_company(app: FastAPI, authenticated, store: CompanyStore):
    User = Annotated[Actor, Depends(authenticated)]

    @app.get("/v1/company/document-policy", response_model=DocumentPolicy)
    def policy(actor: User):
        return store.policy(actor)

    @app.post("/v1/company/document-policy", response_model=DocumentPolicy)
    def publish(actor: User, body: PublishDocumentPolicy):
        return store.publish(actor, body)

    @app.get("/v1/cars/{car_id}/document-requirements", response_model=CarRequirements)
    def requirements(actor: User, car_id: UUID):
        return store.requirements(actor, car_id)

    @app.post("/v1/cars/{car_id}/document-requirements", response_model=CarRequirements)
    def assign(actor: User, car_id: UUID, body: AssignRequirements):
        return store.assign(actor, car_id, body)

    @app.post("/v1/cars/{car_id}/document-requirements/{set_id}/links", response_model=CarRequirements)
    def link(actor: User, car_id: UUID, set_id: UUID, body: LinkRequirement):
        return store.link(actor, car_id, set_id, body)
