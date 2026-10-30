CREATE TABLE ai_runs (
 id uuid PRIMARY KEY,company_id uuid NOT NULL,actor_id uuid NOT NULL,command_id uuid NOT NULL,
 fingerprint text NOT NULL,request jsonb NOT NULL,status text NOT NULL DEFAULT 'queued' CHECK(status IN ('queued','running','completed','failed','stale')),
 source_hash text NOT NULL,sources jsonb NOT NULL,cutoff timestamptz NOT NULL,prompt_version text NOT NULL,model text NOT NULL,
 response jsonb,error_code text,lease_until timestamptz,input_tokens integer NOT NULL DEFAULT 0,output_tokens integer NOT NULL DEFAULT 0,
 created_at timestamptz NOT NULL DEFAULT now(),completed_at timestamptz,
 UNIQUE(actor_id,command_id),UNIQUE(id,company_id),
 FOREIGN KEY(actor_id,company_id) REFERENCES users(id,company_id)
);
CREATE INDEX ai_queue ON ai_runs(created_at) WHERE status='queued';
CREATE TABLE ai_reviews (
 run_id uuid PRIMARY KEY,company_id uuid NOT NULL,actor_id uuid NOT NULL,
 decision text NOT NULL CHECK(decision IN ('accepted','rejected')),note text NOT NULL DEFAULT '',created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(run_id,company_id) REFERENCES ai_runs(id,company_id),
 FOREIGN KEY(actor_id,company_id) REFERENCES users(id,company_id)
);
CREATE TRIGGER immutable_ai_review BEFORE UPDATE OR DELETE ON ai_reviews FOR EACH ROW EXECUTE FUNCTION reject_audit_change();
