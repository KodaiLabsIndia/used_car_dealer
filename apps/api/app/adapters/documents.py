import hashlib
import json
from pathlib import Path
from uuid import UUID, uuid4

from sqlalchemy import text
from sqlalchemy.exc import IntegrityError

from app.adapters.media import inspect_photo
from app.adapters.operations import rows
from app.adapters.workflows import WorkflowStore
from app.contracts import Actor
from app.document_contracts import Document, Documents, DocumentUpload, ReviewDocument
from app.domain.errors import BusinessError
from app.domain.workshop_policy import require_owner

SELECT_DOCUMENT = """SELECT d.recorded_by AS recorded_by_id,d.id,d.cycle_id AS car_id,d.category,d.title,d.reference,d.job_id,d.booking_id,d.supersedes_id,
    d.width,d.height,d.bytes,d.sha256,d.profile,u.name AS recorded_by_name,d.created_at,
    COALESCE(r.decision,'uploaded') AS status,CASE WHEN r.document_id IS NULL THEN 1 ELSE 2 END AS version,
    reviewer.name AS reviewed_by_name,r.created_at AS reviewed_at,COALESCE(r.reason,'') AS review_reason,
    COALESCE(r.recorded_by=d.recorded_by,false) AS self_review
    FROM documents d JOIN users u ON u.id=d.recorded_by AND u.company_id=d.company_id
    LEFT JOIN document_reviews r ON r.document_id=d.id AND r.company_id=d.company_id
    LEFT JOIN users reviewer ON reviewer.id=r.recorded_by AND reviewer.company_id=r.company_id"""


class DocumentStore:
    def __init__(self, workflows: WorkflowStore, root: Path):
        self.workflows, self.engine, self.root = workflows, workflows.engine, root

    def get(self, actor: Actor, id: UUID, conn=None):
        require_owner(actor)
        if conn is None:
            with self.engine.connect() as connection:
                return self.get(actor, id, connection)
        result = rows(
            conn,
            SELECT_DOCUMENT + " WHERE d.id=:id AND d.company_id=:company",
            {"id": id, "company": actor.company_id},
        )
        if not result:
            raise BusinessError("NOT_FOUND", "This document is unavailable.", 404)
        return Document.model_validate(result[0])

    def list(self, actor: Actor, car_id: UUID, limit=30, offset=0):
        require_owner(actor)
        with self.engine.connect() as conn:
            car = self.workflows.ops.car(actor, car_id, conn)
            items = rows(
                conn,
                SELECT_DOCUMENT
                + " WHERE d.cycle_id=:car AND d.company_id=:company ORDER BY d.created_at DESC,d.id DESC LIMIT :limit OFFSET :offset",
                {"car": car_id, "company": actor.company_id, "limit": limit, "offset": offset},
            )
            return Documents(car=car, items=items, limit=limit, offset=offset)

    def file(self, actor: Actor, id: UUID):
        document = self.get(actor, id)
        with self.engine.connect() as conn:
            key = conn.execute(
                text("SELECT storage_key FROM documents WHERE id=:id AND company_id=:company"),
                {"id": id, "company": actor.company_id},
            ).scalar_one()
        path = (self.root / key).resolve()
        if path.parent != self.root.resolve() or not path.is_file():
            raise BusinessError(
                "MEDIA_MISSING", "This page is unavailable. Ask the owner to check storage.", 404
            )
        return document, path

    def save(self, actor: Actor, car_id: UUID, id: UUID, body: DocumentUpload, data: bytes):
        require_owner(actor)
        metadata = inspect_photo(data)
        if not body.title.strip():
            raise BusinessError("TITLE_REQUIRED", "Give this page a short title.")
        fingerprint = hashlib.sha256(
            json.dumps(
                {"car": str(car_id), "metadata": body.model_dump(mode="json"), "sha256": metadata["sha256"]},
                sort_keys=True,
            ).encode()
        ).hexdigest()
        key = str(uuid4()) + ".jpg"
        path = self.root / key
        try:
            with self.engine.begin() as conn:
                self.workflows.lock_car(conn, actor, car_id)
                prior = rows(
                    conn,
                    "SELECT fingerprint FROM documents WHERE id=:id AND company_id=:company",
                    {"id": id, "company": actor.company_id},
                )
                if prior:
                    if prior[0]["fingerprint"] != fingerprint:
                        raise BusinessError(
                            "IDEMPOTENCY_CONFLICT",
                            "This page reference was already used for another upload.",
                            409,
                        )
                    return self.get(actor, id, conn)
                p = {"company": actor.company_id, "car": car_id, "id": id, "actor": actor.id}
                for field, table in [
                    ("job_id", "repair_jobs"),
                    ("booking_id", "sale_bookings"),
                    ("supersedes_id", "documents"),
                ]:
                    target = getattr(body, field)
                    if target and not rows(
                        conn,
                        f"SELECT id FROM {table} WHERE id=:target AND company_id=:company AND cycle_id=:car",
                        p | {"target": target},
                    ):
                        raise BusinessError(
                            "NOT_FOUND", "The linked record is unavailable for this car.", 404
                        )
                self.root.mkdir(parents=True, exist_ok=True, mode=0o700)
                with path.open("xb") as file:
                    file.write(data)
                path.chmod(0o600)
                conn.execute(
                    text("""INSERT INTO documents(id,company_id,cycle_id,category,title,reference,job_id,booking_id,supersedes_id,storage_key,width,height,bytes,sha256,profile,fingerprint,recorded_by)
                    VALUES(:id,:company,:car,:category,:title,:reference,:job,:booking,:supersedes,:key,:width,:height,:bytes,:sha256,'photo-fhd-v1',:fingerprint,:actor)"""),
                    p
                    | metadata
                    | {
                        "category": body.category,
                        "title": body.title.strip(),
                        "reference": body.reference.strip(),
                        "job": body.job_id,
                        "booking": body.booking_id,
                        "supersedes": body.supersedes_id,
                        "key": key,
                        "fingerprint": fingerprint,
                    },
                )
                conn.execute(
                    text(
                        "UPDATE stock_cycles SET version=version+1,updated_at=now() WHERE id=:car AND company_id=:company"
                    ),
                    p,
                )
                self.workflows.event(
                    conn,
                    actor,
                    car_id,
                    "document.uploaded",
                    "Document page received; review still required",
                    documentId=str(id),
                    category=body.category,
                    sha256=metadata["sha256"],
                )
                return self.get(actor, id, conn)
        except IntegrityError as error:
            path.unlink(missing_ok=True)
            raise BusinessError(
                "DOCUMENT_CONFLICT", "This page reference is unavailable. Retake the page.", 409
            ) from error
        except Exception:
            path.unlink(missing_ok=True)
            raise

    def review(self, actor: Actor, id: UUID, body: ReviewDocument):
        require_owner(actor)

        def authorize(conn):
            document = self.get(actor, id, conn)
            self.workflows.lock_car(conn, actor, document.car_id)

        def execute(conn):
            document = self.get(actor, id, conn)
            if body.expected_version != document.version or document.status != "uploaded":
                raise BusinessError(
                    "VERSION_CONFLICT",
                    "This page was already reviewed. Upload a replacement for changed information.",
                    409,
                )
            if len(body.reason.strip()) < 3:
                raise BusinessError("REASON_REQUIRED", "Record the review reason.")
            if body.decision == "accepted" and not body.original_checked:
                raise BusinessError(
                    "ORIGINAL_CHECK_REQUIRED",
                    "Confirm the page was checked against the original information.",
                )
            conn.execute(
                text(
                    "INSERT INTO document_reviews(document_id,company_id,decision,reason,recorded_by) VALUES(:id,:company,:decision,:reason,:actor)"
                ),
                {
                    "id": id,
                    "company": actor.company_id,
                    "decision": body.decision,
                    "reason": body.reason.strip(),
                    "actor": actor.id,
                },
            )
            conn.execute(
                text(
                    "UPDATE stock_cycles SET version=version+1,updated_at=now() WHERE id=:id AND company_id=:company"
                ),
                {"id": document.car_id, "company": actor.company_id},
            )
            self.workflows.event(
                conn,
                actor,
                document.car_id,
                "document.reviewed",
                "Document page reviewed",
                documentId=str(id),
                decision=body.decision,
                selfReview=document.recorded_by_id == actor.id,
            )
            return self.get(actor, id, conn)

        return self.workflows.commands.run(
            actor, body.command_id, f"document:{id}:review", body, Document, execute, authorize
        )
