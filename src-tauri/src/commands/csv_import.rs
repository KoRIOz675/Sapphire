//! Import CSV files exported from the web CRM.
//!
//! Column headers expected (French, as exported by the web app):
//!
//! Personnes : Prénom,Nom,Département,Rôle,Entreprise,Téléphone,Email,Cercle,Source primaire
//! Entreprises: Nom,Secteur,Taille,Site web,Priorité,Nb employés
//! Actions    : N°,Titre,Statut,De,Vers,Type,Date prévue,Date réalisation,Date création
//! Projets    : Nom,Statut,Description,Entreprises,Date création
//!
//! Strategy:
//! - Skip duplicates (by name for persons/companies/projects, by title+scheduled_date for actions)
//! - Unknown references (company name, person name) → left as NULL
//! - Returns a summary: { imported, skipped, errors }

use rusqlite::params;
use serde::{Deserialize, Serialize};
use tauri::State;

use chrono::NaiveDate;

use crate::db::{local_midnight, lock_db, new_uuid, now_iso, to_iso};
use crate::error::{AppError, AppResult};
use crate::AppState;

// ── Result summary ────────────────────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportSummary {
    pub imported: usize,
    pub skipped: usize,
    pub errors: Vec<String>,
}

// ── Helper: trim a CSV field, treat empty / "—" / "-" as None ─────────────────

fn opt(s: &str) -> Option<String> {
    let s = s.trim();
    if s.is_empty() || s == "—" || s == "-" {
        None
    } else {
        Some(s.to_string())
    }
}

fn opt_i64(s: &str) -> Option<i64> {
    s.trim().parse::<i64>().ok()
}

/// Normalise a status string coming from the web CRM to the app's expected values.
fn normalise_action_status(s: &str) -> &'static str {
    match s.trim().to_lowercase().as_str() {
        "à faire" | "a faire" | "to do" | "todo" => "to do",
        "en cours" | "in progress" => "in progress",
        "terminé" | "termine" | "done" | "fait" => "done",
        _ => "to do",
    }
}

fn normalise_project_status(s: &str) -> &'static str {
    match s.trim().to_lowercase().as_str() {
        "actif" | "active" => "Active",
        "inactif" | "inactive" => "Inactive",
        _ => "Active",
    }
}

/// Read DD/MM/YYYY, DD-MM-YYYY or YYYY-MM-DD (anything after the date, such
/// as a time, is ignored). `None` for an empty or unreadable value.
fn parse_date(s: &str) -> Option<NaiveDate> {
    let s = s.trim();
    let date_part = s.split_whitespace().next()?;
    ["%d/%m/%Y", "%d-%m-%Y", "%Y-%m-%d"]
        .iter()
        .find_map(|fmt| NaiveDate::parse_from_str(date_part, fmt).ok())
}

/// A CSV date stored the way the app stores dates: local midnight as a UTC
/// RFC 3339 timestamp.
fn csv_date_to_timestamp(s: &str) -> Option<String> {
    parse_date(s).map(|d| to_iso(local_midnight(d)))
}

fn is_blank(s: &str) -> bool {
    opt(s).is_none()
}

// ── Companies ─────────────────────────────────────────────────────────────────
// Header: Nom,Secteur,Taille,Site web,Priorité,Nb employés

#[tauri::command(async)]
pub fn import_companies_csv(
    state: State<'_, AppState>,
    csv_path: String,
) -> AppResult<ImportSummary> {
    let file = std::fs::File::open(&csv_path)
        .map_err(|e| AppError::Other(format!("Cannot open CSV: {e}")))?;
    let mut conn = lock_db(&state)?;
    import_companies(&mut conn, file)
}

pub fn import_companies(
    conn: &mut rusqlite::Connection,
    input: impl std::io::Read,
) -> AppResult<ImportSummary> {
    let mut rdr = csv::ReaderBuilder::new()
        .flexible(true)
        .trim(csv::Trim::All)
        .from_reader(input);

    // One transaction for the whole file: far fewer disk syncs than one per row.
    let tx = conn.transaction()?;

    let mut summary = ImportSummary {
        imported: 0,
        skipped: 0,
        errors: vec![],
    };
    let now = now_iso();

    for (i, result) in rdr.records().enumerate() {
        let record = match result {
            Ok(r) => r,
            Err(e) => {
                summary.errors.push(format!("row {}: {e}", i + 2));
                continue;
            }
        };

        let name = match record.get(0).and_then(opt) {
            Some(n) => n,
            None => {
                summary.errors.push(format!("row {}: missing name", i + 2));
                continue;
            }
        };

        // Skip duplicate
        let exists: bool = tx
            .query_row(
                "SELECT 1 FROM companies WHERE LOWER(name) = LOWER(?1) LIMIT 1",
                params![&name],
                |_| Ok(true),
            )
            .unwrap_or(false);
        if exists {
            summary.skipped += 1;
            continue;
        }

        let sector = record.get(1).and_then(opt);
        let size = record.get(2).and_then(opt);
        let website = record.get(3).and_then(opt);
        let priority = record.get(4).and_then(opt_i64);
        let nb_emp = record.get(5).and_then(opt_i64);
        let id = new_uuid();

        // A row the database rejects is reported, not fatal.
        if let Err(e) = tx.execute(
            "INSERT INTO companies (id, name, sector, size, website, priority, number_of_employees, created_at, updated_at)
             VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9)",
            params![id, name, sector, size, website, priority, nb_emp, now, now],
        ) {
            summary.errors.push(format!("row {}: {e}", i + 2));
            continue;
        }
        summary.imported += 1;
    }

    tx.commit()?;
    Ok(summary)
}

// ── Persons ───────────────────────────────────────────────────────────────────
// Header: Prénom,Nom,Département,Rôle,Entreprise,Téléphone,Email,Cercle,Source primaire

#[tauri::command(async)]
pub fn import_persons_csv(
    state: State<'_, AppState>,
    csv_path: String,
) -> AppResult<ImportSummary> {
    let file = std::fs::File::open(&csv_path)
        .map_err(|e| AppError::Other(format!("Cannot open CSV: {e}")))?;
    let mut conn = lock_db(&state)?;
    import_persons(&mut conn, file)
}

pub fn import_persons(
    conn: &mut rusqlite::Connection,
    input: impl std::io::Read,
) -> AppResult<ImportSummary> {
    let mut rdr = csv::ReaderBuilder::new()
        .flexible(true)
        .trim(csv::Trim::All)
        .from_reader(input);

    // One transaction for the whole file: far fewer disk syncs than one per row.
    let tx = conn.transaction()?;

    let mut summary = ImportSummary {
        imported: 0,
        skipped: 0,
        errors: vec![],
    };
    let now = now_iso();

    for (i, result) in rdr.records().enumerate() {
        let record = match result {
            Ok(r) => r,
            Err(e) => {
                summary.errors.push(format!("row {}: {e}", i + 2));
                continue;
            }
        };

        let first_name = record.get(0).and_then(opt).unwrap_or_default();
        let last_name = match record.get(1).and_then(opt) {
            Some(n) => n,
            None => {
                summary
                    .errors
                    .push(format!("row {}: missing last name", i + 2));
                continue;
            }
        };

        // Skip duplicate (same first + last name)
        let exists: bool = tx
            .query_row(
                "SELECT 1 FROM persons WHERE LOWER(first_name)=LOWER(?1) AND LOWER(last_name)=LOWER(?2) LIMIT 1",
                params![&first_name, &last_name],
                |_| Ok(true),
            )
            .unwrap_or(false);
        if exists {
            summary.skipped += 1;
            continue;
        }

        let department = record.get(2).and_then(opt);
        let role = record.get(3).and_then(opt);
        let company_name = record.get(4).and_then(opt);
        let phone = record.get(5).and_then(opt);
        let email = record.get(6).and_then(opt);
        let circle = record.get(7).and_then(opt_i64);

        // Resolve company by name
        let company_id: Option<String> = if let Some(ref cn) = company_name {
            tx.query_row(
                "SELECT id FROM companies WHERE LOWER(name) = LOWER(?1) LIMIT 1",
                params![cn],
                |row| row.get(0),
            )
            .ok()
        } else {
            None
        };

        let id = new_uuid();
        // A row the database rejects is reported, not fatal.
        if let Err(e) = tx.execute(
            "INSERT INTO persons (id, first_name, last_name, department, role, mobile_phone,
             professional_email, other_emails, circle_of_relation, current_company_id, created_at, updated_at)
             VALUES (?1,?2,?3,?4,?5,?6,?7,'[]',?8,?9,?10,?11)",
            params![id, first_name, last_name, department, role, phone, email, circle, company_id, now, now],
        ) {
            summary.errors.push(format!("row {}: {e}", i + 2));
            continue;
        }
        summary.imported += 1;
    }

    tx.commit()?;
    Ok(summary)
}

// ── Actions ───────────────────────────────────────────────────────────────────
// Header: N°,Titre,Statut,De,Vers,Type,Date prévue,Date réalisation,Date création

#[tauri::command(async)]
pub fn import_actions_csv(
    state: State<'_, AppState>,
    csv_path: String,
) -> AppResult<ImportSummary> {
    let file = std::fs::File::open(&csv_path)
        .map_err(|e| AppError::Other(format!("Cannot open CSV: {e}")))?;
    let mut conn = lock_db(&state)?;
    import_actions(&mut conn, file)
}

pub fn import_actions(
    conn: &mut rusqlite::Connection,
    input: impl std::io::Read,
) -> AppResult<ImportSummary> {
    let mut rdr = csv::ReaderBuilder::new()
        .flexible(true)
        .trim(csv::Trim::All)
        .from_reader(input);

    // One transaction for the whole file: far fewer disk syncs than one per row.
    let tx = conn.transaction()?;

    let mut summary = ImportSummary {
        imported: 0,
        skipped: 0,
        errors: vec![],
    };
    let now = now_iso();

    for (i, result) in rdr.records().enumerate() {
        let record = match result {
            Ok(r) => r,
            Err(e) => {
                summary.errors.push(format!("row {}: {e}", i + 2));
                continue;
            }
        };

        // col 0 = N° (ignored), col 1 = Titre
        let title = match record.get(1).and_then(opt) {
            Some(t) => t,
            None => {
                summary.errors.push(format!("row {}: missing title", i + 2));
                continue;
            }
        };
        let status = normalise_action_status(record.get(2).unwrap_or(""));
        let _from = record.get(3).and_then(opt); // initiator — ignored (always current user)
        let to_raw = record.get(4).and_then(opt);
        let disc_type = record.get(5).and_then(opt);
        let sched_raw = record.get(6).unwrap_or("");
        // No date: schedule for today, as before. An unreadable date is an error.
        let sched_date = if is_blank(sched_raw) {
            to_iso(local_midnight(chrono::Local::now().date_naive()))
        } else {
            match csv_date_to_timestamp(sched_raw) {
                Some(d) => d,
                None => {
                    summary
                        .errors
                        .push(format!("row {}: unreadable date \"{sched_raw}\"", i + 2));
                    continue;
                }
            }
        };
        let done_date = record.get(7).and_then(csv_date_to_timestamp);

        // Skip duplicate (same title + scheduled day). Older imports stored the
        // bare date, so match that form too.
        let sched_day = parse_date(sched_raw).map(|d| d.format("%Y-%m-%d").to_string());
        let exists: bool = tx
            .query_row(
                "SELECT 1 FROM actions WHERE LOWER(title)=LOWER(?1) AND scheduled_date IN (?2, ?3) LIMIT 1",
                params![&title, &sched_date, &sched_day],
                |_| Ok(true),
            )
            .unwrap_or(false);
        if exists {
            summary.skipped += 1;
            continue;
        }

        let id = new_uuid();
        // A row the database rejects is reported, not fatal.
        if let Err(e) = tx.execute(
            "INSERT INTO actions (id, title, status, discussion_type, scheduled_date, completed_date, created_at, updated_at)
             VALUES (?1,?2,?3,?4,?5,?6,?7,?8)",
            params![id, title, status, disc_type, sched_date, done_date, now, now],
        ) {
            summary.errors.push(format!("row {}: {e}", i + 2));
            continue;
        }

        // Resolve "Vers" — may be a comma-separated list of person names
        if let Some(ref to_str) = to_raw {
            for name_raw in to_str.split(',') {
                let name = name_raw.trim();
                if name.is_empty() {
                    continue;
                }
                // Try "Prénom Nom" split
                let parts: Vec<&str> = name.splitn(2, ' ').collect();
                let person_id: Option<String> = if parts.len() == 2 {
                    tx.query_row(
                        "SELECT id FROM persons WHERE LOWER(first_name)=LOWER(?1) AND LOWER(last_name)=LOWER(?2) LIMIT 1",
                        params![parts[0], parts[1]], |row| row.get(0),
                    ).ok().or_else(|| {
                        // Try reversed: Nom Prénom
                        tx.query_row(
                            "SELECT id FROM persons WHERE LOWER(first_name)=LOWER(?1) AND LOWER(last_name)=LOWER(?2) LIMIT 1",
                            params![parts[1], parts[0]], |row| row.get(0),
                        ).ok()
                    })
                } else {
                    None
                };
                if let Some(pid) = person_id {
                    let _ = tx.execute(
                        "INSERT OR IGNORE INTO action_to_persons (action_id, person_id) VALUES (?1,?2)",
                        params![id, pid],
                    );
                }
            }
        }

        summary.imported += 1;
    }

    tx.commit()?;
    Ok(summary)
}

// ── Projects ──────────────────────────────────────────────────────────────────
// Header: Nom,Statut,Description,Entreprises,Date création

#[tauri::command(async)]
pub fn import_projects_csv(
    state: State<'_, AppState>,
    csv_path: String,
) -> AppResult<ImportSummary> {
    let file = std::fs::File::open(&csv_path)
        .map_err(|e| AppError::Other(format!("Cannot open CSV: {e}")))?;
    let mut conn = lock_db(&state)?;
    import_projects(&mut conn, file)
}

pub fn import_projects(
    conn: &mut rusqlite::Connection,
    input: impl std::io::Read,
) -> AppResult<ImportSummary> {
    let mut rdr = csv::ReaderBuilder::new()
        .flexible(true)
        .trim(csv::Trim::All)
        .from_reader(input);

    // One transaction for the whole file: far fewer disk syncs than one per row.
    let tx = conn.transaction()?;

    let mut summary = ImportSummary {
        imported: 0,
        skipped: 0,
        errors: vec![],
    };
    let now = now_iso();

    for (i, result) in rdr.records().enumerate() {
        let record = match result {
            Ok(r) => r,
            Err(e) => {
                summary.errors.push(format!("row {}: {e}", i + 2));
                continue;
            }
        };

        let name = match record.get(0).and_then(opt) {
            Some(n) => n,
            None => {
                summary.errors.push(format!("row {}: missing name", i + 2));
                continue;
            }
        };

        // Skip duplicate
        let exists: bool = tx
            .query_row(
                "SELECT 1 FROM projects WHERE LOWER(name) = LOWER(?1) LIMIT 1",
                params![&name],
                |_| Ok(true),
            )
            .unwrap_or(false);
        if exists {
            summary.skipped += 1;
            continue;
        }

        let status = normalise_project_status(record.get(1).unwrap_or(""));
        let description = record.get(2).and_then(opt);
        let companies_raw = record.get(3).and_then(opt);

        let id = new_uuid();
        // A row the database rejects is reported, not fatal.
        if let Err(e) = tx.execute(
            "INSERT INTO projects (id, name, status, description, created_at, updated_at)
             VALUES (?1,?2,?3,?4,?5,?6)",
            params![id, name, status, description, now, now],
        ) {
            summary.errors.push(format!("row {}: {e}", i + 2));
            continue;
        }

        // Resolve company names (comma-separated)
        if let Some(ref co_str) = companies_raw {
            for co_name_raw in co_str.split(',') {
                let co_name = co_name_raw.trim();
                if co_name.is_empty() {
                    continue;
                }
                let company_id: Option<String> = tx
                    .query_row(
                        "SELECT id FROM companies WHERE LOWER(name) = LOWER(?1) LIMIT 1",
                        params![co_name],
                        |row| row.get(0),
                    )
                    .ok();
                if let Some(cid) = company_id {
                    let _ = tx.execute(
                        "INSERT OR IGNORE INTO project_companies (project_id, company_id) VALUES (?1,?2)",
                        params![id, cid],
                    );
                }
            }
        }

        summary.imported += 1;
    }

    tx.commit()?;
    Ok(summary)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::commands::action::load_all_actions;
    use crate::test_util::memory_db;
    use chrono::{DateTime, Local, NaiveDate, TimeZone};

    const ACTIONS_HEADER: &str =
        "N°,Titre,Statut,De,Vers,Type,Date prévue,Date réalisation,Date création";

    fn local_midnight(y: i32, m: u32, d: u32) -> DateTime<Local> {
        let date = NaiveDate::from_ymd_opt(y, m, d).unwrap();
        Local
            .from_local_datetime(&date.and_hms_opt(0, 0, 0).unwrap())
            .earliest()
            .unwrap()
    }

    #[test]
    fn imported_action_dates_are_full_timestamps_at_local_midnight() {
        let mut conn = memory_db();
        let csv = format!("{ACTIONS_HEADER}\n1,Call Ada,à faire,,,,18/11/2026,,\n");

        let summary = import_actions(&mut conn, csv.as_bytes()).unwrap();

        assert_eq!(summary.imported, 1);
        let action = &load_all_actions(&conn).unwrap()[0];
        let stored = DateTime::parse_from_rfc3339(&action.scheduled_date)
            .expect("scheduled_date should be RFC 3339");
        assert_eq!(stored, local_midnight(2026, 11, 18));
    }

    #[test]
    fn an_unreadable_date_is_reported_instead_of_becoming_today() {
        let mut conn = memory_db();
        let csv = format!("{ACTIONS_HEADER}\n1,Call Ada,à faire,,,,next week,,\n");

        let summary = import_actions(&mut conn, csv.as_bytes()).unwrap();

        assert_eq!(summary.imported, 0);
        assert_eq!(summary.errors.len(), 1);
        assert!(load_all_actions(&conn).unwrap().is_empty());
    }

    #[test]
    fn a_row_the_database_rejects_is_reported_and_the_rest_imported() {
        let mut conn = memory_db();
        // Priority must be 1-5 (CHECK constraint): the second row fails.
        let csv = "Nom,Secteur,Taille,Site web,Priorité,Nb employés\n\
                   Acme,,,,3,\n\
                   Bad Co,,,,9,\n\
                   Zeta,,,,1,\n";

        let summary = import_companies(&mut conn, csv.as_bytes()).unwrap();

        assert_eq!(summary.imported, 2);
        assert_eq!(summary.errors.len(), 1);
        assert!(
            summary.errors[0].starts_with("row 3:"),
            "{:?}",
            summary.errors
        );
        let names: Vec<String> = crate::commands::company::load_all_companies(&conn)
            .unwrap()
            .into_iter()
            .map(|c| c.name)
            .collect();
        assert_eq!(names, vec!["Acme", "Zeta"]);
    }
}
