import hashlib
import logging
import secrets
import threading
import time
from collections import defaultdict, deque
from contextlib import asynccontextmanager
from datetime import UTC, datetime, timedelta
from typing import Annotated, Literal
from uuid import UUID

from fastapi import Depends, FastAPI, File, Query, Request, Response, UploadFile
from fastapi.exceptions import RequestValidationError
from fastapi.responses import FileResponse, JSONResponse
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import text
from sqlalchemy.engine import Engine
from starlette.concurrency import run_in_threadpool
from starlette.exceptions import HTTPException

from app.adapters.catalogue import CatalogueStore
from app.adapters.checklists import ChecklistStore
from app.adapters.commercial import CommercialStore
from app.adapters.company import CompanyStore
from app.adapters.database import create_database
from app.adapters.decisions import DecisionStore
from app.adapters.documents import DocumentStore
from app.adapters.enquiries import EnquiryStore
from app.adapters.identity import IdentityStore
from app.adapters.media import LocalEvidenceStore
from app.adapters.notifications import NotificationStore
from app.adapters.operations import OperationsStore, rows
from app.adapters.purchases import PurchaseStore
from app.adapters.reports import ReportStore
from app.adapters.service_finance import ServiceFinanceStore
from app.adapters.stock import StockStore
from app.adapters.video import VideoStore
from app.adapters.workflows import WorkflowStore
from app.application.commercial import CommercialService
from app.application.purchases import PurchaseService
from app.application.tasks import TaskService
from app.application.workshops import WorkshopService
from app.assistant_composition import compose_assistant
from app.config import Settings
from app.contracts import (
    MAX_PHOTO_BYTES,
    Actor,
    Car,
    CarsPage,
    Dashboard,
    DevSessionInput,
    Evidence,
    Session,
    Stage,
    Task,
    TaskCommand,
    TasksPage,
)
from app.decision_contracts import Decisions
from app.domain.errors import BusinessError
from app.http.assistant import mount_assistant
from app.http.body_limit import BodyLimitMiddleware
from app.http.catalogue import mount_catalogue
from app.http.checklists import mount_checklists
from app.http.commercial import mount_commercial
from app.http.company import mount_company
from app.http.documents import mount_documents
from app.http.enquiries import mount_enquiries
from app.http.identity import mount_identity
from app.http.notifications import mount_notifications
from app.http.purchases import mount_purchases
from app.http.reports import mount_reports
from app.http.service_finance import mount_service_finance
from app.http.stock import mount_stock
from app.http.video import mount_video
from app.http.workflows import mount_workflows
from app.seed import IDS


def create_app(settings: Settings | None = None, engine: Engine | None = None) -> FastAPI:
    settings = settings or Settings()
    settings.validate_runtime()
    owns_engine = engine is None
    database = engine or create_database(settings.sqlalchemy_url)
    store, limiter, limiter_lock = OperationsStore(database), defaultdict(deque), threading.Lock()
    media = LocalEvidenceStore(settings.media_path, store)
    service = TaskService(store)

    @asynccontextmanager
    async def lifespan(_app):
        yield
        if owns_engine:
            database.dispose()

    app = FastAPI(title="Arihant Operations API", version="0.1.0", lifespan=lifespan)
    app.add_middleware(BodyLimitMiddleware, limit=MAX_PHOTO_BYTES + 65536)

    @app.middleware("http")
    async def request_context(request: Request, call_next):
        request.state.request_id = secrets.token_hex(8)
        length = request.headers.get("content-length")
        body_limit = 32 * 1024 * 1024 if "/clips/" in request.url.path else MAX_PHOTO_BYTES
        if length and (not length.isdigit() or int(length) > body_limit + 65536):
            return JSONResponse(
                status_code=413,
                content={
                    "error": {
                        "code": "BODY_TOO_LARGE",
                        "message": "This file is too large.",
                        "requestId": request.state.request_id,
                    }
                },
            )
        response = await call_next(request)
        response.headers["X-Request-Id"] = request.state.request_id
        response.headers["X-Content-Type-Options"] = "nosniff"
        if request.url.path.startswith("/v1/"):
            response.headers["Cache-Control"] = "private, no-store"
        return response

    @app.exception_handler(BusinessError)
    async def business_error(request: Request, error: BusinessError):
        return JSONResponse(
            status_code=error.status,
            content={
                "error": {"code": error.code, "message": error.message, "requestId": request.state.request_id}
            },
        )

    @app.exception_handler(RequestValidationError)
    async def validation_error(request: Request, _error: RequestValidationError):
        return JSONResponse(
            status_code=400,
            content={
                "error": {
                    "code": "VALIDATION_ERROR",
                    "message": "Some details are missing or invalid.",
                    "requestId": request.state.request_id,
                }
            },
        )

    @app.exception_handler(HTTPException)
    async def http_error(request: Request, error: HTTPException):
        return JSONResponse(
            status_code=error.status_code,
            content={
                "error": {
                    "code": "BODY_TOO_LARGE" if error.status_code == 413 else "REQUEST_FAILED",
                    "message": str(error.detail),
                    "requestId": request.state.request_id,
                }
            },
            headers=error.headers,
        )

    @app.exception_handler(Exception)
    async def unexpected_error(request: Request, error: Exception):
        request_id = getattr(request.state, "request_id", "unknown")
        logging.getLogger("arihant.api").error(
            "Request failed request_id=%s error_type=%s", request_id, type(error).__name__
        )
        return JSONResponse(
            status_code=500,
            content={
                "error": {"code": "INTERNAL_ERROR", "message": "Please try again.", "requestId": request_id}
            },
        )

    bearer = HTTPBearer(auto_error=False)
    identity = IdentityStore(store)

    def authenticated(
        request: Request, credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer)]
    ) -> Actor:
        if not credentials or credentials.scheme.lower() != "bearer":
            raise BusinessError("UNAUTHORIZED", "Sign in to continue.", 401)
        actor = store.actor_for_token(credentials.credentials)
        if not actor:
            raise BusinessError("UNAUTHORIZED", "Your session ended. Sign in again.", 401)
        if request.url.path not in (
            "/v1/me",
            "/v1/session",
            "/v1/auth/change-secret",
        ) and identity.must_change(actor):
            raise BusinessError(
                "SECRET_CHANGE_REQUIRED", "Choose your own password before opening work records.", 403
            )
        return actor

    User = Annotated[Actor, Depends(authenticated)]
    mount_identity(app, authenticated, identity, settings.dev_auth_enabled)
    mount_reports(app, authenticated, ReportStore(database))
    mount_video(app, authenticated, VideoStore(store, settings.media_path))
    mount_notifications(app, authenticated, NotificationStore(database))
    workflow_store = WorkflowStore(store)
    mount_checklists(app, authenticated, ChecklistStore(store))
    mount_catalogue(app, authenticated, CatalogueStore(database))
    mount_workflows(app, authenticated, workflow_store, WorkshopService(workflow_store))
    mount_service_finance(app, authenticated, ServiceFinanceStore(workflow_store))
    mount_enquiries(app, authenticated, EnquiryStore(workflow_store))
    mount_stock(app, authenticated, StockStore(workflow_store))
    document_store = DocumentStore(workflow_store, settings.media_path)
    mount_documents(app, authenticated, document_store)
    mount_company(app, authenticated, CompanyStore(workflow_store))
    purchase_store = PurchaseStore(workflow_store)
    commercial_store = CommercialStore(purchase_store)
    assistant_store, assistant_runner = compose_assistant(
        settings, workflow_store, commercial_store, document_store
    )
    mount_assistant(app, authenticated, assistant_store, assistant_runner, settings)
    app.state.assistant_runner = assistant_runner
    mount_commercial(
        app,
        authenticated,
        commercial_store,
        CommercialService(
            commercial_store, allow_draft_checklists=settings.node_env in ("development", "test")
        ),
    )
    mount_purchases(
        app,
        authenticated,
        purchase_store,
        PurchaseService(purchase_store, allow_draft_inspections=settings.node_env in ("development", "test")),
    )

    @app.get("/healthz")
    def health():
        with database.connect() as conn:
            conn.execute(text("SELECT 1"))
        return {"status": "ok", "database": "postgresql", "workspace": "development"}

    @app.post("/v1/auth/dev-session", response_model=Session)
    def sign_in(body: DevSessionInput, request: Request, response: Response):
        if not settings.dev_auth_enabled:
            raise BusinessError("NOT_FOUND", "This sign-in route is unavailable.", 404)
        client = request.client.host if request.client else "unknown"
        with limiter_lock:
            attempts, now = limiter[client], time.monotonic()
            while attempts and attempts[0] < now - 60:
                attempts.popleft()
            if len(attempts) >= 10:
                raise BusinessError("RATE_LIMIT", "Please wait a moment and try again.", 429)
            attempts.append(now)
        if not secrets.compare_digest(
            hashlib.sha256(body.access_code.encode()).digest(),
            hashlib.sha256(settings.dev_access_code.encode()).digest(),
        ):
            raise BusinessError("UNAUTHORIZED", "Check your development access code.", 401)
        with database.begin() as conn:
            data = rows(
                conn,
                "SELECT id,company_id,name,role,work_roles FROM users WHERE company_id=:company AND role=:role AND active=true ORDER BY id LIMIT 1",
                {"company": IDS["company"], "role": body.account},
            )
            if not data:
                raise BusinessError("SETUP_REQUIRED", "Run the training workspace seed first.", 503)
            actor, token, expires = (
                Actor.model_validate(data[0]),
                secrets.token_urlsafe(32),
                datetime.now(UTC) + timedelta(hours=12),
            )
            conn.execute(
                text("INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(:hash,:user,:expires)"),
                {"hash": hashlib.sha256(token.encode()).hexdigest(), "user": actor.id, "expires": expires},
            )
        response.headers["Cache-Control"] = "no-store"
        return Session(token=token, actor=actor, expires_at=expires)

    @app.get("/v1/me", response_model=Actor)
    def me(actor: User):
        return actor

    @app.delete("/v1/session", status_code=204)
    def sign_out(actor: User, credentials: Annotated[HTTPAuthorizationCredentials, Depends(bearer)]):
        with database.begin() as conn:
            conn.execute(
                text("DELETE FROM sessions WHERE token_hash=:hash AND user_id=:user"),
                {"hash": hashlib.sha256(credentials.credentials.encode()).hexdigest(), "user": actor.id},
            )
        return Response(status_code=204)

    @app.get("/v1/decisions", response_model=Decisions)
    def decisions(
        actor: User, limit: int = Query(default=30, ge=1, le=100), offset: int = Query(default=0, ge=0)
    ):
        return DecisionStore(database).list(actor, limit, offset)

    @app.get("/v1/dashboard", response_model=Dashboard)
    def dashboard(actor: User):
        return store.dashboard(actor)

    @app.get("/v1/cars", response_model=CarsPage)
    def cars(
        actor: User,
        stage: Stage | None = None,
        search: str = Query(default="", max_length=100),
        limit: int = Query(default=50, ge=1, le=100),
        offset: int = Query(default=0, ge=0, le=100000),
    ):
        return CarsPage(
            items=store.list_cars(actor, stage, search, limit, offset), limit=limit, offset=offset
        )

    @app.get("/v1/cars/{car_id}", response_model=Car)
    def car(car_id: UUID, actor: User):
        return store.car(actor, car_id)

    @app.get("/v1/tasks", response_model=TasksPage)
    def tasks(actor: User, scope: Literal["all", "mine", "decisions"] = "all"):
        return TasksPage(items=store.list_tasks(actor, scope))

    @app.get("/v1/tasks/{task_id}", response_model=Task)
    def task(task_id: UUID, actor: User):
        return store.task(actor, task_id)

    @app.post("/v1/tasks/{task_id}/commands", response_model=Task)
    def task_command(task_id: UUID, body: TaskCommand, actor: User):
        return service.run(actor, task_id, body)

    @app.post(
        "/v1/tasks/{task_id}/items/{item_id}/evidence/{evidence_id}", response_model=Evidence, status_code=201
    )
    async def upload(
        task_id: UUID, item_id: str, evidence_id: UUID, actor: User, file: Annotated[UploadFile, File()]
    ):
        if len(item_id) > 80:
            raise BusinessError("INVALID_ITEM", "That check is not part of this task.")
        data = await file.read(MAX_PHOTO_BYTES + 1)
        try:
            return await run_in_threadpool(media.save, actor, task_id, item_id, evidence_id, data)
        finally:
            await file.close()

    @app.get("/v1/evidence/{evidence_id}", response_class=FileResponse)
    def get_evidence(evidence_id: UUID, actor: User):
        data = store.evidence(actor, evidence_id)
        return FileResponse(
            settings.media_path / data["storage_key"],
            media_type="image/jpeg",
            headers={"Cache-Control": "private, no-store"},
        )

    return app


app = create_app()
