ALTER TABLE experience_events
  ADD COLUMN IF NOT EXISTS process_crashes integer NOT NULL DEFAULT 0;

ALTER TABLE experience_events
  ADD COLUMN IF NOT EXISTS crash_signatures jsonb NOT NULL DEFAULT '[]'::jsonb;
