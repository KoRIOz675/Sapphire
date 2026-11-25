//! Opening the database at launch, and recovering when it can't be opened.

use std::path::{Path, PathBuf};

use rusqlite::Connection;

use crate::backup::{backups_newest_first, is_readable_backup};
use crate::error::{AppError, AppResult};

pub const DB_CONFIG_FILE: &str = "db_config.json";

#[derive(Debug, PartialEq, Eq)]
pub struct DbLocation {
    pub path: PathBuf,
    /// Set by the user in Settings, rather than the default in the config dir.
    pub is_custom: bool,
}

/// `<config_dir>/sapphire.db`, unless db_config.json names another path.
pub fn resolve_db_path(config_dir: &Path) -> DbLocation {
    let custom = std::fs::read_to_string(config_dir.join(DB_CONFIG_FILE))
        .ok()
        .and_then(|s| serde_json::from_str::<serde_json::Value>(&s).ok())
        .and_then(|v| v.get("custom_db_path")?.as_str().map(str::to_string))
        .filter(|s| !s.is_empty());
    match custom {
        Some(path) => DbLocation {
            path: path.into(),
            is_custom: true,
        },
        None => DbLocation {
            path: config_dir.join("sapphire.db"),
            is_custom: false,
        },
    }
}

pub fn reset_custom_db_path(config_dir: &Path) -> AppResult<()> {
    std::fs::write(
        config_dir.join(DB_CONFIG_FILE),
        serde_json::to_string_pretty(&serde_json::json!({ "custom_db_path": "" }))?,
    )?;
    Ok(())
}

/// For a database that can't be opened: move it (and its -wal/-shm files) aside
/// as `sapphire.db.broken-<time>`, then copy in the newest readable backup from
/// the `backups` folder next to it. Returns the backup used. Nothing is moved
/// when there is no usable backup.
pub fn restore_latest_backup_offline(db_path: &Path) -> AppResult<PathBuf> {
    let dir = db_path
        .parent()
        .ok_or_else(|| AppError::Other("db path has no parent directory".into()))?;
    let backup = backups_newest_first(&dir.join("backups"))
        .map_err(|_| AppError::Other("no backups found".into()))?
        .into_iter()
        .find(|p| is_readable_backup(p))
        .ok_or_else(|| AppError::Other("no readable backup found".into()))?;

    let stamp = chrono::Local::now().format("%Y%m%d-%H%M%S");
    for suffix in ["", "-wal", "-shm"] {
        let file = PathBuf::from(format!("{}{suffix}", db_path.display()));
        if file.exists() {
            let name = file.file_name().unwrap_or_default().to_string_lossy();
            std::fs::rename(&file, dir.join(format!("{name}.broken-{stamp}")))?;
        }
    }
    std::fs::copy(&backup, db_path)?;
    Ok(backup)
}

/// What the user picked in the startup error dialog.
pub enum Recovery {
    UseDefaultLocation,
    RestoreLatestBackup,
    Quit,
}

/// Blocking native dialog shown when the database can't be opened.
pub fn ask_how_to_recover(location: &DbLocation, error: &AppError) -> Recovery {
    use rfd::{MessageButtons, MessageDialog, MessageDialogResult, MessageLevel};

    let (primary, recovery) = if location.is_custom {
        ("Use default location", Recovery::UseDefaultLocation)
    } else {
        ("Restore latest backup", Recovery::RestoreLatestBackup)
    };
    let description = format!(
        "Sapphire can't open its database.\n\n{}\n{error}",
        location.path.display()
    );
    let result = MessageDialog::new()
        .set_level(MessageLevel::Error)
        .set_title("Sapphire")
        .set_description(description)
        .set_buttons(MessageButtons::OkCancelCustom(
            primary.into(),
            "Quit / Quitter".into(),
        ))
        .show();
    match result {
        MessageDialogResult::Ok => recovery,
        MessageDialogResult::Custom(label) if label == primary => recovery,
        _ => Recovery::Quit,
    }
}

pub fn show_fatal_error(message: &str) {
    rfd::MessageDialog::new()
        .set_level(rfd::MessageLevel::Error)
        .set_title("Sapphire")
        .set_description(message)
        .set_buttons(rfd::MessageButtons::Ok)
        .show();
}

/// Open the database, asking the user how to recover if it fails. `None` means
/// the user chose to quit, or recovery failed and they were told why.
pub fn open_or_recover(config_dir: &Path) -> Option<(Connection, PathBuf)> {
    loop {
        let location = resolve_db_path(config_dir);
        let error = match crate::db::open_and_migrate(&location.path) {
            Ok(conn) => return Some((conn, location.path)),
            Err(e) => e,
        };
        let outcome = match ask_how_to_recover(&location, &error) {
            Recovery::Quit => return None,
            Recovery::UseDefaultLocation => reset_custom_db_path(config_dir),
            Recovery::RestoreLatestBackup => {
                restore_latest_backup_offline(&location.path).map(|_| ())
            }
        };
        if let Err(e) = outcome {
            show_fatal_error(&format!("Recovery failed:\n{e}"));
            return None;
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::commands::person::{insert_person, load_all_persons};
    use crate::models::PersonInput;

    fn make_db_with_person(path: &Path, last: &str) {
        let mut conn = crate::db::open_and_migrate(path).unwrap();
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

    #[test]
    fn db_path_defaults_to_the_config_dir() {
        let dir = tempfile::tempdir().unwrap();
        assert_eq!(
            resolve_db_path(dir.path()),
            DbLocation {
                path: dir.path().join("sapphire.db"),
                is_custom: false
            }
        );
    }

    #[test]
    fn custom_db_path_is_read_from_db_config_and_can_be_reset() {
        let dir = tempfile::tempdir().unwrap();
        std::fs::write(
            dir.path().join("db_config.json"),
            r#"{"custom_db_path": "/mnt/usb/sapphire.db"}"#,
        )
        .unwrap();
        assert_eq!(
            resolve_db_path(dir.path()),
            DbLocation {
                path: "/mnt/usb/sapphire.db".into(),
                is_custom: true
            }
        );

        reset_custom_db_path(dir.path()).unwrap();

        assert!(!resolve_db_path(dir.path()).is_custom);
    }

    #[test]
    fn broken_database_is_set_aside_and_replaced_by_the_newest_readable_backup() {
        let dir = tempfile::tempdir().unwrap();
        let db_path = dir.path().join("sapphire.db");
        let backups = dir.path().join("backups");
        std::fs::create_dir_all(&backups).unwrap();
        make_db_with_person(&backups.join("sapphire-20260101-000000.db"), "Older");
        make_db_with_person(&backups.join("sapphire-20260102-000000.db"), "Newer");
        // Newest by name, but unreadable: must be skipped.
        std::fs::write(backups.join("sapphire-20260103-000000.db"), "garbage").unwrap();
        std::fs::write(&db_path, "Notes:\nnot a database").unwrap();

        let used = restore_latest_backup_offline(&db_path).unwrap();

        assert_eq!(used, backups.join("sapphire-20260102-000000.db"));
        let conn = crate::db::open_and_migrate(&db_path).unwrap();
        let names: Vec<String> = load_all_persons(&conn)
            .unwrap()
            .into_iter()
            .map(|p| p.last_name)
            .collect();
        assert_eq!(names, vec!["Newer"]);
        // The broken file is kept, never deleted.
        let kept = std::fs::read_dir(dir.path())
            .unwrap()
            .filter_map(Result::ok)
            .any(|e| {
                e.file_name()
                    .to_string_lossy()
                    .starts_with("sapphire.db.broken-")
            });
        assert!(kept);
    }

    #[test]
    fn offline_restore_does_not_trust_a_future_date_in_a_backup_name() {
        let dir = tempfile::tempdir().unwrap();
        let db_path = dir.path().join("sapphire.db");
        let backups = dir.path().join("backups");
        std::fs::create_dir_all(&backups).unwrap();
        make_db_with_person(&backups.join("sapphire-20260102-000000.db"), "Genuine");
        make_db_with_person(&backups.join("sapphire-29991231-235959.db"), "Planted");
        std::fs::write(&db_path, "garbage").unwrap();

        let used = restore_latest_backup_offline(&db_path).unwrap();

        assert_eq!(used, backups.join("sapphire-20260102-000000.db"));
    }

    #[test]
    fn offline_restore_fails_cleanly_without_backups() {
        let dir = tempfile::tempdir().unwrap();
        let db_path = dir.path().join("sapphire.db");
        std::fs::write(&db_path, "garbage").unwrap();

        assert!(restore_latest_backup_offline(&db_path).is_err());
        // Nothing was moved.
        assert_eq!(std::fs::read_to_string(&db_path).unwrap(), "garbage");
    }
}
