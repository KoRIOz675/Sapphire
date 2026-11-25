//! Background reminder thread.
//!
//! Spawned once at app startup. Every 60 seconds it queries the DB for
//! actions whose scheduled_date falls within the next `reminder_lead_time_hours`
//! hours and fires a native OS notification for each one not yet notified.
//!
//! Notified IDs are stored in the settings table with the local date they were
//! notified on, so a reminder fires once per local day, across restarts.

use std::{path::PathBuf, thread, time::Duration};

use chrono::{DateTime, Local};
use rusqlite::Connection;
use tauri::AppHandle;
use tauri_plugin_notification::NotificationExt;

use crate::commands::settings::{read_setting, write_setting};
use crate::db::{parse_timestamp, to_iso};
use crate::error::AppResult;

const CHECK_INTERVAL_SECS: u64 = 60;
const NOTIFIED_KEY: &str = "reminders_notified";

pub fn spawn_reminder_thread(app: AppHandle, db_path: PathBuf) {
    thread::spawn(move || loop {
        thread::sleep(Duration::from_secs(CHECK_INTERVAL_SECS));
        if let Err(e) = check_and_notify(&app, &db_path) {
            eprintln!("Reminder check failed: {e}");
        }
    });
}

fn check_and_notify(app: &AppHandle, db_path: &PathBuf) -> AppResult<()> {
    let conn = Connection::open(db_path)?;
    conn.execute_batch("PRAGMA foreign_keys = ON;")?;
    crate::db::harden(&conn)?;

    for (title, body) in take_due_reminders(&conn, Local::now())? {
        let _ = app
            .notification()
            .builder()
            .title(&title)
            .body(&body)
            .show();
    }
    Ok(())
}

/// The reminders to show now, as (title, body). Each action is returned once per
/// local day; the ones returned are recorded as notified.
fn take_due_reminders(conn: &Connection, now: DateTime<Local>) -> AppResult<Vec<(String, String)>> {
    // The Settings page allows 1 to 720 hours; anything else comes from an
    // edited or restored database.
    let lead_hours: i64 = read_setting(conn, "reminder_lead_time_hours")?
        .and_then(|v| v.trim().parse().ok())
        .unwrap_or(24)
        .clamp(1, 720);

    let now_utc = now.with_timezone(&chrono::Utc);
    let deadline = now_utc + chrono::Duration::hours(lead_hours);

    let mut stmt = conn.prepare(
        "SELECT id, title, scheduled_date FROM actions
         WHERE status != 'done'
           AND scheduled_date >= ?1
           AND scheduled_date <= ?2
         ORDER BY scheduled_date ASC
         LIMIT 20",
    )?;
    let actions: Vec<(String, String, String)> = stmt
        .query_map([to_iso(now_utc), to_iso(deadline)], |r| {
            Ok((r.get(0)?, r.get(1)?, r.get(2)?))
        })?
        .filter_map(|r| r.ok())
        .collect();

    let today = now.format("%Y-%m-%d").to_string();
    let mut notified: Vec<String> = read_setting(conn, NOTIFIED_KEY)?
        .and_then(|v| serde_json::from_str::<serde_json::Value>(&v).ok())
        .filter(|v| v["date"] == today.as_str())
        .and_then(|v| serde_json::from_value(v["ids"].clone()).ok())
        .unwrap_or_default();

    let mut due = Vec::new();
    for (id, title, scheduled_date) in actions {
        if notified.contains(&id) {
            continue;
        }
        // Body is just the local date and time, so it reads the same in any language.
        let when = parse_timestamp(&scheduled_date)
            .map(|d| d.with_timezone(&Local).format("%Y-%m-%d %H:%M").to_string())
            .unwrap_or(scheduled_date);
        due.push((title, when));
        notified.push(id);
    }

    if !due.is_empty() {
        let record = serde_json::json!({ "date": today, "ids": notified });
        write_setting(conn, NOTIFIED_KEY, &record.to_string())?;
    }
    Ok(due)
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::TimeZone;

    fn add_action(conn: &Connection, id: &str, scheduled: DateTime<Local>) {
        conn.execute(
            "INSERT INTO actions (id, title, scheduled_date, created_at, updated_at)
             VALUES (?1, 'Call Ada', ?2, '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z')",
            [
                id.to_string(),
                to_iso(scheduled.with_timezone(&chrono::Utc)),
            ],
        )
        .unwrap();
    }

    #[test]
    fn a_reminder_fires_once_per_local_day_even_after_a_restart() {
        let conn = crate::test_util::memory_db();
        let morning = Local.with_ymd_and_hms(2026, 11, 18, 9, 0, 0).unwrap();
        add_action(&conn, "a1", morning + chrono::Duration::hours(5));

        assert_eq!(take_due_reminders(&conn, morning).unwrap().len(), 1);
        // Same day, later: already notified, also when the app restarted in between,
        // since the record is in the database.
        let later = morning + chrono::Duration::hours(2);
        assert!(take_due_reminders(&conn, later).unwrap().is_empty());
        // Next local day: fires again while the action is still pending.
        let next_day = Local.with_ymd_and_hms(2026, 11, 19, 0, 30, 0).unwrap();
        let tomorrow_action = Local.with_ymd_and_hms(2026, 11, 19, 10, 0, 0).unwrap();
        conn.execute(
            "UPDATE actions SET scheduled_date = ?1 WHERE id = 'a1'",
            [to_iso(tomorrow_action.with_timezone(&chrono::Utc))],
        )
        .unwrap();
        assert_eq!(take_due_reminders(&conn, next_day).unwrap().len(), 1);
    }

    #[test]
    fn the_body_is_the_local_date_and_time() {
        let conn = crate::test_util::memory_db();
        let now = Local.with_ymd_and_hms(2026, 11, 18, 9, 0, 0).unwrap();
        add_action(
            &conn,
            "a1",
            Local.with_ymd_and_hms(2026, 11, 18, 14, 30, 0).unwrap(),
        );

        let due = take_due_reminders(&conn, now).unwrap();

        assert_eq!(
            due,
            vec![("Call Ada".to_string(), "2026-11-18 14:30".to_string())]
        );
    }

    #[test]
    fn an_out_of_range_lead_time_does_not_panic() {
        let conn = crate::test_util::memory_db();
        write_setting(&conn, "reminder_lead_time_hours", &i64::MAX.to_string()).unwrap();

        assert!(take_due_reminders(&conn, Local::now()).is_ok());
    }
}
