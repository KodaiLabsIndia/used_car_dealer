ALTER TABLE repair_vendor_payments ADD CONSTRAINT repair_payment_scope UNIQUE(id,company_id);
CREATE TABLE repair_payment_reversals (
 payment_id uuid PRIMARY KEY, company_id uuid NOT NULL, reason text NOT NULL CHECK(length(trim(reason))>=3),
 recorded_by uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(payment_id,company_id) REFERENCES repair_vendor_payments(id,company_id),
 FOREIGN KEY(recorded_by,company_id) REFERENCES users(id,company_id)
);
CREATE TRIGGER immutable_repair_payment_reversal BEFORE UPDATE OR DELETE ON repair_payment_reversals FOR EACH ROW EXECUTE FUNCTION reject_audit_change();
