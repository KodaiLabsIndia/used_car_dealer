import hashlib
import json
import secrets
from datetime import UTC, datetime, timedelta
from uuid import UUID, uuid4

from sqlalchemy import text
from sqlalchemy.exc import IntegrityError

from app.adapters.operations import OperationsStore, rows
from app.adapters.passwords import hash_secret, verify_secret
from app.contracts import Actor, Session
from app.domain.errors import BusinessError
from app.domain.workshop_policy import require_owner
from app.identity_contracts import (
    ChangeSecret,
    CreateStaff,
    LoginInput,
    Member,
    SetupOwnLogin,
    Team,
    TeamCommand,
)


class IdentityStore:
    def __init__(self, ops: OperationsStore):
        self.ops = ops
        self.engine = ops.engine
        self.dummy_hash = hash_secret(secrets.token_hex(20))

    def session(self, conn, actor: Actor, must_change=False) -> Session:
        token = secrets.token_urlsafe(32)
        expires = datetime.now(UTC) + timedelta(hours=12)
        conn.execute(
            text("INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(:token,:user,:expires)"),
            {"token": hashlib.sha256(token.encode()).hexdigest(), "user": actor.id, "expires": expires},
        )
        return Session(
            token=token,
            expires_at=expires,
            actor=actor,
            must_change_secret=must_change,
            authentication="password",
        )

    def login(self, body: LoginInput, client: str) -> Session:
        now = datetime.now(UTC)
        user_bucket = hashlib.sha256(
            f"user:{body.dealer_code.strip().lower()}:{body.username.strip().lower()}".encode()
        ).hexdigest()
        ip_bucket = hashlib.sha256(f"client:{client}".encode()).hexdigest()
        result = None
        error = BusinessError("UNAUTHORIZED", "Check your dealer code, username and password.", 401)
        with self.engine.begin() as conn:
            for key in sorted((user_bucket, ip_bucket)):
                conn.execute(text("SELECT pg_advisory_xact_lock(hashtextextended(:key,0))"), {"key": key})
            attempts = rows(
                conn,
                "SELECT * FROM login_attempts WHERE bucket IN (:user,:ip)",
                {"user": user_bucket, "ip": ip_bucket},
            )
            blocked = any(a["blocked_until"] and a["blocked_until"] > now for a in attempts)
            if blocked:
                error = BusinessError(
                    "RATE_LIMIT", "Too many attempts. Wait 15 minutes or ask the owner for help.", 429
                )
            else:
                accounts = rows(
                    conn,
                    """SELECT u.id,u.company_id,u.name,u.role,u.work_roles,u.active,c.secret_hash,c.must_change_secret
                    FROM user_credentials c JOIN users u ON u.id=c.user_id AND u.company_id=c.company_id
                    JOIN companies co ON co.id=u.company_id
                    WHERE lower(co.access_code)=:dealer AND lower(c.login_name)=:login""",
                    {"dealer": body.dealer_code.strip().lower(), "login": body.username.strip().lower()},
                )
                account = accounts[0] if accounts else None
                verified = verify_secret(body.secret, account["secret_hash"] if account else self.dummy_hash)
                if account and account["active"] and verified:
                    actor = Actor(
                        id=account["id"],
                        company_id=account["company_id"],
                        name=account["name"],
                        work_roles=account["work_roles"],
                        role=account["role"],
                    )
                    result = self.session(conn, actor, account["must_change_secret"])
                    conn.execute(text("DELETE FROM login_attempts WHERE bucket=:key"), {"key": user_bucket})
                else:
                    for key, limit in ((user_bucket, 8), (ip_bucket, 50)):
                        prior = next((a for a in attempts if a["bucket"] == key), None)
                        fresh = not prior or prior["started_at"] + timedelta(minutes=15) <= now
                        count = 1 if fresh else prior["failures"] + 1
                        conn.execute(
                            text("""INSERT INTO login_attempts(bucket,failures,started_at,blocked_until) VALUES(:key,:count,:start,:blocked)
                            ON CONFLICT(bucket) DO UPDATE SET failures=excluded.failures,started_at=excluded.started_at,blocked_until=excluded.blocked_until"""),
                            {
                                "key": key,
                                "count": count,
                                "start": now if fresh else prior["started_at"],
                                "blocked": now + timedelta(minutes=15) if count >= limit else None,
                            },
                        )
        if result:
            return result
        raise error

    def must_change(self, actor: Actor) -> bool:
        with self.engine.connect() as conn:
            return bool(
                conn.execute(
                    text(
                        "SELECT must_change_secret FROM user_credentials WHERE user_id=:user AND company_id=:company"
                    ),
                    {"user": actor.id, "company": actor.company_id},
                ).scalar()
            )

    def member(self, conn, actor: Actor, user_id: UUID) -> Member:
        records = rows(
            conn,
            """SELECT u.id,u.name,u.role,u.work_roles,u.active,u.version,c.login_name AS username,
            COALESCE(c.must_change_secret,false) AS must_change_secret FROM users u
            LEFT JOIN user_credentials c ON c.user_id=u.id AND c.company_id=u.company_id
            WHERE u.id=:id AND u.company_id=:company""",
            {"id": user_id, "company": actor.company_id},
        )
        if not records:
            raise BusinessError("NOT_FOUND", "This person is unavailable.", 404)
        return Member.model_validate(records[0])

    def team(self, actor: Actor) -> Team:
        require_owner(actor)
        with self.engine.connect() as conn:
            code = conn.execute(
                text("SELECT access_code FROM companies WHERE id=:company"), {"company": actor.company_id}
            ).scalar_one()
            ids = rows(
                conn,
                "SELECT id FROM users WHERE company_id=:company ORDER BY active DESC,role DESC,name,id",
                {"company": actor.company_id},
            )
            return Team(dealer_code=code, items=[self.member(conn, actor, r["id"]) for r in ids])

    def command(
        self, actor: Actor, body: CreateStaff | TeamCommand | SetupOwnLogin, user_id: UUID | None = None
    ) -> Member:
        require_owner(actor)
        secret = getattr(body, "temporary_secret", getattr(body, "secret", None))
        if secret is not None and (len(secret.strip()) < (12 if isinstance(body, SetupOwnLogin) else 8)):
            raise BusinessError(
                "WEAK_SECRET", "Use at least 12 characters for the owner, or 8 for staff.", 400
            )
        public = body.model_dump(mode="json", exclude={"temporary_secret", "secret"}) | {
            "userId": str(user_id) if user_id else None
        }
        fingerprint = hashlib.sha256(json.dumps(public, sort_keys=True).encode()).hexdigest()
        try:
            with self.engine.begin() as conn:
                conn.execute(
                    text("SELECT id FROM companies WHERE id=:company FOR UPDATE"),
                    {"company": actor.company_id},
                )
                prior = rows(
                    conn,
                    "SELECT * FROM identity_commands WHERE actor_id=:actor AND command_id=:command",
                    {"actor": actor.id, "command": body.command_id},
                )
                if prior:
                    old = prior[0]
                    if (
                        old["public_fingerprint"] != fingerprint
                        or (secret is None) != (old["secret_hash"] is None)
                        or (secret is not None and not verify_secret(secret, old["secret_hash"]))
                    ):
                        raise BusinessError(
                            "IDEMPOTENCY_CONFLICT",
                            "This action reference was already used. Refresh before making another change.",
                            409,
                        )
                    return Member.model_validate(old["response"])
                secret_hash = hash_secret(secret) if secret is not None else None
                if isinstance(body, CreateStaff):
                    if not body.name.strip():
                        raise BusinessError("NAME_REQUIRED", "Enter the person's name.", 400)
                    target = uuid4()
                    conn.execute(
                        text(
                            "INSERT INTO users(id,company_id,name,role,work_roles) VALUES(:id,:company,:name,'employee',:roles)"
                        ),
                        {
                            "id": target,
                            "company": actor.company_id,
                            "name": body.name.strip(),
                            "roles": sorted(set(body.work_roles)),
                        },
                    )
                    conn.execute(
                        text(
                            "INSERT INTO user_credentials(user_id,company_id,login_name,secret_hash,must_change_secret) VALUES(:id,:company,:login,:hash,true)"
                        ),
                        {
                            "id": target,
                            "company": actor.company_id,
                            "login": body.username.lower(),
                            "hash": secret_hash,
                        },
                    )
                    action = "team.created"
                elif isinstance(body, SetupOwnLogin):
                    target = actor.id
                    if rows(conn, "SELECT user_id FROM user_credentials WHERE user_id=:id", {"id": target}):
                        raise BusinessError(
                            "LOGIN_EXISTS", "Your login is already set. Use Change password instead.", 409
                        )
                    conn.execute(
                        text(
                            "INSERT INTO user_credentials(user_id,company_id,login_name,secret_hash,must_change_secret) VALUES(:id,:company,:login,:hash,false)"
                        ),
                        {
                            "id": target,
                            "company": actor.company_id,
                            "login": body.username.lower(),
                            "hash": secret_hash,
                        },
                    )
                    action = "team.owner_login"
                else:
                    target = user_id
                    member = self.member(conn, actor, target)
                    if member.version != body.expected_version:
                        raise BusinessError("VERSION_CONFLICT", "This person changed. Refresh first.", 409)
                    if member.role == "owner":
                        raise BusinessError(
                            "OWNER_ACCOUNT",
                            "Owner account recovery is handled separately. Use Change password for your own login.",
                            409,
                        )
                    if body.action == "profile":
                        if not body.name.strip():
                            raise BusinessError("NAME_REQUIRED", "Enter the person's name.", 400)
                        conn.execute(
                            text(
                                "UPDATE users SET name=:name,active=:active,work_roles=:roles,version=version+1 WHERE id=:id AND company_id=:company"
                            ),
                            {
                                "id": target,
                                "company": actor.company_id,
                                "name": body.name.strip(),
                                "active": body.active,
                                "roles": sorted(
                                    set(body.work_roles if body.work_roles is not None else member.work_roles)
                                ),
                            },
                        )
                        action = "team.updated"
                    else:
                        updated = conn.execute(
                            text(
                                "UPDATE user_credentials SET secret_hash=:hash,must_change_secret=true,updated_at=now() WHERE user_id=:id AND company_id=:company"
                            ),
                            {"id": target, "company": actor.company_id, "hash": secret_hash},
                        ).rowcount
                        if not updated:
                            raise BusinessError(
                                "LOGIN_NOT_SET",
                                "This training account has no individual login. Create an individual staff account.",
                                409,
                            )
                        conn.execute(
                            text("UPDATE users SET version=version+1 WHERE id=:id AND company_id=:company"),
                            {"id": target, "company": actor.company_id},
                        )
                        action = "team.secret_reset"
                    conn.execute(text("DELETE FROM sessions WHERE user_id=:id"), {"id": target})
                result = self.member(conn, actor, target)
                self.ops.audit(
                    conn,
                    actor,
                    target,
                    action,
                    {
                        "name": result.name,
                        "username": result.username,
                        "active": result.active,
                        "summary": "Individual account updated",
                    },
                )
                conn.execute(
                    text(
                        "INSERT INTO identity_commands(actor_id,command_id,public_fingerprint,secret_hash,response) VALUES(:actor,:command,:fingerprint,:hash,CAST(:response AS jsonb))"
                    ),
                    {
                        "actor": actor.id,
                        "command": body.command_id,
                        "fingerprint": fingerprint,
                        "hash": secret_hash,
                        "response": result.model_dump_json(by_alias=True),
                    },
                )
                return result
        except IntegrityError as error:
            if "credential_login" in (
                getattr(getattr(error.orig, "diag", None), "constraint_name", "") or ""
            ):
                raise BusinessError(
                    "USERNAME_EXISTS", "That username is already used in this dealership.", 409
                ) from error
            raise

    def change_secret(self, actor: Actor, body: ChangeSecret) -> Session:
        minimum = 12 if actor.role == "owner" else 8
        if len(body.new_secret.strip()) < minimum:
            raise BusinessError("WEAK_SECRET", f"Use at least {minimum} characters.", 400)
        if body.new_secret == body.current_secret:
            raise BusinessError("NEW_SECRET_REQUIRED", "Choose a new password.", 400)
        with self.engine.begin() as conn:
            credentials = rows(
                conn,
                "SELECT * FROM user_credentials WHERE user_id=:id AND company_id=:company FOR UPDATE",
                {"id": actor.id, "company": actor.company_id},
            )
            if not credentials or not verify_secret(body.current_secret, credentials[0]["secret_hash"]):
                raise BusinessError("CURRENT_SECRET_INVALID", "Check your current password.", 400)
            conn.execute(
                text(
                    "UPDATE user_credentials SET secret_hash=:hash,must_change_secret=false,updated_at=now() WHERE user_id=:id AND company_id=:company"
                ),
                {"id": actor.id, "company": actor.company_id, "hash": hash_secret(body.new_secret)},
            )
            conn.execute(text("DELETE FROM sessions WHERE user_id=:id"), {"id": actor.id})
            self.ops.audit(
                conn,
                actor,
                actor.id,
                "identity.secret_changed",
                {"summary": "Password changed; other sessions revoked"},
            )
            return self.session(conn, actor)
