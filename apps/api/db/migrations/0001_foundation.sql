CREATE TABLE companies (id uuid PRIMARY KEY, name text NOT NULL);
CREATE TABLE users (
 id uuid PRIMARY KEY, company_id uuid NOT NULL REFERENCES companies(id), name text NOT NULL,
 role text NOT NULL CHECK(role IN ('owner','employee')), active boolean NOT NULL DEFAULT true,
 UNIQUE(id, company_id)
);
CREATE TABLE sessions (
 token_hash text PRIMARY KEY, user_id uuid NOT NULL REFERENCES users(id),
 expires_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX sessions_expiry ON sessions(expires_at);
CREATE TABLE vehicles (
 id uuid PRIMARY KEY, company_id uuid NOT NULL REFERENCES companies(id),
 make text NOT NULL, model text NOT NULL, registration text NOT NULL, year integer NOT NULL CHECK(year BETWEEN 1900 AND 2200),
 image_key text NOT NULL CHECK(image_key IN ('sonet','seltos')), UNIQUE(id,company_id), UNIQUE(company_id,registration)
);
CREATE TABLE stock_cycles (
 id uuid PRIMARY KEY, company_id uuid NOT NULL REFERENCES companies(id), vehicle_id uuid NOT NULL,
 stock_number text NOT NULL, stage text NOT NULL CHECK(stage IN ('inspection','purchase','refurbishment','ready','delivered')),
 commercial_status text NOT NULL CHECK(commercial_status IN ('available','booked','sold')),
 service_status text NOT NULL CHECK(service_status IN ('none','in_service','waiting_parts','done')),
 location text NOT NULL, next_action text NOT NULL, due_at timestamptz,
 version integer NOT NULL DEFAULT 1 CHECK(version>0), updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(id,company_id), UNIQUE(company_id,stock_number), FOREIGN KEY(vehicle_id,company_id) REFERENCES vehicles(id,company_id)
);
CREATE TABLE tasks (
 id uuid PRIMARY KEY, company_id uuid NOT NULL REFERENCES companies(id), cycle_id uuid NOT NULL,
 title text NOT NULL, assigned_to uuid NOT NULL, status text NOT NULL DEFAULT 'assigned' CHECK(status IN ('assigned','in_progress','submitted','completed','recheck')),
 items jsonb NOT NULL CHECK(jsonb_typeof(items)='array'), due_at timestamptz,
 version integer NOT NULL DEFAULT 1 CHECK(version>0), updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(id,company_id), FOREIGN KEY(cycle_id,company_id) REFERENCES stock_cycles(id,company_id),
 FOREIGN KEY(assigned_to,company_id) REFERENCES users(id,company_id)
);
CREATE INDEX tasks_work ON tasks(company_id,assigned_to,status);
CREATE TABLE evidence (
 id uuid PRIMARY KEY, company_id uuid NOT NULL, task_id uuid NOT NULL, item_id text NOT NULL,
 uploaded_by uuid NOT NULL, storage_key text NOT NULL UNIQUE, width integer NOT NULL CHECK(width>0), height integer NOT NULL CHECK(height>0),
 bytes integer NOT NULL CHECK(bytes>0 AND bytes<=8388608), sha256 text NOT NULL, profile text NOT NULL CHECK(profile='photo-fhd-v1'),
 created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(id,company_id,task_id),
 CHECK((width>=height AND width<=1920 AND height<=1080) OR (height>width AND width<=1080 AND height<=1920)),
 FOREIGN KEY(task_id,company_id) REFERENCES tasks(id,company_id), FOREIGN KEY(uploaded_by,company_id) REFERENCES users(id,company_id)
);
CREATE TABLE inspection_answers (
 company_id uuid NOT NULL, task_id uuid NOT NULL, item_id text NOT NULL,
 result text NOT NULL CHECK(result IN ('ok','problem')), note text NOT NULL DEFAULT '', evidence_id uuid NOT NULL,
 recorded_by uuid NOT NULL, updated_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(task_id,item_id),
 FOREIGN KEY(task_id,company_id) REFERENCES tasks(id,company_id),
 FOREIGN KEY(evidence_id,company_id,task_id) REFERENCES evidence(id,company_id,task_id),
 FOREIGN KEY(recorded_by,company_id) REFERENCES users(id,company_id)
);
CREATE TABLE help_requests (
 id uuid PRIMARY KEY, company_id uuid NOT NULL, task_id uuid NOT NULL, item_id text,
 requested_by uuid NOT NULL, note text NOT NULL DEFAULT '', status text NOT NULL DEFAULT 'open' CHECK(status IN ('open','resolved')),
 created_at timestamptz NOT NULL DEFAULT now(), FOREIGN KEY(task_id,company_id) REFERENCES tasks(id,company_id),
 FOREIGN KEY(requested_by,company_id) REFERENCES users(id,company_id)
);
CREATE UNIQUE INDEX help_one_open ON help_requests(task_id) WHERE status='open';
CREATE TABLE issues (
 id uuid PRIMARY KEY, company_id uuid NOT NULL, cycle_id uuid NOT NULL, task_id uuid NOT NULL,
 item_id text NOT NULL, description text NOT NULL, status text NOT NULL DEFAULT 'open',
 created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(task_id,item_id),
 FOREIGN KEY(task_id,company_id) REFERENCES tasks(id,company_id), FOREIGN KEY(cycle_id,company_id) REFERENCES stock_cycles(id,company_id)
);
CREATE TABLE audit_events (
 id uuid PRIMARY KEY, company_id uuid NOT NULL, actor_id uuid NOT NULL, aggregate_id uuid NOT NULL,
 action text NOT NULL, details jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(actor_id,company_id) REFERENCES users(id,company_id)
);
CREATE INDEX audit_by_car ON audit_events(company_id,aggregate_id,created_at);
CREATE FUNCTION reject_audit_change() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Audit events are append-only'; END $$;
CREATE TRIGGER immutable_audit BEFORE UPDATE OR DELETE ON audit_events FOR EACH ROW EXECUTE FUNCTION reject_audit_change();
CREATE TABLE command_receipts (
 actor_id uuid NOT NULL REFERENCES users(id), command_id uuid NOT NULL, fingerprint text NOT NULL,
 response jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(actor_id,command_id)
);
CREATE TABLE outbox (
 id uuid PRIMARY KEY, company_id uuid NOT NULL REFERENCES companies(id), kind text NOT NULL,
 payload jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), processed_at timestamptz
);
