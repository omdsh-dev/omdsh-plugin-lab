CREATE TABLE IF NOT EXISTS issue_clusters (
  id uuid PRIMARY KEY,
  cluster_key text UNIQUE NOT NULL,
  plugin_module text NOT NULL,
  plugin_version text,
  task_id text,
  symptom text NOT NULL,
  status text NOT NULL DEFAULT 'received',
  similar_reports integer NOT NULL DEFAULT 0,
  github_issue_url text,
  recommended_version text,
  message text,
  updated_at bigint NOT NULL
);

CREATE TABLE IF NOT EXISTS experience_events (
  event_id uuid PRIMARY KEY,
  participant_hash text NOT NULL,
  trial_id text NOT NULL,
  plugin_module text NOT NULL,
  plugin_version text,
  task_id text,
  retest_of_receipt_id text,
  dsh_version text NOT NULL,
  outcome text NOT NULL,
  retention text NOT NULL,
  loader_health text NOT NULL,
  assistant_messages integer NOT NULL,
  tool_errors integer NOT NULL,
  agent_errors integer NOT NULL,
  duration_ms bigint NOT NULL,
  first_reply_ms bigint,
  note text,
  note_expires_at bigint,
  cluster_key text NOT NULL REFERENCES issue_clusters(cluster_key),
  occurred_at bigint NOT NULL,
  created_at bigint NOT NULL
);

CREATE INDEX IF NOT EXISTS experience_events_plugin_idx
  ON experience_events(plugin_module, occurred_at DESC);
CREATE INDEX IF NOT EXISTS experience_events_cluster_idx
  ON experience_events(cluster_key);
CREATE INDEX IF NOT EXISTS experience_events_note_expiry_idx
  ON experience_events(note_expires_at) WHERE note_expires_at IS NOT NULL;

CREATE TABLE IF NOT EXISTS follow_receipts (
  receipt_id uuid PRIMARY KEY,
  event_id uuid UNIQUE NOT NULL REFERENCES experience_events(event_id),
  created_at bigint NOT NULL
);
