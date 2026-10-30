"""Explicit operator-assisted dealership setup. Passwords are entered privately."""

import argparse
import getpass
import re
from uuid import uuid4

from sqlalchemy import text
from sqlalchemy.engine import Engine

from app.adapters.database import create_database
from app.adapters.operations import OperationsStore
from app.adapters.passwords import hash_secret
from app.config import Settings
from app.contracts import Actor


def bootstrap_owner(
    engine: Engine, company_name: str, dealer_code: str, name: str, username: str, secret: str
) -> Actor:
    if not re.fullmatch(r"[a-z0-9-]{3,50}", dealer_code) or not re.fullmatch(
        r"[a-zA-Z0-9._-]{2,40}", username
    ):
        raise ValueError("Choose a lowercase dealer code and a valid username.")
    if not company_name.strip() or not name.strip() or len(secret.strip()) < 12:
        raise ValueError("Company/name are required; owner passwords need at least 12 characters.")
    company, user = uuid4(), uuid4()
    with engine.begin() as conn:
        conn.execute(
            text("INSERT INTO companies(id,name,access_code) VALUES(:id,:name,:code)"),
            {"id": company, "name": company_name.strip(), "code": dealer_code},
        )
        conn.execute(
            text("INSERT INTO users(id,company_id,name,role) VALUES(:id,:company,:name,'owner')"),
            {"id": user, "company": company, "name": name.strip()},
        )
        conn.execute(
            text(
                "INSERT INTO user_credentials(user_id,company_id,login_name,secret_hash,must_change_secret) VALUES(:id,:company,:login,:hash,false)"
            ),
            {"id": user, "company": company, "login": username.lower(), "hash": hash_secret(secret)},
        )
        actor = Actor(id=user, company_id=company, name=name.strip(), role="owner")
        OperationsStore(engine).audit(
            conn,
            actor,
            user,
            "identity.owner_bootstrapped",
            {"summary": "Dealership owner initialized by operator", "dealerCode": dealer_code},
        )
    return actor


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dealer-code", required=True)
    parser.add_argument("--company-name", required=True)
    parser.add_argument("--owner-name", required=True)
    parser.add_argument("--username", required=True)
    args = parser.parse_args()
    settings = Settings()
    settings.validate_runtime()
    password = getpass.getpass("Owner password (12+ characters): ")
    if password != getpass.getpass("Repeat owner password: "):
        raise SystemExit("Passwords do not match.")
    engine = create_database(settings.sqlalchemy_url)
    try:
        bootstrap_owner(engine, args.company_name, args.dealer_code, args.owner_name, args.username, password)
        print("Dealership and owner login created. No training records were added.")
    finally:
        engine.dispose()


if __name__ == "__main__":
    main()
