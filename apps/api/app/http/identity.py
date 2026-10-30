from typing import Annotated
from uuid import UUID

from fastapi import Depends, FastAPI, Request, Response

from app.adapters.identity import IdentityStore
from app.contracts import Actor, Session
from app.identity_contracts import (
    AuthOptions,
    ChangeSecret,
    CreateStaff,
    LoginInput,
    Member,
    SetupOwnLogin,
    Team,
    TeamCommand,
)


def mount_identity(app: FastAPI, authenticated, store: IdentityStore, training_login: bool):
    User = Annotated[Actor, Depends(authenticated)]

    @app.get("/v1/auth/options", response_model=AuthOptions)
    def options():
        return AuthOptions(training_login=training_login)

    @app.post("/v1/auth/login", response_model=Session)
    def login(body: LoginInput, request: Request, response: Response):
        response.headers["Cache-Control"] = "no-store"
        return store.login(body, request.client.host if request.client else "unknown")

    @app.post("/v1/auth/change-secret", response_model=Session)
    def change_secret(body: ChangeSecret, actor: User, response: Response):
        response.headers["Cache-Control"] = "no-store"
        return store.change_secret(actor, body)

    @app.post("/v1/auth/setup-login", response_model=Member)
    def setup_login(body: SetupOwnLogin, actor: User):
        return store.command(actor, body)

    @app.get("/v1/team", response_model=Team)
    def team(actor: User):
        return store.team(actor)

    @app.post("/v1/team", response_model=Member, status_code=201)
    def create_staff(body: CreateStaff, actor: User):
        return store.command(actor, body)

    @app.post("/v1/team/{user_id}/commands", response_model=Member)
    def team_command(user_id: UUID, body: TeamCommand, actor: User):
        return store.command(actor, body, user_id)
