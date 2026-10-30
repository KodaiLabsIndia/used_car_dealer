from concurrent.futures import ThreadPoolExecutor
from datetime import UTC, datetime, timedelta
from uuid import uuid4

import pytest
from sqlalchemy import text
from sqlalchemy.exc import DBAPIError
from test_integration import checked, command, fill_inspection
from test_integration import workspace as workspace
from test_purchases import DOCUMENTS, approve, payment, prepare, purchase_command

from app.seed import IDS


def business(client, owner, car_id):
    return checked(client.get(f"/v1/cars/{car_id}/business", headers=owner))


def change(client, owner, current, action, command_id=None, **extra):
    if action == "deliver":
        extra = {
            "keyCount": 2,
            "accessories": "Training toolkit",
            "customerPromises": "Training handover only",
            "customerAcknowledged": True,
            **extra,
        }
    return client.post(
        f"/v1/cars/{current['car']['id']}/business/commands",
        headers=owner,
        json={
            "commandId": str(command_id or uuid4()),
            "expectedVersion": current["car"]["version"],
            "action": action,
            **extra,
        },
    )


def acquired(client, owner, registration="MH01AB1234"):
    purchase, _ = prepare(client, owner, registration=registration)
    purchase = approve(client, owner, purchase)
    purchase = checked(purchase_command(client, owner, purchase, "documents", documents=DOCUMENTS))
    purchase = checked(
        purchase_command(client, owner, purchase, "acquire", agreementReference="AGR-" + registration)
    )
    templates = checked(client.get("/v1/checklists", headers=owner))["items"]
    intake = next(t for t in templates if t["kind"] == "intake")
    purchase = checked(
        purchase_command(
            client,
            owner,
            purchase,
            "receive",
            receipt={
                "location": "Yard",
                "odometerKm": 42010,
                "fuel": "half",
                "keyCount": 2,
                "accessories": "Toolkit",
                "conditionNote": "",
                "hasNewIssue": False,
                "handoverReference": "H-" + registration,
                "templateId": intake["id"],
                "assignedTo": str(IDS["owner"]),
            },
        )
    )
    task = fill_inspection(
        client, owner, checked(client.get(f"/v1/tasks/{purchase['intakeTaskId']}", headers=owner))
    )
    checked(command(client, owner, task["id"], "review", version=task["version"], decision="accept"))
    purchase = checked(client.get(f"/v1/purchases/{purchase['id']}", headers=owner))
    purchase = checked(
        payment(client, owner, purchase, amount=purchase["balancePaise"], reference="SELLER-" + registration)
    )
    return business(client, owner, purchase["carId"])


def book(client, owner, current, **extra):
    return checked(
        change(
            client,
            owner,
            current,
            "book",
            customerName="Training buyer",
            customerPhone="9000000000",
            salePricePaise=65000000,
            expiresAt=(datetime.now(UTC) + timedelta(days=3)).isoformat(),
            **extra,
        )
    )


def delivered(client, owner, current, warranty=True):
    current = checked(change(client, owner, current, "mark_ready", acknowledgeDraftChecklist=True))
    current = book(client, owner, current)
    booking = current["bookings"][0]
    current = checked(
        change(
            client,
            owner,
            current,
            "sale_receipt",
            bookingId=booking["id"],
            amountPaise=65000000,
            reference="BUYER-001",
            occurredAt=datetime.now(UTC).isoformat(),
        )
    )
    current = checked(
        change(
            client,
            owner,
            current,
            "sale_documents",
            bookingId=booking["id"],
            documents={
                "buyerVerified": True,
                "registrationReady": True,
                "saleAgreementReference": "SALE-001",
            },
        )
    )
    template = next(
        t for t in checked(client.get("/v1/checklists", headers=owner))["items"] if t["kind"] == "delivery"
    )
    task = checked(
        client.post(
            f"/v1/cars/{current['car']['id']}/inspections",
            headers=owner,
            json={"commandId": str(uuid4()), "templateId": template["id"], "assignedTo": str(IDS["owner"])},
        ),
        201,
    )
    task = fill_inspection(client, owner, task)
    checked(command(client, owner, task["id"], "review", version=task["version"], decision="accept"))
    current = business(client, owner, current["car"]["id"])
    terms = (
        {
            "until": (datetime.now(UTC) + timedelta(days=90)).isoformat(),
            "odometerLimitKm": 47010,
            "terms": "Written training warranty, reviewed by owner",
            "provider": "Training dealer",
            "policyReference": "TRAINING-v1",
            "exclusions": "Training policy only",
            "noWarrantyAcknowledged": False,
        }
        if warranty
        else {"until": None, "odometerLimitKm": None, "terms": "", "noWarrantyAcknowledged": True}
    )
    return checked(
        change(
            client,
            owner,
            current,
            "deliver",
            bookingId=booking["id"],
            odometerKm=42020,
            receiptReference="SIGNED-001",
            transferDueAt=(datetime.now(UTC) + timedelta(days=20)).isoformat(),
            warranty=terms,
            acknowledgeDraftChecklist=True,
        )
    )


def test_readiness_costs_permissions_and_exact_corrections(workspace):
    client, engine, owner, employee = workspace
    current = business(client, owner, IDS["seltos"])
    assert client.get(f"/v1/cars/{IDS['seltos']}/business", headers=employee).status_code == 403
    assert change(client, employee, current, "mark_ready").status_code == 403
    assert change(client, owner, current, "mark_ready").json()["error"]["code"] == "READINESS_BLOCKED"
    assert client.get(f"/v1/cars/{uuid4()}/business", headers=owner).status_code == 404
    current = acquired(client, owner)
    assert all(c["clear"] for c in current["readiness"])
    assert change(client, owner, current, "mark_ready").json()["error"]["code"] == "CHECKLIST_NOT_APPROVED"
    cost = {
        "category": "parts",
        "amountPaise": 320025,
        "reference": " BILL-001 ",
        "occurredAt": datetime.now(UTC).isoformat(),
    }
    key = uuid4()
    posted = checked(change(client, owner, current, "cost", command_id=key, **cost))
    assert checked(change(client, owner, current, "cost", command_id=key, **cost)) == posted
    assert posted["runningCostPaise"] == 320025 and posted["investedPaise"] == 50320050
    assert (
        change(client, owner, posted, "cost", **(cost | {"reference": "bill-001"})).json()["error"]["code"]
        == "DUPLICATE_REFERENCE"
    )
    assert (
        change(
            client, owner, posted, "cost", **(cost | {"reference": "BILL-002", "amountPaise": 3.5})
        ).status_code
        == 400
    )
    assert (
        change(client, owner, current, "mark_ready", acknowledgeDraftChecklist=True).json()["error"]["code"]
        == "VERSION_CONFLICT"
    )
    corrected = checked(
        change(
            client,
            owner,
            posted,
            "reverse_entry",
            entryId=posted["ledger"][0]["id"],
            reason="Incorrect bill amount",
        )
    )
    assert corrected["runningCostPaise"] == 0 and corrected["ledger"][0]["reversedAt"]
    with pytest.raises(DBAPIError):
        with engine.begin() as conn:
            conn.execute(text("DELETE FROM vehicle_ledger"))


def test_booking_concurrency_cancellation_and_refund_balances(workspace):
    client, _, owner, _ = workspace
    current = acquired(client, owner)
    assert (
        change(
            client,
            owner,
            current,
            "book",
            customerName="Buyer",
            salePricePaise=65000000,
            expiresAt=(datetime.now(UTC) + timedelta(days=1)).isoformat(),
        ).json()["error"]["code"]
        == "NOT_READY_ACK_REQUIRED"
    )
    with ThreadPoolExecutor(max_workers=2) as pool:
        responses = list(
            pool.map(
                lambda _: change(
                    client,
                    owner,
                    current,
                    "book",
                    customerName="Buyer",
                    salePricePaise=65000000,
                    expiresAt=(datetime.now(UTC) + timedelta(days=1)).isoformat(),
                    acknowledgeNotReady=True,
                ),
                range(2),
            )
        )
    assert sorted(r.status_code for r in responses) == [200, 409]
    current = next(r.json() for r in responses if r.status_code == 200)
    booking = current["bookings"][0]
    assert current["car"]["commercialStatus"] == "booked"
    current = checked(
        change(
            client,
            owner,
            current,
            "sale_receipt",
            bookingId=booking["id"],
            amountPaise=1000001,
            reference="DEPOSIT-01",
            occurredAt=datetime.now(UTC).isoformat(),
        )
    )
    assert (
        change(
            client,
            owner,
            current,
            "sale_refund",
            bookingId=booking["id"],
            amountPaise=1,
            reference="REF-0",
            occurredAt=datetime.now(UTC).isoformat(),
        ).json()["error"]["code"]
        == "CANCEL_FIRST"
    )
    current = checked(
        change(
            client, owner, current, "cancel_booking", bookingId=booking["id"], reason="Buyer changed plans"
        )
    )
    assert (
        current["bookings"][0]["refundDuePaise"] == 1000001
        and current["car"]["commercialStatus"] == "available"
    )
    assert (
        change(
            client,
            owner,
            current,
            "sale_refund",
            bookingId=booking["id"],
            amountPaise=1000002,
            reference="REF-OVER",
            occurredAt=datetime.now(UTC).isoformat(),
        ).json()["error"]["code"]
        == "OVER_REFUND"
    )
    current = checked(
        change(
            client,
            owner,
            current,
            "sale_refund",
            bookingId=booking["id"],
            amountPaise=1000001,
            reference="REF-01",
            occurredAt=datetime.now(UTC).isoformat(),
        )
    )
    assert current["bookings"][0]["refundDuePaise"] == 0
    receipt = next(e for e in current["ledger"] if e["kind"] == "receipt")
    assert (
        change(client, owner, current, "reverse_entry", entryId=receipt["id"], reason="Wrong receipt").json()[
            "error"
        ]["code"]
        == "REFUND_RECONCILIATION"
    )


def test_delivery_gates_transfer_and_immutable_handover(workspace):
    client, engine, owner, _ = workspace
    current = acquired(client, owner)
    current = checked(change(client, owner, current, "mark_ready", acknowledgeDraftChecklist=True))
    current = book(client, owner, current)
    assert (
        change(
            client,
            owner,
            current,
            "deliver",
            bookingId=current["bookings"][0]["id"],
            odometerKm=42020,
            receiptReference="SIGNED",
            transferDueAt=(datetime.now(UTC) + timedelta(days=20)).isoformat(),
            warranty={"noWarrantyAcknowledged": True},
            acknowledgeDraftChecklist=True,
        ).json()["error"]["code"]
        == "DELIVERY_PDI_REQUIRED"
    )
    current = checked(
        change(
            client,
            owner,
            current,
            "cancel_booking",
            bookingId=current["bookings"][0]["id"],
            reason="Prepare complete handover",
        )
    )
    current = delivered(client, owner, current)
    assert current["car"]["stage"] == "delivered" and current["car"]["commercialStatus"] == "sold"
    booking = current["bookings"][0]
    assert booking["delivery"]["warranty"]["terms"].startswith("Written training")
    assert booking["transfer"]["status"] == "pending"
    current = checked(
        change(client, owner, current, "complete_transfer", bookingId=booking["id"], reference="RTO-ACK-001")
    )
    assert current["bookings"][0]["transfer"]["status"] == "completed"
    receipt = next(e for e in current["ledger"] if e["kind"] == "receipt")
    assert (
        change(
            client, owner, current, "reverse_entry", entryId=receipt["id"], reason="Attempt rewrite"
        ).json()["error"]["code"]
        == "DELIVERY_LOCKED"
    )
    with pytest.raises(DBAPIError):
        with engine.begin() as conn:
            conn.execute(text("UPDATE sale_deliveries SET receipt_reference='overwrite'"))


def test_warranty_review_budget_and_repair_link(workspace):
    client, engine, owner, _ = workspace
    current = delivered(client, owner, acquired(client, owner))
    booking = current["bookings"][0]
    current = checked(
        change(
            client,
            owner,
            current,
            "open_claim",
            bookingId=booking["id"],
            description="AC stopped cooling",
            odometerKm=42200,
        )
    )
    claim = current["claims"][0]
    assert claim["coverageObservation"] == "within_recorded_limits"
    current = checked(
        change(
            client,
            owner,
            current,
            "review_claim",
            claimId=claim["id"],
            decision="approve",
            reason="Covered under issued AC warranty",
            approvedLimitPaise=500000,
        )
    )
    assert current["claims"][0]["issueId"] and current["car"]["stage"] == "delivered"
    assert (
        change(client, owner, current, "close_claim", claimId=claim["id"]).json()["error"]["code"]
        == "CLAIM_WORK_PENDING"
    )
    assert (
        change(
            client,
            owner,
            current,
            "cost",
            claimId=claim["id"],
            category="warranty",
            amountPaise=500001,
            reference="W-OVER",
            occurredAt=datetime.now(UTC).isoformat(),
        ).json()["error"]["code"]
        == "CLAIM_BUDGET_EXCEEDED"
    )
    current = checked(
        change(
            client,
            owner,
            current,
            "cost",
            claimId=claim["id"],
            category="warranty",
            amountPaise=450000,
            reference="W-001",
            occurredAt=datetime.now(UTC).isoformat(),
        )
    )
    assert current["claims"][0]["actualCostPaise"] == 450000 and current["warrantyCostPaise"] == 450000
    with engine.begin() as conn:
        conn.execute(
            text("UPDATE issues SET status='resolved' WHERE id=:id"), {"id": current["claims"][0]["issueId"]}
        )
    current = business(client, owner, current["car"]["id"])
    current = checked(change(client, owner, current, "close_claim", claimId=claim["id"]))
    assert current["claims"][0]["status"] == "closed"


def test_goodwill_is_explicit_and_booking_expiry_is_enforced(workspace):
    client, engine, owner, _ = workspace
    current = delivered(client, owner, acquired(client, owner), warranty=False)
    current = checked(
        change(
            client,
            owner,
            current,
            "open_claim",
            bookingId=current["bookings"][0]["id"],
            description="Customer requests goodwill review",
            odometerKm=42300,
        )
    )
    claim = current["claims"][0]
    assert claim["coverageObservation"] == "no_warranty"
    assert (
        change(
            client,
            owner,
            current,
            "review_claim",
            claimId=claim["id"],
            decision="approve",
            reason="Goodwill request",
            approvedLimitPaise=100000,
        ).json()["error"]["code"]
        == "GOODWILL_ACK_REQUIRED"
    )
    checked(
        change(
            client,
            owner,
            current,
            "review_claim",
            claimId=claim["id"],
            decision="approve",
            reason="Owner goodwill decision",
            approvedLimitPaise=100000,
            acknowledgeOutsideTerms=True,
        )
    )
    other = acquired(client, owner, registration="MH02CD5678")
    other = book(client, owner, other, acknowledgeNotReady=True)
    with engine.begin() as conn:
        conn.execute(
            text("UPDATE sale_bookings SET expires_at=now()-interval '1 hour' WHERE id=:id"),
            {"id": other["bookings"][0]["id"]},
        )
    other = business(client, owner, other["car"]["id"])
    assert other["bookings"][0]["expired"]
    assert (
        change(
            client,
            owner,
            other,
            "sale_receipt",
            bookingId=other["bookings"][0]["id"],
            amountPaise=1,
            reference="EXPIRED-01",
            occurredAt=datetime.now(UTC).isoformat(),
        ).json()["error"]["code"]
        == "BOOKING_EXPIRED"
    )


def test_owner_attention_queue_and_pagination(workspace):
    client, _, owner, employee = workspace
    assert client.get("/v1/business", headers=employee).status_code == 403
    page = checked(client.get("/v1/business?scope=all&limit=1", headers=owner))
    assert len(page["items"]) == 1 and page["limit"] == 1
    assert (
        checked(client.get("/v1/business?scope=all&limit=1&offset=1", headers=owner))["items"][0]["car"]["id"]
        != page["items"][0]["car"]["id"]
    )
    current = book(client, owner, acquired(client, owner), acknowledgeNotReady=True)
    booking = current["bookings"][0]
    current = checked(
        change(
            client,
            owner,
            current,
            "sale_receipt",
            bookingId=booking["id"],
            amountPaise=500000,
            reference="QUEUE-DEPOSIT",
            occurredAt=datetime.now(UTC).isoformat(),
        )
    )
    current = checked(
        change(
            client,
            owner,
            current,
            "cancel_booking",
            bookingId=booking["id"],
            reason="Buyer cancelled booking",
        )
    )
    items = checked(client.get("/v1/business?scope=attention", headers=owner))["items"]
    assert len(items) == 1 and items[0]["refundDuePaise"] == 500000
    assert items[0]["car"]["id"] == current["car"]["id"]
    assert checked(client.get("/v1/business?scope=all&search=NO-SUCH-CAR", headers=owner))["items"] == []
