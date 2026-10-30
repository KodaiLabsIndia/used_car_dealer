ALTER TABLE enquiry_appointments ADD CONSTRAINT appointment_company UNIQUE(id,company_id);
ALTER TABLE stock_movements DROP CONSTRAINT stock_movements_appointment_id_fkey;
ALTER TABLE stock_movements ADD CONSTRAINT movement_appointment_company FOREIGN KEY(appointment_id,company_id) REFERENCES enquiry_appointments(id,company_id);
ALTER TABLE outbox ADD COLUMN attempts integer NOT NULL DEFAULT 0;
ALTER TABLE outbox ADD COLUMN available_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE outbox ADD COLUMN last_error text;
ALTER TABLE outbox ADD COLUMN failed_at timestamptz;
CREATE INDEX outbox_ready ON outbox(available_at,created_at) WHERE processed_at IS NULL AND failed_at IS NULL;
CREATE TABLE notifications (
 id uuid PRIMARY KEY,company_id uuid NOT NULL,user_id uuid NOT NULL,dedupe_key text NOT NULL,
 kind text NOT NULL,target_type text NOT NULL CHECK(target_type IN ('task','job','car','enquiry','purchase','business')),
 target_id uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),read_at timestamptz,
 UNIQUE(user_id,dedupe_key),
 FOREIGN KEY(user_id,company_id) REFERENCES users(id,company_id)
);
CREATE INDEX notifications_inbox ON notifications(company_id,user_id,created_at DESC);
CREATE TABLE system_events (
 id uuid PRIMARY KEY,company_id uuid NOT NULL,aggregate_id uuid NOT NULL,action text NOT NULL,
 summary text NOT NULL,details jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(company_id) REFERENCES companies(id)
);
CREATE TRIGGER immutable_system_events BEFORE UPDATE OR DELETE ON system_events FOR EACH ROW EXECUTE FUNCTION reject_audit_change();
