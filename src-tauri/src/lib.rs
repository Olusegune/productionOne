use std::{fs, path::PathBuf};
use tauri::Manager;
use serde_json::{json, Value};
use serde::{Deserialize, Serialize};
use image::{GenericImageView, ImageBuffer, Rgba};
use font8x8::UnicodeFonts;
use std::io::{Read, Write};

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
    post_kie_task("https://api.kie.ai/api/v1/jobs/createTask", &api_key, &model, &prompt, &aspect_ratio, duration, generate_audio).await
}

async fn post_kie_task(endpoint: &str, api_key: &str, model: &str, prompt: &str, aspect_ratio: &str, duration: u8, generate_audio: bool) -> Result<Value, String> {
    let response = reqwest::Client::new().post(endpoint)
        .bearer_auth(api_key).json(&kie_task_body(model, prompt, aspect_ratio, duration, generate_audio))
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

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ImportedAsset { path: String, inspection: ImageInspection }

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

#[tauri::command]
fn import_labeled_asset(app: tauri::AppHandle, image_data: Vec<u8>, file_name: String, title: String, metadata: Vec<String>) -> Result<ImportedAsset, String> {
    if image_data.is_empty() { return Err("Selected asset is empty".to_string()); }
    if image_data.len() > 50 * 1024 * 1024 { return Err("Asset exceeds the 50 MB import limit".to_string()); }
    let source = image::load_from_memory(&image_data).map_err(|error| format!("Unsupported image: {error}"))?.to_rgba8();
    let asset_dir = app.path().app_data_dir().map_err(|error| error.to_string())?.join("assets");
    fs::create_dir_all(&asset_dir).map_err(|error| error.to_string())?;
    let stem = std::path::Path::new(&file_name).file_stem().and_then(|value| value.to_str()).unwrap_or("asset");
    let safe_stem = safe_package_name(stem);
    let output_path = asset_dir.join(format!("{}_labeled.png", if safe_stem.is_empty() { "asset" } else { &safe_stem }));
    let panel_height = 132u32;
    let mut output = ImageBuffer::from_pixel(source.width(), source.height() + panel_height, Rgba([17, 20, 24, 255]));
    image::imageops::overlay(&mut output, &source, 0, 0);
    draw_label_text(&mut output, &title.to_uppercase(), 24, source.height() + 18, 2);
    for (index, line) in metadata.iter().take(4).enumerate() { draw_label_text(&mut output, line, 24, source.height() + 52 + index as u32 * 17, 1); }
    output.save(&output_path).map_err(|error| error.to_string())?;
    let inspection = inspect_image_file(&output_path)?;
    Ok(ImportedAsset { path: output_path.to_string_lossy().to_string(), inspection })
}

fn safe_package_name(value: &str) -> String {
    let cleaned: String = value.chars().map(|character| if character.is_ascii_alphanumeric() || matches!(character, '-' | '_') { character } else { '_' }).collect();
    cleaned.trim_matches('_').to_string()
}

#[derive(Deserialize)]
struct PromptArchiveEntry { name: String, contents: String }

#[tauri::command]
fn export_prompt_archive(app: tauri::AppHandle, project_name: String, entries: Vec<PromptArchiveEntry>) -> Result<String, String> {
    if entries.is_empty() { return Err("No prompts are available to export".to_string()); }
    let export_dir = app.path().document_dir().map_err(|error| error.to_string())?.join("Production Guy").join("Exports");
    fs::create_dir_all(&export_dir).map_err(|error| error.to_string())?;
    let project = safe_package_name(&project_name);
    if project.is_empty() { return Err("Project name is required".to_string()); }
    let output_path = export_dir.join(format!("{project}-prompts.zip"));
    write_prompt_archive(&output_path, &entries)?;
    Ok(output_path.to_string_lossy().to_string())
}

fn write_prompt_archive(output_path: &std::path::Path, entries: &[PromptArchiveEntry]) -> Result<(), String> {
    let file = fs::File::create(&output_path).map_err(|error| error.to_string())?;
    let mut archive = zip::ZipWriter::new(file);
    let options = zip::write::SimpleFileOptions::default().compression_method(zip::CompressionMethod::Deflated);
    for entry in entries {
        let name = safe_package_name(entry.name.trim_end_matches(".txt"));
        if name.is_empty() { continue; }
        archive.start_file(format!("prompts/{name}.txt"), options).map_err(|error| error.to_string())?;
        archive.write_all(entry.contents.as_bytes()).map_err(|error| error.to_string())?;
    }
    archive.finish().map_err(|error| error.to_string())?;
    Ok(())
}

#[tauri::command]
fn export_production_package(app: tauri::AppHandle, package_name: String, manifest: String, prompt: String, reference_paths: Vec<String>) -> Result<String, String> {
    let export_dir = app.path().document_dir().map_err(|error| error.to_string())?.join("Production Guy").join("Exports");
    fs::create_dir_all(&export_dir).map_err(|error| error.to_string())?;
    let safe_name = safe_package_name(&package_name);
    if safe_name.is_empty() { return Err("Package name is required".to_string()); }
    let output_path = export_dir.join(format!("{safe_name}.zip"));
    let file = fs::File::create(&output_path).map_err(|error| error.to_string())?;
    let mut archive = zip::ZipWriter::new(file);
    let options = zip::write::SimpleFileOptions::default().compression_method(zip::CompressionMethod::Deflated);
    archive.start_file("manifest.json", options).map_err(|error| error.to_string())?;
    archive.write_all(manifest.as_bytes()).map_err(|error| error.to_string())?;
    archive.start_file("shot-prompt.txt", options).map_err(|error| error.to_string())?;
    archive.write_all(prompt.as_bytes()).map_err(|error| error.to_string())?;
    for (index, source_path) in reference_paths.iter().enumerate() {
        let path = std::path::Path::new(source_path);
        if !path.is_file() { continue; }
        let original_name = path.file_name().and_then(|name| name.to_str()).unwrap_or("reference.bin");
        let archive_name = format!("references/{:02}_{}", index + 1, safe_package_name(original_name));
        archive.start_file(archive_name, options).map_err(|error| error.to_string())?;
        let mut source = fs::File::open(path).map_err(|error| error.to_string())?;
        let mut buffer = Vec::new(); source.read_to_end(&mut buffer).map_err(|error| error.to_string())?;
        archive.write_all(&buffer).map_err(|error| error.to_string())?;
    }
    archive.finish().map_err(|error| error.to_string())?;
    Ok(output_path.to_string_lossy().to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![load_project, save_project, load_studio, save_studio, credential_status, save_credential, delete_credential, kie_create_task, kie_query_task, inspect_image, label_image, import_labeled_asset, export_prompt_archive, export_production_package])
        .run(tauri::generate_context!())
        .expect("failed to run Production Guy");
}

#[cfg(test)]
mod tests {
    use std::io::{Read, Write};
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
    fn kie_adapter_posts_authenticated_task_to_the_verified_contract() {
        let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
        let address = listener.local_addr().unwrap();
        let server = std::thread::spawn(move || {
            let (mut stream, _) = listener.accept().unwrap();
            let mut request = [0u8; 8192];
            let length = stream.read(&mut request).unwrap();
            let request = String::from_utf8_lossy(&request[..length]);
            assert!(request.starts_with("POST /createTask HTTP/1.1"));
            assert!(request.to_ascii_lowercase().contains("authorization: bearer test-key"));
            assert!(request.contains("bytedance/seedance-2"));
            let body = r#"{"data":{"taskId":"mock-task-1"}}"#;
            write!(stream, "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}", body.len(), body).unwrap();
        });
        let result = tauri::async_runtime::block_on(super::post_kie_task(&format!("http://{address}/createTask"), "test-key", "bytedance/seedance-2", "Slow push in", "16:9", 5, true)).unwrap();
        server.join().unwrap();
        assert_eq!(result["data"]["taskId"], "mock-task-1");
    }


    #[test]
    fn bitmap_labels_are_drawn_without_model_text() {
        let mut canvas = image::ImageBuffer::from_pixel(160, 40, image::Rgba([17, 20, 24, 255]));
        super::draw_label_text(&mut canvas, "CHAR-001", 2, 2, 2);
        assert!(canvas.pixels().any(|pixel| pixel.0 == [233, 237, 240, 255]));
    }


    #[test]
    fn package_names_cannot_escape_export_directory() {
        assert_eq!(super::safe_package_name("../Scene 08: Final"), "Scene_08__Final");
    }

    #[test]
    fn prompt_zip_contains_individual_plain_text_records() {
        let path = std::env::temp_dir().join(format!("production-guy-prompts-{}.zip", std::process::id()));
        let entries = vec![super::PromptArchiveEntry { name: "CHAR-001-universal.txt".into(), contents: "A plain production prompt".into() }];
        super::write_prompt_archive(&path, &entries).unwrap();
        let file = std::fs::File::open(&path).unwrap();
        let mut archive = zip::ZipArchive::new(file).unwrap();
        let mut prompt = String::new();
        archive.by_name("prompts/CHAR-001-universal.txt").unwrap().read_to_string(&mut prompt).unwrap();
        assert_eq!(prompt, "A plain production prompt");
        drop(archive);
        std::fs::remove_file(path).unwrap();
    }
}
