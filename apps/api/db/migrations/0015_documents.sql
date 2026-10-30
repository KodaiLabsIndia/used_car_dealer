CREATE TABLE documents (
 id uuid PRIMARY KEY,company_id uuid NOT NULL,cycle_id uuid NOT NULL,
 category text NOT NULL CHECK(category IN ('registration','purchase','invoice','payment','sale','warranty','transfer','other')),
 title text NOT NULL CHECK(length(trim(title))>0),reference text NOT NULL DEFAULT '',
 job_id uuid,booking_id uuid,supersedes_id uuid,storage_key text NOT NULL UNIQUE,
 width integer NOT NULL,height integer NOT NULL,bytes integer NOT NULL,sha256 text NOT NULL,profile text NOT NULL CHECK(profile='photo-fhd-v1'),
 fingerprint text NOT NULL,recorded_by uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(id,company_id),UNIQUE(id,company_id,cycle_id),
 FOREIGN KEY(cycle_id,company_id) REFERENCES stock_cycles(id,company_id),
 FOREIGN KEY(job_id,company_id,cycle_id) REFERENCES repair_jobs(id,company_id,cycle_id),
 FOREIGN KEY(booking_id,company_id,cycle_id) REFERENCES sale_bookings(id,company_id,cycle_id),
 FOREIGN KEY(supersedes_id,company_id,cycle_id) REFERENCES documents(id,company_id,cycle_id),
 FOREIGN KEY(recorded_by,company_id) REFERENCES users(id,company_id),
 CHECK((width<=1920 AND height<=1080) OR (width<=1080 AND height<=1920)),CHECK(width>0 AND height>0 AND bytes>0 AND bytes<=8388608)
);
CREATE TABLE document_reviews (
 document_id uuid PRIMARY KEY,company_id uuid NOT NULL,decision text NOT NULL CHECK(decision IN ('accepted','rejected')),
 reason text NOT NULL CHECK(length(trim(reason))>=3),recorded_by uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(document_id,company_id) REFERENCES documents(id,company_id),
 FOREIGN KEY(recorded_by,company_id) REFERENCES users(id,company_id)
);
CREATE INDEX documents_car ON documents(company_id,cycle_id,created_at DESC);
CREATE TRIGGER immutable_document BEFORE UPDATE OR DELETE ON documents FOR EACH ROW EXECUTE FUNCTION reject_audit_change();
CREATE TRIGGER immutable_document_review BEFORE UPDATE OR DELETE ON document_reviews FOR EACH ROW EXECUTE FUNCTION reject_audit_change();
