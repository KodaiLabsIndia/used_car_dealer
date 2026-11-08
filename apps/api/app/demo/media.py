"""Small, unmistakably synthetic JPEG/720p video fixtures for the local demo."""

import hashlib
import io
import shutil
import subprocess
import tempfile
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

from app.adapters.media import inspect_photo
from app.adapters.video import inspect_video


class DemoMedia:
    def __init__(self, root: Path, generation: str):
        self.root, self.generation, self.created = root, generation, set()
        root.mkdir(parents=True, exist_ok=True, mode=0o700)
        image = Image.new("RGB", (1600, 900), "#202020")
        draw = ImageDraw.Draw(image)
        draw.rectangle((0, 0, 1600, 22), fill="#c81e29")
        font = ImageFont.load_default(size=52)
        draw.text((80, 180), "DEMO SAMPLE", fill="white", font=font)
        draw.text(
            (80, 290),
            "Synthetic inspection / document proof",
            fill="#cccccc",
            font=ImageFont.load_default(size=32),
        )
        draw.text(
            (80, 380),
            "Not evidence of a real vehicle or person",
            fill="#cccccc",
            font=ImageFont.load_default(size=32),
        )
        buffer = io.BytesIO()
        image.save(buffer, format="JPEG", quality=82)
        self.photo = buffer.getvalue()
        self.photo_info = inspect_photo(self.photo)
        self.video = None
        self.video_info = None

    def save(self, id, video=False):
        if video and self.video is None:
            ffmpeg = shutil.which("ffmpeg")
            if not ffmpeg:
                raise RuntimeError("ffmpeg is required to seed verified 720p demo clips.")
            with tempfile.TemporaryDirectory(prefix="arihant-demo-video-") as folder:
                path = Path(folder) / "sample.mp4"
                subprocess.run(
                    [
                        ffmpeg,
                        "-v",
                        "error",
                        "-f",
                        "lavfi",
                        "-i",
                        "testsrc2=size=1280x720:rate=25",
                        "-t",
                        "0.5",
                        "-c:v",
                        "libx264",
                        "-pix_fmt",
                        "yuv420p",
                        "-movflags",
                        "+faststart",
                        "-y",
                        str(path),
                    ],
                    check=True,
                    capture_output=True,
                    timeout=45,
                )
                self.video_info = inspect_video(path)
                self.video = path.read_bytes()
        data = self.video if video else self.photo
        suffix = "mp4" if video else "jpg"
        key = f"demo-{self.generation}-{id}.{suffix}"
        path = self.root / key
        with path.open("xb") as output:
            output.write(data)
        path.chmod(0o600)
        self.created.add(path)
        info = (
            (self.video_info | {"bytes": len(data), "sha256": hashlib.sha256(data).hexdigest()})
            if video
            else self.photo_info
        )
        return {"storage_key": key, **info}

    def rollback(self):
        for path in self.created:
            path.unlink(missing_ok=True)
