ALTER TABLE companies ADD COLUMN access_code text;
UPDATE companies SET access_code='dealer-'||replace(id::text,'-','');
UPDATE companies SET access_code='arihant-training' WHERE id='10000000-0000-4000-8000-000000000001';
ALTER TABLE companies ALTER COLUMN access_code SET NOT NULL;
CREATE UNIQUE INDEX company_access_code ON companies(lower(access_code));
ALTER TABLE users ADD COLUMN version integer NOT NULL DEFAULT 1 CHECK(version>0);
CREATE TABLE user_credentials (
 user_id uuid PRIMARY KEY, company_id uuid NOT NULL, login_name text NOT NULL,
 secret_hash text NOT NULL, must_change_secret boolean NOT NULL DEFAULT true,
 updated_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(user_id,company_id) REFERENCES users(id,company_id)
);
CREATE UNIQUE INDEX credential_login ON user_credentials(company_id,lower(login_name));
CREATE TABLE login_attempts (
 bucket text PRIMARY KEY, failures integer NOT NULL DEFAULT 0,
 started_at timestamptz NOT NULL DEFAULT now(), blocked_until timestamptz
);
CREATE TABLE identity_commands (
 actor_id uuid NOT NULL REFERENCES users(id), command_id uuid NOT NULL,
 public_fingerprint text NOT NULL, secret_hash text, response jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(actor_id,command_id)
);
CREATE TRIGGER immutable_identity_command BEFORE UPDATE OR DELETE ON identity_commands FOR EACH ROW EXECUTE FUNCTION reject_audit_change();
