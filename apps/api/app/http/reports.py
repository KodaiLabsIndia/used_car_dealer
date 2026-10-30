from typing import Annotated, Literal

from fastapi import Depends, FastAPI, Query, Response

from app.contracts import Actor
from app.report_contracts import OperationsReport


def mount_reports(app: FastAPI, authenticated, store):
    User = Annotated[Actor, Depends(authenticated)]

    @app.get("/v1/reports/operations", response_model=OperationsReport)
    def report(
        actor: User,
        scope: Literal["all", "stock", "sold"] = "all",
        search: str = Query(default="", max_length=100),
        limit: int = Query(default=30, ge=1, le=100),
        offset: int = Query(default=0, ge=0),
    ):
        return store.operations(actor, scope, search, limit, offset)

    @app.get("/v1/reports/operations.csv")
    def export(
        actor: User,
        scope: Literal["all", "stock", "sold"] = "all",
        search: str = Query(default="", max_length=100),
    ):
        return Response(
            store.export(actor, scope, search),
            media_type="text/csv",
            headers={
                "Cache-Control": "private, no-store",
                "Content-Disposition": 'attachment; filename="arihant-operations.csv"',
            },
        )
