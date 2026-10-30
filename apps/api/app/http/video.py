from typing import Annotated
from uuid import UUID

from fastapi import Depends, FastAPI, File, UploadFile
from fastapi.responses import FileResponse
from starlette.concurrency import run_in_threadpool

from app.contracts import Actor
from app.video_contracts import MAX_VIDEO_BYTES, VideoClip, VideoClips


def mount_video(app: FastAPI, authenticated, store):
    User = Annotated[Actor, Depends(authenticated)]

    @app.get("/v1/tasks/{task_id}/clips", response_model=VideoClips)
    def clips(task_id: UUID, actor: User):
        return store.list(actor, task_id)

    @app.post("/v1/tasks/{task_id}/items/{item_id}/clips/{id}", response_model=VideoClip, status_code=201)
    async def upload(task_id: UUID, item_id: str, id: UUID, actor: User, file: Annotated[UploadFile, File()]):
        try:
            return await run_in_threadpool(
                store.save, actor, task_id, item_id, id, await file.read(MAX_VIDEO_BYTES + 1)
            )
        finally:
            await file.close()

    @app.get("/v1/clips/{id}/file", response_class=FileResponse)
    def file(id: UUID, actor: User):
        return FileResponse(
            store.file(actor, id), media_type="video/mp4", headers={"Cache-Control": "private, no-store"}
        )
