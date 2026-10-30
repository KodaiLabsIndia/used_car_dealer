import hashlib
import json
import shutil
import subprocess
from pathlib import Path
from uuid import UUID, uuid4

from sqlalchemy import text

from app.adapters.operations import OperationsStore, rows
from app.contracts import Actor
from app.domain.errors import BusinessError
from app.video_contracts import MAX_VIDEO_BYTES, VideoClip, VideoClips


def inspect_video(path: Path) -> dict:
    probe, decoder = shutil.which("ffprobe"), shutil.which("ffmpeg")
    if not probe or not decoder:
        raise BusinessError(
            "VIDEO_UNAVAILABLE", "Video verification is unavailable. Keep the clip on your phone.", 503
        )
    try:
        result = subprocess.run(
            [
                probe,
                "-v",
                "error",
                "-protocol_whitelist",
                "file,pipe",
                "-show_streams",
                "-show_format",
                "-of",
                "json",
                str(path),
            ],
            capture_output=True,
            timeout=12,
            check=True,
        )
        if len(result.stdout) > 100000:
            raise ValueError("Oversized metadata")
        metadata = json.loads(result.stdout)
        streams = metadata["streams"]
        videos = [s for s in streams if s["codec_type"] == "video"]
        audio = [s for s in streams if s["codec_type"] == "audio"]
        if len(videos) != 1 or len(audio) > 1 or len(streams) != len(videos) + len(audio):
            raise ValueError("Unsupported tracks")
        stream = videos[0]
        rotation = (
            int(
                next(
                    (s.get("rotation", 0) for s in stream.get("side_data_list", []) if "rotation" in s),
                    stream.get("tags", {}).get("rotate", 0),
                )
            )
            % 360
        )
        width, height = int(stream["width"]), int(stream["height"])
        if rotation not in (0, 90, 180, 270):
            raise ValueError("Unsupported rotation")
        if rotation in (90, 270):
            width, height = height, width
        numerator, denominator = stream["avg_frame_rate"].split("/")
        fps = int(numerator) / int(denominator)
        duration = float(metadata["format"]["duration"])
        if (
            (width, height) not in ((1280, 720), (720, 1280))
            or stream["codec_name"] != "h264"
            or stream.get("pix_fmt") not in ("yuv420p", "yuvj420p")
            or stream.get("color_transfer") in ("smpte2084", "arib-std-b67")
            or stream.get("sample_aspect_ratio", "1:1") not in ("1:1", "N/A")
            or not 0 < fps <= 30.5
            or not 0 < duration <= 30.1
            or "mp4" not in metadata["format"]["format_name"]
            or any(s.get("codec_name") != "aac" for s in audio)
        ):
            raise ValueError("Profile mismatch")
        decoded = subprocess.run(
            [
                decoder,
                "-v",
                "error",
                "-protocol_whitelist",
                "file,pipe",
                "-xerror",
                "-i",
                str(path),
                "-map",
                "0:v:0",
                "-f",
                "null",
                "-",
            ],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.PIPE,
            timeout=45,
        )
        if decoded.returncode or decoded.stderr:
            raise ValueError("Unreadable frames")
    except (KeyError, ValueError, ZeroDivisionError, subprocess.SubprocessError) as error:
        raise BusinessError(
            "INVALID_VIDEO",
            "Clip must be a readable SDR H.264 MP4 at exactly 720p, at most 30 seconds and 30 fps. Prepare it on the phone first.",
        ) from error
    return {"width": width, "height": height, "duration_ms": round(duration * 1000)}


def clip_dto(row):
    return VideoClip.model_validate({key: row[key] for key in VideoClip.model_fields})


class VideoStore:
    def __init__(self, operations: OperationsStore, root: Path):
        self.ops, self.root, self.engine = operations, root, operations.engine

    def list(self, actor: Actor, task_id: UUID):
        with self.engine.connect() as conn:
            self.ops.task(actor, task_id, conn)
            return VideoClips(
                items=[
                    clip_dto(row)
                    for row in rows(
                        conn,
                        "SELECT v.*,u.name AS recorded_by_name FROM video_clips v JOIN users u ON u.id=v.recorded_by AND u.company_id=v.company_id WHERE v.task_id=:task AND v.company_id=:company ORDER BY v.created_at,v.id LIMIT 200",
                        {"task": task_id, "company": actor.company_id},
                    )
                ]
            )

    def file(self, actor, id):
        with self.engine.connect() as conn:
            data = rows(
                conn,
                "SELECT * FROM video_clips WHERE id=:id AND company_id=:company",
                {"id": id, "company": actor.company_id},
            )
            if not data:
                raise BusinessError("NOT_FOUND", "This clip is unavailable.", 404)
            self.ops.task(actor, data[0]["task_id"], conn)
            return self.root / data[0]["storage_key"]

    def save(self, actor: Actor, task_id: UUID, item_id: str, id: UUID, data: bytes):
        self.ops.task(actor, task_id)
        if not data or len(data) > MAX_VIDEO_BYTES:
            raise BusinessError(
                "INVALID_VIDEO", "Record a shorter clip. The prepared file must be 32 MB or smaller."
            )
        digest = hashlib.sha256(data).hexdigest()
        self.root.mkdir(parents=True, exist_ok=True, mode=0o700)
        key = f"{uuid4()}.mp4"
        path = self.root / key
        try:
            with path.open("xb") as target:
                target.write(data)
            path.chmod(0o600)
            dimensions = inspect_video(path)
            with self.engine.begin() as conn:
                conn.execute(
                    text("SELECT id FROM tasks WHERE id=:task AND company_id=:company FOR UPDATE"),
                    {"task": task_id, "company": actor.company_id},
                )
                task = self.ops.task(actor, task_id, conn)
                prior = rows(
                    conn,
                    "SELECT v.*,u.name AS recorded_by_name FROM video_clips v JOIN users u ON u.id=v.recorded_by WHERE v.id=:id",
                    {"id": id},
                )
                if prior:
                    old = prior[0]
                    if (
                        old["company_id"] != actor.company_id
                        or old["task_id"] != task_id
                        or old["item_id"] != item_id
                        or old["sha256"] != digest
                    ):
                        raise BusinessError(
                            "IDEMPOTENCY_CONFLICT", "That clip reference was already used.", 409
                        )
                    return clip_dto(old)
                if task.assigned_to != actor.id or task.status in ("submitted", "completed"):
                    raise BusinessError(
                        "READ_ONLY", "Only the assigned person can add clips to an open inspection.", 409
                    )
                if not any(i.id == item_id for i in task.items):
                    raise BusinessError("INVALID_ITEM", "Choose an inspection check.")
                count = conn.execute(
                    text("SELECT count(*) FROM video_clips WHERE task_id=:task"), {"task": task_id}
                ).scalar_one()
                if count >= 200:
                    raise BusinessError(
                        "CLIP_LIMIT", "This inspection already has the maximum number of clips."
                    )
                conn.execute(
                    text(
                        "INSERT INTO video_clips(id,company_id,task_id,item_id,recorded_by,storage_key,width,height,duration_ms,bytes,sha256,profile) VALUES(:id,:company,:task,:item,:actor,:key,:width,:height,:duration_ms,:bytes,:sha,'video-720-v1')"
                    ),
                    {
                        "id": id,
                        "company": actor.company_id,
                        "task": task_id,
                        "item": item_id,
                        "actor": actor.id,
                        "key": key,
                        "bytes": len(data),
                        "sha": digest,
                        **dimensions,
                    },
                )
                self.ops.audit(
                    conn,
                    actor,
                    task_id,
                    "task.clip",
                    {"evidenceId": str(id), "itemId": item_id, "sha256": digest, "profile": "video-720-v1"},
                )
                row = rows(
                    conn,
                    "SELECT v.*,u.name AS recorded_by_name FROM video_clips v JOIN users u ON u.id=v.recorded_by WHERE v.id=:id",
                    {"id": id},
                )[0]
            key = None
            return clip_dto(row)
        finally:
            if key:
                path.unlink(missing_ok=True)
