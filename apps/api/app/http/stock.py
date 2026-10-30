from typing import Annotated
from uuid import UUID

from fastapi import Depends, FastAPI

from app.adapters.stock import StockStore
from app.contracts import Actor
from app.stock_contracts import StockCommand, StockRecord


def mount_stock(app: FastAPI, authenticated, store: StockStore):
    User = Annotated[Actor, Depends(authenticated)]

    @app.get("/v1/cars/{car_id}/stock", response_model=StockRecord)
    def stock(car_id: UUID, actor: User):
        return store.get(actor, car_id)

    @app.post("/v1/cars/{car_id}/stock/commands", response_model=StockRecord)
    def command(car_id: UUID, body: StockCommand, actor: User):
        return store.run(actor, car_id, body)
