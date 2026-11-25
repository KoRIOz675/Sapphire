//! Native file dialogs, run from Rust.
//!
//! Commands that read or write a user-chosen file open the dialog themselves
//! instead of taking a path from the webview, so script running in the webview
//! could never point them at an arbitrary file. Every function blocks until the
//! user answers and returns `None` on cancel; call them only from async
//! commands, which run off the main thread.

use std::path::PathBuf;

use tauri::{AppHandle, Runtime};
use tauri_plugin_dialog::{DialogExt, FilePath};

fn to_path(chosen: Option<FilePath>) -> Option<PathBuf> {
    chosen.and_then(|p| p.into_path().ok())
}

pub fn open_file<R: Runtime>(
    app: &AppHandle<R>,
    filter: Option<(&str, &[&str])>,
) -> Option<PathBuf> {
    let mut dialog = app.dialog().file();
    if let Some((name, extensions)) = filter {
        dialog = dialog.add_filter(name, extensions);
    }
    to_path(dialog.blocking_pick_file())
}

pub fn save_file<R: Runtime>(
    app: &AppHandle<R>,
    file_name: &str,
    filter: (&str, &[&str]),
) -> Option<PathBuf> {
    to_path(
        app.dialog()
            .file()
            .set_file_name(file_name)
            .add_filter(filter.0, filter.1)
            .blocking_save_file(),
    )
}

pub fn pick_folder<R: Runtime>(app: &AppHandle<R>) -> Option<PathBuf> {
    to_path(app.dialog().file().blocking_pick_folder())
}
