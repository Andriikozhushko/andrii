/// Returns the first command-line argument that looks like an .andrii archive path.
/// Called on app startup so the UI can pre-load an archive when the user
/// double-clicks a .andrii file in Explorer.
#[tauri::command]
pub fn get_startup_archive_path() -> Option<String> {
    std::env::args()
        .nth(1)
        .filter(|s| s.to_lowercase().ends_with(".andrii"))
}
