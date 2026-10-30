from typing import Annotated

from fastapi import Depends, FastAPI, Query

from app.adapters.catalogue import CatalogueStore
from app.catalogue_contracts import CatalogueCoverage, CataloguePage
from app.contracts import Actor


def mount_catalogue(app: FastAPI, authenticated, store: CatalogueStore):
    User = Annotated[Actor, Depends(authenticated)]

    @app.get("/v1/catalogue/vehicles", response_model=CataloguePage)
    def search_catalogue(
        _actor: User,
        query: str = Query(default="", max_length=100),
        offset: int = Query(default=0, ge=0),
        limit: int = Query(default=40, ge=1, le=100),
    ):
        return store.search(query, offset, limit)

    @app.get("/v1/catalogue/coverage", response_model=CatalogueCoverage)
    def catalogue_coverage(_actor: User):
        return store.coverage()
