CREATE TABLE purchases (
 id uuid PRIMARY KEY, company_id uuid NOT NULL, cycle_id uuid NOT NULL,
 status text NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','submitted','approved','rejected','acquired')),
 version integer NOT NULL DEFAULT 1 CHECK(version>0), terms_version integer NOT NULL DEFAULT 1 CHECK(terms_version>0),
 terms jsonb NOT NULL, documents jsonb NOT NULL DEFAULT '{"sellerVerified":false,"registrationVerified":false,"ownershipVerified":false,"loanStatus":"unknown"}'::jsonb,
 prepared_by uuid NOT NULL, submitted_by uuid, approved_by uuid, approved_terms_version integer,
 approved_inspections jsonb, agreement_reference text, acquired_at timestamptz,
 receipt jsonb, received_at timestamptz, intake_task_id uuid,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(id,company_id), UNIQUE(company_id,cycle_id),
 FOREIGN KEY(cycle_id,company_id) REFERENCES stock_cycles(id,company_id),
 FOREIGN KEY(prepared_by,company_id) REFERENCES users(id,company_id),
 FOREIGN KEY(submitted_by,company_id) REFERENCES users(id,company_id),
 FOREIGN KEY(approved_by,company_id) REFERENCES users(id,company_id),
 FOREIGN KEY(intake_task_id,company_id,cycle_id) REFERENCES tasks(id,company_id,cycle_id)
);
CREATE TABLE purchase_revisions (
 purchase_id uuid NOT NULL, company_id uuid NOT NULL, terms_version integer NOT NULL, terms jsonb NOT NULL,
 prepared_by uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(purchase_id,terms_version),
 FOREIGN KEY(purchase_id,company_id) REFERENCES purchases(id,company_id),
 FOREIGN KEY(prepared_by,company_id) REFERENCES users(id,company_id)
);
CREATE TRIGGER immutable_purchase_revision BEFORE UPDATE OR DELETE ON purchase_revisions FOR EACH ROW EXECUTE FUNCTION reject_audit_change();
CREATE INDEX purchase_decisions_pending ON purchases(company_id,status,updated_at);
CREATE TABLE purchase_approvals (
 id uuid PRIMARY KEY, company_id uuid NOT NULL, purchase_id uuid NOT NULL, terms_version integer NOT NULL,
 decision text NOT NULL CHECK(decision IN ('approve','reject')), reason text NOT NULL DEFAULT '',
 actor_id uuid NOT NULL, self_review boolean NOT NULL, snapshot jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(purchase_id,company_id) REFERENCES purchases(id,company_id),
 FOREIGN KEY(actor_id,company_id) REFERENCES users(id,company_id)
);
CREATE TRIGGER immutable_purchase_approval BEFORE UPDATE OR DELETE ON purchase_approvals FOR EACH ROW EXECUTE FUNCTION reject_audit_change();
CREATE TABLE purchase_payments (
 id uuid PRIMARY KEY, company_id uuid NOT NULL, purchase_id uuid NOT NULL,
 amount_paise bigint NOT NULL CHECK(amount_paise>0 AND amount_paise<=100000000000),
 method text NOT NULL CHECK(method IN ('bank_transfer','upi','cash')),
 reference text NOT NULL CHECK(length(trim(reference))>0), paid_at timestamptz NOT NULL,
 recorded_by uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(id,company_id),
 FOREIGN KEY(purchase_id,company_id) REFERENCES purchases(id,company_id),
 FOREIGN KEY(recorded_by,company_id) REFERENCES users(id,company_id)
);
CREATE TABLE purchase_payment_references (
 company_id uuid NOT NULL REFERENCES companies(id), method text NOT NULL, reference_key text NOT NULL,
 active_payment_id uuid, PRIMARY KEY(company_id,method,reference_key),
 FOREIGN KEY(active_payment_id,company_id) REFERENCES purchase_payments(id,company_id)
);
CREATE TRIGGER immutable_purchase_payment BEFORE UPDATE OR DELETE ON purchase_payments FOR EACH ROW EXECUTE FUNCTION reject_audit_change();
CREATE TABLE purchase_payment_reversals (
 id uuid PRIMARY KEY, company_id uuid NOT NULL, payment_id uuid NOT NULL UNIQUE,
 reason text NOT NULL CHECK(length(trim(reason))>=3), recorded_by uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(payment_id,company_id) REFERENCES purchase_payments(id,company_id),
 FOREIGN KEY(recorded_by,company_id) REFERENCES users(id,company_id)
);
CREATE TRIGGER immutable_purchase_reversal BEFORE UPDATE OR DELETE ON purchase_payment_reversals FOR EACH ROW EXECUTE FUNCTION reject_audit_change();
