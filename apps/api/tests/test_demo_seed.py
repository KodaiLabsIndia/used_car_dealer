from datetime import date, timedelta
from functools import partial

import pytest
from sqlalchemy import text
from test_integration import checked
from test_integration import workspace as workspace
from workspace_seed import IDS

from app.demo.builder import DemoBuilder
from app.demo.core import DemoConfig, uid
from app.demo.ingest import seed_demo

PASSWORD = "isolated-demo-test-only-password"


def sign_in(client, account):
    session = checked(
        client.post(
            "/v1/auth/dev-session", json={"account": account, "accessCode": "integration-access-code"}
        )
    )
    return {"Authorization": "Bearer " + session["token"]}


def test_demo_is_connected_complete_and_idempotent(workspace, tmp_path):
    client, engine, old_owner, _ = workspace
    config = DemoConfig.load()
    anchor = date(2026, 11, 8)
    result = seed_demo(engine, tmp_path, anchor, config, PASSWORD, reset=True)
    ids = partial(uid, namespace=result["generation"])
    assert result["counts"]["cars"] == 11 and result["counts"]["staff"] == 6
    assert result["counts"]["photos"] > 1500 and result["counts"]["clips"] > 0
    assert result["counts"]["salaryStatements"] == 7
    assert result["assistantSampleId"]

    owner = sign_in(client, "owner")
    employee = sign_in(client, "employee")
    assert checked(client.get("/v1/me", headers=employee))["id"] == str(IDS["employee"])
    assert client.get("/v1/me", headers=old_owner).status_code == 401
    assistant = checked(client.get("/v1/assistant/drafts/" + result["assistantSampleId"], headers=owner))
    assert assistant["model"] == "demo-fixture-no-model-call" and assistant["inputTokens"] == 0
    assert not assistant["stale"] and assistant["content"]["summary"].startswith("Demo sample")
    assert (
        client.get("/v1/assistant/drafts/" + result["assistantSampleId"], headers=employee).status_code == 404
    )
    supervisor_session = checked(
        client.post("/v1/auth/login", json={"username": "meena", "secret": PASSWORD})
    )
    supervisor = {"Authorization": "Bearer " + supervisor_session["token"]}
    assert not supervisor_session["mustChangeSecret"]
    assert client.get("/v1/people", headers=supervisor).status_code == 200
    assert client.get("/v1/team", headers=supervisor).status_code == 403
    office_session = checked(client.post("/v1/auth/login", json={"username": "nisha", "secret": PASSWORD}))
    office = {"Authorization": "Bearer " + office_session["token"]}
    assert client.get("/v1/cars/" + str(ids("car:ready")) + "/documents", headers=office).status_code == 200
    assert client.get("/v1/cars/" + str(ids("car:ready")) + "/business", headers=office).status_code == 403

    dashboard = checked(client.get("/v1/dashboard", headers=owner))
    assert dashboard["cars"] == 11 and dashboard["booked"] == 1
    assert dashboard["decisions"] >= 8
    assert len(checked(client.get("/v1/team", headers=owner))["items"]) == 6
    assert (
        client.get("/v1/workforce", headers=employee, params={"user_id": str(ids("service"))}).status_code
        == 403
    )
    inspections = checked(client.get("/v1/tasks", headers=employee))["items"]
    assert any(t["collaborative"] and len(t["items"]) == 229 for t in inspections)
    assert all(t["kind"] != "reference" for t in inspections)
    first = next(t for t in inspections if t["carId"] == str(ids("car:inspection")))
    assert first["status"] == "recheck" and first["recheckItems"]
    proof = first["evidence"][0]
    assert client.get("/v1/evidence/" + proof["id"], headers=employee).status_code == 200
    assert client.get("/v1/cars/" + str(ids("car:ready")) + "/business", headers=employee).status_code == 403
    for car in result["cars"]:
        for suffix in ["", "/history", "/business", "/documents", "/stock"]:
            assert client.get("/v1/cars/" + car["carId"] + suffix, headers=owner).status_code == 200
    support = checked(client.get("/v1/cars/" + str(ids("car:warranty_service")) + "/business", headers=owner))
    assert support["car"]["commercialStatus"] == "sold" and support["claims"][0]["status"] == "approved"
    assert support["bookings"][0]["delivery"]["warranty"]["durationMonths"] == 12
    refund = checked(client.get("/v1/cars/" + str(ids("car:ready")) + "/business", headers=owner))
    assert refund["bookings"][0]["refundDuePaise"] == 500000
    assert client.get("/v1/purchases", headers=employee).status_code == 403
    files = {p.name: p.stat().st_mtime_ns for p in tmp_path.glob("demo-*")}
    noop = seed_demo(engine, tmp_path, anchor, config, PASSWORD)
    assert noop["unchanged"] and noop["generation"] == result["generation"]
    assert {p.name: p.stat().st_mtime_ns for p in tmp_path.glob("demo-*")} == files
    assert client.get("/v1/me", headers=owner).status_code == 200
    with engine.connect() as conn:
        assert (
            conn.execute(
                text("SELECT count(*) FROM vehicles WHERE id=:id"), {"id": IDS["sonet"]}
            ).scalar_one()
            == 0
        )


@pytest.mark.parametrize("after", [date(2028, 2, 29), date(2027, 1, 1)])
def test_reingest_reanchors_dates_and_removes_previous_demo_media(workspace, tmp_path, after):
    _, engine, _, _ = workspace
    config = DemoConfig.load()
    before = date(2026, 11, 8)
    first = seed_demo(engine, tmp_path, before, config, PASSWORD, reset=True)
    old_ids = partial(uid, namespace=first["generation"])
    original_files = set(tmp_path.glob("demo-*"))
    with engine.connect() as conn:
        old_due = conn.execute(
            text("SELECT due_at FROM tasks WHERE id=:id"), {"id": old_ids("task:inspection:pre_purchase")}
        ).scalar_one()
    with pytest.raises(RuntimeError, match="--reset"):
        seed_demo(engine, tmp_path, after, config, PASSWORD)
    second = seed_demo(engine, tmp_path, after, config, PASSWORD, reset=True)
    new_ids = partial(uid, namespace=second["generation"])
    assert second["asOf"] == after.isoformat() and first["generation"] != second["generation"]
    assert not any(p.exists() for p in original_files)
    with engine.connect() as conn:
        new_due = conn.execute(
            text("SELECT due_at FROM tasks WHERE id=:id"), {"id": new_ids("task:inspection:pre_purchase")}
        ).scalar_one()
        assert new_due - old_due == timedelta(days=(after - before).days)
        statement = conn.execute(
            text("SELECT period_start,period_end,created_at FROM salary_statements WHERE user_id=:user"),
            {"user": new_ids("owner")},
        ).one()
        expected_end = after.replace(day=1) - timedelta(days=1)
        assert statement.period_start == expected_end.replace(day=1) and statement.period_end == expected_end
        assert statement.created_at.date() > statement.period_end
        assert conn.execute(text("SELECT count(*) FROM stock_cycles")).scalar_one() == 11
        assert old_ids("task:inspection:pre_purchase") != new_ids("task:inspection:pre_purchase")
        assert (
            conn.execute(
                text("SELECT count(*) FROM tasks WHERE id=:old"),
                {"old": old_ids("task:inspection:pre_purchase")},
            ).scalar_one()
            == 0
        )


def test_failed_demo_reset_rolls_back_database_and_generated_files(workspace, tmp_path, monkeypatch):
    client, engine, owner, _ = workspace
    preserved = tmp_path / "original-proof.jpg"
    preserved.write_bytes(b"original bytes")

    def fail(self):
        raise RuntimeError("Injected fixture validation failure")

    monkeypatch.setattr(DemoBuilder, "validate", fail)
    with pytest.raises(RuntimeError, match="Injected fixture"):
        seed_demo(engine, tmp_path, date(2026, 11, 8), DemoConfig.load(), PASSWORD, reset=True)
    assert preserved.read_bytes() == b"original bytes"
    assert not list(tmp_path.glob("demo-*"))
    assert checked(client.get("/v1/dashboard", headers=owner))["cars"] == 2


def test_reset_refuses_unknown_company_data(workspace, tmp_path):
    _, engine, _, _ = workspace
    with engine.begin() as conn:
        conn.execute(
            text("UPDATE companies SET name='Actual dealer data' WHERE id=:id"), {"id": IDS["company"]}
        )
    with pytest.raises(RuntimeError, match="non-demo"):
        seed_demo(engine, tmp_path, date(2026, 11, 8), DemoConfig.load(), PASSWORD, reset=True)
    with engine.connect() as conn:
        assert conn.execute(text("SELECT count(*) FROM stock_cycles")).scalar_one() == 2


def test_cleanup_failure_preserves_committed_demo(workspace, tmp_path, monkeypatch, caplog):
    client, engine, _, _ = workspace
    prior = tmp_path / "undeletable-old-proof.jpg"
    prior.write_bytes(b"prior proof")
    original_unlink = type(prior).unlink

    def unlink(path, *args, **kwargs):
        if path == prior:
            raise PermissionError("Injected cleanup failure")
        return original_unlink(path, *args, **kwargs)

    monkeypatch.setattr(type(prior), "unlink", unlink)
    result = seed_demo(engine, tmp_path, date(2026, 11, 8), DemoConfig.load(), PASSWORD, reset=True)
    assert result["counts"]["cars"] == 11
    assert "could not remove prior media" in caplog.text
    assert prior.exists() and list(tmp_path.glob("demo-*"))
    owner = sign_in(client, "owner")
    assert checked(client.get("/v1/dashboard", headers=owner))["cars"] == 11
    task = checked(client.get("/v1/tasks/" + result["cars"][0]["taskIds"]["pre_purchase"], headers=owner))
    assert client.get("/v1/evidence/" + task["evidence"][0]["id"], headers=owner).status_code == 200
