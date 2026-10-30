from typing import Annotated

from fastapi import Depends, FastAPI, Query, Response

from app.adapters.notifications import NotificationStore
from app.contracts import Actor
from app.notification_contracts import Inbox, ReadNotifications


def mount_notifications(app: FastAPI, authenticated, store: NotificationStore):
    User = Annotated[Actor, Depends(authenticated)]

    @app.get("/v1/notifications", response_model=Inbox)
    def inbox(
        actor: User,
        unread_only: bool = False,
        limit: int = Query(default=30, ge=1, le=100),
        offset: int = Query(default=0, ge=0),
    ):
        return store.inbox(actor, unread_only, limit, offset)

    @app.post("/v1/notifications/read", status_code=204)
    def read(body: ReadNotifications, actor: User):
        store.read(actor, body)
        return Response(status_code=204)
