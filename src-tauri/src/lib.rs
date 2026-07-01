//! VynMindMap Tauri shell.
//!
//! The Rust side is intentionally thin: it hosts the bundled web UI in a native
//! window and provides file access (open/save dialogs + read/write commands) and
//! file-association handling. All mind-map logic lives in the TypeScript core.

use std::sync::Mutex;

/// Holds a `.vmm` path the app was asked to open (used on macOS, where "open
/// file" arrives as an event rather than a launch argument).
struct OpenedFile(Mutex<Option<String>>);

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

fn vmm_from_args() -> Option<String> {
    std::env::args()
        .skip(1)
        .find(|a| a.to_lowercase().ends_with(".vmm") && std::path::Path::new(a).is_file())
}

/// The `.vmm` the app was launched to open, if any. On Windows/Linux the path
/// arrives as a launch argument; on macOS it comes via the Opened event and is
/// stashed in `OpenedFile`.
#[tauri::command]
fn get_opened_file(state: tauri::State<OpenedFile>) -> Option<String> {
    if let Some(p) = vmm_from_args() {
        return Some(p);
    }
    state.0.lock().ok().and_then(|g| g.clone())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    use tauri::{Emitter, Manager};

    let app = tauri::Builder::default()
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
        .manage(OpenedFile(Mutex::new(None)))
        .invoke_handler(tauri::generate_handler![
            read_file_bytes,
            write_file_bytes,
            get_opened_file
        ])
        .build(tauri::generate_context!())
        .expect("error while building VynMindMap");

    app.run(|app, event| {
        // macOS delivers "open this file" as an Apple Event, not a launch arg.
        #[cfg(target_os = "macos")]
        if let tauri::RunEvent::Opened { urls } = &event {
            let path = urls
                .iter()
                .filter_map(|u| u.to_file_path().ok())
                .find(|p| {
                    p.extension()
                        .map(|e| e.eq_ignore_ascii_case("vmm"))
                        .unwrap_or(false)
                })
                .and_then(|p| p.to_str().map(|s| s.to_string()));
            if let Some(path) = path {
                if let Some(st) = app.try_state::<OpenedFile>() {
                    if let Ok(mut g) = st.0.lock() {
                        *g = Some(path.clone());
                    }
                }
                if let Some(win) = app.get_webview_window("main") {
                    let _ = win.set_focus();
                }
                let _ = app.emit("open-file", path);
            }
        }
        let _ = (app, &event);
    });
}
