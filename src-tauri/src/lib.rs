mod commands;
mod error;

use commands::{
    analyze_password_strength, create_archive, extract_archive, get_startup_archive_path,
    open_archive, verify_archive_cmd,
};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // File drag-and-drop is handled natively by Tauri/WRY (dragDropEnabled is on
    // by default) and surfaced to the frontend via the `tauri://drag-*` events,
    // which provide absolute file paths on all platforms.
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            create_archive,
            open_archive,
            extract_archive,
            verify_archive_cmd,
            analyze_password_strength,
            get_startup_archive_path,
        ])
        .run(tauri::generate_context!())
        .expect("error while running ANDRII application");
}
