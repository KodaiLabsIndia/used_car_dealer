from typing import Annotated
from uuid import UUID

from fastapi import BackgroundTasks, Depends, FastAPI

from app.assistant_contracts import AssistantDraft, AssistantInput, AssistantOptions, ReviewAssistant
from app.contracts import Actor
from app.domain.assistant_policy import CAPABILITIES


def mount_assistant(app: FastAPI, authenticated, store, runner, settings):
    User = Annotated[Actor, Depends(authenticated)]

    @app.get("/v1/assistant/options", response_model=AssistantOptions)
    def options(actor: User):
        return AssistantOptions(
            enabled=settings.ai_enabled,
            model=settings.ai_model,
            capabilities=list(CAPABILITIES),
            requests_per_day=settings.ai_requests_per_day,
        )

    @app.post("/v1/assistant/drafts", response_model=AssistantDraft, status_code=202)
    def create(body: AssistantInput, actor: User, background: BackgroundTasks):
        result = store.reserve(actor, body)
        background.add_task(runner.process_one)
        return result

    @app.get("/v1/assistant/drafts/{id}", response_model=AssistantDraft)
    def draft(id: UUID, actor: User):
        return store.get(actor, id)

    @app.post("/v1/assistant/drafts/{id}/review", response_model=AssistantDraft)
    def review(id: UUID, body: ReviewAssistant, actor: User):
        return store.review(actor, id, body)
