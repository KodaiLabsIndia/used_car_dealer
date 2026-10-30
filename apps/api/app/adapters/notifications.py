import json
from datetime import UTC, datetime
from uuid import UUID, uuid4

from sqlalchemy import text

from app.adapters.operations import rows
from app.contracts import Actor
from app.notification_contracts import Inbox, ReadNotifications


class NotificationStore:
    def __init__(self, engine):
        self.engine = engine

    def inbox(self, actor: Actor, unread_only=False, limit=30, offset=0):
        with self.engine.connect() as conn:
            cutoff = conn.execute(text("SELECT clock_timestamp()")).scalar_one()
            p = {
                "company": actor.company_id,
                "user": actor.id,
                "only": unread_only,
                "limit": limit,
                "offset": offset,
                "cutoff": cutoff,
            }
            items = rows(
                conn,
                "SELECT id,kind,target_type,target_id,created_at,read_at FROM notifications WHERE company_id=:company AND user_id=:user AND created_at<=:cutoff AND (NOT :only OR read_at IS NULL) ORDER BY created_at DESC,id DESC LIMIT :limit OFFSET :offset",
                p,
            )
            unread = conn.execute(
                text(
                    "SELECT count(*) FROM notifications WHERE company_id=:company AND user_id=:user AND created_at<=:cutoff AND read_at IS NULL"
                ),
                p,
            ).scalar_one()
            return Inbox(items=items, unread=unread, cutoff=cutoff, limit=limit, offset=offset)

    def read(self, actor: Actor, body: ReadNotifications):
        with self.engine.begin() as conn:
            conn.execute(
                text(
                    "UPDATE notifications SET read_at=now() WHERE company_id=:company AND user_id=:user AND read_at IS NULL AND created_at<=LEAST(:through,clock_timestamp()) AND (CAST(:id AS uuid) IS NULL OR id=:id)"
                ),
                {
                    "company": actor.company_id,
                    "user": actor.id,
                    "id": body.notification_id,
                    "through": body.through,
                },
            )

    def add(self, conn, company, user, kind, target_type, target_id, dedupe):
        conn.execute(
            text(
                "INSERT INTO notifications(id,company_id,user_id,dedupe_key,kind,target_type,target_id) SELECT :id,:company,:user,:key,:kind,:type,:target WHERE EXISTS(SELECT 1 FROM users WHERE id=:user AND company_id=:company AND active=true) ON CONFLICT(user_id,dedupe_key) DO NOTHING"
            ),
            {
                "id": uuid4(),
                "company": company,
                "user": user,
                "key": dedupe,
                "kind": kind,
                "type": target_type,
                "target": target_id,
            },
        )

    def owners(self, conn, company):
        return [
            u["id"]
            for u in rows(
                conn,
                "SELECT id FROM users WHERE company_id=:company AND role='owner' AND active=true",
                {"company": company},
            )
        ]

    def recipients(self, conn, event):
        company, payload, kind = event["company_id"], event["payload"], event["kind"]
        target_type, target_id, recipients = "car", payload.get("carId"), self.owners(conn, company)
        if kind in ("task.answer", "evidence.received", "photo.received"):
            return []
        if payload.get("taskId"):
            target_type, target_id = "task", payload["taskId"]
            task = rows(
                conn,
                "SELECT assigned_to FROM tasks WHERE company_id=:company AND id=:id",
                {"company": company, "id": target_id},
            )
            if not task:
                return []
            recipients += [task[0]["assigned_to"]]
            if kind in ("task.assign", "task.takeover") and payload.get("previousAssignedTo"):
                recipients.append(UUID(payload["previousAssignedTo"]))
            if kind in ("task.submit", "task.help"):
                recipients += [
                    u["id"]
                    for u in rows(
                        conn,
                        "SELECT id FROM users WHERE company_id=:company AND active=true AND work_roles && ARRAY['manager','supervisor']::text[]",
                        {"company": company},
                    )
                ]
        elif payload.get("enquiryId"):
            target_type, target_id = "enquiry", payload["enquiryId"]
            enquiry = rows(
                conn,
                "SELECT assigned_to FROM enquiries WHERE company_id=:company AND id=:id",
                {"company": company, "id": target_id},
            )
            if not enquiry:
                return []
            recipients += [enquiry[0]["assigned_to"]]
        elif payload.get("jobId") and not kind.startswith("service_finance."):
            target_type, target_id = "job", payload["jobId"]
            job = rows(
                conn,
                "SELECT assigned_to FROM repair_jobs WHERE company_id=:company AND id=:id",
                {"company": company, "id": target_id},
            )
            if job:
                recipients += [job[0]["assigned_to"]]
        elif kind.startswith(("business.", "purchase.", "service_finance.")):
            target_type = "business"
        if not target_id:
            return []
        # Validate target identifiers so malformed events fail into the retry/dead-letter path.
        target_id = UUID(str(target_id))
        return [
            (user, target_type, target_id) for user in set(recipients) if str(user) != payload.get("actorId")
        ]

    def drain(self, limit=100):
        processed = 0
        for _ in range(limit):
            event_id = None
            try:
                with self.engine.begin() as conn:
                    events = rows(
                        conn,
                        "SELECT * FROM outbox WHERE processed_at IS NULL AND failed_at IS NULL AND available_at<=now() ORDER BY created_at,id LIMIT 1 FOR UPDATE SKIP LOCKED",
                    )
                    if not events:
                        break
                    event = events[0]
                    event_id = event["id"]
                    for user, target_type, target in self.recipients(conn, event):
                        self.add(
                            conn,
                            event["company_id"],
                            user,
                            event["kind"],
                            target_type,
                            target,
                            "outbox:" + str(event_id),
                        )
                    conn.execute(
                        text("UPDATE outbox SET processed_at=now(),last_error=NULL WHERE id=:id"),
                        {"id": event_id},
                    )
                    processed += 1
            except Exception as error:
                if event_id is None:
                    raise
                with self.engine.begin() as conn:
                    conn.execute(
                        text(
                            "UPDATE outbox SET attempts=attempts+1,last_error=:error,available_at=now()+make_interval(secs=>LEAST(3600,power(2,LEAST(attempts+1,10))::integer)),failed_at=CASE WHEN attempts+1>=8 THEN now() ELSE NULL END WHERE id=:id AND processed_at IS NULL"
                        ),
                        {"id": event_id, "error": type(error).__name__},
                    )
        return processed

    def reminders(self):
        today = datetime.now(UTC).date().isoformat()
        with self.engine.begin() as conn:
            # Reminder payloads contain no customer names, money, documents or free-text notes.
            queries = [
                (
                    "task.overdue",
                    "task",
                    "SELECT company_id,id,assigned_to AS user_id FROM tasks WHERE status NOT IN ('submitted','completed') AND due_at<now()",
                ),
                (
                    "repair.overdue",
                    "job",
                    "SELECT company_id,id,assigned_to AS user_id FROM repair_jobs WHERE status<>'completed' AND due_at<now()",
                ),
                (
                    "enquiry.followup",
                    "enquiry",
                    "SELECT company_id,id,assigned_to AS user_id FROM enquiries WHERE status NOT IN ('won','lost') AND next_follow_up_at<now()",
                ),
            ]
            count = 0
            for kind, target_type, query in queries:
                for item in rows(conn, query):
                    for user in set(self.owners(conn, item["company_id"]) + [item["user_id"]]):
                        self.add(
                            conn,
                            item["company_id"],
                            user,
                            kind,
                            target_type,
                            item["id"],
                            f"{kind}:{item['id']}:{today}",
                        )
                    count += 1
            for item in rows(
                conn,
                "SELECT t.company_id,b.cycle_id AS id FROM ownership_transfers t JOIN sale_bookings b ON b.id=t.booking_id AND b.company_id=t.company_id WHERE t.status='pending' AND t.due_at<now()",
            ):
                for user in self.owners(conn, item["company_id"]):
                    self.add(
                        conn,
                        item["company_id"],
                        user,
                        "transfer.overdue",
                        "business",
                        item["id"],
                        f"transfer:{item['id']}:{today}",
                    )
            return count

    def expire_bookings(self, limit=100):
        with self.engine.connect() as conn:
            candidates = rows(
                conn,
                "SELECT id,company_id,cycle_id FROM sale_bookings WHERE status='booked' AND expires_at<=now() ORDER BY expires_at LIMIT :limit",
                {"limit": limit},
            )
        count = 0
        for item in candidates:
            with self.engine.begin() as conn:
                conn.execute(
                    text("SELECT id FROM stock_cycles WHERE id=:car AND company_id=:company FOR UPDATE"),
                    {"car": item["cycle_id"], "company": item["company_id"]},
                )
                expired = conn.execute(
                    text(
                        "UPDATE sale_bookings SET status='cancelled',cancellation_reason='Hold expired automatically at the recorded expiry time',updated_at=now() WHERE id=:id AND company_id=:company AND status='booked' AND expires_at<=now() RETURNING id"
                    ),
                    {"id": item["id"], "company": item["company_id"]},
                ).first()
                if not expired:
                    continue
                conn.execute(
                    text(
                        "UPDATE stock_cycles SET commercial_status='available',version=version+1,updated_at=now() WHERE id=:car AND company_id=:company"
                    ),
                    {"car": item["cycle_id"], "company": item["company_id"]},
                )
                conn.execute(
                    text(
                        "INSERT INTO system_events(id,company_id,aggregate_id,action,summary,details) VALUES(:event,:company,:car,'business.hold_expired','Booking hold expired; any collected money remains a refund obligation',CAST(:details AS jsonb))"
                    ),
                    {
                        "event": uuid4(),
                        "company": item["company_id"],
                        "car": item["cycle_id"],
                        "details": json.dumps({"bookingId": str(item["id"])}),
                    },
                )
                for user in self.owners(conn, item["company_id"]):
                    self.add(
                        conn,
                        item["company_id"],
                        user,
                        "booking.expired",
                        "business",
                        item["cycle_id"],
                        "booking-expired:" + str(item["id"]),
                    )
                count += 1
        return count
