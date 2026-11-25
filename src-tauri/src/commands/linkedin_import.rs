use rusqlite::params;
use serde::Serialize;
use tauri::State;

use crate::db::{new_uuid, now_iso};
use crate::error::{AppError, AppResult};
use crate::AppState;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LinkedInImportSummary {
    pub total: usize,
    pub created: usize,
    pub updated: usize,
    pub skipped: usize,
    pub companies_created: usize,
}

fn normalize(s: &str) -> String {
    s.chars()
        .map(|c| match c {
            'à' | 'â' | 'ä' => 'a',
            'é' | 'è' | 'ê' | 'ë' => 'e',
            'î' | 'ï' => 'i',
            'ô' | 'ö' => 'o',
            'ù' | 'û' | 'ü' => 'u',
            'ç' => 'c',
            'ñ' => 'n',
            _ => c,
        })
        .collect::<String>()
        .to_lowercase()
}

#[tauri::command(async)]
pub fn import_linkedin_csv(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
) -> AppResult<Option<LinkedInImportSummary>> {
    let Some(path) = crate::dialogs::open_file(&app, Some(("CSV", &["csv"]))) else {
        return Ok(None);
    };
    let file = std::fs::File::open(&path).map_err(|e| AppError::Other(format!("open CSV: {e}")))?;
    let mut conn = state
        .db
        .lock()
        .map_err(|_| AppError::Other("db lock poisoned".into()))?;
    import_linkedin(&mut conn, file).map(Some)
}

pub fn import_linkedin(
    conn: &mut rusqlite::Connection,
    input: impl std::io::Read,
) -> AppResult<LinkedInImportSummary> {
    // LinkedIn's Connections.csv starts with a "Notes:" block above the real
    // header row, so the header is found by content rather than assumed to be
    // the first line.
    let mut rdr = csv::ReaderBuilder::new()
        .flexible(true)
        .has_headers(false)
        .from_reader(input);
    let mut records = rdr.records();
    let headers = loop {
        let record = records
            .next()
            .ok_or_else(|| {
                AppError::Other(
                    "No LinkedIn header row found (expected a \"First Name\" column).".into(),
                )
            })?
            .map_err(|e| AppError::Other(format!("CSV record: {e}")))?;
        let is_header = record.iter().any(|f| {
            let f = f.trim().trim_start_matches('\u{feff}');
            f == "First Name" || f == "Prénom"
        });
        if is_header {
            break record;
        }
    };

    // Collect company id/name pairs first, then build lookup map.
    let company_rows: Vec<(String, String)> = {
        let mut s = conn.prepare("SELECT id, name FROM companies")?;
        let rows: Vec<(String, String)> = s
            .query_map([], |r| Ok((r.get(0)?, r.get(1)?)))?
            .filter_map(Result::ok)
            .collect();
        rows
    };
    let mut company_map: std::collections::HashMap<String, String> = company_rows
        .into_iter()
        .map(|(id, name)| (normalize(&name), id))
        .collect();

    let col = |name: &str| -> Option<usize> {
        headers
            .iter()
            .position(|h| h.trim().trim_start_matches('\u{feff}') == name)
    };

    let first_col = col("First Name").or_else(|| col("Prénom")).unwrap_or(0);
    let last_col = col("Last Name").or_else(|| col("Nom")).unwrap_or(1);
    let email_col = col("Email Address").or_else(|| col("Email"));
    let company_col = col("Company")
        .or_else(|| col("Entreprise"))
        .or_else(|| col("Company Name"));
    let role_col = col("Position")
        .or_else(|| col("Poste"))
        .or_else(|| col("Title"));

    let mut summary = LinkedInImportSummary {
        total: 0,
        created: 0,
        updated: 0,
        skipped: 0,
        companies_created: 0,
    };

    let tx = conn.transaction()?;

    for result in records {
        let record = result.map_err(|e| AppError::Other(format!("CSV record: {e}")))?;
        summary.total += 1;

        let get = |idx: usize| record.get(idx).unwrap_or("").trim().to_string();

        let first_name = get(first_col);
        let last_name = get(last_col);
        let email = email_col.map(get).unwrap_or_default();
        let company_name = company_col.map(get).unwrap_or_default();
        let role = role_col.map(get).unwrap_or_default();

        if first_name.is_empty() && last_name.is_empty() {
            summary.skipped += 1;
            continue;
        }

        let company_id = if !company_name.is_empty() {
            let key = normalize(&company_name);
            if let Some(id) = company_map.get(&key) {
                Some(id.clone())
            } else {
                let new_id = new_uuid();
                let now = now_iso();
                tx.execute(
                    "INSERT INTO companies (id, name, created_at, updated_at)
                     VALUES (?1, ?2, ?3, ?4)",
                    params![new_id, company_name, now, now],
                )?;
                company_map.insert(key, new_id.clone());
                summary.companies_created += 1;
                Some(new_id)
            }
        } else {
            None
        };

        let existing_id: Option<String> = if !email.is_empty() {
            tx.query_row(
                "SELECT id FROM persons WHERE professional_email = ?1",
                [&email],
                |r| r.get(0),
            )
            .ok()
        } else {
            tx.query_row(
                "SELECT id FROM persons WHERE first_name = ?1 AND last_name = ?2",
                params![first_name, last_name],
                |r| r.get(0),
            )
            .ok()
        };

        let now = now_iso();
        if let Some(person_id) = existing_id {
            tx.execute(
                "UPDATE persons SET
                    role                = CASE WHEN role IS NULL OR role = '' THEN ?1 ELSE role END,
                    current_company_id  = CASE WHEN current_company_id IS NULL THEN ?2 ELSE current_company_id END,
                    updated_at          = ?3
                 WHERE id = ?4",
                params![
                    if role.is_empty() { None::<String> } else { Some(role) },
                    company_id,
                    now,
                    person_id,
                ],
            )?;
            summary.updated += 1;
        } else {
            let person_id = new_uuid();
            tx.execute(
                "INSERT INTO persons
                    (id, first_name, last_name, professional_email, role, current_company_id, created_at, updated_at)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
                params![
                    person_id,
                    first_name,
                    last_name,
                    if email.is_empty() { None::<String> } else { Some(email) },
                    if role.is_empty() { None::<String> } else { Some(role) },
                    company_id,
                    now,
                    now,
                ],
            )?;
            summary.created += 1;
        }
    }

    tx.commit()?;
    Ok(summary)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::commands::company::load_all_companies;
    use crate::commands::person::load_all_persons;
    use crate::test_util::memory_db;

    const HEADER: &str = "First Name,Last Name,URL,Email Address,Company,Position,Connected On";
    const ROW: &str = "Grace,Hopper,https://www.linkedin.com/in/x,,Navy,Rear Admiral,01 Jan 2024";

    fn people(conn: &rusqlite::Connection) -> Vec<(String, String, Option<String>)> {
        load_all_persons(conn)
            .unwrap()
            .into_iter()
            .map(|p| (p.first_name, p.last_name, p.role))
            .collect()
    }

    #[test]
    fn skips_the_notes_block_linkedin_puts_above_the_header() {
        let mut conn = memory_db();
        let csv = format!(
            "\u{feff}Notes:\n\"When exporting your connection data, you may notice that some of the email addresses are missing.\"\n\n{HEADER}\n{ROW}\n"
        );

        let summary = import_linkedin(&mut conn, csv.as_bytes()).unwrap();

        assert_eq!(summary.created, 1);
        assert_eq!(
            people(&conn),
            vec![("Grace".into(), "Hopper".into(), Some("Rear Admiral".into()))]
        );
        let companies: Vec<String> = load_all_companies(&conn)
            .unwrap()
            .into_iter()
            .map(|c| c.name)
            .collect();
        assert_eq!(companies, vec!["Navy"]);
    }

    #[test]
    fn imports_a_file_that_starts_with_the_header() {
        let mut conn = memory_db();
        let csv = format!("{HEADER}\n{ROW}\n");

        import_linkedin(&mut conn, csv.as_bytes()).unwrap();

        assert_eq!(
            people(&conn),
            vec![("Grace".into(), "Hopper".into(), Some("Rear Admiral".into()))]
        );
    }

    #[test]
    fn rejects_a_file_without_a_linkedin_header() {
        let mut conn = memory_db();

        let result = import_linkedin(&mut conn, "a,b\nc,d\n".as_bytes());

        assert!(result.is_err());
        assert!(people(&conn).is_empty());
    }
}
