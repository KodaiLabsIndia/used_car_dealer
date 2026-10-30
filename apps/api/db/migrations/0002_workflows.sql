ALTER TABLE vehicles DROP CONSTRAINT vehicles_image_key_check;
ALTER TABLE vehicles ADD CONSTRAINT vehicles_image_key_check CHECK(image_key IN ('sonet','seltos','generic'));
ALTER TABLE vehicles ADD COLUMN odometer_km integer CHECK(odometer_km>=0 AND odometer_km<=3000000);
ALTER TABLE stock_cycles ADD COLUMN created_at timestamptz NOT NULL DEFAULT now();
CREATE UNIQUE INDEX one_active_cycle_per_vehicle ON stock_cycles(company_id,vehicle_id) WHERE stage<>'delivered';
CREATE TABLE company_counters(company_id uuid PRIMARY KEY REFERENCES companies(id), next_stock integer NOT NULL CHECK(next_stock>=1000));
CREATE TABLE checklist_templates (
 id uuid PRIMARY KEY, company_id uuid NOT NULL REFERENCES companies(id), name text NOT NULL,
 kind text NOT NULL CHECK(kind IN ('pre_purchase','intake','repair_qc','delivery')), version integer NOT NULL CHECK(version>0),
 approved boolean NOT NULL DEFAULT false, items jsonb NOT NULL CHECK(jsonb_typeof(items)='array'),
 UNIQUE(id,company_id), UNIQUE(company_id,name,version)
);
ALTER TABLE tasks ADD COLUMN kind text NOT NULL DEFAULT 'reference' CHECK(kind IN ('reference','pre_purchase','intake','repair_qc','delivery'));
ALTER TABLE tasks ADD COLUMN template_id uuid;
ALTER TABLE tasks ADD COLUMN template_name text NOT NULL DEFAULT 'Reference checklist';
ALTER TABLE tasks ADD COLUMN template_version integer NOT NULL DEFAULT 1;
ALTER TABLE tasks ADD COLUMN template_approved boolean NOT NULL DEFAULT false;
ALTER TABLE tasks ADD COLUMN submitted_by uuid;
ALTER TABLE tasks ADD COLUMN submitted_at timestamptz;
ALTER TABLE tasks ADD COLUMN recheck_items jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE tasks ADD FOREIGN KEY(template_id,company_id) REFERENCES checklist_templates(id,company_id);
ALTER TABLE tasks ADD FOREIGN KEY(submitted_by,company_id) REFERENCES users(id,company_id);
ALTER TABLE tasks ADD UNIQUE(id,company_id,cycle_id);
CREATE TABLE task_submissions (
 task_id uuid NOT NULL REFERENCES tasks(id), task_version integer NOT NULL, submitted_by uuid NOT NULL REFERENCES users(id),
 snapshot jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(task_id,task_version)
);
CREATE TRIGGER immutable_submission BEFORE UPDATE OR DELETE ON task_submissions FOR EACH ROW EXECUTE FUNCTION reject_audit_change();
CREATE TABLE task_reviews (
 id uuid PRIMARY KEY, task_id uuid NOT NULL, submitted_version integer NOT NULL, reviewer_id uuid NOT NULL REFERENCES users(id),
 decision text NOT NULL CHECK(decision IN ('accept','recheck')), self_review boolean NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), FOREIGN KEY(task_id,submitted_version) REFERENCES task_submissions(task_id,task_version)
);
CREATE TRIGGER immutable_review BEFORE UPDATE OR DELETE ON task_reviews FOR EACH ROW EXECUTE FUNCTION reject_audit_change();
ALTER TABLE issues ALTER COLUMN task_id DROP NOT NULL;
ALTER TABLE issues ALTER COLUMN item_id DROP NOT NULL;
ALTER TABLE issues ADD COLUMN severity text NOT NULL DEFAULT 'normal' CHECK(severity IN ('normal','urgent'));
ALTER TABLE issues ADD COLUMN version integer NOT NULL DEFAULT 1;
ALTER TABLE issues ADD COLUMN created_by uuid;
ALTER TABLE issues ADD COLUMN evidence_id uuid;
ALTER TABLE issues ADD UNIQUE(id,company_id,cycle_id);
ALTER TABLE issues ADD FOREIGN KEY(evidence_id,company_id,task_id) REFERENCES evidence(id,company_id,task_id);
ALTER TABLE issues ADD FOREIGN KEY(created_by,company_id) REFERENCES users(id,company_id);
ALTER TABLE issues ADD CONSTRAINT issue_status CHECK(status IN ('open','in_repair','resolved'));
CREATE TABLE workshops (
 id uuid PRIMARY KEY, company_id uuid NOT NULL REFERENCES companies(id), name text NOT NULL,
 phone text NOT NULL DEFAULT '', active boolean NOT NULL DEFAULT true, UNIQUE(id,company_id), UNIQUE(company_id,name)
);
CREATE UNIQUE INDEX workshop_name_ci ON workshops(company_id,lower(name));
CREATE TABLE repair_jobs (
 id uuid PRIMARY KEY, company_id uuid NOT NULL, cycle_id uuid NOT NULL, issue_id uuid NOT NULL,
 title text NOT NULL, assigned_to uuid NOT NULL, workshop_id uuid,
 status text NOT NULL DEFAULT 'assigned' CHECK(status IN ('assigned','in_progress','waiting_parts','awaiting_qc','completed')),
 blocker text NOT NULL DEFAULT '', due_at timestamptz, version integer NOT NULL DEFAULT 1,
 qc_task_id uuid, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(id,company_id), FOREIGN KEY(cycle_id,company_id) REFERENCES stock_cycles(id,company_id),
 FOREIGN KEY(issue_id,company_id,cycle_id) REFERENCES issues(id,company_id,cycle_id), FOREIGN KEY(assigned_to,company_id) REFERENCES users(id,company_id),
 FOREIGN KEY(workshop_id,company_id) REFERENCES workshops(id,company_id), FOREIGN KEY(qc_task_id,company_id,cycle_id) REFERENCES tasks(id,company_id,cycle_id)
);
CREATE UNIQUE INDEX one_active_job_per_issue ON repair_jobs(issue_id) WHERE status<>'completed';
CREATE INDEX jobs_assignment ON repair_jobs(company_id,assigned_to,status);
CREATE TABLE part_requests (
 id uuid PRIMARY KEY, company_id uuid NOT NULL, job_id uuid NOT NULL, name text NOT NULL,
 status text NOT NULL DEFAULT 'requested' CHECK(status IN ('requested','received')), expected_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(), received_at timestamptz,
 FOREIGN KEY(job_id,company_id) REFERENCES repair_jobs(id,company_id)
);
