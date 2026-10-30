-- Existing integrations may create a company before choosing its public login code.
ALTER TABLE companies ALTER COLUMN access_code SET DEFAULT ('dealer-'||replace(gen_random_uuid()::text,'-',''));
