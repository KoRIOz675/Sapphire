use rusqlite::{params, Connection, OptionalExtension, Row};
use tauri::State;

use crate::db::{load_link_map, load_links, new_uuid, now_iso};
use crate::error::{AppError, AppResult};
use crate::models::{Person, PersonInput};
use crate::AppState;

const SECONDARY_SOURCES_SQL: &str =
    "SELECT source_id FROM person_secondary_sources WHERE person_id = ?1";

/// Secondary sources are filled in by the caller.
fn row_to_person(row: &Row) -> rusqlite::Result<Person> {
    let other_emails_raw: Option<String> = row.get("other_emails")?;
    let other_emails = other_emails_raw
        .and_then(|s| serde_json::from_str::<Vec<String>>(&s).ok())
        .unwrap_or_default();

    Ok(Person {
        id: row.get("id")?,
        first_name: row.get("first_name")?,
        last_name: row.get("last_name")?,
        department: row.get("department")?,
        role: row.get("role")?,
        mobile_phone: row.get("mobile_phone")?,
        professional_email: row.get("professional_email")?,
        other_emails,
        additional_information: row.get("additional_information")?,
        circle_of_relation: row.get("circle_of_relation")?,
        birthday: row.get("birthday")?,
        current_company_id: row.get("current_company_id")?,
        primary_source_id: row.get("primary_source_id")?,
        direct_manager_id: row.get("direct_manager_id")?,
        secondary_source_ids: vec![],
        created_at: row.get("created_at")?,
        updated_at: row.get("updated_at")?,
    })
}

pub fn load_all_persons(conn: &Connection) -> AppResult<Vec<Person>> {
    let mut sources = load_link_map(
        conn,
        "SELECT person_id, source_id FROM person_secondary_sources",
    )?;
    let mut stmt = conn.prepare(
        "SELECT * FROM persons ORDER BY last_name COLLATE NOCASE, first_name COLLATE NOCASE",
    )?;
    let mut persons = stmt
        .query_map([], row_to_person)?
        .collect::<Result<Vec<_>, _>>()?;
    for p in &mut persons {
        p.secondary_source_ids = sources.remove(&p.id).unwrap_or_default();
    }
    Ok(persons)
}

pub fn load_person(conn: &Connection, id: &str) -> AppResult<Option<Person>> {
    let mut stmt = conn.prepare("SELECT * FROM persons WHERE id = ?1")?;
    let Some(mut person) = stmt.query_row([id], row_to_person).optional()? else {
        return Ok(None);
    };
    person.secondary_source_ids = load_links(conn, SECONDARY_SOURCES_SQL, id)?;
    Ok(Some(person))
}

fn write_secondary_sources(
    conn: &Connection,
    person_id: &str,
    source_ids: &[String],
) -> AppResult<()> {
    conn.execute(
        "DELETE FROM person_secondary_sources WHERE person_id = ?1",
        [person_id],
    )?;
    let mut stmt = conn.prepare(
        "INSERT OR IGNORE INTO person_secondary_sources (person_id, source_id) VALUES (?1, ?2)",
    )?;
    for sid in source_ids {
        if sid == person_id {
            continue; // never link to self
        }
        stmt.execute(params![person_id, sid])?;
    }
    Ok(())
}

// ============================================================================
// Tauri commands
// ============================================================================

#[tauri::command(async)]
pub fn list_persons(state: State<'_, AppState>) -> AppResult<Vec<Person>> {
    let conn = state
        .db
        .lock()
        .map_err(|_| AppError::Other("db lock poisoned".into()))?;
    load_all_persons(&conn)
}

#[tauri::command(async)]
pub fn get_person(state: State<'_, AppState>, id: String) -> AppResult<Option<Person>> {
    let conn = state
        .db
        .lock()
        .map_err(|_| AppError::Other("db lock poisoned".into()))?;
    load_person(&conn, &id)
}

pub fn insert_person(conn: &mut Connection, input: PersonInput) -> AppResult<Person> {
    let tx = conn.transaction()?;
    let id = new_uuid();
    let now = now_iso();
    let other_emails_json = serde_json::to_string(&input.other_emails)?;

    tx.execute(
        "INSERT INTO persons (
            id, first_name, last_name, department, role, mobile_phone,
            professional_email, other_emails, additional_information,
            circle_of_relation, birthday, current_company_id, primary_source_id,
            direct_manager_id, created_at, updated_at
         ) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15,?16)",
        params![
            id,
            input.first_name,
            input.last_name,
            input.department,
            input.role,
            input.mobile_phone,
            input.professional_email,
            other_emails_json,
            input.additional_information,
            input.circle_of_relation,
            input.birthday,
            input.current_company_id,
            input.primary_source_id,
            input.direct_manager_id,
            now,
            now,
        ],
    )?;
    write_secondary_sources(&tx, &id, &input.secondary_source_ids)?;
    tx.commit()?;

    load_person(conn, &id)?.ok_or_else(|| AppError::Other("insert failed".into()))
}

#[tauri::command(async)]
pub fn create_person(state: State<'_, AppState>, input: PersonInput) -> AppResult<Person> {
    let mut conn = state
        .db
        .lock()
        .map_err(|_| AppError::Other("db lock poisoned".into()))?;
    insert_person(&mut conn, input)
}

#[tauri::command(async)]
pub fn update_person(
    state: State<'_, AppState>,
    id: String,
    input: PersonInput,
) -> AppResult<Person> {
    let mut conn = state
        .db
        .lock()
        .map_err(|_| AppError::Other("db lock poisoned".into()))?;
    let tx = conn.transaction()?;
    let now = now_iso();
    let other_emails_json = serde_json::to_string(&input.other_emails)?;

    tx.execute(
        "UPDATE persons SET
            first_name            = ?1,
            last_name             = ?2,
            department            = ?3,
            role                  = ?4,
            mobile_phone          = ?5,
            professional_email    = ?6,
            other_emails          = ?7,
            additional_information= ?8,
            circle_of_relation    = ?9,
            birthday              = ?10,
            current_company_id    = ?11,
            primary_source_id     = ?12,
            direct_manager_id     = ?13,
            updated_at            = ?14
         WHERE id = ?15",
        params![
            input.first_name,
            input.last_name,
            input.department,
            input.role,
            input.mobile_phone,
            input.professional_email,
            other_emails_json,
            input.additional_information,
            input.circle_of_relation,
            input.birthday,
            input.current_company_id,
            input.primary_source_id,
            input.direct_manager_id,
            now,
            id,
        ],
    )?;
    write_secondary_sources(&tx, &id, &input.secondary_source_ids)?;
    tx.commit()?;

    load_person(&conn, &id)?.ok_or_else(|| AppError::Other("person not found after update".into()))
}

#[tauri::command(async)]
pub fn delete_person(state: State<'_, AppState>, id: String) -> AppResult<()> {
    crate::commands::attachments::delete_entity(&state, "person", &id)
}
