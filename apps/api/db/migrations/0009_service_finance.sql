ALTER TABLE repair_jobs ADD CONSTRAINT job_cycle_scope UNIQUE(id,company_id,cycle_id);
CREATE TABLE repair_quotes (
 id uuid PRIMARY KEY, company_id uuid NOT NULL, job_id uuid NOT NULL, revision integer NOT NULL CHECK(revision>0),
 lines jsonb NOT NULL CHECK(jsonb_array_length(lines)>0), charges_paise bigint NOT NULL CHECK(charges_paise>=0),
 total_paise bigint NOT NULL CHECK(total_paise>0 AND total_paise<=100000000000), note text NOT NULL DEFAULT '',
 recorded_by uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(id,company_id,job_id), UNIQUE(company_id,job_id,revision),
 FOREIGN KEY(job_id,company_id) REFERENCES repair_jobs(id,company_id),
 FOREIGN KEY(recorded_by,company_id) REFERENCES users(id,company_id)
);
CREATE TABLE repair_quote_approvals (
 quote_id uuid PRIMARY KEY, company_id uuid NOT NULL, job_id uuid NOT NULL,
 decision text NOT NULL CHECK(decision IN ('approved','rejected')), reason text NOT NULL CHECK(length(trim(reason))>0),
 recorded_by uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(quote_id,company_id,job_id) REFERENCES repair_quotes(id,company_id,job_id),
 FOREIGN KEY(recorded_by,company_id) REFERENCES users(id,company_id)
);
CREATE TABLE repair_invoices (
 id uuid PRIMARY KEY, company_id uuid NOT NULL, cycle_id uuid NOT NULL, job_id uuid NOT NULL, quote_id uuid NOT NULL,
 reference text NOT NULL CHECK(length(trim(reference))>0), reference_key text NOT NULL, vendor_key text NOT NULL,
 amount_paise bigint NOT NULL CHECK(amount_paise>0 AND amount_paise<=100000000000), ledger_id uuid NOT NULL,
 recorded_by uuid NOT NULL, occurred_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(company_id,vendor_key,reference_key), UNIQUE(ledger_id),
 FOREIGN KEY(job_id,company_id,cycle_id) REFERENCES repair_jobs(id,company_id,cycle_id),
 FOREIGN KEY(quote_id,company_id,job_id) REFERENCES repair_quotes(id,company_id,job_id),
 FOREIGN KEY(ledger_id,company_id) REFERENCES vehicle_ledger(id,company_id),
 FOREIGN KEY(recorded_by,company_id) REFERENCES users(id,company_id)
);
CREATE TABLE repair_vendor_payments (
 id uuid PRIMARY KEY, company_id uuid NOT NULL, job_id uuid NOT NULL, quote_id uuid NOT NULL,
 amount_paise bigint NOT NULL CHECK(amount_paise>0 AND amount_paise<=100000000000),
 reference text NOT NULL CHECK(length(trim(reference))>0), reference_key text NOT NULL, note text NOT NULL DEFAULT '',
 recorded_by uuid NOT NULL, occurred_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(company_id,reference_key),
 FOREIGN KEY(quote_id,company_id,job_id) REFERENCES repair_quotes(id,company_id,job_id),
 FOREIGN KEY(job_id,company_id) REFERENCES repair_jobs(id,company_id),
 FOREIGN KEY(recorded_by,company_id) REFERENCES users(id,company_id)
);
CREATE TRIGGER immutable_repair_quote BEFORE UPDATE OR DELETE ON repair_quotes FOR EACH ROW EXECUTE FUNCTION reject_audit_change();
CREATE TRIGGER immutable_repair_quote_approval BEFORE UPDATE OR DELETE ON repair_quote_approvals FOR EACH ROW EXECUTE FUNCTION reject_audit_change();
CREATE TRIGGER immutable_repair_invoice BEFORE UPDATE OR DELETE ON repair_invoices FOR EACH ROW EXECUTE FUNCTION reject_audit_change();
CREATE TRIGGER immutable_repair_vendor_payment BEFORE UPDATE OR DELETE ON repair_vendor_payments FOR EACH ROW EXECUTE FUNCTION reject_audit_change();
