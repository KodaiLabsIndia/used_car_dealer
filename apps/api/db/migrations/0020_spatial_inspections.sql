CREATE TABLE vehicle_catalogue_releases (
 id text PRIMARY KEY, source_url text NOT NULL, revision text NOT NULL, license text NOT NULL,
 sha256 text NOT NULL, scope text NOT NULL, imported_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE vehicle_catalogue_makes (
 id uuid PRIMARY KEY, name text NOT NULL UNIQUE
);
CREATE TABLE vehicle_catalogue_models (
 id uuid PRIMARY KEY, make_id uuid NOT NULL REFERENCES vehicle_catalogue_makes(id), name text NOT NULL,
 release_id text NOT NULL REFERENCES vehicle_catalogue_releases(id),
 body_type text NOT NULL DEFAULT 'unknown', source_url text NOT NULL,
 market_status text NOT NULL DEFAULT 'unverified' CHECK(market_status IN ('unverified','india_reference')),
 UNIQUE(make_id,name)
);
CREATE INDEX catalogue_model_names ON vehicle_catalogue_models(lower(name));
ALTER TABLE vehicles ADD COLUMN catalogue_model_id uuid REFERENCES vehicle_catalogue_models(id);
ALTER TABLE tasks ADD COLUMN vehicle_configuration jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE tasks ADD CONSTRAINT inspection_configuration_object CHECK(jsonb_typeof(vehicle_configuration)='object');
ALTER TABLE inspection_answers DROP CONSTRAINT inspection_answers_result_check;
ALTER TABLE inspection_answers ADD CONSTRAINT inspection_answers_result_check CHECK(result IN ('ok','problem','unable','not_applicable'));
ALTER TABLE inspection_answers ADD COLUMN reading double precision;
ALTER TABLE inspection_answers ADD COLUMN applicability_confirmed boolean NOT NULL DEFAULT false;
ALTER TABLE inspection_answers ADD CONSTRAINT finite_reading CHECK(reading IS NULL OR (reading>=0 AND reading<'Infinity'::float8));
