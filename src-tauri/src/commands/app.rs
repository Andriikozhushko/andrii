use andrii_core::format::FORMAT_VERSION;
use serde::Serialize;

/// Returns the first command-line argument that looks like an .andrii archive path.
/// Called on app startup so the UI can pre-load an archive when the user
/// double-clicks a .andrii file in Explorer.
#[tauri::command]
pub fn get_startup_archive_path() -> Option<String> {
    std::env::args()
        .nth(1)
        .filter(|s| s.to_lowercase().ends_with(".andrii"))
}

#[derive(Debug, Serialize)]
pub struct AppInfo {
    pub version: String,
    pub format_version: u16,
}

/// App + archive-format metadata for the About page.
#[tauri::command]
pub fn get_app_info() -> AppInfo {
    AppInfo {
        version: env!("CARGO_PKG_VERSION").to_string(),
        format_version: FORMAT_VERSION,
    }
}
