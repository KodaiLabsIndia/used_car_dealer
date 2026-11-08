from concurrent.futures import ThreadPoolExecutor
from datetime import UTC, datetime, timedelta
from uuid import uuid4

import pytest
from sqlalchemy import text
from sqlalchemy.exc import DBAPIError
from test_integration import checked, jpeg
from test_integration import workspace as workspace
from test_roles import roles
from workspace_seed import IDS

from app.adapters.workforce import WorkforceStore


@pytest.fixture
def clock(monkeypatch):
    value = [datetime(2026, 11, 2, 5, 0, tzinfo=UTC)]
    monkeypatch.setattr(WorkforceStore, "now", lambda self, conn: value[0])
    return value


def command(client, headers, action, user=None, **fields):
    return client.post(
        f"/v1/workforce/{user or IDS['employee']}/commands",
        headers=headers,
        json={"commandId": str(uuid4()), "action": action, **fields},
    )


def get(client, h, user=None, day="2026-11-02"):
    return checked(
        client.get("/v1/workforce", headers=h, params={"user_id": str(user or IDS["employee"]), "as_of": day})
    )


def profile(client, owner, basis="daily", cycle="daily", start="2026-11-01", rate=100_001):
    return checked(
        command(
            client,
            owner,
            "save_profile",
            expectedVersion=0,
            terms={"effectiveFrom": start, "basis": basis, "cycle": cycle, "ratePaise": rate},
            reason="Agreed employment pay",
        )
    )


def preview(client, h, day="2026-11-02", **params):
    return client.get(f"/v1/workforce/{IDS['employee']}/preview", headers=h, params={"as_of": day, **params})


def confirm(client, owner, p):
    return command(
        client,
        owner,
        "confirm_salary",
        asOf=p["start"],
        fingerprint=p["fingerprint"],
        bonusPaise=p["bonusPaise"],
        deductionPaise=p["deductionPaise"],
        reason="Reviewed actual pay sources",
    )


def policy(client, owner, **changes):
    state = get(client, owner)
    p = state["policy"] | changes
    p["effectiveFrom"] = "2026-11-02"
    return client.post(
        "/v1/workforce/policy",
        headers=owner,
        json={
            "commandId": str(uuid4()),
            "expectedVersion": state["policy"]["version"],
            "policy": p,
            "reason": "Reviewed attendance rules",
        },
    )


def finish_day(client, owner, employee, clock):
    start = checked(command(client, employee, "punch_in", punch={}))["attendance"][0]
    clock[0] += timedelta(hours=8)
    checked(
        command(
            client, employee, "punch_out", sessionId=start["id"], expectedVersion=start["version"], punch={}
        )
    )
    clock[0] += timedelta(days=1)


def test_workforce_scope_duplicate_punches_and_concurrency(workspace, clock):
    client, engine, owner, employee = workspace
    assert client.get("/v1/workforce").status_code == 401
    assert get(client, employee)["people"][0]["id"] == str(IDS["employee"])
    assert (
        client.get("/v1/workforce", headers=employee, params={"user_id": str(IDS["owner"])}).status_code
        == 403
    )
    assert command(client, owner, "punch_in", punch={}).status_code == 409
    assert (
        command(
            client,
            employee,
            "save_profile",
            terms={"effectiveFrom": "2026-11-01", "basis": "daily", "cycle": "daily", "ratePaise": 100},
        ).status_code
        == 403
    )
    body = {"commandId": str(uuid4()), "action": "punch_in", "punch": {}}
    path = f"/v1/workforce/{IDS['employee']}/commands"
    with ThreadPoolExecutor(max_workers=2) as pool:
        responses = list(pool.map(lambda _: client.post(path, headers=employee, json=body), range(2)))
    assert all(r.status_code == 200 for r in responses)
    assert responses[0].json() == responses[1].json()
    first = responses[0].json()["attendance"][0]
    with engine.connect() as c:
        assert c.execute(text("SELECT count(*) FROM attendance_sessions")).scalar_one() == 1
    wrong = command(client, employee, "punch_out", sessionId=str(uuid4()), expectedVersion=1, punch={})
    assert wrong.status_code == 409
    clock[0] += timedelta(hours=8)
    checked(command(client, employee, "punch_out", sessionId=first["id"], expectedVersion=1, punch={}))
    second = checked(
        command(client, employee, "punch_out", sessionId=first["id"], expectedVersion=1, punch={})
    )
    assert second["attendance"][0]["minutes"] == 480
    clock[0] += timedelta(days=1)
    checked(command(client, employee, "punch_in", punch={}))
    # A stale punch-out cannot close the new shift.
    checked(command(client, employee, "punch_out", sessionId=first["id"], expectedVersion=1, punch={}))
    assert get(client, employee)["attendance"][-1]["status"] == "open"


def test_missing_out_is_unknown_and_hourly_pay_needs_review(workspace, clock):
    client, _, owner, employee = workspace
    profile(client, owner, basis="hourly", rate=12_000)
    checked(command(client, employee, "punch_in", punch={}))
    clock[0] = datetime(2026, 11, 3, 5, 0, tzinfo=UTC)
    state = get(client, owner)
    s = state["attendance"][0]
    assert s["status"] == "missed_out" and s["minutes"] is None and s["punchedOutAt"] is None
    assert checked(preview(client, owner))["blockers"]
    checked(
        command(
            client,
            owner,
            "review_day",
            workDate="2026-11-02",
            halfDays=2,
            minutes=420,
            reason="Confirmed with employee",
            fingerprint=s["sourceSignature"],
        )
    )
    p = checked(preview(client, owner))
    assert not p["blockers"] and p["netPaise"] == 84_000
    result = checked(confirm(client, owner, p))
    assert result["salaries"][0]["snapshot"]["netPaise"] == 84_000
    assert result["attendance"][0]["punchedOutAt"] is None
    assert (
        command(
            client,
            owner,
            "review_day",
            workDate="2026-11-02",
            halfDays=0,
            reason="Later change",
            fingerprint=s["sourceSignature"],
        ).status_code
        == 409
    )


def test_night_shift_saved_window_and_location_warnings(workspace, clock):
    client, _, owner, employee = workspace
    checked(
        policy(
            client,
            owner,
            schedule={"start": "22:00", "end": "06:00", "weekdays": [0, 1, 2, 3, 4, 5]},
            collectLocation=True,
            latitude=19.0,
            longitude=73.0,
        )
    )
    clock[0] = datetime(2026, 11, 2, 16, 45, tzinfo=UTC)
    s = checked(
        command(
            client,
            employee,
            "punch_in",
            punch={"latitude": 12.0, "longitude": 77.0, "accuracyM": 5, "mocked": True},
        )
    )["attendance"][0]
    assert s["workDate"] == "2026-11-02" and "Outside the saved yard location" in s["flags"]
    checked(
        policy(client, owner, schedule={"start": "09:00", "end": "18:00", "weekdays": [0, 1, 2, 3, 4, 5]})
    )
    clock[0] = datetime(2026, 11, 3, 0, 45, tzinfo=UTC)
    result = checked(command(client, employee, "punch_out", sessionId=s["id"], expectedVersion=1, punch={}))
    assert (
        result["attendance"][0]["schedule"]["start"] == "22:00" and result["attendance"][0]["minutes"] == 480
    )


def test_leave_approval_balance_holidays_and_pending_pay_block(workspace, clock):
    client, _, owner, employee = workspace
    profile(client, owner)
    result = checked(
        command(
            client,
            employee,
            "request_leave",
            start="2026-11-02",
            end="2026-11-02",
            halfDays=2,
            paid=True,
            reason="Medical appointment",
        )
    )
    leave = result["leaves"][0]
    assert (
        command(
            client, employee, "review_leave", targetId=leave["id"], expectedVersion=1, reason="Self approval"
        ).status_code
        == 403
    )
    clock[0] = datetime(2026, 11, 3, 5, 0, tzinfo=UTC)
    assert "Review pending leave in this period." in checked(preview(client, owner))["blockers"]
    checked(
        command(
            client,
            owner,
            "review_leave",
            targetId=leave["id"],
            expectedVersion=1,
            decision="approved",
            reason="Approved paid leave",
        )
    )
    assert get(client, owner)["leaveUsedHalfDays"] == 2
    p = checked(preview(client, owner))
    assert p["netPaise"] == 100_001 and not p["blockers"]
    assert (
        command(
            client, employee, "request_leave", start="2026-11-02", end="2026-11-02", reason="Duplicate leave"
        ).status_code
        == 409
    )


def test_salary_sources_approval_advances_payment_retries_and_reversals(workspace, clock):
    client, engine, owner, employee = workspace
    profile(client, owner)
    advance = checked(
        command(client, employee, "request_advance", amountPaise=60_001, reason="Family expense")
    )["advances"][0]
    assert (
        command(
            client,
            owner,
            "pay_advance",
            targetId=advance["id"],
            amountPaise=60_001,
            reference="ADV1",
            reason="Paid by bank",
        ).status_code
        == 409
    )
    checked(
        command(
            client,
            owner,
            "review_advance",
            targetId=advance["id"],
            expectedVersion=1,
            decision="approved",
            reason="Approved requested amount",
        )
    )
    # Payment must be after the actual approval (the test clock starts before wall time).
    with engine.connect() as c:
        approved_at = c.execute(text("SELECT created_at FROM workforce_request_reviews")).scalar_one()
    clock[0] = approved_at + timedelta(seconds=1)
    # Use the real local day for this independent advance, then test a later completed pay day.
    checked(
        command(
            client,
            owner,
            "pay_advance",
            targetId=advance["id"],
            amountPaise=60_001,
            reference="ADV1",
            reason="Paid by bank",
        )
    )
    clock[0] = datetime(2026, 11, 16, 5, 0, tzinfo=UTC)
    checked(
        command(
            client,
            owner,
            "save_advance_plan",
            asOf="2026-11-16",
            planMode="split",
            installments=3,
            reason="Agreed three salaries",
        )
    )
    finish_day(client, owner, employee, clock)
    p = checked(preview(client, owner, "2026-11-16"))
    assert p["advanceRecoveryPaise"] == 20_001 and p["netPaise"] == 80_000
    assert confirm(client, employee, p).status_code == 403
    stale = p["fingerprint"]
    checked(
        command(
            client,
            owner,
            "save_advance_plan",
            asOf="2026-11-16",
            planMode="partial",
            amountPaise=10_000,
            reason="Revised recovery agreement",
        )
    )
    assert confirm(client, owner, p).status_code == 409
    p = checked(preview(client, owner, "2026-11-16"))
    assert p["fingerprint"] != stale
    result = checked(confirm(client, owner, p))
    s = result["salaries"][0]
    assert result["advanceBalancePaise"] == 50_001
    body = {
        "commandId": str(uuid4()),
        "action": "pay_salary",
        "targetId": s["id"],
        "amountPaise": s["snapshot"]["netPaise"],
        "reference": "SAL1",
        "reason": "Completed bank payment",
    }
    path = f"/v1/workforce/{IDS['employee']}/commands"
    with ThreadPoolExecutor(max_workers=2) as pool:
        responses = list(pool.map(lambda _: client.post(path, headers=owner, json=body), range(2)))
    assert all(r.status_code == 200 for r in responses)
    paid = responses[0].json()
    assert paid["salaries"][0]["status"] == "paid"
    assert (
        command(
            client,
            owner,
            "pay_salary",
            targetId=s["id"],
            amountPaise=1,
            reference="SAL2",
            reason="Overpayment",
        ).status_code
        == 409
    )
    assert (
        command(client, owner, "void_salary", targetId=s["id"], reason="Wrong statement").status_code == 409
    )
    payment = next(e for e in paid["payments"] if e["kind"] == "salary_payment")
    checked(
        command(client, owner, "reverse_payment", targetId=payment["id"], reason="Incorrect bank reference")
    )
    voided = checked(
        command(client, owner, "void_salary", targetId=s["id"], reason="Return for corrected pay")
    )
    assert voided["advanceBalancePaise"] == 60_001 and voided["salaries"][0]["status"] == "void"
    with pytest.raises(DBAPIError), engine.begin() as c:
        c.execute(text("DELETE FROM salary_statements"))
    with pytest.raises(DBAPIError), engine.begin() as c:
        c.execute(text("UPDATE workforce_pay_events SET amount_paise=0"))


def test_private_proofs_normalization_and_supervisor_policy_scope(workspace, clock):
    client, engine, owner, employee = workspace
    id = uuid4()
    data = jpeg()
    path = f"/v1/workforce/proofs/{id}"
    checked(client.post(path, headers=employee, files={"file": ("selfie.jpg", data, "image/jpeg")}), 201)
    assert client.get(path + "/file", headers=owner).status_code == 200
    assert (
        client.post(
            f"/v1/workforce/proofs/{uuid4()}",
            headers=employee,
            files={"file": ("big.jpg", jpeg(2000, 2000), "image/jpeg")},
        ).status_code
        == 400
    )
    checked(policy(client, owner, selfieRequired=True))
    assert command(client, employee, "punch_in", punch={}).status_code == 409
    # Uploaded proof times and server clock must agree; metadata is never a time override.
    with engine.begin() as c:
        created = c.execute(
            text("SELECT created_at FROM attendance_proofs WHERE id=:id"), {"id": id}
        ).scalar_one()
    clock[0] = created + timedelta(seconds=1)
    checked(command(client, employee, "punch_in", punch={"proofId": str(id)}))
    roles(engine, ["supervisor"])
    assert len(get(client, employee)["people"]) >= 2
    assert (
        client.post(
            "/v1/workforce/policy",
            headers=employee,
            json={
                "commandId": str(uuid4()),
                "expectedVersion": 1,
                "policy": get(client, owner)["policy"],
                "reason": "Unauthorized policy",
            },
        ).status_code
        == 403
    )


def test_paid_holiday_and_leave_allowance_never_mark_off_days_absent(workspace, clock):
    client, _, owner, employee = workspace
    profile(client, owner)
    checked(
        policy(
            client,
            owner,
            paidLeaveHalfDays=2,
            holidays=[{"day": "2026-11-02", "name": "Company holiday", "paid": True}],
        )
    )
    clock[0] = datetime(2026, 11, 3, 5, 0, tzinfo=UTC)
    p = checked(preview(client, owner))
    assert p["netPaise"] == 100_001 and not p["blockers"]
    leave = checked(
        command(
            client,
            employee,
            "request_leave",
            start="2026-11-03",
            end="2026-11-03",
            paid=True,
            reason="Personal leave",
        )
    )["leaves"][-1]
    checked(
        command(
            client,
            owner,
            "review_leave",
            targetId=leave["id"],
            expectedVersion=1,
            decision="approved",
            reason="Approved within allowance",
        )
    )
    other = checked(
        command(
            client,
            employee,
            "request_leave",
            start="2026-11-04",
            end="2026-11-04",
            paid=True,
            reason="Additional leave",
        )
    )["leaves"][-1]
    assert (
        command(
            client,
            owner,
            "review_leave",
            targetId=other["id"],
            expectedVersion=1,
            decision="approved",
            reason="Exceeds current allowance",
        ).status_code
        == 409
    )
    assert get(client, employee)["leaveUsedHalfDays"] == 2
    assert all(p["attendanceStatus"] == "off_day" for p in get(client, owner, day="2026-11-02")["people"])


def test_salary_confirmation_race_and_privileged_replay_revocation(workspace, clock):
    client, engine, owner, employee = workspace
    profile(client, owner)
    finish_day(client, owner, employee, clock)
    p = checked(preview(client, owner))
    with ThreadPoolExecutor(max_workers=2) as pool:
        responses = list(pool.map(lambda _: confirm(client, owner, p), range(2)))
    assert sorted(r.status_code for r in responses) == [200, 409]
    with engine.connect() as c:
        assert c.execute(text("SELECT count(*) FROM salary_statements")).scalar_one() == 1
    assert (
        command(
            client,
            owner,
            "save_profile",
            expectedVersion=1,
            terms={"effectiveFrom": "2026-11-02", "basis": "daily", "cycle": "daily", "ratePaise": 200_000},
            reason="Cannot rewrite issued pay",
        ).status_code
        == 409
    )
    roles(engine, ["supervisor"])
    body = {
        "commandId": str(uuid4()),
        "action": "request_advance",
        "amountPaise": 100,
        "reason": "Scoped request",
    }
    path = f"/v1/workforce/{IDS['employee']}/commands"
    result = checked(client.post(path, headers=employee, json=body))
    request = result["advances"][0]
    decision = {
        "commandId": str(uuid4()),
        "action": "review_advance",
        "targetId": request["id"],
        "expectedVersion": 1,
        "reason": "Authorized supervisor decision",
    }
    checked(client.post(path, headers=employee, json=decision))
    roles(engine, ["inspector"])
    assert client.post(path, headers=employee, json=decision).status_code == 403


def test_worker_missing_boundary_has_honest_system_attribution(workspace, clock, tmp_path):
    from app.adapters.operations import OperationsStore
    from app.adapters.workflows import WorkflowStore

    client, engine, owner, employee = workspace
    checked(command(client, employee, "punch_in", punch={}))
    with pytest.raises(DBAPIError), engine.begin() as c:
        c.execute(text("UPDATE attendance_sessions SET punched_in_at=punched_in_at-interval '1 hour'"))
    clock[0] = datetime(2026, 11, 3, 5, 0, tzinfo=UTC)
    store = WorkforceStore(WorkflowStore(OperationsStore(engine)), tmp_path)
    assert store.close_missing() == 1 and store.close_missing() == 0
    state = get(client, owner)
    s = state["attendance"][0]
    assert s["punchedOutAt"] is None and s["minutes"] is None and s["status"] == "missed_out"
    with engine.connect() as c:
        assert (
            c.execute(
                text("SELECT count(*) FROM system_events WHERE action='workforce.missing_out'")
            ).scalar_one()
            == 1
        )
        assert (
            c.execute(text("SELECT count(*) FROM workforce_events WHERE kind='missing_out'")).scalar_one()
            == 0
        )
    with pytest.raises(DBAPIError), engine.begin() as c:
        c.execute(text("DELETE FROM attendance_sessions"))


def test_shift_reminders_deduplicate_and_stop_after_punch_out(workspace, clock, tmp_path):
    from app.adapters.operations import OperationsStore
    from app.adapters.workflows import WorkflowStore

    client, engine, _, employee = workspace
    first = checked(command(client, employee, "punch_in", punch={}))["attendance"][0]
    clock[0] = datetime(2026, 11, 2, 14, 10, tzinfo=UTC)
    store = WorkforceStore(WorkflowStore(OperationsStore(engine)), tmp_path)
    store.remind()
    store.remind()
    with engine.connect() as c:
        count = c.execute(
            text("SELECT count(*) FROM notifications WHERE kind='workforce.punch_out_due'")
        ).scalar_one()
    assert count == 1
    clock[0] += timedelta(minutes=1)
    checked(command(client, employee, "punch_out", sessionId=first["id"], expectedVersion=1, punch={}))
    store.remind()
    with engine.connect() as c:
        assert (
            c.execute(
                text("SELECT count(*) FROM notifications WHERE kind='workforce.punch_out_due'")
            ).scalar_one()
            == count
        )


def test_employee_cannot_read_another_persons_attendance_photo(workspace, clock):
    client, _, owner, employee = workspace
    id = uuid4()
    path = f"/v1/workforce/proofs/{id}"
    checked(client.post(path, headers=owner, files={"file": ("photo.jpg", jpeg(), "image/jpeg")}), 201)
    assert client.get(path + "/file", headers=employee).status_code == 403
    assert (
        client.get(
            f"/v1/workforce/{IDS['owner']}/preview", headers=employee, params={"as_of": "2026-11-02"}
        ).status_code
        == 403
    )


def test_shift_selfie_policy_snapshot_survives_settings_change(workspace, clock):
    client, _, owner, employee = workspace
    first = checked(command(client, employee, "punch_in", punch={}))["attendance"][0]
    assert first["selfieRequired"] is False
    checked(policy(client, owner, selfieRequired=True))
    clock[0] += timedelta(hours=8)
    result = checked(
        command(client, employee, "punch_out", sessionId=first["id"], expectedVersion=1, punch={})
    )
    assert result["attendance"][0]["status"] == "closed" and result["attendance"][0]["policyVersion"] == 0


def test_workforce_decisions_join_the_shared_owner_queue_and_count(workspace, clock):
    client, _, owner, employee = workspace
    before = checked(client.get("/v1/decisions", headers=owner))["total"]
    leave = checked(
        command(
            client,
            employee,
            "request_leave",
            start="2026-11-03",
            end="2026-11-03",
            reason="Requested day away",
        )
    )["leaves"][0]
    queue = checked(client.get("/v1/decisions", headers=owner))
    item = next(i for i in queue["items"] if i["kind"] == "workforce_leave")
    assert queue["total"] == before + 1 and item["subjectLabel"] == "Ravi" and item["carId"] is None
    assert item["targetType"] == "workforce" and item["targetId"] == str(IDS["employee"])
    assert checked(client.get("/v1/dashboard", headers=owner))["decisions"] == queue["total"]
    checked(
        command(
            client,
            owner,
            "review_leave",
            targetId=leave["id"],
            expectedVersion=1,
            decision="approved",
            reason="Reviewed leave approval",
        )
    )
    assert checked(client.get("/v1/decisions", headers=owner))["total"] == before


def test_owner_can_settle_approved_advance_after_employee_offboarding(workspace, clock):
    client, engine, owner, employee = workspace
    advance = checked(
        command(client, employee, "request_advance", amountPaise=10_000, reason="Approved before offboarding")
    )["advances"][0]
    checked(
        command(
            client,
            owner,
            "review_advance",
            targetId=advance["id"],
            expectedVersion=1,
            decision="approved",
            reason="Reviewed settlement",
        )
    )
    with engine.begin() as c:
        c.execute(text("UPDATE users SET active=false WHERE id=:id"), {"id": IDS["employee"]})
        approval = c.execute(
            text("SELECT created_at FROM workforce_request_reviews WHERE request_id=:id"),
            {"id": advance["id"]},
        ).scalar_one()
    clock[0] = approval + timedelta(seconds=1)
    assert command(client, employee, "punch_in", punch={}).status_code == 401
    result = checked(
        command(
            client,
            owner,
            "pay_advance",
            targetId=advance["id"],
            amountPaise=10_000,
            reference="FINAL-ADVANCE",
            reason="Record approved final settlement",
        )
    )
    assert result["advanceBalancePaise"] == 10_000 and result["advances"][0]["status"] == "paid"


def test_salary_due_reminders_do_not_post_money_and_are_deduplicated(workspace, clock, tmp_path):
    from app.adapters.operations import OperationsStore
    from app.adapters.workflows import WorkflowStore

    client, engine, owner, _ = workspace
    profile(client, owner)
    clock[0] = datetime(2026, 11, 3, 5, 0, tzinfo=UTC)
    store = WorkforceStore(WorkflowStore(OperationsStore(engine)), tmp_path)
    store.remind()
    store.remind()
    with engine.connect() as conn:
        assert (
            conn.execute(
                text("SELECT count(*) FROM notifications WHERE kind='workforce.salary_due'")
            ).scalar_one()
            == 2
        )
        assert conn.execute(text("SELECT count(*) FROM salary_statements")).scalar_one() == 0
        assert conn.execute(text("SELECT count(*) FROM workforce_pay_events")).scalar_one() == 0
