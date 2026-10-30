import hashlib
import json
from uuid import UUID, uuid4

from sqlalchemy import text

from app.adapters.operations import rows
from app.application.assistant import AssistantJob
from app.assistant_contracts import AIContent, AssistantDraft, AssistantInput, ReviewAssistant
from app.contracts import Actor
from app.domain.assistant_policy import PROMPT_VERSION, authorize_assistant
from app.domain.errors import BusinessError


class AssistantStore:
    def __init__(self, context, settings):
        self.context, self.settings = context, settings
        self.engine = context.workflows.engine

    def reserve(self, actor: Actor, body: AssistantInput):
        authorize_assistant(actor, body)
        if not self.settings.ai_enabled:
            raise BusinessError(
                "AI_UNAVAILABLE", "The assistant is unavailable. Use the normal workflow.", 503
            )
        fingerprint = hashlib.sha256(body.model_dump_json(by_alias=True).encode()).hexdigest()
        bundle = self.context.build(actor, body)
        with self.engine.begin() as conn:
            conn.execute(
                text("SELECT pg_advisory_xact_lock(hashtextextended(:key,0))"),
                {"key": "ai:" + str(actor.company_id)},
            )
            prior = rows(
                conn,
                "SELECT id,fingerprint FROM ai_runs WHERE company_id=:company AND actor_id=:actor AND command_id=:command",
                {"company": actor.company_id, "actor": actor.id, "command": body.command_id},
            )
            if prior:
                if prior[0]["fingerprint"] != fingerprint:
                    raise BusinessError(
                        "IDEMPOTENCY_CONFLICT", "This assistant request reference was already used.", 409
                    )
                id = prior[0]["id"]
            else:
                count = conn.execute(
                    text(
                        "SELECT count(*) FROM ai_runs WHERE company_id=:company AND created_at>=date_trunc('day',now())"
                    ),
                    {"company": actor.company_id},
                ).scalar_one()
                recent = conn.execute(
                    text(
                        "SELECT count(*) FROM ai_runs WHERE company_id=:company AND actor_id=:actor AND created_at>=now()-interval '1 minute'"
                    ),
                    {"company": actor.company_id, "actor": actor.id},
                ).scalar_one()
                queued = conn.execute(
                    text(
                        "SELECT count(*) FROM ai_runs WHERE company_id=:company AND status IN ('queued','running')"
                    ),
                    {"company": actor.company_id},
                ).scalar_one()
                if count >= self.settings.ai_requests_per_day:
                    raise BusinessError(
                        "AI_DAILY_LIMIT",
                        "The daily assistant limit is reached. Normal work can continue.",
                        429,
                    )
                if recent >= 5 or queued >= 5:
                    raise BusinessError(
                        "AI_BUSY", "The assistant has several drafts to prepare. Try again shortly.", 429
                    )
                id = uuid4()
                conn.execute(
                    text("""INSERT INTO ai_runs(id,company_id,actor_id,command_id,fingerprint,request,source_hash,sources,cutoff,prompt_version,model)
                    VALUES(:id,:company,:actor,:command,:fingerprint,CAST(:request AS jsonb),:hash,CAST(:sources AS jsonb),:cutoff,:prompt,:model)"""),
                    {
                        "id": id,
                        "company": actor.company_id,
                        "actor": actor.id,
                        "command": body.command_id,
                        "fingerprint": fingerprint,
                        "request": body.model_dump_json(by_alias=True),
                        "hash": bundle.source_hash,
                        "sources": json.dumps(
                            [s.model_dump(mode="json", by_alias=True) for s in bundle.sources]
                        ),
                        "cutoff": bundle.cutoff,
                        "prompt": PROMPT_VERSION,
                        "model": self.settings.ai_model,
                    },
                )
                self.context.workflows.ops.audit(
                    conn,
                    actor,
                    body.car_id or actor.id,
                    "assistant.requested",
                    {
                        "runId": str(id),
                        "capability": body.capability,
                        "sourceHash": bundle.source_hash,
                        "promptVersion": PROMPT_VERSION,
                    },
                )
        return self.get(actor, id)

    def record(self, actor, id, conn):
        data = rows(
            conn,
            "SELECT r.*,v.decision AS review FROM ai_runs r LEFT JOIN ai_reviews v ON v.run_id=r.id AND v.company_id=r.company_id WHERE r.id=:id AND r.company_id=:company AND (:owner OR r.actor_id=:actor)",
            {"id": id, "company": actor.company_id, "owner": actor.role == "owner", "actor": actor.id},
        )
        if not data:
            raise BusinessError("NOT_FOUND", "This assistant draft is unavailable.", 404)
        return data[0]

    def get(self, actor: Actor, id: UUID):
        with self.engine.connect() as conn:
            row = self.record(actor, id, conn)
        body = AssistantInput.model_validate(row["request"])
        # Source permissions are checked again every time a saved draft is opened.
        bundle = self.context.build(actor, body)
        return AssistantDraft(
            id=id,
            capability=body.capability,
            status=row["status"],
            content=AIContent.model_validate(row["response"]) if row["response"] else None,
            sources=row["sources"],
            cutoff=row["cutoff"],
            source_hash=row["source_hash"],
            stale=bundle.source_hash != row["source_hash"] or row["status"] == "stale",
            review=row["review"],
            error_code=row["error_code"],
            model=row["model"],
            prompt_version=row["prompt_version"],
            input_tokens=row["input_tokens"],
            output_tokens=row["output_tokens"],
        )

    def review(self, actor: Actor, id: UUID, body: ReviewAssistant):
        current = self.get(actor, id)
        if current.status != "completed":
            raise BusinessError("AI_NOT_READY", "Wait for the draft to finish.", 409)
        if body.decision == "accepted" and (current.stale or not body.human_reviewed):
            raise BusinessError(
                "AI_REVIEW_REQUIRED", "Review current sources and confirm the draft before accepting it.", 409
            )
        with self.engine.begin() as conn:
            # Serialize reviews without holding a model-generation transaction.
            conn.execute(
                text("SELECT id FROM ai_runs WHERE id=:id AND company_id=:company FOR UPDATE"),
                {"id": id, "company": actor.company_id},
            )
            prior = rows(
                conn,
                "SELECT decision,note,actor_id FROM ai_reviews WHERE run_id=:id AND company_id=:company",
                {"id": id, "company": actor.company_id},
            )
            if prior:
                if (
                    prior[0]["decision"] != body.decision
                    or prior[0]["note"] != body.note
                    or prior[0]["actor_id"] != actor.id
                ):
                    raise BusinessError("AI_ALREADY_REVIEWED", "This draft was already reviewed.", 409)
            else:
                conn.execute(
                    text(
                        "INSERT INTO ai_reviews(run_id,company_id,actor_id,decision,note) VALUES(:id,:company,:actor,:decision,:note)"
                    ),
                    {
                        "id": id,
                        "company": actor.company_id,
                        "actor": actor.id,
                        "decision": body.decision,
                        "note": body.note,
                    },
                )
                self.context.workflows.ops.audit(
                    conn,
                    actor,
                    id,
                    "assistant.reviewed",
                    {"runId": str(id), "decision": body.decision, "sourceHash": current.source_hash},
                )
        return self.get(actor, id)

    def claim(self):
        if not self.settings.ai_enabled:
            return None
        with self.engine.begin() as conn:
            conn.execute(
                text(
                    "UPDATE ai_runs SET status='failed',error_code='INTERRUPTED',completed_at=now() WHERE status='running' AND lease_until<now()"
                )
            )
            conn.execute(text("SELECT pg_advisory_xact_lock(415210014)"))
            if conn.execute(text("SELECT count(*) FROM ai_runs WHERE status='running'")).scalar_one():
                return None
            runs = rows(
                conn,
                "SELECT * FROM ai_runs WHERE status='queued' ORDER BY created_at,id LIMIT 1 FOR UPDATE SKIP LOCKED",
            )
            if not runs:
                return None
            run = runs[0]
            users = rows(
                conn,
                "SELECT id,company_id,name,role,work_roles FROM users WHERE id=:actor AND company_id=:company AND active=true",
                {"actor": run["actor_id"], "company": run["company_id"]},
            )
            if not users:
                conn.execute(
                    text(
                        "UPDATE ai_runs SET status='failed',error_code='ACCESS_CHANGED',completed_at=now() WHERE id=:id"
                    ),
                    {"id": run["id"]},
                )
                return None
            conn.execute(
                text(
                    "UPDATE ai_runs SET status='running',lease_until=now()+interval '2 minutes' WHERE id=:id"
                ),
                {"id": run["id"]},
            )
            return AssistantJob(
                run["id"],
                Actor.model_validate(users[0]),
                AssistantInput.model_validate(run["request"]),
                run["source_hash"],
                run["model"],
            )

    def complete(self, id, result):
        with self.engine.begin() as conn:
            conn.execute(
                text(
                    "UPDATE ai_runs SET status='completed',response=CAST(:response AS jsonb),input_tokens=:input,output_tokens=:output,completed_at=now(),lease_until=NULL WHERE id=:id AND status='running'"
                ),
                {
                    "id": id,
                    "response": result.content.model_dump_json(by_alias=True),
                    "input": result.input_tokens,
                    "output": result.output_tokens,
                },
            )

    def fail(self, id, code, stale=False):
        with self.engine.begin() as conn:
            conn.execute(
                text(
                    "UPDATE ai_runs SET status=:status,error_code=:code,completed_at=now(),lease_until=NULL WHERE id=:id AND status='running'"
                ),
                {"id": id, "status": "stale" if stale else "failed", "code": code},
            )
