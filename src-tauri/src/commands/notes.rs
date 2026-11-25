use rusqlite::{params, Connection, OptionalExtension};
use tauri::State;

use crate::{
    db::{lock_db, new_uuid, now_iso},
    error::AppResult,
    models::{Note, NoteInput},
    AppState,
};

fn row_to_note(row: &rusqlite::Row) -> rusqlite::Result<Note> {
    Ok(Note {
        id: row.get(0)?,
        entity_type: row.get(1)?,
        entity_id: row.get(2)?,
        content: row.get(3)?,
        created_at: row.get(4)?,
        updated_at: row.get(5)?,
    })
}

/// One note per entity.
pub fn load_note(conn: &Connection, entity_type: &str, entity_id: &str) -> AppResult<Option<Note>> {
    Ok(conn
        .query_row(
            "SELECT id, entity_type, entity_id, content, created_at, updated_at
             FROM notes
             WHERE entity_type = ?1 AND entity_id = ?2
             LIMIT 1",
            params![entity_type, entity_id],
            row_to_note,
        )
        .optional()?)
}

pub fn load_all_notes(conn: &Connection) -> AppResult<Vec<Note>> {
    let mut stmt = conn.prepare(
        "SELECT id, entity_type, entity_id, content, created_at, updated_at FROM notes ORDER BY id",
    )?;
    let notes = stmt
        .query_map([], row_to_note)?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(notes)
}

pub fn upsert_note_row(conn: &Connection, input: NoteInput) -> AppResult<Note> {
    let now = now_iso();

    if let Some(existing) = load_note(conn, &input.entity_type, &input.entity_id)? {
        conn.execute(
            "UPDATE notes SET content = ?1, updated_at = ?2 WHERE id = ?3",
            params![input.content, now, existing.id],
        )?;
        return Ok(Note {
            content: input.content,
            updated_at: now,
            ..existing
        });
    }

    let id = new_uuid();
    conn.execute(
        "INSERT INTO notes (id, entity_type, entity_id, content, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        params![
            id,
            input.entity_type,
            input.entity_id,
            input.content,
            now,
            now
        ],
    )?;
    Ok(Note {
        id,
        entity_type: input.entity_type,
        entity_id: input.entity_id,
        content: input.content,
        created_at: now.clone(),
        updated_at: now,
    })
}

// ─── Commands ─────────────────────────────────────────────────────────────────

#[tauri::command(async)]
pub fn get_note(
    state: State<'_, AppState>,
    entity_type: String,
    entity_id: String,
) -> AppResult<Option<Note>> {
    load_note(&*lock_db(&state)?, &entity_type, &entity_id)
}

#[tauri::command(async)]
pub fn upsert_note(state: State<'_, AppState>, input: NoteInput) -> AppResult<Note> {
    upsert_note_row(&*lock_db(&state)?, input)
}

#[tauri::command(async)]
pub fn delete_note(state: State<'_, AppState>, id: String) -> AppResult<()> {
    lock_db(&state)?.execute("DELETE FROM notes WHERE id = ?1", params![id])?;
    Ok(())
}
