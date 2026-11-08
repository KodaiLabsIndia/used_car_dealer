"""Seller/buyer work, appointments and actionable in-app demo reminders."""

from app.demo.core import audit, insert


def customer_work(b):
    uid = b.uid
    cases = [
        ("seller-new", "seller", "Demo seller enquiry", "inspection", "open", 1),
        ("seller-followup", "seller", "Demo Swift seller", "purchase_review", "negotiation", 0),
        ("buyer-visit", "buyer", "Demo Venue buyer", "booked", "appointment", 1),
        ("buyer-delivered", "buyer", "Demo Dzire buyer", "delivered", "won", None),
        ("buyer-lost", "buyer", "Demo cancelled enquiry", "ready", "lost", None),
    ]
    for key, kind, name, car, status, due in cases:
        id = uid("enquiry:" + key)
        insert(
            b.conn,
            "enquiries",
            id=id,
            company_id=uid("company"),
            kind=kind,
            name=name,
            phone="0000000003",
            source="Demo walk-in",
            interest="Demo vehicle enquiry and follow-up",
            cycle_id=uid("car:" + car),
            status=status,
            assigned_to=uid("sales"),
            next_follow_up_at=b.clock.at(due, 16) if due is not None else None,
            last_contact_at=b.clock.at(-1, 12),
            version=2,
            created_by=uid("sales"),
            created_at=b.clock.at(-5),
            updated_at=b.clock.at(-1, 12),
        )
        insert(
            b.conn,
            "enquiry_events",
            id=uid("contact:" + key),
            company_id=uid("company"),
            enquiry_id=id,
            kind="contact",
            note="Demo customer interaction; no external contact was sent.",
            recorded_by=uid("sales"),
            created_at=b.clock.at(-1, 12),
        )
        if status == "appointment":
            for kind, offset, hour in [("viewing", 1, 15), ("test_drive", -1, 14)]:
                appointment = uid("appointment:" + kind)
                insert(
                    b.conn,
                    "enquiry_appointments",
                    id=appointment,
                    company_id=uid("company"),
                    enquiry_id=id,
                    kind=kind,
                    scheduled_at=b.clock.at(offset, hour),
                    status="scheduled" if offset > 0 else "completed",
                    driver_name="Demo licensed driver" if kind == "test_drive" else "",
                    license_checked=kind == "test_drive",
                    outcome="" if offset > 0 else "Demo test drive completed; no live vehicle movement.",
                    recorded_by=uid("sales"),
                    completed_by=uid("sales") if offset < 0 else None,
                    completed_at=b.clock.at(offset, hour + 1) if offset < 0 else None,
                )
        audit(
            b.conn,
            b.clock,
            "enquiry:" + key,
            uid("car:" + car),
            "enquiry.contact",
            "Demo enquiry follow-up",
            actor=b.uid("sales"),
            enquiryId=str(id),
        )
    notices = [
        ("owner", "task.submit_checks", "task", uid("task:inspection:pre_purchase")),
        ("owner", "task.help", "task", uid("task:inspection:pre_purchase")),
        ("owner", "purchase.submitted", "purchase", uid("car:purchase_review")),
        ("owner", "workforce.leave_requested", "workforce", uid("employee")),
        ("employee", "task.allocated", "task", uid("task:inspection:pre_purchase")),
        ("employee", "task.review_checks", "task", uid("task:inspection:pre_purchase")),
        ("service", "repair.overdue", "job", uid("job:parts")),
    ]
    for index, (person, kind, target, id) in enumerate(notices):
        insert(
            b.conn,
            "notifications",
            id=uid("notice:" + str(index)),
            company_id=uid("company"),
            user_id=uid(person),
            dedupe_key="demo:" + str(index),
            kind=kind,
            target_type=target,
            target_id=id,
            created_at=b.clock.at(-1, 16),
            read_at=b.clock.at(-1, 17) if index == 1 else None,
        )
