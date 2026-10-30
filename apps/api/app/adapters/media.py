import hashlib
import io
import warnings
from pathlib import Path
from uuid import UUID, uuid4

from PIL import Image

from app.adapters.operations import OperationsStore
from app.contracts import MAX_PHOTO_BYTES, Actor, Evidence
from app.domain.errors import BusinessError
from app.domain.task_policy import normalized_photo_size


def inspect_photo(data: bytes) -> dict:
    if not data or len(data) > MAX_PHOTO_BYTES:
        raise BusinessError("INVALID_MEDIA", "This photo is too large. Take a new photo.")
    try:
        with warnings.catch_warnings():
            warnings.simplefilter("error", Image.DecompressionBombWarning)
            with Image.open(io.BytesIO(data)) as image:
                width, height = image.size
                if (
                    image.format != "JPEG"
                    or image.mode != "RGB"
                    or normalized_photo_size(width, height) != image.size
                    or image.getexif().get(274, 1) != 1
                ):
                    raise BusinessError(
                        "INVALID_MEDIA",
                        "Photo must be an upright JPEG within Full HD. Prepare it on the phone first.",
                    )
                image.verify()
            with Image.open(io.BytesIO(data)) as image:
                image.load()
    except BusinessError:
        raise
    except Exception as exc:
        raise BusinessError("INVALID_MEDIA", "This photo could not be read. Retake it.") from exc
    return {"width": width, "height": height, "bytes": len(data), "sha256": hashlib.sha256(data).hexdigest()}


class LocalEvidenceStore:
    def __init__(self, root: Path, operations: OperationsStore):
        self.root, self.operations = root, operations

    def save(self, actor: Actor, task_id: UUID, item_id: str, evidence_id: UUID, data: bytes) -> Evidence:
        self.operations.task(actor, task_id)
        evidence = Evidence(id=evidence_id, item_id=item_id, **inspect_photo(data))
        self.root.mkdir(parents=True, exist_ok=True, mode=0o700)
        key = f"{uuid4()}.jpg"
        path = self.root / key
        try:
            with path.open("xb") as output:
                output.write(data)
            path.chmod(0o600)
            inserted = self.operations.record_evidence(actor, task_id, evidence, key)
            if not inserted:
                path.unlink()
            return evidence
        except Exception:
            path.unlink(missing_ok=True)
            raise
