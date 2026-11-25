use rusqlite::{params, OptionalExtension};
use tauri::State;

use crate::backup;
use crate::error::{AppError, AppResult};
use crate::AppState;

use crate::startup::DB_CONFIG_FILE;

pub fn read_setting(conn: &rusqlite::Connection, key: &str) -> AppResult<Option<String>> {
    let mut stmt = conn.prepare("SELECT value FROM settings WHERE key = ?1")?;
    Ok(stmt
        .query_row([key], |r| r.get::<_, String>(0))
        .optional()?)
}

pub fn write_setting(conn: &rusqlite::Connection, key: &str, value: &str) -> AppResult<()> {
    conn.execute(
        "INSERT INTO settings (key, value) VALUES (?1, ?2)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        params![key, value],
    )?;
    Ok(())
}

#[tauri::command(async)]
pub fn get_setting(state: State<'_, AppState>, key: String) -> AppResult<Option<String>> {
    let conn = state
        .db
        .lock()
        .map_err(|_| AppError::Other("db lock poisoned".into()))?;
    read_setting(&conn, &key)
}

#[tauri::command(async)]
pub fn set_setting(state: State<'_, AppState>, key: String, value: String) -> AppResult<()> {
    let conn = state
        .db
        .lock()
        .map_err(|_| AppError::Other("db lock poisoned".into()))?;
    write_setting(&conn, &key, &value)
}

#[tauri::command(async)]
pub fn get_db_path(state: State<'_, AppState>) -> AppResult<String> {
    Ok(state.db_path.to_string_lossy().to_string())
}

#[tauri::command(async)]
pub fn run_backup_now(state: State<'_, AppState>) -> AppResult<String> {
    let path = backup::run_auto_backup(state.inner())?;
    Ok(path.to_string_lossy().to_string())
}

#[tauri::command(async)]
pub fn list_backups(state: State<'_, AppState>) -> AppResult<Vec<backup::BackupEntry>> {
    backup::list_backups(state.inner())
}

#[tauri::command(async)]
pub fn restore_from_backup(state: State<'_, AppState>, path: String) -> AppResult<()> {
    backup::restore_from_backup(state.inner(), &path)
}

/// Returns the custom DB path stored in db_config.json, or None if using the default.
#[tauri::command(async)]
pub fn get_custom_db_path(state: State<'_, AppState>) -> AppResult<Option<String>> {
    let config_file = state.config_dir.join(DB_CONFIG_FILE);
    if !config_file.exists() {
        return Ok(None);
    }
    let content = std::fs::read_to_string(&config_file)
        .map_err(|e| AppError::Other(format!("read db_config: {e}")))?;
    let val: serde_json::Value = serde_json::from_str(&content)
        .map_err(|e| AppError::Other(format!("parse db_config: {e}")))?;
    Ok(val
        .get("custom_db_path")
        .and_then(|v| v.as_str())
        .filter(|s| !s.is_empty())
        .map(|s| s.to_string()))
}

/// Persists a custom DB path in db_config.json and copies the current DB file to that location.
/// Pass None or empty string to reset to default (no file is moved in that case).
/// Takes effect on next application restart.
/// Ask for a folder and move the database there from the next launch. Returns
/// the new database path, or `None` when the user cancels.
#[tauri::command(async)]
pub fn choose_db_folder(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
) -> AppResult<Option<String>> {
    let Some(folder) = crate::dialogs::pick_folder(&app) else {
        return Ok(None);
    };
    let path = folder.join("sapphire.db").to_string_lossy().to_string();
    set_db_path(&state, &path)?;
    Ok(Some(path))
}

/// Go back to the default database location from the next launch.
#[tauri::command(async)]
pub fn reset_db_path(state: State<'_, AppState>) -> AppResult<()> {
    set_db_path(&state, "")
}

/// Copy the database (and its attachments) to `path` and record it as the
/// location to use from the next launch. An empty path goes back to the default.
/// A database already at `path` is never overwritten: it may be one synced from
/// another computer.
fn set_db_path(state: &AppState, path: &str) -> AppResult<()> {
    if !path.is_empty() {
        let new_pb = std::path::PathBuf::from(path);
        if new_pb != state.db_path {
            if new_pb.exists() {
                return Err(AppError::Other(format!(
                    "a database already exists at {}",
                    new_pb.display()
                )));
            }
            // Ensure the destination directory exists.
            if let Some(parent) = new_pb.parent() {
                std::fs::create_dir_all(parent)
                    .map_err(|e| AppError::Other(format!("create destination dir: {e}")))?;
            }
            // Flush WAL so the copy is complete.
            crate::db::lock_db(state)?.execute_batch("PRAGMA wal_checkpoint(FULL);")?;
            std::fs::copy(&state.db_path, &new_pb)
                .map_err(|e| AppError::Other(format!("copy database file: {e}")))?;
            copy_attachments(state, &new_pb)?;
        }
    }

    let config_file = state.config_dir.join(DB_CONFIG_FILE);
    let val = serde_json::json!({ "custom_db_path": path });
    std::fs::write(
        &config_file,
        serde_json::to_string_pretty(&val)
            .map_err(|e| AppError::Other(format!("serialize db_config: {e}")))?,
    )
    .map_err(|e| AppError::Other(format!("write db_config: {e}")))?;
    Ok(())
}

/// Attachments live next to the database, so they move with it. Files already
/// in the destination are left as they are.
fn copy_attachments(state: &AppState, new_db: &std::path::Path) -> AppResult<()> {
    let Some(from) = state.db_path.parent().map(|p| p.join("attachments")) else {
        return Ok(());
    };
    let Some(to) = new_db.parent().map(|p| p.join("attachments")) else {
        return Ok(());
    };
    let Ok(entries) = std::fs::read_dir(&from) else {
        return Ok(()); // no attachments yet
    };
    std::fs::create_dir_all(&to)?;
    for entry in entries.filter_map(Result::ok) {
        let target = to.join(entry.file_name());
        if entry.file_type().is_ok_and(|t| t.is_file()) && !target.exists() {
            std::fs::copy(entry.path(), target)
                .map_err(|e| AppError::Other(format!("copy attachment: {e}")))?;
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::Mutex;

    fn state_in(dir: &std::path::Path) -> AppState {
        let db_path = dir.join("sapphire.db");
        let conn = crate::db::open_and_migrate(&db_path).unwrap();
        AppState {
            db: Mutex::new(conn),
            db_path,
            config_dir: dir.to_path_buf(),
        }
    }

    #[test]
    fn moving_the_database_never_overwrites_one_already_there() {
        let dir = tempfile::tempdir().unwrap();
        let state = state_in(dir.path());
        let synced = tempfile::tempdir().unwrap();
        let existing = synced.path().join("sapphire.db");
        std::fs::write(&existing, "another computer's data").unwrap();

        assert!(set_db_path(&state, existing.to_str().unwrap()).is_err());

        assert_eq!(
            std::fs::read_to_string(&existing).unwrap(),
            "another computer's data"
        );
        // The location was not switched either.
        assert!(!crate::startup::resolve_db_path(dir.path()).is_custom);
    }

    #[test]
    fn moving_the_database_takes_its_attachments_along() {
        let dir = tempfile::tempdir().unwrap();
        let state = state_in(dir.path());
        std::fs::create_dir_all(dir.path().join("attachments")).unwrap();
        std::fs::write(dir.path().join("attachments").join("abc.pdf"), "pdf").unwrap();
        let target = tempfile::tempdir().unwrap();
        let new_db = target.path().join("sapphire.db");

        set_db_path(&state, new_db.to_str().unwrap()).unwrap();

        assert!(new_db.exists());
        assert!(target.path().join("attachments").join("abc.pdf").exists());
        assert!(crate::startup::resolve_db_path(dir.path()).is_custom);
    }
}
