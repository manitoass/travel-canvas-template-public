// Safe first-run D1 bootstrap. The equivalent SQL is retained in migrations/0001_initial.sql.
// This creates *only missing* tables; it never resets or changes existing travel data.
const TABLE_SQL = [
  `CREATE TABLE IF NOT EXISTS document_state (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    revision INTEGER NOT NULL CHECK (revision >= 0),
    content TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    last_operation_id TEXT NOT NULL DEFAULT ''
  )`,
  `CREATE TABLE IF NOT EXISTS operation_history (
    operation_id TEXT PRIMARY KEY,
    payload_hash TEXT NOT NULL,
    revision INTEGER NOT NULL,
    response TEXT NOT NULL,
    kind TEXT NOT NULL,
    applied_at TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_operations_recent ON operation_history(applied_at DESC)`,
  `CREATE TABLE IF NOT EXISTS snapshots (
    id TEXT PRIMARY KEY,
    revision INTEGER NOT NULL,
    content TEXT NOT NULL,
    created_at TEXT NOT NULL,
    kind TEXT NOT NULL CHECK(kind IN ('daily','manual','pre-import','pre-restore'))
  )`,
  `CREATE INDEX IF NOT EXISTS idx_snapshots_recent ON snapshots(kind, created_at DESC)`
];
export async function ensureSchema(db){
  const present=await db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='document_state'").first();
  if(present)return;
  // D1.batch is transactional; concurrent initializations are idempotent via IF NOT EXISTS.
  await db.batch(TABLE_SQL.map(sql=>db.prepare(sql)));
}
export {TABLE_SQL};
