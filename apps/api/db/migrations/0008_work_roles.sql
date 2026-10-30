ALTER TABLE users ADD COLUMN work_roles text[] NOT NULL DEFAULT ARRAY['inspector']::text[];
ALTER TABLE users ADD CONSTRAINT work_roles_valid CHECK (work_roles <@ ARRAY['inspector','coordinator','supervisor','manager']::text[] AND cardinality(work_roles)>0);
