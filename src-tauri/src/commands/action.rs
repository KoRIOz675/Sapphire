use rusqlite::{params, Connection, OptionalExtension, Row};
use tauri::State;

use crate::db::{load_link_map, load_links, new_uuid, now_iso};
use crate::error::{AppError, AppResult};
use crate::models::{Action, ActionInput};
use crate::AppState;

const TO_PERSONS_SQL: &str = "SELECT person_id FROM action_to_persons WHERE action_id = ?1";

/// Linked persons are filled in by the caller.
fn row_to_action(row: &Row) -> rusqlite::Result<Action> {
    Ok(Action {
        id: row.get("id")?,
        title: row.get("title")?,
        status: row.get("status")?,
        preparation: row.get("preparation")?,
        conclusion: row.get("conclusion")?,
        scheduled_date: row.get("scheduled_date")?,
        completed_date: row.get("completed_date")?,
        discussion_type: row.get("discussion_type")?,
        to_person_ids: vec![],
        created_at: row.get("created_at")?,
        updated_at: row.get("updated_at")?,
    })
}

pub fn load_all_actions(conn: &Connection) -> AppResult<Vec<Action>> {
    let mut persons = load_link_map(conn, "SELECT action_id, person_id FROM action_to_persons")?;
    let mut stmt = conn.prepare("SELECT * FROM actions ORDER BY scheduled_date DESC")?;
    let mut actions = stmt
        .query_map([], row_to_action)?
        .collect::<Result<Vec<_>, _>>()?;
    for a in &mut actions {
        a.to_person_ids = persons.remove(&a.id).unwrap_or_default();
    }
    Ok(actions)
}

pub fn load_action(conn: &Connection, id: &str) -> AppResult<Option<Action>> {
    let mut stmt = conn.prepare("SELECT * FROM actions WHERE id = ?1")?;
    let Some(mut action) = stmt.query_row([id], row_to_action).optional()? else {
        return Ok(None);
    };
    action.to_person_ids = load_links(conn, TO_PERSONS_SQL, id)?;
    Ok(Some(action))
}

fn write_to_persons(conn: &Connection, action_id: &str, person_ids: &[String]) -> AppResult<()> {
    conn.execute(
        "DELETE FROM action_to_persons WHERE action_id = ?1",
        [action_id],
    )?;
    let mut stmt = conn.prepare(
        "INSERT OR IGNORE INTO action_to_persons (action_id, person_id) VALUES (?1, ?2)",
    )?;
    for pid in person_ids {
        stmt.execute(params![action_id, pid])?;
    }
    Ok(())
}

// ============================================================================
// Tauri commands
// ============================================================================

#[tauri::command(async)]
pub fn list_actions(state: State<'_, AppState>) -> AppResult<Vec<Action>> {
    let conn = state
        .db
        .lock()
        .map_err(|_| AppError::Other("db lock poisoned".into()))?;
    load_all_actions(&conn)
}

#[tauri::command(async)]
pub fn get_action(state: State<'_, AppState>, id: String) -> AppResult<Option<Action>> {
    let conn = state
        .db
        .lock()
        .map_err(|_| AppError::Other("db lock poisoned".into()))?;
    load_action(&conn, &id)
}

pub fn insert_action(conn: &mut Connection, input: ActionInput) -> AppResult<Action> {
    let tx = conn.transaction()?;
    let id = new_uuid();
    let now = now_iso();

    tx.execute(
        "INSERT INTO actions (
            id, title, status, preparation, conclusion,
            scheduled_date, completed_date, discussion_type,
            created_at, updated_at
         ) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10)",
        params![
            id,
            input.title,
            input.status,
            input.preparation,
            input.conclusion,
            input.scheduled_date,
            input.completed_date,
            input.discussion_type,
            now,
            now,
        ],
    )?;
    write_to_persons(&tx, &id, &input.to_person_ids)?;
    tx.commit()?;

    load_action(conn, &id)?.ok_or_else(|| AppError::Other("insert failed".into()))
}

#[tauri::command(async)]
pub fn create_action(state: State<'_, AppState>, input: ActionInput) -> AppResult<Action> {
    let mut conn = state
        .db
        .lock()
        .map_err(|_| AppError::Other("db lock poisoned".into()))?;
    insert_action(&mut conn, input)
}

#[tauri::command(async)]
pub fn update_action(
    state: State<'_, AppState>,
    id: String,
    input: ActionInput,
) -> AppResult<Action> {
    let mut conn = state
        .db
        .lock()
        .map_err(|_| AppError::Other("db lock poisoned".into()))?;
    let tx = conn.transaction()?;
    let now = now_iso();

    tx.execute(
        "UPDATE actions SET
            title           = ?1,
            status          = ?2,
            preparation     = ?3,
            conclusion      = ?4,
            scheduled_date  = ?5,
            completed_date  = ?6,
            discussion_type = ?7,
            updated_at      = ?8
         WHERE id = ?9",
        params![
            input.title,
            input.status,
            input.preparation,
            input.conclusion,
            input.scheduled_date,
            input.completed_date,
            input.discussion_type,
            now,
            id,
        ],
    )?;
    write_to_persons(&tx, &id, &input.to_person_ids)?;
    tx.commit()?;

    load_action(&conn, &id)?.ok_or_else(|| AppError::Other("action not found after update".into()))
}

#[tauri::command(async)]
pub fn delete_action(state: State<'_, AppState>, id: String) -> AppResult<()> {
    crate::commands::attachments::delete_entity(&state, "action", &id)
}
