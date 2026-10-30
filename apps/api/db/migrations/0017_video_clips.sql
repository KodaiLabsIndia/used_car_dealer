CREATE TABLE video_clips (
 id uuid PRIMARY KEY, company_id uuid NOT NULL, task_id uuid NOT NULL, item_id text NOT NULL,
 storage_key text NOT NULL UNIQUE, width integer NOT NULL, height integer NOT NULL,
 duration_ms integer NOT NULL CHECK(duration_ms BETWEEN 1 AND 30100),
 bytes integer NOT NULL CHECK(bytes BETWEEN 1 AND 33554432), sha256 text NOT NULL,
 profile text NOT NULL CHECK(profile='video-720-v1'), recorded_by uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 CHECK((width=1280 AND height=720) OR (width=720 AND height=1280)),
 UNIQUE(id,company_id), FOREIGN KEY(task_id,company_id) REFERENCES tasks(id,company_id),
 FOREIGN KEY(recorded_by,company_id) REFERENCES users(id,company_id)
);
CREATE INDEX video_clips_task ON video_clips(company_id,task_id,created_at);
CREATE TRIGGER video_clips_immutable BEFORE UPDATE OR DELETE ON video_clips FOR EACH ROW EXECUTE FUNCTION reject_audit_change();
