CREATE TABLE staff_routines (
 id uuid NOT NULL, company_id uuid NOT NULL REFERENCES companies(id), version integer NOT NULL CHECK(version>0),
 definition jsonb NOT NULL, assigned_to uuid NOT NULL, active boolean NOT NULL, reason text NOT NULL,
 recorded_by uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(id,company_id,version),
 FOREIGN KEY(assigned_to,company_id) REFERENCES users(id,company_id),
 FOREIGN KEY(recorded_by,company_id) REFERENCES users(id,company_id)
);
CREATE TABLE routine_runs (
 routine_id uuid NOT NULL, company_id uuid NOT NULL, work_date date NOT NULL, definition_version integer NOT NULL,
 assigned_to uuid NOT NULL, snapshot jsonb NOT NULL, PRIMARY KEY(routine_id,company_id,work_date),
 FOREIGN KEY(routine_id,company_id,definition_version) REFERENCES staff_routines(id,company_id,version),
 FOREIGN KEY(assigned_to,company_id) REFERENCES users(id,company_id)
);
CREATE TABLE routine_step_events (
 routine_id uuid NOT NULL, company_id uuid NOT NULL, work_date date NOT NULL,
 version integer NOT NULL CHECK(version>0), step integer NOT NULL CHECK(step BETWEEN 0 AND 19), done boolean NOT NULL,
 note text NOT NULL, recorded_by uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(routine_id,company_id,work_date,version),
 FOREIGN KEY(routine_id,company_id,work_date) REFERENCES routine_runs(routine_id,company_id,work_date),
 FOREIGN KEY(recorded_by,company_id) REFERENCES users(id,company_id)
);
CREATE INDEX staff_routine_company ON staff_routines(company_id,id,version DESC);
CREATE TRIGGER staff_routine_immutable BEFORE UPDATE OR DELETE ON staff_routines FOR EACH ROW EXECUTE FUNCTION reject_audit_change();
CREATE TRIGGER routine_run_immutable BEFORE UPDATE OR DELETE ON routine_runs FOR EACH ROW EXECUTE FUNCTION reject_audit_change();
CREATE TRIGGER routine_step_immutable BEFORE UPDATE OR DELETE ON routine_step_events FOR EACH ROW EXECUTE FUNCTION reject_audit_change();
