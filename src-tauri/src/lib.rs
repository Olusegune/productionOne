use std::{fs, path::PathBuf};
use tauri::Manager;

fn project_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    app.path().app_data_dir().map(|path| path.join("current-project.pguy.json")).map_err(|error| error.to_string())
}

#[tauri::command]
fn load_project(app: tauri::AppHandle) -> Result<Option<String>, String> {
    let path = project_path(&app)?;
    if !path.exists() { return Ok(None); }
    fs::read_to_string(path).map(Some).map_err(|error| error.to_string())
}

#[tauri::command]
fn save_project(app: tauri::AppHandle, contents: String) -> Result<(), String> {
    let path = project_path(&app)?;
    let parent = path.parent().ok_or_else(|| "Invalid project data path".to_string())?;
    fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    let temporary = path.with_extension("tmp");
    fs::write(&temporary, contents).map_err(|error| error.to_string())?;
    if path.exists() { fs::remove_file(&path).map_err(|error| error.to_string())?; }
    fs::rename(temporary, path).map_err(|error| error.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![load_project, save_project])
        .run(tauri::generate_context!())
        .expect("failed to run Production Guy");
}

#[cfg(test)]
mod tests {
    #[test]
    fn project_filename_is_portable() {
        assert!(!"current-project.pguy.json".contains(['/', '\\']));
    }
}
