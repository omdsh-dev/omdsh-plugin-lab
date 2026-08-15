-- v3 adds one task-agnostic category enum. Historical v1/v2 tables remain
-- untouched and are never read, reinterpreted, migrated or uploaded by v3.
CREATE TABLE IF NOT EXISTS feedback_clusters_v3 (
  id uuid PRIMARY KEY,
  cluster_key text UNIQUE NOT NULL,
  plugin_module text NOT NULL,
  plugin_version text,
  health text NOT NULL CHECK (health IN ('ok', 'unavailable', 'error', 'unknown')),
  experience text NOT NULL CHECK (experience IN ('good', 'mixed', 'bad')),
  category text NOT NULL CHECK (category IN (
    'installation', 'startup', 'invocation', 'compatibility',
    'reliability', 'performance', 'result_quality', 'general'
  )),
  symptom text NOT NULL,
  status text NOT NULL DEFAULT 'received',
  report_count integer NOT NULL DEFAULT 0,
  github_issue_url text,
  recommended_version text,
  updated_at bigint NOT NULL
);

CREATE TABLE IF NOT EXISTS feedback_events_v3 (
  event_id uuid PRIMARY KEY,
  plugin_module text NOT NULL,
  plugin_version text,
  health text NOT NULL CHECK (health IN ('ok', 'unavailable', 'error', 'unknown')),
  experience text NOT NULL CHECK (experience IN ('good', 'mixed', 'bad')),
  category text NOT NULL CHECK (category IN (
    'installation', 'startup', 'invocation', 'compatibility',
    'reliability', 'performance', 'result_quality', 'general'
  )),
  source text NOT NULL CHECK (source = 'user_confirmed'),
  retest_of_receipt_id uuid,
  cluster_key text NOT NULL REFERENCES feedback_clusters_v3(cluster_key),
  created_at bigint NOT NULL
);

CREATE INDEX IF NOT EXISTS feedback_events_v3_plugin_idx
  ON feedback_events_v3(plugin_module, created_at DESC);
CREATE INDEX IF NOT EXISTS feedback_events_v3_cluster_idx
  ON feedback_events_v3(cluster_key);

CREATE TABLE IF NOT EXISTS follow_receipts_v3 (
  receipt_id uuid PRIMARY KEY,
  event_id uuid UNIQUE NOT NULL REFERENCES feedback_events_v3(event_id),
  created_at bigint NOT NULL
);
