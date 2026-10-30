from typing import Annotated, Literal
from uuid import UUID

from fastapi import Depends, FastAPI, Query

from app.adapters.commercial import CommercialStore
from app.application.commercial import CommercialService
from app.commercial_contracts import BusinessCommand, BusinessQueue, VehicleBusiness
from app.contracts import Actor


def mount_commercial(app: FastAPI, authenticated, store: CommercialStore, service: CommercialService):
    User = Annotated[Actor, Depends(authenticated)]

    @app.get("/v1/business", response_model=BusinessQueue)
    def business_queue(
        actor: User,
        search: str = Query(default="", max_length=100),
        scope: Literal["all", "booked", "support", "attention"] = "all",
        limit: int = Query(default=50, ge=1, le=100),
        offset: int = Query(default=0, ge=0),
    ):
        return store.queue(actor, search, scope, limit, offset)

    @app.get("/v1/cars/{car_id}/business", response_model=VehicleBusiness)
    def vehicle_business(car_id: UUID, actor: User):
        return store.get(actor, car_id)

    @app.post("/v1/cars/{car_id}/business/commands", response_model=VehicleBusiness)
    def business_command(car_id: UUID, body: BusinessCommand, actor: User):
        return service.run(actor, car_id, body)
