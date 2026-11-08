"""Original-preserving correction examples with reconciled current balances."""

from app.demo.core import audit, insert
from app.demo.fleet import ledger


def corrections(b):
    uid = b.uid
    car = next(c for c in b.config.cars if c.key == "ready")
    company = uid("company")
    car_id = uid("car:ready")
    offset = -car.age_days + 3
    payment = uid("seller-payment:ready:reversed")
    reference = "DEMO-SELLER-READY-CORRECTED"
    insert(
        b.conn,
        "purchase_payments",
        id=payment,
        company_id=company,
        purchase_id=uid("purchase:ready"),
        amount_paise=1000000,
        method="bank_transfer",
        reference=reference,
        paid_at=b.clock.at(offset, 10, 5),
        recorded_by=uid("owner"),
        created_at=b.clock.at(offset, 10, 5),
    )
    insert(
        b.conn,
        "purchase_payment_references",
        company_id=company,
        method="bank_transfer",
        reference_key=reference.lower(),
        active_payment_id=None,
    )
    insert(
        b.conn,
        "purchase_payment_reversals",
        id=uid("seller-reversal:ready"),
        company_id=company,
        payment_id=payment,
        reason="Demo: entered amount corrected; original retained",
        recorded_by=uid("owner"),
        created_at=b.clock.at(offset, 10, 30),
    )
    entry = ledger(b, car, "corrected-cost", 350000, offset=-3)
    insert(
        b.conn,
        "vehicle_ledger_reversals",
        id=uid("ledger-reversal:ready"),
        company_id=company,
        entry_id=entry,
        reason="Demo duplicate cost reversed; original retained",
        recorded_by=uid("owner"),
        created_at=b.clock.at(-2, 16),
    )
    vendor = uid("vendor-payment:ready:reversed")
    reference = "DEMO-VENDOR-READY-CORRECTED"
    insert(
        b.conn,
        "repair_vendor_payments",
        id=vendor,
        company_id=company,
        job_id=uid("job:ready"),
        quote_id=uid("quote:ready"),
        amount_paise=200000,
        reference=reference,
        reference_key=reference.lower(),
        note="Demo corrected vendor advance",
        recorded_by=uid("owner"),
        occurred_at=b.clock.at(-3, 13),
        created_at=b.clock.at(-3, 13),
    )
    insert(
        b.conn,
        "repair_payment_reversals",
        payment_id=vendor,
        company_id=company,
        reason="Demo duplicate vendor payment reversed",
        recorded_by=uid("owner"),
        created_at=b.clock.at(-2, 13),
    )
    insert(
        b.conn,
        "stock_holds",
        id=uid("hold:ready:resolved"),
        company_id=company,
        cycle_id=car_id,
        kind="documents",
        reason="Demo registration copy pending",
        recorded_by=uid("supervisor"),
        created_at=b.clock.at(-4),
        resolved_by=uid("owner"),
        resolved_at=b.clock.at(-3, 16),
        resolution="Demo original checked and hold released",
    )
    audit(
        b.conn,
        b.clock,
        "correction:ready",
        car_id,
        "business.reverse_entry",
        "Demo corrections retain their original entries",
        entryId=str(entry),
    )
    for key in ["ready", "booked", "delivered", "warranty_service", "warranty_closed"]:
        audit(
            b.conn,
            b.clock,
            "ready:" + key,
            uid("car:" + key),
            "business.mark_ready",
            "Demo readiness accepted with draft-checklist acknowledgement",
            offset=-1
            if key in {"ready", "booked"}
            else -next(c.delivered_days_ago for c in b.config.cars if c.key == key) - 2,
            acknowledgeDraftChecklist=True,
        )
    sold = next(c for c in b.config.cars if c.key == "warranty_closed")
    insert(
        b.conn,
        "warranty_claims",
        id=uid("claim:warranty_closed:rejected"),
        company_id=company,
        cycle_id=uid("car:warranty_closed"),
        booking_id=uid("booking:warranty_closed"),
        description="Demo: tyre wear is excluded from the issued warranty",
        odometer_km=b.odometers[sold.key] + 100,
        status="rejected",
        approved_limit_paise=0,
        decision_reason="Demo: wear items are excluded in the recorded written terms",
        recorded_by=uid("sales"),
        reviewed_by=uid("owner"),
        reported_at=b.clock.at(-7, 11),
        updated_at=b.clock.at(-6, 12),
    )
    expired = uid("booking:ready:expired")
    insert(
        b.conn,
        "sale_bookings",
        id=expired,
        company_id=company,
        cycle_id=car_id,
        customer_name="Demo expired booking",
        customer_phone="0000000004",
        sale_price_paise=car.resale_rupees * 100,
        status="cancelled",
        expires_at=b.clock.at(-7, 18),
        cancellation_reason="Demo: booking hold expired before a payment was received",
        created_by=uid("owner"),
        created_at=b.clock.at(-10),
        updated_at=b.clock.at(-7, 18),
    )
    insert(
        b.conn,
        "system_events",
        id=uid("expiry-event:ready"),
        company_id=company,
        aggregate_id=car_id,
        action="booking.expired",
        summary="Demo booking expiry; no deposit to refund",
        details={"origin": "demo-seed", "bookingId": str(expired)},
        created_at=b.clock.at(-7, 18),
    )
