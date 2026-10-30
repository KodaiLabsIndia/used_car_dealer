ALTER TABLE sale_bookings ADD COLUMN warranty_configuration jsonb;
CREATE TABLE document_policies (
 company_id uuid NOT NULL REFERENCES companies(id), version integer NOT NULL CHECK(version > 0),
 rules jsonb NOT NULL, reason text NOT NULL, published_by uuid NOT NULL REFERENCES users(id),
 published_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(company_id,version)
);
CREATE TABLE document_requirement_sets (
 id uuid PRIMARY KEY, company_id uuid NOT NULL REFERENCES companies(id),
 cycle_id uuid NOT NULL REFERENCES stock_cycles(id), stage text NOT NULL CHECK(stage IN ('purchase','intake','sale','delivery')),
 booking_id uuid REFERENCES sale_bookings(id), policy_version integer NOT NULL, rules jsonb NOT NULL,
 assigned_by uuid NOT NULL REFERENCES users(id), created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX document_requirement_scope ON document_requirement_sets(company_id,cycle_id,stage,COALESCE(booking_id,'00000000-0000-0000-0000-000000000000'::uuid));
CREATE TABLE document_requirement_links (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, company_id uuid NOT NULL REFERENCES companies(id),
 set_id uuid NOT NULL REFERENCES document_requirement_sets(id), requirement_id text NOT NULL,
 document_id uuid NOT NULL REFERENCES documents(id), recorded_by uuid NOT NULL REFERENCES users(id),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER immutable_document_policy BEFORE UPDATE OR DELETE ON document_policies FOR EACH ROW EXECUTE FUNCTION reject_audit_change();
CREATE TRIGGER immutable_document_requirements BEFORE UPDATE OR DELETE ON document_requirement_sets FOR EACH ROW EXECUTE FUNCTION reject_audit_change();
CREATE TRIGGER immutable_document_requirement_link BEFORE UPDATE OR DELETE ON document_requirement_links FOR EACH ROW EXECUTE FUNCTION reject_audit_change();
