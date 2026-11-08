"""Connected vehicle lifecycle fixtures with reconciled money and source records."""

from sqlalchemy import text

from app.commercial_contracts import WarrantyConfiguration
from app.demo.core import audit, insert
from app.demo.inspections import inspection
from app.domain.document_defaults import starter_policy
from app.domain.warranty import issue_warranty
from app.purchase_contracts import PurchaseDocuments, PurchaseReceipt, PurchaseTerms

ACQUIRED = {
    "waiting_parts",
    "service_quote",
    "repair_qc",
    "ready_refund",
    "booked",
    "warranty_pending",
    "warranty_repair",
    "warranty_closed",
}
SOLD = {"warranty_pending", "warranty_repair", "warranty_closed"}


def ledger(b, car, key, amount, category="transport", kind="cost", booking=None, claim=None, offset=-2):
    uid = b.uid
    id = uid("ledger:" + car.key + ":" + key)
    reference = "DEMO-" + car.key.upper() + "-" + key.upper()
    insert(
        b.conn,
        "vehicle_ledger",
        id=id,
        company_id=uid("company"),
        cycle_id=uid("car:" + car.key),
        kind=kind,
        category=category,
        amount_paise=amount,
        reference=reference,
        reference_key=reference.lower(),
        note="Demo sample ledger entry",
        booking_id=booking,
        claim_id=claim,
        recorded_by=uid("owner"),
        occurred_at=b.clock.at(offset, 14),
        created_at=b.clock.at(offset, 14),
    )
    audit(
        b.conn,
        b.clock,
        "ledger:" + str(id),
        uid("car:" + car.key),
        "business." + kind,
        "Demo ledger: " + key,
        offset=offset,
        amountPaise=amount,
    )
    return id


def purchase(b, car, task):
    uid = b.uid
    c, clock = b.conn, b.clock
    id = uid("purchase:" + car.key)
    car_id = uid("car:" + car.key)
    status = (
        "submitted"
        if car.scenario == "purchase_submitted"
        else "approved"
        if car.scenario == "purchase_approved"
        else "acquired"
    )
    age = car.age_days
    terms = PurchaseTerms(
        seller_name="Demo seller · " + car.model,
        seller_phone="0000000001",
        asking_price_paise=(car.purchase_rupees + 20000) * 100,
        purchase_price_paise=car.purchase_rupees * 100,
        expected_resale_paise=car.resale_rupees * 100,
        repair_budget_paise=3000000,
        direct_expenses_paise=300000,
        notes="Demo terms only; no real purchase or settlement.",
    )
    docs = PurchaseDocuments(
        seller_verified=True, registration_verified=True, ownership_verified=True, loan_status="no_loan"
    )
    stamps = [s.model_dump(mode="json", by_alias=True) for s in b.purchases.inspections(c, b.owner, car_id)]
    received = car.scenario in ACQUIRED
    intake = inspection(b, car, "intake", offset=-age + 4) if received else None
    receipt = None
    if received:
        receipt = PurchaseReceipt(
            location="Arihant showroom · Demo",
            odometer_km=b.odometers[car.key],
            fuel="half",
            key_count=2,
            accessories="Demo toolkit and spare wheel",
            condition_note="Demo intake; no actual seller handover.",
            handover_reference="DEMO-HANDOVER-" + car.key,
            template_id=next(t.id for t in b.templates if t.kind == "intake"),
            assigned_to=uid("employee"),
        )
    insert(
        c,
        "purchases",
        id=id,
        company_id=uid("company"),
        cycle_id=car_id,
        status=status,
        version=5 if received else 3,
        terms_version=1,
        terms=terms.model_dump(mode="json", by_alias=True),
        documents=docs.model_dump(mode="json", by_alias=True),
        prepared_by=uid("supervisor"),
        submitted_by=uid("supervisor"),
        approved_by=uid("owner") if status != "submitted" else None,
        approved_terms_version=1 if status != "submitted" else None,
        approved_inspections=stamps if status != "submitted" else None,
        agreement_reference="DEMO-AGR-" + car.key if received else None,
        acquired_at=clock.at(-age + 3, 12) if received else None,
        receipt=receipt.model_dump(mode="json", by_alias=True) if receipt else None,
        received_at=clock.at(-age + 4, 9) if received else None,
        intake_task_id=intake.id if intake else None,
        created_at=clock.at(-age + 2, 14),
        updated_at=clock.at(-age + 4 if received else -1, 14),
    )
    insert(
        c,
        "purchase_revisions",
        purchase_id=id,
        company_id=uid("company"),
        terms_version=1,
        terms=terms.model_dump(mode="json", by_alias=True),
        prepared_by=uid("supervisor"),
        created_at=clock.at(-age + 2, 14),
    )
    if status != "submitted":
        insert(
            c,
            "purchase_approvals",
            id=uid("purchase-approval:" + car.key),
            company_id=uid("company"),
            purchase_id=id,
            terms_version=1,
            decision="approve",
            reason="Demo: draft checklist acknowledged for this sample; not Arihant SOP approval.",
            actor_id=uid("owner"),
            self_review=False,
            snapshot={
                "terms": terms.model_dump(mode="json", by_alias=True),
                "inspections": stamps,
                "acknowledgeDraftChecklist": True,
                "origin": "demo-seed",
            },
            created_at=clock.at(-age + 3, 10),
        )
        amount = car.purchase_rupees * 100 if received else 5000000
        payment = uid("seller-payment:" + car.key)
        reference = "DEMO-SELLER-" + car.key.upper()
        insert(
            c,
            "purchase_payments",
            id=payment,
            company_id=uid("company"),
            purchase_id=id,
            amount_paise=amount,
            method="bank_transfer",
            reference=reference,
            paid_at=clock.at(-age + 3, 11),
            recorded_by=uid("owner"),
            created_at=clock.at(-age + 3, 11),
        )
        insert(
            c,
            "purchase_payment_references",
            company_id=uid("company"),
            method="bank_transfer",
            reference_key=reference.lower(),
            active_payment_id=payment,
        )
    audit(
        c,
        clock,
        "purchase:" + car.key,
        car_id,
        "purchase." + status,
        "Demo purchase " + status,
        offset=-age + 3,
        purchaseId=str(id),
    )
    if received:
        ledger(b, car, "transport", 200000, offset=-age + 4)
    b.purchase_ids[car.key] = id


def repair(b, car, status, claim=None):
    uid = b.uid
    c, clock = b.conn, b.clock
    car_id = uid("car:" + car.key)
    job = uid("job:" + car.key)
    issue = uid("issue:" + car.key)
    offset = -2 if claim else -car.age_days + 6
    resolved = status == "completed"
    insert(
        c,
        "issues",
        id=issue,
        company_id=uid("company"),
        cycle_id=car_id,
        description="Demo: air-conditioning diagnosis"
        if claim
        else "Demo: brake service and functional recheck",
        status="resolved" if resolved else "in_repair",
        severity="normal",
        created_by=uid("supervisor"),
        created_at=clock.at(offset),
    )
    qc = (
        inspection(b, car, "repair_qc", "complete" if resolved else "submitted", offset=-2)
        if status in {"awaiting_qc", "completed"}
        else None
    )
    insert(
        c,
        "repair_jobs",
        id=job,
        company_id=uid("company"),
        cycle_id=car_id,
        issue_id=issue,
        title="Warranty AC repair" if claim else "Brake service",
        assigned_to=uid("service"),
        workshop_id=uid("workshop:service"),
        status=status,
        blocker="Brake pads expected tomorrow"
        if status == "waiting_parts"
        else "QC submitted for review"
        if status == "awaiting_qc"
        else "",
        qc_task_id=qc.id if qc else None,
        due_at=clock.at(1, 17),
        created_at=clock.at(offset),
        updated_at=clock.at(-1, 12),
    )
    if claim:
        c.execute(
            text("UPDATE warranty_claims SET issue_id=:issue WHERE id=:claim"),
            {"issue": issue, "claim": claim},
        )
    quote = uid("quote:" + car.key)
    total = 1800000 if not claim else 1200000
    insert(
        c,
        "repair_quotes",
        id=quote,
        company_id=uid("company"),
        job_id=job,
        revision=1,
        lines=[{"description": "Demo repair labour and parts", "quantity": 1, "unitPaise": total}],
        charges_paise=0,
        total_paise=total,
        note="Demo quotation; not an actual supplier bill.",
        recorded_by=uid("service"),
        created_at=clock.at(offset, 11),
    )
    if car.scenario != "service_quote":
        insert(
            c,
            "repair_quote_approvals",
            quote_id=quote,
            company_id=uid("company"),
            job_id=job,
            decision="approved",
            reason="Demo repair budget approved by owner",
            recorded_by=uid("owner"),
            created_at=clock.at(offset, 12),
        )
        amount = total if resolved else 500000
        reference = "DEMO-VENDOR-" + car.key.upper()
        insert(
            c,
            "repair_vendor_payments",
            id=uid("vendor-payment:" + car.key),
            company_id=uid("company"),
            job_id=job,
            quote_id=quote,
            amount_paise=amount,
            reference=reference,
            reference_key=reference.lower(),
            note="Demo payment only",
            recorded_by=uid("owner"),
            occurred_at=clock.at(offset, 13),
            created_at=clock.at(offset, 13),
        )
    if resolved or status == "awaiting_qc":
        cost = ledger(
            b,
            car,
            "repair-invoice",
            total,
            category="warranty" if claim else "repair",
            claim=claim,
            offset=-2,
        )
        reference = "DEMO-INVOICE-" + car.key.upper()
        insert(
            c,
            "repair_invoices",
            id=uid("invoice:" + car.key),
            company_id=uid("company"),
            cycle_id=car_id,
            job_id=job,
            quote_id=quote,
            reference=reference,
            reference_key=reference.lower(),
            vendor_key=str(uid("workshop:service")),
            amount_paise=total,
            ledger_id=cost,
            recorded_by=uid("owner"),
            occurred_at=clock.at(-2, 14),
            created_at=clock.at(-2, 14),
        )
    if status == "waiting_parts":
        for name, received in [("Brake fluid", True), ("Front brake pads", False)]:
            insert(
                c,
                "part_requests",
                id=uid("part:" + car.key + ":" + name),
                company_id=uid("company"),
                job_id=job,
                name=name,
                status="received" if received else "requested",
                expected_at=clock.at(1, 14),
                created_at=clock.at(-2),
                received_at=clock.at(-1) if received else None,
            )
    audit(c, clock, "repair:" + car.key, car_id, "repair.assigned", "Demo service: " + status, jobId=str(job))
    b.jobs[car.key] = job
    return issue


def booking(b, car, status="booked"):
    uid = b.uid
    c, clock = b.conn, b.clock
    id = uid("booking:" + car.key)
    sold = status == "delivered"
    offset = -car.delivered_days_ago if sold else -2
    warranty = WarrantyConfiguration(
        duration_months=car.warranty_months,
        covered_components=["Engine", "Gearbox", "Air conditioning"],
        exclusions="Wear items and accidental damage; demonstration terms only.",
        terms="Demo limited warranty. Configure the written vehicle-specific terms before actual sale.",
        provider="Arihant Cars · Demo",
        policy_reference="DEMO-WARRANTY-" + car.key.upper(),
        odometer_limit_km=b.odometers[car.key] + 10000,
    )
    insert(
        c,
        "sale_bookings",
        id=id,
        company_id=uid("company"),
        cycle_id=uid("car:" + car.key),
        customer_name="Demo buyer · " + car.model,
        customer_phone="0000000002",
        sale_price_paise=car.resale_rupees * 100,
        status=status,
        expires_at=clock.at(offset + 5, 18),
        documents={
            "buyerVerified": sold,
            "registrationReady": sold,
            "saleAgreementReference": "DEMO-SALE-" + car.key if sold else "",
        },
        warranty_configuration=warranty.model_dump(mode="json", by_alias=True),
        cancellation_reason="Demo customer cancelled the booking" if status == "cancelled" else None,
        created_by=uid("owner"),
        created_at=clock.at(offset - 2),
        updated_at=clock.at(offset, 14),
    )
    ledger(
        b,
        car,
        "buyer-receipt",
        car.resale_rupees * 100 if sold else 1000000 if status == "cancelled" else 5000000,
        category="customer",
        kind="receipt",
        booking=id,
        offset=offset - 1,
    )
    if status == "cancelled":
        ledger(b, car, "partial-refund", 500000, category="customer", kind="refund", booking=id, offset=-1)
    if sold:
        terms = issue_warranty(warranty, clock.at(offset, 14))
        insert(
            c,
            "sale_deliveries",
            booking_id=id,
            company_id=uid("company"),
            cycle_id=uid("car:" + car.key),
            delivered_at=clock.at(offset, 14),
            odometer_km=b.odometers[car.key],
            receipt_reference="DEMO-DELIVERY-" + car.key,
            snapshot={
                "warranty": terms.model_dump(mode="json", by_alias=True),
                "keyCount": 2,
                "accessories": "Demo toolkit and spare wheel",
                "customerPromises": "Written demo handover only",
                "customerAcknowledged": True,
            },
            recorded_by=uid("owner"),
            created_at=clock.at(offset, 14),
        )
        pending = car.scenario == "warranty_pending"
        insert(
            c,
            "ownership_transfers",
            booking_id=id,
            company_id=uid("company"),
            status="pending" if pending else "completed",
            due_at=clock.at(-2 if pending else offset + 10, 17),
            reference="" if pending else "DEMO-TRANSFER-" + car.key,
            completed_by=None if pending else uid("office"),
            completed_at=None if pending else clock.at(offset + 7, 15),
        )
        claim = uid("claim:" + car.key)
        claim_status = {
            "warranty_pending": "open",
            "warranty_repair": "approved",
            "warranty_closed": "closed",
        }[car.scenario]
        insert(
            c,
            "warranty_claims",
            id=claim,
            company_id=uid("company"),
            cycle_id=uid("car:" + car.key),
            booking_id=id,
            description="Demo: air conditioning cooling complaint",
            odometer_km=b.odometers[car.key] + 200,
            status=claim_status,
            approved_limit_paise=1500000 if claim_status != "open" else 0,
            decision_reason="Demo claim within recorded terms" if claim_status != "open" else "",
            recorded_by=uid("sales"),
            reviewed_by=uid("owner") if claim_status != "open" else None,
            reported_at=clock.at(-4, 11),
            updated_at=clock.at(-1, 12),
        )
        if claim_status != "open":
            repair(b, car, "completed" if claim_status == "closed" else "in_progress", claim)
    audit(
        c,
        clock,
        "sale:" + car.key,
        uid("car:" + car.key),
        "business." + status,
        "Demo sale: " + status,
        offset=offset,
        bookingId=str(id),
    )
    b.bookings[car.key] = id
    return id


def documents(b, car):
    uid = b.uid
    from app.company_contracts import DocumentRule

    c, clock = b.conn, b.clock
    for stage in ("purchase", "intake", "sale", "delivery"):
        if stage in {"sale", "delivery"} and car.key not in b.bookings:
            continue
        if stage == "intake" and car.scenario not in ACQUIRED:
            continue
        if stage == "delivery" and car.scenario == "ready_refund":
            continue
        if stage == "purchase" and car.scenario == "shared_inspection":
            continue
        rules = [r for r in b.document_rules if r.stage == stage]
        offset = (
            -car.age_days + 1
            if stage == "purchase"
            else -car.age_days + 4
            if stage == "intake"
            else -car.delivered_days_ago - 1
            if car.scenario in SOLD
            else -1
        )
        set_id = uid("requirements:" + car.key + ":" + stage)
        insert(
            c,
            "document_requirement_sets",
            id=set_id,
            company_id=uid("company"),
            cycle_id=uid("car:" + car.key),
            stage=stage,
            booking_id=b.bookings.get(car.key) if stage in {"sale", "delivery"} else None,
            policy_version=1,
            rules=[r.model_dump(mode="json", by_alias=True) for r in rules],
            assigned_by=uid("owner"),
            created_at=clock.at(offset, 8),
        )
        for rule in rules:
            assert isinstance(rule, DocumentRule)
            if car.scenario == "booked" and stage == "delivery":
                continue
            id = uid("document:" + car.key + ":" + rule.id)
            rejected = None
            if car.scenario == "booked" and stage == "sale":
                rejected = uid("document:" + car.key + ":rejected")
                insert(
                    c,
                    "documents",
                    id=rejected,
                    company_id=uid("company"),
                    cycle_id=uid("car:" + car.key),
                    category="sale",
                    title="Demo · Unreadable buyer identity page",
                    reference="DEMO-REJECTED-PAGE",
                    booking_id=b.bookings[car.key],
                    profile="photo-fhd-v1",
                    fingerprint="demo-rejected-page",
                    recorded_by=uid("office"),
                    created_at=clock.at(offset - 1, 9),
                    **b.media.save(rejected),
                )
                insert(
                    c,
                    "document_reviews",
                    document_id=rejected,
                    company_id=uid("company"),
                    decision="rejected",
                    reason="Demo: unreadable page; submit a clearer replacement",
                    recorded_by=uid("owner"),
                    created_at=clock.at(offset - 1, 10),
                )
            insert(
                c,
                "documents",
                id=id,
                supersedes_id=rejected,
                company_id=uid("company"),
                cycle_id=uid("car:" + car.key),
                category="registration"
                if stage == "intake"
                else "purchase"
                if stage == "purchase"
                else "sale",
                title="Demo · " + rule.title,
                reference="DEMO-DOC-" + car.key + "-" + rule.id,
                booking_id=b.bookings.get(car.key) if stage in {"sale", "delivery"} else None,
                profile="photo-fhd-v1",
                fingerprint="demo-fixture",
                recorded_by=uid("office"),
                created_at=clock.at(offset, 9),
                **b.media.save(id),
            )
            if not (car.scenario == "booked" and stage == "sale"):
                insert(
                    c,
                    "document_reviews",
                    document_id=id,
                    company_id=uid("company"),
                    decision="accepted",
                    reason="Demo sample review; not an actual verified identity document",
                    recorded_by=uid("owner"),
                    created_at=clock.at(offset, 10),
                )
            insert(
                c,
                "document_requirement_links",
                company_id=uid("company"),
                set_id=set_id,
                requirement_id=rule.id,
                document_id=id,
                recorded_by=uid("office"),
                created_at=clock.at(offset, 9),
            )


def fleet(b):
    uid = b.uid
    c, clock = b.conn, b.clock
    for key, name in [("service", "Demo Service Centre"), ("body", "Demo Body & Paint")]:
        insert(
            c,
            "workshops",
            id=uid("workshop:" + key),
            company_id=uid("company"),
            name=name,
            phone="0000000000",
        )
    b.document_rules = starter_policy().rules
    # Publish a concise demo policy, not the full unreviewed company SOP starter.
    b.document_rules = [
        r
        for r in b.document_rules
        if r.id in {"seller_identity", "registration_copy", "buyer_identity", "delivery_acknowledgement"}
    ]
    if len(b.document_rules) != 4:
        from app.company_contracts import DocumentRule

        b.document_rules = [
            DocumentRule(id=stage + "_proof", stage=stage, title=en, title_hi=hi, title_mr=mr)
            for stage, en, hi, mr in [
                ("purchase", "Seller identity", "विक्रेता पहचान", "विक्रेत्याची ओळख"),
                ("intake", "Registration copy", "पंजीकरण प्रति", "नोंदणीची प्रत"),
                ("sale", "Buyer identity", "खरीदार पहचान", "खरेदीदाराची ओळख"),
                ("delivery", "Handover acknowledgement", "हैंडओवर पुष्टि", "हस्तांतरणाची पुष्टी"),
            ]
        ]
    insert(
        c,
        "document_policies",
        company_id=uid("company"),
        version=1,
        rules=[r.model_dump(mode="json", by_alias=True) for r in b.document_rules],
        reason="Demo document policy only; owner must configure actual rules",
        published_by=uid("owner"),
        published_at=clock.at(-180),
    )
    for index, car in enumerate(b.config.cars, 1):
        id = uid("car:" + car.key)
        base_odo = 31000 + index * 2400
        b.odometers[car.key] = base_odo
        sold = car.scenario in SOLD
        stage = (
            "delivered"
            if sold
            else "ready"
            if car.scenario in {"ready_refund", "booked"}
            else "refurbishment"
            if car.scenario in ACQUIRED
            else "purchase"
            if car.scenario in {"purchase_approved", "purchase_submitted"}
            else "inspection"
        )
        service = (
            "waiting_parts"
            if car.scenario == "waiting_parts"
            else "in_service"
            if car.scenario in {"service_quote", "repair_qc", "warranty_repair"}
            else "done"
            if car.scenario in {"ready_refund", "warranty_closed"}
            else "none"
        )
        custody = "workshop" if service in {"in_service", "waiting_parts"} else "customer" if sold else "yard"
        location = (
            "Demo Service Centre"
            if custody == "workshop"
            else "Customer · Demo"
            if sold
            else "Arihant showroom · Demo"
        )
        insert(
            c,
            "vehicles",
            id=id,
            company_id=uid("company"),
            make=car.make,
            model=car.model,
            registration=f"DEMO{index:02}",
            year=car.year,
            image_key="seltos" if car.model == "Seltos" else "generic",
            odometer_km=base_odo,
        )
        insert(
            c,
            "stock_cycles",
            id=id,
            company_id=uid("company"),
            vehicle_id=id,
            stock_number=f"AC-{1000 + index:05}",
            stage=stage,
            commercial_status="sold" if sold else "booked" if car.scenario == "booked" else "available",
            service_status=service,
            location=location,
            next_action=car.next_action,
            due_at=clock.at(1, 17),
            created_at=clock.at(-car.age_days),
            updated_at=clock.at(-1, 13),
            custody_kind=custody,
            custodian_id=uid("service")
            if custody == "workshop"
            else uid("sales")
            if sold
            else uid("employee"),
        )
        pre = inspection(
            b,
            car,
            profile="mixed" if car.scenario == "shared_inspection" else "complete",
            offset=-car.age_days + 1,
        )
        if car.scenario != "shared_inspection":
            purchase(b, car, pre)
        if car.scenario in {"waiting_parts", "service_quote", "repair_qc", "ready_refund"}:
            repair(
                b,
                car,
                {
                    "waiting_parts": "waiting_parts",
                    "service_quote": "in_progress",
                    "repair_qc": "awaiting_qc",
                    "ready_refund": "completed",
                }[car.scenario],
            )
        if car.scenario in {"booked"} | SOLD:
            inspection(
                b,
                car,
                "delivery",
                "complete" if sold else "assigned",
                offset=-car.delivered_days_ago - 1 if sold else -1,
            )
            booking(b, car, "delivered" if sold else "booked")
        if car.scenario == "ready_refund":
            booking(b, car, "cancelled")
        documents(b, car)
        insert(
            c,
            "stock_movements",
            id=uid("movement:" + car.key),
            company_id=uid("company"),
            cycle_id=id,
            from_kind="yard",
            from_location="Arihant showroom · Demo",
            to_kind=custody,
            to_location=location,
            custodian_id=uid("service")
            if custody == "workshop"
            else uid("sales")
            if sold
            else uid("employee"),
            receiver_name="Demo recipient",
            odometer_km=base_odo,
            keys_count=2,
            fuel_percent=50,
            note="Demo custody movement",
            workshop_id=uid("workshop:service") if custody == "workshop" else None,
            recorded_by=uid("supervisor"),
            created_at=clock.at(-1, 13),
        )
        if car.scenario == "shared_inspection":
            insert(
                c,
                "stock_holds",
                id=uid("hold:" + car.key),
                company_id=uid("company"),
                cycle_id=id,
                kind="safety",
                reason="Demo: review tyre condition before any test drive",
                recorded_by=uid("supervisor"),
                created_at=clock.at(-1, 13),
            )
        audit(
            c,
            clock,
            "car:" + car.key,
            id,
            "stock.created",
            "Demo vehicle loaded: " + car.scenario,
            offset=-car.age_days,
        )
    insert(c, "company_counters", company_id=uid("company"), next_stock=1001 + len(b.config.cars))
