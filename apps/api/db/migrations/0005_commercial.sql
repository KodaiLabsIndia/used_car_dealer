CREATE TABLE sale_bookings (
 id uuid PRIMARY KEY, company_id uuid NOT NULL, cycle_id uuid NOT NULL,
 customer_name text NOT NULL CHECK(length(trim(customer_name))>0), customer_phone text NOT NULL DEFAULT '',
 sale_price_paise bigint NOT NULL CHECK(sale_price_paise>0 AND sale_price_paise<=100000000000),
 status text NOT NULL CHECK(status IN ('booked','cancelled','delivered')), expires_at timestamptz NOT NULL,
 documents jsonb NOT NULL DEFAULT '{"buyerVerified":false,"registrationReady":false,"saleAgreementReference":""}'::jsonb,
 cancellation_reason text, created_by uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(id,company_id), UNIQUE(id,company_id,cycle_id),
 FOREIGN KEY(cycle_id,company_id) REFERENCES stock_cycles(id,company_id),
 FOREIGN KEY(created_by,company_id) REFERENCES users(id,company_id)
);
CREATE UNIQUE INDEX one_active_booking ON sale_bookings(company_id,cycle_id) WHERE status='booked';
CREATE TABLE warranty_claims (
 id uuid PRIMARY KEY, company_id uuid NOT NULL, cycle_id uuid NOT NULL, booking_id uuid NOT NULL,
 description text NOT NULL CHECK(length(trim(description))>0), odometer_km integer NOT NULL CHECK(odometer_km>=0),
 status text NOT NULL DEFAULT 'open' CHECK(status IN ('open','approved','rejected','closed')),
 approved_limit_paise bigint NOT NULL DEFAULT 0 CHECK(approved_limit_paise>=0 AND approved_limit_paise<=100000000000),
 decision_reason text NOT NULL DEFAULT '', issue_id uuid, recorded_by uuid NOT NULL, reviewed_by uuid,
 reported_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(id,company_id), UNIQUE(id,company_id,cycle_id),
 FOREIGN KEY(booking_id,company_id,cycle_id) REFERENCES sale_bookings(id,company_id,cycle_id),
 FOREIGN KEY(issue_id,company_id,cycle_id) REFERENCES issues(id,company_id,cycle_id),
 FOREIGN KEY(recorded_by,company_id) REFERENCES users(id,company_id),
 FOREIGN KEY(reviewed_by,company_id) REFERENCES users(id,company_id)
);
CREATE TABLE vehicle_ledger (
 id uuid PRIMARY KEY, company_id uuid NOT NULL, cycle_id uuid NOT NULL,
 kind text NOT NULL CHECK(kind IN ('cost','receipt','refund')),
 category text NOT NULL CHECK(category IN ('repair','parts','transport','documents','other','warranty','customer')),
 amount_paise bigint NOT NULL CHECK(amount_paise>0 AND amount_paise<=100000000000),
 reference text NOT NULL CHECK(length(trim(reference))>0), reference_key text NOT NULL,
 note text NOT NULL DEFAULT '', booking_id uuid, claim_id uuid,
 recorded_by uuid NOT NULL, occurred_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(id,company_id), UNIQUE(company_id,kind,reference_key),
 CHECK((kind='cost' AND category<>'customer' AND booking_id IS NULL) OR (kind<>'cost' AND category='customer' AND booking_id IS NOT NULL AND claim_id IS NULL)),
 CHECK(claim_id IS NULL OR (kind='cost' AND category='warranty')),
 FOREIGN KEY(cycle_id,company_id) REFERENCES stock_cycles(id,company_id),
 FOREIGN KEY(booking_id,company_id,cycle_id) REFERENCES sale_bookings(id,company_id,cycle_id),
 FOREIGN KEY(claim_id,company_id,cycle_id) REFERENCES warranty_claims(id,company_id,cycle_id),
 FOREIGN KEY(recorded_by,company_id) REFERENCES users(id,company_id)
);
CREATE TABLE vehicle_ledger_reversals (
 id uuid PRIMARY KEY, company_id uuid NOT NULL, entry_id uuid NOT NULL UNIQUE,
 reason text NOT NULL CHECK(length(trim(reason))>=3), recorded_by uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(entry_id,company_id) REFERENCES vehicle_ledger(id,company_id),
 FOREIGN KEY(recorded_by,company_id) REFERENCES users(id,company_id)
);
CREATE TRIGGER immutable_vehicle_ledger BEFORE UPDATE OR DELETE ON vehicle_ledger FOR EACH ROW EXECUTE FUNCTION reject_audit_change();
CREATE TRIGGER immutable_vehicle_ledger_reversal BEFORE UPDATE OR DELETE ON vehicle_ledger_reversals FOR EACH ROW EXECUTE FUNCTION reject_audit_change();
CREATE TABLE sale_deliveries (
 booking_id uuid PRIMARY KEY, company_id uuid NOT NULL, cycle_id uuid NOT NULL,
 delivered_at timestamptz NOT NULL, odometer_km integer NOT NULL CHECK(odometer_km>=0),
 receipt_reference text NOT NULL CHECK(length(trim(receipt_reference))>0), snapshot jsonb NOT NULL,
 recorded_by uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(booking_id,company_id,cycle_id) REFERENCES sale_bookings(id,company_id,cycle_id),
 FOREIGN KEY(recorded_by,company_id) REFERENCES users(id,company_id)
);
CREATE TRIGGER immutable_sale_delivery BEFORE UPDATE OR DELETE ON sale_deliveries FOR EACH ROW EXECUTE FUNCTION reject_audit_change();
CREATE TABLE ownership_transfers (
 booking_id uuid PRIMARY KEY, company_id uuid NOT NULL,
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','completed')), due_at timestamptz NOT NULL,
 reference text NOT NULL DEFAULT '', completed_by uuid, completed_at timestamptz,
 FOREIGN KEY(booking_id,company_id) REFERENCES sale_bookings(id,company_id),
 FOREIGN KEY(completed_by,company_id) REFERENCES users(id,company_id)
);
CREATE INDEX ledger_car ON vehicle_ledger(company_id,cycle_id,created_at);
CREATE INDEX claims_work ON warranty_claims(company_id,status,reported_at);
CREATE INDEX transfer_due ON ownership_transfers(company_id,status,due_at);
