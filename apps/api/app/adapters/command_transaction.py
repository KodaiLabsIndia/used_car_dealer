import hashlib
import json
from collections.abc import Callable
from uuid import UUID

from sqlalchemy import text
from sqlalchemy.engine import Connection, Engine

from app.contracts import Actor, Contract
from app.domain.errors import BusinessError


class CommandTransaction:
    def __init__(self, engine: Engine):
        self.engine = engine

    def run(
        self,
        actor: Actor,
        command_id: UUID,
        operation: str,
        payload: Contract,
        result_type: type[Contract],
        execute: Callable[[Connection], Contract],
        authorize: Callable[[Connection], None] | None = None,
    ):
        fingerprint = hashlib.sha256(
            json.dumps(
                {
                    "operation": operation,
                    "payload": payload.model_dump(mode="json"),
                },
                sort_keys=True,
            ).encode()
        ).hexdigest()
        with self.engine.begin() as conn:
            conn.execute(
                text("SELECT pg_advisory_xact_lock(hashtextextended(:key,0))"),
                {"key": f"{actor.id}:{command_id}"},
            )
            if authorize:
                authorize(conn)
            prior = (
                conn.execute(
                    text(
                        "SELECT fingerprint,response FROM command_receipts WHERE actor_id=:actor AND command_id=:command"
                    ),
                    {"actor": actor.id, "command": command_id},
                )
                .mappings()
                .first()
            )
            if prior:
                if prior["fingerprint"] != fingerprint:
                    raise BusinessError(
                        "IDEMPOTENCY_CONFLICT", "That action reference was already used.", 409
                    )
                return result_type.model_validate(prior["response"])
            result = execute(conn)
            conn.execute(
                text(
                    "INSERT INTO command_receipts(actor_id,command_id,fingerprint,response) VALUES(:actor,:command,:fingerprint,CAST(:response AS jsonb))"
                ),
                {
                    "actor": actor.id,
                    "command": command_id,
                    "fingerprint": fingerprint,
                    "response": result.model_dump_json(by_alias=True),
                },
            )
            return result
