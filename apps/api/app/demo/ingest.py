"""Atomic, repeatable demo ingestion, isolated from test fixtures and real companies."""

import logging
import re
from datetime import date
from pathlib import Path
from uuid import uuid4

from sqlalchemy import inspect, text

from app.demo.builder import DemoBuilder
from app.demo.core import DemoClock, DemoConfig, insert, uid
from app.demo.media import DemoMedia

REFERENCE_TABLES = {
    "alembic_version",
    "schema_migrations",
    "vehicle_catalogue_releases",
    "vehicle_catalogue_makes",
    "vehicle_catalogue_models",
}


def reset_tables(conn):
    known = {
        name
        for p in (Path(__file__).resolve().parents[2] / "db/migrations").glob("*.sql")
        for name in re.findall(r"CREATE TABLE\s+(\w+)", p.read_text(), re.IGNORECASE)
    }
    existing = set(inspect(conn).get_table_names())
    unknown = existing - known - REFERENCE_TABLES - {"demo_seed_state"}
    if unknown:
        raise RuntimeError("Demo reset refuses unknown tables: " + ", ".join(sorted(unknown)))
    quote = conn.dialect.identifier_preparer.quote
    names = sorted(existing - REFERENCE_TABLES)
    conn.execute(text("TRUNCATE TABLE " + ", ".join(quote(n) for n in names) + " RESTART IDENTITY"))


def require_demo_only(conn):
    companies = conn.execute(text("SELECT id,name FROM companies ORDER BY id")).mappings().all()
    if any(
        c["id"] != uid("company") or not any(word in c["name"].casefold() for word in ("demo", "training"))
        for c in companies
    ):
        raise RuntimeError(
            "Demo ingestion refuses non-demo company data. Use a separate local demo database."
        )
    return companies


def seed_demo(engine, media_root: Path, as_of: date, config: DemoConfig, password: str, *, reset=False):
    if len(password) < 12:
        raise ValueError("Demo account passwords require at least 12 characters.")
    if any(car.year > as_of.year for car in config.cars):
        raise ValueError("The demo date precedes a vehicle's model year.")
    media = None
    old_files = set()
    try:
        with engine.begin() as conn:
            conn.execute(
                text(
                    "SELECT pg_advisory_xact_lock(hashtextextended(current_database()||current_schema()||:key,0))"
                ),
                {"key": "arihant-demo"},
            )
            companies = require_demo_only(conn)
            conn.execute(
                text(
                    "CREATE TABLE IF NOT EXISTS demo_seed_state (singleton boolean PRIMARY KEY CHECK(singleton),as_of date NOT NULL,configuration_hash text NOT NULL,seed_version integer NOT NULL,manifest jsonb NOT NULL,loaded_at timestamptz NOT NULL DEFAULT now())"
                )
            )
            state = (
                conn.execute(text("SELECT * FROM demo_seed_state WHERE singleton=true")).mappings().first()
            )
            if (
                state
                and state["as_of"] == as_of
                and state["configuration_hash"] == config.fingerprint
                and not reset
            ):
                return {**state["manifest"], "unchanged": True}
            if companies and not reset:
                raise RuntimeError(
                    "Existing demo data is present. Use --reset to replace it with the selected date/configuration."
                )
            if reset:
                old_files = {p for p in media_root.glob("*") if p.is_file() and not p.is_symlink()}
                reset_tables(conn)
            generation = uuid4().hex[:16]
            media = DemoMedia(media_root, generation)
            builder = DemoBuilder(conn, engine, config, DemoClock(as_of), media, password, generation)
            result = builder.build()
            manifest = {
                "seedVersion": config.version,
                "configurationHash": config.fingerprint,
                "asOf": as_of.isoformat(),
                "timezone": "Asia/Kolkata",
                "demoOnly": True,
                "dealerCode": config.dealer_code,
                "generation": generation,
                "staff": [
                    {
                        "key": p.key,
                        "id": str(builder.uid(p.key)),
                        "name": p.name,
                        "role": p.role,
                        "workRoles": p.work_roles,
                        "username": p.username,
                    }
                    for p in config.staff
                ],
                **result,
                "unchanged": False,
            }
            insert(
                conn,
                "demo_seed_state",
                singleton=True,
                as_of=as_of,
                configuration_hash=config.fingerprint,
                seed_version=config.version,
                manifest=manifest,
            )
    except Exception:
        if media:
            media.rollback()
        raise
    # The transaction is committed. Cleanup cannot roll back its new media.
    for path in old_files:
        try:
            path.unlink(missing_ok=True)
        except OSError:
            logging.getLogger(__name__).warning("Demo committed; could not remove prior media %s", path.name)
    return manifest
