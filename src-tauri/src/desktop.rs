//! Native desktop integration: the menu bar, project file dialogs, recent projects and close protection.

use std::{
    fs,
    path::{Path, PathBuf},
    sync::atomic::{AtomicBool, Ordering},
};

use serde::Serialize;
use tauri::{
    menu::{Menu, MenuBuilder, MenuItemBuilder, PredefinedMenuItem, SubmenuBuilder},
    Emitter, Manager, Wry,
};
use tauri_plugin_dialog::DialogExt;

const MAX_RECENT: usize = 8;

/// True while the open project has changes that are not in a saved project file.
#[derive(Default)]
pub struct Dirty(pub AtomicBool);

#[derive(Serialize)]
pub struct OpenedProject {
    path: String,
    contents: String,
}

fn recent_file(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    app.path().app_data_dir().map(|dir| dir.join("recent-projects.json")).map_err(|error| error.to_string())
}

pub fn read_recents(app: &tauri::AppHandle) -> Vec<String> {
    recent_file(app)
        .ok()
        .and_then(|path| fs::read_to_string(path).ok())
        .and_then(|text| serde_json::from_str::<Vec<String>>(&text).ok())
        .unwrap_or_default()
}

/// Puts `path` first, drops duplicates and keeps the newest MAX_RECENT.
pub fn merge_recents(existing: &[String], path: &str) -> Vec<String> {
    let mut list = vec![path.to_string()];
    list.extend(existing.iter().filter(|item| !item.eq_ignore_ascii_case(path)).cloned());
    list.truncate(MAX_RECENT);
    list
}

fn remember(app: &tauri::AppHandle, path: &str) {
    let list = merge_recents(&read_recents(app), path);
    if let Ok(file) = recent_file(app) {
        if let Some(parent) = file.parent() {
            let _ = fs::create_dir_all(parent);
        }
        let _ = fs::write(file, serde_json::to_string(&list).unwrap_or_default());
    }
    refresh_menu(app);
}

/// Native projects are always written as .pone. Anything else gets the extension appended, so a legacy .pguy file is never overwritten by Save.
pub fn with_pone_extension(path: &Path) -> PathBuf {
    if path.extension().map(|ext| ext.eq_ignore_ascii_case("pone")).unwrap_or(false) {
        path.to_path_buf()
    } else {
        let mut name = path.as_os_str().to_os_string();
        name.push(".pone");
        PathBuf::from(name)
    }
}

fn write_atomic(path: &Path, contents: &str) -> Result<(), String> {
    let temp = path.with_extension("pone.tmp");
    fs::write(&temp, contents).map_err(|error| format!("Could not write the project: {error}"))?;
    fs::rename(&temp, path).map_err(|error| format!("Could not finish saving the project: {error}"))
}

fn read_project(path: &Path) -> Result<OpenedProject, String> {
    let ext = path.extension().and_then(|e| e.to_str()).unwrap_or("").to_ascii_lowercase();
    if !["pone", "pguy", "json"].contains(&ext.as_str()) {
        return Err("Production One opens .pone projects and legacy Production Guy .pguy files.".into());
    }
    let contents = fs::read_to_string(path).map_err(|error| format!("Could not read {}: {error}", path.display()))?;
    Ok(OpenedProject { path: path.to_string_lossy().into_owned(), contents })
}

#[tauri::command]
pub async fn open_project_dialog(app: tauri::AppHandle) -> Result<Option<OpenedProject>, String> {
    let picked = app
        .dialog()
        .file()
        .set_title("Open project")
        .add_filter("Production One projects", &["pone", "pguy", "json"])
        .blocking_pick_file();
    let Some(file) = picked else { return Ok(None) };
    let path = file.into_path().map_err(|error| error.to_string())?;
    let opened = read_project(&path)?;
    remember(&app, &opened.path);
    Ok(Some(opened))
}

#[tauri::command]
pub fn open_project_path(app: tauri::AppHandle, path: String) -> Result<OpenedProject, String> {
    let opened = read_project(Path::new(&path))?;
    remember(&app, &opened.path);
    Ok(opened)
}

/// Returns the saved path, or None if the user cancelled.
#[tauri::command]
pub async fn save_project_dialog(app: tauri::AppHandle, suggested: String, contents: String) -> Result<Option<String>, String> {
    let picked = app
        .dialog()
        .file()
        .set_title("Save project as")
        .set_file_name(&suggested)
        .add_filter("Production One project", &["pone"])
        .blocking_save_file();
    let Some(file) = picked else { return Ok(None) };
    let path = with_pone_extension(&file.into_path().map_err(|error| error.to_string())?);
    write_atomic(&path, &contents)?;
    let saved = path.to_string_lossy().into_owned();
    remember(&app, &saved);
    Ok(Some(saved))
}

#[tauri::command]
pub fn save_project_path(app: tauri::AppHandle, path: String, contents: String) -> Result<String, String> {
    let target = PathBuf::from(&path);
    if with_pone_extension(&target) != target {
        return Err("Save writes only .pone files. Use Save As to convert a legacy project.".into());
    }
    write_atomic(&target, &contents)?;
    remember(&app, &path);
    Ok(path)
}

#[tauri::command]
pub fn recent_projects(app: tauri::AppHandle) -> Vec<String> {
    read_recents(&app).into_iter().filter(|path| Path::new(path).exists()).collect()
}

#[tauri::command]
pub fn set_dirty(app: tauri::AppHandle, dirty: bool) {
    app.state::<Dirty>().0.store(dirty, Ordering::SeqCst);
}

#[tauri::command]
pub fn set_window_title(app: tauri::AppHandle, title: String) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.set_title(&title);
    }
}

#[tauri::command]
pub fn quit_app(app: tauri::AppHandle) {
    app.exit(0);
}

pub fn build_menu(app: &tauri::AppHandle) -> tauri::Result<Menu<Wry>> {
    let item = |id: &str, text: &str, accelerator: Option<&str>| {
        let mut builder = MenuItemBuilder::with_id(id, text);
        if let Some(keys) = accelerator {
            builder = builder.accelerator(keys);
        }
        builder.build(app)
    };

    let mut recent = SubmenuBuilder::new(app, "Open Recent");
    let recents: Vec<String> = read_recents(app).into_iter().filter(|path| Path::new(path).exists()).collect();
    if recents.is_empty() {
        recent = recent.item(&MenuItemBuilder::with_id("recent-none", "No recent projects").enabled(false).build(app)?);
    }
    for (index, path) in recents.iter().enumerate() {
        let name = Path::new(path).file_name().map(|n| n.to_string_lossy().into_owned()).unwrap_or_else(|| path.clone());
        recent = recent.item(&MenuItemBuilder::with_id(format!("recent:{index}"), name).build(app)?);
    }

    let file = SubmenuBuilder::new(app, "File")
        .item(&item("file-new", "New Project", Some("CmdOrCtrl+N"))?)
        .item(&item("file-open", "Open…", Some("CmdOrCtrl+O"))?)
        .item(&recent.build()?)
        .separator()
        .item(&item("file-save", "Save", Some("CmdOrCtrl+S"))?)
        .item(&item("file-save-as", "Save As…", Some("CmdOrCtrl+Shift+S"))?)
        .separator()
        .item(&item("file-import", "Import Script…", Some("CmdOrCtrl+I"))?)
        .item(&item("file-export", "Export Production Package", Some("CmdOrCtrl+E"))?)
        .separator()
        .item(&item("file-close", "Close Project", Some("CmdOrCtrl+W"))?)
        .item(&item("file-exit", "Exit", Some("Alt+F4"))?)
        .build()?;
    let edit = SubmenuBuilder::new(app, "Edit")
        .item(&PredefinedMenuItem::undo(app, None)?)
        .item(&PredefinedMenuItem::redo(app, None)?)
        .separator()
        .item(&PredefinedMenuItem::cut(app, None)?)
        .item(&PredefinedMenuItem::copy(app, None)?)
        .item(&PredefinedMenuItem::paste(app, None)?)
        .item(&PredefinedMenuItem::select_all(app, None)?)
        .build()?;
    let view = SubmenuBuilder::new(app, "View")
        .item(&item("view-zoom-in", "Zoom In", Some("CmdOrCtrl+="))?)
        .item(&item("view-zoom-out", "Zoom Out", Some("CmdOrCtrl+-"))?)
        .item(&item("view-zoom-reset", "Actual Size", Some("CmdOrCtrl+0"))?)
        .separator()
        .item(&item("view-sidebar", "Toggle Sidebar", Some("CmdOrCtrl+B"))?)
        .item(&item("view-reset-layout", "Reset Layout", None)?)
        .item(&item("view-fullscreen", "Fullscreen", Some("F11"))?)
        .build()?;
    let project = SubmenuBuilder::new(app, "Project")
        .item(&item("project-settings", "Project Settings…", Some("CmdOrCtrl+,"))?)
        .item(&item("project-inventory", "Inventory", None)?)
        .item(&item("project-audit", "Production Audit", None)?)
        .build()?;
    let tools = SubmenuBuilder::new(app, "Tools")
        .item(&item("tools-models", "Model Hub", None)?)
        .item(&item("tools-prompt", "Prompt Studio", None)?)
        .item(&item("tools-queue", "Generation Queue", None)?)
        .item(&item("tools-providers", "Provider Settings", None)?)
        .build()?;
    let window = SubmenuBuilder::new(app, "Window")
        .item(&PredefinedMenuItem::minimize(app, None)?)
        .item(&PredefinedMenuItem::maximize(app, None)?)
        .build()?;
    let help = SubmenuBuilder::new(app, "Help")
        .item(&item("help-start", "Getting Started", Some("F1"))?)
        .item(&item("help-docs", "Documentation", None)?)
        .item(&item("help-shortcuts", "Keyboard Shortcuts", Some("CmdOrCtrl+/"))?)
        .item(&item("help-trouble", "Troubleshooting", None)?)
        .item(&item("help-updates", "Check for Updates", None)?)
        .separator()
        .item(&item("help-about", "About Production One", None)?)
        .build()?;
    MenuBuilder::new(app).items(&[&file, &edit, &view, &project, &tools, &window, &help]).build()
}

/// Rebuilds the menu so Open Recent reflects the latest list.
pub fn refresh_menu(app: &tauri::AppHandle) {
    if let Ok(menu) = build_menu(app) {
        let _ = app.set_menu(menu);
    }
}

pub fn handle_menu_event(app: &tauri::AppHandle, id: &str) {
    if id == "view-fullscreen" {
        if let Some(window) = app.get_webview_window("main") {
            let fullscreen = window.is_fullscreen().unwrap_or(false);
            let _ = window.set_fullscreen(!fullscreen);
        }
        return;
    }
    if let Some(index) = id.strip_prefix("recent:").and_then(|n| n.parse::<usize>().ok()) {
        let recents: Vec<String> = read_recents(app).into_iter().filter(|path| Path::new(path).exists()).collect();
        if let Some(path) = recents.get(index) {
            let _ = app.emit("menu-open-recent", path.clone());
        }
        return;
    }
    let _ = app.emit("menu-action", id.to_string());
}

/// With unsaved changes the window asks the UI to confirm instead of closing.
pub fn handle_close_request(window: &tauri::Window, api: &tauri::CloseRequestApi) {
    if window.label() != "main" {
        return;
    }
    if window.app_handle().state::<Dirty>().0.load(Ordering::SeqCst) {
        api.prevent_close();
        let _ = window.app_handle().emit("close-requested", ());
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn recents_are_newest_first_unique_and_capped() {
        let existing: Vec<String> = (0..10).map(|n| format!("C:\\p\\{n}.pone")).collect();
        let merged = merge_recents(&existing, "C:\\P\\3.PONE");
        assert_eq!(merged[0], "C:\\P\\3.PONE");
        assert_eq!(merged.len(), MAX_RECENT);
        assert_eq!(merged.iter().filter(|p| p.eq_ignore_ascii_case("C:\\p\\3.pone")).count(), 1);
    }

    #[test]
    fn save_never_targets_a_legacy_extension() {
        assert_eq!(with_pone_extension(Path::new("a.pone")), PathBuf::from("a.pone"));
        assert_eq!(with_pone_extension(Path::new("a.PONE")), PathBuf::from("a.PONE"));
        assert_eq!(with_pone_extension(Path::new("old.pguy")), PathBuf::from("old.pguy.pone"));
    }

    #[test]
    fn reads_only_project_extensions_and_round_trips_a_file() {
        let dir = std::env::temp_dir().join(format!("production-one-test-{}", std::process::id()));
        fs::create_dir_all(&dir).unwrap();
        let good = dir.join("film.pone");
        write_atomic(&good, "{\"format\":\"production-one-project\"}").unwrap();
        assert!(read_project(&good).unwrap().contents.contains("production-one-project"));
        let bad = dir.join("film.exe");
        fs::write(&bad, "x").unwrap();
        assert!(read_project(&bad).is_err());
        let _ = fs::remove_dir_all(dir);
    }
}
