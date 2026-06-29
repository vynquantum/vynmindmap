//! VynMM Tauri shell.
//!
//! M2 keeps the Rust side intentionally thin: it hosts the bundled web UI in a
//! native window and registers the dialog + fs plugins so the frontend can open
//! and (in M3) save `.vmm` files through native OS dialogs. All mind-map logic
//! lives in the TypeScript core; Rust just provides the window and file access.

/// Read raw bytes from an absolute path (chosen via the native open dialog).
#[tauri::command]
fn read_file_bytes(path: String) -> Result<Vec<u8>, String> {
    std::fs::read(&path).map_err(|e| e.to_string())
}

/// Write raw bytes to an absolute path (chosen via the native save dialog).
#[tauri::command]
fn write_file_bytes(path: String, contents: Vec<u8>) -> Result<(), String> {
    std::fs::write(&path, &contents).map_err(|e| e.to_string())
}

/// If the app was launched by opening a `.vmm` file (file association /
/// "Open with"), return that path so the frontend can load it on startup.
#[tauri::command]
fn get_opened_file() -> Option<String> {
    std::env::args().skip(1).find(|a| {
        a.to_lowercase().ends_with(".vmm") && std::path::Path::new(a).is_file()
    })
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    use tauri::{Emitter, Manager};

    tauri::Builder::default()
        // Single-instance must be registered first: when a second launch happens
        // (e.g. double-clicking another .vmm), focus the existing window and hand
        // it the file to open instead of starting a new process.
        .plugin(tauri_plugin_single_instance::init(|app, argv, _cwd| {
            if let Some(win) = app.get_webview_window("main") {
                let _ = win.set_focus();
                let _ = win.unminimize();
            }
            if let Some(path) = argv
                .iter()
                .find(|a| a.to_lowercase().ends_with(".vmm") && std::path::Path::new(a).is_file())
            {
                let _ = app.emit("open-file", path.clone());
            }
        }))
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![
            read_file_bytes,
            write_file_bytes,
            get_opened_file
        ])
        .run(tauri::generate_context!())
        .expect("error while running VynMindMap");
}
