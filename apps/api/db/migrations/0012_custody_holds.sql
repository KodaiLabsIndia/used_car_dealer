ALTER TABLE stock_cycles ADD COLUMN custody_kind text NOT NULL DEFAULT 'yard' CHECK(custody_kind IN ('yard','workshop','test_drive','customer'));
ALTER TABLE stock_cycles ADD COLUMN custodian_id uuid;
ALTER TABLE stock_cycles ADD CONSTRAINT custody_person FOREIGN KEY(custodian_id,company_id) REFERENCES users(id,company_id);
CREATE TABLE stock_movements (
 id uuid PRIMARY KEY, company_id uuid NOT NULL, cycle_id uuid NOT NULL,
 from_kind text NOT NULL, from_location text NOT NULL, to_kind text NOT NULL CHECK(to_kind IN ('yard','workshop','test_drive','customer')),
 to_location text NOT NULL CHECK(length(trim(to_location))>0), custodian_id uuid NOT NULL, receiver_name text NOT NULL CHECK(length(trim(receiver_name))>0),
 odometer_km integer NOT NULL CHECK(odometer_km>=0), keys_count integer NOT NULL CHECK(keys_count>=0 AND keys_count<=10),
 fuel_percent integer NOT NULL CHECK(fuel_percent BETWEEN 0 AND 100), note text NOT NULL DEFAULT '', workshop_id uuid, appointment_id uuid,
 recorded_by uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(cycle_id,company_id) REFERENCES stock_cycles(id,company_id),
 FOREIGN KEY(custodian_id,company_id) REFERENCES users(id,company_id),
 FOREIGN KEY(workshop_id,company_id) REFERENCES workshops(id,company_id),
 FOREIGN KEY(recorded_by,company_id) REFERENCES users(id,company_id),
 FOREIGN KEY(appointment_id) REFERENCES enquiry_appointments(id)
);
CREATE TABLE stock_holds (
 id uuid PRIMARY KEY, company_id uuid NOT NULL, cycle_id uuid NOT NULL,
 kind text NOT NULL CHECK(kind IN ('safety','documents','other')), reason text NOT NULL CHECK(length(trim(reason))>=3),
 recorded_by uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
 resolved_by uuid, resolved_at timestamptz, resolution text NOT NULL DEFAULT '',
 FOREIGN KEY(cycle_id,company_id) REFERENCES stock_cycles(id,company_id),
 FOREIGN KEY(recorded_by,company_id) REFERENCES users(id,company_id),
 FOREIGN KEY(resolved_by,company_id) REFERENCES users(id,company_id),
 CHECK((resolved_by IS NULL AND resolved_at IS NULL AND resolution='') OR (resolved_by IS NOT NULL AND resolved_at IS NOT NULL AND length(trim(resolution))>=3))
);
CREATE INDEX stock_holds_open ON stock_holds(company_id,cycle_id) WHERE resolved_at IS NULL;
CREATE TRIGGER immutable_stock_movement BEFORE UPDATE OR DELETE ON stock_movements FOR EACH ROW EXECUTE FUNCTION reject_audit_change();
