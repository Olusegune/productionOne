#![allow(clippy::too_many_arguments)] // Tauri commands take each input as its own argument
mod desktop;
mod update;
mod providers;
mod kie;
mod local;
mod script_file;
mod assistant;
mod agent;
mod cleanrender;
mod comfy_install;
mod ledger;
mod voice;
mod voice_cloud;
mod suno;
mod sheet_export;
use std::{fs, path::PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use tauri::{Emitter, Manager};
use serde_json::{json, Value};
use serde::{Deserialize, Serialize};
use image::{GenericImageView, ImageBuffer, Rgba};
use font8x8::UnicodeFonts;
use std::io::{Read, Write};
use base64::Engine;

// Legacy identifier kept on purpose: renaming it would strand API keys already saved by Production Guy.
const CREDENTIAL_SERVICE: &str = "Production Guy";

fn project_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    app.path().app_data_dir().map(|path| path.join("current-project.pguy.json")).map_err(|error| error.to_string())
}

fn studio_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    app.path().app_data_dir().map(|path| path.join("production-state.pguy.json")).map_err(|error| error.to_string())
}

fn ledger_path(app: &tauri::AppHandle) -> Result<PathBuf, String> { app.path().app_data_dir().map(|path| path.join("production-ledger.sqlite")).map_err(|error| error.to_string()) }

#[tauri::command]
fn ledger_append(app: tauri::AppHandle, project_id: String, job_id: String, attempt_id: String, kind: String, provider: String, model: String, input_revision: String, request_fingerprint: String, provider_task_id: Option<String>, detail: Option<String>) -> Result<i64, String> {
    let path = ledger_path(&app)?;
    if let Some(parent) = path.parent() { fs::create_dir_all(parent).map_err(|error| error.to_string())?; }
    let connection = ledger::open(&path).map_err(|error| error.to_string())?;
    ledger::append(&connection, &ledger::LedgerEvent { id: 0, project_id, job_id, attempt_id, kind, provider, model, input_revision, request_fingerprint, provider_task_id, detail, created_at: ledger::now() }).map_err(|error| error.to_string())
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

#[tauri::command]
fn save_prompt_package(app: tauri::AppHandle, asset_id: String, contents: String) -> Result<String, String> {
    let safe_id = safe_package_name(&asset_id);
    if safe_id.is_empty() { return Err("Asset ID is required".to_string()); }
    serde_json::from_str::<Value>(&contents).map_err(|error| format!("Prompt package is not valid JSON: {error}"))?;
    let path = app.path().document_dir().map_err(|error| error.to_string())?.join("Production One").join("Prompts").join(format!("{safe_id}.json"));
    write_atomic(path.clone(), contents)?;
    if !path.is_file() || fs::metadata(&path).map_err(|error| error.to_string())?.len() == 0 { return Err("Prompt package was not written".to_string()); }
    Ok(path.to_string_lossy().to_string())
}

/// "YYYYMMDD-HHMMSS" in UTC for a Unix time. Sorts in time order, so the newest backups are the last names.
pub(crate) fn utc_stamp(secs: u64) -> String {
    let days = (secs / 86_400) as i64;
    let rem = secs % 86_400;
    // Civil date from days since 1970-01-01 (Howard Hinnant's algorithm).
    let z = days + 719_468;
    let era = z.div_euclid(146_097);
    let doe = z.rem_euclid(146_097);
    let yoe = (doe - doe / 1_460 + doe / 36_524 - doe / 146_096) / 365;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let day = doy - (153 * mp + 2) / 5 + 1;
    let month = if mp < 10 { mp + 3 } else { mp - 9 };
    let year = yoe + era * 400 + if month <= 2 { 1 } else { 0 };
    format!("{year:04}{month:02}{day:02}-{:02}{:02}{:02}", rem / 3_600, rem % 3_600 / 60, rem % 60)
}

const BACKUPS_KEPT: usize = 30;

/// True only for names this command writes ("<name>-YYYYMMDD-HHMMSS.pone"), so pruning never touches a file a person put in the folder themselves.
fn is_backup_name(file_name: &str) -> bool {
    let Some(stem) = file_name.strip_suffix(".pone") else { return false };
    let Some((_, stamp)) = stem.rsplit_once('-').and_then(|(rest, time)| rest.rsplit_once('-').map(|(name, date)| (name, format!("{date}-{time}")))) else { return false };
    let b = stamp.as_bytes();
    b.len() == 15 && b[8] == b'-' && b.iter().enumerate().all(|(i, c)| i == 8 || c.is_ascii_digit())
}

/// Keeps a copy of a production before New or Open replaces it. Returns the file written. Older backups beyond the newest 30 are removed; nothing else is touched.
#[tauri::command]
fn backup_project(app: tauri::AppHandle, title: String, contents: String) -> Result<String, String> {
    serde_json::from_str::<Value>(&contents).map_err(|error| format!("The project is not valid JSON, so it was not backed up: {error}"))?;
    let dir = app.path().document_dir().map_err(|error| error.to_string())?.join("Production One").join("Backups");
    fs::create_dir_all(&dir).map_err(|error| error.to_string())?;
    let name = safe_package_name(&title);
    let name = if name.is_empty() { "production".to_string() } else { name.chars().take(60).collect() };
    let secs = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|d| d.as_secs()).unwrap_or(0);
    let path = dir.join(format!("{name}-{}.pone", utc_stamp(secs)));
    write_atomic(path.clone(), contents)?;
    let mut all: Vec<PathBuf> = fs::read_dir(&dir).map_err(|error| error.to_string())?.filter_map(|e| e.ok()).map(|e| e.path()).filter(|p| p.file_name().and_then(|n| n.to_str()).is_some_and(is_backup_name)).collect();
    all.sort_by_key(|p| fs::metadata(p).and_then(|m| m.modified()).ok());
    while all.len() > BACKUPS_KEPT { let oldest = all.remove(0); let _ = fs::remove_file(oldest); }
    Ok(path.to_string_lossy().into_owned())
}

fn credential(provider: &str) -> Result<keyring::Entry, String> {
    if !matches!(provider, "kie" | "fal" | "openai" | "google" | "openrouter" | "elevenlabs" | "voicekiller" | "voicekiller-user") {
        return Err("Unsupported provider".to_string());
    }
    keyring::Entry::new(CREDENTIAL_SERVICE, provider).map_err(|error| error.to_string())
}

#[tauri::command]
fn credential_status(provider: String) -> Result<bool, String> {
    Ok(credential(&provider)?.get_password().is_ok())
}

/// Catches the usual paste mistakes before a key is saved and rejected later with a vague 401. Never repeats any part of the key.
fn key_shape_problem(provider: &str, key: &str) -> Option<String> {
    let wrong = |what: &str| Some(format!("This does not look like a {what}. Check you pasted the whole key under the right provider, and that nothing was added or capitalised (copying from a document can change the first letter)."));
    match provider {
        "openrouter" if !key.starts_with("sk-or-") => wrong("OpenRouter key: they start with the lowercase letters sk-or-"),
        "openai" if !key.starts_with("sk-") => wrong("OpenAI key: they start with sk-"),
        "google" if !key.starts_with("AIza") => wrong("Google Gemini key: they start with AIza"),
        "fal" if !key.contains(':') => wrong("fal.ai key: they are two parts joined by a colon (id:secret)"),
        _ if key.chars().any(|c| c.is_whitespace() || c.is_control()) => Some("The key contains a space or line break. Paste only the key itself.".to_string()),
        _ => None,
    }
}

#[tauri::command]
fn save_credential(provider: String, api_key: String) -> Result<(), String> {
    let key = api_key.trim();
    // A VoiceKiller user id is short; every real API key is longer than eight characters.
    let min = if provider == "voicekiller-user" { 1 } else { 8 };
    if key.len() < min { return Err("API key is too short".to_string()); }
    if let Some(problem) = key_shape_problem(&provider, key) { return Err(problem); }
    credential(&provider)?.set_password(key).map_err(|error| error.to_string())
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

async fn request_openai_image(endpoint: &str, api_key: &str, model: &str, prompt: &str, size: &str, quality: &str) -> Result<Vec<u8>, String> {
    if prompt.trim().is_empty() { return Err("Prompt is required".to_string()); }
    if !matches!(size, "1024x1024" | "1536x1024" | "1024x1536" | "auto") { return Err("Unsupported image size".to_string()); }
    if !matches!(quality, "low" | "medium" | "high" | "auto") { return Err("Unsupported image quality".to_string()); }
    let response = reqwest::Client::new().post(endpoint).bearer_auth(api_key).json(&json!({"model":model,"prompt":prompt,"size":size,"quality":quality,"output_format":"png"})).send().await.map_err(|error| error.to_string())?;
    let status = response.status();
    let body:Value=response.json().await.map_err(|error| error.to_string())?;
    if !status.is_success(){return Err(format!("OpenAI image request failed ({status}): {}",body.get("error").and_then(|value|value.get("message")).and_then(Value::as_str).unwrap_or("unknown error")))}
    let encoded=body.get("data").and_then(Value::as_array).and_then(|data|data.first()).and_then(|item|item.get("b64_json")).and_then(Value::as_str).ok_or_else(||"OpenAI response did not contain image bytes".to_string())?;
    base64::engine::general_purpose::STANDARD.decode(encoded).map_err(|error|format!("OpenAI image payload was invalid: {error}"))
}

#[tauri::command]
async fn openai_generate_image(app: tauri::AppHandle, model: String, prompt: String, size: String, quality: String, output_name: String) -> Result<ImportedAsset, String> {
    if !matches!(model.as_str(), "gpt-image-1.5" | "gpt-image-1" | "gpt-image-1-mini") { return Err("Unsupported OpenAI image model".to_string()); }
    let api_key=credential("openai")?.get_password().map_err(|_|"OpenAI credential is not configured".to_string())?;
    let bytes=request_openai_image("https://api.openai.com/v1/images/generations",&api_key,&model,&prompt,&size,&quality).await?;
    let output_dir=app.path().app_data_dir().map_err(|error|error.to_string())?.join("assets");fs::create_dir_all(&output_dir).map_err(|error|error.to_string())?;
    let name=safe_package_name(&output_name);if name.is_empty(){return Err("Output name is required".to_string())}
    let path=output_dir.join(format!("{name}.png"));fs::write(&path,bytes).map_err(|error|error.to_string())?;
    let inspection=inspect_image_file(&path)?;Ok(ImportedAsset{path:path.to_string_lossy().to_string(),inspection})
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
fn inspect_image(app: tauri::AppHandle, path: String) -> Result<ImageInspection, String> { inspect_image_file(&providers::inside_assets(&app, &path)?) }

pub(crate) fn draw_label_text(canvas: &mut ImageBuffer<Rgba<u8>, Vec<u8>>, text: &str, x: u32, y: u32, scale: u32) {
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
fn label_image(app: tauri::AppHandle, input_path: String, output_path: String, title: String, metadata: Vec<String>) -> Result<ImageInspection, String> {
    // Both ends stay inside the app's assets folder: an image it saved, and a new .png beside it.
    let input = providers::inside_assets(&app, &input_path)?;
    let output_path = providers::new_png_inside(&providers::assets_root(&app)?, &output_path)?.to_string_lossy().into_owned();
    let source = image::open(&input).map_err(|error| error.to_string())?.to_rgba8();
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

pub(crate) fn safe_package_name(value: &str) -> String {
    let cleaned: String = value.chars().map(|character| if character.is_ascii_alphanumeric() || matches!(character, '-' | '_') { character } else { '_' }).collect();
    cleaned.trim_matches('_').to_string()
}

#[derive(Deserialize)]
struct PromptArchiveEntry { name: String, contents: String }

#[tauri::command]
fn export_prompt_archive(app: tauri::AppHandle, project_name: String, entries: Vec<PromptArchiveEntry>) -> Result<String, String> {
    if entries.is_empty() { return Err("No prompts are available to export".to_string()); }
    let export_dir = app.path().document_dir().map_err(|error| error.to_string())?.join("Production One").join("Exports");
    fs::create_dir_all(&export_dir).map_err(|error| error.to_string())?;
    let project = safe_package_name(&project_name);
    if project.is_empty() { return Err("Project name is required".to_string()); }
    let output_path = export_dir.join(format!("{project}-prompts.zip"));
    write_prompt_archive(&output_path, &entries)?;
    Ok(output_path.to_string_lossy().to_string())
}

fn write_prompt_archive(output_path: &std::path::Path, entries: &[PromptArchiveEntry]) -> Result<(), String> {
    let file = fs::File::create(output_path).map_err(|error| error.to_string())?;
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

#[derive(Deserialize, Clone)]
struct LookFile { name: String, content: String }

#[derive(Deserialize)]
struct ProductionPackageInput { #[serde(default)] design_records: Option<String>, #[serde(default)] look_files: Option<Vec<LookFile>>, manifest: String, asset_ledger_csv: String, style_bible: String, model_usage: String, prompt: String, reference_paths: Vec<String>, export_mode: String }

#[tauri::command]
fn export_production_package(app: tauri::AppHandle, package_name: String, design_records: Option<String>, look_files: Option<Vec<LookFile>>, manifest: String, asset_ledger_csv: String, style_bible: String, model_usage: String, prompt: String, reference_paths: Vec<String>, export_mode: String) -> Result<String, String> {
    let export_dir = app.path().document_dir().map_err(|error| error.to_string())?.join("Production One").join("Exports");
    fs::create_dir_all(&export_dir).map_err(|error| error.to_string())?;
    let safe_name = safe_package_name(&package_name);
    if safe_name.is_empty() { return Err("Package name is required".to_string()); }
    let mut output_path = export_dir.join(format!("{safe_name}.zip"));
    if output_path.exists() {
        let stamp = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map_err(|error| error.to_string())?.as_secs();
        output_path = export_dir.join(format!("{safe_name}-{stamp}.zip"));
    }
    let input = ProductionPackageInput { design_records, look_files, manifest, asset_ledger_csv, style_bible, model_usage, prompt, reference_paths, export_mode };
    write_production_package(&output_path, &input)?;
    Ok(output_path.to_string_lossy().to_string())
}

/// The verified package refuses to be made from pictures that are gone. Says which, by file name, and what to do.
fn missing_references_message(missing: &[&String]) -> String {
    let names: Vec<String> = missing.iter().map(|p| std::path::Path::new(p.as_str()).file_name().map(|n| n.to_string_lossy().into_owned()).unwrap_or_else(|| p.to_string())).collect();
    format!("No verified package was made: {} approved picture{} not on this computer ({}). Remake or replace {}, approve, then export again.", names.len(), if names.len() == 1 { " is" } else { "s are" }, names.join(", "), if names.len() == 1 { "it" } else { "them" })
}

/// Why a file may not go into a package: a credential, a key, or a machine-specific model file. None when it is fine.
fn unsafe_export_file(path: &str) -> Option<&'static str> {
    let lower = path.to_lowercase().replace('\\', "/");
    let name = lower.rsplit('/').next().unwrap_or("");
    if name == ".env" || name.starts_with(".env.") { return Some("an environment file"); }
    if ["id_rsa", "id_ed25519", "id_ecdsa", "id_rsa.pub", "id_ed25519.pub"].contains(&name) { return Some("an SSH key"); }
    if [".pem", ".key", ".p12", ".pfx", ".jks", ".keystore", ".kdbx", ".ppk"].iter().any(|e| name.ends_with(e)) { return Some("a key or certificate file"); }
    if ["credentials", "credential", "secrets", "secret", "auth", "token", "tokens"].iter().any(|b| [".json", ".yaml", ".yml", ".toml", ".ini", ".txt"].iter().any(|e| name == format!("{b}{e}"))) { return Some("a credentials file"); }
    if [".netrc", ".npmrc", ".pypirc", ".git-credentials"].contains(&name) { return Some("a credentials file"); }
    if [".safetensors", ".ckpt", ".gguf", ".ggml", ".pt", ".pth", ".onnx", ".lora"].iter().any(|e| name.ends_with(e)) { return Some("a machine-specific model file"); }
    if lower.contains("/comfyui/models/") || lower.contains("/comfyui/custom_nodes/") { return Some("a file from a local ComfyUI install"); }
    if lower.contains("/.ollama/") { return Some("a file from a local Ollama install"); }
    None
}

/// A LUT file name inside the package: `Looks/<name>.cube`, one folder deep, plain characters only. Anything else is refused.
fn look_file_ok(name: &str) -> bool {
    let Some(rest) = name.strip_prefix("Looks/") else { return false };
    rest.len() > 5 && rest.len() <= 120 && rest.to_lowercase().ends_with(".cube") && !rest.contains('/') && !rest.contains('\\') && !rest.contains("..") && rest.chars().all(|c| c.is_ascii_alphanumeric() || " ._()-".contains(c))
}

/// Does the text contain `prefix` followed by at least `min` token characters (letters, digits, - _ . ~ + /)?
fn has_token(text: &str, prefix: &str, min: usize) -> bool {
    text.match_indices(prefix).any(|(i, _)| text[i + prefix.len()..].chars().take_while(|c| c.is_ascii_alphanumeric() || "-_.~+/".contains(*c)).count() >= min)
}

/// Why a text may not be written into a package: it looks like it holds a key or token. None when it is fine.
fn unsafe_export_text(text: &str) -> Option<&'static str> {
    if text.contains("-----BEGIN") && text.contains("PRIVATE KEY-----") { return Some("a private key"); }
    if has_token(text, "sk-", 20) { return Some("an API key"); }
    if has_token(text, "AIza", 30) { return Some("a Google API key"); }
    if has_token(text, "Bearer ", 20) { return Some("a bearer token"); }
    for p in ["ghp_", "gho_", "ghu_", "ghs_", "ghr_"] { if has_token(text, p, 30) { return Some("a GitHub token"); } }
    None
}

fn write_production_package(output_path: &std::path::Path, input: &ProductionPackageInput) -> Result<(), String> {
    let manifest: Value = serde_json::from_str(&input.manifest).map_err(|error| format!("Asset manifest is invalid: {error}"))?;
    serde_json::from_str::<Value>(&input.style_bible).map_err(|error| format!("Style Bible is invalid: {error}"))?;
    serde_json::from_str::<Value>(&input.model_usage).map_err(|error| format!("Model usage record is invalid: {error}"))?;
    if input.export_mode != "draft" && input.export_mode != "verified" { return Err("Export mode must be draft or verified".to_string()); }
    if input.export_mode == "verified" && manifest.get("status").and_then(Value::as_str) != Some("production-ready") { return Err("Verified package requires a production-ready manifest".to_string()); }
    if let Some(records) = &input.design_records { serde_json::from_str::<Value>(records).map_err(|error| format!("Design records are invalid: {error}"))?; }
    for path in &input.reference_paths {
        if let Some(why) = unsafe_export_file(path) { let name = std::path::Path::new(path).file_name().map(|n| n.to_string_lossy().into_owned()).unwrap_or_default(); return Err(format!("No package was made: it would have included {why} ({name}). Credentials and model files never go into a package. Remove it and export again.")); }
    }
    for (label, text) in [("manifest", Some(&input.manifest)), ("style bible", Some(&input.style_bible)), ("model usage", Some(&input.model_usage)), ("prompt", Some(&input.prompt)), ("design records", input.design_records.as_ref())] {
        if let Some(why) = text.and_then(|t| unsafe_export_text(t)) { return Err(format!("No package was made: the {label} contains {why}. Credentials never go into a package. Remove it and export again.")); }
    }
    if let Some(files) = &input.look_files {
        if files.len() > 16 { return Err("Too many LUT files for one package.".to_string()); }
        for f in files {
            if !look_file_ok(&f.name) { return Err("A LUT file has a name that cannot go into a package.".to_string()); }
            if f.content.len() > 14 * 1024 * 1024 { return Err("A LUT file is too large to go into a package.".to_string()); }
            if !f.content.contains("LUT_3D_SIZE") && !f.content.contains("LUT_1D_SIZE") { return Err("A LUT file is not a .cube file.".to_string()); }
        }
    }
    let missing: Vec<&String> = input.reference_paths.iter().filter(|source_path| !std::path::Path::new(source_path.as_str()).is_file()).collect();
    if input.export_mode == "verified" && !missing.is_empty() { return Err(missing_references_message(&missing)); }
    let incomplete = if missing.is_empty() { "None".to_string() } else { missing.iter().map(|p| p.as_str()).collect::<Vec<_>>().join("\n") };
    let temporary = output_path.with_extension("zip.tmp");
    let file = fs::File::create(&temporary).map_err(|error| error.to_string())?;
    let mut archive = zip::ZipWriter::new(file);
    let options = zip::write::SimpleFileOptions::default().compression_method(zip::CompressionMethod::Deflated);
    for directory in ["Project Bible/","Characters/","Expressions/","Poses/","Wardrobe/","Props/","Environments/","Vehicles and Creatures/","Lighting and FX/","Choreography/","Style References/","Prompts/","Manifests/","Approved References/"] { archive.add_directory(directory, options).map_err(|error| error.to_string())?; }
    let files = [
        ("Manifests/asset_manifest.json", input.manifest.as_str()),
        ("Manifests/asset_ledger.csv", input.asset_ledger_csv.as_str()),
        ("Project Bible/style_bible.json", input.style_bible.as_str()),
        ("Manifests/model_usage.json", input.model_usage.as_str()),
        ("Prompts/shot-prompt.txt", input.prompt.as_str()),
        ("production_readme.md", &format!("# Production One Package\n\nExport mode: {}\n\nIncomplete references:\n{}\n", input.export_mode, incomplete)),
    ];
    if let Some(records) = &input.design_records { archive.start_file("Project Bible/design_records.json", options).map_err(|error| error.to_string())?; archive.write_all(records.as_bytes()).map_err(|error| error.to_string())?; }
    if let Some(files) = &input.look_files { for f in files { archive.start_file(f.name.as_str(), options).map_err(|error| error.to_string())?; archive.write_all(f.content.as_bytes()).map_err(|error| error.to_string())?; } }
    for (name, contents) in files { archive.start_file(name, options).map_err(|error| error.to_string())?; archive.write_all(contents.as_bytes()).map_err(|error| error.to_string())?; }
    for (index, source_path) in input.reference_paths.iter().enumerate() {
        let path = std::path::Path::new(source_path);
        if !path.is_file() { continue; }
        let extension = path.extension().and_then(|value| value.to_str()).unwrap_or("bin");
        let stem = path.file_stem().and_then(|value| value.to_str()).unwrap_or("reference");
        let archive_name = format!("Approved References/{:02}_{}.{}", index + 1, safe_package_name(stem), extension);
        archive.start_file(archive_name, options).map_err(|error| error.to_string())?;
        let mut source = fs::File::open(path).map_err(|error| error.to_string())?;
        let mut buffer = Vec::new(); source.read_to_end(&mut buffer).map_err(|error| error.to_string())?;
        archive.write_all(&buffer).map_err(|error| error.to_string())?;
    }
    archive.finish().map_err(|error| error.to_string())?;
    if output_path.exists() { return Err("Refusing to overwrite an existing delivery".to_string()); }
    fs::rename(&temporary, output_path).map_err(|error| error.to_string())?;
    let file = fs::File::open(output_path).map_err(|error| error.to_string())?;
    let mut validation = zip::ZipArchive::new(file).map_err(|error| format!("Package validation failed: {error}"))?;
    for required in ["Manifests/asset_manifest.json","Manifests/asset_ledger.csv","Project Bible/style_bible.json","Manifests/model_usage.json","Prompts/shot-prompt.txt","production_readme.md"] { validation.by_name(required).map_err(|_| format!("Package validation failed: missing {required}"))?; }
    Ok(())
}

/// Puts a Production One shortcut on the desktop (Windows). It points at the program that is running now, so it works for the installed app and for the portable
/// one. An existing shortcut of that name is left alone. Paths go to PowerShell through the environment, never spliced into the command.
#[tauri::command]
fn create_desktop_shortcut(app: tauri::AppHandle) -> Result<String, String> {
    #[cfg(windows)]
    {
        let desktop = app.path().desktop_dir().map_err(|e| format!("The desktop folder could not be found: {e}"))?;
        let exe = std::env::current_exe().map_err(|e| e.to_string())?;
        let link = desktop.join("Production One.lnk");
        if link.exists() { return Ok(format!("There is already a Production One shortcut on your desktop ({}).", link.display())); }
        let script = "$s=(New-Object -ComObject WScript.Shell).CreateShortcut($env:PO_LINK);$s.TargetPath=$env:PO_EXE;$s.WorkingDirectory=$env:PO_DIR;$s.IconLocation=$env:PO_EXE+',0';$s.Description='Production One';$s.Save()";
        let status = std::process::Command::new("powershell").args(["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", script])
            .env("PO_LINK", &link).env("PO_EXE", &exe).env("PO_DIR", exe.parent().unwrap_or(std::path::Path::new(".")))
            .creation_flags_hidden().status().map_err(|e| format!("Could not run PowerShell: {e}"))?;
        if !status.success() || !link.exists() { return Err("The shortcut could not be created. You can make one yourself: right-click ProductionOne.exe, then Send to, then Desktop (create shortcut).".into()); }
        Ok(format!("Added a Production One shortcut to your desktop ({}).", link.display()))
    }
    #[cfg(not(windows))]
    { let _ = app; Err("On this system, drag Production One from Applications to the Dock, or to the desktop while holding Option and Command to make an alias.".into()) }
}

#[cfg(windows)]
trait HiddenWindow { fn creation_flags_hidden(&mut self) -> &mut Self; }
#[cfg(windows)]
impl HiddenWindow for std::process::Command {
    fn creation_flags_hidden(&mut self) -> &mut Self { use std::os::windows::process::CommandExt; self.creation_flags(0x08000000) }
}

/// Called by the UI once it has mounted: closes the splash window and shows the main window.
#[tauri::command]
fn app_ready(app: tauri::AppHandle, started: tauri::State<StartedAt>) {
    // The splash stays up for a fixed minimum so the brand is actually seen, then the main window appears. Nothing here pretends to load anything.
    // The person can skip it at any time (the x on the splash, or Esc), or open the guide straight away (Help on the splash).
    MAIN_READY.store(true, Ordering::SeqCst);
    let wait = SPLASH_MIN.saturating_sub(started.0.elapsed());
    std::thread::spawn(move || {
        let step = std::time::Duration::from_millis(60);
        let mut waited = std::time::Duration::ZERO;
        while waited < wait && !SKIP_SPLASH.load(Ordering::SeqCst) { std::thread::sleep(step); waited += step; }
        show_main(&app);
    });
}

static MAIN_READY: AtomicBool = AtomicBool::new(false);
static SKIP_SPLASH: AtomicBool = AtomicBool::new(false);
static HELP_WANTED: AtomicBool = AtomicBool::new(false);

/// Closes the splash and shows the main window. If the person asked for Help on the splash, the guide is opened once the window is up.
fn show_main(app: &tauri::AppHandle) {
    if let Some(splash) = app.get_webview_window("splash") { let _ = splash.close(); }
    if let Some(main) = app.get_webview_window("main") {
        let _ = main.show();
        let _ = main.set_focus();
        if HELP_WANTED.swap(false, Ordering::SeqCst) { let _ = app.emit("menu-action", "help-docs"); }
    }
}

/// The x on the splash: skip it. If the app is not ready yet, the main window appears as soon as it is.
#[tauri::command]
fn splash_dismiss(app: tauri::AppHandle) {
    SKIP_SPLASH.store(true, Ordering::SeqCst);
    if MAIN_READY.load(Ordering::SeqCst) { show_main(&app); }
}

/// Help on the splash: skip it and open the guide.
#[tauri::command]
fn splash_help(app: tauri::AppHandle) {
    HELP_WANTED.store(true, Ordering::SeqCst);
    splash_dismiss(app);
}

const SPLASH_MIN: std::time::Duration = std::time::Duration::from_millis(2600);
struct StartedAt(std::time::Instant);

/// The project file Windows passed on the command line when the person double-clicked a .pone or .pguy file.
fn project_arg<I: IntoIterator<Item = String>>(args: I) -> Option<String> {
    args.into_iter().skip(1).find(|a| { let l = a.to_ascii_lowercase(); l.ends_with(".pone") || l.ends_with(".pguy") })
}

#[tauri::command]
fn launch_file() -> Option<String> { project_arg(std::env::args()) }

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, args, _cwd| {
            // A second launch (for example double-clicking another project) hands its file to the window that is already open.
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.unminimize();
                let _ = window.set_focus();
            }
            if let Some(path) = project_arg(args) { let _ = app.emit("open-file", path); }
        }))
        .plugin(tauri_plugin_dialog::init())
        .manage(desktop::Dirty::default())
        .manage(providers::ScanMemory::default())
        .manage(agent::AgentState::default())
        .manage(StartedAt(std::time::Instant::now()))
        .setup(|app| {
            let menu = desktop::build_menu(app.handle())?;
            app.set_menu(menu)?;
            // The asset protocol (pictures in the Director's room and the lightbox, audio and video players) only serves what its scope allows. On a first run the assets folder does not
            // exist yet, so the scope built from the config at start-up does not cover it and every picture is refused until the next start. Make the folder and allow it now.
            if let Ok(dir) = app.path().app_data_dir().map(|d| d.join("assets")) {
                let _ = std::fs::create_dir_all(&dir);
                let _ = app.asset_protocol_scope().allow_directory(&dir, true);
            }
            Ok(())
        })
        .on_menu_event(|app, event| desktop::handle_menu_event(app, event.id().as_ref()))
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                desktop::handle_close_request(window, api);
            }
        })
        .invoke_handler(tauri::generate_handler![splash_dismiss, splash_help, create_desktop_shortcut, ledger_append, desktop::open_project_dialog, desktop::open_project_path, desktop::save_project_dialog, desktop::save_project_path, desktop::recent_projects, desktop::forget_recent_project, desktop::clear_recent_projects, desktop::set_dirty, desktop::quit_app, desktop::save_text_dialog, providers::generate_image, local::local_detect, script_file::pick_script_file, script_file::read_script_path, cleanrender::clean_analyze, cleanrender::clean_preview, cleanrender::clean_save, assistant::pick_attachments, assistant::read_attachments, assistant::assistant_complete, agent::agent_enable, agent::agent_status, agent::agent_reply, comfy_install::comfy_install_plan, comfy_install::comfy_install, comfy_install::comfy_start, comfy_install::comfy_model_plan, comfy_install::comfy_download_models, local::local_config_get, local::local_config_set, local::local_llm, local::comfy_templates, local::comfy_custom_workflows, local::comfy_add_workflow, local::pick_workflow_file, local::comfy_generate_image, local::comfy_generate_video, providers::pick_image_files, providers::import_images, providers::missing_files, providers::find_pictures, providers::adopt_scanned, providers::locate_picture, update::check_for_update, update::open_release_page, providers::generate_video, voice::local_voices, voice::speak_local, voice::speak_http, voice_cloud::elevenlabs_voices, voice_cloud::elevenlabs_models, voice_cloud::speak_elevenlabs, voice_cloud::sound_elevenlabs, voice_cloud::design_voice, voice_cloud::save_designed_voice, voice_cloud::voicekiller_voices, voice_cloud::speak_voicekiller, suno::make_music, providers::kie_models, providers::discover_models, providers::model_catalog, providers::image_preview, providers::read_audio_clip, providers::qa_image, providers::backdrop_colour, desktop::set_window_title, launch_file, load_project, save_project, load_studio, save_studio, save_prompt_package, backup_project, sheet_export::export_contact_sheet, credential_status, save_credential, delete_credential, kie_create_task, kie_query_task, openai_generate_image, inspect_image, label_image, import_labeled_asset, export_prompt_archive, export_production_package, app_ready])
        .run(tauri::generate_context!())
        .expect("failed to run Production One");
}

#[cfg(test)]
mod tests {
    #[test]
    fn only_files_this_app_wrote_count_as_backups() {
        assert!(super::is_backup_name("The_Last_Horizon-20261113-201500.pone"));
        assert!(super::is_backup_name("production-19700101-000000.pone"));
        assert!(!super::is_backup_name("My film.pone"));
        assert!(!super::is_backup_name("film-final.pone"));
        assert!(!super::is_backup_name("film-20261113-201500.txt"));
        assert!(!super::is_backup_name("film-2026111-2015000.pone"));
        let name = format!("x-{}.pone", super::utc_stamp(1_700_000_000));
        assert!(super::is_backup_name(&name));
    }

    #[test]
    fn backup_names_use_a_sortable_utc_stamp() {
        assert_eq!(super::utc_stamp(0), "19700101-000000");
        assert_eq!(super::utc_stamp(951_782_400), "20000229-000000", "leap day");
        let (a, b) = (super::utc_stamp(1_700_000_000), super::utc_stamp(1_700_000_001));
        assert!(a < b);
        assert_eq!(super::utc_stamp(1_700_000_000), "20231114-221320");
    }

    #[test]
    fn project_arg_picks_only_project_files_after_the_program_name() {
        let v = |a: &[&str]| a.iter().map(|s| s.to_string()).collect::<Vec<_>>();
        assert_eq!(super::project_arg(v(&["ProductionOne.exe", "C:/films/Horizon.PONE"])), Some("C:/films/Horizon.PONE".into()));
        assert_eq!(super::project_arg(v(&["ProductionOne.exe", "old.pguy"])), Some("old.pguy".into()));
        assert_eq!(super::project_arg(v(&["ProductionOne.exe", "notes.txt"])), None);
        assert_eq!(super::project_arg(v(&["thing.pone"])), None, "the first argument is the program itself");
    }

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
    fn openai_image_adapter_posts_authenticated_request_and_decodes_image() {
        let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
        let address = listener.local_addr().unwrap();
        let server = std::thread::spawn(move || {
            let (mut stream, _) = listener.accept().unwrap();
            let mut request = [0u8; 8192];
            let length = stream.read(&mut request).unwrap();
            let request = String::from_utf8_lossy(&request[..length]);
            assert!(request.starts_with("POST /v1/images/generations HTTP/1.1"));
            assert!(request.to_ascii_lowercase().contains("authorization: bearer openai-test-key"));
            assert!(request.contains("gpt-image-1.5"));
            let body = r#"{"data":[{"b64_json":"aW1hZ2UtYnl0ZXM="}]}"#;
            write!(stream, "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}", body.len(), body).unwrap();
        });
        let bytes = tauri::async_runtime::block_on(super::request_openai_image(&format!("http://{address}/v1/images/generations"), "openai-test-key", "gpt-image-1.5", "Character sheet", "1024x1024", "medium")).unwrap();
        server.join().unwrap();
        assert_eq!(bytes, b"image-bytes");
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
        let path = std::env::temp_dir().join(format!("production-one-prompts-{}.zip", std::process::id()));
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

    #[test]
    fn production_zip_is_validated_and_contains_interchange_records() {
        let path = std::env::temp_dir().join(format!("production-one-package-{}.zip", std::process::id()));
        let input = super::ProductionPackageInput { look_files: None, design_records: None, manifest: "{\"format\":\"production-one-package\",\"status\":\"production-ready\"}".into(), asset_ledger_csv: "asset_id,status\nCHAR-001,approved".into(), style_bible: "{\"name\":\"Test Style\"}".into(), model_usage: "{\"model\":\"seedance\"}".into(), prompt: "A model-aware shot prompt".into(), reference_paths: vec![], export_mode: "verified".into() };
        super::write_production_package(&path, &input).unwrap();
        let file = std::fs::File::open(&path).unwrap();
        let mut archive = zip::ZipArchive::new(file).unwrap();
        assert!(archive.by_name("Manifests/asset_manifest.json").is_ok());
        assert!(archive.by_name("Project Bible/style_bible.json").is_ok());
        assert!(archive.by_name("production_readme.md").is_ok());
        drop(archive);
        std::fs::remove_file(path).unwrap();
    }

    #[test]
    fn verified_package_names_missing_pictures_by_file_name() {
        let path = std::env::temp_dir().join(format!("production-one-missing-ref-{}.zip", std::process::id()));
        let gone = std::env::temp_dir().join("nowhere-at-all").join("venom_front_v01.png").to_string_lossy().into_owned();
        let input = super::ProductionPackageInput { look_files: None, design_records: None, manifest: "{\"status\":\"production-ready\"}".into(), asset_ledger_csv: "asset_id,status".into(), style_bible: "{}".into(), model_usage: "{}".into(), prompt: "prompt".into(), reference_paths: vec![gone], export_mode: "verified".into() };
        let message = super::write_production_package(&path, &input).unwrap_err();
        assert!(message.contains("venom_front_v01.png") && message.contains("not on this computer"), "{message}");
        assert!(!message.contains("nowhere-at-all"), "the folder is not echoed: {message}");
        assert!(!path.exists());
    }

    #[test]
    fn package_refuses_credentials_and_model_files_and_says_why() {
        let base = |refs: Vec<String>, prompt: &str, records: Option<String>| super::ProductionPackageInput { look_files: None, design_records: records, manifest: "{\"status\":\"draft-incomplete\"}".into(), asset_ledger_csv: "asset_id,status".into(), style_bible: "{}".into(), model_usage: "{}".into(), prompt: prompt.into(), reference_paths: refs, export_mode: "draft".into() };
        let path = std::env::temp_dir().join(format!("production-one-unsafe-{}.zip", std::process::id()));
        for (file, why) in [("C:/p/.env", "environment file"), ("C:/p/id_rsa", "SSH key"), ("C:/p/server.pem", "key or certificate"), ("C:/p/credentials.json", "credentials file"), ("D:/ComfyUI/models/checkpoints/flux1-dev.safetensors", "model file"), ("C:/Users/x/.ollama/models/blobs/sha256-1", "Ollama")] {
            let message = super::write_production_package(&path, &base(vec![file.to_string()], "prompt", None)).unwrap_err();
            assert!(message.contains(why), "{file}: {message}");
            assert!(!message.contains("C:/p/") && !message.contains("D:/ComfyUI"), "the folder is not echoed: {message}");
        }
        for (text, why) in [("key: sk-abcdefghijklmnopqrstuvwxyz123456", "API key"), ("AIzaSyAbcdefghijklmnopqrstuvwxyz0123456789", "Google API key"), ("Authorization: Bearer abcdefghijklmnopqrstuvwxyz", "bearer token"), ("-----BEGIN RSA PRIVATE KEY-----\nabc\n-----END RSA PRIVATE KEY-----", "private key")] {
            let message = super::write_production_package(&path, &base(vec![], text, None)).unwrap_err();
            assert!(message.contains(why), "{text}: {message}");
            assert!(!message.contains("abcdefghijkl"), "the key is not echoed: {message}");
            let in_records = super::write_production_package(&path, &base(vec![], "prompt", Some(format!("{{\"note\":\"{}\"}}", text.replace('\n', " "))))).unwrap_err();
            assert!(in_records.contains("design records"), "{in_records}");
        }
        assert!(!path.exists());
    }

    #[test]
    fn package_carries_lut_files_and_refuses_bad_names() {
        let path = std::env::temp_dir().join(format!("production-one-luts-{}.zip", std::process::id()));
        let mk = |name: &str, content: &str| super::ProductionPackageInput { look_files: Some(vec![super::LookFile { name: name.into(), content: content.into() }]), design_records: None, manifest: "{\"status\":\"draft-incomplete\"}".into(), asset_ledger_csv: "asset_id,status".into(), style_bible: "{}".into(), model_usage: "{}".into(), prompt: "prompt".into(), reference_paths: vec![], export_mode: "draft".into() };
        super::write_production_package(&path, &mk("Looks/Warm film (LUT-1234abcd).cube", "TITLE \"x\"\nLUT_3D_SIZE 2\n0 0 0\n")).unwrap();
        let mut archive = zip::ZipArchive::new(std::fs::File::open(&path).unwrap()).unwrap();
        let mut text = String::new();
        archive.by_name("Looks/Warm film (LUT-1234abcd).cube").unwrap().read_to_string(&mut text).unwrap();
        assert!(text.contains("LUT_3D_SIZE 2"));
        drop(archive);
        std::fs::remove_file(&path).unwrap();
        for bad in ["../evil.cube", "Looks/../evil.cube", "Looks/sub/a.cube", "Looks\\a.cube", "Other/a.cube", "Looks/a.exe", "Looks/.cube", "Looks/a:b.cube", "/Looks/a.cube", "Looks/"] {
            assert!(super::write_production_package(&path, &mk(bad, "LUT_3D_SIZE 2\n")).is_err(), "{bad}");
        }
        assert!(super::write_production_package(&path, &mk("Looks/a.cube", "not a lut")).unwrap_err().contains("not a .cube file"));
        assert!(!path.exists());
    }

    #[test]
    fn package_with_design_records_contains_them_and_rejects_invalid_ones() {
        let path = std::env::temp_dir().join(format!("production-one-records-{}.zip", std::process::id()));
        let mut input = super::ProductionPackageInput { look_files: None, design_records: Some("{\"format\":\"production-one-design-records\",\"version\":1}".into()), manifest: "{\"status\":\"draft-incomplete\"}".into(), asset_ledger_csv: "asset_id,status".into(), style_bible: "{}".into(), model_usage: "{}".into(), prompt: "prompt".into(), reference_paths: vec![], export_mode: "draft".into() };
        super::write_production_package(&path, &input).unwrap();
        let mut archive = zip::ZipArchive::new(std::fs::File::open(&path).unwrap()).unwrap();
        let mut text = String::new();
        archive.by_name("Project Bible/design_records.json").unwrap().read_to_string(&mut text).unwrap();
        assert!(text.contains("production-one-design-records"));
        drop(archive);
        std::fs::remove_file(&path).unwrap();
        input.design_records = Some("not json".into());
        assert!(super::write_production_package(&path, &input).unwrap_err().contains("Design records are invalid"));
        assert!(!path.exists());
        assert!(super::unsafe_export_file("C:/p/frame.png").is_none() && super::unsafe_export_text("a plain sentence with sk- in it").is_none());
    }

    #[test]
    fn verified_package_rejects_incomplete_manifest() {
        let path = std::env::temp_dir().join(format!("production-one-incomplete-{}.zip", std::process::id()));
        let input = super::ProductionPackageInput { look_files: None, design_records: None, manifest: "{\"status\":\"draft-incomplete\"}".into(), asset_ledger_csv: "asset_id,status".into(), style_bible: "{}".into(), model_usage: "{}".into(), prompt: "prompt".into(), reference_paths: vec![], export_mode: "verified".into() };
        let result = super::write_production_package(&path, &input);
        assert!(result.is_err());
        assert!(!path.exists());
    }

    #[test]
    fn catches_common_key_paste_mistakes_without_echoing_the_key() {
        assert!(super::key_shape_problem("openrouter", "Sk-or-v1-abcdef").is_some());
        assert!(super::key_shape_problem("openrouter", "sk-or-v1-abcdef").is_none());
        assert!(super::key_shape_problem("fal", "justonepart").is_some());
        assert!(super::key_shape_problem("fal", "id:secret").is_none());
        assert!(super::key_shape_problem("google", "AIzaSyExample").is_none());
        assert!(super::key_shape_problem("google", "xxxxxxxxxxx").is_some());
        assert!(super::key_shape_problem("kie", "abc def ghi jkl").is_some());
        assert!(!super::key_shape_problem("openrouter", "Sk-or-v1-secretvalue").unwrap().contains("secretvalue"));
    }
}
