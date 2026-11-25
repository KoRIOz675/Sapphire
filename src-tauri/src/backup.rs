use std::path::{Path, PathBuf};

use chrono::{DateTime, Local};
use rusqlite::{Connection, OpenFlags, MAIN_DB};

use crate::commands::settings::read_setting;
use crate::db::lock_db;
use crate::error::{AppError, AppResult};
use crate::AppState;

pub const BACKUP_KEEP_KEY: &str = "backup_keep"; // number of backups to retain

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BackupEntry {
    pub name: String,
    pub path: String,
    pub size_bytes: u64,
    pub modified: String,
}

/// Backups always live in a `backups` subfolder next to the database file — no
/// user override.
pub fn resolve_backup_dir(state: &AppState) -> AppResult<PathBuf> {
    let parent = state
        .db_path
        .parent()
        .ok_or_else(|| AppError::Other("db path has no parent directory".into()))?;
    Ok(parent.join("backups"))
}

/// Write a consistent snapshot of the live database to
/// `<dir>/sapphire-YYYYMMDD-HHMMSS.db`, then rotate old backups.
pub fn run_auto_backup(state: &AppState) -> AppResult<PathBuf> {
    let target = make_backup(state)?;
    rotate_backups(&resolve_backup_dir(state)?, keep_count(state)?, &[&target])?;
    Ok(target)
}

/// `VACUUM INTO` produces a transactionally consistent copy while the database is
/// in use; a plain file copy can catch a checkpoint half-way.
fn make_backup(state: &AppState) -> AppResult<PathBuf> {
    let dir = resolve_backup_dir(state)?;
    std::fs::create_dir_all(&dir)?;

    let stamp = chrono::Local::now().format("%Y%m%d-%H%M%S");
    let mut target = dir.join(format!("sapphire-{stamp}.db"));
    // Two backups in the same second: VACUUM INTO refuses to overwrite a file.
    let mut n = 1;
    while target.exists() {
        target = dir.join(format!("sapphire-{stamp}-{n}.db"));
        n += 1;
    }

    let conn = lock_db(state)?;
    conn.execute("VACUUM INTO ?1", [target.to_string_lossy()])?;
    Ok(target)
}

/// Never below 1.
fn keep_count(state: &AppState) -> AppResult<usize> {
    let conn = lock_db(state)?;
    let keep = read_setting(&conn, BACKUP_KEEP_KEY)?
        .and_then(|v| v.trim().parse::<usize>().ok())
        .unwrap_or(10);
    Ok(keep.max(1))
}

/// List all backup files in the backup directory, sorted newest-first.
pub fn list_backups(state: &AppState) -> AppResult<Vec<BackupEntry>> {
    let dir = resolve_backup_dir(state)?;
    if !dir.exists() {
        return Ok(vec![]);
    }
    let mut entries: Vec<BackupEntry> = std::fs::read_dir(&dir)?
        .filter_map(Result::ok)
        .filter(|e| e.file_name().to_string_lossy().starts_with("sapphire-"))
        .filter_map(|e| {
            let path = e.path();
            let meta = std::fs::metadata(&path).ok()?;
            let modified: DateTime<Local> = meta.modified().ok()?.into();
            Some(BackupEntry {
                name: e.file_name().to_string_lossy().to_string(),
                path: path.to_string_lossy().to_string(),
                size_bytes: meta.len(),
                modified: modified.format("%Y-%m-%dT%H:%M:%S").to_string(),
            })
        })
        .collect();
    entries.sort_by(|a, b| b.modified.cmp(&a.modified));
    Ok(entries)
}

/// Replace the live data with a backup's, through SQLite's online backup API on
/// the open connection, so no restart is needed and nothing is copied underneath
/// an open database. The current data is backed up first, and that safety backup
/// always survives the rotation that follows.
pub fn restore_from_backup(state: &AppState, path: &str) -> AppResult<()> {
    let src = validate_backup_file(state, Path::new(path))?;

    // Read the keep count now: after the restore, settings come from the backup,
    // which may not be one this app made.
    let keep = keep_count(state)?;
    let safety = make_backup(state)?;
    {
        let mut conn = lock_db(state)?;
        conn.restore(MAIN_DB, &src, None::<fn(rusqlite::backup::Progress)>)?;
        crate::db::drop_foreign_schema(&conn)?;
        // A backup made by an older version may predate later migrations.
        conn.execute_batch(crate::db::SCHEMA_SQL)?;
        crate::migrations::run(&conn)?;
    }
    rotate_backups(&resolve_backup_dir(state)?, keep, &[&safety, &src])?;
    Ok(())
}

/// The time and same-second counter in a `sapphire-YYYYMMDD-HHMMSS[-N].db` name.
fn backup_stamp(name: &str) -> Option<(chrono::NaiveDateTime, u32)> {
    let rest = name.strip_prefix("sapphire-")?.strip_suffix(".db")?;
    let (stamp, n) = match rest.get(15..) {
        Some("") => (rest, 0),
        Some(suffix) => (rest.get(..15)?, suffix.strip_prefix('-')?.parse().ok()?),
        None => return None,
    };
    let time = chrono::NaiveDateTime::parse_from_str(stamp, "%Y%m%d-%H%M%S").ok()?;
    Some((time, n))
}

/// The `sapphire-*` files in `dir`, newest first by the time in their name.
/// Names that don't parse, or that claim a time in the future, can't be trusted
/// to say how old they are, so they come last (oldest).
pub fn backups_newest_first(dir: &Path) -> AppResult<Vec<PathBuf>> {
    let now = Local::now().naive_local();
    let mut entries: Vec<(Option<(chrono::NaiveDateTime, u32)>, PathBuf)> = std::fs::read_dir(dir)?
        .filter_map(Result::ok)
        .filter_map(|e| {
            let name = e.file_name().to_string_lossy().to_string();
            if !name.starts_with("sapphire-") {
                return None;
            }
            let stamp = backup_stamp(&name).filter(|(time, _)| *time <= now);
            Some((stamp, e.path()))
        })
        .collect();
    // `Some` sorts after `None`, so a descending sort puts trusted stamps first.
    entries.sort_by(|a, b| b.0.cmp(&a.0).then_with(|| b.1.cmp(&a.1)));
    Ok(entries.into_iter().map(|(_, path)| path).collect())
}

/// A SQLite file that passes `quick_check` and has Sapphire's tables.
pub fn is_readable_backup(path: &Path) -> bool {
    let Ok(conn) = Connection::open_with_flags(path, OpenFlags::SQLITE_OPEN_READ_ONLY) else {
        return false;
    };
    let check: rusqlite::Result<String> = conn.query_row("PRAGMA quick_check", [], |r| r.get(0));
    let has_persons: rusqlite::Result<bool> = conn.query_row(
        "SELECT EXISTS (SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'persons')",
        [],
        |r| r.get(0),
    );
    matches!((check, has_persons), (Ok(c), Ok(true)) if c == "ok")
}

/// Only Sapphire backups, from the backup folder, that SQLite can read.
fn validate_backup_file(state: &AppState, path: &Path) -> AppResult<PathBuf> {
    let not_a_backup = || AppError::Other("not a Sapphire backup".into());

    let dir = resolve_backup_dir(state)?.canonicalize()?;
    let src = path
        .canonicalize()
        .map_err(|_| AppError::Other("backup file not found".into()))?;
    if src.parent() != Some(dir.as_path()) {
        return Err(not_a_backup());
    }

    if !is_readable_backup(&src) {
        return Err(not_a_backup());
    }
    Ok(src)
}

/// Keep the newest `keep` backups and delete the rest. `protect` files are never
/// deleted (they still count towards `keep`).
fn rotate_backups(dir: &Path, keep: usize, protect: &[&Path]) -> AppResult<()> {
    let mut kept = 0;
    for path in backups_newest_first(dir)? {
        if protect.iter().any(|p| *p == path) || kept < keep {
            kept += 1;
        } else {
            let _ = std::fs::remove_file(path);
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::commands::person::{insert_person, load_all_persons};
    use crate::models::PersonInput;
    use std::sync::Mutex;

    fn state_in(dir: &Path) -> AppState {
        let db_path = dir.join("sapphire.db");
        let conn = crate::db::open_and_migrate(&db_path).unwrap();
        AppState {
            db: Mutex::new(conn),
            db_path,
            config_dir: dir.to_path_buf(),
        }
    }

    fn add_person(state: &AppState, last: &str) {
        let mut conn = state.db.lock().unwrap();
        insert_person(
            &mut conn,
            PersonInput {
                first_name: "A".into(),
                last_name: last.into(),
                ..Default::default()
            },
        )
        .unwrap();
    }

    fn last_names(state: &AppState) -> Vec<String> {
        let conn = state.db.lock().unwrap();
        load_all_persons(&conn)
            .unwrap()
            .into_iter()
            .map(|p| p.last_name)
            .collect()
    }

    #[test]
    fn keep_count_of_zero_still_keeps_the_backup_just_made() {
        let dir = tempfile::tempdir().unwrap();
        let state = state_in(dir.path());
        crate::commands::settings::write_setting(&state.db.lock().unwrap(), BACKUP_KEEP_KEY, "0")
            .unwrap();

        let made = run_auto_backup(&state).unwrap();

        assert!(made.exists(), "backup {made:?} was deleted by rotation");
    }

    #[test]
    fn backup_contains_committed_data() {
        let dir = tempfile::tempdir().unwrap();
        let state = state_in(dir.path());
        add_person(&state, "Lovelace");

        let made = run_auto_backup(&state).unwrap();

        let copy = rusqlite::Connection::open(&made).unwrap();
        let n: i64 = copy
            .query_row("SELECT COUNT(*) FROM persons", [], |r| r.get(0))
            .unwrap();
        assert_eq!(n, 1);
    }

    #[test]
    fn restore_rejects_a_file_outside_the_backup_folder() {
        let dir = tempfile::tempdir().unwrap();
        let state = state_in(dir.path());
        let elsewhere = tempfile::tempdir().unwrap();
        let other_db = elsewhere.path().join("sapphire-20260101-000000.db");
        crate::db::open_and_migrate(&other_db).unwrap();

        assert!(restore_from_backup(&state, other_db.to_str().unwrap()).is_err());
    }

    #[test]
    fn restore_rejects_a_file_that_is_not_a_database() {
        let dir = tempfile::tempdir().unwrap();
        let state = state_in(dir.path());
        add_person(&state, "Lovelace");
        let backups = resolve_backup_dir(&state).unwrap();
        std::fs::create_dir_all(&backups).unwrap();
        let fake = backups.join("sapphire-20260101-000000.db");
        std::fs::write(&fake, "Notes:\nnot a database").unwrap();

        assert!(restore_from_backup(&state, fake.to_str().unwrap()).is_err());

        // The live database is untouched and still opens after a restart.
        drop(state);
        let reopened = state_in(dir.path());
        assert_eq!(last_names(&reopened), vec!["Lovelace"]);
    }

    #[test]
    fn restoring_a_backup_never_deletes_the_safety_backup() {
        let dir = tempfile::tempdir().unwrap();
        let state = state_in(dir.path());
        add_person(&state, "Lovelace");
        run_auto_backup(&state).unwrap();
        // A backup someone else made: it keeps one backup and its name claims to
        // be from the far future, so it would always rank as the newest.
        let backups = resolve_backup_dir(&state).unwrap();
        let foreign = backups.join("sapphire-29991231-235959.db");
        {
            let other = crate::db::open_and_migrate(&foreign).unwrap();
            crate::commands::settings::write_setting(&other, BACKUP_KEEP_KEY, "1").unwrap();
        }

        restore_from_backup(&state, foreign.to_str().unwrap()).unwrap();

        let has_lovelace = backups_newest_first(&backups).unwrap().iter().any(|p| {
            rusqlite::Connection::open(p)
                .and_then(|c| {
                    c.query_row(
                        "SELECT COUNT(*) FROM persons WHERE last_name = 'Lovelace'",
                        [],
                        |r| r.get::<_, i64>(0),
                    )
                })
                .is_ok_and(|n| n > 0)
        });
        assert!(has_lovelace, "no backup of the pre-restore data survived");
    }

    #[test]
    fn restoring_a_backup_drops_its_triggers() {
        let dir = tempfile::tempdir().unwrap();
        let state = state_in(dir.path());
        let backups = resolve_backup_dir(&state).unwrap();
        std::fs::create_dir_all(&backups).unwrap();
        let foreign = backups.join("sapphire-20260101-000000.db");
        {
            let other = crate::db::open_and_migrate(&foreign).unwrap();
            other
                .execute_batch(
                    "CREATE TRIGGER rename AFTER INSERT ON persons BEGIN
                       UPDATE persons SET last_name = 'Tampered' WHERE id = NEW.id;
                     END;",
                )
                .unwrap();
        }

        restore_from_backup(&state, foreign.to_str().unwrap()).unwrap();
        add_person(&state, "Lovelace");

        assert_eq!(last_names(&state), vec!["Lovelace"]);
    }

    #[test]
    fn backups_are_ordered_by_the_time_in_their_name() {
        let dir = tempfile::tempdir().unwrap();
        for name in [
            "sapphire-20260101-000000.db",
            "sapphire-20260101-000000-1.db",
            "sapphire-20260101-000000-2.db",
            "sapphire-29991231-235959.db",
            "sapphire-garbage.db",
            "sapphire-20250101-000000.db",
        ] {
            std::fs::write(dir.path().join(name), "").unwrap();
        }

        let names: Vec<String> = backups_newest_first(dir.path())
            .unwrap()
            .iter()
            .map(|p| p.file_name().unwrap().to_string_lossy().to_string())
            .collect();

        assert_eq!(
            names[..4],
            [
                "sapphire-20260101-000000-2.db",
                "sapphire-20260101-000000-1.db",
                "sapphire-20260101-000000.db",
                "sapphire-20250101-000000.db",
            ]
        );
    }

    #[test]
    fn restore_replaces_live_data_without_a_restart() {
        let dir = tempfile::tempdir().unwrap();
        let state = state_in(dir.path());
        add_person(&state, "Lovelace");
        let backup = run_auto_backup(&state).unwrap();
        add_person(&state, "Hopper");

        restore_from_backup(&state, backup.to_str().unwrap()).unwrap();

        assert_eq!(last_names(&state), vec!["Lovelace"]);
        // Writes after the restore land in the restored database and survive a reopen.
        add_person(&state, "Turing");
        drop(state);
        let reopened = state_in(dir.path());
        assert_eq!(last_names(&reopened), vec!["Lovelace", "Turing"]);
    }
}
