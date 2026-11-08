"""Date-relative attendance, payroll, requests and repeating work fixtures."""

from datetime import datetime, timedelta

from app.adapters.workforce import WorkforceStore
from app.demo.core import IST, audit, insert
from app.domain.workforce_time import attendance_shift_window
from app.routine_contracts import RoutineDefinition
from app.workforce_contracts import AdvancePlan, Holiday, PayTerms, Schedule, WorkforcePolicy


class DemoPayrollReader(WorkforceStore):
    """Anchor calculations only while importing; never changes the running API clock."""

    def __init__(self, builder):
        super().__init__(builder.workflows, builder.media.root)
        self.clock = builder.clock

    def now(self, conn):
        return self.clock.at(0, 20)


def request(b, person, key, kind, payload, decision=None, offset=-2):
    uid = b.uid
    id = uid("request:" + key)
    insert(
        b.conn,
        "workforce_requests",
        id=id,
        company_id=uid("company"),
        user_id=uid(person),
        kind=kind,
        payload=payload,
        recorded_by=uid(person),
        created_at=b.clock.at(offset, 11),
    )
    if decision:
        insert(
            b.conn,
            "workforce_request_reviews",
            request_id=id,
            company_id=uid("company"),
            decision=decision,
            reason="Demo request decision",
            recorded_by=uid("owner"),
            created_at=b.clock.at(offset, 12),
        )
    audit(
        b.conn,
        b.clock,
        "request:" + key,
        uid(person),
        "workforce.request",
        "Demo " + kind + " request",
        offset=offset,
        actor=b.uid(person),
    )
    return id


def pay(b, person, key, kind, target, amount, offset=-1, reverses=None, hour=15):
    uid = b.uid
    id = uid("pay:" + key)
    insert(
        b.conn,
        "workforce_pay_events",
        id=id,
        company_id=uid("company"),
        user_id=uid(person),
        kind=kind,
        target_id=target,
        reverses_id=reverses,
        amount_paise=amount,
        reference="DEMO-PAY-" + key.upper(),
        reason="Demo sample payment / correction",
        occurred_at=b.clock.at(offset, hour),
        recorded_by=uid("owner"),
        created_at=b.clock.at(offset, hour),
    )
    return id


def workforce(b):
    uid = b.uid
    c, clock = b.conn, b.clock
    start, _end = clock.previous_month
    history_start = min(start, clock.day(-40))
    schedule = Schedule(weekdays=list(range(7)))
    policy = WorkforcePolicy(
        version=1,
        effective_from=history_start - timedelta(days=10),
        schedule=schedule,
        holidays=[Holiday(day=clock.day(10), name="Demo paid holiday", paid=True)],
        collect_location=False,
        selfie_required=False,
    )
    insert(
        c,
        "workforce_policies",
        company_id=uid("company"),
        version=1,
        effective_from=policy.effective_from,
        policy=policy.model_dump(mode="json", by_alias=True),
        reason="Demo seven-day schedule for date-independent demonstrations; configure actual work rules.",
        recorded_by=uid("owner"),
        created_at=clock.at((history_start - clock.as_of).days - 10),
    )
    reader = DemoPayrollReader(b)
    leave_day = clock.day(-5)
    for staff in b.config.staff:
        terms = PayTerms(
            effective_from=policy.effective_from,
            basis=staff.pay_basis,
            cycle="monthly" if staff.pay_basis == "monthly" else "weekly",
            rate_paise=staff.rate_paise,
            schedule=Schedule(start="20:00", end="05:00", weekdays=list(range(7)))
            if staff.key == "service"
            else None,
        )
        insert(
            c,
            "workforce_profiles",
            id=uid("profile:" + staff.key),
            company_id=uid("company"),
            user_id=uid(staff.key),
            version=1,
            effective_from=terms.effective_from,
            terms=terms.model_dump(mode="json", by_alias=True),
            recorded_by=uid("owner"),
            created_at=clock.at((history_start - clock.as_of).days - 9),
        )
        for d in (history_start + timedelta(days=i) for i in range((clock.as_of - history_start).days)):
            if staff.key == "office" and d == leave_day:
                continue
            missing = (staff.key == "service" and d == clock.day(-3)) or (
                staff.key == "sales" and d == clock.day(-2)
            )
            saved_schedule = terms.schedule or schedule
            shift = attendance_shift_window(d, "Asia/Kolkata", saved_schedule.start, saved_schedule.end)
            # The saved shift uses actual boundaries, including the departure cutoff.
            starts, ends, cutoff = shift.starts_at, shift.ends_at, shift.cutoff_at
            session_id = uid(f"attendance:{staff.key}:{d}")
            proof = None
            if staff.key == "employee" and d == clock.day(-1):
                proof = uid(f"attendance-proof:{staff.key}:{d}")
                insert(
                    c,
                    "attendance_proofs",
                    id=proof,
                    company_id=uid("company"),
                    user_id=uid(staff.key),
                    created_at=starts,
                    **b.media.save(proof),
                )
            insert(
                c,
                "attendance_sessions",
                id=session_id,
                company_id=uid("company"),
                user_id=uid(staff.key),
                work_date=d,
                punched_in_at=starts,
                punched_out_at=None if missing else ends,
                minutes=None if missing else int((ends - starts).total_seconds() // 60),
                status="missed_out" if missing else "closed",
                version=2,
                schedule=saved_schedule.model_dump(mode="json", by_alias=True),
                policy=policy.model_dump(mode="json", by_alias=True),
                policy_version=1,
                selfie_required=False,
                starts_at=starts,
                ends_at=ends,
                cutoff_at=cutoff,
                flags=["missing_out"] if missing else [],
                proof_id=proof,
            )
            insert(
                c,
                "workforce_events",
                id=uid("attendance-event:" + str(session_id)),
                company_id=uid("company"),
                user_id=uid(staff.key),
                kind="missing_out" if missing else "punch_out",
                target_id=session_id,
                payload={
                    "origin": "demo-seed",
                    "workDate": d.isoformat(),
                    "minutes": None if missing else 540,
                },
                recorded_by=uid(staff.key),
                created_at=cutoff if missing else ends,
            )
        if staff.key == "service":
            day = clock.day(-3)
            record = reader.attendance(c, b.owner, uid(staff.key), day, day, clock.at())[0]
            insert(
                c,
                "workforce_day_reviews",
                id=uid("day-review:service"),
                company_id=uid("company"),
                user_id=uid(staff.key),
                work_date=day,
                half_days=2,
                minutes=510,
                reason="Demo: confirmed work time after a missing punch-out; original punch remains unknown.",
                source_signature=record.source_signature,
                recorded_by=uid("owner"),
                created_at=clock.at(-2, 14),
            )
    request(
        b,
        "office",
        "approved-leave",
        "leave",
        {
            "start": leave_day.isoformat(),
            "end": leave_day.isoformat(),
            "half_days_per_day": 2,
            "paid": True,
            "reason": "Demo approved leave",
        },
        "approved",
        -8,
    )
    request(
        b,
        "employee",
        "pending-leave",
        "leave",
        {
            "start": clock.day(2).isoformat(),
            "end": clock.day(2).isoformat(),
            "half_days_per_day": 2,
            "paid": True,
            "reason": "Demo: family appointment",
        },
    )
    request(
        b,
        "sales",
        "rejected-leave",
        "leave",
        {
            "start": clock.day(-8).isoformat(),
            "end": clock.day(-8).isoformat(),
            "half_days_per_day": 1,
            "paid": False,
            "reason": "Demo leave request",
        },
        "rejected",
        -12,
    )
    request(
        b, "office", "pending-advance", "advance", {"amount_paise": 500000, "reason": "Demo: advance request"}
    )
    advance = request(
        b,
        "service",
        "paid-advance",
        "advance",
        {"amount_paise": 800000, "reason": "Demo advance with installment recovery"},
        "approved",
        -30,
    )
    paid_id = pay(b, "service", "paid-advance", "advance_payment", advance, 800000, -29)
    plan = AdvancePlan(
        id=uid("advance-plan:service"),
        mode="split",
        portion_paise=200000,
        starts_on=clock.day(-28),
        payment_ids=[str(paid_id)],
        reason="Demo: recover the advance in four installments",
    )
    insert(
        c,
        "workforce_advance_plans",
        id=plan.id,
        company_id=uid("company"),
        user_id=uid("service"),
        plan=plan.model_dump(mode="json", by_alias=True),
        recorded_by=uid("owner"),
        created_at=clock.at(-28),
    )
    for staff in b.config.staff:
        as_of = start if staff.pay_basis == "monthly" else clock.day(-14)
        preview = reader.preview(b.owner, uid(staff.key), as_of, conn=c)
        if preview.blockers:
            raise RuntimeError(f"Demo salary has unresolved sources for {staff.key}: {preview.blockers}")

        def after_period(offset):
            return (max(preview.end + timedelta(days=1), clock.day(offset)) - clock.as_of).days

        confirmed = after_period(-4)
        revision = 1
        if staff.key == "employee":
            original = uid("salary:employee:original")
            insert(
                c,
                "salary_statements",
                id=original,
                company_id=uid("company"),
                user_id=uid(staff.key),
                period_start=preview.start,
                period_end=preview.end,
                revision=1,
                snapshot=preview.model_dump(mode="json", by_alias=True),
                reason="Demo original statement retained before correction",
                recorded_by=uid("owner"),
                created_at=clock.at(after_period(-6), 9),
            )
            pay(b, staff.key, "void-original", "void", original, 0, after_period(-5), hour=10)
            preview = reader.preview(b.owner, uid(staff.key), as_of, bonus=50000, conn=c)
            revision = 2
        id = uid("salary:" + staff.key)
        insert(
            c,
            "salary_statements",
            id=id,
            company_id=uid("company"),
            user_id=uid(staff.key),
            period_start=preview.start,
            period_end=preview.end,
            revision=revision,
            snapshot=preview.model_dump(mode="json", by_alias=True),
            reason="Demo salary computed from the saved attendance, leave and advance sources",
            recorded_by=uid("owner"),
            created_at=clock.at(confirmed, 12),
        )
        if staff.key != "service":
            amount = preview.net_paise // 2 if staff.key == "employee" else preview.net_paise
            payment = pay(b, staff.key, "salary-" + staff.key, "salary_payment", id, amount, after_period(-3))
            if staff.key == "office":
                pay(
                    b,
                    staff.key,
                    "reverse-office-payment",
                    "reversal",
                    id,
                    amount,
                    after_period(-2),
                    payment,
                    hour=16,
                )
                pay(
                    b,
                    staff.key,
                    "correct-office-payment",
                    "salary_payment",
                    id,
                    amount,
                    after_period(-1),
                    hour=17,
                )
        audit(
            c,
            clock,
            "salary:" + staff.key,
            uid(staff.key),
            "workforce.salary_confirmed",
            "Demo saved salary statement",
            offset=confirmed,
            statementId=str(id),
        )
    # Keep an actual current-day punch plausible without inventing future attendance.
    actual = datetime.now(IST)
    if actual.date() == clock.as_of and 10 <= actual.hour < 19:
        shift = attendance_shift_window(clock.as_of, "Asia/Kolkata", schedule.start, schedule.end)
        starts, ends, cutoff = shift.starts_at, shift.ends_at, shift.cutoff_at
        punched = max(starts, actual - timedelta(minutes=90))
        insert(
            c,
            "attendance_sessions",
            id=uid("attendance:employee:today"),
            company_id=uid("company"),
            user_id=uid("employee"),
            work_date=clock.as_of,
            punched_in_at=punched,
            status="open",
            version=1,
            schedule=schedule.model_dump(mode="json", by_alias=True),
            policy=policy.model_dump(mode="json", by_alias=True),
            policy_version=1,
            selfie_required=False,
            starts_at=starts,
            ends_at=ends,
            cutoff_at=cutoff,
            flags=[],
        )
    routines(b)


def routines(b):
    uid = b.uid
    definitions = [
        (
            "yard",
            "employee",
            "Showroom opening",
            [
                "Count the vehicle keys in the cabinet",
                "Walk the parked-car row and report any damage",
                "Check that booked vehicles are labelled",
            ],
            1,
        ),
        (
            "parts",
            "service",
            "Workshop and parts follow-up",
            [
                "Call the workshop for the current repair status",
                "Record expected dates for pending parts",
                "Update the assigned car's next action",
            ],
            0,
        ),
        (
            "closing",
            "office",
            "Closing documents and keys",
            [
                "Match the key register to parked vehicles",
                "Check the pending document list",
                "Record the closing handover",
            ],
            3,
        ),
        (
            "review",
            "supervisor",
            "Daily operations review",
            [
                "Review submitted inspection checks",
                "Review attendance exceptions",
                "Allocate the remaining work",
            ],
            0,
        ),
    ]
    for key, person, title, steps, done in definitions:
        id = uid("routine:" + key)
        definition = RoutineDefinition(
            title=title, assigned_to=uid(person), weekdays=list(range(7)), steps=steps
        )
        insert(
            b.conn,
            "staff_routines",
            id=id,
            company_id=uid("company"),
            version=1,
            definition=definition.model_dump(mode="json", by_alias=True),
            assigned_to=uid(person),
            active=True,
            reason="Demo daily routine; edit or pause for actual operations",
            recorded_by=uid("owner"),
            created_at=b.clock.at(-20),
        )
        for offset, count in [(-1, len(steps)), (0, done)]:
            if count == 0:
                continue
            insert(
                b.conn,
                "routine_runs",
                routine_id=id,
                company_id=uid("company"),
                work_date=b.clock.day(offset),
                definition_version=1,
                assigned_to=uid(person),
                snapshot=definition.model_dump(mode="json", by_alias=True),
            )
            for step in range(count):
                insert(
                    b.conn,
                    "routine_step_events",
                    routine_id=id,
                    company_id=uid("company"),
                    work_date=b.clock.day(offset),
                    version=step + 1,
                    step=step,
                    done=True,
                    note="Demo routine activity",
                    recorded_by=uid(person),
                    created_at=b.clock.at(offset, 10, step * 3),
                )
