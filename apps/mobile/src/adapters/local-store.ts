import * as SQLite from "expo-sqlite";
let database: Promise<SQLite.SQLiteDatabase> | undefined;
async function db() {
  database ??= (async () => {
    const d = await SQLite.openDatabaseAsync("arihant-work.db");
    await d.execAsync(
      "PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS local_records (owner TEXT NOT NULL, record_key TEXT NOT NULL, payload TEXT NOT NULL, updated_at TEXT NOT NULL, PRIMARY KEY(owner,record_key));",
    );
    return d;
  })();
  return database;
}
export async function loadLocal<T>(
  owner: string,
  key: string,
): Promise<T | null> {
  const d = await db();
  const row = await d.getFirstAsync<{ payload: string }>(
    "SELECT payload FROM local_records WHERE owner=? AND record_key=?",
    owner,
    key,
  );
  return row ? (JSON.parse(row.payload) as T) : null;
}
export async function saveLocal(owner: string, key: string, value: unknown) {
  const d = await db();
  await d.runAsync(
    "INSERT INTO local_records(owner,record_key,payload,updated_at) VALUES(?,?,?,?) ON CONFLICT(owner,record_key) DO UPDATE SET payload=excluded.payload,updated_at=excluded.updated_at",
    owner,
    key,
    JSON.stringify(value),
    new Date().toISOString(),
  );
}
export async function deleteLocal(owner: string, key: string) {
  const d = await db();
  await d.runAsync(
    "DELETE FROM local_records WHERE owner=? AND record_key=?",
    owner,
    key,
  );
}
export type PhotoDraft = {
  id: string;
  uri: string;
  width: number;
  height: number;
  bytes: number;
  result?: "ok" | "problem" | "unable" | "not_applicable";
  reading?: number | null;
  applicabilityConfirmed?: boolean;
  note: string;
  evidenceId?: string;
  commandId?: string;
  expectedVersion?: number;
  synced?: boolean;
};
