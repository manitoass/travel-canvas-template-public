-- Travel Canvas D1 V1. Each finished gesture is one revision of a single owner document.
-- Migrations are deliberately separate from deploy: no accidental data reset on code updates.
CREATE TABLE IF NOT EXISTS document_state (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  revision INTEGER NOT NULL CHECK (revision >= 0),
  content TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  last_operation_id TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS operation_history (
  operation_id TEXT PRIMARY KEY,
  payload_hash TEXT NOT NULL,
  revision INTEGER NOT NULL,
  response TEXT NOT NULL,
  kind TEXT NOT NULL,
  applied_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_operations_recent ON operation_history(applied_at DESC);
CREATE TABLE IF NOT EXISTS snapshots (
  id TEXT PRIMARY KEY,
  revision INTEGER NOT NULL,
  content TEXT NOT NULL,
  created_at TEXT NOT NULL,
  kind TEXT NOT NULL CHECK(kind IN ('daily','manual','pre-import','pre-restore'))
);
CREATE INDEX IF NOT EXISTS idx_snapshots_recent ON snapshots(kind, created_at DESC);
