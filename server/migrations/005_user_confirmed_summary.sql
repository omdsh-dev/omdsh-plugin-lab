-- v4 keeps legacy v3 tables and adds one bounded, user-confirmed private summary.
-- It is deliberately absent from cluster rows and public GitHub aggregation.
ALTER TABLE feedback_events_v3
  ADD COLUMN IF NOT EXISTS summary varchar(320);

ALTER TABLE feedback_events_v3
  ADD COLUMN IF NOT EXISTS summary_source varchar(11);
