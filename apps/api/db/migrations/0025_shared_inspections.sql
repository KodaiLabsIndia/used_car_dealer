ALTER TABLE tasks ADD COLUMN collaborative boolean NOT NULL DEFAULT false;
ALTER TABLE tasks ADD COLUMN created_by uuid;
ALTER TABLE tasks ADD FOREIGN KEY(created_by,company_id) REFERENCES users(id,company_id);
CREATE TABLE inspection_check_allocations (
 task_id uuid NOT NULL,company_id uuid NOT NULL,item_id text NOT NULL,
 assigned_to uuid,assignment_version integer NOT NULL DEFAULT 1 CHECK(assignment_version>0),
 version integer NOT NULL DEFAULT 0 CHECK(version>=0),
 state text NOT NULL CHECK(state IN ('unassigned','assigned','in_progress','submitted','accepted','recheck','waived')),
 reviewed_by uuid,reviewed_at timestamptz,review_note text NOT NULL DEFAULT '',
 PRIMARY KEY(task_id,item_id), FOREIGN KEY(task_id,company_id) REFERENCES tasks(id,company_id),
 FOREIGN KEY(assigned_to,company_id) REFERENCES users(id,company_id),
 FOREIGN KEY(reviewed_by,company_id) REFERENCES users(id,company_id),
 CHECK(assigned_to IS NOT NULL OR state IN ('unassigned','waived'))
);
CREATE INDEX inspection_check_person ON inspection_check_allocations(company_id,assigned_to,task_id);
CREATE TABLE inspection_work_assignments (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),company_id uuid NOT NULL,task_id uuid NOT NULL,user_id uuid NOT NULL,
 created_by uuid,created_at timestamptz NOT NULL DEFAULT now(),origin text NOT NULL CHECK(origin IN ('migration','task','allocation')),
 UNIQUE(task_id,user_id), FOREIGN KEY(task_id,company_id) REFERENCES tasks(id,company_id),
 FOREIGN KEY(user_id,company_id) REFERENCES users(id,company_id),FOREIGN KEY(created_by,company_id) REFERENCES users(id,company_id)
);
INSERT INTO inspection_work_assignments(company_id,task_id,user_id,origin)
 SELECT company_id,id,assigned_to,'migration' FROM tasks;
INSERT INTO inspection_check_allocations(task_id,company_id,item_id,assigned_to,state)
 SELECT t.id,t.company_id,i->>'id',t.assigned_to,
 CASE WHEN t.status='completed' THEN 'accepted' WHEN t.status='submitted' THEN 'submitted'
 WHEN t.recheck_items ? (i->>'id') THEN 'recheck'
 WHEN EXISTS(SELECT 1 FROM inspection_answers a WHERE a.task_id=t.id AND a.item_id=i->>'id') THEN 'in_progress' ELSE 'assigned' END
 FROM tasks t CROSS JOIN LATERAL jsonb_array_elements(t.items) i;
CREATE FUNCTION initialize_inspection_checks() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='INSERT' OR (NOT NEW.collaborative AND NEW.assigned_to IS DISTINCT FROM OLD.assigned_to) THEN
  INSERT INTO inspection_work_assignments(company_id,task_id,user_id,created_by,origin)
   VALUES(NEW.company_id,NEW.id,NEW.assigned_to,NEW.created_by,'task') ON CONFLICT(task_id,user_id) DO NOTHING;
  INSERT INTO inspection_check_allocations(task_id,company_id,item_id,assigned_to,state)
   SELECT NEW.id,NEW.company_id,i->>'id',NEW.assigned_to,'assigned' FROM jsonb_array_elements(NEW.items) i
   ON CONFLICT(task_id,item_id) DO UPDATE SET assigned_to=EXCLUDED.assigned_to,
    assignment_version=inspection_check_allocations.assignment_version+1,version=inspection_check_allocations.version+1;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER initialize_inspection_checks AFTER INSERT OR UPDATE OF assigned_to ON tasks
 FOR EACH ROW EXECUTE FUNCTION initialize_inspection_checks();
ALTER TABLE evidence ADD COLUMN assignment_version integer CHECK(assignment_version>0);
ALTER TABLE video_clips ADD COLUMN assignment_version integer CHECK(assignment_version>0);
ALTER TABLE task_reviews ADD COLUMN reviewed_items jsonb NOT NULL DEFAULT '[]';
CREATE TABLE inspection_answer_history (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,company_id uuid NOT NULL,task_id uuid NOT NULL,item_id text NOT NULL,
 answer jsonb NOT NULL,recorded_by uuid NOT NULL,recorded_at timestamptz NOT NULL,origin text NOT NULL,
 FOREIGN KEY(task_id,company_id) REFERENCES tasks(id,company_id),FOREIGN KEY(recorded_by,company_id) REFERENCES users(id,company_id)
);
INSERT INTO inspection_answer_history(company_id,task_id,item_id,answer,recorded_by,recorded_at,origin)
 SELECT company_id,task_id,item_id,to_jsonb(a),recorded_by,updated_at,'migration_snapshot' FROM inspection_answers a;
CREATE FUNCTION preserve_inspection_answer() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 INSERT INTO inspection_answer_history(company_id,task_id,item_id,answer,recorded_by,recorded_at,origin)
 VALUES(NEW.company_id,NEW.task_id,NEW.item_id,to_jsonb(NEW),NEW.recorded_by,NEW.updated_at,'recorded');
 RETURN NEW;
END $$;
CREATE TRIGGER preserve_inspection_answer AFTER INSERT OR UPDATE ON inspection_answers
 FOR EACH ROW EXECUTE FUNCTION preserve_inspection_answer();
CREATE TABLE inspection_check_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),company_id uuid NOT NULL,task_id uuid NOT NULL,item_id text NOT NULL,
 action text NOT NULL,before_state jsonb NOT NULL,after_state jsonb NOT NULL,reason text NOT NULL,
 recorded_by uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(task_id,company_id) REFERENCES tasks(id,company_id),FOREIGN KEY(recorded_by,company_id) REFERENCES users(id,company_id)
);
CREATE TABLE inspection_portion_submissions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),company_id uuid NOT NULL,task_id uuid NOT NULL,submitted_by uuid NOT NULL,
 snapshot jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(task_id,company_id) REFERENCES tasks(id,company_id),FOREIGN KEY(submitted_by,company_id) REFERENCES users(id,company_id)
);
CREATE TRIGGER inspection_check_event_immutable BEFORE UPDATE OR DELETE ON inspection_check_events FOR EACH ROW EXECUTE FUNCTION reject_audit_change();
CREATE TRIGGER inspection_answer_history_immutable BEFORE UPDATE OR DELETE ON inspection_answer_history FOR EACH ROW EXECUTE FUNCTION reject_audit_change();
CREATE TRIGGER inspection_portion_immutable BEFORE UPDATE OR DELETE ON inspection_portion_submissions FOR EACH ROW EXECUTE FUNCTION reject_audit_change();
CREATE TRIGGER inspection_work_assignment_immutable BEFORE UPDATE OR DELETE ON inspection_work_assignments FOR EACH ROW EXECUTE FUNCTION reject_audit_change();
DROP INDEX help_one_open;
CREATE UNIQUE INDEX help_one_open_scope ON help_requests(task_id,requested_by,COALESCE(item_id,'')) WHERE status='open';
