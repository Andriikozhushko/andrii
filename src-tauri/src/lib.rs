mod commands;
mod error;

use commands::{
    analyze_password_strength, create_archive, extract_archive, open_archive, verify_archive_cmd,
};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
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
        ])
        .run(tauri::generate_context!())
        .expect("error while running ANDRII application");
}
