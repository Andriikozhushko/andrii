mod commands;
mod error;

use tauri::Emitter;
use commands::{
    analyze_password_strength, create_archive, extract_archive, get_startup_archive_path,
    open_archive, verify_archive_cmd,
};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::DragDrop(drag_event) = event {
                match drag_event {
                    tauri::DragDropEvent::Enter { paths, .. } => {
                        let strs: Vec<String> = paths
                            .iter()
                            .filter_map(|p| p.to_str().map(String::from))
                            .collect();
                        let _ = window.emit("dnd-enter", strs);
                    }
                    tauri::DragDropEvent::Drop { paths, .. } => {
                        let strs: Vec<String> = paths
                            .iter()
                            .filter_map(|p| p.to_str().map(String::from))
                            .collect();
                        let _ = window.emit("dnd-drop", strs);
                    }
                    tauri::DragDropEvent::Leave => {
                        let _ = window.emit("dnd-leave", ());
                    }
                    _ => {}
                }
            }
        })
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
