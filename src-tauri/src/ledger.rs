use rusqlite::{params, Connection, Result};
use serde::Serialize;
use std::{path::Path, time::{SystemTime, UNIX_EPOCH}};

#[derive(Debug, Serialize)]
pub struct LedgerEvent { pub id: i64, pub project_id: String, pub job_id: String, pub attempt_id: String, pub kind: String, pub provider: String, pub model: String, pub input_revision: String, pub request_fingerprint: String, pub provider_task_id: Option<String>, pub detail: Option<String>, pub created_at: i64 }

pub fn open(path: &Path) -> Result<Connection> {
    let connection = Connection::open(path)?;
    connection.execute_batch("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; CREATE TABLE IF NOT EXISTS ledger_events (id INTEGER PRIMARY KEY AUTOINCREMENT, project_id TEXT NOT NULL, job_id TEXT NOT NULL, attempt_id TEXT NOT NULL, kind TEXT NOT NULL, provider TEXT NOT NULL, model TEXT NOT NULL, input_revision TEXT NOT NULL, request_fingerprint TEXT NOT NULL, provider_task_id TEXT, detail TEXT, created_at INTEGER NOT NULL); CREATE INDEX IF NOT EXISTS idx_ledger_job ON ledger_events(project_id, job_id, attempt_id, id);")?;
    Ok(connection)
}

pub fn append(connection: &Connection, event: &LedgerEvent) -> Result<i64> {
    connection.execute("INSERT INTO ledger_events (project_id,job_id,attempt_id,kind,provider,model,input_revision,request_fingerprint,provider_task_id,detail,created_at) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11)", params![event.project_id, event.job_id, event.attempt_id, event.kind, event.provider, event.model, event.input_revision, event.request_fingerprint, event.provider_task_id, event.detail, event.created_at])?;
    Ok(connection.last_insert_rowid())
}

pub fn now() -> i64 { SystemTime::now().duration_since(UNIX_EPOCH).map(|d| d.as_millis() as i64).unwrap_or_default() }

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn ledger_keeps_ambiguous_attempts() {
        let connection = open(Path::new(":memory:")).unwrap();
        let base = LedgerEvent { id: 0, project_id: "P1".into(), job_id: "J1".into(), attempt_id: "A1".into(), kind: "submission_intent".into(), provider: "mock".into(), model: "mock-1".into(), input_revision: "style-3".into(), request_fingerprint: "hash".into(), provider_task_id: None, detail: None, created_at: now() };
        append(&connection, &base).unwrap();
        append(&connection, &LedgerEvent { kind: "ambiguous".into(), detail: Some("restart".into()), ..base }).unwrap();
        let count: i64 = connection.query_row("SELECT COUNT(*) FROM ledger_events WHERE job_id='J1'", [], |row| row.get(0)).unwrap();
        assert_eq!(count, 2);
    }
}
