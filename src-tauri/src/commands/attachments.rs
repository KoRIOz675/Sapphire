use crate::{
    db::{lock_db, new_uuid, now_iso},
    error::{AppError, AppResult},
    models::Attachment,
    AppState,
};
use rusqlite::Connection;
use std::path::{Path, PathBuf};
use tauri::State;

/// Attachments are stored in an `attachments` folder next to the database file.
fn attachments_dir(state: &AppState) -> AppResult<PathBuf> {
    Ok(state
        .db_path
        .parent()
        .ok_or("invalid db path")?
        .join("attachments"))
}

/// The file an attachment row refers to, or `None` if there is no such file.
///
/// `stored_path` comes from the database, which may be a restored backup or a
/// database file someone else wrote, so it is never used as a path. Only its
/// file name is kept, looked up in the attachments folder next to the database
/// (or, for databases moved away from the default location, the one in the app
/// config folder), and it must be a regular file rather than a symlink.
pub fn resolve_attachment_file(state: &AppState, stored_path: &str) -> AppResult<Option<PathBuf>> {
    let Some(name) = Path::new(stored_path).file_name() else {
        return Ok(None);
    };
    let roots = [
        attachments_dir(state)?,
        state.config_dir.join("attachments"),
    ];
    for root in roots {
        let candidate = root.join(name);
        if std::fs::symlink_metadata(&candidate).is_ok_and(|m| m.is_file()) {
            return Ok(Some(candidate));
        }
    }
    Ok(None)
}

/// The files of every attachment of one entity.
pub fn attachment_files_of(
    conn: &Connection,
    state: &AppState,
    entity_type: &str,
    entity_id: &str,
) -> AppResult<Vec<PathBuf>> {
    let stored_paths: Vec<String> = conn
        .prepare("SELECT stored_path FROM attachments WHERE entity_type = ?1 AND entity_id = ?2")?
        .query_map([entity_type, entity_id], |row| row.get(0))?
        .collect::<Result<_, _>>()?;
    let mut files = Vec::new();
    for stored_path in stored_paths {
        files.extend(resolve_attachment_file(state, &stored_path)?);
    }
    Ok(files)
}

/// Delete a person, company, action or project together with its notes and
/// attachments, which point at it by type and id rather than by foreign key.
/// Attachment files are removed only once the rows are gone.
pub fn delete_entity(state: &AppState, entity_type: &str, id: &str) -> AppResult<()> {
    let table = match entity_type {
        "person" => "persons",
        "company" => "companies",
        "action" => "actions",
        "project" => "projects",
        _ => {
            return Err(AppError::Other(format!(
                "unknown entity type {entity_type}"
            )))
        }
    };
    let files = {
        let mut conn = lock_db(state)?;
        let files = attachment_files_of(&conn, state, entity_type, id)?;
        let tx = conn.transaction()?;
        tx.execute(
            "DELETE FROM notes WHERE entity_type = ?1 AND entity_id = ?2",
            [entity_type, id],
        )?;
        tx.execute(
            "DELETE FROM attachments WHERE entity_type = ?1 AND entity_id = ?2",
            [entity_type, id],
        )?;
        tx.execute(&format!("DELETE FROM {table} WHERE id = ?1"), [id])?;
        tx.commit()?;
        files
    };
    for file in files {
        let _ = std::fs::remove_file(file);
    }
    Ok(())
}

// ─── List attachments for an entity ──────────────────────────────────────────

#[tauri::command(async)]
pub fn list_attachments(
    state: State<AppState>,
    entity_type: String,
    entity_id: String,
) -> AppResult<Vec<Attachment>> {
    let db = lock_db(&state)?;
    let mut stmt = db.prepare(
        "SELECT id, entity_type, entity_id, file_name, stored_path, mime_type, size_bytes, created_at
         FROM attachments
         WHERE entity_type = ?1 AND entity_id = ?2
         ORDER BY created_at DESC",
    )?;
    let attachments = stmt
        .query_map(rusqlite::params![entity_type, entity_id], |row| {
            Ok(Attachment {
                id: row.get(0)?,
                entity_type: row.get(1)?,
                entity_id: row.get(2)?,
                file_name: row.get(3)?,
                stored_path: row.get(4)?,
                mime_type: row.get(5)?,
                size_bytes: row.get(6)?,
                created_at: row.get(7)?,
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(attachments)
}

// ─── Add attachment (copy file into app data dir) ────────────────────────────

#[tauri::command(async)]
pub fn add_attachment(
    app: tauri::AppHandle,
    state: State<AppState>,
    entity_type: String,
    entity_id: String,
) -> AppResult<Option<Attachment>> {
    let Some(source_path) = crate::dialogs::open_file(&app, None) else {
        return Ok(None);
    };
    let attachments_dir = attachments_dir(&state)?;
    std::fs::create_dir_all(&attachments_dir)?;

    let src = source_path.as_path();
    let file_name = src
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("file")
        .to_string();

    // Unique stored name to avoid collisions
    let id = new_uuid();
    let ext = src
        .extension()
        .and_then(|e| e.to_str())
        .map(|e| format!(".{e}"))
        .unwrap_or_default();
    let stored_name = format!("{id}{ext}");
    let stored_path = attachments_dir.join(&stored_name);

    std::fs::copy(src, &stored_path)?;

    let size_bytes = std::fs::metadata(&stored_path).ok().map(|m| m.len() as i64);
    let mime_type = mime_guess::from_path(&stored_path)
        .first()
        .map(|m| m.to_string());
    let now = now_iso();
    let stored_path_str = stored_path.to_string_lossy().to_string();

    let db = lock_db(&state)?;
    db.execute(
        "INSERT INTO attachments (id, entity_type, entity_id, file_name, stored_path, mime_type, size_bytes, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
        rusqlite::params![
            id,
            entity_type,
            entity_id,
            file_name,
            stored_path_str,
            mime_type,
            size_bytes,
            now
        ],
    )?;

    Ok(Some(Attachment {
        id,
        entity_type,
        entity_id,
        file_name,
        stored_path: stored_path_str,
        mime_type,
        size_bytes,
        created_at: now,
    }))
}

// ─── Delete attachment (remove file + DB row) ────────────────────────────────

#[tauri::command(async)]
pub fn delete_attachment(state: State<AppState>, id: String) -> AppResult<()> {
    delete_attachment_by_id(&state, &id)
}

fn delete_attachment_by_id(state: &AppState, id: &str) -> AppResult<()> {
    let db = lock_db(state)?;
    // Fetch path before deletion
    let stored_path: Option<String> = db
        .query_row(
            "SELECT stored_path FROM attachments WHERE id = ?1",
            rusqlite::params![id],
            |row| row.get(0),
        )
        .ok();

    db.execute(
        "DELETE FROM attachments WHERE id = ?1",
        rusqlite::params![id],
    )?;

    // Best-effort file removal
    if let Some(stored_path) = stored_path {
        if let Some(file) = resolve_attachment_file(state, &stored_path)? {
            let _ = std::fs::remove_file(file);
        }
    }

    Ok(())
}

// ─── Open attachment with system default app ─────────────────────────────────
// Takes an id and resolves the file server-side through resolve_attachment_file,
// rather than trusting a frontend-supplied path or the stored path itself — the
// OS should only ever be asked to open a file in the attachments folder.

#[tauri::command(async)]
pub fn open_attachment(app: tauri::AppHandle, state: State<AppState>, id: String) -> AppResult<()> {
    use tauri_plugin_opener::OpenerExt;

    let stored_path: String = {
        let db = lock_db(&state)?;
        db.query_row(
            "SELECT stored_path FROM attachments WHERE id = ?1",
            rusqlite::params![id],
            |row| row.get(0),
        )?
    };
    let file = resolve_attachment_file(&state, &stored_path)?
        .ok_or_else(|| AppError::Other("attachment file not found".into()))?;

    app.opener()
        .open_path(file.to_string_lossy(), None::<&str>)
        .map_err(|e| crate::error::AppError::Other(e.to_string()))?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::Mutex;

    fn state_in(dir: &Path) -> AppState {
        let db_path = dir.join("data").join("sapphire.db");
        std::fs::create_dir_all(db_path.parent().unwrap()).unwrap();
        let conn = crate::db::open_and_migrate(&db_path).unwrap();
        AppState {
            db: Mutex::new(conn),
            db_path,
            config_dir: dir.join("config"),
        }
    }

    fn insert_row(state: &AppState, id: &str, stored_path: &str) {
        lock_db(state)
            .unwrap()
            .execute(
                "INSERT INTO attachments (id, entity_type, entity_id, file_name, stored_path, created_at)
                 VALUES (?1, 'person', 'p1', 'resume.pdf', ?2, '2026-01-01T00:00:00Z')",
                [id, stored_path],
            )
            .unwrap();
    }

    #[test]
    fn a_stored_path_outside_the_attachments_folder_is_never_deleted() {
        let dir = tempfile::tempdir().unwrap();
        let state = state_in(dir.path());
        let victim = dir.path().join("outside.txt");
        std::fs::write(&victim, "keep me").unwrap();
        insert_row(&state, "evil", victim.to_str().unwrap());

        delete_attachment_by_id(&state, "evil").unwrap();

        assert!(victim.exists(), "a file outside attachments/ was deleted");
    }

    #[test]
    fn a_stored_path_outside_the_attachments_folder_does_not_resolve() {
        let dir = tempfile::tempdir().unwrap();
        let state = state_in(dir.path());
        let victim = dir.path().join("outside.txt");
        std::fs::write(&victim, "keep me").unwrap();

        assert_eq!(
            resolve_attachment_file(&state, victim.to_str().unwrap()).unwrap(),
            None
        );
    }

    #[test]
    fn an_attachment_is_found_by_file_name_in_the_attachments_folder() {
        let dir = tempfile::tempdir().unwrap();
        let state = state_in(dir.path());
        let stored = attachments_dir(&state).unwrap().join("abc.pdf");
        std::fs::create_dir_all(stored.parent().unwrap()).unwrap();
        std::fs::write(&stored, "pdf").unwrap();
        // A database moved from another folder still names the same file.
        let old_location = "/somewhere/else/attachments/abc.pdf";

        assert_eq!(
            resolve_attachment_file(&state, old_location).unwrap(),
            Some(stored.clone())
        );

        insert_row(&state, "a1", old_location);
        delete_attachment_by_id(&state, "a1").unwrap();
        assert!(!stored.exists());
    }

    #[cfg(unix)]
    #[test]
    fn a_symlink_in_the_attachments_folder_is_not_followed() {
        let dir = tempfile::tempdir().unwrap();
        let state = state_in(dir.path());
        let victim = dir.path().join("outside.txt");
        std::fs::write(&victim, "keep me").unwrap();
        let link = attachments_dir(&state).unwrap().join("link.pdf");
        std::fs::create_dir_all(link.parent().unwrap()).unwrap();
        std::os::unix::fs::symlink(&victim, &link).unwrap();

        assert_eq!(resolve_attachment_file(&state, "link.pdf").unwrap(), None);
    }

    #[test]
    fn deleting_a_person_removes_its_notes_and_attachment_files() {
        let dir = tempfile::tempdir().unwrap();
        let state = state_in(dir.path());
        let person_id = {
            let mut conn = lock_db(&state).unwrap();
            crate::commands::person::insert_person(
                &mut conn,
                crate::models::PersonInput {
                    first_name: "Ada".into(),
                    last_name: "Lovelace".into(),
                    ..Default::default()
                },
            )
            .unwrap()
            .id
        };
        let stored = attachments_dir(&state).unwrap().join("abc.pdf");
        std::fs::create_dir_all(stored.parent().unwrap()).unwrap();
        std::fs::write(&stored, "pdf").unwrap();
        {
            let conn = lock_db(&state).unwrap();
            conn.execute(
                "INSERT INTO attachments (id, entity_type, entity_id, file_name, stored_path, created_at)
                 VALUES ('a1', 'person', ?1, 'cv.pdf', ?2, '2026-01-01T00:00:00Z')",
                [person_id.as_str(), stored.to_str().unwrap()],
            )
            .unwrap();
            conn.execute(
                "INSERT INTO notes (id, entity_type, entity_id, content, created_at, updated_at)
                 VALUES ('n1', 'person', ?1, 'met at a fair', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z')",
                [person_id.as_str()],
            )
            .unwrap();
        }

        delete_entity(&state, "person", &person_id).unwrap();

        assert!(!stored.exists(), "the attachment file was left on disk");
        let conn = lock_db(&state).unwrap();
        let count = |sql: &str| conn.query_row(sql, [], |r| r.get::<_, i64>(0)).unwrap();
        assert_eq!(count("SELECT COUNT(*) FROM persons"), 0);
        assert_eq!(count("SELECT COUNT(*) FROM notes"), 0);
        assert_eq!(count("SELECT COUNT(*) FROM attachments"), 0);
    }
}
