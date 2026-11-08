CREATE TABLE workforce_policies (
 company_id uuid NOT NULL REFERENCES companies(id), version integer NOT NULL CHECK(version>0),
 effective_from date NOT NULL, policy jsonb NOT NULL, reason text NOT NULL,
 recorded_by uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(company_id,version), FOREIGN KEY(recorded_by,company_id) REFERENCES users(id,company_id)
);
CREATE TABLE workforce_profiles (
 id uuid PRIMARY KEY, company_id uuid NOT NULL, user_id uuid NOT NULL, version integer NOT NULL CHECK(version>0),
 effective_from date NOT NULL, terms jsonb NOT NULL, recorded_by uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(company_id,user_id,version), FOREIGN KEY(user_id,company_id) REFERENCES users(id,company_id),
 FOREIGN KEY(recorded_by,company_id) REFERENCES users(id,company_id)
);
CREATE TABLE attendance_sessions (
 id uuid PRIMARY KEY, company_id uuid NOT NULL, user_id uuid NOT NULL, work_date date NOT NULL,
 punched_in_at timestamptz NOT NULL, punched_out_at timestamptz, minutes integer,
 status text NOT NULL CHECK(status IN ('open','closed','missed_out')), version integer NOT NULL DEFAULT 1,
 schedule jsonb NOT NULL, policy jsonb NOT NULL, policy_version integer NOT NULL, selfie_required boolean NOT NULL, starts_at timestamptz NOT NULL, ends_at timestamptz NOT NULL, cutoff_at timestamptz NOT NULL,
 flags jsonb NOT NULL DEFAULT '[]', proof_id uuid, out_proof_id uuid,
 UNIQUE(company_id,user_id,work_date), UNIQUE(id,company_id),
 FOREIGN KEY(user_id,company_id) REFERENCES users(id,company_id),
 CHECK((status='closed' AND punched_out_at IS NOT NULL AND minutes IS NOT NULL AND minutes>=0) OR (status IN ('open','missed_out') AND punched_out_at IS NULL AND minutes IS NULL))
);
CREATE UNIQUE INDEX attendance_one_open ON attendance_sessions(company_id,user_id) WHERE status='open';
CREATE TABLE workforce_events (
 id uuid PRIMARY KEY, company_id uuid NOT NULL, user_id uuid NOT NULL, kind text NOT NULL,
 target_id uuid, payload jsonb NOT NULL, recorded_by uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(user_id,company_id) REFERENCES users(id,company_id), FOREIGN KEY(recorded_by,company_id) REFERENCES users(id,company_id)
);
CREATE TABLE workforce_day_reviews (
 id uuid PRIMARY KEY, company_id uuid NOT NULL, user_id uuid NOT NULL, work_date date NOT NULL,
 half_days integer NOT NULL CHECK(half_days BETWEEN 0 AND 2), minutes integer CHECK(minutes BETWEEN 0 AND 1440),
 reason text NOT NULL, source_signature text NOT NULL, recorded_by uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(user_id,company_id) REFERENCES users(id,company_id), FOREIGN KEY(recorded_by,company_id) REFERENCES users(id,company_id)
);
CREATE TABLE workforce_requests (
 id uuid PRIMARY KEY, company_id uuid NOT NULL, user_id uuid NOT NULL,
 kind text NOT NULL CHECK(kind IN ('leave','advance')), payload jsonb NOT NULL,
 recorded_by uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(id,company_id),
 FOREIGN KEY(user_id,company_id) REFERENCES users(id,company_id), FOREIGN KEY(recorded_by,company_id) REFERENCES users(id,company_id)
);
CREATE TABLE workforce_request_reviews (
 request_id uuid PRIMARY KEY, company_id uuid NOT NULL, decision text NOT NULL CHECK(decision IN ('approved','rejected')),
 reason text NOT NULL, recorded_by uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(request_id,company_id) REFERENCES workforce_requests(id,company_id), FOREIGN KEY(recorded_by,company_id) REFERENCES users(id,company_id)
);
CREATE TABLE workforce_advance_plans (
 id uuid PRIMARY KEY, company_id uuid NOT NULL, user_id uuid NOT NULL, plan jsonb NOT NULL,
 recorded_by uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(user_id,company_id) REFERENCES users(id,company_id), FOREIGN KEY(recorded_by,company_id) REFERENCES users(id,company_id)
);
CREATE TABLE salary_statements (
 id uuid PRIMARY KEY, company_id uuid NOT NULL, user_id uuid NOT NULL, period_start date NOT NULL,
 period_end date NOT NULL CHECK(period_end>=period_start), revision integer NOT NULL CHECK(revision>0),
 snapshot jsonb NOT NULL, reason text NOT NULL, recorded_by uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(company_id,user_id,period_start,period_end,revision), UNIQUE(id,company_id),
 FOREIGN KEY(user_id,company_id) REFERENCES users(id,company_id), FOREIGN KEY(recorded_by,company_id) REFERENCES users(id,company_id)
);
CREATE TABLE workforce_pay_events (
 id uuid PRIMARY KEY, company_id uuid NOT NULL, user_id uuid NOT NULL,
 kind text NOT NULL CHECK(kind IN ('advance_payment','salary_payment','reversal','void')),
 target_id uuid NOT NULL, reverses_id uuid, amount_paise bigint NOT NULL CHECK(amount_paise>=0), reference text NOT NULL,
 reason text NOT NULL, occurred_at timestamptz NOT NULL, recorded_by uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(id,company_id), UNIQUE(reverses_id), FOREIGN KEY(reverses_id,company_id) REFERENCES workforce_pay_events(id,company_id),
 FOREIGN KEY(user_id,company_id) REFERENCES users(id,company_id), FOREIGN KEY(recorded_by,company_id) REFERENCES users(id,company_id)
);
CREATE UNIQUE INDEX workforce_payment_reference ON workforce_pay_events(company_id,reference) WHERE kind IN ('advance_payment','salary_payment');
CREATE UNIQUE INDEX workforce_advance_paid_once ON workforce_pay_events(target_id) WHERE kind='advance_payment';
CREATE UNIQUE INDEX workforce_void_once ON workforce_pay_events(target_id) WHERE kind='void';
CREATE TABLE attendance_proofs (
 id uuid PRIMARY KEY, company_id uuid NOT NULL, user_id uuid NOT NULL, storage_key text NOT NULL UNIQUE,
 sha256 text NOT NULL, width integer NOT NULL, height integer NOT NULL, bytes integer NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(user_id,company_id) REFERENCES users(id,company_id), CHECK((width<=1920 AND height<=1080) OR (width<=1080 AND height<=1920))
);
CREATE INDEX workforce_event_person ON workforce_events(company_id,user_id,created_at);
CREATE INDEX workforce_request_person ON workforce_requests(company_id,user_id,created_at);
CREATE TRIGGER immutable_workforce_policies BEFORE UPDATE OR DELETE ON workforce_policies FOR EACH ROW EXECUTE FUNCTION reject_audit_change();
CREATE TRIGGER immutable_workforce_profiles BEFORE UPDATE OR DELETE ON workforce_profiles FOR EACH ROW EXECUTE FUNCTION reject_audit_change();
CREATE TRIGGER immutable_workforce_events BEFORE UPDATE OR DELETE ON workforce_events FOR EACH ROW EXECUTE FUNCTION reject_audit_change();
CREATE TRIGGER immutable_workforce_day_reviews BEFORE UPDATE OR DELETE ON workforce_day_reviews FOR EACH ROW EXECUTE FUNCTION reject_audit_change();
CREATE TRIGGER immutable_workforce_requests BEFORE UPDATE OR DELETE ON workforce_requests FOR EACH ROW EXECUTE FUNCTION reject_audit_change();
CREATE TRIGGER immutable_workforce_request_reviews BEFORE UPDATE OR DELETE ON workforce_request_reviews FOR EACH ROW EXECUTE FUNCTION reject_audit_change();
CREATE TRIGGER immutable_workforce_advance_plans BEFORE UPDATE OR DELETE ON workforce_advance_plans FOR EACH ROW EXECUTE FUNCTION reject_audit_change();
CREATE TRIGGER immutable_salary_statements BEFORE UPDATE OR DELETE ON salary_statements FOR EACH ROW EXECUTE FUNCTION reject_audit_change();
CREATE TRIGGER immutable_workforce_pay_events BEFORE UPDATE OR DELETE ON workforce_pay_events FOR EACH ROW EXECUTE FUNCTION reject_audit_change();
CREATE TRIGGER immutable_attendance_proofs BEFORE UPDATE OR DELETE ON attendance_proofs FOR EACH ROW EXECUTE FUNCTION reject_audit_change();
ALTER TABLE notifications DROP CONSTRAINT notifications_target_type_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_target_type_check CHECK(target_type IN ('task','job','car','enquiry','purchase','business','workforce'));
