//! Schema migration system for Sapphire CRM.
//!
//! How it works:
//!  - The baseline schema (schema.sql) is applied once on a fresh DB via `IF NOT EXISTS` guards.
//!  - This module tracks applied migrations in a `schema_migrations` table (single-row: version INTEGER).
//!  - Each new migration is a numbered entry in the MIGRATIONS array below.
//!
//! CONVENTION: Never add new CREATE TABLE statements to schema.sql.
//! Put all DDL changes here as numbered migrations instead.

use rusqlite::Connection;

use crate::error::AppResult;

/// List of migrations in order. Index 0 = migration #1, etc.
/// Each entry is (label, sql). The SQL runs inside a transaction.
static MIGRATIONS: &[(&str, &str)] = &[
    // Migration 001 — add reminder_lead_time_hours to settings (no DDL needed,
    // the settings table already exists; we just insert the default value if absent)
    (
        "001_reminder_defaults",
        "INSERT OR IGNORE INTO settings (key, value) VALUES ('reminder_lead_time_hours', '24');",
    ),
    // Migration 002 — add optional birthday column to persons
    (
        "002_person_birthday",
        "ALTER TABLE persons ADD COLUMN birthday TEXT;",
    ),
];

/// Ensure the `schema_migrations` tracking table exists and run any outstanding migrations.
pub fn run(conn: &Connection) -> AppResult<()> {
    // Create the tracking table if this is a first-time setup
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER NOT NULL DEFAULT 0);
         INSERT OR IGNORE INTO schema_migrations (version) SELECT 0 WHERE NOT EXISTS (SELECT 1 FROM schema_migrations);",
    )?;

    let current_version: i64 =
        conn.query_row("SELECT version FROM schema_migrations LIMIT 1", [], |r| {
            r.get(0)
        })?;

    for (idx, (label, sql)) in MIGRATIONS.iter().enumerate() {
        let migration_number = (idx + 1) as i64;
        if migration_number <= current_version {
            continue;
        }

        // Run the migration inside a savepoint so a partial failure rolls back
        let sp_name = format!("sp_migration_{migration_number}");
        conn.execute_batch(&format!("SAVEPOINT \"{sp_name}\";"))?;
        match conn.execute_batch(sql) {
            Ok(_) => {
                conn.execute(
                    "UPDATE schema_migrations SET version = ?1",
                    [migration_number],
                )?;
                conn.execute_batch(&format!("RELEASE \"{sp_name}\";"))?;
                eprintln!("Applied migration {migration_number}: {label}");
            }
            Err(e) => {
                conn.execute_batch(&format!("ROLLBACK TO \"{sp_name}\";"))?;
                conn.execute_batch(&format!("RELEASE \"{sp_name}\";"))?;
                return Err(crate::error::AppError::Other(format!(
                    "Migration {migration_number} ({label}) failed: {e}"
                )));
            }
        }
    }

    Ok(())
}
