"""Private pre-reset database/media backup for the local Compose demo only."""

import hashlib
import json
import shutil
import subprocess
from datetime import UTC, datetime
from pathlib import Path

from sqlalchemy import text

from app.config import ROOT


def backup_local(engine, media_root: Path):
    if engine.url.host not in ("127.0.0.1", "localhost", "::1"):
        raise RuntimeError("Automatic demo replacement is limited to a local database.")
    stamp = datetime.now(UTC).strftime("%Y%m%dT%H%M%S.%fZ")
    folder = ROOT / ".data/backups" / ("before-demo-" + stamp)
    folder.mkdir(parents=True, mode=0o700)
    container = subprocess.check_output(
        ["node", "scripts/compose.mjs", "ps", "-q", "db"], cwd=ROOT, text=True, timeout=20
    ).strip()
    if not container or "\n" in container:
        raise RuntimeError("Start the local Compose database before demo reset.")
    with engine.connect().execution_options(isolation_level="REPEATABLE READ") as conn:
        with conn.begin():
            schema = conn.execute(text("SELECT current_schema()")).scalar_one()
            snapshot = conn.execute(text("SELECT pg_export_snapshot()")).scalar_one()
            counts = {
                r["tablename"]: conn.execute(
                    text("SELECT count(*) FROM " + conn.dialect.identifier_preparer.quote(r["tablename"]))
                ).scalar_one()
                for r in conn.execute(
                    text("SELECT tablename FROM pg_tables WHERE schemaname=current_schema()")
                ).mappings()
            }
            with (folder / "database.dump").open("xb") as output:
                subprocess.run(
                    [
                        "docker",
                        "exec",
                        container,
                        "pg_dump",
                        "-U",
                        engine.url.username,
                        "-Fc",
                        "--schema=" + schema,
                        "--no-owner",
                        "--snapshot=" + snapshot,
                        engine.url.database,
                    ],
                    stdout=output,
                    stderr=subprocess.PIPE,
                    check=True,
                    timeout=120,
                )
    (folder / "database.dump").chmod(0o600)
    media_copy = folder / "media"
    media_copy.mkdir(mode=0o700)
    media = []
    if media_root.exists():
        for path in media_root.iterdir():
            if path.is_file() and not path.is_symlink():
                destination = media_copy / path.name
                shutil.copy2(path, destination)
                destination.chmod(0o600)
                media.append(
                    {"file": path.name, "sha256": hashlib.sha256(destination.read_bytes()).hexdigest()}
                )
    (folder / "manifest.json").write_text(
        json.dumps(
            {
                "createdAt": stamp,
                "schema": schema,
                "tableCounts": counts,
                "media": media,
                "databaseSha256": hashlib.sha256((folder / "database.dump").read_bytes()).hexdigest(),
            },
            indent=2,
        )
        + "\n"
    )
    (folder / "manifest.json").chmod(0o600)
    return folder
