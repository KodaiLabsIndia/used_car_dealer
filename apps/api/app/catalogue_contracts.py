from uuid import UUID

from app.contracts import Contract


class CatalogueModel(Contract):
    id: UUID
    make: str
    model: str
    body_type: str
    market_status: str
    source_url: str


class CataloguePage(Contract):
    items: list[CatalogueModel]
    total: int
    offset: int
    limit: int
    source_scope: str


class CatalogueCoverage(Contract):
    makes: int
    models: int
    india_references: int
    variants_verified: int = 0
    complete: bool = False
    scope: str
