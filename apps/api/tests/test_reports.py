import csv
import io

from sqlalchemy import text
from test_commercial import acquired, book, change, delivered
from test_integration import checked
from test_integration import workspace as workspace
from test_service_finance import approve, finance_command, new_job, quote

from app.seed import IDS


def test_report_reconciles_purchase_cost_cash_refund_and_all_pages(workspace):
    client, engine, owner, employee = workspace
    path = "/v1/reports/operations"
    assert client.get(path, headers=employee).status_code == 403
    assert client.get(path + ".csv", headers=employee).status_code == 403
    current = acquired(client, owner, registration="REPORT01")
    current = checked(
        change(
            client,
            owner,
            current,
            "cost",
            category="transport",
            amountPaise=12345,
            reference="REPORT-COST",
            occurredAt="2026-01-01T12:00:00Z",
        )
    )
    current = book(client, owner, current, acknowledgeNotReady=True)
    booking = current["bookings"][0]
    current = checked(
        change(
            client,
            owner,
            current,
            "sale_receipt",
            bookingId=booking["id"],
            amountPaise=250000,
            reference="REPORT-DEPOSIT",
            occurredAt="2026-01-01T12:00:00Z",
        )
    )
    current = checked(
        change(
            client, owner, current, "cancel_booking", bookingId=booking["id"], reason="Training cancellation"
        )
    )
    report = checked(client.get(path, headers=owner, params={"search": "REPORT01", "limit": 1}))
    assert report["total"] == 1
    row = report["items"][0]
    assert row["stockAgeDays"] == 0 and row["recordedCostsPaise"] == 12345
    assert (
        row["refundDuePaise"] == 250000
        and row["buyerCollectedPaise"] == 250000
        and row["buyerBalancePaise"] == 0
    )
    assert row["sellerPaidPaise"] == current["purchasePricePaise"] and row["sellerBalancePaise"] == 0
    current = checked(
        change(
            client,
            owner,
            current,
            "sale_refund",
            bookingId=booking["id"],
            amountPaise=50000,
            reference="REPORT-REFUND",
            occurredAt="2026-01-01T12:00:00Z",
        )
    )
    report = checked(client.get(path, headers=owner, params={"search": "REPORT01"}))
    assert report["totals"]["refundDuePaise"] == 200000 and report["totals"]["buyerRefundedPaise"] == 50000
    page = checked(client.get(path, headers=owner, params={"limit": 1, "offset": 1}))
    assert len(page["items"]) == 1 and page["total"] == 3 and page["totals"]["recordedCostsPaise"] == 12345
    with engine.begin() as conn:
        conn.execute(
            text("UPDATE vehicles SET make='=HYPERLINK(\"x\")' WHERE id=:id"),
            {"id": current["car"]["vehicleId"]},
        )
    exported = client.get(path + ".csv", headers=owner, params={"search": "REPORT01"})
    assert exported.status_code == 200 and exported.headers["cache-control"] == "private, no-store"
    rows = list(csv.reader(io.StringIO(exported.text)))
    assert any(value.startswith("'=HYPERLINK") for value in rows[3])


def test_report_keeps_sold_scope_and_null_receipt_age(workspace):
    client, _, owner, _ = workspace
    initial = checked(client.get("/v1/reports/operations", headers=owner))
    assert all(row["stockAgeDays"] is None for row in initial["items"])
    current = delivered(client, owner, acquired(client, owner, registration="REPORT02"))
    sold = checked(client.get("/v1/reports/operations?scope=sold", headers=owner))
    assert sold["total"] == 1 and sold["items"][0]["carId"] == current["car"]["id"]
    assert sold["totals"]["buyerBalancePaise"] == 0 and sold["totals"]["buyerCollectedPaise"] == 65000000
    assert checked(client.get("/v1/reports/operations?scope=stock", headers=owner))["total"] == 2


def test_vendor_report_never_nets_advances_against_another_job_or_double_counts_costs(workspace):
    client, _, owner, _ = workspace
    jobs = []
    for amount, reference in [(300000, "REPORT-VENDOR-1"), (200000, "REPORT-VENDOR-2")]:
        job = new_job(client, owner)
        data = approve(
            client,
            owner,
            quote(client, owner, checked(client.get(f"/v1/jobs/{job['id']}/finance", headers=owner))),
        )
        data = checked(
            finance_command(
                client,
                owner,
                data,
                "invoice",
                quoteId=data["quotes"][0]["id"],
                amountPaise=amount,
                reference=reference,
                occurredAt="2026-01-01T12:00:00Z",
            )
        )
        jobs.append(data)
    first = checked(
        finance_command(
            client,
            owner,
            jobs[0],
            "vendor_payment",
            quoteId=jobs[0]["quotes"][0]["id"],
            amountPaise=400000,
            reference="REPORT-VENDOR-PAY",
            occurredAt="2026-01-01T12:00:00Z",
            advanceAcknowledged=True,
        )
    )
    report = checked(client.get("/v1/reports/operations", headers=owner))
    totals = report["totals"]
    assert totals["recordedCostsPaise"] == 500000 and totals["vendorPaidPaise"] == 400000
    assert totals["vendorBalancePaise"] == 200000 and totals["vendorAdvancePaise"] == 100000
    current = checked(client.get(f"/v1/cars/{IDS['sonet']}/business", headers=owner))
    invoice_entry = next(entry for entry in current["ledger"] if entry["reference"] == "REPORT-VENDOR-1")
    checked(
        change(
            client,
            owner,
            current,
            "reverse_entry",
            entryId=invoice_entry["id"],
            reason="Original bill was cancelled",
        )
    )
    totals = checked(client.get("/v1/reports/operations", headers=owner))["totals"]
    assert (
        totals["recordedCostsPaise"] == 200000
        and totals["vendorAdvancePaise"] == 400000
        and totals["vendorBalancePaise"] == 200000
    )
    first = checked(client.get(f"/v1/jobs/{first['job']['id']}/finance", headers=owner))
    checked(
        finance_command(
            client,
            owner,
            first,
            "correct_vendor_payment",
            paymentId=first["payments"][0]["id"],
            reason="Payment entered twice",
        )
    )
    totals = checked(client.get("/v1/reports/operations", headers=owner))["totals"]
    assert (
        totals["vendorPaidPaise"] == 0
        and totals["vendorAdvancePaise"] == 0
        and totals["vendorBalancePaise"] == 200000
    )
