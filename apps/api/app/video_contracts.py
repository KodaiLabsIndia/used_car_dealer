from datetime import datetime
from typing import Literal
from uuid import UUID

from app.contracts import Contract

MAX_VIDEO_BYTES = 32 * 1024 * 1024


class VideoClip(Contract):
    id: UUID
    task_id: UUID
    item_id: str
    width: int
    height: int
    duration_ms: int
    bytes: int
    sha256: str
    profile: Literal["video-720-v1"] = "video-720-v1"
    recorded_by_name: str
    created_at: datetime


class VideoClips(Contract):
    items: list[VideoClip]
