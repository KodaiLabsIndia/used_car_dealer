import json
from uuid import uuid4

from sqlalchemy import text
from test_documents import upload as document_upload
from test_integration import checked, command, jpeg, upload
from test_integration import workspace as workspace

from app.application.assistant import ModelResult
from app.assistant_contracts import AIContent
from app.seed import IDS, ITEMS


class FakeModel:
    model = "test-model"
    calls = 0
    invalid = False

    def generate(self, system, context, images):
        self.calls += 1
        self.image_source_ids = json.loads(context)["imageSourceIds"]
        sources = [f["sourceId"] for f in json.loads(context)["records"]]
        self.images = images
        return ModelResult(
            AIContent(
                summary="Engine did not start. The cause is unknown.",
                fields=[],
                unknowns=["Cause of the reported symptom"],
                checks=["Ask a mechanic to inspect"],
                source_ids=["invented" if self.invalid else sources[-1]],
            ),
            120,
            40,
        )


def enabled(client):
    runner = client.app.state.assistant_runner
    runner.store.settings.ai_enabled = True
    runner.store.settings.ai_model = "test-model"
    runner.model = FakeModel()
    return runner


def request(client, headers, **extra):
    return client.post(
        "/v1/assistant/drafts",
        headers=headers,
        json={
            "commandId": str(uuid4()),
            "capability": "voice_log",
            "taskId": str(IDS["employee_task"]),
            "itemId": ITEMS[0]["id"],
            "text": "Engine did not start; cause unknown.",
            **extra,
        },
    )


def test_draft_is_scoped_retry_safe_and_never_changes_operational_records(workspace):
    client, engine, owner, employee = workspace
    runner = enabled(client)
    key = str(uuid4())
    draft = checked(request(client, employee, commandId=key), 202)
    id = draft["id"]
    done = checked(client.get(f"/v1/assistant/drafts/{id}", headers=employee))
    assert done["status"] == "completed" and not done["stale"]
    assert checked(request(client, employee, commandId=key), 202)["id"] == id
    assert runner.model.calls == 1
    assert request(client, employee, commandId=key, text="Different report").status_code == 409
    assert request(client, employee, capability="owner_brief").status_code == 403
    assert request(client, employee, taskId=str(IDS["owner_task"])).status_code == 404
    assert request(client, employee, carId=str(IDS["sonet"])).status_code == 400
    assert (
        client.post(
            f"/v1/assistant/drafts/{id}/review",
            headers=employee,
            json={
                "decision": "accepted",
                "humanReviewed": False,
            },
        ).status_code
        == 409
    )
    reviewed = checked(
        client.post(
            f"/v1/assistant/drafts/{id}/review",
            headers=employee,
            json={
                "decision": "accepted",
                "humanReviewed": True,
            },
        )
    )
    assert reviewed["review"] == "accepted"
    with engine.connect() as conn:
        assert conn.execute(text("SELECT count(*) FROM inspection_answers")).scalar_one() == 0
    assert checked(client.get(f"/v1/tasks/{IDS['employee_task']}", headers=employee))["version"] == 1


def test_changed_sources_invalid_output_and_daily_budget_fail_closed(workspace):
    client, _, _, employee = workspace
    runner = enabled(client)
    draft = checked(request(client, employee), 202)
    checked(command(client, employee, IDS["employee_task"], "help"))
    current = checked(client.get(f"/v1/assistant/drafts/{draft['id']}", headers=employee))
    assert current["stale"]
    assert (
        client.post(
            f"/v1/assistant/drafts/{draft['id']}/review",
            headers=employee,
            json={
                "decision": "accepted",
                "humanReviewed": True,
            },
        ).status_code
        == 409
    )
    runner.model.invalid = True
    bad = checked(request(client, employee), 202)
    result = checked(client.get(f"/v1/assistant/drafts/{bad['id']}", headers=employee))
    assert result["status"] == "failed" and result["errorCode"] == "AI_INVALID_SOURCES"
    runner.store.settings.ai_requests_per_day = 2
    assert request(client, employee).json()["error"]["code"] == "AI_DAILY_LIMIT"


def test_vision_uses_only_scoped_verified_original_pages(workspace):
    client, _, owner, employee = workspace
    runner = enabled(client)
    page = checked(document_upload(client, owner, IDS["sonet"]), 201)
    body = dict(
        capability="scan_fields", taskId=None, itemId=None, carId=str(IDS["sonet"]), documentIds=[page["id"]]
    )
    assert request(client, employee, **body).status_code == 403
    draft = checked(request(client, owner, **body), 202)
    assert checked(client.get(f"/v1/assistant/drafts/{draft['id']}", headers=owner))["status"] == "completed"
    assert len(runner.model.images) == 1
    assert runner.model.image_source_ids == ["document:" + page["id"]]
    assert request(client, owner, **(body | {"carId": str(IDS["seltos"])})).status_code == 400
    photo = checked(upload(client, employee, IDS["employee_task"], ITEMS[0]["id"], jpeg()), 201)
    draft = checked(
        request(
            client, employee, capability="scan_fields", carId=str(IDS["seltos"]), evidenceIds=[photo["id"]]
        ),
        202,
    )
    assert (
        checked(client.get(f"/v1/assistant/drafts/{draft['id']}", headers=employee))["status"] == "completed"
    )
    assert runner.model.image_source_ids == ["photo:" + photo["id"]]
