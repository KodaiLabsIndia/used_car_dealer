from datetime import UTC, datetime, timedelta
from uuid import uuid4

from sqlalchemy import text
from test_commercial import acquired, book, business, change
from test_integration import checked, command
from test_integration import workspace as workspace

from app.adapters.notifications import NotificationStore
from app.seed import IDS


def test_outbox_delivery_is_idempotent_scoped_and_failed_events_are_bounded(workspace):
    client, engine, owner, employee = workspace
    worker = NotificationStore(engine)
    task = checked(client.get(f"/v1/tasks/{IDS['employee_task']}", headers=employee))
    checked(command(client, employee, task["id"], "help", task["version"], note="Need a demonstration"))
    assert worker.drain() == 1
    inbox = checked(client.get("/v1/notifications", headers=owner))
    assert inbox["unread"] == 1 and inbox["items"][0]["targetId"] == task["id"]
    assert checked(client.get("/v1/notifications", headers=employee))["unread"] == 0
    assert worker.drain() == 0
    bad = uuid4()
    with engine.begin() as conn:
        conn.execute(
            text(
                "INSERT INTO outbox(id,company_id,kind,payload,attempts) VALUES(:id,:company,'task.help','{\"taskId\":\"invalid\"}'::jsonb,7)"
            ),
            {"id": bad, "company": IDS["company"]},
        )
    assert worker.drain() == 0
    with engine.connect() as conn:
        event = (
            conn.execute(text("SELECT attempts,failed_at,last_error FROM outbox WHERE id=:id"), {"id": bad})
            .mappings()
            .one()
        )
        assert event["attempts"] == 8 and event["failed_at"] is not None and event["last_error"]
    assert worker.drain() == 0


def test_reminders_deduplicate_and_mark_read_respects_cutoff(workspace):
    client, engine, owner, employee = workspace
    worker = NotificationStore(engine)
    with engine.begin() as conn:
        conn.execute(
            text("UPDATE tasks SET due_at=now()-interval '1 hour' WHERE id=:id"), {"id": IDS["employee_task"]}
        )
    worker.reminders()
    worker.reminders()
    inbox = checked(client.get("/v1/notifications", headers=employee))
    assert inbox["unread"] == 1
    with engine.begin() as conn:
        worker.add(
            conn, IDS["company"], IDS["employee"], "task.help", "task", IDS["employee_task"], "later-event"
        )
    assert (
        client.post(
            "/v1/notifications/read",
            headers=owner,
            json={"through": inbox["cutoff"], "notificationId": inbox["items"][0]["id"]},
        ).status_code
        == 204
    )
    assert checked(client.get("/v1/notifications", headers=employee))["unread"] == 2
    checked_response = client.post(
        "/v1/notifications/read", headers=employee, json={"through": inbox["cutoff"]}
    )
    assert checked_response.status_code == 204
    assert checked(client.get("/v1/notifications", headers=employee))["unread"] == 1
    assert (
        checked(client.get("/v1/notifications?unread_only=true", headers=employee))["items"][0]["kind"]
        == "task.help"
    )


def test_booking_expiry_releases_stock_retains_refund_liability_and_system_actor(workspace):
    client, engine, owner, _ = workspace
    current = book(client, owner, acquired(client, owner), acknowledgeNotReady=True)
    booking = current["bookings"][0]
    current = checked(
        change(
            client,
            owner,
            current,
            "sale_receipt",
            bookingId=booking["id"],
            amountPaise=100000,
            reference="EXPIRY-DEPOSIT",
            occurredAt=(datetime.now(UTC) - timedelta(minutes=1)).isoformat(),
        )
    )
    current = checked(
        change(
            client,
            owner,
            current,
            "extend_booking",
            bookingId=booking["id"],
            expiresAt=(datetime.now(UTC) + timedelta(days=4)).isoformat(),
            reason="Buyer requested additional finance time",
        )
    )
    with engine.begin() as conn:
        conn.execute(
            text("UPDATE sale_bookings SET expires_at=now()-interval '1 minute' WHERE id=:id"),
            {"id": booking["id"]},
        )
    worker = NotificationStore(engine)
    assert worker.expire_bookings() == 1 and worker.expire_bookings() == 0
    current = business(client, owner, current["car"]["id"])
    assert current["car"]["commercialStatus"] == "available"
    assert (
        current["bookings"][0]["status"] == "cancelled" and current["bookings"][0]["refundDuePaise"] == 100000
    )
    assert (
        change(
            client,
            owner,
            current,
            "extend_booking",
            bookingId=booking["id"],
            expiresAt=(datetime.now(UTC) + timedelta(days=5)).isoformat(),
            reason="Too late",
        ).json()["error"]["code"]
        == "BOOKING_CLOSED"
    )
    history = checked(client.get(f"/v1/cars/{current['car']['id']}/history", headers=owner))["items"]
    assert any(e["actorName"] == "Automation" and e["action"] == "business.hold_expired" for e in history)
    inbox = checked(client.get("/v1/notifications", headers=owner))
    assert any(n["kind"] == "booking.expired" for n in inbox["items"])
