"""Shared-check authority, concurrent work and honest master completion against PostgreSQL."""

from concurrent.futures import ThreadPoolExecutor
from uuid import uuid4

import pytest
from sqlalchemy import text
from sqlalchemy.exc import DBAPIError
from test_identity import create_staff, login
from test_integration import checked, command, jpeg
from test_integration import workspace as workspace
from test_video import clips as clips
from workspace_seed import IDS


def task(client, headers):
    return checked(client.get(f"/v1/tasks/{IDS['employee_task']}", headers=headers))


def allocate(client, owner, current, changes, **extra):
    return client.post(
        f"/v1/tasks/{current['id']}/allocations",
        headers=owner,
        json={
            "commandId": str(uuid4()),
            "expectedVersion": current["version"],
            "changes": changes,
            "reason": "Allocate vehicle checks for today's work",
            **extra,
        },
    )


def grant(current, item):
    return next(g for g in current["allocations"] if g["itemId"] == item)


def token(current, item):
    g = grant(current, item)
    return {k: g[k] for k in ("itemId", "assignmentVersion", "version")}


def proof(client, actor, current, item, evidence_id=None):
    return client.post(
        f"/v1/tasks/{current['id']}/items/{item}/evidence/{evidence_id or uuid4()}",
        params={"allocation_version": grant(current, item)["assignmentVersion"]},
        headers=actor,
        files={"file": ("photo.jpg", jpeg(200, 200), "image/jpeg")},
    )


def answer(client, actor, current, item, evidence=None, **extra):
    photo = evidence or checked(proof(client, actor, current, item), 201)
    return command(
        client,
        actor,
        current["id"],
        "answer",
        current["version"],
        itemId=item,
        result="ok",
        evidenceId=photo["id"],
        allocationVersion=grant(current, item)["assignmentVersion"],
        itemVersion=grant(current, item)["version"],
        **extra,
    )


def submit(client, actor, current, items):
    return command(
        client,
        actor,
        current["id"],
        "submit_checks",
        current["version"],
        checks=[token(current, i) for i in items],
    )


def review(client, actor, current, items, decision="accept", note=""):
    return command(
        client,
        actor,
        current["id"],
        "review_checks",
        current["version"],
        checks=[token(current, i) for i in items],
        decision=decision,
        note=note,
    )


def split(client, owner):
    current = task(client, owner)
    a, b, c = [i["id"] for i in current["items"]]
    current = checked(
        allocate(
            client,
            owner,
            current,
            [
                {"itemIds": [a], "assignedTo": str(IDS["employee"])},
                {"itemIds": [b], "assignedTo": str(IDS["owner"])},
            ],
        )
    )
    return current, a, b, c


def test_split_work_is_independent_and_unallocated_blocks_completion(workspace):
    client, engine, owner, employee = workspace
    current, a, b, c = split(client, owner)
    assert grant(current, c)["state"] == "unassigned"
    assert (
        client.post(
            f"/v1/tasks/{current['id']}/allocations",
            headers=employee,
            json={
                "commandId": str(uuid4()),
                "expectedVersion": current["version"],
                "changes": [{"itemIds": [c], "assignedTo": str(IDS["employee"])}],
                "reason": "No authority",
            },
        ).status_code
        == 403
    )
    # Both writers start from one master version. Their check revisions are independent.
    with ThreadPoolExecutor(max_workers=2) as pool:
        responses = list(
            pool.map(lambda args: answer(client, *args), [(employee, current, a), (owner, current, b)])
        )
    assert [r.status_code for r in responses] == [200, 200], [r.text for r in responses]
    assert answer(client, employee, current, a).status_code == 409
    current = task(client, owner)
    current = checked(submit(client, employee, current, [a]))
    assert current["status"] == "in_progress"
    current = checked(review(client, owner, current, [a]))
    assert grant(current, b)["state"] == "in_progress" and grant(current, c)["state"] == "unassigned"
    current = checked(submit(client, owner, current, [b]))
    current = checked(review(client, owner, current, [b]))
    assert current["status"] == "in_progress"
    # Unrecorded required check cannot be waived or silently disappear.
    assert review(client, owner, current, [c], "waive", "Not available today").status_code == 409
    current = checked(
        allocate(client, owner, current, [{"itemIds": [c], "assignedTo": str(IDS["employee"])}])
    )
    current = checked(answer(client, employee, current, c))
    current = checked(submit(client, employee, current, [c]))
    current = checked(review(client, owner, current, [c]))
    assert current["status"] == "completed"
    assert all(g["state"] == "accepted" for g in current["allocations"])
    with engine.connect() as conn:
        assert conn.execute(text("SELECT count(*) FROM inspection_portion_submissions")).scalar_one() == 3
        events = (
            conn.execute(
                text(
                    "SELECT after_state FROM inspection_check_events WHERE action='review_checks' ORDER BY created_at"
                )
            )
            .scalars()
            .all()
        )
        assert all(e["reviewedBy"] == str(IDS["owner"]) and e["reviewedAt"] for e in events)
        assert (
            conn.execute(
                text("SELECT count(*) FROM inspection_answer_history WHERE origin='recorded'")
            ).scalar_one()
            == 3
        )


def test_handover_revokes_old_commands_media_and_replayed_receipts(workspace):
    client, engine, owner, employee = workspace
    current, a, b, c = split(client, owner)
    photo = checked(proof(client, employee, current, a), 201)
    key = uuid4()
    saved = checked(answer(client, employee, current, a, evidence=photo, command_id=key))
    moved = checked(allocate(client, owner, saved, [{"itemIds": [a], "assignedTo": str(IDS["owner"])}]))
    assert grant(moved, a)["answeredBy"] == str(IDS["employee"])
    assert answer(client, employee, current, a, evidence=photo, command_id=key).status_code in (403, 404)
    assert proof(client, employee, current, a, evidence_id=photo["id"]).status_code in (403, 404)
    # New owner cannot reuse a proof from the prior allocation to replace its recorded author.
    assert (
        answer(client, owner, moved, a, evidence=photo).json()["error"]["code"] == "FRESH_EVIDENCE_REQUIRED"
    )
    returned = checked(allocate(client, owner, moved, [{"itemIds": [a], "assignedTo": str(IDS["employee"])}]))
    assert (
        answer(client, employee, current, a, evidence=photo, command_id=key).json()["error"]["code"]
        == "ALLOCATION_CHANGED"
    )
    assert proof(client, employee, current, a, evidence_id=photo["id"]).status_code == 409
    assert answer(client, employee, returned, a).status_code == 200
    with engine.connect() as conn:
        assert (
            conn.execute(
                text("SELECT count(*) FROM inspection_answer_history WHERE item_id=:item"), {"item": a}
            ).scalar_one()
            == 2
        )
    with pytest.raises(DBAPIError), engine.begin() as conn:
        conn.execute(text("UPDATE inspection_answer_history SET origin='overwrite'"))


def test_partial_recheck_preserves_other_results_and_requires_new_proof(workspace):
    client, _, owner, employee = workspace
    current, a, b, c = split(client, owner)
    current = checked(answer(client, employee, current, a))
    photo = next(e for e in current["evidence"] if e["itemId"] == a)
    current = checked(answer(client, owner, current, b))
    current = checked(submit(client, employee, current, [a]))
    # Submitted scope stays locked while another scope is being worked.
    assert answer(client, employee, current, a, evidence=photo).status_code == 409
    current = checked(review(client, owner, current, [a], "recheck", "Please show the reading clearly"))
    assert grant(current, b)["state"] == "in_progress"
    assert (
        answer(client, employee, current, a, evidence=photo).json()["error"]["code"]
        == "FRESH_EVIDENCE_REQUIRED"
    )
    current = checked(answer(client, employee, current, a))
    current = checked(submit(client, employee, current, [a]))
    assert grant(current, a)["state"] == "submitted"


def test_two_employees_can_work_and_supervisor_cannot_review_actual_own_answer(workspace):
    client, engine, owner, employee = workspace
    person = checked(create_staff(client, owner), 201)
    signed = checked(login(client))
    # First-login secret reset is a separate identity rule, not a reason to disable shared authority.
    reset = checked(
        client.post(
            "/v1/auth/change-secret",
            headers={"Authorization": "Bearer " + signed["token"]},
            json={"currentSecret": "temporary-test-only", "newSecret": "updated-test-secret"},
        )
    )
    second = {"Authorization": "Bearer " + reset["token"]}
    current = task(client, owner)
    a, b, c = [i["id"] for i in current["items"]]
    current = checked(
        allocate(
            client,
            owner,
            current,
            [
                {"itemIds": [a], "assignedTo": str(IDS["employee"])},
                {"itemIds": [b], "assignedTo": person["id"]},
            ],
        )
    )
    assert client.get(f"/v1/tasks/{current['id']}", headers=second).status_code == 200
    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(
            pool.map(lambda args: answer(client, *args), [(employee, current, a), (second, current, b)])
        )
    assert all(r.status_code == 200 for r in results), [r.text for r in results]
    current = task(client, owner)
    current = checked(submit(client, employee, current, [a]))
    with engine.begin() as conn:
        conn.execute(
            text("UPDATE users SET work_roles=ARRAY['supervisor'] WHERE id=:id"), {"id": IDS["employee"]}
        )
    assert review(client, employee, current, [a]).json()["error"]["code"] == "INDEPENDENT_REVIEW_REQUIRED"
    assert review(client, owner, current, [a]).status_code == 200


def test_photo_handover_during_verification_rechecks_authority_and_leaves_no_file(workspace, monkeypatch):
    from app.adapters import media

    client, engine, owner, employee = workspace
    current, a, b, c = split(client, owner)
    original = media.inspect_photo

    def verify(data):
        dimensions = original(data)
        checked(
            allocate(client, owner, task(client, owner), [{"itemIds": [a], "assignedTo": str(IDS["owner"])}])
        )
        return dimensions

    monkeypatch.setattr(media, "inspect_photo", verify)
    rejected = proof(client, employee, current, a)
    assert rejected.status_code in (403, 404)
    with engine.connect() as conn:
        assert conn.execute(text("SELECT count(*) FROM evidence")).scalar_one() == 0


def test_video_handover_during_verification_and_fresh_recheck_clip(workspace, clips, monkeypatch):
    from app.adapters import video

    client, engine, owner, employee = workspace
    current, a, b, c = split(client, owner)

    def send(current, actor, item):
        return client.post(
            f"/v1/tasks/{current['id']}/items/{item}/clips/{uuid4()}",
            headers=actor,
            params={"allocation_version": grant(current, item)["assignmentVersion"]},
            files={"file": ("clip.mp4", clips["valid"], "video/mp4")},
        )

    original = video.inspect_video

    def verify(path):
        dimensions = original(path)
        checked(
            allocate(client, owner, task(client, owner), [{"itemIds": [a], "assignedTo": str(IDS["owner"])}])
        )
        return dimensions

    monkeypatch.setattr(video, "inspect_video", verify)
    assert send(current, employee, a).status_code in (403, 404)
    with engine.connect() as conn:
        assert conn.execute(text("SELECT count(*) FROM video_clips")).scalar_one() == 0
    monkeypatch.setattr(video, "inspect_video", original)
    current = task(client, owner)
    checked(send(current, owner, a), 201)
    current = checked(answer(client, owner, current, a))
    current = checked(submit(client, owner, current, [a]))
    current = checked(
        review(client, owner, current, [a], "recheck", "Please show the issue with fresh proof")
    )
    assert a not in current["clipItemIds"]
    checked(send(current, owner, a), 201)
    assert a in task(client, owner)["clipItemIds"]


def test_optional_omission_is_explicit_and_persistent_with_actual_issue_author(workspace):
    import json

    client, engine, owner, employee = workspace
    current = task(client, owner)
    # Create a separate frozen training task; never mutate an existing checklist snapshot.
    new_id = uuid4()
    items = [dict(current["items"][0], required=True), dict(current["items"][1], required=False)]
    with engine.begin() as conn:
        conn.execute(
            text(
                "INSERT INTO tasks(id,company_id,cycle_id,title,assigned_to,items,kind) VALUES(:id,:company,:car,'Optional training checks',:user,CAST(:items AS jsonb),'reference')"
            ),
            {
                "id": new_id,
                "company": IDS["company"],
                "car": IDS["seltos"],
                "user": IDS["employee"],
                "items": json.dumps(items),
            },
        )
    current = checked(client.get(f"/v1/tasks/{new_id}", headers=owner))
    a, b = [i["id"] for i in items]
    current = checked(
        allocate(client, owner, current, [{"itemIds": [a], "assignedTo": str(IDS["employee"])}])
    )
    photo = checked(proof(client, employee, current, a), 201)
    current = checked(
        command(
            client,
            employee,
            current["id"],
            "answer",
            current["version"],
            itemId=a,
            result="problem",
            note="Training: tyre issue observed",
            evidenceId=photo["id"],
            allocationVersion=grant(current, a)["assignmentVersion"],
            itemVersion=grant(current, a)["version"],
        )
    )
    current = checked(allocate(client, owner, current, [{"itemIds": [a], "assignedTo": str(IDS["owner"])}]))
    # A handover carries the original result, without forging who observed its issue.
    current = checked(submit(client, owner, current, [a]))
    current = checked(review(client, owner, current, [a]))
    assert current["status"] != "completed"
    current = checked(
        review(client, owner, current, [b], "waive", "Optional equipment not included in scope")
    )
    assert current["status"] == "completed" and grant(current, b)["state"] == "waived"
    with engine.connect() as conn:
        assert (
            conn.execute(
                text("SELECT created_by FROM issues WHERE task_id=:task"), {"task": new_id}
            ).scalar_one()
            == IDS["employee"]
        )
        assert (
            conn.execute(
                text("SELECT count(*) FROM inspection_work_assignments WHERE task_id=:task"), {"task": new_id}
            ).scalar_one()
            == 2
        )
        snapshot = conn.execute(
            text("SELECT snapshot FROM inspection_portion_submissions WHERE task_id=:task"), {"task": new_id}
        ).scalar_one()
        assert snapshot["allocations"][0]["answeredBy"] == str(IDS["employee"])


def test_shared_visibility_decisions_notifications_and_revocation(workspace):
    from app.adapters.notifications import NotificationStore

    client, engine, owner, employee = workspace
    current, a, b, c = split(client, owner)
    current = checked(answer(client, employee, current, a))
    photo = next(e for e in current["evidence"] if e["itemId"] == a)
    current = checked(submit(client, employee, current, [a]))
    decisions = checked(client.get("/v1/decisions", headers=owner))["items"]
    assert any(d["targetId"] == current["id"] and d["kind"] == "inspection" for d in decisions)
    assert client.get(f"/v1/evidence/{photo['id']}", headers=employee).status_code == 200
    assert client.get(f"/v1/cars/{IDS['sonet']}/history", headers=employee).status_code == 404
    assert (
        command(client, employee, current["id"], "submit", current["version"]).json()["error"]["code"]
        == "SCOPED_WORK_REQUIRED"
    )
    current = checked(review(client, owner, current, [a], "recheck", "Please return and verify this check"))
    NotificationStore(engine).drain()
    assert any(
        n["kind"] == "task.review_checks"
        for n in checked(client.get("/v1/notifications", headers=employee))["items"]
    )
    current = checked(allocate(client, owner, current, [{"itemIds": [a], "assignedTo": str(IDS["owner"])}]))
    assert client.get(f"/v1/tasks/{current['id']}", headers=employee).status_code == 404
    assert client.get(f"/v1/evidence/{photo['id']}", headers=employee).status_code == 404
    foreign_company, foreign_person = uuid4(), uuid4()
    with engine.begin() as conn:
        conn.execute(
            text("INSERT INTO companies(id,name) VALUES(:id,'Other company')"), {"id": foreign_company}
        )
        conn.execute(
            text("INSERT INTO users(id,company_id,name,role) VALUES(:id,:company,'Other person','employee')"),
            {"id": foreign_person, "company": foreign_company},
        )
    assert (
        allocate(client, owner, current, [{"itemIds": [c], "assignedTo": str(foreign_person)}]).status_code
        == 404
    )


def test_shared_repair_qc_closes_only_after_every_portion_and_job_assignment_keeps_check_owners(workspace):
    from test_integration import repair_command

    client, engine, owner, employee = workspace
    car = checked(client.get(f"/v1/cars/{IDS['sonet']}", headers=owner))
    issue = checked(
        client.post(
            f"/v1/cars/{car['id']}/issues",
            headers=owner,
            json={
                "commandId": str(uuid4()),
                "expectedVersion": car["version"],
                "description": "Training brake repair",
                "severity": "urgent",
            },
        ),
        201,
    )
    job = checked(
        client.post(
            f"/v1/issues/{issue['id']}/repairs",
            headers=owner,
            json={
                "commandId": str(uuid4()),
                "expectedVersion": issue["version"],
                "assignedTo": str(IDS["employee"]),
                "workshopId": None,
                "dueAt": None,
            },
        ),
        201,
    )
    job = checked(repair_command(client, employee, job, "start"))
    job = checked(repair_command(client, employee, job, "submit_repair"))
    current = checked(client.get(f"/v1/tasks/{job['qcTaskId']}", headers=owner))
    a, *rest = [i["id"] for i in current["items"]]
    current = checked(
        allocate(
            client,
            owner,
            current,
            [
                {"itemIds": [a], "assignedTo": str(IDS["employee"])},
                {"itemIds": rest, "assignedTo": str(IDS["owner"])},
            ],
        )
    )
    current = checked(answer(client, employee, current, a))
    current = checked(submit(client, employee, current, [a]))
    current = checked(review(client, owner, current, [a]))
    observed = checked(client.get(f"/v1/jobs/{job['id']}", headers=owner))
    assert observed["status"] != "completed"
    job = checked(repair_command(client, owner, observed, "assign", assignedTo=str(IDS["owner"])))
    observed_qc = checked(client.get(f"/v1/tasks/{current['id']}", headers=owner))
    assert grant(observed_qc, a)["assignedTo"] == str(IDS["employee"])
    for item in rest:
        current = checked(answer(client, owner, current, item))
    current = checked(submit(client, owner, current, rest))
    current = checked(review(client, owner, current, rest))
    assert current["status"] == "completed"
    assert checked(client.get(f"/v1/jobs/{job['id']}", headers=owner))["status"] == "completed"
    with engine.connect() as conn:
        assert (
            conn.execute(text("SELECT status FROM issues WHERE id=:id"), {"id": issue["id"]}).scalar_one()
            == "resolved"
        )


def test_performed_optional_checks_still_require_configured_measurement_and_video(workspace, clips):
    import json

    client, engine, owner, employee = workspace
    original = task(client, owner)
    task_id = uuid4()
    item = dict(
        original["items"][0],
        required=False,
        requiresClip=True,
        measurementUnit="mm",
        configurationPending=True,
    )
    with engine.begin() as conn:
        conn.execute(
            text(
                "INSERT INTO tasks(id,company_id,cycle_id,title,assigned_to,items,kind) VALUES(:id,:company,:car,'Optional equipment training',:user,CAST(:items AS jsonb),'reference')"
            ),
            {
                "id": task_id,
                "company": IDS["company"],
                "car": IDS["seltos"],
                "user": IDS["employee"],
                "items": json.dumps([item]),
            },
        )
    current = checked(client.get(f"/v1/tasks/{task_id}", headers=owner))
    check = item["id"]
    current = checked(
        allocate(client, owner, current, [{"itemIds": [check], "assignedTo": str(IDS["employee"])}])
    )
    photo = checked(proof(client, employee, current, check), 201)
    assert (
        answer(client, employee, current, check, evidence=photo, reading=4.2).json()["error"]["code"]
        == "CONFIGURATION_REQUIRED"
    )
    assert (
        answer(client, employee, current, check, evidence=photo, applicabilityConfirmed=True).json()["error"][
            "code"
        ]
        == "MEASUREMENT_REQUIRED"
    )
    current = checked(
        answer(client, employee, current, check, evidence=photo, reading=4.2, applicabilityConfirmed=True)
    )
    assert submit(client, employee, current, [check]).json()["error"]["code"] == "INCOMPLETE"
    assert (
        review(client, owner, current, [check], "waive", "Optional but actually inspected").status_code == 409
    )
    checked(
        client.post(
            f"/v1/tasks/{task_id}/items/{check}/clips/{uuid4()}",
            headers=employee,
            params={"allocation_version": grant(current, check)["assignmentVersion"]},
            files={"file": ("clip.mp4", clips["valid"], "video/mp4")},
        ),
        201,
    )
    current = checked(client.get(f"/v1/tasks/{task_id}", headers=employee))
    current = checked(submit(client, employee, current, [check]))
    current = checked(review(client, owner, current, [check]))
    assert current["status"] == "completed"
