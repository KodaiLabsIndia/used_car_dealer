from dataclasses import dataclass
from datetime import datetime
from typing import Protocol
from uuid import UUID

from app.assistant_contracts import AIContent, AISource, AssistantInput
from app.contracts import Actor


@dataclass(frozen=True)
class ModelResult:
    content: AIContent
    input_tokens: int
    output_tokens: int


class DraftModel(Protocol):
    model: str

    def generate(self, system: str, context: str, images: list[bytes]) -> ModelResult: ...


@dataclass(frozen=True)
class SourceBundle:
    text: str
    source_hash: str
    sources: list[AISource]
    cutoff: datetime
    images: list[bytes]


@dataclass(frozen=True)
class AssistantJob:
    id: UUID
    actor: Actor
    body: AssistantInput
    source_hash: str
    model: str


class DraftContext(Protocol):
    def build(self, actor: Actor, body: AssistantInput, with_images: bool = False) -> SourceBundle: ...


class DraftRepository(Protocol):
    def claim(self) -> AssistantJob | None: ...
    def complete(self, id: UUID, result: ModelResult) -> None: ...
    def fail(self, id: UUID, code: str, stale: bool = False) -> None: ...


class AssistantRunner:
    def __init__(self, store: DraftRepository, context: DraftContext, model: DraftModel):
        self.store, self.context, self.model = store, context, model

    def process_one(self):
        from app.domain.assistant_policy import system_prompt, validate_ai_content
        from app.domain.errors import BusinessError

        job = self.store.claim()
        if job is None:
            return False
        try:
            if job.model != self.model.model:
                self.store.fail(job.id, "MODEL_CHANGED")
                return True
            bundle = self.context.build(job.actor, job.body, with_images=True)
            if bundle.source_hash != job.source_hash:
                self.store.fail(job.id, "SOURCES_CHANGED", stale=True)
                return True
            result = self.model.generate(
                system_prompt(job.body.capability, job.body.language), bundle.text, bundle.images
            )
            validate_ai_content(result.content, job.body.capability, {s.id for s in bundle.sources})
            if job.body.language == "hi" and not any(
                "\u0900" <= c <= "\u097f" for c in result.content.summary
            ):
                raise BusinessError(
                    "AI_LANGUAGE_UNAVAILABLE",
                    "The assistant did not return a Hindi draft. Use the normal form.",
                )
            self.store.complete(job.id, result)
        except BusinessError as error:
            self.store.fail(job.id, error.code)
        except Exception:
            self.store.fail(job.id, "AI_UNAVAILABLE")
        return True
