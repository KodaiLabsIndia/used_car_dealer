"""Pinned reference imports and read-only catalogue access. No runtime provider dependency."""

import hashlib
import json
from pathlib import Path
from uuid import NAMESPACE_URL, uuid5

from sqlalchemy import text

from app.adapters.operations import rows
from app.catalogue_contracts import CatalogueCoverage, CatalogueModel, CataloguePage

SCOPE = "Name references only. India availability, generations, variants and fitted equipment require verification."
ROOT = Path(__file__).resolve().parents[4] / "data" / "vehicle-catalogue"


def import_catalogue(engine):
    metadata = json.loads((ROOT / "source.json").read_text())
    raw = (ROOT / "global-models.json").read_bytes()
    if hashlib.sha256(raw).hexdigest() != metadata["sha256"]:
        raise ValueError("Catalogue source checksum differs from its pinned manifest")
    data = json.loads(raw)
    if not isinstance(data, dict) or len(data) > 500:
        raise ValueError("Invalid catalogue shape")
    with engine.begin() as conn:
        conn.execute(
            text("""INSERT INTO vehicle_catalogue_releases(id,source_url,revision,license,sha256,scope)
            VALUES(:id,:url,:revision,:license,:sha256,:scope) ON CONFLICT DO NOTHING"""),
            metadata,
        )
        for make, names in data.items():
            if not isinstance(make, str) or not 1 <= len(make.strip()) <= 60 or not isinstance(names, list):
                raise ValueError("Invalid make")
            make = make.strip()
            make_id = uuid5(NAMESPACE_URL, "arihant:catalogue:make:" + make.casefold())
            conn.execute(
                text("INSERT INTO vehicle_catalogue_makes(id,name) VALUES(:id,:name) ON CONFLICT DO NOTHING"),
                {"id": make_id, "name": make},
            )
            for name in names:
                if not isinstance(name, str) or not 1 <= len(name.strip()) <= 80:
                    raise ValueError("Invalid model")
                name = name.strip()
                model_id = uuid5(
                    NAMESPACE_URL, f"arihant:catalogue:model:{make.casefold()}:{name.casefold()}"
                )
                conn.execute(
                    text("""INSERT INTO vehicle_catalogue_models(id,make_id,name,release_id,source_url)
                    VALUES(:id,:make,:name,:release,:url) ON CONFLICT DO NOTHING"""),
                    {
                        "id": model_id,
                        "make": make_id,
                        "name": name,
                        "release": metadata["id"],
                        "url": metadata["url"],
                    },
                )
        india_raw = (ROOT / "india-references.json").read_bytes()
        reference_id = "india-name-body-2026-10-30-v1"
        conn.execute(
            text("""INSERT INTO vehicle_catalogue_releases(id,source_url,revision,license,sha256,scope)
            VALUES(:id,:url,:revision,:license,:sha256,:scope) ON CONFLICT DO NOTHING"""),
            {
                "id": reference_id,
                "url": "https://www.arihantcars.com/",
                "revision": reference_id,
                "license": "Original factual name index; source attribution retained",
                "sha256": hashlib.sha256(india_raw).hexdigest(),
                "scope": "32 source-linked OEM/dealer name and body references. No variant, generation or equipment completeness claim.",
            },
        )
        for row in json.loads(india_raw):
            make, name = row["make"], row["model"]
            make_id = uuid5(NAMESPACE_URL, "arihant:catalogue:make:" + make.casefold())
            model_id = uuid5(NAMESPACE_URL, f"arihant:catalogue:model:{make.casefold()}:{name.casefold()}")
            conn.execute(
                text("INSERT INTO vehicle_catalogue_makes(id,name) VALUES(:id,:name) ON CONFLICT DO NOTHING"),
                {"id": make_id, "name": make},
            )
            conn.execute(
                text("""INSERT INTO vehicle_catalogue_models(id,make_id,name,release_id,source_url,body_type,market_status)
                VALUES(:id,:make,:name,:release,:url,:body,'india_reference') ON CONFLICT(id)
                DO UPDATE SET release_id=EXCLUDED.release_id,source_url=EXCLUDED.source_url,
                body_type=EXCLUDED.body_type,market_status='india_reference'"""),
                {
                    "id": model_id,
                    "make": make_id,
                    "name": name,
                    "release": reference_id,
                    "url": row["sourceUrl"],
                    "body": row["bodyType"],
                },
            )


class CatalogueStore:
    def __init__(self, engine):
        self.engine = engine

    def coverage(self):
        with self.engine.connect() as conn:
            data = rows(
                conn,
                """SELECT count(DISTINCT make_id) makes,count(*) models,
                count(*) FILTER(WHERE market_status='india_reference') india_references FROM vehicle_catalogue_models""",
            )[0]
            return CatalogueCoverage(**data, scope=SCOPE)

    def search(self, query: str, offset: int, limit: int):
        escaped = query.strip().replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
        params = {"query": "%" + escaped + "%", "offset": offset, "limit": limit}
        where = " FROM vehicle_catalogue_models m JOIN vehicle_catalogue_makes k ON k.id=m.make_id WHERE k.name||' '||m.name ILIKE :query"
        with self.engine.connect() as conn:
            total = rows(conn, "SELECT count(*) total" + where, params)[0]["total"]
            items = rows(
                conn,
                "SELECT m.id,k.name make,m.name model,m.body_type,m.market_status,m.source_url"
                + where
                + " ORDER BY lower(k.name),lower(m.name),m.id LIMIT :limit OFFSET :offset",
                params,
            )
        return CataloguePage(
            items=[CatalogueModel.model_validate(r) for r in items],
            total=total,
            offset=offset,
            limit=limit,
            source_scope=SCOPE,
        )
