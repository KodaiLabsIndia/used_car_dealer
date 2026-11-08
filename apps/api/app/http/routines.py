from datetime import date
from typing import Annotated
from uuid import UUID

from fastapi import Depends, FastAPI

from app.adapters.routines import RoutineStore
from app.contracts import Actor
from app.routine_contracts import RoutineBoard, RoutineStepCommand, SaveRoutine


def mount_routines(app: FastAPI, authenticated, store: RoutineStore):
    User = Annotated[Actor, Depends(authenticated)]

    @app.get("/v1/routines", response_model=RoutineBoard)
    def board(actor: User, day: date | None = None):
        return store.board(actor, day)

    @app.post("/v1/routines/{id}", response_model=RoutineBoard)
    def save(id: UUID, actor: User, body: SaveRoutine):
        return store.save(actor, id, body)

    @app.post("/v1/routines/{id}/steps", response_model=RoutineBoard)
    def step(id: UUID, actor: User, body: RoutineStepCommand):
        return store.step(actor, id, body)
