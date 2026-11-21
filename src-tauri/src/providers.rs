//! Image provider adapters (OpenAI, Google Gemini, fal.ai, OpenRouter), model discovery, previews and deterministic image QA.
//!
//! Request and response shapes follow each provider's public documentation. None of them has been run against a live account in this build:
//! the pure builders and parsers below are unit-tested, the network calls are not. Keys come only from the OS credential store.

use std::{fs, path::{Path, PathBuf}, time::Duration};

use base64::Engine;
use image::GenericImageView;
use serde::Serialize;
use serde_json::{json, Value};
use tauri::Manager;

use super::{credential, inspect_image_file, safe_package_name, ImportedAsset};

const ENGINE: base64::engine::GeneralPurpose = base64::engine::general_purpose::STANDARD;

/// Width over height. Accepts a decimal such as 2.39:1.
pub fn aspect_ratio_f(aspect: &str) -> Option<f64> {
    let (w, h) = aspect.split_once(':')?;
    let (w, h) = (w.trim().parse::<f64>().ok()?, h.trim().parse::<f64>().ok()?);
    (w.is_finite() && h.is_finite() && w > 0.0 && h > 0.0 && w <= 32.0 && h <= 32.0).then_some(w / h)
}

/// The listed ratio closest in shape to the one asked for. The picture is cropped to the exact shape afterwards.
pub fn nearest_listed(aspect: &str, listed: &[&'static str]) -> &'static str {
    let want = aspect_ratio_f(aspect).unwrap_or(16.0 / 9.0);
    listed.iter().copied().min_by(|a, b| {
        let da = (aspect_ratio_f(a).unwrap_or(1.0) / want).ln().abs();
        let db = (aspect_ratio_f(b).unwrap_or(1.0) / want).ln().abs();
        da.partial_cmp(&db).unwrap_or(std::cmp::Ordering::Equal)
    }).unwrap_or("16:9")
}

/// The ratios Google Gemini and OpenRouter image models accept.
const GEMINI_ASPECTS: [&str; 10] = ["1:1", "2:3", "3:2", "3:4", "4:3", "4:5", "5:4", "9:16", "16:9", "21:9"];
const FAL_ASPECTS: [&str; 5] = ["1:1", "4:3", "3:4", "16:9", "9:16"];

/// Centre-crops a picture to the shape asked for when the provider could only give a nearby one. Returns None when it already matches (within 3%).
pub fn crop_to_aspect(bytes: &[u8], aspect: &str) -> Option<Vec<u8>> {
    let want = aspect_ratio_f(aspect)?;
    let img = image::load_from_memory(bytes).ok()?;
    let (w, h) = (img.width() as f64, img.height() as f64);
    if h == 0.0 || (w / h / want - 1.0).abs() <= 0.03 { return None; }
    let (cw, ch) = if w / h > want { ((h * want).round(), h) } else { (w, (w / want).round()) };
    let (cw, ch) = (cw.max(1.0) as u32, ch.max(1.0) as u32);
    let cropped = img.crop_imm((img.width() - cw) / 2, (img.height() - ch) / 2, cw, ch);
    let mut out = std::io::Cursor::new(Vec::new());
    cropped.write_to(&mut out, image::ImageFormat::Png).ok()?;
    Some(out.into_inner())
}

fn openai_size(aspect: &str) -> Result<&'static str, String> {
    let r = aspect_ratio_f(aspect).ok_or("Unsupported aspect ratio")?;
    Ok(if (r - 1.0).abs() < 0.05 { "1024x1024" } else if r > 1.0 { "1536x1024" } else { "1024x1536" })
}

fn fal_size(aspect: &str) -> Result<&'static str, String> {
    aspect_ratio_f(aspect).ok_or("Unsupported aspect ratio")?;
    Ok(match nearest_listed(aspect, &FAL_ASPECTS) {
        "1:1" => "square_hd",
        "4:3" => "landscape_4_3",
        "3:4" => "portrait_4_3",
        "9:16" => "portrait_16_9",
        _ => "landscape_16_9",
    })
}

fn image_data_url(path: &str) -> Result<(String, String), String> {
    let bytes = fs::read(path).map_err(|error| {
        let name = Path::new(path).file_name().map(|n| n.to_string_lossy().into_owned()).unwrap_or_else(|| path.to_string());
        if error.kind() == std::io::ErrorKind::NotFound {
            format!("The picture this view is built from ({name}) is no longer on this computer, for example because the project was opened from another computer or data folder. Add it again with Use my image, then retry.")
        } else {
            format!("Could not read reference image {name}: {error}")
        }
    })?;
    let mime = match image::guess_format(&bytes).map_err(|error| error.to_string())? {
        image::ImageFormat::Png => "image/png",
        image::ImageFormat::Jpeg => "image/jpeg",
        image::ImageFormat::WebP => "image/webp",
        _ => return Err("Reference images must be PNG, JPEG or WebP".into()),
    };
    Ok((mime.to_string(), ENGINE.encode(bytes)))
}

pub fn openai_body(model: &str, prompt: &str, aspect: &str, quality: &str) -> Result<Value, String> {
    if !matches!(quality, "low" | "medium" | "high" | "auto") { return Err("Unsupported image quality".into()); }
    Ok(json!({ "model": model, "prompt": prompt, "size": openai_size(aspect)?, "quality": quality, "output_format": "png" }))
}

pub fn gemini_body(prompt: &str, aspect: &str, references: &[(String, String)]) -> Value {
    let mut parts = vec![json!({ "text": prompt })];
    for (mime, data) in references { parts.push(json!({ "inline_data": { "mime_type": mime, "data": data } })); }
    json!({ "contents": [{ "parts": parts }], "generationConfig": { "responseModalities": ["TEXT", "IMAGE"], "imageConfig": { "aspectRatio": nearest_listed(aspect, &GEMINI_ASPECTS) } } })
}

pub fn openrouter_body(model: &str, prompt: &str, aspect: &str, references: &[(String, String)]) -> Value {
    let mut content = vec![json!({ "type": "text", "text": prompt })];
    for (mime, data) in references { content.push(json!({ "type": "image_url", "image_url": { "url": format!("data:{mime};base64,{data}") } })); }
    json!({ "model": model, "messages": [{ "role": "user", "content": content }], "modalities": ["image", "text"], "image_config": { "aspect_ratio": nearest_listed(aspect, &GEMINI_ASPECTS) } })
}

pub fn fal_body(prompt: &str, aspect: &str) -> Result<Value, String> {
    Ok(json!({ "prompt": prompt, "image_size": fal_size(aspect)?, "num_images": 1 }))
}

fn decode_data_url(url: &str) -> Result<Vec<u8>, String> {
    let (_, data) = url.split_once(";base64,").ok_or("The provider returned an image in an unexpected format")?;
    ENGINE.decode(data).map_err(|error| format!("The provider's image data was invalid: {error}"))
}

pub fn extract_openai(body: &Value) -> Result<Vec<u8>, String> {
    let encoded = body["data"][0]["b64_json"].as_str().ok_or("OpenAI response did not contain image bytes")?;
    ENGINE.decode(encoded).map_err(|error| format!("OpenAI image payload was invalid: {error}"))
}

/// Gemini image models (Nano Banana 2.1 and the Gemini 3 family) are called through the interactions endpoint, the shape FilmCrafter runs against Google.
pub fn uses_interactions(model: &str) -> bool { model.starts_with("gemini-nano-banana") || model.starts_with("gemini-3") }

pub fn interactions_body(model: &str, prompt: &str, aspect: &str, references: &[(String, String)]) -> Value {
    let mut input = vec![json!({ "type": "text", "text": prompt })];
    for (mime, data) in references { input.push(json!({ "type": "image", "mime_type": mime, "data": data })); }
    json!({ "model": model, "input": input, "response_format": { "type": "image", "mime_type": "image/jpeg", "aspect_ratio": nearest_listed(aspect, &GEMINI_ASPECTS) } })
}

pub fn extract_interactions(body: &Value) -> Result<Vec<u8>, String> {
    let it = if body["interaction"].is_null() { body } else { &body["interaction"] };
    let direct = it["output_image"]["data"].as_str();
    let stepped = it["steps"].as_array().and_then(|steps| steps.iter().flat_map(|s| s["content"].as_array().cloned().unwrap_or_default()).find(|c| c["type"] == "image" && c["data"].is_string()).and_then(|c| c["data"].as_str().map(str::to_string)));
    let data = direct.map(str::to_string).or(stepped).ok_or("Google returned no image (it may have been blocked by safety filters)")?;
    ENGINE.decode(data).map_err(|error| format!("Gemini image payload was invalid: {error}"))
}

pub fn extract_gemini(body: &Value) -> Result<Vec<u8>, String> {
    let parts = body["candidates"][0]["content"]["parts"].as_array().ok_or_else(|| {
        let reason = body["promptFeedback"]["blockReason"].as_str().or_else(|| body["candidates"][0]["finishReason"].as_str()).unwrap_or("no candidates");
        format!("Gemini returned no image ({reason})")
    })?;
    for part in parts {
        let inline = part.get("inlineData").or_else(|| part.get("inline_data"));
        if let Some(data) = inline.and_then(|value| value["data"].as_str()) {
            return ENGINE.decode(data).map_err(|error| format!("Gemini image payload was invalid: {error}"));
        }
    }
    Err("Gemini returned text but no image. The prompt may have been declined.".into())
}

pub fn extract_openrouter(body: &Value) -> Result<Vec<u8>, String> {
    let url = body["choices"][0]["message"]["images"][0]["image_url"]["url"].as_str().ok_or("OpenRouter returned no image for this model")?;
    decode_data_url(url)
}

pub fn fal_image_url(body: &Value) -> Result<String, String> {
    body["images"][0]["url"].as_str().map(str::to_string).ok_or_else(|| "fal.ai returned no image".to_string())
}

/// Only fal's own HTTPS hosts are downloaded from, so a response cannot point the app at an arbitrary address.
pub fn is_trusted_fal_url(url: &str) -> bool {
    let Some(rest) = url.strip_prefix("https://") else { return false };
    let host = rest.split(['/', '?', '#']).next().unwrap_or("");
    let host = host.rsplit('@').next().unwrap_or("").split(':').next().unwrap_or("");
    host == "fal.media" || host.ends_with(".fal.media") || host == "fal.run" || host.ends_with(".fal.run")
}

fn valid_model_id(provider: &str, model: &str) -> bool {
    !model.is_empty() && model.len() <= 120 && model.chars().all(|c| c.is_ascii_alphanumeric() || matches!(c, '-' | '_' | '.' | '/' | ':')) && !model.contains("..")
        && (provider != "fal" || model.contains('/'))
}

fn api_error(service: &str, status: reqwest::StatusCode, body: &Value) -> String {
    let message = body["error"]["message"].as_str().or_else(|| body["error"].as_str()).or_else(|| body["detail"].as_str()).or_else(|| body["message"].as_str()).unwrap_or("no details");
    format!("{service} image request failed ({}): {}", status.as_u16(), message.chars().take(300).collect::<String>())
}

fn client() -> Result<reqwest::Client, String> {
    reqwest::Client::builder().timeout(Duration::from_secs(240)).build().map_err(|error| error.to_string())
}

pub(crate) fn key_for(provider: &str) -> Result<String, String> {
    credential(provider)?.get_password().map_err(|_| format!("No {provider} key is saved. Add it in Tools, Provider Settings."))
}

async fn send_json(request: reqwest::RequestBuilder, service: &str) -> Result<Value, String> {
    let response = request.send().await.map_err(|error| if error.is_timeout() { format!("{service} timed out (timeout)") } else { format!("{service} could not be reached: {}", error.without_url()) })?;
    let status = response.status();
    let body: Value = response.json().await.unwrap_or(Value::Null);
    if !status.is_success() { return Err(api_error(service, status, &body)); }
    Ok(body)
}

fn unique_path(dir: &Path, stem: &str, ext: &str) -> PathBuf {
    let mut path = dir.join(format!("{stem}.{ext}"));
    let mut counter = 2;
    while path.exists() { path = dir.join(format!("{stem}_{counter}.{ext}")); counter += 1; }
    path
}

/// Which of the given files are not on this computer. A project opened elsewhere, or after its pictures were deleted, points at files that are gone.
#[tauri::command]
pub fn missing_files(paths: Vec<String>) -> Vec<String> {
    paths.into_iter().take(5000).filter(|path| !Path::new(path).is_file()).collect()
}

/// One picture found by name in a folder the person chose.
#[derive(Serialize, Clone, Debug, PartialEq)]
pub struct FoundPicture { pub name: String, pub path: String }

/// What a scan found, and which folder was searched.
#[derive(Serialize, Clone, Debug)]
pub struct FoundScan { pub folder: String, pub found: Vec<FoundPicture> }

const PICTURE_EXTENSIONS: [&str; 4] = ["png", "jpg", "jpeg", "webp"];

/// Looks through `root` for pictures whose file name (without the extension) is one of `wanted` (compared without regard to case). It only reads directory listings:
/// it does not follow links, stops at a depth of 8 and after 200,000 entries, and when a name turns up more than once keeps the shortest path (then the first alphabetically).
pub fn scan_for_pictures(root: &Path, wanted: &[String]) -> Vec<FoundPicture> {
    use std::collections::{HashMap, HashSet};
    let want: HashSet<String> = wanted.iter().map(|n| n.to_lowercase()).collect();
    let mut best: HashMap<String, PathBuf> = HashMap::new();
    let mut stack = vec![(root.to_path_buf(), 0usize)];
    let mut seen = 0usize;
    while let Some((dir, depth)) = stack.pop() {
        let Ok(entries) = fs::read_dir(&dir) else { continue };
        for entry in entries.flatten() {
            seen += 1;
            if seen > 200_000 { break; }
            let Ok(kind) = entry.file_type() else { continue };
            let path = entry.path();
            if kind.is_symlink() { continue; }
            if kind.is_dir() { if depth < 8 { stack.push((path, depth + 1)); } continue; }
            let Some(ext) = path.extension().and_then(|e| e.to_str()).map(|e| e.to_lowercase()) else { continue };
            if !PICTURE_EXTENSIONS.contains(&ext.as_str()) { continue; }
            let Some(stem) = path.file_stem().and_then(|s| s.to_str()).map(|s| s.to_lowercase()) else { continue };
            if !want.contains(&stem) { continue; }
            let better = match best.get(&stem) { None => true, Some(old) => (path.as_os_str().len(), &path) < (old.as_os_str().len(), old) };
            if better { best.insert(stem, path); }
        }
    }
    let mut out: Vec<FoundPicture> = best.into_iter().map(|(name, path)| FoundPicture { name, path: path.to_string_lossy().into_owned() }).collect();
    out.sort_by(|a, b| a.name.cmp(&b.name));
    out
}

/// "Find missing pictures": the person chooses a folder (the folder always comes from this dialog, never from the page), and the pictures whose names are asked for are
/// looked up inside it. Returns None if they cancel. Nothing is copied or changed on disk.
#[tauri::command]
pub async fn find_pictures(app: tauri::AppHandle, names: Vec<String>) -> Result<Option<FoundScan>, String> {
    use tauri_plugin_dialog::DialogExt;
    let names: Vec<String> = names.into_iter().take(5000).collect();
    if names.is_empty() { return Ok(None); }
    let Some(folder) = app.dialog().file().set_title("Choose the folder that holds your pictures").blocking_pick_folder() else { return Ok(None) };
    let root = folder.into_path().map_err(|e| e.to_string())?;
    let folder = root.to_string_lossy().into_owned();
    tauri::async_runtime::spawn_blocking(move || scan_for_pictures(&root, &names)).await.map(|found| Some(FoundScan { folder, found })).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn generate_image(app: tauri::AppHandle, provider: String, model: String, prompt: String, aspect: String, quality: String, references: Vec<String>, output_name: String) -> Result<ImportedAsset, String> {
    if prompt.trim().is_empty() { return Err("Prompt is required".into()); }
    if !valid_model_id(&provider, &model) { return Err("That model id is not valid".into()); }
    if references.len() > 8 { return Err("At most 8 reference images are sent with one request".into()); }
    let stem = safe_package_name(&output_name);
    if stem.is_empty() { return Err("Output name is required".into()); }
    let api_key = if provider == "comfyui" { String::new() } else { key_for(&provider)? };
    let refs = references.iter().map(|path| image_data_url(path)).collect::<Result<Vec<_>, _>>()?;
    let http = client()?;
    let bytes = match provider.as_str() {
        "openai" => {
            if !refs.is_empty() { return Err("Reference images are not wired for OpenAI yet. Use Google Gemini or OpenRouter for reference-based sheets.".into()); }
            let body = send_json(http.post("https://api.openai.com/v1/images/generations").bearer_auth(&api_key).json(&openai_body(&model, &prompt, &aspect, &quality)?), "OpenAI").await?;
            extract_openai(&body)?
        }
        "google" if uses_interactions(&model) => {
            let body = send_json(http.post("https://generativelanguage.googleapis.com/v1beta/interactions").header("x-goog-api-key", &api_key).json(&interactions_body(&model, &prompt, &aspect, &refs)), "Google Gemini").await?;
            extract_interactions(&body)?
        }
        "google" => {
            let url = format!("https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent");
            let body = send_json(http.post(url).header("x-goog-api-key", &api_key).json(&gemini_body(&prompt, &aspect, &refs)), "Google Gemini").await?;
            extract_gemini(&body)?
        }
        "comfyui" => {
            let (bytes, ext) = super::local::comfy_run(&app, super::local::ComfyRequest { base: super::local::comfy_base(&app), model: model.clone(), prompt: prompt.clone(), negative: "blurry, low quality, text, watermark, extra limbs, deformed hands, cropped".into(), aspect: aspect.clone(), seed: None, image: references.first().cloned(), duration: 5.0, max_side: 1024.0, wait_secs: 900 }).await?;
            if ext == "mp4" || ext == "webm" { return Err("That ComfyUI workflow made a video, not an image. Choose an image workflow.".into()); }
            bytes
        }
        "kie" => {
            let named: Vec<(String, String, String)> = refs.iter().zip(references.iter()).map(|((mime, data), path)| (mime.clone(), data.clone(), Path::new(path).file_name().map(|n| n.to_string_lossy().into_owned()).unwrap_or_else(|| "reference.png".into()))).collect();
            let file = super::kie::run(&api_key, &model, &prompt, &aspect, &named, None, 300).await?;
            if file.extension == "mp4" || file.extension == "webm" { return Err("This Kie model returned a video, not an image. Choose an image model.".into()); }
            file.bytes
        }
        "openrouter" => {
            let body = send_json(http.post("https://openrouter.ai/api/v1/chat/completions").bearer_auth(&api_key).json(&openrouter_body(&model, &prompt, &aspect, &refs)), "OpenRouter").await?;
            extract_openrouter(&body)?
        }
        "fal" => {
            if !refs.is_empty() { return Err("Reference images are not wired for fal.ai yet. Use Google Gemini or OpenRouter for reference-based sheets.".into()); }
            let body = send_json(http.post(format!("https://fal.run/{model}")).header("Authorization", format!("Key {api_key}")).json(&fal_body(&prompt, &aspect)?), "fal.ai").await?;
            let url = fal_image_url(&body)?;
            if !is_trusted_fal_url(&url) { return Err("fal.ai returned an image address that is not on fal's own hosts, so it was not downloaded".into()); }
            let response = http.get(&url).send().await.map_err(|error| format!("Could not download the fal.ai image: {}", error.without_url()))?;
            if !response.status().is_success() { return Err(format!("Could not download the fal.ai image ({})", response.status().as_u16())); }
            response.bytes().await.map_err(|error| error.to_string())?.to_vec()
        }
        _ => return Err("Image generation is not available for this provider".into()),
    };
    if bytes.len() > 60 * 1024 * 1024 { return Err("The provider returned an image larger than 60 MB".into()); }
    let bytes = crop_to_aspect(&bytes, &aspect).filter(|_| provider != "comfyui").unwrap_or(bytes);
    let ext = match image::guess_format(&bytes).map_err(|error| format!("The provider did not return a readable image: {error}"))? {
        image::ImageFormat::Png => "png",
        image::ImageFormat::Jpeg => "jpg",
        image::ImageFormat::WebP => "webp",
        _ => return Err("The provider returned an unsupported image format".into()),
    };
    let dir = app.path().app_data_dir().map_err(|error| error.to_string())?.join("assets");
    fs::create_dir_all(&dir).map_err(|error| error.to_string())?;
    let path = unique_path(&dir, &stem, ext);
    fs::write(&path, &bytes).map_err(|error| error.to_string())?; // written as received: original resolution, no re-encode
    let inspection = inspect_image_file(&path)?;
    Ok(ImportedAsset { path: path.to_string_lossy().into_owned(), inspection })
}

#[derive(Serialize, serde::Deserialize, Clone)]
pub struct DiscoveredModel { pub id: String, pub name: String }

fn catalog_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    app.path().app_data_dir().map(|dir| dir.join("model-catalog.json")).map_err(|error| error.to_string())
}

fn looks_like_image_model(id: &str) -> bool {
    let lower = id.to_ascii_lowercase();
    ["image", "imagen", "dall-e", "flux", "seedream", "recraft"].iter().any(|word| lower.contains(word))
}

pub fn parse_models(provider: &str, body: &Value) -> Vec<DiscoveredModel> {
    let mut found: Vec<DiscoveredModel> = match provider {
        "openrouter" => body["data"].as_array().map(|list| list.iter().filter_map(|m| Some(DiscoveredModel { id: m["id"].as_str()?.to_string(), name: m["name"].as_str().unwrap_or(m["id"].as_str()?).to_string() })).collect()).unwrap_or_default(),
        "openai" => body["data"].as_array().map(|list| list.iter().filter_map(|m| m["id"].as_str()).filter(|id| looks_like_image_model(id)).map(|id| DiscoveredModel { id: id.to_string(), name: id.to_string() }).collect()).unwrap_or_default(),
        "google" => body["models"].as_array().map(|list| list.iter().filter_map(|m| {
            let id = m["name"].as_str()?.trim_start_matches("models/").to_string();
            looks_like_image_model(&id).then(|| DiscoveredModel { name: m["displayName"].as_str().unwrap_or(&id).to_string(), id })
        }).collect()).unwrap_or_default(),
        _ => Vec::new(),
    };
    found.sort_by(|a, b| a.id.cmp(&b.id));
    found.dedup_by(|a, b| a.id == b.id);
    found
}

async fn kie_index(kind: &str) -> Result<Vec<DiscoveredModel>, String> {
    let text = client()?.get("https://docs.kie.ai/llms.txt").send().await.map_err(|e| format!("Could not reach Kie's model index: {}", e.without_url()))?.text().await.map_err(|e| e.to_string())?;
    let models = super::kie::parse_index(&text, kind);
    if models.is_empty() { return Err("Kie's published index listed no models, so the saved catalog was left unchanged.".into()); }
    Ok(models)
}

fn save_catalog(app: &tauri::AppHandle, key: &str, models: &[DiscoveredModel]) -> Result<Value, String> {
    let path = catalog_path(app)?;
    let mut catalog: Value = fs::read_to_string(&path).ok().and_then(|text| serde_json::from_str(&text).ok()).unwrap_or_else(|| json!({}));
    let fetched_at = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|d| d.as_secs()).unwrap_or(0);
    catalog[key] = json!({ "fetchedAt": fetched_at, "models": models });
    if let Some(parent) = path.parent() { let _ = fs::create_dir_all(parent); }
    fs::write(&path, serde_json::to_string(&catalog).map_err(|e| e.to_string())?).map_err(|e| e.to_string())?;
    Ok(catalog)
}

/// Kie publishes its whole model index without a key: every image model (and the video models usable for a demo) is listed from it.
#[tauri::command]
pub async fn kie_models(app: tauri::AppHandle) -> Result<Value, String> {
    let images = kie_index("image").await?;
    let mut catalog = save_catalog(&app, "kie", &images)?;
    if let Ok(videos) = kie_index("video").await { catalog = save_catalog(&app, "kie-video", &videos)?; }
    Ok(catalog)
}

/// Makes a short motion clip (turnaround, walk, pose) from an approved reference image with a Kie.ai video model. The file is saved in the assets folder as received.
#[tauri::command]
pub async fn generate_video(app: tauri::AppHandle, model: String, prompt: String, aspect: String, reference: String, output_name: String, duration: u32) -> Result<String, String> {
    if prompt.trim().is_empty() { return Err("Prompt is required".into()); }
    let stem = safe_package_name(&output_name);
    if stem.is_empty() { return Err("Output name is required".into()); }
    let api_key = key_for("kie")?;
    let (mime, data) = image_data_url(&reference)?;
    let name = Path::new(&reference).file_name().map(|n| n.to_string_lossy().into_owned()).unwrap_or_else(|| "reference.png".into());
    let file = super::kie::run(&api_key, &model, &prompt, &aspect, &[(mime, data, name)], Some(duration), 900).await?;
    if file.extension != "mp4" && file.extension != "webm" { return Err("Kie.ai returned an image, not a video. Choose a video model.".into()); }
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?.join("assets");
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let path = unique_path(&dir, &stem, file.extension);
    fs::write(&path, &file.bytes).map_err(|e| e.to_string())?;
    Ok(path.to_string_lossy().into_owned())
}

/// Reads the provider's own model list (where it has one) and keeps it beside the app's built-in catalog. A failure changes nothing.
#[tauri::command]
pub async fn discover_models(app: tauri::AppHandle, provider: String) -> Result<Value, String> {
    let http = client()?;
    let body = match provider.as_str() {
        "openrouter" => send_json(http.get("https://openrouter.ai/api/v1/models?output_modalities=image").bearer_auth(key_for("openrouter")?), "OpenRouter").await?,
        "openai" => send_json(http.get("https://api.openai.com/v1/models").bearer_auth(key_for("openai")?), "OpenAI").await?,
        "google" => send_json(http.get("https://generativelanguage.googleapis.com/v1beta/models?pageSize=200").header("x-goog-api-key", key_for("google")?), "Google").await?,
        "kie" => { let models = kie_index("image").await?; return save_catalog(&app, "kie", &models); }
        _ => return Err("This provider does not publish a model list this app can read. The built-in catalog is used.".into()),
    };
    let models = parse_models(&provider, &body);
    if models.is_empty() { return Err("The provider's list contained no image models, so the saved catalog was left unchanged.".into()); }
    let path = catalog_path(&app)?;
    let mut catalog: Value = fs::read_to_string(&path).ok().and_then(|text| serde_json::from_str(&text).ok()).unwrap_or_else(|| json!({}));
    let fetched_at = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|d| d.as_secs()).unwrap_or(0);
    catalog[&provider] = json!({ "fetchedAt": fetched_at, "models": models });
    if let Some(parent) = path.parent() { let _ = fs::create_dir_all(parent); }
    fs::write(&path, serde_json::to_string(&catalog).map_err(|e| e.to_string())?).map_err(|e| e.to_string())?;
    Ok(catalog)
}

#[tauri::command]
pub fn model_catalog(app: tauri::AppHandle) -> Value {
    catalog_path(&app).ok().and_then(|p| fs::read_to_string(p).ok()).and_then(|t| serde_json::from_str(&t).ok()).unwrap_or_else(|| json!({}))
}

pub(crate) fn inside_assets(app: &tauri::AppHandle, path: &str) -> Result<PathBuf, String> {
    let assets = app.path().app_data_dir().map_err(|e| e.to_string())?.join("assets");
    let canonical = fs::canonicalize(path).map_err(|e| format!("Could not open the image: {e}"))?;
    let root = fs::canonicalize(&assets).map_err(|e| e.to_string())?;
    if canonical.starts_with(&root) { Ok(canonical) } else { Err("Only images in the Production One assets folder can be previewed".into()) }
}

/// A new PNG the app may write: directly inside `root`, a plain file name, a .png extension, so a request from the page can never write elsewhere or overwrite something that is not an image.
pub(crate) fn new_png_inside(root: &Path, path: &str) -> Result<PathBuf, String> {
    let wanted = Path::new(path);
    let name = wanted.file_name().and_then(|n| n.to_str()).ok_or("The output file name is not valid")?;
    if !name.to_ascii_lowercase().ends_with(".png") || name.starts_with('.') || name.contains(['/', '\\', ':']) { return Err("The output must be a plain .png file name".into()); }
    let parent = fs::canonicalize(wanted.parent().ok_or("The output has no folder")?).map_err(|e| format!("Could not use the output folder: {e}"))?;
    let root = fs::canonicalize(root).map_err(|e| e.to_string())?;
    if parent != root { return Err("Labelled images are saved only in the Production One assets folder".into()); }
    Ok(root.join(name))
}

pub(crate) fn assets_root(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    Ok(app.path().app_data_dir().map_err(|e| e.to_string())?.join("assets"))
}

const MAX_CLIP_BYTES: u64 = 64 * 1024 * 1024;
const CLIP_EXTENSIONS: [&str; 6] = ["wav", "mp3", "m4a", "ogg", "flac", "aac"];

fn clip_allowed(extension: &str, len: u64) -> Result<(), String> {
    if !CLIP_EXTENSIONS.contains(&extension.to_ascii_lowercase().as_str()) { return Err("Only audio clips can be read here".into()); }
    if len > MAX_CLIP_BYTES { return Err("That audio file is larger than 64 MB".into()); }
    Ok(())
}

/// The raw bytes of an audio clip the app saved, so the page can measure and play it at a matched level. Only files inside the assets folder are readable, only audio, at most 64 MB.
#[tauri::command]
pub fn read_audio_clip(app: tauri::AppHandle, path: String) -> Result<tauri::ipc::Response, String> {
    let file = inside_assets(&app, &path)?;
    let extension = file.extension().and_then(|e| e.to_str()).unwrap_or_default().to_string();
    clip_allowed(&extension, fs::metadata(&file).map_err(|e| e.to_string())?.len())?;
    Ok(tauri::ipc::Response::new(fs::read(&file).map_err(|e| e.to_string())?))
}

/// Lets the person choose their own images. Returns the chosen paths (empty if they cancel).
#[tauri::command]
pub async fn pick_image_files(app: tauri::AppHandle, multiple: bool) -> Result<Vec<String>, String> {
    use tauri_plugin_dialog::DialogExt;
    let builder = app.dialog().file().set_title("Choose image").add_filter("Images", &["png", "jpg", "jpeg", "webp"]);
    let picked = if multiple { builder.blocking_pick_files().unwrap_or_default() } else { builder.blocking_pick_file().into_iter().collect() };
    picked.into_iter().map(|f| f.into_path().map(|p| p.to_string_lossy().into_owned()).map_err(|e| e.to_string())).collect()
}

/// Copies the person's own images into the project's assets folder byte for byte (no re-encode, original resolution) after checking each one really is an image.
pub fn copy_supplied_image(source: &Path, dir: &Path) -> Result<PathBuf, String> {
    let meta = fs::metadata(source).map_err(|e| format!("Could not open {}: {e}", source.display()))?;
    if !meta.is_file() { return Err(format!("{} is not a file", source.display())); }
    if meta.len() == 0 || meta.len() > 50 * 1024 * 1024 { return Err(format!("{} must be between 1 byte and 50 MB", source.display())); }
    let bytes = fs::read(source).map_err(|e| e.to_string())?;
    let ext = match image::guess_format(&bytes).map_err(|_| format!("{} is not a PNG, JPEG or WebP image", source.display()))? {
        image::ImageFormat::Png => "png",
        image::ImageFormat::Jpeg => "jpg",
        image::ImageFormat::WebP => "webp",
        _ => return Err(format!("{} is not a PNG, JPEG or WebP image", source.display())),
    };
    image::load_from_memory(&bytes).map_err(|e| format!("{} could not be read as an image: {e}", source.display()))?;
    let stem = safe_package_name(&source.file_stem().map(|s| s.to_string_lossy().into_owned()).unwrap_or_default());
    fs::create_dir_all(dir).map_err(|e| e.to_string())?;
    let target = unique_path(dir, &format!("{}_yours", if stem.is_empty() { "image".to_string() } else { stem }), ext);
    fs::write(&target, &bytes).map_err(|e| e.to_string())?;
    Ok(target)
}

#[tauri::command]
pub fn import_images(app: tauri::AppHandle, paths: Vec<String>) -> Result<Vec<ImportedAsset>, String> {
    if paths.is_empty() || paths.len() > 40 { return Err("Choose between 1 and 40 images".into()); }
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?.join("assets");
    paths.iter().map(|p| { let copied = copy_supplied_image(Path::new(p), &dir)?; let inspection = inspect_image_file(&copied)?; Ok(ImportedAsset { path: copied.to_string_lossy().into_owned(), inspection }) }).collect()
}

/// A small JPEG data URL for showing generated files in the UI. The original file is never touched.
#[tauri::command]
pub fn image_preview(app: tauri::AppHandle, path: String, max_edge: u32) -> Result<String, String> {
    let file = inside_assets(&app, &path)?;
    let source = image::open(&file).map_err(|e| e.to_string())?;
    let edge = max_edge.clamp(64, 1024);
    let small = source.thumbnail(edge, edge).to_rgb8();
    let mut out = Vec::new();
    image::codecs::jpeg::JpegEncoder::new_with_quality(&mut out, 82).encode_image(&small).map_err(|e| e.to_string())?;
    Ok(format!("data:image/jpeg;base64,{}", ENGINE.encode(out)))
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImageQa { width: u32, height: u32, mean_luma: f32, luma_spread: f32, subject_touches_top: bool, subject_touches_bottom: bool, subject_touches_sides: bool, notes: Vec<String> }

fn luma(p: &image::Rgb<u8>) -> f32 { 0.2126 * p[0] as f32 + 0.7152 * p[1] as f32 + 0.0722 * p[2] as f32 }

/// Deterministic checks only: blank or near-uniform images, and a figure that runs into the frame edge (possible cropped head or feet).
/// These catch obvious failures; they do not prove identity or anatomy, which still need a person's review.
pub fn qa_pixels(img: &image::RgbImage, full_body: bool) -> ImageQa {
    let (w, h) = img.dimensions();
    let count = (w * h) as f32;
    let mean = img.pixels().map(luma).sum::<f32>() / count;
    let spread = (img.pixels().map(|p| (luma(p) - mean).powi(2)).sum::<f32>() / count).sqrt();
    let band = (h / 100).max(2);
    let side = (w / 100).max(2);
    // Each edge is compared with its own typical tone, so a smooth studio gradient or floor shadow is not mistaken for a figure touching the frame.
    let frac = |pixels: &mut dyn Iterator<Item = &image::Rgb<u8>>| { let mut lumas: Vec<f32> = pixels.map(luma).collect(); if lumas.is_empty() { return 0.0; } let mut sorted = lumas.clone(); sorted.sort_by(|a, b| a.total_cmp(b)); let median = sorted[sorted.len() / 2]; lumas.retain(|l| (l - median).abs() > 36.0); lumas.len() as f32 / sorted.len() as f32 };
    let top = frac(&mut (0..band).flat_map(|y| (0..w).map(move |x| (x, y))).map(|(x, y)| img.get_pixel(x, y)));
    let bottom = frac(&mut (h - band..h).flat_map(|y| (0..w).map(move |x| (x, y))).map(|(x, y)| img.get_pixel(x, y)));
    let left = frac(&mut (0..side).flat_map(|x| (0..h).map(move |y| (x, y))).map(|(x, y)| img.get_pixel(x, y)));
    let right = frac(&mut (w - side..w).flat_map(|x| (0..h).map(move |y| (x, y))).map(|(x, y)| img.get_pixel(x, y)));
    let (touches_top, touches_bottom, touches_sides) = (top > 0.04, bottom > 0.04, left > 0.04 || right > 0.04);
    let mut notes = Vec::new();
    if spread < 6.0 { notes.push("The image is almost a single flat tone: it may be blank or failed.".to_string()); }
    if full_body && touches_top { notes.push("Something touches the top edge: the head may be cropped.".to_string()); }
    if full_body && touches_bottom { notes.push("Something touches the bottom edge: the feet may be cropped.".to_string()); }
    if full_body && touches_sides { notes.push("Something touches a side edge: hands or props may be cropped.".to_string()); }
    ImageQa { width: w, height: h, mean_luma: mean, luma_spread: spread, subject_touches_top: touches_top, subject_touches_bottom: touches_bottom, subject_touches_sides: touches_sides, notes }
}

/// The colour of a picture's background, as the middle value of the pixels along its outer edge (top, left and right, and the bottom corners), so a figure
/// standing in the middle, or touching one edge, does not change it. Returns "#rrggbb".
pub fn border_colour(img: &image::RgbImage) -> String {
    let (w, h) = img.dimensions();
    let band = ((w.min(h) as f32 * 0.06).round() as u32).max(1);
    let mut channels: [Vec<u8>; 3] = [Vec::new(), Vec::new(), Vec::new()];
    for y in 0..h {
        for x in 0..w {
            let on_top = y < band;
            let on_side = x < band || x >= w - band;
            let on_bottom_corner = y >= h - band && (x < w / 5 || x >= w - w / 5);
            if on_top || on_side || on_bottom_corner {
                let p = img.get_pixel(x, y);
                for c in 0..3 { channels[c].push(p[c]); }
            }
        }
    }
    let mid = |v: &mut Vec<u8>| { v.sort_unstable(); v.get(v.len() / 2).copied().unwrap_or(0) };
    let [mut r, mut g, mut b] = channels;
    format!("#{:02x}{:02x}{:02x}", mid(&mut r), mid(&mut g), mid(&mut b))
}

/// The background colour of a picture this app saved, so a new view can be asked to keep the same backdrop as the person's own front view.
#[tauri::command]
pub fn backdrop_colour(app: tauri::AppHandle, path: String) -> Result<String, String> {
    let file = inside_assets(&app, &path)?;
    let img = image::open(&file).map_err(|e| format!("Could not read the picture: {e}"))?;
    let (w, h) = img.dimensions();
    if w < 16 || h < 16 { return Err("The image is too small to read a backdrop from".into()); }
    Ok(border_colour(&img.to_rgb8()))
}

#[tauri::command]
pub fn qa_image(app: tauri::AppHandle, path: String, full_body: bool) -> Result<ImageQa, String> {
    let file = inside_assets(&app, &path)?;
    let img = image::open(&file).map_err(|e| e.to_string())?;
    let (w, h) = img.dimensions();
    if w < 16 || h < 16 { return Err("The image is too small to check".into()); }
    Ok(qa_pixels(&img.to_rgb8(), full_body))
}

#[cfg(test)]
mod tests {
    #[test]
    fn reads_the_backdrop_colour_from_the_edge_and_ignores_a_figure_in_the_middle() {
        let teal = image::Rgb([30u8, 74, 82]);
        let mut img = image::RgbImage::from_pixel(200, 300, teal);
        for y in 60..300 { for x in 70..130 { img.put_pixel(x, y, image::Rgb([240, 240, 240])); } }
        assert_eq!(super::border_colour(&img), "#1e4a52");
    }

    #[test]
    fn a_figure_touching_the_bottom_edge_does_not_change_the_backdrop() {
        let grey = image::Rgb([128u8, 128, 128]);
        let mut img = image::RgbImage::from_pixel(120, 120, grey);
        for y in 20..120 { for x in 50..70 { img.put_pixel(x, y, image::Rgb([0, 0, 0])); } }
        assert_eq!(super::border_colour(&img), "#808080");
    }

    #[test]
    fn says_which_files_are_not_on_this_computer() {
        let dir = std::env::temp_dir().join(format!("po-missing-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let here = dir.join("here.png");
        std::fs::write(&here, b"x").unwrap();
        let gone = dir.join("gone.png");
        let asked = vec![here.to_string_lossy().into_owned(), gone.to_string_lossy().into_owned(), dir.to_string_lossy().into_owned()];
        let missing = super::missing_files(asked);
        assert_eq!(missing, vec![gone.to_string_lossy().into_owned(), dir.to_string_lossy().into_owned()], "a folder is not a picture either");
        let _ = std::fs::remove_dir_all(dir);
    }

    #[test]
    fn a_labelled_image_can_only_be_a_new_png_directly_inside_the_assets_folder() {
        let root = std::env::temp_dir().join(format!("po-assets-{}", std::process::id()));
        let other = std::env::temp_dir().join(format!("po-other-{}", std::process::id()));
        std::fs::create_dir_all(&root).unwrap();
        std::fs::create_dir_all(&other).unwrap();
        let ok = root.join("hero-labeled.png");
        assert_eq!(super::new_png_inside(&root, ok.to_str().unwrap()).unwrap().file_name().unwrap(), "hero-labeled.png");
        for bad in [other.join("x.png"), root.join("x.exe"), root.join("x.json"), root.join(".hidden.png"), root.join("sub").join("x.png"), root.join("..").join("x.png")] {
            assert!(super::new_png_inside(&root, bad.to_str().unwrap()).is_err(), "{}", bad.display());
        }
        let _ = std::fs::remove_dir_all(&root);
        let _ = std::fs::remove_dir_all(&other);
    }

    #[test]
    fn only_small_audio_files_may_be_read() {
        for ok in ["wav", "MP3", "m4a", "ogg", "flac", "aac"] { assert!(super::clip_allowed(ok, 1_000).is_ok(), "{ok}"); }
        for bad in ["exe", "json", "png", "txt", "", "wav.exe"] { assert!(super::clip_allowed(bad, 1_000).is_err(), "{bad}"); }
        assert!(super::clip_allowed("wav", 64 * 1024 * 1024).is_ok());
        assert!(super::clip_allowed("wav", 64 * 1024 * 1024 + 1).is_err());
    }

    use super::*;

    #[test]
    fn a_compiled_2d_style_reaches_every_provider_request_unchanged() {
        let prompt = "Production reference image: Front of the character Mira.
2D art style \"Flat vector\" (Graphic and vector): Clean flat vector shapes. Line: none. Avoid: gradients and soft shading; 3D, glossy or photographic look.
The background is one flat, uniform neutral mid-grey field.";
        assert_eq!(openai_body("gpt-image-1", prompt, "3:4", "low").unwrap()["prompt"], prompt);
        assert_eq!(fal_body(prompt, "3:4").unwrap()["prompt"], prompt);
        let refs = vec![("image/png".to_string(), "QUJD".to_string())];
        let gemini = gemini_body(prompt, "3:4", &refs);
        assert_eq!(gemini["contents"][0]["parts"][0]["text"], prompt);
        let router = openrouter_body("google/x", prompt, "3:4", &refs);
        assert_eq!(router["messages"][0]["content"][0]["text"], prompt);
        let inter = interactions_body("gemini-3", prompt, "3:4", &refs);
        assert!(inter.to_string().contains("2D art style"), "{inter}");
        assert!(inter.to_string().contains("Avoid: gradients"));
    }

    #[test]
    fn wide_and_decimal_ratios_reach_each_provider_as_one_it_accepts() {
        assert_eq!(openai_body("gpt-image-1", "p", "2.39:1", "low").unwrap()["size"], "1536x1024");
        assert_eq!(openai_body("gpt-image-1", "p", "21:9", "low").unwrap()["size"], "1536x1024");
        assert_eq!(openai_body("gpt-image-1", "p", "9:16", "low").unwrap()["size"], "1024x1536");
        assert_eq!(fal_body("p", "21:9").unwrap()["image_size"], "landscape_16_9");
        assert_eq!(fal_body("p", "2:3").unwrap()["image_size"], "portrait_4_3");
        assert!(fal_body("p", "wide").is_err());
        assert_eq!(gemini_body("p", "21:9", &[])["generationConfig"]["imageConfig"]["aspectRatio"], "21:9");
        assert_eq!(gemini_body("p", "2.39:1", &[])["generationConfig"]["imageConfig"]["aspectRatio"], "21:9");
        assert_eq!(gemini_body("p", "2:1", &[])["generationConfig"]["imageConfig"]["aspectRatio"], "16:9");
        assert_eq!(openrouter_body("m", "p", "2.39:1", &[])["image_config"]["aspect_ratio"], "21:9");
        assert_eq!(aspect_ratio_f("2.39:1").map(|r| (r * 100.0).round()), Some(239.0));
        assert!(aspect_ratio_f("0:1").is_none());
    }

    #[test]
    fn crops_a_nearby_shape_to_the_one_asked_for_and_leaves_a_match_alone() {
        let mut png = std::io::Cursor::new(Vec::new());
        image::DynamicImage::new_rgb8(1536, 1024).write_to(&mut png, image::ImageFormat::Png).unwrap();
        let png = png.into_inner();
        let out = crop_to_aspect(&png, "21:9").expect("a 3:2 picture is cropped to 21:9");
        let img = image::load_from_memory(&out).unwrap();
        assert_eq!(img.width(), 1536);
        assert!((img.height() as i32 - 658).abs() <= 1);
        let tall = crop_to_aspect(&png, "9:16").unwrap();
        let t = image::load_from_memory(&tall).unwrap();
        assert_eq!(t.height(), 1024);
        assert!((t.width() as i32 - 576).abs() <= 1);
        assert!(crop_to_aspect(&png, "3:2").is_none());
        assert!(crop_to_aspect(&png, "nonsense").is_none());
    }

    #[test]
    fn builds_provider_bodies_from_the_documented_shapes() {
        assert_eq!(openai_body("gpt-image-1", "p", "3:4", "high").unwrap()["size"], "1024x1536");
        assert_eq!(openai_body("gpt-image-1", "p", "16:9", "low").unwrap()["size"], "1536x1024");
        assert!(openai_body("gpt-image-1", "p", "1:1", "ultra").is_err());
        let refs = vec![("image/png".to_string(), "QUJD".to_string())];
        let gemini = gemini_body("p", "3:4", &refs);
        assert_eq!(gemini["contents"][0]["parts"].as_array().unwrap().len(), 2);
        assert_eq!(gemini["generationConfig"]["imageConfig"]["aspectRatio"], "3:4");
        let router = openrouter_body("google/x", "p", "1:1", &refs);
        assert_eq!(router["modalities"][0], "image");
        assert!(router["messages"][0]["content"][1]["image_url"]["url"].as_str().unwrap().starts_with("data:image/png;base64,"));
        assert_eq!(fal_body("p", "9:16").unwrap()["image_size"], "portrait_16_9");
        assert!(fal_body("p", "nonsense").is_err());
    }

    #[test]
    fn extracts_images_and_reports_refusals() {
        let png = ENGINE.encode([137u8, 80, 78, 71]);
        assert_eq!(extract_openai(&json!({"data":[{"b64_json": png}]})).unwrap(), vec![137, 80, 78, 71]);
        assert!(extract_openai(&json!({})).is_err());
        assert!(extract_gemini(&json!({"candidates":[{"content":{"parts":[{"text":"no"},{"inlineData":{"data": png}}]}}]})).is_ok());
        assert!(extract_gemini(&json!({"promptFeedback":{"blockReason":"SAFETY"}})).unwrap_err().contains("SAFETY"));
        assert!(extract_gemini(&json!({"candidates":[{"content":{"parts":[{"text":"sorry"}]}}]})).is_err());
        let url = format!("data:image/png;base64,{png}");
        assert!(extract_openrouter(&json!({"choices":[{"message":{"images":[{"image_url":{"url": url}}]}}]})).is_ok());
        assert!(extract_openrouter(&json!({"choices":[{"message":{}}]})).is_err());
    }

    #[test]
    fn calls_gemini_three_models_through_interactions_and_reads_either_response_shape() {
        assert!(uses_interactions("gemini-nano-banana-2.1") && uses_interactions("gemini-3-pro-image") && !uses_interactions("gemini-2.5-flash-image"));
        let body = interactions_body("gemini-nano-banana-2.1", "p", "3:4", &[("image/png".to_string(), "QUJD".to_string())]);
        assert_eq!(body["input"][1]["type"], "image");
        assert_eq!(body["response_format"]["aspect_ratio"], "3:4");
        let png = ENGINE.encode([137u8, 80, 78, 71]);
        assert!(extract_interactions(&json!({"interaction":{"output_image":{"data": png}}})).is_ok());
        assert!(extract_interactions(&json!({"steps":[{"content":[{"type":"image","data": png}]}]})).is_ok());
        assert!(extract_interactions(&json!({})).is_err());
    }

    #[test]
    fn only_trusts_fals_own_https_hosts() {
        assert!(is_trusted_fal_url("https://v3.fal.media/files/a.png"));
        assert!(!is_trusted_fal_url("http://v3.fal.media/a.png"));
        assert!(!is_trusted_fal_url("https://fal.media.evil.com/a.png"));
        assert!(!is_trusted_fal_url("https://evil.com/fal.media/a.png"));
        assert!(!is_trusted_fal_url("https://fal.media@evil.com/a.png"));
        assert!(!is_trusted_fal_url("https://127.0.0.1/a.png"));
    }

    #[test]
    fn imports_only_real_images_byte_for_byte() {
        let dir = std::env::temp_dir().join(format!("po-import-{}", std::process::id()));
        let out = dir.join("assets");
        fs::create_dir_all(&dir).unwrap();
        let mut img = image::RgbImage::new(64, 48);
        for p in img.pixels_mut() { *p = image::Rgb([200, 120, 40]); }
        let src = dir.join("My Actor (final).png");
        img.save(&src).unwrap();
        let copied = copy_supplied_image(&src, &out).unwrap();
        assert_eq!(fs::read(&src).unwrap(), fs::read(&copied).unwrap());
        assert!(copied.file_name().unwrap().to_string_lossy().ends_with("_yours.png"));
        let again = copy_supplied_image(&src, &out).unwrap();
        assert_ne!(copied, again);
        let fake = dir.join("note.png");
        fs::write(&fake, b"not an image").unwrap();
        assert!(copy_supplied_image(&fake, &out).is_err());
        assert!(copy_supplied_image(&dir.join("missing.png"), &out).is_err());
        let _ = fs::remove_dir_all(dir);
    }

    #[test]
    fn validates_model_ids() {
        assert!(valid_model_id("fal", "fal-ai/flux/dev"));
        assert!(!valid_model_id("fal", "flux"));
        assert!(!valid_model_id("google", "../etc"));
        assert!(!valid_model_id("openai", "gpt image"));
    }

    #[test]
    fn parses_model_lists() {
        let google = json!({"models":[{"name":"models/gemini-2.5-flash-image","displayName":"Gemini Flash Image"},{"name":"models/gemini-pro"}]});
        let found = parse_models("google", &google);
        assert_eq!(found.len(), 1);
        assert_eq!(found[0].id, "gemini-2.5-flash-image");
        let openai = json!({"data":[{"id":"gpt-image-1"},{"id":"gpt-4o"}]});
        assert_eq!(parse_models("openai", &openai).len(), 1);
        assert!(parse_models("fal", &json!({})).is_empty());
    }

    #[test]
    fn scan_finds_pictures_by_name_in_nested_folders_and_ignores_the_rest() {
        let root = std::env::temp_dir().join(format!("po_scan_{}", std::process::id()));
        let _ = fs::remove_dir_all(&root);
        fs::create_dir_all(root.join("a/b")).unwrap();
        fs::create_dir_all(root.join("long/deeper/still")).unwrap();
        fs::write(root.join("a/b/Marcus_Front_v01.PNG"), b"x").unwrap();
        fs::write(root.join("long/deeper/still/Marcus_Front_v01.png"), b"x").unwrap();
        fs::write(root.join("amina_side.jpg"), b"x").unwrap();
        fs::write(root.join("amina_side.txt"), b"x").unwrap();
        fs::write(root.join("other.png"), b"x").unwrap();
        let found = scan_for_pictures(&root, &["marcus_front_v01".to_string(), "AMINA_SIDE".to_string(), "missing_one".to_string()]);
        let _ = fs::remove_dir_all(&root);
        assert_eq!(found.len(), 2);
        assert_eq!(found[0].name, "amina_side");
        assert!(found[0].path.ends_with("amina_side.jpg"));
        assert_eq!(found[1].name, "marcus_front_v01");
        assert!(found[1].path.contains("a") && found[1].path.to_lowercase().ends_with("marcus_front_v01.png") && !found[1].path.contains("long"));
    }
    #[test]
    fn scan_of_a_folder_that_is_not_there_finds_nothing() {
        assert!(scan_for_pictures(Path::new("Z:/definitely/not/here"), &["x".to_string()]).is_empty());
    }
    #[test]
    fn qa_flags_blank_images_and_cropped_figures() {
        let blank = image::RgbImage::from_pixel(200, 300, image::Rgb([128, 128, 128]));
        assert!(qa_pixels(&blank, true).notes.iter().any(|n| n.contains("flat")));
        let mut ok = image::RgbImage::from_pixel(200, 300, image::Rgb([235, 235, 235]));
        for y in 40..260 { for x in 70..130 { ok.put_pixel(x, y, image::Rgb([30, 30, 40])); } }
        assert!(qa_pixels(&ok, true).notes.is_empty());
        let mut cropped = ok.clone();
        for y in 260..300 { for x in 70..130 { cropped.put_pixel(x, y, image::Rgb([30, 30, 40])); } }
        let report = qa_pixels(&cropped, true);
        assert!(report.subject_touches_bottom && report.notes.iter().any(|n| n.contains("feet")));
        assert!(qa_pixels(&cropped, false).notes.is_empty());
    }
    #[test]
    fn qa_ignores_smooth_backdrop_gradients() {
        let mut img = image::RgbImage::new(200, 300);
        for y in 0..300u32 { for x in 0..200u32 { let v = (150 + y / 4 + x / 8) as u8; img.put_pixel(x, y, image::Rgb([v, v, v])); } }
        for y in 40..260 { for x in 70..130 { img.put_pixel(x, y, image::Rgb([20, 20, 30])); } }
        assert!(qa_pixels(&img, true).notes.is_empty(), "{:?}", qa_pixels(&img, true).notes);
    }
}
