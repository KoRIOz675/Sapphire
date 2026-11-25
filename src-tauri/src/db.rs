use std::collections::HashMap;
use std::path::Path;
use std::sync::MutexGuard;

use rusqlite::Connection;

use crate::error::{AppError, AppResult};
use crate::migrations;
use crate::AppState;

pub const SCHEMA_SQL: &str = include_str!("schema.sql");

/// Open (creating if needed) a SQLite database at `path`, apply the baseline
/// schema (idempotent via IF NOT EXISTS), then run any outstanding migrations.
pub fn open_and_migrate(path: &Path) -> AppResult<Connection> {
    let conn = Connection::open(path)?;
    conn.execute_batch("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;")?;
    harden(&conn)?;
    drop_foreign_schema(&conn)?;
    register_fold(&conn)?;
    // Apply baseline schema (all guarded by IF NOT EXISTS — safe to re-run)
    conn.execute_batch(SCHEMA_SQL)?;
    // Run numbered migrations
    migrations::run(&conn)?;
    Ok(conn)
}

/// The database file may come from elsewhere (a restored backup, a custom
/// folder others can write), so treat its schema as untrusted: no writes to
/// the schema or shadow tables, and no app functions called from triggers or
/// views it defines.
pub fn harden(conn: &Connection) -> AppResult<()> {
    use rusqlite::config::DbConfig;
    conn.set_db_config(DbConfig::SQLITE_DBCONFIG_DEFENSIVE, true)?;
    conn.set_db_config(DbConfig::SQLITE_DBCONFIG_TRUSTED_SCHEMA, false)?;
    Ok(())
}

/// Sapphire defines no triggers or views, so any present came with a database
/// someone else wrote. A trigger runs on every later write and could silently
/// change or block the user's edits; drop them all.
pub fn drop_foreign_schema(conn: &Connection) -> AppResult<()> {
    let objects: Vec<(String, String)> = conn
        .prepare("SELECT type, name FROM sqlite_master WHERE type IN ('trigger', 'view')")?
        .query_map([], |r| Ok((r.get(0)?, r.get(1)?)))?
        .collect::<Result<_, _>>()?;
    for (kind, name) in objects {
        let kind = if kind == "trigger" { "TRIGGER" } else { "VIEW" };
        let name = name.replace('"', "\"\"");
        conn.execute_batch(&format!("DROP {kind} IF EXISTS \"{name}\""))?;
    }
    Ok(())
}

/// Case- and accent-insensitive form of a string, for searching: "Émilie" and
/// "EMILIE" both fold to "emilie". SQLite's own lower() and LIKE only fold ASCII.
pub fn fold(s: &str) -> String {
    use unicode_normalization::{char::is_combining_mark, UnicodeNormalization};
    s.nfd()
        .filter(|c| !is_combining_mark(*c))
        .flat_map(char::to_lowercase)
        .collect()
}

/// Expose `fold` to SQL as `fold(text)`; NULL stays NULL.
fn register_fold(conn: &Connection) -> rusqlite::Result<()> {
    use rusqlite::functions::FunctionFlags;
    conn.create_scalar_function(
        "fold",
        1,
        FunctionFlags::SQLITE_UTF8 | FunctionFlags::SQLITE_DETERMINISTIC,
        |ctx| Ok(ctx.get::<Option<String>>(0)?.map(|s| fold(&s))),
    )
}

/// A stored date: RFC 3339 (what the app writes), or a bare `YYYY-MM-DD` from
/// older CSV imports, read as local midnight.
pub fn parse_timestamp(s: &str) -> Option<chrono::DateTime<chrono::Utc>> {
    use chrono::{DateTime, NaiveDate, Utc};
    if let Ok(d) = DateTime::parse_from_rfc3339(s) {
        return Some(d.with_timezone(&Utc));
    }
    let date = NaiveDate::parse_from_str(s, "%Y-%m-%d").ok()?;
    Some(local_midnight(date))
}

/// Start of `date` in the local timezone, as a UTC instant.
pub fn local_midnight(date: chrono::NaiveDate) -> chrono::DateTime<chrono::Utc> {
    use chrono::{Local, TimeZone, Utc};
    let midnight = date.and_hms_opt(0, 0, 0).expect("midnight is a valid time");
    // `earliest` covers a DST gap at midnight; fall back to UTC if the local
    // time doesn't exist at all.
    Local
        .from_local_datetime(&midnight)
        .earliest()
        .map(|d| d.with_timezone(&Utc))
        .unwrap_or_else(|| Utc.from_utc_datetime(&midnight))
}

/// Same format the frontend stores (`Date.toISOString()`): `2026-11-18T23:00:00.000Z`.
pub fn to_iso(d: chrono::DateTime<chrono::Utc>) -> String {
    d.to_rfc3339_opts(chrono::SecondsFormat::Millis, true)
}

/// Current ISO-8601 UTC timestamp.
pub fn now_iso() -> String {
    chrono::Utc::now().to_rfc3339()
}

/// Utility : generate a new UUID v4 as a String.
pub fn new_uuid() -> String {
    uuid::Uuid::new_v4().to_string()
}

/// Lock the shared connection, turning a poisoned lock into an error instead of a panic.
pub fn lock_db(state: &AppState) -> AppResult<MutexGuard<'_, Connection>> {
    state
        .db
        .lock()
        .map_err(|_| AppError::Other("db lock poisoned".into()))
}

/// `sql` selects (owner id, linked id) pairs; returns owner id -> linked ids.
/// Loading a whole link table in one query avoids a query per listed record.
pub fn load_link_map(conn: &Connection, sql: &str) -> AppResult<HashMap<String, Vec<String>>> {
    let mut stmt = conn.prepare_cached(sql)?;
    let mut map: HashMap<String, Vec<String>> = HashMap::new();
    let rows = stmt.query_map([], |row| {
        Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
    })?;
    for row in rows {
        let (owner, linked) = row?;
        map.entry(owner).or_default().push(linked);
    }
    Ok(map)
}

/// `sql` selects the linked ids of the record whose id is `?1`.
pub fn load_links(conn: &Connection, sql: &str, id: &str) -> AppResult<Vec<String>> {
    let mut stmt = conn.prepare_cached(sql)?;
    let ids = stmt
        .query_map([id], |r| r.get::<_, String>(0))?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(ids)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn opening_a_database_drops_triggers_and_views_it_brought() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("sapphire.db");
        {
            let conn = open_and_migrate(&path).unwrap();
            conn.execute_batch(
                "CREATE TRIGGER t AFTER INSERT ON settings BEGIN DELETE FROM settings; END;
                 CREATE VIEW v AS SELECT * FROM settings;",
            )
            .unwrap();
        }

        let conn = open_and_migrate(&path).unwrap();

        let n: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM sqlite_master WHERE type IN ('trigger', 'view')",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(n, 0);
    }
}
