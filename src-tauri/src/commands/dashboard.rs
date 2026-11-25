use rusqlite::Connection;
use tauri::State;

use crate::commands::action::load_all_actions;
use crate::db::parse_timestamp;
use crate::error::{AppError, AppResult};
use crate::models::{Action, DashboardStats};
use crate::AppState;

fn scalar_count(conn: &Connection, sql: &str) -> AppResult<i64> {
    Ok(conn.query_row(sql, [], |r| r.get::<_, i64>(0))?)
}

#[tauri::command(async)]
pub fn dashboard_stats(state: State<'_, AppState>) -> AppResult<DashboardStats> {
    let conn = state
        .db
        .lock()
        .map_err(|_| AppError::Other("db lock poisoned".into()))?;
    compute_stats(&conn)
}

pub fn compute_stats(conn: &Connection) -> AppResult<DashboardStats> {
    let persons_count = scalar_count(conn, "SELECT COUNT(*) FROM persons")?;
    let companies_count = scalar_count(conn, "SELECT COUNT(*) FROM companies")?;
    let actions_count = scalar_count(conn, "SELECT COUNT(*) FROM actions")?;
    let projects_count = scalar_count(conn, "SELECT COUNT(*) FROM projects")?;

    let mut circle_counts = [0i64; 4];
    for circle in 1..=4i32 {
        let c = conn.query_row(
            "SELECT COUNT(*) FROM persons WHERE circle_of_relation = ?1",
            [circle],
            |r| r.get::<_, i64>(0),
        )?;
        circle_counts[(circle - 1) as usize] = c;
    }

    let all_actions = load_all_actions(conn)?;
    let now = chrono::Utc::now();
    let in_7d = now + chrono::Duration::days(7);

    // Overdue: non-done, scheduled in the past — oldest first
    let mut overdue: Vec<Action> = all_actions
        .iter()
        .filter(|a| a.status != "done")
        .filter(|a| parse_timestamp(&a.scheduled_date).is_some_and(|d| d < now))
        .cloned()
        .collect();
    overdue.sort_by(|a, b| a.scheduled_date.cmp(&b.scheduled_date));

    // Upcoming: non-done, scheduled within the next 7 days
    let upcoming: Vec<Action> = all_actions
        .iter()
        .filter(|a| a.status != "done")
        .filter(|a| parse_timestamp(&a.scheduled_date).is_some_and(|d| d >= now && d <= in_7d))
        .cloned()
        .collect();

    let stale_contacts_count = scalar_count(
        conn,
        "SELECT COUNT(*) FROM persons p
         WHERE NOT EXISTS (
             SELECT 1 FROM action_to_persons ap
             JOIN actions a ON a.id = ap.action_id
             WHERE ap.person_id = p.id
               AND a.scheduled_date >= date('now', '-90 days')
         )",
    )?;

    let overdue_actions_count = overdue.len() as i64;

    Ok(DashboardStats {
        persons_count,
        companies_count,
        actions_count,
        projects_count,
        circle_counts,
        overdue_actions: overdue,
        upcoming_actions: upcoming,
        stale_contacts_count,
        overdue_actions_count,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::test_util::memory_db;

    #[test]
    fn date_only_actions_from_older_imports_count_as_overdue() {
        let conn = memory_db();
        conn.execute(
            "INSERT INTO actions (id, title, status, scheduled_date, created_at, updated_at)
             VALUES ('a1', 'Old import', 'to do', '2020-01-15', '', '')",
            [],
        )
        .unwrap();

        let stats = compute_stats(&conn).unwrap();

        assert_eq!(stats.overdue_actions_count, 1);
        assert_eq!(stats.overdue_actions[0].id, "a1");
    }
}
