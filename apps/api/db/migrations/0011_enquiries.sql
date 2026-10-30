ALTER TABLE users DROP CONSTRAINT work_roles_valid;
ALTER TABLE users ADD CONSTRAINT work_roles_valid CHECK(work_roles <@ ARRAY['inspector','coordinator','supervisor','manager','sales']::text[] AND cardinality(work_roles)>0);
CREATE TABLE enquiries (
 id uuid PRIMARY KEY, company_id uuid NOT NULL, kind text NOT NULL CHECK(kind IN ('seller','buyer')),
 name text NOT NULL CHECK(length(trim(name))>0), phone text NOT NULL CHECK(length(trim(phone))>0),
 source text NOT NULL DEFAULT '', interest text NOT NULL DEFAULT '', cycle_id uuid,
 status text NOT NULL DEFAULT 'open' CHECK(status IN ('open','appointment','negotiation','won','lost')),
 assigned_to uuid NOT NULL, next_follow_up_at timestamptz, last_contact_at timestamptz,
 version integer NOT NULL DEFAULT 1, created_by uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(id,company_id),
 FOREIGN KEY(cycle_id,company_id) REFERENCES stock_cycles(id,company_id),
 FOREIGN KEY(assigned_to,company_id) REFERENCES users(id,company_id),
 FOREIGN KEY(created_by,company_id) REFERENCES users(id,company_id)
);
CREATE TABLE enquiry_events (
 id uuid PRIMARY KEY, company_id uuid NOT NULL, enquiry_id uuid NOT NULL,
 kind text NOT NULL, note text NOT NULL CHECK(length(trim(note))>0), recorded_by uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(enquiry_id,company_id) REFERENCES enquiries(id,company_id),
 FOREIGN KEY(recorded_by,company_id) REFERENCES users(id,company_id)
);
CREATE TABLE enquiry_appointments (
 id uuid PRIMARY KEY, company_id uuid NOT NULL, enquiry_id uuid NOT NULL, kind text NOT NULL CHECK(kind IN ('viewing','inspection','test_drive')),
 scheduled_at timestamptz NOT NULL, status text NOT NULL DEFAULT 'scheduled' CHECK(status IN ('scheduled','completed','cancelled')),
 driver_name text NOT NULL DEFAULT '', license_checked boolean NOT NULL DEFAULT false,
 outcome text NOT NULL DEFAULT '', recorded_by uuid NOT NULL, completed_by uuid, completed_at timestamptz,
 FOREIGN KEY(enquiry_id,company_id) REFERENCES enquiries(id,company_id),
 FOREIGN KEY(recorded_by,company_id) REFERENCES users(id,company_id),
 FOREIGN KEY(completed_by,company_id) REFERENCES users(id,company_id),
 CHECK(kind<>'test_drive' OR (license_checked AND length(trim(driver_name))>0))
);
CREATE INDEX enquiries_followup ON enquiries(company_id,assigned_to,status,next_follow_up_at);
CREATE INDEX enquiry_history ON enquiry_events(company_id,enquiry_id,created_at DESC);
CREATE TRIGGER immutable_enquiry_event BEFORE UPDATE OR DELETE ON enquiry_events FOR EACH ROW EXECUTE FUNCTION reject_audit_change();
