"""Pure attendance-to-pay projection, adapted from SBOSS calculation rules."""

from datetime import date, timedelta

from app.domain.errors import BusinessError
from app.domain.workforce_advances import deduction_limit
from app.domain.workforce_pay import allocate_prorated_rate, calculate_salary
from app.domain.workforce_time import attendance_shift_window
from app.workforce_contracts import PayDay, SalaryPreview


def need(condition, message, code="WORKFORCE_CONFLICT"):
    if not condition:
        raise BusinessError(code, message, 409)


def days(start, end):
    return [start + timedelta(days=i) for i in range((end - start).days + 1)]


def period(day, cycle):
    if cycle == "daily":
        return day, day
    if cycle == "weekly":
        start = day - timedelta(days=day.weekday())
        return start, start + timedelta(days=6)
    start = day.replace(day=1)
    end = (start + timedelta(days=32)).replace(day=1) - timedelta(days=1)
    return start, end


def salary_from_sources(
    *,
    user_id,
    start,
    end,
    today,
    terms,
    policy,
    policies,
    sessions,
    reviews,
    requests,
    events,
    salaries,
    balance,
    plan,
    bonus,
    deduction,
    empty_signature,
):
    holiday = {h.day: h for h in policy.holidays}
    blockers = []
    source_days = []
    earnings = 0
    half_days = 0
    minutes_total = 0
    if today <= end:
        blockers.append("The pay period has not ended.")
    if any(s.status != "void" and s.start <= end and s.end >= start for s in salaries):
        blockers.append("This period already has a confirmed statement.")
    if any(s.status != "void" and s.start > end for s in salaries):
        blockers.append("Confirm salary periods from oldest to newest.")
    if any(
        r["kind"] == "leave"
        and r["decision"] is None
        and date.fromisoformat(r["payload"]["start"]) <= end
        and date.fromisoformat(r["payload"]["end"]) >= start
        for r in requests
    ):
        blockers.append("Review pending leave in this period.")
    for day in days(start, end):
        dpolicy = policies[day]
        schedule = terms.schedule or dpolicy.schedule
        scheduled = day.weekday() in schedule.weekdays
        s = sessions.get(day)
        review = reviews.get(day)
        warnings = []
        units = 0
        minutes = None
        source = "weekly_off"
        if s:
            schedule = s.schedule
            scheduled = day.weekday() in schedule.weekdays
        leave = next(
            (
                r["payload"]
                for r in requests
                if r["kind"] == "leave"
                and r["decision"] == "approved"
                and date.fromisoformat(r["payload"]["start"])
                <= day
                <= date.fromisoformat(r["payload"]["end"])
            ),
            None,
        )
        if day in holiday:
            source = "paid_holiday" if holiday[day].paid else "unpaid_holiday"
            units = 2 if scheduled and holiday[day].paid else 0
        elif scheduled:
            source = "missing"
            blockers.append(
                f"{day}: attendance needs review."
            ) if not s and not leave and not review else None
            if leave:
                source = "paid_leave" if leave["paid"] else "unpaid_leave"
                units = leave["half_days_per_day"] if leave["paid"] else 0
        if s:
            source = "attendance" if scheduled else "off_day_work"
            units = 2 if scheduled or terms.basis in ("daily", "hourly") else 0
            minutes = s.minutes
            warnings.extend(s.flags)
            if s.status == "open":
                blockers.append(f"{day}: shift is still open.")
            if s.status == "missed_out":
                warnings.append("Missing punch-out; departure time is unknown.")
        if review and review.source_signature == (s.source_signature if s else empty_signature):
            source = "reviewed"
            units = review.half_days
            minutes = review.minutes
        elif review:
            warnings.append("Attendance changed after review.")
            blockers.append(f"{day}: refresh the attendance review.")
        if terms.basis == "hourly":
            if units and minutes is None and source in ("paid_holiday", "paid_leave"):
                window = attendance_shift_window(day, schedule.timezone, schedule.start, schedule.end)
                minutes = int((window.ends_at - window.starts_at).total_seconds() // 60) * units // 2
            if units and minutes is None:
                blockers.append(f"{day}: paid minutes are unknown.")
            amount = (
                calculate_salary(
                    pay_basis="hourly",
                    rate_paise=terms.rate_paise,
                    payable_half_days=0,
                    scheduled_work_days=1,
                    bonus_paise=0,
                    advance_opening_paise=0,
                    payable_minutes=minutes_total + (minutes or 0),
                ).base_pay_paise
                - earnings
            )
        elif terms.basis == "daily":
            amount = (
                calculate_salary(
                    pay_basis="daily",
                    rate_paise=terms.rate_paise,
                    payable_half_days=half_days + units,
                    scheduled_work_days=1,
                    bonus_paise=0,
                    advance_opening_paise=0,
                ).base_pay_paise
                - earnings
            )
        else:
            unit_start, unit_end = period(day, terms.basis)
            scheduled_days = [
                d
                for d in days(unit_start, unit_end)
                if d.weekday() in (terms.schedule or policies[d].schedule).weekdays
            ]
            indexes = (
                tuple(scheduled_days.index(day) * 2 + i for i in range(units))
                if day in scheduled_days
                else ()
            )
            amount = (
                allocate_prorated_rate(terms.rate_paise, len(scheduled_days) * 2, indexes)
                if scheduled_days
                else 0
            )
        half_days += units
        minutes_total += minutes or 0
        earnings += amount
        source_days.append(
            PayDay(
                day=day,
                source=source,
                half_days=units,
                minutes=minutes,
                earnings_paise=amount,
                warnings=warnings,
            )
        )
    limit = balance
    if plan and start >= plan.starts_on:
        active_ids = {str(e.id) for e in events if e.kind == "advance_payment" and not e.reversed}
        if not active_ids.issubset(set(plan.payment_ids)):
            blockers.append("A new advance needs an updated recovery plan.")
        deduction_start = (
            period(plan.starts_on, terms.cycle)[1] + timedelta(days=1)
            if plan.mode == "skip"
            else plan.starts_on
        )
        limit = deduction_limit(
            mode=plan.mode,
            balance=balance,
            covered_remaining=balance,
            portion=plan.portion_paise,
            period_start=start,
            plan_start=plan.starts_on,
            deduction_start=deduction_start,
        )
    gross = earnings + bonus
    need(deduction <= gross, "Deductions cannot exceed earned pay and bonus.")
    recovery = min(balance, limit, gross - deduction)
    preview = SalaryPreview(
        user_id=user_id,
        start=start,
        end=end,
        due_on=end + timedelta(days=terms.payout_delay_days),
        terms=terms,
        source_days=source_days,
        base_paise=earnings,
        bonus_paise=bonus,
        deduction_paise=deduction,
        advance_balance_paise=balance,
        advance_recovery_paise=recovery,
        net_paise=gross - deduction - recovery,
        blockers=list(dict.fromkeys(blockers)),
        fingerprint="",
    )
    return preview
