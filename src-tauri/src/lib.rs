pub mod backup;
pub mod commands;
pub mod db;
pub mod dialogs;
pub mod error;
pub mod migrations;
pub mod models;
pub mod navigation;
pub mod reminder;
pub mod startup;

#[cfg(test)]
mod list_tests;
#[cfg(test)]
pub mod test_util;

use std::sync::Mutex;

use tauri::Manager;

pub struct AppState {
    pub db: Mutex<rusqlite::Connection>,
    pub db_path: std::path::PathBuf,
    pub config_dir: std::path::PathBuf,
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(navigation::guard())
        .setup(|app| {
            let config_dir = app
                .path()
                .app_config_dir()
                .expect("could not resolve app config dir");
            std::fs::create_dir_all(&config_dir)?;

            // <app_config_dir>/sapphire.db, or the custom path from db_config.json.
            // On failure the user is asked how to recover instead of the setup
            // hook panicking, which on Windows means a silent crash.
            let Some((conn, db_path)) = startup::open_or_recover(&config_dir) else {
                std::process::exit(1);
            };

            app.manage(AppState {
                db: Mutex::new(conn),
                db_path: db_path.clone(),
                config_dir: config_dir.clone(),
            });

            // Run the initial backup (ignore errors here, UI will surface them later).
            if let Some(state) = app.try_state::<AppState>() {
                let _ = backup::run_auto_backup(state.inner());
            }

            // Spawn reminder background thread
            reminder::spawn_reminder_thread(app.handle().clone(), db_path);

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // Person
            commands::person::list_persons,
            commands::person::get_person,
            commands::person::create_person,
            commands::person::update_person,
            commands::person::delete_person,
            // Company
            commands::company::list_companies,
            commands::company::get_company,
            commands::company::create_company,
            commands::company::update_company,
            commands::company::delete_company,
            // Action
            commands::action::list_actions,
            commands::action::get_action,
            commands::action::create_action,
            commands::action::update_action,
            commands::action::delete_action,
            // Project
            commands::project::list_projects,
            commands::project::get_project,
            commands::project::create_project,
            commands::project::update_project,
            commands::project::delete_project,
            // Dashboard
            commands::dashboard::dashboard_stats,
            // Search
            commands::search::global_search,
            // Import / export
            commands::import_export::export_csv,
            commands::import_export::export_json,
            commands::import_export::import_json,
            // Settings
            commands::settings::get_setting,
            commands::settings::set_setting,
            commands::settings::get_db_path,
            commands::settings::run_backup_now,
            commands::settings::list_backups,
            commands::settings::restore_from_backup,
            commands::settings::get_custom_db_path,
            commands::settings::choose_db_folder,
            commands::settings::reset_db_path,
            // LinkedIn import
            commands::linkedin_import::import_linkedin_csv,
            // Tags
            commands::tags::list_tags,
            commands::tags::create_tag,
            commands::tags::update_tag,
            commands::tags::delete_tag,
            commands::tags::get_person_tags,
            commands::tags::set_person_tags,
            commands::tags::get_company_tags,
            commands::tags::set_company_tags,
            commands::tags::get_all_person_tag_ids,
            commands::tags::get_all_company_tag_ids,
            // Notes
            commands::notes::get_note,
            commands::notes::upsert_note,
            commands::notes::delete_note,
            // Attachments
            commands::attachments::list_attachments,
            commands::attachments::add_attachment,
            commands::attachments::delete_attachment,
            commands::attachments::open_attachment,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
