ALTER TABLE tasks ADD COLUMN recheck_note text NOT NULL DEFAULT '';
ALTER TABLE task_reviews ADD COLUMN note text NOT NULL DEFAULT '';
ALTER TABLE task_reviews ADD COLUMN recheck_items jsonb NOT NULL DEFAULT '[]'::jsonb;
