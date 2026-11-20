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

/// The list without `path` (compared the way Windows compares paths). The project file itself is never touched.
pub fn without_recent(existing: &[String], path: &str) -> Vec<String> {
    existing.iter().filter(|item| !item.eq_ignore_ascii_case(path)).cloned().collect()
}

fn write_recents(app: &tauri::AppHandle, list: &[String]) {
    if let Ok(file) = recent_file(app) {
        if let Some(parent) = file.parent() {
            let _ = fs::create_dir_all(parent);
        }
        let _ = fs::write(file, serde_json::to_string(list).unwrap_or_default());
    }
    refresh_menu(app);
}

fn remember(app: &tauri::AppHandle, path: &str) {
    write_recents(app, &merge_recents(&read_recents(app), path));
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

const MEDIA_EXTENSIONS: [&str; 10] = ["png", "jpg", "jpeg", "webp", "mp3", "wav", "m4a", "flac", "mp4", "webm"];

fn assets_dir(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    app.path().app_data_dir().map(|dir| dir.join("assets")).map_err(|error| error.to_string())
}

/// The folder that travels with "<name>.pone": "<name>_files", next to it.
pub fn pictures_folder(project: &Path) -> PathBuf {
    let stem = project.file_stem().map(|s| s.to_string_lossy().into_owned()).unwrap_or_else(|| "project".into());
    project.with_file_name(format!("{stem}_files"))
}

fn is_media_path(text: &str) -> bool {
    Path::new(text).extension().and_then(|e| e.to_str()).map(|e| MEDIA_EXTENSIONS.contains(&e.to_ascii_lowercase().as_str())).unwrap_or(false)
}

fn visit_strings(value: &mut serde_json::Value, visit: &mut dyn FnMut(&mut String)) {
    match value {
        serde_json::Value::String(text) => visit(text),
        serde_json::Value::Array(items) => items.iter_mut().for_each(|item| visit_strings(item, visit)),
        serde_json::Value::Object(map) => map.values_mut().for_each(|item| visit_strings(item, visit)),
        _ => {}
    }
}

/// Copies every picture, sound and clip the project points at (and that lives in this app's assets folder) into "<name>_files" next to the project,
/// so the saved project can be moved to another computer. Existing identical files are left alone. Returns how many files the project uses.
pub fn bundle_media(assets: &Path, project: &Path, contents: &str) -> Result<usize, String> {
    let Ok(mut value) = serde_json::from_str::<serde_json::Value>(contents) else { return Ok(0) };
    let mut wanted: Vec<PathBuf> = Vec::new();
    visit_strings(&mut value, &mut |text| {
        let path = Path::new(text.as_str());
        if is_media_path(text) && path.is_absolute() && path.starts_with(assets) && path.is_file() && !wanted.iter().any(|w| w == path) {
            wanted.push(path.to_path_buf());
        }
    });
    if wanted.is_empty() { return Ok(0); }
    let folder = pictures_folder(project);
    fs::create_dir_all(&folder).map_err(|error| format!("Could not create {}: {error}", folder.display()))?;
    for source in &wanted {
        let Some(name) = source.file_name() else { continue };
        let target = folder.join(name);
        let same = fs::metadata(&target).ok().zip(fs::metadata(source).ok()).map(|(a, b)| a.len() == b.len()).unwrap_or(false);
        if !same { fs::copy(source, &target).map_err(|error| format!("Could not copy {}: {error}", source.display()))?; }
    }
    Ok(wanted.len())
}

/// When a project is opened, any picture path that does not exist on this computer is looked up in "<name>_files" next to the project. A match is copied
/// into this app's assets folder and the project is pointed at the copy. Returns the (possibly rewritten) text and how many files were relinked.
pub fn relink_media(assets: &Path, project: &Path, contents: &str) -> (String, usize) {
    let folder = pictures_folder(project);
    if !folder.is_dir() { return (contents.to_string(), 0); }
    let Ok(mut value) = serde_json::from_str::<serde_json::Value>(contents) else { return (contents.to_string(), 0) };
    let mut count = 0usize;
    visit_strings(&mut value, &mut |text| {
        let path = Path::new(text.as_str());
        if !is_media_path(text) || !path.is_absolute() || path.is_file() { return; }
        let Some(name) = path.file_name() else { return };
        let bundled = folder.join(name);
        if !bundled.is_file() { return; }
        let target = assets.join(name);
        if !target.is_file() && (fs::create_dir_all(assets).is_err() || fs::copy(&bundled, &target).is_err()) { return; }
        *text = target.to_string_lossy().into_owned();
        count += 1;
    });
    if count == 0 { return (contents.to_string(), 0); }
    (serde_json::to_string(&value).unwrap_or_else(|_| contents.to_string()), count)
}

fn relinked(app: &tauri::AppHandle, mut opened: OpenedProject) -> OpenedProject {
    if let Ok(assets) = assets_dir(app) {
        opened.contents = relink_media(&assets, Path::new(&opened.path), &opened.contents).0;
    }
    opened
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
    let opened = relinked(&app, read_project(&path)?);
    remember(&app, &opened.path);
    Ok(Some(opened))
}

#[tauri::command]
pub fn open_project_path(app: tauri::AppHandle, path: String) -> Result<OpenedProject, String> {
    let opened = relinked(&app, read_project(Path::new(&path))?);
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
    bundle_media(&assets_dir(&app)?, &path, &contents).map_err(|error| format!("The project was saved, but its pictures were not copied next to it. {error}"))?;
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
    bundle_media(&assets_dir(&app)?, &target, &contents).map_err(|error| format!("The project was saved, but its pictures were not copied next to it. {error}"))?;
    Ok(path)
}

/// Saves a text export (shot list, prompts) where the person chooses. Returns the saved path, or None if cancelled.
#[tauri::command]
pub async fn save_text_dialog(app: tauri::AppHandle, suggested: String, contents: String, extension: String) -> Result<Option<String>, String> {
    if !["csv", "md", "json", "txt"].contains(&extension.as_str()) { return Err("Unsupported export type".into()); }
    let picked = app.dialog().file().set_title("Save").set_file_name(&suggested).add_filter("Export", &[extension.as_str()]).blocking_save_file();
    let Some(file) = picked else { return Ok(None) };
    let path = file.into_path().map_err(|e| e.to_string())?;
    let path = if path.extension().map(|e| e.eq_ignore_ascii_case(&extension)).unwrap_or(false) { path } else { let mut n = path.into_os_string(); n.push(format!(".{extension}")); PathBuf::from(n) };
    fs::write(&path, contents).map_err(|e| format!("Could not save: {e}"))?;
    Ok(Some(path.to_string_lossy().into_owned()))
}

#[tauri::command]
pub fn recent_projects(app: tauri::AppHandle) -> Vec<String> {
    read_recents(&app).into_iter().filter(|path| Path::new(path).exists()).collect()
}

/// Takes one project off the recent list (and the Open Recent menu). The file on disk is not deleted. Returns the list that is left.
#[tauri::command]
pub fn forget_recent_project(app: tauri::AppHandle, path: String) -> Vec<String> {
    write_recents(&app, &without_recent(&read_recents(&app), &path));
    recent_projects(app)
}

/// Empties the recent list and the Open Recent menu. No project file is deleted.
#[tauri::command]
pub fn clear_recent_projects(app: tauri::AppHandle) -> Vec<String> {
    write_recents(&app, &[]);
    Vec::new()
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
        .item(&item("tools-local", "Local AI (Ollama, LM Studio, ComfyUI)", None)?)
        .build()?;
    let window = SubmenuBuilder::new(app, "Window")
        .item(&PredefinedMenuItem::minimize(app, None)?)
        .item(&PredefinedMenuItem::maximize(app, None)?)
        .build()?;
    let help = SubmenuBuilder::new(app, "Help")
        .item(&item("help-start", "Getting Started", Some("F1"))?)
        .item(&item("help-docs", "Documentation", None)?)
        .item(&item("help-shortcuts", "Keyboard Shortcuts", Some("CmdOrCtrl+/"))?)
        .item(&item("help-tour", "Quick Tour", None)?)
        .item(&item("help-desktop-shortcut", "Add Production One to the Desktop", None)?)
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
    fn forgetting_a_recent_project_removes_only_that_entry() {
        let existing = vec![r"C:\p\a.pone".to_string(), r"C:\p\B.pone".to_string(), r"C:\p\c.pone".to_string()];
        assert_eq!(without_recent(&existing, r"c:\P\b.PONE"), vec![r"C:\p\a.pone".to_string(), r"C:\p\c.pone".to_string()]);
        assert_eq!(without_recent(&existing, r"C:\p\missing.pone"), existing);
        assert!(without_recent(&[], "x").is_empty());
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

    #[test]
    fn pictures_travel_with_the_project_and_are_found_again_on_another_computer() {
        let root = std::env::temp_dir().join(format!("production-one-media-{}", std::process::id()));
        let _ = fs::remove_dir_all(&root);
        let here_assets = root.join("here").join("assets");
        fs::create_dir_all(&here_assets).unwrap();
        let picture = here_assets.join("venom_front_v01_yours.png");
        fs::write(&picture, b"png-bytes").unwrap();
        let outside = root.join("elsewhere.png");
        fs::write(&outside, b"not ours").unwrap();
        let project = root.join("share").join("film.pone");
        fs::create_dir_all(project.parent().unwrap()).unwrap();
        let text = serde_json::json!({ "jobs": [{ "outputPath": picture.to_string_lossy() }], "other": outside.to_string_lossy(), "note": "a.png" }).to_string();
        assert_eq!(bundle_media(&here_assets, &project, &text).unwrap(), 1);
        assert!(pictures_folder(&project).join("venom_front_v01_yours.png").is_file());
        assert!(!pictures_folder(&project).join("elsewhere.png").exists(), "only files from the app's own assets folder are copied");
        // another computer: a different assets folder, and the old path is gone
        let there_assets = root.join("there").join("assets");
        fs::remove_file(&picture).unwrap();
        let (relinked, count) = relink_media(&there_assets, &project, &text);
        assert_eq!(count, 1);
        let moved = there_assets.join("venom_front_v01_yours.png");
        assert!(moved.is_file());
        let value: serde_json::Value = serde_json::from_str(&relinked).unwrap();
        assert_eq!(value["jobs"][0]["outputPath"].as_str().unwrap(), moved.to_string_lossy());
        // a path that exists is left alone, and a project with no folder is untouched
        assert_eq!(relink_media(&there_assets, &project, &relinked).1, 0);
        assert_eq!(relink_media(&there_assets, &root.join("none.pone"), &text), (text.clone(), 0));
        let _ = fs::remove_dir_all(root);
    }
}
