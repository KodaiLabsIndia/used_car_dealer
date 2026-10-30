from typing import Annotated
from uuid import UUID

from fastapi import Depends, FastAPI, File, Form, Query, UploadFile
from fastapi.responses import FileResponse
from pydantic import ValidationError
from starlette.concurrency import run_in_threadpool

from app.adapters.documents import DocumentStore
from app.contracts import MAX_PHOTO_BYTES, Actor
from app.document_contracts import Document, Documents, DocumentUpload, ReviewDocument
from app.domain.errors import BusinessError


def mount_documents(app: FastAPI, authenticated, store: DocumentStore):
    User = Annotated[Actor, Depends(authenticated)]

    @app.get("/v1/cars/{car_id}/documents", response_model=Documents)
    def documents(
        car_id: UUID,
        actor: User,
        limit: int = Query(default=30, ge=1, le=100),
        offset: int = Query(default=0, ge=0),
    ):
        return store.list(actor, car_id, limit, offset)

    @app.post("/v1/cars/{car_id}/documents/{id}", response_model=Document, status_code=201)
    async def upload(
        car_id: UUID,
        id: UUID,
        actor: User,
        metadata: Annotated[str, Form(max_length=4000)],
        file: Annotated[UploadFile, File()],
    ):
        try:
            try:
                body = DocumentUpload.model_validate_json(metadata)
            except ValidationError as error:
                raise BusinessError("VALIDATION_ERROR", "Review this document title and links.") from error
            data = await file.read(MAX_PHOTO_BYTES + 1)
            return await run_in_threadpool(store.save, actor, car_id, id, body, data)
        finally:
            await file.close()

    @app.get("/v1/documents/{id}/file", response_class=FileResponse)
    def page(id: UUID, actor: User):
        document, path = store.file(actor, id)
        return FileResponse(
            path,
            media_type="image/jpeg",
            headers={"Cache-Control": "private, no-store"},
            filename=str(document.id) + ".jpg",
        )

    @app.post("/v1/documents/{id}/review", response_model=Document)
    def review(id: UUID, body: ReviewDocument, actor: User):
        return store.review(actor, id, body)
