from starlette.exceptions import HTTPException
from starlette.types import ASGIApp, Receive, Scope, Send


class BodyLimitMiddleware:
    """Bound streamed multipart bodies before the parser spools an entire upload."""

    def __init__(self, app: ASGIApp, limit: int):
        self.app, self.limit = app, limit

    async def __call__(self, scope: Scope, receive: Receive, send: Send):
        if scope["type"] != "http":
            return await self.app(scope, receive, send)
        received = 0
        limit = 32 * 1024 * 1024 + 65536 if "/clips/" in scope.get("path", "") else self.limit

        async def bounded_receive():
            nonlocal received
            message = await receive()
            received += len(message.get("body", b""))
            if received > limit:
                raise HTTPException(413, "This file is too large.")
            return message

        await self.app(scope, bounded_receive, send)
