import io
import json
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from PIL import Image
from sqlalchemy import create_engine, text
from sqlalchemy.exc import DBAPIError

from app.adapters.database import create_database
from app.config import Settings
from app.main import create_app
from app.seed import IDS, ITEMS, seed


@pytest.fixture
def workspace(tmp_path):
    settings = Settings(
        node_env="test",
        dev_auth_enabled=True,
        dev_access_code="integration-access-code",
        media_root=str(tmp_path),
    )
    admin = create_database(settings.sqlalchemy_url)
    schema = "test_" + uuid4().hex
    with admin.begin() as conn:
        conn.exec_driver_sql(f'CREATE SCHEMA "{schema}"')
    engine = create_engine(
        settings.sqlalchemy_url,
        connect_args={"options": f"-c search_path={schema} -c statement_timeout=15000"},
    )
    try:
        with engine.begin() as conn:
            for path in sorted((Path(__file__).parents[1] / "db/migrations").glob("*.sql")):
                conn.exec_driver_sql(path.read_text(), execution_options={"no_parameters": True})
        seed(engine)
        with TestClient(create_app(settings, engine)) as client:

            def login(account):
                response = client.post(
                    "/v1/auth/dev-session", json={"account": account, "accessCode": settings.dev_access_code}
                )
                assert response.status_code == 200, response.text
                return {"Authorization": "Bearer " + response.json()["token"]}

            yield client, engine, login("owner"), login("employee")
    finally:
        engine.dispose()
        with admin.begin() as conn:
            conn.exec_driver_sql(f'DROP SCHEMA "{schema}" CASCADE')
        admin.dispose()


def command(client, headers, task_id, action, version=1, command_id=None, **extra):
    return client.post(
        f"/v1/tasks/{task_id}/commands",
        headers=headers,
        json={"commandId": str(command_id or uuid4()), "expectedVersion": version, "action": action, **extra},
    )


def jpeg(width=1080, height=1080, orientation=1):
    data = io.BytesIO()
    image = Image.new("RGB", (width, height), "#777777")
    exif = Image.Exif()
    exif[274] = orientation
    image.save(data, format="JPEG", exif=exif)
    return data.getvalue()


def upload(client, headers, task_id, item_id, data, evidence_id=None):
    return client.post(
        f"/v1/tasks/{task_id}/items/{item_id}/evidence/{evidence_id or uuid4()}",
        headers=headers,
        files={"file": ("photo.jpg", data, "image/jpeg")},
    )


def test_real_permissions_and_owner_takeover(workspace):
    client, _, owner, employee = workspace
    assert client.get("/v1/cars").status_code == 401
    assert len(client.get("/v1/cars", headers=owner).json()["items"]) == 2
    assert len(client.get("/v1/cars", headers=employee).json()["items"]) == 1
    assert client.get(f"/v1/cars/{IDS['sonet']}", headers=employee).status_code == 404
    assert client.get(f"/v1/tasks/{IDS['owner_task']}", headers=employee).status_code == 404
    assert command(client, employee, IDS["employee_task"], "takeover").status_code == 403
    result = command(client, owner, IDS["employee_task"], "takeover")
    assert result.status_code == 200, result.text
    assert result.json()["assignedTo"] == str(IDS["owner"])
    assert client.get(f"/v1/tasks/{IDS['employee_task']}", headers=employee).status_code == 404
    assert len(client.get("/v1/cars", headers=owner).json()["items"]) == 2


def test_retries_versions_and_help_without_evidence(workspace):
    client, engine, owner, employee = workspace
    task_id, key = IDS["employee_task"], uuid4()
    response = command(client, employee, task_id, "help", command_id=key, itemId=ITEMS[0]["id"])
    assert response.status_code == 200, response.text
    assert response.json()["helpOpen"] is True
    replay = command(client, employee, task_id, "help", command_id=key, itemId=ITEMS[0]["id"])
    assert replay.json() == response.json()
    assert command(client, employee, task_id, "help", command_id=key, note="different").status_code == 409
    assert command(client, employee, task_id, "submit", version=1).status_code == 409
    assert client.get("/v1/dashboard", headers=owner).json()["decisions"] == 1
    with engine.connect() as conn:
        assert (
            conn.execute(text("SELECT count(*) FROM audit_events WHERE action='task.help'")).scalar_one() == 1
        )


def test_concurrent_commands_do_not_overwrite_each_other(workspace):
    client, _, _, employee = workspace
    with ThreadPoolExecutor(max_workers=2) as executor:
        responses = list(
            executor.map(lambda _: command(client, employee, IDS["employee_task"], "help"), range(2))
        )
    assert sorted(r.status_code for r in responses) == [200, 409]


def test_photo_admission_immutable_master_and_private_access(workspace):
    client, _, owner, employee = workspace
    task_id, item, evidence_id = IDS["employee_task"], ITEMS[0]["id"], uuid4()
    assert upload(client, employee, task_id, item, jpeg(2000, 1200)).status_code == 400
    assert upload(client, employee, task_id, item, jpeg(1080, 1080, 6)).status_code == 400
    assert upload(client, employee, task_id, item, b"not a photo").status_code == 400
    assert upload(client, owner, task_id, item, jpeg()).status_code == 409
    response = upload(client, employee, task_id, item, jpeg(), evidence_id)
    assert response.status_code == 201, response.text
    assert response.json()["width"] == 1080
    assert upload(client, employee, task_id, item, jpeg(), evidence_id).json() == response.json()
    assert upload(client, employee, task_id, item, jpeg(100, 100), evidence_id).status_code == 409
    assert client.get(f"/v1/evidence/{evidence_id}").status_code == 401
    assert client.get(f"/v1/evidence/{evidence_id}", headers=owner).content == jpeg()


@pytest.mark.parametrize("owner_performs", [False, True])
def test_complete_inspection_issue_and_attributable_review(workspace, owner_performs):
    client, engine, owner, employee = workspace
    task_id, version = IDS["employee_task"], 1
    if owner_performs:
        takeover = command(client, owner, task_id, "takeover")
        assert takeover.status_code == 200
        version, employee = takeover.json()["version"], owner
    assert (
        command(client, employee, task_id, "submit", version=version).json()["error"]["code"] == "INCOMPLETE"
    )
    for i, item in enumerate(ITEMS):
        photo = upload(client, employee, task_id, item["id"], jpeg())
        assert photo.status_code == 201, photo.text
        result = command(
            client,
            employee,
            task_id,
            "answer",
            version=version,
            itemId=item["id"],
            result="problem" if i == 0 else "ok",
            evidenceId=photo.json()["id"],
            note="Tread needs review" if i == 0 else "",
        )
        assert result.status_code == 200, result.text
        version = result.json()["version"]
    result = command(client, employee, task_id, "submit", version=version)
    assert result.status_code == 200, result.text
    assert result.json()["status"] == "submitted"
    version = result.json()["version"]
    if not owner_performs:
        assert (
            command(client, employee, task_id, "review", version=version, decision="accept").status_code
            == 403
        )
    result = command(client, owner, task_id, "review", version=version, decision="accept")
    assert result.status_code == 200, result.text
    assert result.json()["status"] == "completed"
    assert result.json()["car"]["stage"] == "inspection"  # Review never silently declares a car ready.
    with engine.connect() as conn:
        assert conn.execute(text("SELECT count(*) FROM issues")).scalar_one() == 1
        event = conn.execute(
            text("SELECT actor_id,details FROM audit_events WHERE action='task.review'")
        ).one()
        assert event.actor_id == IDS["owner"]
        assert event.details["review"]["selfReview"] is owner_performs
        assert conn.execute(text("SELECT count(*) FROM outbox WHERE kind='task.submit'")).scalar_one() == 1


def test_streamed_body_is_bounded_without_content_length(workspace):
    client, _, _, employee = workspace

    def oversized_body():
        for _ in range(9):
            yield b" " * (1024 * 1024)

    response = client.post(
        f"/v1/tasks/{IDS['employee_task']}/commands",
        headers=employee | {"Content-Type": "application/json"},
        content=oversized_body(),
    )
    assert response.status_code == 413
    assert response.json()["error"]["code"] == "BODY_TOO_LARGE"


def test_audit_is_append_only_and_sessions_revoke(workspace):
    client, engine, _, employee = workspace
    assert command(client, employee, IDS["employee_task"], "help").status_code == 200
    with pytest.raises(DBAPIError):
        with engine.begin() as conn:
            conn.execute(text("UPDATE audit_events SET action='forged'"))
    assert client.delete("/v1/session", headers=employee).status_code == 204
    assert client.get("/v1/me", headers=employee).status_code == 401


def test_openapi_publishes_typed_commands(workspace):
    client, _, _, _ = workspace
    schema = client.get("/openapi.json").json()
    assert "Task" in schema["components"]["schemas"]
    body = schema["paths"]["/v1/tasks/{task_id}/commands"]["post"]["requestBody"]
    assert "discriminator" in json.dumps(body)


def checked(response, status=200):
    assert response.status_code == status, response.text
    return response.json()


def create_car(client, owner, assigned=None, registration="MH 01 AB 1234", command_id=None):
    templates = checked(client.get("/v1/checklists", headers=owner))["items"]
    template = next(t for t in templates if t["kind"] == "pre_purchase")
    body = {
        "commandId": str(command_id or uuid4()),
        "make": "Maruti Suzuki",
        "model": "Swift",
        "registration": registration,
        "year": 2022,
        "odometerKm": 42000,
        "location": "Intake bay",
        "assignedTo": str(assigned or IDS["employee"]),
        "templateId": template["id"],
        "dueAt": None,
    }
    return client.post("/v1/cars", headers=owner, json=body), body


def fill_inspection(client, headers, task, problem=False):
    for i, item in enumerate(task["items"]):
        photo = checked(upload(client, headers, task["id"], item["id"], jpeg(200, 200)), 201)
        task = checked(
            command(
                client,
                headers,
                task["id"],
                "answer",
                version=task["version"],
                itemId=item["id"],
                result="problem" if problem and i == 0 else "ok",
                evidenceId=photo["id"],
            )
        )
    return checked(command(client, headers, task["id"], "submit", version=task["version"]))


def test_intake_snapshot_replay_registration_and_company_scope(workspace):
    client, engine, owner, employee = workspace
    response, body = create_car(client, owner)
    created = checked(response, 201)
    car, task = created["car"], created["task"]
    assert car["registration"] == "MH01AB1234"
    assert car["stockNumber"] == "AC-01000"
    assert car["imageKey"] == "generic" and car["odometerKm"] == 42000
    assert len(task["items"]) == 14 and task["kind"] == "pre_purchase"
    assert not task["templateApproved"]
    assert checked(client.post("/v1/cars", headers=owner, json=body), 201) == created
    assert client.post("/v1/cars", headers=owner, json=body | {"model": "Different"}).status_code == 409
    assert create_car(client, owner, registration="mh01-ab1234")[0].status_code == 409
    assert client.post("/v1/cars", headers=employee, json=body).status_code == 403
    assert client.get("/v1/checklists", headers=employee).status_code == 403
    assert client.get(f"/v1/cars/{car['id']}", headers=employee).status_code == 200
    with pytest.raises(DBAPIError), engine.begin() as conn:
        conn.execute(
            text("UPDATE checklist_templates SET items='[]'::jsonb WHERE id=:id"), {"id": body["templateId"]}
        )
    assert len(checked(client.get(f"/v1/tasks/{task['id']}", headers=owner))["items"]) == 14
    assert create_car(client, owner, assigned=uuid4(), registration="MH01CD5678")[0].status_code == 404
    with engine.connect() as conn:
        assert conn.execute(text("SELECT count(*) FROM stock_cycles")).scalar_one() == 3
        assert (
            conn.execute(text("SELECT count(*) FROM audit_events WHERE action='car.created'")).scalar_one()
            == 1
        )


def test_recheck_requires_fresh_evidence_and_retains_submissions(workspace):
    client, engine, owner, employee = workspace
    task = checked(client.get(f"/v1/tasks/{IDS['employee_task']}", headers=employee))
    task = fill_inspection(client, employee, task)
    first_version = task["version"]
    old_answer = task["answers"][0]
    assert task["submittedBy"] == str(IDS["employee"])
    assert command(client, owner, task["id"], "takeover", version=task["version"]).status_code == 409
    task = checked(command(client, owner, task["id"], "review", version=task["version"], decision="recheck"))
    assert len(task["recheckItems"]) == 3
    assert command(client, employee, task["id"], "submit", version=task["version"]).status_code == 400
    response = command(client, employee, task["id"], "answer", version=task["version"], **old_answer)
    assert response.json()["error"]["code"] == "FRESH_EVIDENCE_REQUIRED"
    task = checked(command(client, owner, task["id"], "takeover", version=task["version"]))
    task = fill_inspection(client, owner, task)
    checked(command(client, owner, task["id"], "review", version=task["version"], decision="accept"))
    with engine.connect() as conn:
        snapshots = conn.execute(
            text("SELECT task_version,snapshot FROM task_submissions ORDER BY created_at")
        ).all()
        assert len(snapshots) == 2 and snapshots[0].task_version == first_version
        assert snapshots[0].snapshot["submittedBy"] == str(IDS["employee"])
        assert snapshots[1].snapshot["submittedBy"] == str(IDS["owner"])
        assert [
            r[0] for r in conn.execute(text("SELECT self_review FROM task_reviews ORDER BY created_at"))
        ] == [False, True]
    with pytest.raises(DBAPIError):
        with engine.begin() as conn:
            conn.execute(text("UPDATE task_submissions SET snapshot='{}'::jsonb"))
    with pytest.raises(DBAPIError):
        with engine.begin() as conn:
            conn.execute(text("DELETE FROM task_reviews"))


def test_selected_recheck_retains_other_answers_and_review_reason(workspace):
    client, engine, owner, employee = workspace
    task = fill_inspection(
        client, employee, checked(client.get(f"/v1/tasks/{IDS['employee_task']}", headers=employee))
    )
    chosen = task["items"][0]["id"]
    original_answers = {a["itemId"]: a for a in task["answers"]}
    assert (
        command(
            client,
            owner,
            task["id"],
            "review",
            version=task["version"],
            decision="recheck",
            recheckItemIds=["foreign-check"],
        ).status_code
        == 400
    )
    assert (
        command(
            client,
            owner,
            task["id"],
            "review",
            version=task["version"],
            decision="recheck",
            recheckItemIds=[chosen, chosen],
        ).status_code
        == 400
    )
    task = checked(
        command(
            client,
            owner,
            task["id"],
            "review",
            version=task["version"],
            decision="recheck",
            recheckItemIds=[chosen],
            note="Show the full tyre tread without glare.",
        )
    )
    assert task["recheckItems"] == [chosen]
    assert task["recheckNote"] == "Show the full tyre tread without glare."
    assert command(client, employee, task["id"], "submit", version=task["version"]).status_code == 400
    evidence = checked(upload(client, employee, task["id"], chosen, jpeg()), 201)
    task = checked(
        command(
            client,
            employee,
            task["id"],
            "answer",
            version=task["version"],
            itemId=chosen,
            evidenceId=evidence["id"],
            result="ok",
        )
    )
    task = checked(command(client, employee, task["id"], "submit", version=task["version"]))
    for answer in task["answers"]:
        if answer["itemId"] != chosen:
            assert answer == original_answers[answer["itemId"]]
    checked(command(client, owner, task["id"], "review", version=task["version"], decision="accept"))
    with engine.connect() as conn:
        reviews = conn.execute(text("SELECT note,recheck_items FROM task_reviews ORDER BY created_at")).all()
        assert reviews[0].note == "Show the full tyre tread without glare."
        assert reviews[0].recheck_items == [chosen]
        assert conn.execute(text("SELECT count(*) FROM task_submissions")).scalar_one() == 2


def repair_command(client, headers, job, action, command_id=None, **extra):
    return client.post(
        f"/v1/jobs/{job['id']}/commands",
        headers=headers,
        json={
            "action": action,
            "commandId": str(command_id or uuid4()),
            "expectedVersion": job["version"],
            **extra,
        },
    )


def test_parts_repair_qc_recheck_accept_and_reopen(workspace):
    client, engine, owner, employee = workspace
    car_id = str(IDS["sonet"])
    # This test deliberately exercises orthogonal service/commercial states.
    # Ordinary training stock must not imply a booking that was never recorded.
    with engine.begin() as conn:
        conn.execute(
            text("UPDATE stock_cycles SET commercial_status='booked' WHERE id=:id"), {"id": IDS["sonet"]}
        )
    car = checked(client.get(f"/v1/cars/{car_id}", headers=owner))
    body = {
        "commandId": str(uuid4()),
        "expectedVersion": car["version"],
        "description": "Brake pads",
        "severity": "urgent",
    }
    issue = checked(client.post(f"/v1/cars/{car_id}/issues", headers=owner, json=body), 201)
    assert checked(client.post(f"/v1/cars/{car_id}/issues", headers=owner, json=body), 201) == issue
    workshop_body = {"commandId": str(uuid4()), "name": "ABC Workshop", "phone": "12345"}
    workshop = checked(client.post("/v1/workshops", headers=owner, json=workshop_body), 201)
    assert checked(client.post("/v1/workshops", headers=owner, json=workshop_body), 201) == workshop
    assert (
        client.post(
            "/v1/workshops",
            headers=owner,
            json=workshop_body | {"commandId": str(uuid4()), "name": "abc workshop"},
        ).status_code
        == 409
    )
    job_body = {
        "commandId": str(uuid4()),
        "expectedVersion": issue["version"],
        "assignedTo": str(IDS["employee"]),
        "workshopId": workshop["id"],
        "dueAt": None,
    }
    job = checked(client.post(f"/v1/issues/{issue['id']}/repairs", headers=owner, json=job_body), 201)
    assert checked(client.post(f"/v1/issues/{issue['id']}/repairs", headers=owner, json=job_body), 201) == job
    assert job["car"]["commercialStatus"] == "booked"
    assert client.get(f"/v1/cars/{car_id}", headers=employee).status_code == 200
    assert repair_command(client, owner, job, "start").status_code == 409
    job = checked(repair_command(client, employee, job, "start"))
    for name in ["Front pads", "Rear pads"]:
        key = uuid4()
        result = checked(repair_command(client, employee, job, "wait_parts", key, partName=name))
        assert checked(repair_command(client, employee, job, "wait_parts", key, partName=name)) == result
        job = result
    assert len(job["parts"]) == 2 and job["car"]["serviceStatus"] == "waiting_parts"
    assert repair_command(client, employee, job, "submit_repair").status_code == 409
    first_part = job["parts"][0]["id"]
    job = checked(repair_command(client, employee, job, "receive_part", partId=first_part))
    assert job["status"] == "waiting_parts"
    job = checked(repair_command(client, employee, job, "receive_part", partId=job["parts"][1]["id"]))
    assert job["status"] == "in_progress"
    job = checked(repair_command(client, employee, job, "submit_repair"))
    assert job["status"] == "awaiting_qc" and job["qcTaskId"]
    qc = checked(client.get(f"/v1/tasks/{job['qcTaskId']}", headers=employee))
    qc = fill_inspection(client, employee, qc, problem=True)
    assert (
        command(client, owner, qc["id"], "review", version=qc["version"], decision="accept").json()["error"][
            "code"
        ]
        == "QC_FAILED"
    )
    qc = checked(command(client, owner, qc["id"], "review", version=qc["version"], decision="recheck"))
    assert checked(client.get(f"/v1/jobs/{job['id']}", headers=employee))["status"] == "in_progress"
    qc = fill_inspection(client, employee, qc)
    checked(command(client, owner, qc["id"], "review", version=qc["version"], decision="accept"))
    job = checked(client.get(f"/v1/jobs/{job['id']}", headers=owner))
    assert job["status"] == "completed" and job["car"]["serviceStatus"] == "done"
    assert job["car"]["commercialStatus"] == "booked" and job["car"]["stage"] == "refurbishment"
    assert checked(client.get(f"/v1/cars/{car_id}/issues", headers=owner))["items"][0]["status"] == "resolved"
    old_qc = job["qcTaskId"]
    job = checked(repair_command(client, owner, job, "reopen"))
    assert job["qcTaskId"] is None and job["status"] == "in_progress"
    assert checked(client.get(f"/v1/tasks/{old_qc}", headers=owner))["status"] == "completed"
    history = checked(client.get(f"/v1/cars/{car_id}/history", headers=owner))["items"]
    assert any(h["action"] == "repair.reopen" for h in history)
    with engine.connect() as conn:
        assert conn.execute(text("SELECT count(*) FROM task_submissions")).scalar_one() == 2
        assert conn.execute(text("SELECT count(*) FROM issues")).scalar_one() == 1


def test_repair_source_evidence_scope_and_concurrent_creation(workspace):
    client, engine, owner, employee = workspace
    task = checked(client.get(f"/v1/tasks/{IDS['owner_task']}", headers=owner))
    task = fill_inspection(client, owner, task, problem=True)
    issue = checked(client.get(f"/v1/cars/{IDS['sonet']}/issues", headers=owner))["items"][0]
    assert client.get(f"/v1/evidence/{issue['evidenceId']}", headers=employee).status_code == 404
    body = {"expectedVersion": issue["version"], "assignedTo": str(IDS["employee"])}
    with ThreadPoolExecutor(max_workers=2) as executor:
        responses = list(
            executor.map(
                lambda _: client.post(
                    f"/v1/issues/{issue['id']}/repairs",
                    headers=owner,
                    json=body | {"commandId": str(uuid4())},
                ),
                range(2),
            )
        )
    assert sorted(r.status_code for r in responses) == [201, 409]
    assert client.get(f"/v1/evidence/{issue['evidenceId']}", headers=employee).status_code == 200
    assert client.get(f"/v1/tasks/{IDS['owner_task']}", headers=employee).status_code == 404
    other_photo = next(a["evidenceId"] for a in task["answers"] if a["evidenceId"] != issue["evidenceId"])
    assert client.get(f"/v1/evidence/{other_photo}", headers=employee).status_code == 404
    with engine.connect() as conn:
        assert conn.execute(text("SELECT count(*) FROM repair_jobs")).scalar_one() == 1


def test_existing_formatted_registration_timezone_and_foreign_assignment(workspace):
    client, engine, owner, _ = workspace
    response, body = create_car(client, owner, registration="mh46-bz9945")
    assert response.status_code == 409
    assert response.json()["error"]["code"] == "ALREADY_IN_STOCK"
    response = client.post(
        "/v1/cars",
        headers=owner,
        json=body | {"commandId": str(uuid4()), "registration": "MH01CD9876", "dueAt": "2026-11-01T10:00:00"},
    )
    assert response.status_code == 400  # Mobile timestamps must carry a timezone.
    company, person = uuid4(), uuid4()
    with engine.begin() as conn:
        conn.execute(text("INSERT INTO companies(id,name) VALUES(:id,'Other business')"), {"id": company})
        conn.execute(
            text("INSERT INTO users(id,company_id,name,role) VALUES(:id,:company,'Other person','employee')"),
            {"id": person, "company": company},
        )
    assert create_car(client, owner, assigned=person, registration="MH01CD9876")[0].status_code == 404
    with engine.connect() as conn:
        assert conn.execute(text("SELECT count(*) FROM stock_cycles")).scalar_one() == 2
        assert conn.execute(text("SELECT count(*) FROM company_counters")).scalar_one() == 0


def test_concurrent_intakes_have_unique_stock_numbers_and_registration(workspace):
    client, engine, owner, _ = workspace
    _, body = create_car(client, owner)
    with ThreadPoolExecutor(max_workers=2) as executor:
        results = list(
            executor.map(
                lambda plate: client.post(
                    "/v1/cars", headers=owner, json=body | {"commandId": str(uuid4()), "registration": plate}
                ),
                ["MH01CD5678", "MH01EF9012"],
            )
        )
    assert all(r.status_code == 201 for r in results)
    assert {r.json()["car"]["stockNumber"] for r in results} == {"AC-01001", "AC-01002"}
    with ThreadPoolExecutor(max_workers=2) as executor:
        results = list(
            executor.map(
                lambda plate: client.post(
                    "/v1/cars", headers=owner, json=body | {"commandId": str(uuid4()), "registration": plate}
                ),
                ["MH01GH3456", "mh01-gh3456"],
            )
        )
    assert sorted(r.status_code for r in results) == [201, 409]
    with engine.connect() as conn:
        assert conn.execute(text("SELECT count(*) FROM stock_cycles")).scalar_one() == 6


def test_workshop_seed_does_not_reset_recorded_progress(workspace):
    client, engine, owner, _ = workspace
    seed(engine, include_workshop_examples=True)
    job = checked(client.get("/v1/jobs", headers=owner))["items"][0]
    assert job["status"] == "waiting_parts" and len(job["parts"]) == 1
    job = checked(repair_command(client, owner, job, "receive_part", partId=job["parts"][0]["id"]))
    seed(engine, include_workshop_examples=True)
    assert checked(client.get(f"/v1/jobs/{job['id']}", headers=owner)) == job


def test_training_seed_starts_available_and_preserves_later_progress(workspace):
    client, engine, owner, _ = workspace
    assert checked(client.get("/v1/dashboard", headers=owner))["booked"] == 0
    with engine.begin() as conn:
        assert conn.execute(text("SELECT count(*) FROM sale_bookings")).scalar_one() == 0
        # Simulate later state in this isolated schema; rerunning setup must not reset it.
        conn.execute(
            text("UPDATE stock_cycles SET commercial_status='booked' WHERE id=:id"), {"id": IDS["sonet"]}
        )
    seed(engine)
    assert checked(client.get("/v1/dashboard", headers=owner))["booked"] == 1
