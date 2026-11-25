use std::collections::HashMap;

use rusqlite::{params, Connection};
use tauri::State;

use crate::{
    db::{load_link_map, lock_db, new_uuid, now_iso},
    error::AppResult,
    models::{Tag, TagInput},
    AppState,
};

fn row_to_tag(row: &rusqlite::Row) -> rusqlite::Result<Tag> {
    Ok(Tag {
        id: row.get(0)?,
        name: row.get(1)?,
        color: row.get(2)?,
        created_at: row.get(3)?,
    })
}

pub fn load_all_tags(conn: &Connection) -> AppResult<Vec<Tag>> {
    let mut stmt =
        conn.prepare("SELECT id, name, color, created_at FROM tags ORDER BY name ASC")?;
    let tags = stmt
        .query_map([], row_to_tag)?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(tags)
}

pub fn insert_tag(conn: &Connection, input: TagInput) -> AppResult<Tag> {
    let id = new_uuid();
    let now = now_iso();
    conn.execute(
        "INSERT INTO tags (id, name, color, created_at) VALUES (?1, ?2, ?3, ?4)",
        params![id, input.name, input.color, now],
    )?;
    Ok(Tag {
        id,
        name: input.name,
        color: input.color,
        created_at: now,
    })
}

pub fn replace_person_tags(
    conn: &mut Connection,
    person_id: &str,
    tag_ids: &[String],
) -> AppResult<()> {
    let tx = conn.transaction()?;
    tx.execute("DELETE FROM person_tags WHERE person_id = ?1", [person_id])?;
    {
        let mut stmt =
            tx.prepare("INSERT OR IGNORE INTO person_tags (person_id, tag_id) VALUES (?1, ?2)")?;
        for tag_id in tag_ids {
            stmt.execute(params![person_id, tag_id])?;
        }
    }
    tx.commit()?;
    Ok(())
}

pub fn replace_company_tags(
    conn: &mut Connection,
    company_id: &str,
    tag_ids: &[String],
) -> AppResult<()> {
    let tx = conn.transaction()?;
    tx.execute(
        "DELETE FROM company_tags WHERE company_id = ?1",
        [company_id],
    )?;
    {
        let mut stmt =
            tx.prepare("INSERT OR IGNORE INTO company_tags (company_id, tag_id) VALUES (?1, ?2)")?;
        for tag_id in tag_ids {
            stmt.execute(params![company_id, tag_id])?;
        }
    }
    tx.commit()?;
    Ok(())
}

pub fn load_all_person_tag_ids(conn: &Connection) -> AppResult<HashMap<String, Vec<String>>> {
    load_link_map(
        conn,
        "SELECT person_id, tag_id FROM person_tags ORDER BY person_id",
    )
}

pub fn load_all_company_tag_ids(conn: &Connection) -> AppResult<HashMap<String, Vec<String>>> {
    load_link_map(
        conn,
        "SELECT company_id, tag_id FROM company_tags ORDER BY company_id",
    )
}

// ─── Commands ─────────────────────────────────────────────────────────────────

#[tauri::command(async)]
pub fn list_tags(state: State<'_, AppState>) -> AppResult<Vec<Tag>> {
    load_all_tags(&*lock_db(&state)?)
}

#[tauri::command(async)]
pub fn create_tag(state: State<'_, AppState>, input: TagInput) -> AppResult<Tag> {
    insert_tag(&*lock_db(&state)?, input)
}

#[tauri::command(async)]
pub fn update_tag(state: State<'_, AppState>, id: String, input: TagInput) -> AppResult<Tag> {
    let db = lock_db(&state)?;
    db.execute(
        "UPDATE tags SET name = ?1, color = ?2 WHERE id = ?3",
        params![input.name, input.color, id],
    )?;
    Ok(db.query_row(
        "SELECT id, name, color, created_at FROM tags WHERE id = ?1",
        params![id],
        row_to_tag,
    )?)
}

#[tauri::command(async)]
pub fn delete_tag(state: State<'_, AppState>, id: String) -> AppResult<()> {
    lock_db(&state)?.execute("DELETE FROM tags WHERE id = ?1", params![id])?;
    Ok(())
}

#[tauri::command(async)]
pub fn get_person_tags(state: State<'_, AppState>, person_id: String) -> AppResult<Vec<Tag>> {
    let db = lock_db(&state)?;
    let mut stmt = db.prepare(
        "SELECT t.id, t.name, t.color, t.created_at
         FROM tags t
         JOIN person_tags pt ON pt.tag_id = t.id
         WHERE pt.person_id = ?1
         ORDER BY t.name ASC",
    )?;
    let tags = stmt
        .query_map(params![person_id], row_to_tag)?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(tags)
}

#[tauri::command(async)]
pub fn set_person_tags(
    state: State<'_, AppState>,
    person_id: String,
    tag_ids: Vec<String>,
) -> AppResult<()> {
    replace_person_tags(&mut *lock_db(&state)?, &person_id, &tag_ids)
}

#[tauri::command(async)]
pub fn get_company_tags(state: State<'_, AppState>, company_id: String) -> AppResult<Vec<Tag>> {
    let db = lock_db(&state)?;
    let mut stmt = db.prepare(
        "SELECT t.id, t.name, t.color, t.created_at
         FROM tags t
         JOIN company_tags ct ON ct.tag_id = t.id
         WHERE ct.company_id = ?1
         ORDER BY t.name ASC",
    )?;
    let tags = stmt
        .query_map(params![company_id], row_to_tag)?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(tags)
}

#[tauri::command(async)]
pub fn get_all_person_tag_ids(
    state: State<'_, AppState>,
) -> AppResult<HashMap<String, Vec<String>>> {
    load_all_person_tag_ids(&*lock_db(&state)?)
}

#[tauri::command(async)]
pub fn get_all_company_tag_ids(
    state: State<'_, AppState>,
) -> AppResult<HashMap<String, Vec<String>>> {
    load_all_company_tag_ids(&*lock_db(&state)?)
}

#[tauri::command(async)]
pub fn set_company_tags(
    state: State<'_, AppState>,
    company_id: String,
    tag_ids: Vec<String>,
) -> AppResult<()> {
    replace_company_tags(&mut *lock_db(&state)?, &company_id, &tag_ids)
}
