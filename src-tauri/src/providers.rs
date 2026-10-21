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

pub fn aspect_ratio_value(aspect: &str) -> Option<(u32, u32)> {
    let (w, h) = aspect.split_once(':')?;
    let (w, h) = (w.parse::<u32>().ok()?, h.parse::<u32>().ok()?);
    (w > 0 && h > 0 && w <= 32 && h <= 32).then_some((w, h))
}

fn openai_size(aspect: &str) -> Result<&'static str, String> {
    let (w, h) = aspect_ratio_value(aspect).ok_or("Unsupported aspect ratio")?;
    Ok(match w.cmp(&h) { std::cmp::Ordering::Equal => "1024x1024", std::cmp::Ordering::Greater => "1536x1024", std::cmp::Ordering::Less => "1024x1536" })
}

fn fal_size(aspect: &str) -> Result<&'static str, String> {
    Ok(match aspect {
        "1:1" => "square_hd",
        "4:3" => "landscape_4_3",
        "3:4" => "portrait_4_3",
        "16:9" => "landscape_16_9",
        "9:16" => "portrait_16_9",
        _ => return Err("fal.ai supports the aspect ratios 1:1, 4:3, 3:4, 16:9 and 9:16".into()),
    })
}

fn image_data_url(path: &str) -> Result<(String, String), String> {
    let bytes = fs::read(path).map_err(|error| format!("Could not read reference image: {error}"))?;
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
    json!({ "contents": [{ "parts": parts }], "generationConfig": { "responseModalities": ["TEXT", "IMAGE"], "imageConfig": { "aspectRatio": aspect } } })
}

pub fn openrouter_body(model: &str, prompt: &str, aspect: &str, references: &[(String, String)]) -> Value {
    let mut content = vec![json!({ "type": "text", "text": prompt })];
    for (mime, data) in references { content.push(json!({ "type": "image_url", "image_url": { "url": format!("data:{mime};base64,{data}") } })); }
    json!({ "model": model, "messages": [{ "role": "user", "content": content }], "modalities": ["image", "text"], "image_config": { "aspect_ratio": aspect } })
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

fn key_for(provider: &str) -> Result<String, String> {
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

#[tauri::command]
pub async fn generate_image(app: tauri::AppHandle, provider: String, model: String, prompt: String, aspect: String, quality: String, references: Vec<String>, output_name: String) -> Result<ImportedAsset, String> {
    if prompt.trim().is_empty() { return Err("Prompt is required".into()); }
    if !valid_model_id(&provider, &model) { return Err("That model id is not valid".into()); }
    if references.len() > 8 { return Err("At most 8 reference images are sent with one request".into()); }
    let stem = safe_package_name(&output_name);
    if stem.is_empty() { return Err("Output name is required".into()); }
    let api_key = key_for(&provider)?;
    let refs = references.iter().map(|path| image_data_url(path)).collect::<Result<Vec<_>, _>>()?;
    let http = client()?;
    let bytes = match provider.as_str() {
        "openai" => {
            if !refs.is_empty() { return Err("Reference images are not wired for OpenAI yet. Use Google Gemini or OpenRouter for reference-based sheets.".into()); }
            let body = send_json(http.post("https://api.openai.com/v1/images/generations").bearer_auth(&api_key).json(&openai_body(&model, &prompt, &aspect, &quality)?), "OpenAI").await?;
            extract_openai(&body)?
        }
        "google" => {
            let url = format!("https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent");
            let body = send_json(http.post(url).header("x-goog-api-key", &api_key).json(&gemini_body(&prompt, &aspect, &refs)), "Google Gemini").await?;
            extract_gemini(&body)?
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
pub struct DiscoveredModel { id: String, name: String }

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

/// Reads the provider's own model list (where it has one) and keeps it beside the app's built-in catalog. A failure changes nothing.
#[tauri::command]
pub async fn discover_models(app: tauri::AppHandle, provider: String) -> Result<Value, String> {
    let http = client()?;
    let body = match provider.as_str() {
        "openrouter" => send_json(http.get("https://openrouter.ai/api/v1/models?output_modalities=image").bearer_auth(key_for("openrouter")?), "OpenRouter").await?,
        "openai" => send_json(http.get("https://api.openai.com/v1/models").bearer_auth(key_for("openai")?), "OpenAI").await?,
        "google" => send_json(http.get("https://generativelanguage.googleapis.com/v1beta/models?pageSize=200").header("x-goog-api-key", key_for("google")?), "Google").await?,
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

fn inside_assets(app: &tauri::AppHandle, path: &str) -> Result<PathBuf, String> {
    let assets = app.path().app_data_dir().map_err(|e| e.to_string())?.join("assets");
    let canonical = fs::canonicalize(path).map_err(|e| format!("Could not open the image: {e}"))?;
    let root = fs::canonicalize(&assets).map_err(|e| e.to_string())?;
    if canonical.starts_with(&root) { Ok(canonical) } else { Err("Only images in the Production One assets folder can be previewed".into()) }
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
    let corners = [img.get_pixel(2, 2), img.get_pixel(w - 3, 2), img.get_pixel(2, h - 3), img.get_pixel(w - 3, h - 3)];
    let background = corners.iter().map(|p| luma(p)).sum::<f32>() / 4.0;
    let differs = |p: &image::Rgb<u8>| (luma(p) - background).abs() > 28.0;
    let band = (h / 100).max(2);
    let side = (w / 100).max(2);
    let frac = |pixels: &mut dyn Iterator<Item = &image::Rgb<u8>>| { let (mut n, mut hit) = (0u32, 0u32); for p in pixels { n += 1; if differs(p) { hit += 1; } } if n == 0 { 0.0 } else { hit as f32 / n as f32 } };
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
    use super::*;

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
        assert!(fal_body("p", "5:7").is_err());
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
    fn only_trusts_fals_own_https_hosts() {
        assert!(is_trusted_fal_url("https://v3.fal.media/files/a.png"));
        assert!(!is_trusted_fal_url("http://v3.fal.media/a.png"));
        assert!(!is_trusted_fal_url("https://fal.media.evil.com/a.png"));
        assert!(!is_trusted_fal_url("https://evil.com/fal.media/a.png"));
        assert!(!is_trusted_fal_url("https://fal.media@evil.com/a.png"));
        assert!(!is_trusted_fal_url("https://127.0.0.1/a.png"));
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
}
