ALTER TABLE checklist_templates ADD COLUMN based_on_id uuid;
ALTER TABLE checklist_templates ADD COLUMN created_by uuid;
ALTER TABLE checklist_templates ADD COLUMN created_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE checklist_templates ADD COLUMN revision_reason text NOT NULL DEFAULT '';
ALTER TABLE checklist_templates ADD FOREIGN KEY(based_on_id,company_id) REFERENCES checklist_templates(id,company_id);
ALTER TABLE checklist_templates ADD FOREIGN KEY(created_by,company_id) REFERENCES users(id,company_id);
CREATE UNIQUE INDEX checklist_version_name_ci ON checklist_templates(company_id,lower(name),version);
CREATE TABLE checklist_approvals (
 id uuid PRIMARY KEY, company_id uuid NOT NULL, template_id uuid NOT NULL UNIQUE,
 approved_by uuid NOT NULL, reason text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(template_id,company_id) REFERENCES checklist_templates(id,company_id),
 FOREIGN KEY(approved_by,company_id) REFERENCES users(id,company_id)
);
CREATE TRIGGER immutable_checklist_approval BEFORE UPDATE OR DELETE ON checklist_approvals FOR EACH ROW EXECUTE FUNCTION reject_audit_change();
CREATE FUNCTION protect_checklist_revision() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Checklist versions are retained'; END IF;
 IF NEW.id IS DISTINCT FROM OLD.id OR NEW.company_id IS DISTINCT FROM OLD.company_id
 OR NEW.name IS DISTINCT FROM OLD.name OR NEW.kind IS DISTINCT FROM OLD.kind
 OR NEW.version IS DISTINCT FROM OLD.version OR NEW.items IS DISTINCT FROM OLD.items
 OR NEW.based_on_id IS DISTINCT FROM OLD.based_on_id OR NEW.created_by IS DISTINCT FROM OLD.created_by
 OR NEW.created_at IS DISTINCT FROM OLD.created_at OR NEW.revision_reason IS DISTINCT FROM OLD.revision_reason
 OR OLD.approved=true OR NEW.approved<>true THEN
  RAISE EXCEPTION 'Create a new checklist revision instead of changing history';
 END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER immutable_checklist_content BEFORE UPDATE OR DELETE ON checklist_templates FOR EACH ROW EXECUTE FUNCTION protect_checklist_revision();
