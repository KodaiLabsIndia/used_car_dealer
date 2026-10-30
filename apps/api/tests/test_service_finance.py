from datetime import UTC, datetime, timedelta
from uuid import uuid4

from sqlalchemy import text
from test_integration import checked, repair_command
from test_integration import workspace as workspace

from app.seed import IDS


def new_job(client, owner):
    car = checked(client.get(f"/v1/cars/{IDS['sonet']}", headers=owner))
    issue = checked(
        client.post(
            f"/v1/cars/{car['id']}/issues",
            headers=owner,
            json={
                "commandId": str(uuid4()),
                "expectedVersion": car["version"],
                "description": "Brake pads",
                "severity": "normal",
            },
        ),
        201,
    )
    return checked(
        client.post(
            f"/v1/issues/{issue['id']}/repairs",
            headers=owner,
            json={
                "commandId": str(uuid4()),
                "expectedVersion": issue["version"],
                "assignedTo": str(IDS["employee"]),
            },
        ),
        201,
    )


def finance_command(client, owner, data, action, command_id=None, **extra):
    return client.post(
        f"/v1/jobs/{data['job']['id']}/finance/commands",
        headers=owner,
        json={
            "commandId": str(command_id or uuid4()),
            "expectedVersion": data["job"]["version"],
            "action": action,
            **extra,
        },
    )


def quote(client, owner, data, amount=500000):
    return checked(
        finance_command(
            client,
            owner,
            data,
            "quote",
            lines=[{"description": "Brake pads", "quantity": 2, "unitPaise": amount // 2}],
            chargesPaise=0,
        )
    )


def approve(client, owner, data):
    return checked(
        finance_command(
            client,
            owner,
            data,
            "decide_quote",
            quoteId=data["quotes"][0]["id"],
            decision="approved",
            reason="Owner checked itemized scope",
        )
    )


def test_quote_revision_reapproval_job_gate_and_scope(workspace):
    client, _, owner, employee = workspace
    job = new_job(client, owner)
    path = f"/v1/jobs/{job['id']}/finance"
    assert client.get(path, headers=employee).status_code == 200
    data = checked(client.get(path, headers=owner))
    data = quote(client, owner, data)
    assert (
        repair_command(client, employee, data["job"], "start", commitsSpend=True).json()["error"]["code"]
        == "QUOTE_APPROVAL_REQUIRED"
    )
    data = approve(client, owner, data)
    job = checked(repair_command(client, employee, data["job"], "start", commitsSpend=True))
    data = checked(client.get(path, headers=owner))
    assert len(data["quotes"]) == 1
    data = quote(client, owner, data, 600000)
    assert data["quotes"][0]["decision"] == "pending"
    assert repair_command(client, employee, data["job"], "start", commitsSpend=True).status_code == 409
    assert (
        finance_command(
            client,
            owner,
            data,
            "decide_quote",
            quoteId=data["quotes"][1]["id"],
            decision="approved",
            reason="Old revision",
        ).json()["error"]["code"]
        == "QUOTE_REVISED"
    )
    data = approve(client, owner, data)
    assert data["quotes"][0]["revision"] == 2
    assert repair_command(client, employee, data["job"], "start", commitsSpend=True).status_code == 200


def test_invoice_payment_exact_totals_idempotency_and_budget(workspace):
    client, engine, owner, _ = workspace
    job = new_job(client, owner)
    data = approve(
        client,
        owner,
        quote(client, owner, checked(client.get(f"/v1/jobs/{job['id']}/finance", headers=owner))),
    )
    quote_id = data["quotes"][0]["id"]
    common = {
        "quoteId": quote_id,
        "amountPaise": 300000,
        "reference": "INV-1",
        "occurredAt": (datetime.now(UTC) - timedelta(minutes=1)).isoformat(),
    }
    key = uuid4()
    before = data
    data = checked(finance_command(client, owner, data, "invoice", key, **common))
    assert checked(finance_command(client, owner, before, "invoice", key, **common)) == data
    assert data["invoiceTotalPaise"] == 300000 and data["balancePaise"] == 300000
    assert finance_command(client, owner, data, "invoice", **common).json()["error"]["code"] == "QUOTE_LIMIT"
    assert (
        finance_command(client, owner, data, "invoice", **(common | {"amountPaise": 100000})).json()["error"][
            "code"
        ]
        == "DUPLICATE_REFERENCE"
    )
    assert (
        finance_command(
            client, owner, data, "vendor_payment", **(common | {"reference": "PAY-1", "amountPaise": 400000})
        ).json()["error"]["code"]
        == "ADVANCE_ACKNOWLEDGEMENT"
    )
    data = checked(
        finance_command(
            client,
            owner,
            data,
            "vendor_payment",
            **(common | {"reference": "PAY-1", "amountPaise": 400000, "advanceAcknowledged": True}),
        )
    )
    assert data["paidPaise"] == 400000 and data["advancePaise"] == 100000 and data["balancePaise"] == 0
    assert (
        finance_command(
            client,
            owner,
            data,
            "vendor_payment",
            **(common | {"reference": "PAY-2", "amountPaise": 100001, "advanceAcknowledged": True}),
        ).json()["error"]["code"]
        == "QUOTE_LIMIT"
    )
    assert (
        finance_command(
            client,
            owner,
            data,
            "quote",
            lines=[{"description": "Lower quote", "quantity": 1, "unitPaise": 100000}],
        ).json()["error"]["code"]
        == "COMMITTED_COST"
    )
    business = checked(client.get(f"/v1/cars/{job['carId']}/business", headers=owner))
    assert business["runningCostPaise"] == 300000
    with engine.connect() as conn:
        assert conn.execute(text("SELECT count(*) FROM repair_invoices")).scalar_one() == 1
        assert conn.execute(text("SELECT count(*) FROM repair_vendor_payments")).scalar_one() == 1


def test_vendor_payment_correction_preserves_original_and_reopens_balance(workspace):
    client, engine, owner, _ = workspace
    job = new_job(client, owner)
    data = approve(
        client,
        owner,
        quote(client, owner, checked(client.get(f"/v1/jobs/{job['id']}/finance", headers=owner))),
    )
    common = {
        "quoteId": data["quotes"][0]["id"],
        "amountPaise": 100000,
        "reference": "PAY-CORRECT",
        "occurredAt": (datetime.now(UTC) - timedelta(minutes=1)).isoformat(),
        "advanceAcknowledged": True,
    }
    data = checked(finance_command(client, owner, data, "vendor_payment", **common))
    payment = data["payments"][0]
    assert data["paidPaise"] == 100000
    data = checked(
        finance_command(
            client,
            owner,
            data,
            "correct_vendor_payment",
            paymentId=payment["id"],
            reason="Wrong amount entered; no money moved",
        )
    )
    assert data["paidPaise"] == 0 and data["payments"][0]["reversed"]
    assert (
        finance_command(
            client,
            owner,
            data,
            "correct_vendor_payment",
            paymentId=payment["id"],
            reason="Duplicate correction",
        ).json()["error"]["code"]
        == "ALREADY_CORRECTED"
    )
    with engine.connect() as conn:
        assert (
            conn.execute(
                text("SELECT amount_paise FROM repair_vendor_payments WHERE id=:id"), {"id": payment["id"]}
            ).scalar_one()
            == 100000
        )
