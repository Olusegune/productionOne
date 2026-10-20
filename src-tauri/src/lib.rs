use std::{fs, path::PathBuf};
use tauri::Manager;
use serde_json::{json, Value};
use serde::Serialize;
use image::{GenericImageView, ImageBuffer, Rgba};
use font8x8::UnicodeFonts;

const CREDENTIAL_SERVICE: &str = "Production Guy";

fn project_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    app.path().app_data_dir().map(|path| path.join("current-project.pguy.json")).map_err(|error| error.to_string())
}

fn studio_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    app.path().app_data_dir().map(|path| path.join("production-state.pguy.json")).map_err(|error| error.to_string())
}

fn read_optional(path: PathBuf) -> Result<Option<String>, String> {
    if !path.exists() { return Ok(None); }
    fs::read_to_string(path).map(Some).map_err(|error| error.to_string())
}

fn write_atomic(path: PathBuf, contents: String) -> Result<(), String> {
    let parent = path.parent().ok_or_else(|| "Invalid project data path".to_string())?;
    fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    let temporary = path.with_extension("tmp");
    fs::write(&temporary, contents).map_err(|error| error.to_string())?;
    if path.exists() { fs::remove_file(&path).map_err(|error| error.to_string())?; }
    fs::rename(temporary, path).map_err(|error| error.to_string())
}

#[tauri::command]
fn load_project(app: tauri::AppHandle) -> Result<Option<String>, String> {
    read_optional(project_path(&app)?)
}

#[tauri::command]
fn save_project(app: tauri::AppHandle, contents: String) -> Result<(), String> {
    write_atomic(project_path(&app)?, contents)
}

#[tauri::command]
fn load_studio(app: tauri::AppHandle) -> Result<Option<String>, String> { read_optional(studio_path(&app)?) }

#[tauri::command]
fn save_studio(app: tauri::AppHandle, contents: String) -> Result<(), String> { write_atomic(studio_path(&app)?, contents) }

fn credential(provider: &str) -> Result<keyring::Entry, String> {
    if !matches!(provider, "kie" | "fal" | "openai" | "google" | "openrouter") {
        return Err("Unsupported provider".to_string());
    }
    keyring::Entry::new(CREDENTIAL_SERVICE, provider).map_err(|error| error.to_string())
}

#[tauri::command]
fn credential_status(provider: String) -> Result<bool, String> {
    Ok(credential(&provider)?.get_password().is_ok())
}

#[tauri::command]
fn save_credential(provider: String, api_key: String) -> Result<(), String> {
    if api_key.trim().len() < 8 { return Err("API key is too short".to_string()); }
    credential(&provider)?.set_password(api_key.trim()).map_err(|error| error.to_string())
}

#[tauri::command]
fn delete_credential(provider: String) -> Result<(), String> {
    credential(&provider)?.delete_credential().map_err(|error| error.to_string())
}

fn kie_task_body(model: &str, prompt: &str, aspect_ratio: &str, duration: u8, generate_audio: bool) -> Value {
    json!({ "model": model, "input": { "prompt": prompt, "aspect_ratio": aspect_ratio, "duration": duration, "generate_audio": generate_audio } })
}

#[tauri::command]
async fn kie_create_task(model: String, prompt: String, aspect_ratio: String, duration: u8, generate_audio: bool) -> Result<Value, String> {
    if prompt.trim().is_empty() { return Err("Prompt is required".to_string()); }
    if !matches!(duration, 4 | 5 | 6 | 8 | 10 | 12) { return Err("Unsupported duration".to_string()); }
    let api_key = credential("kie")?.get_password().map_err(|_| "KIE credential is not configured".to_string())?;
    let response = reqwest::Client::new().post("https://api.kie.ai/api/v1/jobs/createTask")
        .bearer_auth(api_key).json(&kie_task_body(&model, &prompt, &aspect_ratio, duration, generate_audio))
        .send().await.map_err(|error| error.to_string())?;
    let status = response.status();
    let body: Value = response.json().await.map_err(|error| error.to_string())?;
    if !status.is_success() { return Err(format!("KIE request failed ({status}): {}", body.get("msg").and_then(Value::as_str).unwrap_or("unknown error"))); }
    Ok(body)
}

#[tauri::command]
async fn kie_query_task(task_id: String) -> Result<Value, String> {
    if task_id.trim().is_empty() { return Err("Task ID is required".to_string()); }
    let api_key = credential("kie")?.get_password().map_err(|_| "KIE credential is not configured".to_string())?;
    let response = reqwest::Client::new().get("https://api.kie.ai/api/v1/jobs/recordInfo")
        .bearer_auth(api_key).query(&[("taskId", task_id)])
        .send().await.map_err(|error| error.to_string())?;
    let status = response.status();
    let body: Value = response.json().await.map_err(|error| error.to_string())?;
    if !status.is_success() { return Err(format!("KIE status request failed ({status})")); }
    Ok(body)
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ImageInspection { width: u32, height: u32, format: String, file_size: u64, valid: bool, warnings: Vec<String> }

fn inspect_image_file(path: &std::path::Path) -> Result<ImageInspection, String> {
    let reader = image::ImageReader::open(path).map_err(|error| error.to_string())?.with_guessed_format().map_err(|error| error.to_string())?;
    let format = reader.format().map(|value| format!("{value:?}")).unwrap_or_else(|| "Unknown".to_string());
    let image = reader.decode().map_err(|error| error.to_string())?;
    let (width, height) = image.dimensions();
    let file_size = fs::metadata(path).map_err(|error| error.to_string())?.len();
    let mut warnings = Vec::new();
    if width < 512 || height < 512 { warnings.push("Resolution is below the 512px production minimum".to_string()); }
    if file_size == 0 { warnings.push("Image file is empty".to_string()); }
    Ok(ImageInspection { width, height, format, file_size, valid: warnings.is_empty(), warnings })
}

#[tauri::command]
fn inspect_image(path: String) -> Result<ImageInspection, String> { inspect_image_file(std::path::Path::new(&path)) }

fn draw_label_text(canvas: &mut ImageBuffer<Rgba<u8>, Vec<u8>>, text: &str, x: u32, y: u32, scale: u32) {
    let mut cursor = x;
    for character in text.chars().take(100) {
        if let Some(glyph) = font8x8::BASIC_FONTS.get(character) {
            for (row, bits) in glyph.iter().enumerate() {
                for column in 0..8 {
                    if bits & (1 << column) != 0 {
                        for sy in 0..scale { for sx in 0..scale {
                            let px = cursor + (column as u32 * scale) + sx;
                            let py = y + (row as u32 * scale) + sy;
                            if px < canvas.width() && py < canvas.height() { canvas.put_pixel(px, py, Rgba([233, 237, 240, 255])); }
                        }}
                    }
                }
            }
        }
        cursor += 9 * scale;
    }
}

#[tauri::command]
fn label_image(input_path: String, output_path: String, title: String, metadata: Vec<String>) -> Result<ImageInspection, String> {
    let source = image::open(&input_path).map_err(|error| error.to_string())?.to_rgba8();
    let panel_height = 132u32;
    let mut output = ImageBuffer::from_pixel(source.width(), source.height() + panel_height, Rgba([17, 20, 24, 255]));
    image::imageops::overlay(&mut output, &source, 0, 0);
    draw_label_text(&mut output, &title.to_uppercase(), 24, source.height() + 18, 2);
    for (index, line) in metadata.iter().take(4).enumerate() { draw_label_text(&mut output, line, 24, source.height() + 52 + index as u32 * 17, 1); }
    output.save(&output_path).map_err(|error| error.to_string())?;
    inspect_image_file(std::path::Path::new(&output_path))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![load_project, save_project, load_studio, save_studio, credential_status, save_credential, delete_credential, kie_create_task, kie_query_task, inspect_image, label_image])
        .run(tauri::generate_context!())
        .expect("failed to run Production Guy");
}

#[cfg(test)]
mod tests {
    #[test]
    fn project_filename_is_portable() {
        assert!(!"current-project.pguy.json".contains(['/', '\\']));
    }


    #[test]
    fn kie_payload_uses_verified_fields() {
        let body = super::kie_task_body("bytedance/seedance-2", "A slow push in", "16:9", 5, true);
        assert_eq!(body["model"], "bytedance/seedance-2");
        assert_eq!(body["input"]["duration"], 5);
        assert_eq!(body["input"]["generate_audio"], true);
    }


    #[test]
    fn bitmap_labels_are_drawn_without_model_text() {
        let mut canvas = image::ImageBuffer::from_pixel(160, 40, image::Rgba([17, 20, 24, 255]));
        super::draw_label_text(&mut canvas, "CHAR-001", 2, 2, 2);
        assert!(canvas.pixels().any(|pixel| pixel.0 == [233, 237, 240, 255]));
    }
}
