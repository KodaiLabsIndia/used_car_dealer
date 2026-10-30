import shutil
import subprocess
from pathlib import Path
from uuid import uuid4

import pytest
from test_integration import command
from test_integration import workspace as workspace

from app.seed import IDS, ITEMS


@pytest.fixture(scope="module")
def clips(tmp_path_factory):
    ffmpeg = shutil.which("ffmpeg")
    if not ffmpeg:
        pytest.skip("ffmpeg required for actual encoded media admission tests")
    directory = tmp_path_factory.mktemp("video")
    output = {}
    for name, size, codec in [
        ("valid", "1280x720", "libx264"),
        ("portrait", "720x1280", "libx264"),
        ("oversized", "1920x1080", "libx264"),
        ("wrong-codec", "1280x720", "libx265"),
    ]:
        path = directory / (name + ".mp4")
        subprocess.run(
            [
                ffmpeg,
                "-v",
                "error",
                "-f",
                "lavfi",
                "-i",
                f"color=c=gray:s={size}:r=30",
                "-t",
                "0.4",
                "-c:v",
                codec,
                "-pix_fmt",
                "yuv420p",
                "-y",
                str(path),
            ],
            check=True,
            stderr=subprocess.PIPE,
        )
        output[name] = path.read_bytes()
    return output


def upload(client, headers, data, id=None, task=None):
    return client.post(
        f"/v1/tasks/{task or IDS['employee_task']}/items/{ITEMS[0]['id']}/clips/{id or uuid4()}",
        headers=headers,
        files={"file": ("clip.mp4", data, "video/mp4")},
    )


def test_video_actual_bytes_dimensions_codec_retry_and_private_access(workspace, clips):
    client, engine, owner, employee = workspace
    for name in ("oversized", "wrong-codec"):
        response = upload(client, employee, clips[name])
        assert response.status_code == 400, response.text
    assert upload(client, employee, b"not a clip").status_code == 400
    id = uuid4()
    response = upload(client, employee, clips["valid"], id)
    assert response.status_code == 201, response.text
    clip = response.json()
    assert clip["width"] == 1280 and clip["height"] == 720 and clip["durationMs"] == 400
    assert upload(client, employee, clips["valid"], id).json() == clip
    assert upload(client, employee, clips["portrait"], id).status_code == 409
    assert client.get(f"/v1/clips/{id}/file").status_code == 401
    assert client.get(f"/v1/clips/{id}/file", headers=owner).content == clips["valid"]
    assert upload(client, employee, clips["valid"], task=IDS["owner_task"]).status_code == 404
    assert len(client.get(f"/v1/tasks/{IDS['employee_task']}/clips", headers=owner).json()["items"]) == 1
    assert upload(client, employee, clips["portrait"]).status_code == 201
    assert len(list(Path(client.app.state.assistant_runner.store.settings.media_path).glob("*.mp4"))) == 2


def test_only_assignee_can_upload_and_clip_does_not_replace_required_check_photo(workspace, clips):
    client, _, owner, employee = workspace
    assert upload(client, owner, clips["valid"]).status_code == 409
    assert upload(client, employee, clips["valid"]).status_code == 201
    response = command(client, employee, IDS["employee_task"], "submit")
    assert response.json()["error"]["code"] == "INCOMPLETE"
