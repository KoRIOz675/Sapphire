use std::collections::HashMap;

use rusqlite::{params, Connection, OptionalExtension, Row};
use tauri::State;

use crate::db::{new_uuid, now_iso};
use crate::error::{AppError, AppResult};
use crate::models::{Company, CompanyInput};
use crate::AppState;

fn row_to_company_base(row: &Row) -> rusqlite::Result<Company> {
    Ok(Company {
        id: row.get("id")?,
        name: row.get("name")?,
        website: row.get("website")?,
        sector: row.get("sector")?,
        size: row.get("size")?,
        number_of_employees: row.get("number_of_employees")?,
        description: row.get("description")?,
        priority: row.get("priority")?,
        parent_company_id: row.get("parent_company_id")?,
        project_ids: vec![],
        created_at: row.get("created_at")?,
        updated_at: row.get("updated_at")?,
    })
}

pub fn load_all_companies(conn: &Connection) -> AppResult<Vec<Company>> {
    let mut stmt = conn.prepare("SELECT * FROM companies ORDER BY name COLLATE NOCASE")?;
    let mut companies: Vec<Company> = stmt
        .query_map([], row_to_company_base)?
        .filter_map(Result::ok)
        .collect();

    // Bulk-load project associations to avoid N+1 queries.
    let mut map: HashMap<String, Vec<String>> = HashMap::new();
    let mut pstmt = conn.prepare("SELECT company_id, project_id FROM project_companies")?;
    let rows: Vec<(String, String)> = pstmt
        .query_map([], |r| Ok((r.get::<_, String>(0)?, r.get::<_, String>(1)?)))?
        .filter_map(Result::ok)
        .collect();
    for (cid, pid) in rows {
        map.entry(cid).or_default().push(pid);
    }
    for c in &mut companies {
        if let Some(pids) = map.remove(&c.id) {
            c.project_ids = pids;
        }
    }
    Ok(companies)
}

pub fn load_company(conn: &Connection, id: &str) -> AppResult<Option<Company>> {
    let mut stmt = conn.prepare("SELECT * FROM companies WHERE id = ?1")?;
    let company = stmt.query_row([id], row_to_company_base).optional()?;
    match company {
        None => Ok(None),
        Some(mut c) => {
            let mut pstmt =
                conn.prepare("SELECT project_id FROM project_companies WHERE company_id = ?1")?;
            c.project_ids = pstmt
                .query_map([id], |r| r.get::<_, String>(0))?
                .filter_map(Result::ok)
                .collect();
            Ok(Some(c))
        }
    }
}

fn write_projects(conn: &Connection, company_id: &str, project_ids: &[String]) -> AppResult<()> {
    conn.execute(
        "DELETE FROM project_companies WHERE company_id = ?1",
        [company_id],
    )?;
    let mut stmt = conn.prepare(
        "INSERT OR IGNORE INTO project_companies (project_id, company_id) VALUES (?1, ?2)",
    )?;
    for pid in project_ids {
        stmt.execute(params![pid, company_id])?;
    }
    Ok(())
}

// ============================================================================
// Tauri commands
// ============================================================================

#[tauri::command(async)]
pub fn list_companies(state: State<'_, AppState>) -> AppResult<Vec<Company>> {
    let conn = state
        .db
        .lock()
        .map_err(|_| AppError::Other("db lock poisoned".into()))?;
    load_all_companies(&conn)
}

#[tauri::command(async)]
pub fn get_company(state: State<'_, AppState>, id: String) -> AppResult<Option<Company>> {
    let conn = state
        .db
        .lock()
        .map_err(|_| AppError::Other("db lock poisoned".into()))?;
    load_company(&conn, &id)
}

pub fn insert_company(conn: &mut Connection, input: CompanyInput) -> AppResult<Company> {
    let tx = conn.transaction()?;
    let id = new_uuid();
    let now = now_iso();

    tx.execute(
        "INSERT INTO companies (
            id, name, website, sector, size, number_of_employees,
            description, priority, parent_company_id, created_at, updated_at
         ) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11)",
        params![
            id,
            input.name,
            input.website,
            input.sector,
            input.size,
            input.number_of_employees,
            input.description,
            input.priority,
            input.parent_company_id,
            now,
            now,
        ],
    )?;
    write_projects(&tx, &id, &input.project_ids)?;
    tx.commit()?;

    load_company(conn, &id)?.ok_or_else(|| AppError::Other("insert failed".into()))
}

#[tauri::command(async)]
pub fn create_company(state: State<'_, AppState>, input: CompanyInput) -> AppResult<Company> {
    let mut conn = state
        .db
        .lock()
        .map_err(|_| AppError::Other("db lock poisoned".into()))?;
    insert_company(&mut conn, input)
}

#[tauri::command(async)]
pub fn update_company(
    state: State<'_, AppState>,
    id: String,
    input: CompanyInput,
) -> AppResult<Company> {
    let mut conn = state
        .db
        .lock()
        .map_err(|_| AppError::Other("db lock poisoned".into()))?;

    if let Some(parent) = &input.parent_company_id {
        if parent == &id {
            return Err(AppError::Other(
                "A company can't be its own parent company.".into(),
            ));
        }
    }

    let tx = conn.transaction()?;
    let now = now_iso();

    tx.execute(
        "UPDATE companies SET
            name                 = ?1,
            website              = ?2,
            sector               = ?3,
            size                 = ?4,
            number_of_employees  = ?5,
            description          = ?6,
            priority             = ?7,
            parent_company_id    = ?8,
            updated_at           = ?9
         WHERE id = ?10",
        params![
            input.name,
            input.website,
            input.sector,
            input.size,
            input.number_of_employees,
            input.description,
            input.priority,
            input.parent_company_id,
            now,
            id,
        ],
    )?;
    write_projects(&tx, &id, &input.project_ids)?;
    tx.commit()?;

    load_company(&conn, &id)?
        .ok_or_else(|| AppError::Other("company not found after update".into()))
}

#[tauri::command(async)]
pub fn delete_company(state: State<'_, AppState>, id: String) -> AppResult<()> {
    crate::commands::attachments::delete_entity(&state, "company", &id)
}
