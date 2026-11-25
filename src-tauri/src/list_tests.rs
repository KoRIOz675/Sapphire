//! Lists must return each record with its own links (bulk-loaded).

use crate::commands::action::{insert_action, load_all_actions};
use crate::commands::company::insert_company;
use crate::commands::person::{insert_person, load_all_persons};
use crate::commands::project::{insert_project, load_all_projects};
use crate::models::{ActionInput, CompanyInput, PersonInput, ProjectInput};
use crate::test_util::memory_db;

fn person(last: &str, sources: Vec<String>) -> PersonInput {
    PersonInput {
        first_name: "A".into(),
        last_name: last.into(),
        secondary_source_ids: sources,
        ..Default::default()
    }
}

#[test]
fn lists_return_each_record_with_its_own_links() {
    let mut conn = memory_db();
    let a = insert_person(&mut conn, person("A", vec![])).unwrap();
    let b = insert_person(&mut conn, person("B", vec![a.id.clone()])).unwrap();
    insert_person(&mut conn, person("C", vec![a.id.clone(), b.id.clone()])).unwrap();
    let acme = insert_company(
        &mut conn,
        CompanyInput {
            name: "Acme".into(),
            ..Default::default()
        },
    )
    .unwrap();
    insert_project(
        &mut conn,
        ProjectInput {
            name: "P1".into(),
            company_ids: vec![acme.id.clone()],
            ..Default::default()
        },
    )
    .unwrap();
    insert_project(
        &mut conn,
        ProjectInput {
            name: "P2".into(),
            ..Default::default()
        },
    )
    .unwrap();
    let action = |title: &str, to: Vec<String>| ActionInput {
        title: title.into(),
        status: "to do".into(),
        scheduled_date: "2026-11-18T09:00:00.000Z".into(),
        to_person_ids: to,
        ..Default::default()
    };
    insert_action(&mut conn, action("X", vec![a.id.clone(), b.id.clone()])).unwrap();
    insert_action(&mut conn, action("Y", vec![])).unwrap();

    let mut sources: Vec<(String, Vec<String>)> = load_all_persons(&conn)
        .unwrap()
        .into_iter()
        .map(|p| {
            let mut s = p.secondary_source_ids;
            s.sort();
            (p.last_name, s)
        })
        .collect();
    sources.sort();
    let mut ab = vec![a.id.clone(), b.id.clone()];
    ab.sort();
    assert_eq!(
        sources,
        vec![
            ("A".to_string(), vec![]),
            ("B".to_string(), vec![a.id.clone()]),
            ("C".to_string(), ab.clone()),
        ]
    );

    let projects: Vec<(String, Vec<String>)> = load_all_projects(&conn)
        .unwrap()
        .into_iter()
        .map(|p| (p.name, p.company_ids))
        .collect();
    assert_eq!(
        projects,
        vec![("P1".into(), vec![acme.id]), ("P2".into(), vec![])]
    );

    let mut actions: Vec<(String, Vec<String>)> = load_all_actions(&conn)
        .unwrap()
        .into_iter()
        .map(|a| {
            let mut t = a.to_person_ids;
            t.sort();
            (a.title, t)
        })
        .collect();
    actions.sort();
    assert_eq!(actions, vec![("X".into(), ab), ("Y".into(), vec![])]);
}
