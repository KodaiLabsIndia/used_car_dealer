from typing import Annotated, Literal
from uuid import UUID

from fastapi import Depends, FastAPI, Query

from app.adapters.enquiries import EnquiryStore
from app.contracts import Actor
from app.enquiry_contracts import CreateEnquiry, Enquiries, EnquiryCommand, EnquiryDetail


def mount_enquiries(app: FastAPI, authenticated, store: EnquiryStore):
    User = Annotated[Actor, Depends(authenticated)]

    @app.get("/v1/enquiries", response_model=Enquiries)
    def enquiries(
        actor: User,
        scope: Literal["all", "mine", "due"] = "mine",
        kind: Literal["seller", "buyer"] | None = None,
        search: str = Query(default="", max_length=120),
        limit: int = Query(default=30, ge=1, le=100),
        offset: int = Query(default=0, ge=0),
    ):
        return store.list(actor, scope, kind, search, limit, offset)

    @app.post("/v1/enquiries", response_model=EnquiryDetail, status_code=201)
    def create(body: CreateEnquiry, actor: User):
        return store.create(actor, body)

    @app.get("/v1/enquiries/{id}", response_model=EnquiryDetail)
    def enquiry(id: UUID, actor: User):
        return store.get(actor, id)

    @app.post("/v1/enquiries/{id}/commands", response_model=EnquiryDetail)
    def command(id: UUID, body: EnquiryCommand, actor: User):
        return store.run(actor, id, body)
