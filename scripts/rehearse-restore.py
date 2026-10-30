"""Local-only backup/restore drill. Never changes or restores over the source DB."""

import hashlib
import json
import subprocess
import sys
import tempfile
import re
from datetime import UTC, datetime
from pathlib import Path
from sqlalchemy import create_engine, text
from app.config import Settings

settings = Settings()
assert settings.node_env in ("development", "test")
root = Path(__file__).resolve().parents[1]
container = subprocess.check_output(
    ["node", "scripts/compose.mjs", "ps", "-q", "db"], cwd=root, text=True
).strip()
assert container and "\n" not in container
stamp = datetime.now(UTC).strftime("%Y%m%dT%H%M%SZ")
folder = root / ".data/backups" / stamp
folder.mkdir(parents=True, mode=0o700)
fixture = None
fixture_directory = None
schema = "public"
if "--synthetic" in sys.argv:
    sys.path.insert(0, str(root / "apps/api/tests"))
    from test_integration import workspace, checked
    from test_commercial import acquired, delivered
    from test_documents import upload as upload_document

    fixture_directory = tempfile.TemporaryDirectory(prefix="arihant-restore-")
    settings.media_root = fixture_directory.name
    fixture = workspace.__wrapped__(Path(fixture_directory.name))
    client, source, owner, employee = next(fixture)
    current = delivered(
        client, owner, acquired(client, owner, registration="RESTORE01")
    )
    checked(upload_document(client, owner, current["car"]["id"]), 201)
    with source.connect() as conn:
        schema = conn.execute(text("SELECT current_schema()")).scalar_one()
    assert re.fullmatch(r"test_[a-f0-9]{32}", schema)
else:
    source = create_engine(settings.sqlalchemy_url)
restored_name = "arihant_restore_" + stamp.lower()
tables = [
    "companies",
    "users",
    "stock_cycles",
    "tasks",
    "task_submissions",
    "evidence",
    "purchases",
    "purchase_payments",
    "sale_bookings",
    "sale_deliveries",
    "vehicle_ledger",
    "repair_invoices",
    "documents",
    "video_clips",
    "task_reviews",
    "ownership_transfers",
    "warranty_claims",
    "audit_events",
]
with source.connect().execution_options(isolation_level="REPEATABLE READ") as conn:
    with conn.begin():
        snapshot = conn.execute(text("SELECT pg_export_snapshot()")).scalar_one()
        counts = {
            t: conn.execute(
                text("SELECT count(*) FROM " + schema + "." + t)
            ).scalar_one()
            for t in tables
        }
        digests = {
            t: conn.execute(
                text(
                    "SELECT md5(COALESCE(string_agg(to_jsonb(t)::text,E'\\n' ORDER BY to_jsonb(t)::text),'')) FROM "
                    + schema
                    + "."
                    + t
                    + " t"
                )
            ).scalar_one()
            for t in tables
        }
        media = list(
            conn.execute(
                text(
                    "SELECT storage_key,sha256 FROM "
                    + schema
                    + ".evidence UNION ALL SELECT storage_key,sha256 FROM "
                    + schema
                    + ".documents UNION ALL SELECT storage_key,sha256 FROM "
                    + schema
                    + ".video_clips"
                )
            ).mappings()
        )
        with (folder / "database.dump").open("wb") as output:
            subprocess.run(
                [
                    "docker",
                    "exec",
                    container,
                    "pg_dump",
                    "-U",
                    "arihant",
                    "-Fc",
                    "--schema=" + schema,
                    "--no-owner",
                    "--snapshot=" + snapshot,
                    "arihant",
                ],
                stdout=output,
                check=True,
            )
for file in media:
    path = (settings.media_path / file["storage_key"]).resolve()
    assert path.parent == settings.media_path.resolve()
    data = path.read_bytes()
    assert hashlib.sha256(data).hexdigest() == file["sha256"]
    destination = folder / "media" / path.name
    destination.parent.mkdir(exist_ok=True, mode=0o700)
    destination.write_bytes(data)
    destination.chmod(0o600)
admin = source.connect().execution_options(isolation_level="AUTOCOMMIT")
try:
    admin.execute(text("CREATE DATABASE " + restored_name))
    with (folder / "database.dump").open("rb") as data:
        subprocess.run(
            [
                "docker",
                "exec",
                "-i",
                container,
                "pg_restore",
                "-U",
                "arihant",
                "--no-owner",
                "--clean",
                "--if-exists",
                "--exit-on-error",
                "-d",
                restored_name,
            ],
            stdin=data,
            check=True,
        )
    target = create_engine(source.url.set(database=restored_name))
    try:
        with target.connect() as conn:
            conn.execute(text("SET search_path TO " + schema))
            actual = {
                t: conn.execute(
                    text("SELECT count(*) FROM " + schema + "." + t)
                ).scalar_one()
                for t in tables
            }
            actual_digests = {
                t: conn.execute(
                    text(
                        "SELECT md5(COALESCE(string_agg(to_jsonb(t)::text,E'\\n' ORDER BY to_jsonb(t)::text),'')) FROM "
                        + schema
                        + "."
                        + t
                        + " t"
                    )
                ).scalar_one()
                for t in tables
            }
            assert actual_digests == digests
            for file in media:
                assert (
                    hashlib.sha256(
                        (folder / "media" / file["storage_key"]).read_bytes()
                    ).hexdigest()
                    == file["sha256"]
                )
            assert actual == counts
            missing = conn.execute(
                text(
                    "SELECT count(*) FROM evidence e LEFT JOIN tasks t ON t.id=e.task_id AND t.company_id=e.company_id WHERE t.id IS NULL"
                )
            ).scalar_one()
            assert missing == 0
    finally:
        target.dispose()
    report = {
        "at": stamp,
        "scope": "isolated synthetic purchase-to-delivery journey"
        if fixture
        else "local development public schema",
        "allTableContentsMatch": True,
        "sourceUnmodified": True,
        "isolatedRestoreDropped": True,
        "rowCounts": counts,
        "mediaFilesVerified": len(media),
        "notProductionRecoveryAcceptance": True,
    }
    (root / "docs/review/restore-rehearsal.json").write_text(
        json.dumps(report, indent=2) + "\n"
    )
    print(json.dumps(report), flush=True)
finally:
    admin.execute(text("DROP DATABASE IF EXISTS " + restored_name + " WITH (FORCE)"))
    admin.close()
    source.dispose()
    if fixture:
        try:
            next(fixture)
        except StopIteration:
            pass
        fixture_directory.cleanup()
(folder / "database.dump").chmod(0o600)
