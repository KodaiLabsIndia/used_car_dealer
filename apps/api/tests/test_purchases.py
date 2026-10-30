import hashlib
from concurrent.futures import ThreadPoolExecutor
from datetime import UTC, datetime, timedelta
from uuid import uuid4

import pytest
from sqlalchemy import text
from sqlalchemy.exc import DBAPIError
from test_integration import checked, command, create_car, fill_inspection
from test_integration import workspace as workspace

from app.seed import IDS

TERMS = {
    "sellerName": "Training Seller",
    "sellerPhone": "9000000000",
    "askingPricePaise": 52000000,
    "purchasePricePaise": 50000025,
    "expectedResalePaise": 65000000,
    "repairBudgetPaise": 1000000,
    "directExpensesPaise": 500000,
    "notes": "Training valuation",
}
DOCUMENTS = {
    "sellerVerified": True,
    "registrationVerified": True,
    "ownershipVerified": True,
    "loanStatus": "no_loan",
}


def purchase_command(client, headers, purchase, action, command_id=None, **extra):
    return client.post(
        f"/v1/purchases/{purchase['id']}/commands",
        headers=headers,
        json={
            "commandId": str(command_id or uuid4()),
            "expectedVersion": purchase["version"],
            "action": action,
            **extra,
        },
    )


def prepare(client, owner, inspect=True, registration="MH01AB1234", terms=None):
    response, _ = create_car(client, owner, assigned=IDS["owner"], registration=registration)
    created = checked(response, 201)
    if inspect:
        task = fill_inspection(client, owner, created["task"])
        checked(command(client, owner, task["id"], "review", version=task["version"], decision="accept"))
    body = {"commandId": str(uuid4()), "expectedVersion": created["car"]["version"], "terms": terms or TERMS}
    purchase = checked(
        client.post(f"/v1/cars/{created['car']['id']}/purchase", headers=owner, json=body), 201
    )
    return purchase, body


def approve(client, owner, purchase, **extra):
    purchase = checked(purchase_command(client, owner, purchase, "submit"))
    return checked(
        purchase_command(
            client, owner, purchase, "review", decision="approve", acknowledgeDraftChecklist=True, **extra
        )
    )


def payment(client, owner, purchase, amount=10000025, reference="UTR-001", **extra):
    return purchase_command(
        client,
        owner,
        purchase,
        "payment",
        amountPaise=amount,
        method="bank_transfer",
        reference=reference,
        paidAt=datetime.now(UTC).isoformat(),
        **extra,
    )


def test_purchase_permissions_replay_and_original_terms(workspace):
    client, engine, owner, employee = workspace
    purchase, body = prepare(client, owner, inspect=False)
    car_id = purchase["carId"]
    assert checked(client.post(f"/v1/cars/{car_id}/purchase", headers=owner, json=body), 201) == purchase
    assert (
        client.post(
            f"/v1/cars/{car_id}/purchase", headers=owner, json=body | {"commandId": str(uuid4())}
        ).status_code
        == 409
    )
    assert client.get("/v1/purchases", headers=employee).status_code == 403
    assert client.get(f"/v1/cars/{car_id}/purchase", headers=employee).status_code == 403
    assert client.get(f"/v1/purchases/{purchase['id']}", headers=employee).status_code == 403
    assert purchase_command(client, employee, purchase, "submit").status_code == 403
    assert purchase["expectedContributionPaise"] == 13499975
    assert len(purchase["revisions"]) == 1
    other_company, other_owner = uuid4(), uuid4()
    token = "other-business-purchase-test"
    with engine.begin() as conn:
        conn.execute(
            text("INSERT INTO companies(id,name) VALUES(:id,'Other company')"), {"id": other_company}
        )
        conn.execute(
            text("INSERT INTO users(id,company_id,name,role) VALUES(:id,:company,'Other owner','owner')"),
            {"id": other_owner, "company": other_company},
        )
        conn.execute(
            text(
                "INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(:token,:user,now()+interval '1 hour')"
            ),
            {"token": hashlib.sha256(token.encode()).hexdigest(), "user": other_owner},
        )
    other = {"Authorization": "Bearer " + token}
    assert client.get(f"/v1/purchases/{purchase['id']}", headers=other).status_code == 404
    assert purchase_command(client, other, purchase, "submit").status_code == 404
    assert checked(client.get("/v1/purchases", headers=other))["items"] == []


def test_approval_gates_self_review_and_changed_facts(workspace):
    client, engine, owner, _ = workspace
    purchase, _ = prepare(client, owner, inspect=False)
    assert (
        purchase_command(client, owner, purchase, "submit").json()["error"]["code"] == "INSPECTION_REQUIRED"
    )
    task = checked(client.get("/v1/tasks", headers=owner))["items"][0]
    task = fill_inspection(client, owner, task)
    checked(command(client, owner, task["id"], "review", version=task["version"], decision="accept"))
    purchase = checked(purchase_command(client, owner, purchase, "submit"))
    assert (
        purchase_command(client, owner, purchase, "review", decision="approve").json()["error"]["code"]
        == "CHECKLIST_NOT_APPROVED"
    )
    purchase = checked(
        purchase_command(
            client, owner, purchase, "review", decision="approve", acknowledgeDraftChecklist=True
        )
    )
    assert purchase["approvalValid"] and purchase["approvals"][0]["selfReview"]
    assert payment(client, owner, purchase).status_code == 200
    purchase = checked(client.get(f"/v1/purchases/{purchase['id']}", headers=owner))
    purchase = checked(
        purchase_command(client, owner, purchase, "revise", terms=TERMS | {"purchasePricePaise": 51000025})
    )
    assert purchase["status"] == "draft" and not purchase["approvalValid"]
    assert len(purchase["revisions"]) == 2
    assert purchase["approvals"][0]["terms"]["purchasePricePaise"] == 50000025
    assert (
        payment(client, owner, purchase, reference="UTR-002").json()["error"]["code"] == "APPROVAL_REQUIRED"
    )
    purchase = approve(client, owner, purchase)
    template = next(
        t
        for t in checked(client.get("/v1/checklists", headers=owner))["items"]
        if t["kind"] == "pre_purchase"
    )
    checked(
        client.post(
            f"/v1/cars/{purchase['carId']}/inspections",
            headers=owner,
            json={"commandId": str(uuid4()), "assignedTo": str(IDS["owner"]), "templateId": template["id"]},
        ),
        201,
    )
    stale = checked(client.get(f"/v1/purchases/{purchase['id']}", headers=owner))
    assert not stale["approvalValid"]
    assert payment(client, owner, stale, reference="UTR-003").status_code == 409
    for table in ["purchase_revisions", "purchase_approvals"]:
        with pytest.raises(DBAPIError):
            with engine.begin() as conn:
                conn.execute(text(f"DELETE FROM {table}"))


def test_payments_are_exact_retry_safe_and_correctable(workspace):
    client, engine, owner, _ = workspace
    purchase, _ = prepare(client, owner)
    purchase = approve(client, owner, purchase)
    body = {
        "commandId": str(uuid4()),
        "expectedVersion": purchase["version"],
        "action": "payment",
        "amountPaise": 10000025,
        "method": "bank_transfer",
        "reference": "UTR-001",
        "paidAt": datetime.now(UTC).isoformat(),
    }
    url = f"/v1/purchases/{purchase['id']}/commands"
    purchase = checked(client.post(url, headers=owner, json=body))
    assert checked(client.post(url, headers=owner, json=body)) == purchase
    assert client.post(url, headers=owner, json=body | {"amountPaise": 500}).status_code == 409
    assert purchase["paidPaise"] == 10000025 and purchase["balancePaise"] == 40000000
    assert (
        payment(client, owner, purchase, reference=" utr-001 ").json()["error"]["code"] == "DUPLICATE_PAYMENT"
    )
    assert (
        payment(client, owner, purchase, amount=40000001, reference="UTR-002").json()["error"]["code"]
        == "OVERPAYMENT"
    )
    invalid = body | {
        "commandId": str(uuid4()),
        "expectedVersion": purchase["version"],
        "reference": "UTR-002",
    }
    for amount in [True, 1.25, 1.0, 0, -1]:
        assert client.post(url, headers=owner, json=invalid | {"amountPaise": amount}).status_code == 400
    assert (
        client.post(url, headers=owner, json=invalid | {"paidAt": "2026-01-01T12:00:00"}).status_code == 400
    )
    assert (
        client.post(
            url, headers=owner, json=invalid | {"paidAt": (datetime.now(UTC) + timedelta(days=1)).isoformat()}
        ).status_code
        == 400
    )
    original = purchase["payments"][0]["id"]
    purchase = checked(
        purchase_command(
            client, owner, purchase, "reverse_payment", paymentId=original, reason="Wrong amount entered"
        )
    )
    assert purchase["paidPaise"] == 0 and purchase["payments"][0]["reversedAt"]
    assert (
        purchase_command(
            client, owner, purchase, "reverse_payment", paymentId=original, reason="Again"
        ).status_code
        == 409
    )
    purchase = checked(
        payment(client, owner, purchase, amount=20000000)
    )  # Same bank reference after the mistaken entry was corrected.
    assert purchase["paidPaise"] == 20000000 and len(purchase["payments"]) == 2
    assert (
        purchase_command(
            client, owner, purchase, "revise", terms=TERMS | {"purchasePricePaise": 10000000}
        ).json()["error"]["code"]
        == "PAYMENT_EXCEEDS_PRICE"
    )
    for table in ["purchase_payments", "purchase_payment_reversals"]:
        with pytest.raises(DBAPIError):
            with engine.begin() as conn:
                conn.execute(text(f"DELETE FROM {table}"))


def test_concurrent_payments_and_reference_uniqueness(workspace):
    client, _, owner, _ = workspace
    purchase, _ = prepare(client, owner)
    purchase = approve(client, owner, purchase)
    with ThreadPoolExecutor(max_workers=2) as executor:
        results = list(
            executor.map(
                lambda reference: payment(client, owner, purchase, 30000000, reference), ["UTR-A", "UTR-B"]
            )
        )
    assert sorted(r.status_code for r in results) == [200, 409]
    current = checked(client.get(f"/v1/purchases/{purchase['id']}", headers=owner))
    assert current["paidPaise"] == 30000000
    assert payment(client, owner, current, 30000000, "UTR-C").status_code == 409
    other, _ = prepare(client, owner, registration="MH01CD5678")
    other = approve(client, owner, other)
    paid_reference = current["payments"][0]["reference"]
    assert payment(client, owner, other, 100, paid_reference).json()["error"]["code"] == "DUPLICATE_PAYMENT"


def test_agreement_handover_and_payment_states_are_independent(workspace):
    client, _, owner, employee = workspace
    purchase, _ = prepare(client, owner)
    purchase = approve(client, owner, purchase)
    assert (
        purchase_command(client, owner, purchase, "acquire", agreementReference="AGR-001").json()["error"][
            "code"
        ]
        == "DOCUMENTS_PENDING"
    )
    purchase = checked(purchase_command(client, owner, purchase, "documents", documents=DOCUMENTS))
    purchase = checked(purchase_command(client, owner, purchase, "acquire", agreementReference="AGR-001"))
    assert purchase["status"] == "acquired" and purchase["paidPaise"] == 0 and purchase["receivedAt"] is None
    assert purchase_command(client, owner, purchase, "revise", terms=TERMS).status_code == 409
    templates = checked(client.get("/v1/checklists", headers=owner))["items"]
    intake = next(t for t in templates if t["kind"] == "intake")
    receipt = {
        "location": "Arihant yard",
        "odometerKm": 42010,
        "fuel": "half",
        "keyCount": 2,
        "accessories": "Tool kit",
        "conditionNote": "Check rear bumper",
        "hasNewIssue": True,
        "handoverReference": "HANDOVER-001",
        "templateId": intake["id"],
        "assignedTo": str(IDS["employee"]),
    }
    assert (
        purchase_command(
            client, owner, purchase, "receive", receipt=receipt | {"odometerKm": 41000}
        ).status_code
        == 409
    )
    body = {
        "commandId": str(uuid4()),
        "expectedVersion": purchase["version"],
        "action": "receive",
        "receipt": receipt,
    }
    url = f"/v1/purchases/{purchase['id']}/commands"
    purchase = checked(client.post(url, headers=owner, json=body))
    assert checked(client.post(url, headers=owner, json=body)) == purchase
    assert purchase["receivedAt"] and purchase["intakeTaskId"]
    assert purchase["car"]["stage"] == "refurbishment" and purchase["balancePaise"] == 50000025
    assert purchase["car"]["odometerKm"] == 42010
    task = checked(client.get(f"/v1/tasks/{purchase['intakeTaskId']}", headers=employee))
    assert task["kind"] == "intake" and task["status"] == "assigned"
    issues = checked(client.get(f"/v1/cars/{purchase['carId']}/issues", headers=employee))["items"]
    assert len(issues) == 1 and issues[0]["description"] == "Check rear bumper"
    pre = next(t for t in templates if t["kind"] == "pre_purchase")
    assert (
        client.post(
            f"/v1/cars/{purchase['carId']}/inspections",
            headers=owner,
            json={"commandId": str(uuid4()), "templateId": pre["id"], "assignedTo": str(IDS["owner"])},
        ).status_code
        == 409
    )
    purchase = checked(payment(client, owner, purchase, amount=50000025))
    assert purchase["balancePaise"] == 0
    assert purchase_command(client, owner, purchase, "receive", receipt=receipt).status_code == 409


def test_loss_and_rejection_need_explicit_context(workspace):
    client, _, owner, _ = workspace
    purchase, _ = prepare(client, owner, terms=TERMS | {"expectedResalePaise": 40000000})
    purchase = checked(purchase_command(client, owner, purchase, "submit"))
    assert (
        purchase_command(client, owner, purchase, "review", decision="reject", reason=" ").status_code == 400
    )
    assert (
        purchase_command(
            client, owner, purchase, "review", decision="approve", acknowledgeDraftChecklist=True
        ).json()["error"]["code"]
        == "LOSS_ACKNOWLEDGEMENT"
    )
    purchase = checked(
        purchase_command(
            client, owner, purchase, "review", decision="reject", reason="Review the selling estimate"
        )
    )
    assert purchase["status"] == "rejected" and purchase["approvals"][0]["reason"]
    purchase = approve(client, owner, purchase, acknowledgeLoss=True)
    assert purchase["status"] == "approved" and purchase["expectedContributionPaise"] < 0


def test_review_records_the_actual_owner_and_updates_decision_totals(workspace):
    client, engine, owner, _ = workspace
    purchase, _ = prepare(client, owner)
    purchase = checked(purchase_command(client, owner, purchase, "submit"))
    assert checked(client.get("/v1/dashboard", headers=owner))["decisions"] == 1
    assert (
        checked(client.get("/v1/purchases?decisions=true", headers=owner))["items"][0]["id"] == purchase["id"]
    )
    second_owner, token = uuid4(), "second-owner-review-test"
    with engine.begin() as conn:
        conn.execute(
            text("INSERT INTO users(id,company_id,name,role) VALUES(:id,:company,'Second owner','owner')"),
            {"id": second_owner, "company": IDS["company"]},
        )
        conn.execute(
            text(
                "INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(:token,:user,now()+interval '1 hour')"
            ),
            {"token": hashlib.sha256(token.encode()).hexdigest(), "user": second_owner},
        )
    reviewer = {"Authorization": "Bearer " + token}
    purchase = checked(
        purchase_command(
            client, reviewer, purchase, "review", decision="approve", acknowledgeDraftChecklist=True
        )
    )
    assert purchase["approvedBy"] == str(second_owner)
    assert purchase["submittedBy"] == str(IDS["owner"])
    assert not purchase["approvals"][0]["selfReview"]
    assert purchase["approvals"][0]["actorName"] == "Second owner"
    assert checked(client.get("/v1/dashboard", headers=owner))["decisions"] == 0
    with engine.connect() as conn:
        assert (
            conn.execute(
                text("SELECT actor_id FROM audit_events WHERE action='purchase.review'")
            ).scalar_one()
            == second_owner
        )
