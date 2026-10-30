from typing import Annotated
from uuid import UUID

from fastapi import Depends, FastAPI

from app.adapters.purchases import PurchaseStore
from app.application.purchases import PurchaseService
from app.contracts import Actor
from app.purchase_contracts import CreatePurchase, Purchase, PurchaseCommand, PurchaseLookup, PurchasePage


def mount_purchases(app: FastAPI, authenticated, store: PurchaseStore, service: PurchaseService):
    User = Annotated[Actor, Depends(authenticated)]

    @app.get("/v1/purchases", response_model=PurchasePage)
    def purchases(actor: User, decisions: bool = False):
        return PurchasePage(items=store.list(actor, decisions))

    @app.get("/v1/cars/{car_id}/purchase", response_model=PurchaseLookup)
    def car_purchase(car_id: UUID, actor: User):
        return PurchaseLookup(purchase=store.for_car(actor, car_id))

    @app.post("/v1/cars/{car_id}/purchase", response_model=Purchase, status_code=201)
    def create_purchase(car_id: UUID, body: CreatePurchase, actor: User):
        return store.create(actor, car_id, body)

    @app.get("/v1/purchases/{purchase_id}", response_model=Purchase)
    def purchase(purchase_id: UUID, actor: User):
        return store.get(actor, purchase_id)

    @app.post("/v1/purchases/{purchase_id}/commands", response_model=Purchase)
    def purchase_command(purchase_id: UUID, body: PurchaseCommand, actor: User):
        return service.run(actor, purchase_id, body)
