"""Transactional workforce adapter. SBOSS rules, Arihant identity and receipts."""

import hashlib
import json
from datetime import date, timedelta
from pathlib import Path
from uuid import uuid4

from fastapi.encoders import jsonable_encoder
from sqlalchemy import text

from app.adapters.command_transaction import CommandTransaction
from app.adapters.media import inspect_photo
from app.adapters.notifications import NotificationStore
from app.adapters.operations import rows
from app.contracts import Actor
from app.domain.access import can, require
from app.domain.errors import BusinessError
from app.domain.workforce_policy import days, need, period, salary_from_sources
from app.domain.workforce_time import (
    attendance_shift_window,
    business_local_date,
    check_location,
    has_clock_skew,
    worked_minutes,
)
from app.domain.workshop_policy import require_owner
from app.workforce_contracts import (
    AdvancePlan,
    AdvanceRecord,
    AttendanceRecord,
    DayReview,
    LeaveRecord,
    PayEvent,
    PayTerms,
    PublishWorkforcePolicy,
    SalaryPreview,
    SalaryRecord,
    WorkforceCommand,
    WorkforcePolicy,
    WorkforceView,
)


def dump(value):
    if hasattr(value, "model_dump"):
        value = value.model_dump(mode="json", by_alias=True)
    return json.dumps(jsonable_encoder(value), sort_keys=True)


def digest(value):
    return hashlib.sha256(dump(value).encode()).hexdigest()


class WorkforceStore:
    def __init__(self, workflows, root: Path):
        self.workflows = workflows
        self.engine = workflows.engine
        self.root = root
        self.commands = CommandTransaction(self.engine)

    def now(self, conn):
        return conn.execute(text("SELECT clock_timestamp()")).scalar_one()

    def person(self, conn, actor, user_id, active=False):
        if user_id != actor.id:
            require(actor, "finance")
        result = rows(
            conn,
            "SELECT id,name,active FROM users WHERE id=:user AND company_id=:company",
            {"user": user_id, "company": actor.company_id},
        )
        if not result or (active and not result[0]["active"]):
            raise BusinessError("NOT_FOUND", "This person is unavailable.", 404)
        return result[0]

    def lock(self, conn, actor, user_id):
        self.person(conn, actor, user_id)
        conn.execute(
            text("SELECT pg_advisory_xact_lock(hashtextextended(:key,0))"),
            {"key": f"workforce:{actor.company_id}"},
        )
        conn.execute(
            text("SELECT id FROM users WHERE id=:user AND company_id=:company FOR UPDATE"),
            {"user": user_id, "company": actor.company_id},
        )

    def policy(self, actor, conn=None, on=None):
        if conn is None:
            with self.engine.connect() as c:
                return self.policy(actor, c, on)
        found = rows(
            conn,
            "SELECT policy FROM workforce_policies WHERE company_id=:company AND (CAST(:day AS date) IS NULL OR effective_from<=:day) ORDER BY version DESC LIMIT 1",
            {"company": actor.company_id, "day": on},
        )
        return WorkforcePolicy.model_validate(found[0]["policy"]) if found else WorkforcePolicy()

    def publish(self, actor, body: PublishWorkforcePolicy):
        require_owner(actor)

        def execute(conn):
            self.lock(conn, actor, actor.id)
            now = self.now(conn)
            current = self.policy(actor, conn)
            need(
                body.expected_version == current.version,
                "Workforce rules changed. Refresh the current version.",
                "VERSION_CONFLICT",
            )
            need(
                body.policy.effective_from >= business_local_date(now, "Asia/Kolkata"),
                "Schedule changes start today or later.",
            )
            need(body.reason.strip(), "Record why these rules changed.")
            p = body.policy.model_copy(update={"version": current.version + 1})
            conn.execute(
                text(
                    "INSERT INTO workforce_policies(company_id,version,effective_from,policy,reason,recorded_by) VALUES(:company,:version,:day,CAST(:policy AS jsonb),:reason,:actor)"
                ),
                {
                    "company": actor.company_id,
                    "version": p.version,
                    "day": p.effective_from,
                    "policy": dump(p),
                    "reason": body.reason.strip(),
                    "actor": actor.id,
                },
            )
            self.workflows.ops.audit(
                conn,
                actor,
                actor.company_id,
                "workforce.policy_published",
                {"version": p.version, "reason": body.reason},
            )
            return p

        return self.commands.run(actor, body.command_id, "workforce:policy", body, WorkforcePolicy, execute)

    def profiles(self, conn, actor, user_id):
        return rows(
            conn,
            "SELECT * FROM workforce_profiles WHERE company_id=:company AND user_id=:user ORDER BY effective_from,version",
            {"company": actor.company_id, "user": user_id},
        )

    def terms_on(self, profiles, day):
        valid = [p for p in profiles if p["effective_from"] <= day]
        return PayTerms.model_validate(valid[-1]["terms"]) if valid else None

    def requests(self, conn, actor, user_id):
        return rows(
            conn,
            """SELECT q.*,r.decision,r.reason review_reason,r.created_at reviewed_at,
        EXISTS(SELECT 1 FROM workforce_pay_events p WHERE p.target_id=q.id AND p.company_id=q.company_id AND p.kind='advance_payment' AND NOT EXISTS(SELECT 1 FROM workforce_pay_events x WHERE x.reverses_id=p.id)) paid_out
        FROM workforce_requests q LEFT JOIN workforce_request_reviews r ON r.request_id=q.id AND r.company_id=q.company_id
        WHERE q.company_id=:company AND q.user_id=:user ORDER BY q.created_at,q.id""",
            {"company": actor.company_id, "user": user_id},
        )

    def pay_events(self, conn, actor, user_id):
        result = rows(
            conn,
            """SELECT e.id,e.kind,e.amount_paise,e.target_id,e.reverses_id,e.reference,e.reason,e.occurred_at,u.name recorded_by,
        EXISTS(SELECT 1 FROM workforce_pay_events r WHERE r.reverses_id=e.id AND r.company_id=e.company_id) reversed
        FROM workforce_pay_events e JOIN users u ON u.id=e.recorded_by AND u.company_id=e.company_id
        WHERE e.company_id=:company AND e.user_id=:user ORDER BY e.created_at,e.id""",
            {"company": actor.company_id, "user": user_id},
        )
        return [PayEvent.model_validate(r) for r in result]

    def salaries(self, conn, actor, user_id, events=None):
        events = events if events is not None else self.pay_events(conn, actor, user_id)
        records = rows(
            conn,
            "SELECT s.*,u.name confirmed_by FROM salary_statements s JOIN users u ON u.id=s.recorded_by AND u.company_id=s.company_id WHERE s.company_id=:company AND s.user_id=:user ORDER BY period_start,revision",
            {"company": actor.company_id, "user": user_id},
        )
        result = []
        for row in records:
            paid = sum(
                e.amount_paise
                for e in events
                if e.kind == "salary_payment" and e.target_id == row["id"] and not e.reversed
            )
            void = any(e.kind == "void" and e.target_id == row["id"] for e in events)
            snapshot = SalaryPreview.model_validate(row["snapshot"])
            result.append(
                SalaryRecord(
                    id=row["id"],
                    start=row["period_start"],
                    end=row["period_end"],
                    revision=row["revision"],
                    snapshot=snapshot,
                    confirmed_by=row["confirmed_by"],
                    confirmed_at=row["created_at"],
                    paid_paise=paid,
                    status="void" if void else "paid" if paid == snapshot.net_paise else "confirmed",
                )
            )
        return result

    def balance(self, events, salaries):
        return sum(e.amount_paise for e in events if e.kind == "advance_payment" and not e.reversed) - sum(
            s.snapshot.advance_recovery_paise for s in salaries if s.status != "void"
        )

    def plan(self, conn, actor, user_id):
        records = rows(
            conn,
            "SELECT plan FROM workforce_advance_plans WHERE company_id=:company AND user_id=:user ORDER BY created_at DESC,id DESC LIMIT 1",
            {"company": actor.company_id, "user": user_id},
        )
        return AdvancePlan.model_validate(records[0]["plan"]) if records else None

    def attendance(self, conn, actor, user_id, start, end, now):
        records = rows(
            conn,
            "SELECT * FROM attendance_sessions WHERE company_id=:company AND user_id=:user AND (work_date BETWEEN :start AND :end OR status='open') ORDER BY work_date",
            {"company": actor.company_id, "user": user_id, "start": start, "end": end},
        )
        result = []
        for r in records:
            if r["status"] == "open" and now >= r["cutoff_at"]:
                r["status"] = "missed_out"
                r["version"] += 1
            record = AttendanceRecord.model_validate(
                {k: r[k] for k in AttendanceRecord.model_fields if k in r}
            )
            record.source_signature = self.day_signature(record)
            result.append(record)
        return result

    def reviews(self, conn, actor, user_id, start, end):
        records = rows(
            conn,
            "SELECT DISTINCT ON (r.work_date) r.*,u.name reviewed_by FROM workforce_day_reviews r JOIN users u ON u.id=r.recorded_by AND u.company_id=r.company_id WHERE r.company_id=:company AND r.user_id=:user AND work_date BETWEEN :start AND :end ORDER BY r.work_date,r.created_at DESC,r.id DESC",
            {"company": actor.company_id, "user": user_id, "start": start, "end": end},
        )
        return [DayReview.model_validate({k: r[k] for k in DayReview.model_fields}) for r in records]

    def day_signature(self, session):
        return digest(
            session.model_dump(mode="json", by_alias=True, exclude={"source_signature"}) if session else None
        )

    def leave_used(self, conn, actor, user_id, year, extra=None):
        total = 0
        requests = self.requests(conn, actor, user_id)
        if extra:
            requests = requests + [extra]
        for r in requests:
            if r["kind"] != "leave" or r.get("decision") != "approved" or not r["payload"]["paid"]:
                continue
            p = r["payload"]
            for d in days(date.fromisoformat(p["start"]), date.fromisoformat(p["end"])):
                if d.year != year:
                    continue
                policy = self.policy(actor, conn, d)
                terms = self.terms_on(self.profiles(conn, actor, user_id), d)
                schedule = terms.schedule if terms and terms.schedule else policy.schedule
                if d.weekday() in schedule.weekdays and not any(
                    h.day == d for h in self.policy(actor, conn).holidays
                ):
                    total += p["half_days_per_day"]
        return total

    def view(self, actor, user_id=None, as_of=None, conn=None):
        if conn is None:
            with self.engine.connect() as c:
                return self.view(actor, user_id, as_of, c)
        user_id = user_id or actor.id
        self.person(conn, actor, user_id)
        now = self.now(conn)
        today = business_local_date(now, "Asia/Kolkata")
        as_of = as_of or today
        start, end = period(as_of, "monthly")
        profiles = self.profiles(conn, actor, user_id)
        requests = self.requests(conn, actor, user_id)
        events = self.pay_events(conn, actor, user_id)
        salaries = self.salaries(conn, actor, user_id, events)
        people = rows(
            conn,
            "SELECT id,name,active FROM users WHERE company_id=:company AND (:all OR id=:user) ORDER BY active DESC,name,id",
            {"company": actor.company_id, "all": can(actor, "finance"), "user": actor.id},
        )
        team_sessions = rows(
            conn,
            "SELECT user_id,work_date,status,cutoff_at FROM attendance_sessions WHERE company_id=:company AND (:all OR user_id=:user) AND work_date BETWEEN :start AND :end ORDER BY work_date",
            {
                "company": actor.company_id,
                "all": can(actor, "finance"),
                "user": actor.id,
                "start": as_of - timedelta(days=1),
                "end": as_of,
            },
        )
        for person in people:
            record = next(
                (
                    s
                    for s in reversed(team_sessions)
                    if s["user_id"] == person["id"]
                    and (
                        s["work_date"] == as_of
                        or (as_of == today and s["status"] in ("open", "closed") and s["cutoff_at"] > now)
                    )
                ),
                None,
            )
            if record:
                person["attendance_status"] = (
                    "missed_out"
                    if record["status"] == "open" and record["cutoff_at"] <= now
                    else record["status"]
                )
            else:
                terms = self.terms_on(self.profiles(conn, actor, person["id"]), as_of)
                schedule = (
                    terms.schedule if terms and terms.schedule else self.policy(actor, conn, as_of).schedule
                )
                off = as_of.weekday() not in schedule.weekdays or any(
                    h.day == as_of for h in self.policy(actor, conn).holidays
                )
                person["attendance_status"] = "off_day" if off else "not_punched"
        leaves = [
            LeaveRecord(
                id=r["id"],
                **r["payload"],
                status=r["decision"] or "pending",
                version=2 if r["decision"] else 1,
                review_reason=r["review_reason"],
            )
            for r in requests
            if r["kind"] == "leave"
        ]
        advances = [
            AdvanceRecord(
                id=r["id"],
                **r["payload"],
                status="paid" if r["paid_out"] else r["decision"] or "pending",
                version=3 if r["paid_out"] else 2 if r["decision"] else 1,
                reference=next(
                    (e.reference for e in events if e.target_id == r["id"] and e.kind == "advance_payment"),
                    None,
                ),
            )
            for r in requests
            if r["kind"] == "advance"
        ]
        # Date selection exposes old records, while recent/unfinished obligations stay visible.
        recent_salary_ids = {s.id for s in salaries[-10:]}
        shown_salaries = [
            s for s in salaries if s.id in recent_salary_ids or (s.start <= end and s.end >= start)
        ]
        salary_ids = {s.id for s in shown_salaries}
        recent_payment_ids = {e.id for e in events[-20:]}
        shown_events = [
            e
            for e in events
            if e.id in recent_payment_ids
            or e.target_id in salary_ids
            or start <= business_local_date(e.occurred_at, "Asia/Kolkata") <= end
        ]
        advance_ids = {e.target_id for e in shown_events if e.kind == "advance_payment"}
        recent_advance_ids = {a.id for a in advances[-10:]}
        shown_advances = [
            a
            for a in advances
            if a.status in ("pending", "approved") or a.id in advance_ids or a.id in recent_advance_ids
        ]
        recent_leave_ids = {leave.id for leave in leaves[-10:]}
        shown_leaves = [
            leave
            for leave in leaves
            if leave.status == "pending"
            or leave.id in recent_leave_ids
            or (leave.start <= end and leave.end >= start)
        ]
        return WorkforceView(
            server_now=now,
            today=today,
            empty_day_signature=self.day_signature(None),
            people=people,
            selected_user_id=user_id,
            policy=self.policy(actor, conn),
            profile_version=max((p["version"] for p in profiles), default=0),
            pay_terms=self.terms_on(profiles, as_of),
            attendance=self.attendance(conn, actor, user_id, start, end, now),
            reviews=self.reviews(conn, actor, user_id, start, end),
            leaves=shown_leaves,
            leave_used_half_days=self.leave_used(conn, actor, user_id, as_of.year),
            advances=shown_advances,
            advance_plan=self.plan(conn, actor, user_id),
            advance_balance_paise=self.balance(events, salaries),
            salaries=list(reversed(shown_salaries)),
            payments=list(reversed(shown_events)),
        )

    def preview(self, actor, user_id, as_of, bonus=0, deduction=0, conn=None):
        if conn is None:
            with self.engine.connect() as c:
                return self.preview(actor, user_id, as_of, bonus, deduction, c)
        self.person(conn, actor, user_id)
        profiles = self.profiles(conn, actor, user_id)
        terms = self.terms_on(profiles, as_of)
        need(terms is not None, "The owner must set pay terms for this date.", "PAY_NOT_CONFIGURED")
        start, end = period(as_of, terms.cycle)
        start = max(start, terms.effective_from)
        next_profiles = [
            p["effective_from"]
            for p in profiles
            if p["effective_from"] > terms.effective_from and p["effective_from"] <= end
        ]
        if next_profiles:
            end = min(end, min(next_profiles) - timedelta(days=1))
        now = self.now(conn)
        today = business_local_date(now, "Asia/Kolkata")
        policy = self.policy(actor, conn)
        sessions = {
            s.work_date: s
            for s in self.attendance(conn, actor, user_id, start, end, now)
            if start <= s.work_date <= end
        }
        reviews = {r.work_date: r for r in self.reviews(conn, actor, user_id, start, end)}
        requests = self.requests(conn, actor, user_id)
        events = self.pay_events(conn, actor, user_id)
        salaries = self.salaries(conn, actor, user_id, events)
        balance = self.balance(events, salaries)
        plan = self.plan(conn, actor, user_id)
        unit = terms.basis if terms.basis in ("weekly", "monthly") else terms.cycle
        lo = min(start, period(start, unit)[0])
        hi = max(end, period(end, unit)[1])
        policy_rows = rows(
            conn,
            "SELECT policy FROM workforce_policies WHERE company_id=:company ORDER BY version DESC",
            {"company": actor.company_id},
        )
        history = [WorkforcePolicy.model_validate(p["policy"]) for p in policy_rows]
        policies = {
            d: next((p for p in history if p.effective_from <= d), WorkforcePolicy()) for d in days(lo, hi)
        }
        preview = salary_from_sources(
            user_id=user_id,
            start=start,
            end=end,
            today=today,
            terms=terms,
            policy=policy,
            policies=policies,
            sessions=sessions,
            reviews=reviews,
            requests=requests,
            events=events,
            salaries=salaries,
            balance=balance,
            plan=plan,
            bonus=bonus,
            deduction=deduction,
            empty_signature=self.day_signature(None),
        )
        # Source revisions and proofs are included even when rounded earnings stay equal.
        preview.fingerprint = digest(
            {
                "preview": preview,
                "profiles": profiles,
                "policy": policy,
                "sessions": sessions,
                "reviews": reviews,
                "requests": requests,
                "events": events,
                "plan": plan,
            }
        )
        return preview

    def event(self, conn, actor, user_id, kind, payload, target_id=None):
        id = uuid4()
        p = {
            "id": id,
            "company": actor.company_id,
            "user": user_id,
            "kind": kind,
            "payload": dump(payload),
            "actor": actor.id,
            "target": target_id,
        }
        conn.execute(
            text(
                "INSERT INTO workforce_events(id,company_id,user_id,kind,target_id,payload,recorded_by) VALUES(:id,:company,:user,:kind,:target,CAST(:payload AS jsonb),:actor)"
            ),
            p,
        )
        self.workflows.ops.audit(
            conn,
            actor,
            user_id,
            "workforce." + kind,
            {"eventId": str(id), "targetId": str(target_id) if target_id else None},
        )
        recipients = [user_id]
        if kind in ("request_leave", "request_advance", "missing_out"):
            recipients += [
                r["id"]
                for r in rows(
                    conn,
                    "SELECT id FROM users WHERE company_id=:company AND active AND (role='owner' OR work_roles && ARRAY['supervisor','manager']::text[])",
                    {"company": actor.company_id},
                )
            ]
        for user in set(recipients):
            NotificationStore(self.engine).add(
                conn,
                actor.company_id,
                user,
                "workforce." + kind,
                "workforce",
                user_id,
                f"workforce:{id}:{user}",
            )

    def expire(self, conn, actor, user_id, now, automated=False):
        expired = rows(
            conn,
            "UPDATE attendance_sessions SET status='missed_out',version=version+1 WHERE company_id=:company AND user_id=:user AND status='open' AND cutoff_at<=:now RETURNING id,cutoff_at",
            {"company": actor.company_id, "user": user_id, "now": now},
        )
        for s in expired:
            payload = {"cutoff": s["cutoff_at"], "departureUnknown": True}
            if not automated:
                self.event(conn, actor, user_id, "missing_out", payload, s["id"])
            else:
                conn.execute(
                    text(
                        "INSERT INTO system_events(id,company_id,aggregate_id,action,summary,details) VALUES(:id,:company,:user,'workforce.missing_out','Punch-out missing; departure time remains unknown',CAST(:payload AS jsonb))"
                    ),
                    {"id": uuid4(), "company": actor.company_id, "user": user_id, "payload": dump(payload)},
                )
                recipients = rows(
                    conn,
                    "SELECT id FROM users WHERE company_id=:company AND active AND (id=:user OR role='owner' OR work_roles && ARRAY['supervisor','manager']::text[])",
                    {"company": actor.company_id, "user": user_id},
                )
                for recipient in recipients:
                    NotificationStore(self.engine).add(
                        conn,
                        actor.company_id,
                        recipient["id"],
                        "workforce.missing_out",
                        "workforce",
                        user_id,
                        f"attendance:{s['id']}:missing_out:{recipient['id']}",
                    )

    def run(self, actor, user_id, c: WorkforceCommand):
        own_actions = ("punch_in", "punch_out", "request_leave", "request_advance")
        if c.action in own_actions:
            need(user_id == actor.id, "Use your own attendance and requests.", "OWN_ACCOUNT_REQUIRED")
        elif c.action == "save_profile":
            require_owner(actor)
        else:
            require(actor, "finance")

        def authorize(conn):
            self.lock(conn, actor, user_id)

        def execute(conn):
            now = self.now(conn)
            today = business_local_date(now, "Asia/Kolkata")
            p = {"company": actor.company_id, "user": user_id, "actor": actor.id}
            self.person(conn, actor, user_id, active=c.action in own_actions)
            action = c.action
            self.expire(conn, actor, user_id, now)
            profiles = self.profiles(conn, actor, user_id)
            terms = self.terms_on(profiles, today)
            policy = self.policy(actor, conn, today)
            events = self.pay_events(conn, actor, user_id)
            salaries = self.salaries(conn, actor, user_id, events)
            active = [s for s in salaries if s.status != "void"]
            if action in ("punch_in", "punch_out"):
                need(c.punch is not None, "Capture the punch details.")
                punch = c.punch
                sessions = self.attendance(conn, actor, user_id, today - timedelta(days=2), today, now)
                if action == "punch_out":
                    s = next((s for s in sessions if s.id == c.session_id), None)
                    need(s is not None, "Choose your saved punch-in.", "SESSION_REQUIRED")
                    if s.status == "closed":
                        return self.view(actor, user_id, c.as_of, conn)
                    need(
                        s.status == "open" and now < s.cutoff_at,
                        "Punch-out is missing. Ask for attendance review.",
                        "PUNCH_OUT_CUTOFF",
                    )
                    policy_row = rows(
                        conn,
                        "SELECT policy FROM attendance_sessions WHERE id=:id AND company_id=:company",
                        p | {"id": s.id},
                    )[0]
                    policy = WorkforcePolicy.model_validate(policy_row["policy"])
                    need(c.expected_version == s.version, "This punch changed. Refresh.", "VERSION_CONFLICT")
                else:
                    opened = next((s for s in sessions if s.status == "open"), None)
                    if opened:
                        return self.view(actor, user_id, c.as_of, conn)
                    schedule = terms.schedule if terms and terms.schedule else policy.schedule
                    work_date = today
                    previous = attendance_shift_window(
                        today - timedelta(days=1), schedule.timezone, schedule.start, schedule.end
                    )
                    if schedule.end < schedule.start and now < previous.cutoff_at:
                        work_date = today - timedelta(days=1)
                    existing = rows(
                        conn,
                        "SELECT id FROM attendance_sessions WHERE company_id=:company AND user_id=:user AND work_date=:day",
                        p | {"day": work_date},
                    )
                    if existing:
                        return self.view(actor, user_id, c.as_of, conn)
                    window = attendance_shift_window(
                        work_date, schedule.timezone, schedule.start, schedule.end
                    )
                if policy.selfie_required:
                    need(
                        punch.proof_id is not None,
                        "Take the attendance photo before punching.",
                        "SELFIE_REQUIRED",
                    )
                if punch.proof_id:
                    proof = rows(
                        conn,
                        "SELECT id FROM attendance_proofs WHERE id=:id AND company_id=:company AND user_id=:user AND created_at>=:since",
                        p | {"id": punch.proof_id, "since": now - timedelta(minutes=10)},
                    )
                    need(proof, "Use your fresh attendance photo.", "PROOF_REQUIRED")
                loc = check_location(
                    latitude=punch.latitude,
                    longitude=punch.longitude,
                    accuracy_m=punch.accuracy_m,
                    business_latitude=policy.latitude,
                    business_longitude=policy.longitude,
                    geofence_radius_m=policy.radius_m,
                )
                flags = []
                if policy.collect_location:
                    if loc.low_accuracy:
                        flags.append("Location unavailable or imprecise")
                    if loc.outside_geofence:
                        flags.append("Outside the saved yard location")
                    if punch.mocked:
                        flags.append("Device reported a mock location")
                if has_clock_skew(punch.client_time, now):
                    flags.append("Device clock differs from server time")
                if action == "punch_in":
                    if now > window.starts_at + timedelta(minutes=schedule.grace_minutes):
                        flags.append("Late arrival")
                    conn.execute(
                        text("""INSERT INTO attendance_sessions(id,company_id,user_id,work_date,punched_in_at,status,schedule,policy,policy_version,selfie_required,starts_at,ends_at,cutoff_at,flags,proof_id)
                    VALUES(:id,:company,:user,:day,:now,'open',CAST(:schedule AS jsonb),CAST(:policy AS jsonb),:policy_version,:selfie_required,:start,:end,:cutoff,CAST(:flags AS jsonb),:proof)"""),
                        p
                        | {
                            "id": uuid4(),
                            "day": work_date,
                            "now": now,
                            "schedule": dump(schedule),
                            "policy": dump(policy),
                            "policy_version": policy.version,
                            "selfie_required": policy.selfie_required,
                            "start": window.starts_at,
                            "end": window.ends_at,
                            "cutoff": window.cutoff_at,
                            "flags": dump(flags),
                            "proof": punch.proof_id,
                        },
                    )
                else:
                    conn.execute(
                        text(
                            "UPDATE attendance_sessions SET punched_out_at=:now,minutes=:minutes,status='closed',version=version+1,out_proof_id=:proof,flags=CAST(:flags AS jsonb) WHERE id=:id AND company_id=:company"
                        ),
                        p
                        | {
                            "id": s.id,
                            "now": now,
                            "minutes": worked_minutes(s.punched_in_at, now),
                            "proof": punch.proof_id,
                            "flags": dump(s.flags + flags),
                        },
                    )
                self.event(conn, actor, user_id, action, punch)
            elif action == "save_profile":
                need(c.terms is not None, "Enter the pay terms.")
                need(c.reason.strip(), "Record the agreed change.")
                version = max((r["version"] for r in profiles), default=0)
                need(c.expected_version == version, "Pay settings changed. Refresh.", "VERSION_CONFLICT")
                need(
                    not any(s.end >= c.terms.effective_from for s in active),
                    "Issued salary protects its pay terms. Use a later effective date.",
                )
                need(
                    not profiles or c.terms.effective_from >= max(r["effective_from"] for r in profiles),
                    "A new pay revision cannot precede an existing revision.",
                )
                conn.execute(
                    text(
                        "INSERT INTO workforce_profiles(id,company_id,user_id,version,effective_from,terms,recorded_by) VALUES(:id,:company,:user,:version,:day,CAST(:terms AS jsonb),:actor)"
                    ),
                    p
                    | {
                        "id": uuid4(),
                        "version": version + 1,
                        "day": c.terms.effective_from,
                        "terms": dump(c.terms),
                    },
                )
            elif action == "review_day":
                need(
                    c.work_date is not None and c.work_date <= today and len(c.reason.strip()) >= 3,
                    "Choose a past/current day and review reason.",
                )
                need(
                    not any(s.start <= c.work_date <= s.end for s in active),
                    "Void the unpaid statement before changing its paid-time review.",
                )
                sessions = self.attendance(conn, actor, user_id, c.work_date, c.work_date, now)
                s = next((s for s in sessions if s.work_date == c.work_date), None)
                need(
                    c.fingerprint == self.day_signature(s),
                    "Attendance changed. Refresh before reviewing.",
                    "SOURCE_CHANGED",
                )
                need(not s or s.status != "open", "Wait for punch-out or its missing-punch cutoff.")
                need(c.half_days > 0 or not c.minutes, "An unpaid day cannot contain paid minutes.")
                conn.execute(
                    text(
                        "INSERT INTO workforce_day_reviews(id,company_id,user_id,work_date,half_days,minutes,reason,source_signature,recorded_by) VALUES(:id,:company,:user,:day,:halves,:minutes,:reason,:signature,:actor)"
                    ),
                    p
                    | {
                        "id": uuid4(),
                        "day": c.work_date,
                        "halves": c.half_days,
                        "minutes": c.minutes,
                        "reason": c.reason.strip(),
                        "signature": c.fingerprint,
                    },
                )
            elif action in ("request_leave", "request_advance"):
                need(len(c.reason.strip()) >= 3, "Record a short request reason.")
                if action == "request_leave":
                    need(
                        c.start
                        and c.end
                        and c.start <= c.end
                        and (c.end - c.start).days <= 30
                        and c.half_days in (1, 2),
                        "Choose up to 31 leave days; half-day leave uses one date.",
                    )
                    need(c.half_days == 2 or c.start == c.end, "Half-day leave uses one date.")
                    need(
                        not any(s.start <= c.end and s.end >= c.start for s in active),
                        "Leave cannot alter an issued salary period.",
                    )
                    existing = self.requests(conn, actor, user_id)
                    need(
                        not any(
                            r["kind"] == "leave"
                            and r["decision"] != "rejected"
                            and date.fromisoformat(r["payload"]["start"]) <= c.end
                            and date.fromisoformat(r["payload"]["end"]) >= c.start
                            for r in existing
                        ),
                        "An overlapping leave request already exists.",
                    )
                    payload = {
                        "start": c.start,
                        "end": c.end,
                        "half_days_per_day": c.half_days,
                        "paid": c.paid,
                        "reason": c.reason.strip(),
                    }
                else:
                    need(c.amount_paise > 0, "Enter a positive advance amount.")
                    payload = {"amount_paise": c.amount_paise, "reason": c.reason.strip()}
                id = uuid4()
                conn.execute(
                    text(
                        "INSERT INTO workforce_requests(id,company_id,user_id,kind,payload,recorded_by) VALUES(:id,:company,:user,:kind,CAST(:payload AS jsonb),:actor)"
                    ),
                    p
                    | {
                        "id": id,
                        "kind": "leave" if action == "request_leave" else "advance",
                        "payload": dump(payload),
                    },
                )
                self.event(conn, actor, user_id, action, payload, id)
            elif action in ("review_leave", "review_advance"):
                r = next((r for r in self.requests(conn, actor, user_id) if r["id"] == c.target_id), None)
                need(
                    r and r["kind"] == ("leave" if action == "review_leave" else "advance"),
                    "Choose the matching request.",
                    "NOT_FOUND",
                )
                need(
                    c.expected_version == 1 and r["decision"] is None,
                    "This request was already reviewed.",
                    "VERSION_CONFLICT",
                )
                need(len(c.reason.strip()) >= 3, "Record an approval or return reason.")
                if r["kind"] == "leave" and c.decision == "approved":
                    payload = r["payload"]
                    start = date.fromisoformat(payload["start"])
                    end = date.fromisoformat(payload["end"])
                    need(
                        not any(s.start <= end and s.end >= start for s in active),
                        "An issued salary locks its leave sources.",
                    )
                    if payload["paid"]:
                        extra = r | {"decision": "approved"}
                        for year in range(start.year, end.year + 1):
                            need(
                                self.leave_used(conn, actor, user_id, year, extra)
                                <= self.policy(actor, conn).paid_leave_half_days,
                                "This exceeds the configured annual paid-leave allowance.",
                            )
                conn.execute(
                    text(
                        "INSERT INTO workforce_request_reviews(request_id,company_id,decision,reason,recorded_by) VALUES(:id,:company,:decision,:reason,:actor)"
                    ),
                    p | {"id": r["id"], "decision": c.decision, "reason": c.reason.strip()},
                )
            elif action == "save_advance_plan":
                need(
                    terms is not None and c.as_of is not None, "Set pay terms and choose the recovery period."
                )
                start, end = period(c.as_of, terms.cycle)
                need(not any(s.end >= start for s in active), "Choose an unconfirmed recovery period.")
                balance = self.balance(events, salaries)
                need(
                    balance > 0 and len(c.reason.strip()) >= 3,
                    "A recovery plan needs an outstanding advance and a reason.",
                )
                portion = (
                    (balance + c.installments - 1) // c.installments
                    if c.plan_mode == "split"
                    else c.amount_paise
                    if c.plan_mode == "partial"
                    else balance
                )
                need(0 <= portion <= balance, "The recovery amount exceeds the advance balance.")
                plan = AdvancePlan(
                    id=uuid4(),
                    mode=c.plan_mode,
                    portion_paise=portion,
                    starts_on=start,
                    payment_ids=[str(e.id) for e in events if e.kind == "advance_payment" and not e.reversed],
                    reason=c.reason.strip(),
                )
                conn.execute(
                    text(
                        "INSERT INTO workforce_advance_plans(id,company_id,user_id,plan,recorded_by) VALUES(:id,:company,:user,CAST(:plan AS jsonb),:actor)"
                    ),
                    p | {"id": plan.id, "plan": dump(plan)},
                )
            elif action == "confirm_salary":
                need(c.as_of is not None, "Choose a salary period.")
                preview = self.preview(actor, user_id, c.as_of, c.bonus_paise, c.deduction_paise, conn)
                need(not preview.blockers, " ".join(preview.blockers), "PAYROLL_NOT_READY")
                need(
                    c.fingerprint == preview.fingerprint,
                    "Salary sources changed. Refresh the preview.",
                    "SOURCE_CHANGED",
                )
                need(c.reason.strip(), "Record the salary confirmation note.")
                revision = 1 + max(
                    (s.revision for s in salaries if s.start == preview.start and s.end == preview.end),
                    default=0,
                )
                conn.execute(
                    text(
                        "INSERT INTO salary_statements(id,company_id,user_id,period_start,period_end,revision,snapshot,reason,recorded_by) VALUES(:id,:company,:user,:start,:end,:revision,CAST(:snapshot AS jsonb),:reason,:actor)"
                    ),
                    p
                    | {
                        "id": uuid4(),
                        "start": preview.start,
                        "end": preview.end,
                        "revision": revision,
                        "snapshot": dump(preview),
                        "reason": c.reason.strip(),
                    },
                )
            elif action in ("pay_advance", "pay_salary", "reverse_payment", "void_salary"):
                need(
                    c.target_id is not None and len(c.reason.strip()) >= 3,
                    "Choose a record and give a reason.",
                )
                id = uuid4()
                amount = c.amount_paise
                reverse = None
                target = c.target_id
                reference = c.reference.strip()
                occurred = c.occurred_at or now
                need(
                    occurred.tzinfo is not None and occurred <= now,
                    "Record an actual completed transaction time.",
                )
                if action == "pay_advance":
                    r = next(
                        (
                            r
                            for r in self.requests(conn, actor, user_id)
                            if r["id"] == target and r["kind"] == "advance"
                        ),
                        None,
                    )
                    need(
                        r and r["decision"] == "approved" and not r["paid_out"],
                        "This advance needs an unused approval.",
                        "APPROVAL_REQUIRED",
                    )
                    need(
                        not any(e.kind == "advance_payment" and e.target_id == target for e in events),
                        "A reversed advance needs a new request and approval.",
                    )
                    need(amount == r["payload"]["amount_paise"], "Record the exact approved advance amount.")
                    need(occurred >= r["reviewed_at"], "Advance payment must follow its approval.")
                    kind = "advance_payment"
                elif action == "pay_salary":
                    s = next((s for s in active if s.id == target), None)
                    need(s, "Choose a confirmed salary.")
                    need(
                        0 < amount <= s.snapshot.net_paise - s.paid_paise,
                        "Payment exceeds the remaining salary.",
                    )
                    need(occurred >= s.confirmed_at, "Salary payment must follow confirmation.")
                    kind = "salary_payment"
                elif action == "void_salary":
                    s = next((s for s in active if s.id == target), None)
                    need(
                        s and s.paid_paise == 0,
                        "Reverse recorded salary payments before voiding its statement.",
                    )
                    need(
                        not any(other.start > s.start for other in active),
                        "Correct salary statements from newest to oldest.",
                    )
                    amount = 0
                    reference = ""
                    kind = "void"
                else:
                    e = next((e for e in events if e.id == target), None)
                    need(
                        e and e.kind in ("advance_payment", "salary_payment") and not e.reversed,
                        "Choose an unreversed payment.",
                    )
                    need(
                        e.kind != "advance_payment"
                        or not any(s.snapshot.advance_recovery_paise for s in active),
                        "Void salary recoveries before correcting an advance payment.",
                    )
                    amount = e.amount_paise
                    reverse = e.id
                    target = e.target_id
                    reference = ""
                    kind = "reversal"
                if kind in ("advance_payment", "salary_payment"):
                    need(reference, "Record the bank/cash voucher reference.")
                    need(
                        not rows(
                            conn,
                            "SELECT id FROM workforce_pay_events WHERE company_id=:company AND reference=:ref AND kind IN ('advance_payment','salary_payment')",
                            p | {"ref": reference},
                        ),
                        "That payment reference already exists.",
                        "DUPLICATE_REFERENCE",
                    )
                conn.execute(
                    text(
                        "INSERT INTO workforce_pay_events(id,company_id,user_id,kind,target_id,reverses_id,amount_paise,reference,reason,occurred_at,recorded_by) VALUES(:id,:company,:user,:kind,:target,:reverse,:amount,:ref,:reason,:occurred,:actor)"
                    ),
                    p
                    | {
                        "id": id,
                        "kind": kind,
                        "target": target,
                        "reverse": reverse,
                        "amount": amount,
                        "ref": reference,
                        "reason": c.reason.strip(),
                        "occurred": occurred,
                    },
                )
            if action not in own_actions:
                self.event(conn, actor, user_id, action, c, c.target_id)
            return self.view(actor, user_id, c.as_of, conn)

        return self.commands.run(
            actor, c.command_id, f"workforce:{user_id}", c, WorkforceView, execute, authorize
        )

    def save_proof(self, actor, id, data):
        metadata = inspect_photo(data)
        key = f"attendance-{id}.jpg"
        path = self.root / key
        with self.engine.begin() as conn:
            self.lock(conn, actor, actor.id)
            existing = rows(conn, "SELECT * FROM attendance_proofs WHERE id=:id", {"id": id})
            if existing:
                need(
                    existing[0]["company_id"] == actor.company_id
                    and existing[0]["user_id"] == actor.id
                    and existing[0]["sha256"] == metadata["sha256"],
                    "This proof reference was used.",
                    "IDEMPOTENCY_CONFLICT",
                )
                return {"id": str(id)}
            self.root.mkdir(parents=True, exist_ok=True, mode=0o700)
            try:
                with path.open("xb") as f:
                    f.write(data)
                path.chmod(0o600)
                conn.execute(
                    text(
                        "INSERT INTO attendance_proofs(id,company_id,user_id,storage_key,sha256,width,height,bytes) VALUES(:id,:company,:user,:key,:sha256,:width,:height,:bytes)"
                    ),
                    {"id": id, "company": actor.company_id, "user": actor.id, "key": key, **metadata},
                )
            except Exception:
                path.unlink(missing_ok=True)
                raise
        return {"id": str(id)}

    def proof(self, actor, id):
        with self.engine.connect() as conn:
            records = rows(
                conn,
                "SELECT * FROM attendance_proofs WHERE id=:id AND company_id=:company",
                {"id": id, "company": actor.company_id},
            )
            if not records:
                raise BusinessError("NOT_FOUND", "Attendance proof unavailable.", 404)
            self.person(conn, actor, records[0]["user_id"])
            path = (self.root / records[0]["storage_key"]).resolve()
            if path.parent != self.root.resolve() or not path.is_file():
                raise BusinessError("NOT_FOUND", "Attendance proof unavailable.", 404)
            return path

    def close_missing(self):
        with self.engine.begin() as conn:
            records = rows(
                conn,
                "SELECT DISTINCT a.company_id,a.user_id FROM attendance_sessions a WHERE a.status='open' AND a.cutoff_at<=now() LIMIT 100",
            )
            for r in records:
                actor = Actor(
                    id=r["user_id"], company_id=r["company_id"], name="Attendance scheduler", role="employee"
                )
                self.lock(conn, actor, actor.id)
                self.expire(conn, actor, actor.id, self.now(conn), automated=True)
        return len(records)

    def remind(self):
        count = 0
        with self.engine.begin() as conn:
            now = self.now(conn)
            today = business_local_date(now, "Asia/Kolkata")
            notices = NotificationStore(self.engine)
            sessions = rows(
                conn,
                "SELECT * FROM attendance_sessions WHERE status='open' AND ends_at<=:now AND cutoff_at>:now LIMIT 100",
                {"now": now},
            )
            for row in sessions:
                minutes = int((now - row["ends_at"]).total_seconds() // 60)
                stage = 60 if minutes >= 60 else 30 if minutes >= 30 else 0
                recipients = [{"id": row["user_id"]}]
                if stage == 60:
                    recipients += rows(
                        conn,
                        "SELECT id FROM users WHERE company_id=:company AND active AND (role='owner' OR work_roles && ARRAY['supervisor','manager']::text[])",
                        {"company": row["company_id"]},
                    )
                for person in recipients:
                    notices.add(
                        conn,
                        row["company_id"],
                        person["id"],
                        "workforce.punch_out_due",
                        "workforce",
                        row["user_id"],
                        f"attendance:{row['id']}:end:{stage}:{person['id']}",
                    )
                    count += 1
            people = rows(
                conn,
                "SELECT DISTINCT u.id,u.company_id,u.name,u.role,u.work_roles FROM users u JOIN workforce_profiles p ON p.user_id=u.id AND p.company_id=u.company_id WHERE u.active LIMIT 100",
            )
            for person in people:
                actor = Actor.model_validate(person)
                profiles = self.profiles(conn, actor, actor.id)
                terms = self.terms_on(profiles, today)
                if not terms:
                    continue
                salaries = self.salaries(conn, actor, actor.id)
                due = [
                    (str(s.id), s.snapshot.due_on)
                    for s in salaries
                    if s.status == "confirmed" and s.snapshot.due_on <= today
                ]
                previous = period(today, terms.cycle)[0] - timedelta(days=1)
                previous_terms = self.terms_on(profiles, previous)
                if previous_terms:
                    start, end = period(previous, previous_terms.cycle)
                    start = max(start, previous_terms.effective_from)
                    if end + timedelta(days=previous_terms.payout_delay_days) <= today and not any(
                        s.status != "void" and s.start <= end and s.end >= start for s in salaries
                    ):
                        due.append((str(start), end))
                recipients = rows(
                    conn,
                    "SELECT id FROM users WHERE company_id=:company AND active AND (id=:user OR role='owner' OR work_roles && ARRAY['supervisor','manager']::text[])",
                    {"company": actor.company_id, "user": actor.id},
                )
                for key, _ in due:
                    for recipient in recipients:
                        notices.add(
                            conn,
                            actor.company_id,
                            recipient["id"],
                            "workforce.salary_due",
                            "workforce",
                            actor.id,
                            f"payroll:{actor.id}:{key}:due:{recipient['id']}",
                        )
                        count += 1
        return count
