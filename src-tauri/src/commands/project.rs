use rusqlite::{params, Connection, OptionalExtension, Row};
use tauri::State;

use crate::db::{load_link_map, load_links, new_uuid, now_iso};
use crate::error::{AppError, AppResult};
use crate::models::{Project, ProjectInput};
use crate::AppState;

const COMPANIES_SQL: &str = "SELECT company_id FROM project_companies WHERE project_id = ?1";

/// Linked companies are filled in by the caller.
fn row_to_project(row: &Row) -> rusqlite::Result<Project> {
    Ok(Project {
        id: row.get("id")?,
        name: row.get("name")?,
        description: row.get("description")?,
        status: row.get("status")?,
        company_ids: vec![],
        created_at: row.get("created_at")?,
        updated_at: row.get("updated_at")?,
    })
}

pub fn load_all_projects(conn: &Connection) -> AppResult<Vec<Project>> {
    let mut companies =
        load_link_map(conn, "SELECT project_id, company_id FROM project_companies")?;
    let mut stmt = conn.prepare("SELECT * FROM projects ORDER BY name COLLATE NOCASE")?;
    let mut projects = stmt
        .query_map([], row_to_project)?
        .collect::<Result<Vec<_>, _>>()?;
    for p in &mut projects {
        p.company_ids = companies.remove(&p.id).unwrap_or_default();
    }
    Ok(projects)
}

pub fn load_project(conn: &Connection, id: &str) -> AppResult<Option<Project>> {
    let mut stmt = conn.prepare("SELECT * FROM projects WHERE id = ?1")?;
    let Some(mut project) = stmt.query_row([id], row_to_project).optional()? else {
        return Ok(None);
    };
    project.company_ids = load_links(conn, COMPANIES_SQL, id)?;
    Ok(Some(project))
}

fn write_companies(conn: &Connection, project_id: &str, company_ids: &[String]) -> AppResult<()> {
    conn.execute(
        "DELETE FROM project_companies WHERE project_id = ?1",
        [project_id],
    )?;
    let mut stmt = conn.prepare(
        "INSERT OR IGNORE INTO project_companies (project_id, company_id) VALUES (?1, ?2)",
    )?;
    for cid in company_ids {
        stmt.execute(params![project_id, cid])?;
    }
    Ok(())
}

// ============================================================================
// Tauri commands
// ============================================================================

#[tauri::command(async)]
pub fn list_projects(state: State<'_, AppState>) -> AppResult<Vec<Project>> {
    let conn = state
        .db
        .lock()
        .map_err(|_| AppError::Other("db lock poisoned".into()))?;
    load_all_projects(&conn)
}

#[tauri::command(async)]
pub fn get_project(state: State<'_, AppState>, id: String) -> AppResult<Option<Project>> {
    let conn = state
        .db
        .lock()
        .map_err(|_| AppError::Other("db lock poisoned".into()))?;
    load_project(&conn, &id)
}

pub fn insert_project(conn: &mut Connection, input: ProjectInput) -> AppResult<Project> {
    let tx = conn.transaction()?;
    let id = new_uuid();
    let now = now_iso();

    tx.execute(
        "INSERT INTO projects (id, name, description, status, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        params![id, input.name, input.description, input.status, now, now],
    )?;
    write_companies(&tx, &id, &input.company_ids)?;
    tx.commit()?;

    load_project(conn, &id)?.ok_or_else(|| AppError::Other("insert failed".into()))
}

#[tauri::command(async)]
pub fn create_project(state: State<'_, AppState>, input: ProjectInput) -> AppResult<Project> {
    let mut conn = state
        .db
        .lock()
        .map_err(|_| AppError::Other("db lock poisoned".into()))?;
    insert_project(&mut conn, input)
}

#[tauri::command(async)]
pub fn update_project(
    state: State<'_, AppState>,
    id: String,
    input: ProjectInput,
) -> AppResult<Project> {
    let mut conn = state
        .db
        .lock()
        .map_err(|_| AppError::Other("db lock poisoned".into()))?;
    let tx = conn.transaction()?;
    let now = now_iso();

    tx.execute(
        "UPDATE projects SET name = ?1, description = ?2, status = ?3, updated_at = ?4 WHERE id = ?5",
        params![input.name, input.description, input.status, now, id],
    )?;
    write_companies(&tx, &id, &input.company_ids)?;
    tx.commit()?;

    load_project(&conn, &id)?
        .ok_or_else(|| AppError::Other("project not found after update".into()))
}

#[tauri::command(async)]
pub fn delete_project(state: State<'_, AppState>, id: String) -> AppResult<()> {
    crate::commands::attachments::delete_entity(&state, "project", &id)
}
