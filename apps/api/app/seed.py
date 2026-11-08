"""Reusable local demo: explicit replacement, configurable dates, real media profiles."""

import argparse
import json
import secrets
from datetime import datetime
from pathlib import Path

from sqlalchemy import text

from app.adapters.catalogue import import_catalogue
from app.adapters.database import create_database
from app.config import ROOT, Settings
from app.demo.backup import backup_local
from app.demo.core import CONFIG, IST, DemoConfig
from app.demo.ingest import require_demo_only, seed_demo


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--as-of",
        type=lambda value: datetime.strptime(value, "%Y-%m-%d").date(),
        default=datetime.now(IST).date(),
        help="Business date in Asia/Kolkata; default: today. Does not change the API clock.",
    )
    parser.add_argument("--config", type=Path, default=CONFIG, help="Editable demo scenario JSON")
    parser.add_argument(
        "--reset",
        action="store_true",
        help="Back up and replace the existing local demo. Run with API/worker stopped.",
    )
    args = parser.parse_args()
    settings = Settings()
    settings.validate_runtime()
    if settings.node_env not in ("development", "test") or not settings.dev_auth_enabled:
        raise SystemExit(
            "Demo seeding requires a development/test workspace with development sign-in enabled."
        )
    engine = create_database(settings.sqlalchemy_url)
    if engine.url.host not in ("127.0.0.1", "localhost", "::1"):
        raise SystemExit("Use a separate local database for demo ingestion.")
    directory = ROOT / ".data/demo"
    directory.mkdir(parents=True, exist_ok=True, mode=0o700)
    account_file = directory / "accounts.json"
    password = (
        json.loads(account_file.read_text())["password"]
        if account_file.exists()
        else secrets.token_urlsafe(20)
    )
    config = DemoConfig.load(args.config)
    try:
        with engine.connect() as conn:
            companies = require_demo_only(conn)
            catalogue = conn.execute(text("SELECT count(*) FROM vehicle_catalogue_models")).scalar_one()
        backup = None
        if args.reset and companies:
            backup = backup_local(engine, settings.media_path)
            print("Private pre-reset backup: " + str(backup.relative_to(ROOT)))
        if not catalogue:
            import_catalogue(engine)
        result = seed_demo(engine, settings.media_path, args.as_of, config, password, reset=args.reset)
        if not result["unchanged"]:
            account_file.write_text(
                json.dumps(
                    {
                        "dealerCode": config.dealer_code,
                        "password": password,
                        "accounts": [{"username": p.username, "name": p.name} for p in config.staff],
                    },
                    indent=2,
                )
                + "\n"
            )
            account_file.chmod(0o600)
        (directory / "manifest.json").write_text(json.dumps(result, indent=2) + "\n")
        (directory / "manifest.json").chmod(0o600)
        print(
            json.dumps(
                {
                    "asOf": result["asOf"],
                    "unchanged": result["unchanged"],
                    "counts": result["counts"],
                    "manifest": ".data/demo/manifest.json",
                    "accounts": ".data/demo/accounts.json",
                },
                indent=2,
            )
        )
    finally:
        engine.dispose()


if __name__ == "__main__":
    main()
