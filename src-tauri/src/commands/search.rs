use serde::{Deserialize, Serialize};
use tauri::State;

use crate::db::{fold, lock_db};
use crate::{error::AppResult, AppState};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchResult {
    pub id: String,
    pub entity_type: String, // "person" | "company" | "action" | "project"
    pub title: String,
    pub subtitle: Option<String>,
}

#[tauri::command(async)]
pub fn global_search(state: State<'_, AppState>, query: String) -> AppResult<Vec<SearchResult>> {
    search(&*lock_db(&state)?, &query)
}

pub fn search(db: &rusqlite::Connection, query: &str) -> AppResult<Vec<SearchResult>> {
    // Matched with instr() on folded text: case- and accent-insensitive, and
    // `%` / `_` in the query are plain characters, not LIKE wildcards.
    let needle = fold(query.trim());
    if needle.is_empty() {
        return Ok(vec![]);
    }
    let mut results: Vec<SearchResult> = Vec::new();

    // ── Persons ──────────────────────────────────────────────────────────────
    {
        let mut stmt = db.prepare(
            "SELECT id,
                    first_name || ' ' || last_name AS full_name,
                    role,
                    department
             FROM persons
             WHERE instr(fold(first_name || ' ' || last_name), ?1) > 0
                OR instr(fold(role), ?1) > 0
                OR instr(fold(department), ?1) > 0
                OR instr(fold(professional_email), ?1) > 0
             ORDER BY full_name
             LIMIT 10",
        )?;
        let rows = stmt.query_map([&needle], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, Option<String>>(2)?,
                row.get::<_, Option<String>>(3)?,
            ))
        })?;
        for row in rows {
            let (id, name, role, dept) = row?;
            let subtitle = [role, dept]
                .into_iter()
                .flatten()
                .collect::<Vec<_>>()
                .join(" · ");
            results.push(SearchResult {
                id,
                entity_type: "person".into(),
                title: name,
                subtitle: if subtitle.is_empty() {
                    None
                } else {
                    Some(subtitle)
                },
            });
        }
    }

    // ── Companies ─────────────────────────────────────────────────────────────
    {
        let mut stmt = db.prepare(
            "SELECT id, name, sector, size
             FROM companies
             WHERE instr(fold(name), ?1) > 0
                OR instr(fold(sector), ?1) > 0
             ORDER BY name
             LIMIT 10",
        )?;
        let rows = stmt.query_map([&needle], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, Option<String>>(2)?,
                row.get::<_, Option<String>>(3)?,
            ))
        })?;
        for row in rows {
            let (id, name, sector, size) = row?;
            let subtitle = [sector, size]
                .into_iter()
                .flatten()
                .collect::<Vec<_>>()
                .join(" · ");
            results.push(SearchResult {
                id,
                entity_type: "company".into(),
                title: name,
                subtitle: if subtitle.is_empty() {
                    None
                } else {
                    Some(subtitle)
                },
            });
        }
    }

    // ── Actions ───────────────────────────────────────────────────────────────
    {
        let mut stmt = db.prepare(
            "SELECT id, title, status, scheduled_date
             FROM actions
             WHERE instr(fold(title), ?1) > 0
                OR instr(fold(status), ?1) > 0
             ORDER BY scheduled_date DESC
             LIMIT 10",
        )?;
        let rows = stmt.query_map([&needle], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, String>(3)?,
            ))
        })?;
        for row in rows {
            let (id, title, status, date) = row?;
            let date_short = date.get(..10).unwrap_or(&date).to_string();
            results.push(SearchResult {
                id,
                entity_type: "action".into(),
                title,
                subtitle: Some(format!("{status} · {date_short}")),
            });
        }
    }

    // ── Projects ──────────────────────────────────────────────────────────────
    {
        let mut stmt = db.prepare(
            "SELECT id, name, status
             FROM projects
             WHERE instr(fold(name), ?1) > 0
                OR instr(fold(status), ?1) > 0
             ORDER BY name
             LIMIT 10",
        )?;
        let rows = stmt.query_map([&needle], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
            ))
        })?;
        for row in rows {
            let (id, name, status) = row?;
            results.push(SearchResult {
                id,
                entity_type: "project".into(),
                title: name,
                subtitle: Some(status),
            });
        }
    }

    Ok(results)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::commands::company::insert_company;
    use crate::commands::person::insert_person;
    use crate::models::{CompanyInput, PersonInput};
    use crate::test_util::memory_db;

    fn titles(conn: &rusqlite::Connection, query: &str) -> Vec<String> {
        search(conn, query)
            .unwrap()
            .into_iter()
            .map(|r| r.title)
            .collect()
    }

    fn seeded() -> rusqlite::Connection {
        let mut conn = memory_db();
        insert_person(
            &mut conn,
            PersonInput {
                first_name: "Émilie".into(),
                last_name: "Adams".into(),
                ..Default::default()
            },
        )
        .unwrap();
        insert_company(
            &mut conn,
            CompanyInput {
                name: "50% Off".into(),
                ..Default::default()
            },
        )
        .unwrap();
        conn
    }

    #[test]
    fn finds_an_accented_name_as_typed() {
        assert_eq!(titles(&seeded(), "Émilie"), vec!["Émilie Adams"]);
    }

    #[test]
    fn ignores_case_and_accents() {
        let conn = seeded();
        assert_eq!(titles(&conn, "ÉMILIE"), vec!["Émilie Adams"]);
        assert_eq!(titles(&conn, "emilie"), vec!["Émilie Adams"]);
    }

    #[test]
    fn treats_percent_and_underscore_as_plain_text() {
        let conn = seeded();
        assert_eq!(titles(&conn, "50%"), vec!["50% Off"]);
        assert!(titles(&conn, "_").is_empty());
    }
}
