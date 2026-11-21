//! Topaz Labs picture enhancer (https://developer.topazlabs.com). It enlarges and sharpens a picture into a NEW, larger file next to the original; the original is never
//! changed. It uses the person's own Topaz API key (kept in Windows Credential Manager under "topaz"), runs only when its button is pressed, and uses Topaz credits that
//! Topaz bills to their account. Only the non-generative "Enhance" models are offered: they enlarge and sharpen, they do not redraw the picture.

use std::path::{Path, PathBuf};
use std::time::Duration;

use serde::Serialize;
use serde_json::Value;
use tauri::Manager;

const IMAGE_BASE: &str = "https://api.topazlabs.com/image/v1";
const ACCOUNT_BASE: &str = "https://api.topazlabs.com/account/v1";
/// The models of Topaz's non-generative Enhance endpoint (as listed in the API reference).
pub const MODELS: [&str; 5] = ["Standard V2", "High Fidelity V2", "Low Resolution V2", "CGI", "Text Refine"];
const MAX_INPUT_BYTES: u64 = 100 * 1024 * 1024;
const MAX_OUTPUT_BYTES: usize = 300 * 1024 * 1024;
const MAX_SIDE: u64 = 32_000;
/// A guard so one press cannot ask for an enormous (and expensive) picture.
const MAX_OUTPUT_PIXELS: u64 = 50_000_000;
const POLL_EVERY: Duration = Duration::from_secs(3);
const GIVE_UP_AFTER: Duration = Duration::from_secs(420);

pub fn valid_model(model: &str) -> Result<&'static str, String> {
    MODELS.iter().copied().find(|m| *m == model).ok_or_else(|| "That Topaz model is not one this app offers.".to_string())
}

pub fn valid_scale(scale: u32) -> Result<u32, String> {
    match scale { 2 | 4 => Ok(scale), _ => Err("Choose 2x or 4x.".to_string()) }
}

/// The size of the result, or the reason it is refused before anything is sent (and so before anything is spent).
pub fn output_size(width: u32, height: u32, scale: u32) -> Result<(u32, u32), String> {
    if width < 16 || height < 16 { return Err("This picture is too small to enhance.".into()); }
    let (w, h) = (width as u64 * scale as u64, height as u64 * scale as u64);
    if w.max(h) > MAX_SIDE { return Err(format!("{scale}x of this picture would be {w} by {h} pixels, more than Topaz's {MAX_SIDE} pixel limit. Choose 2x or use a smaller picture.")); }
    if w * h > MAX_OUTPUT_PIXELS { return Err(format!("{scale}x of this picture would be {w} by {h} pixels (over {} million). Choose 2x or use a smaller picture.", MAX_OUTPUT_PIXELS / 1_000_000)); }
    Ok((w as u32, h as u32))
}

/// A process id is used inside a web address, so only the characters of a UUID are accepted.
pub fn safe_process_id(id: &str) -> Option<&str> {
    (!id.is_empty() && id.len() <= 64 && id.chars().all(|c| c.is_ascii_hexdigit() || c == '-')).then_some(id)
}

/// What Topaz said went wrong, in plain words (never the key, never raw JSON).
pub fn plain_error(status: u16, body: &Value) -> String {
    let said = body["message"].as_str().unwrap_or("").chars().take(200).collect::<String>();
    let base = match status {
        401 => "Topaz did not accept the key. Check it in Tools, Provider Settings.".to_string(),
        402 => "Your Topaz account has no credits left for this. Add credits on the Topaz site, then try again.".to_string(),
        403 => "Topaz refused this request (the key may not be allowed to do this).".to_string(),
        413 => "The picture is too large for Topaz.".to_string(),
        415 => "Topaz cannot read this kind of picture.".to_string(),
        422 | 400 | 412 => "Topaz did not accept the request.".to_string(),
        425 => "Topaz is not ready yet; try again in a moment.".to_string(),
        429 => "Topaz says too many requests. Wait a minute and try again.".to_string(),
        500..=599 => "Topaz had a problem on its side. Try again later.".to_string(),
        other => format!("Topaz answered with an error ({other})."),
    };
    if said.is_empty() { base } else { format!("{base} Topaz said: {said}") }
}

#[derive(Debug, PartialEq)]
pub enum Progress { Waiting(u8), Done(Option<i64>), Failed(String) }

/// Reads a status record: still working (with how far), finished (with the credits it used), or failed.
pub fn read_status(record: &Value) -> Progress {
    match record["status"].as_str() {
        Some("Completed") => Progress::Done(record["credits"].as_i64()),
        Some("Failed") => Progress::Failed("Topaz could not enhance this picture.".into()),
        Some("Cancelled") => Progress::Failed("The enhancement was cancelled.".into()),
        _ => Progress::Waiting(record["progress"].as_u64().unwrap_or(0).min(100) as u8),
    }
}

/// The name of the result next to the original: `name_topaz.png`, or `name_topaz_1.png` if that exists.
pub fn result_path(dir: &Path, source_stem: &str) -> PathBuf {
    let stem: String = source_stem.chars().map(|c| if c.is_ascii_alphanumeric() || c == '-' || c == '_' { c } else { '_' }).collect::<String>().trim_matches('_').chars().take(80).collect();
    let stem = if stem.is_empty() { "picture".to_string() } else { stem };
    let first = dir.join(format!("{stem}_topaz.png"));
    if !first.exists() { return first; }
    let mut n = 1;
    loop { let next = dir.join(format!("{stem}_topaz_{n}.png")); if !next.exists() { return next; } n += 1; }
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Enhanced { pub path: String, pub width: u32, pub height: u32, pub credits: Option<i64> }

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Balance { pub available: i64, pub reserved: i64, pub total: i64 }

fn client() -> Result<reqwest::Client, String> {
    reqwest::Client::builder().timeout(Duration::from_secs(90)).user_agent("ProductionOne").build().map_err(|e| e.to_string())
}

async fn json_of(response: reqwest::Response) -> Result<Value, String> {
    let status = response.status();
    let body: Value = response.json().await.unwrap_or(Value::Null);
    if status.is_success() { Ok(body) } else { Err(plain_error(status.as_u16(), &body)) }
}

/// How many Topaz credits the account has. Free to ask.
#[tauri::command]
pub async fn topaz_balance() -> Result<Balance, String> {
    let key = crate::providers::key_for("topaz")?;
    let response = client()?.get(format!("{ACCOUNT_BASE}/credits/balance")).header("X-API-Key", key).send().await.map_err(|e| format!("Topaz could not be reached: {}", e.without_url()))?;
    let body = json_of(response).await?;
    Ok(Balance { available: body["available_credits"].as_i64().unwrap_or(0), reserved: body["reserved_credits"].as_i64().unwrap_or(0), total: body["total_credits"].as_i64().unwrap_or(0) })
}

/// Enlarges and sharpens one picture from the app's pictures folder with Topaz and saves the result as a new file beside it. Uses Topaz credits.
#[tauri::command]
pub async fn topaz_enhance(app: tauri::AppHandle, path: String, model: String, scale: u32) -> Result<Enhanced, String> {
    let model = valid_model(&model)?;
    let scale = valid_scale(scale)?;
    let source = crate::providers::inside_assets(&app, &path)?;
    let meta = std::fs::metadata(&source).map_err(|e| e.to_string())?;
    if !meta.is_file() || meta.len() == 0 || meta.len() > MAX_INPUT_BYTES { return Err("The picture must be between 1 byte and 100 MB.".into()); }
    let bytes = std::fs::read(&source).map_err(|e| e.to_string())?;
    let (ext, mime) = match image::guess_format(&bytes).map_err(|_| "Only PNG and JPEG pictures can be enhanced.".to_string())? {
        image::ImageFormat::Png => ("png", "image/png"),
        image::ImageFormat::Jpeg => ("jpg", "image/jpeg"),
        _ => return Err("Only PNG and JPEG pictures can be enhanced.".into()),
    };
    let (width, height) = image::ImageReader::new(std::io::Cursor::new(&bytes)).with_guessed_format().map_err(|e| e.to_string())?.into_dimensions().map_err(|e| format!("Could not read the picture's size: {e}"))?;
    let (out_w, out_h) = output_size(width, height, scale)?;
    let key = crate::providers::key_for("topaz")?;
    let http = client()?;

    let form = reqwest::multipart::Form::new()
        .part("image", reqwest::multipart::Part::bytes(bytes).file_name(format!("picture.{ext}")).mime_str(mime).map_err(|e| e.to_string())?)
        .text("model", model.to_string())
        .text("output_width", out_w.to_string())
        .text("output_height", out_h.to_string())
        .text("output_format", "png".to_string());
    let started = http.post(format!("{IMAGE_BASE}/enhance/async")).header("X-API-Key", &key).multipart(form).send().await.map_err(|e| format!("Topaz could not be reached: {}", e.without_url()))?;
    let started = json_of(started).await?;
    let id = started["process_id"].as_str().and_then(safe_process_id).ok_or("Topaz did not give a usable job number.")?.to_string();

    let began = std::time::Instant::now();
    let credits = loop {
        if began.elapsed() > GIVE_UP_AFTER { return Err("Topaz is taking too long. Nothing more was sent; check your Topaz account for the job.".into()); }
        tokio::time::sleep(POLL_EVERY).await;
        let record = http.get(format!("{IMAGE_BASE}/status/{id}")).header("X-API-Key", &key).send().await.map_err(|e| format!("Topaz could not be reached: {}", e.without_url()))?;
        match read_status(&json_of(record).await?) {
            Progress::Waiting(_) => continue,
            Progress::Done(c) => break c,
            Progress::Failed(why) => return Err(why),
        }
    };

    // The finished picture can take a moment to be ready (Topaz answers "conflict" until it is).
    let mut link = None;
    for _ in 0..8 {
        let response = http.get(format!("{IMAGE_BASE}/download/{id}")).header("X-API-Key", &key).send().await.map_err(|e| format!("Topaz could not be reached: {}", e.without_url()))?;
        if response.status().as_u16() == 409 { tokio::time::sleep(POLL_EVERY).await; continue; }
        link = json_of(response).await?["download_url"].as_str().map(str::to_string);
        break;
    }
    let link = link.filter(|u| u.starts_with("https://")).ok_or("Topaz did not give a download address.")?;
    // The download address is a signed link on Topaz's storage: the key is NOT sent to it.
    let result = reqwest::Client::builder().timeout(Duration::from_secs(300)).build().map_err(|e| e.to_string())?.get(&link).send().await.map_err(|e| format!("The enhanced picture could not be downloaded: {}", e.without_url()))?;
    if !result.status().is_success() { return Err(format!("The enhanced picture could not be downloaded ({}).", result.status().as_u16())); }
    let data = result.bytes().await.map_err(|e| e.to_string())?;
    if data.is_empty() || data.len() > MAX_OUTPUT_BYTES { return Err("The enhanced picture was not a sensible size.".into()); }
    if image::guess_format(&data).ok() != Some(image::ImageFormat::Png) && image::guess_format(&data).ok() != Some(image::ImageFormat::Jpeg) { return Err("Topaz did not return a picture.".into()); }
    let decoded = image::load_from_memory(&data).map_err(|e| format!("The enhanced picture could not be read: {e}"))?;

    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?.join("assets");
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let stem = source.file_stem().map(|s| s.to_string_lossy().into_owned()).unwrap_or_default();
    let target = result_path(&dir, &stem);
    // Saved as a PNG whatever Topaz returned, so the file always matches its name.
    decoded.save_with_format(&target, image::ImageFormat::Png).map_err(|e| e.to_string())?;
    Ok(Enhanced { path: target.to_string_lossy().into_owned(), width: decoded.width(), height: decoded.height(), credits })
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn only_the_offered_models_and_scales_are_accepted() {
        assert_eq!(valid_model("Standard V2").unwrap(), "Standard V2");
        assert!(valid_model("Wonder 4").is_err());
        assert!(valid_model("Standard V2; drop").is_err());
        assert_eq!(valid_scale(2).unwrap(), 2);
        assert!(valid_scale(8).is_err());
    }

    #[test]
    fn the_size_is_checked_before_anything_is_sent() {
        assert_eq!(output_size(1024, 1536, 2).unwrap(), (2048, 3072));
        assert_eq!(output_size(2000, 3000, 4).unwrap_err().contains("million"), true);
        assert!(output_size(9000, 100, 4).unwrap_err().contains("limit"));
        assert!(output_size(8, 8, 2).is_err());
    }

    #[test]
    fn a_job_number_is_only_ever_a_uuid_shape() {
        assert!(safe_process_id("3f2b9c1e-1a2b-4c3d-8e9f-0a1b2c3d4e5f").is_some());
        assert!(safe_process_id("../../account/v1").is_none());
        assert!(safe_process_id("abc/def").is_none());
        assert!(safe_process_id("").is_none());
    }

    #[test]
    fn errors_are_plain_and_never_carry_a_key() {
        assert!(plain_error(401, &json!({})).contains("did not accept the key"));
        assert!(plain_error(402, &json!({"message": "insufficient credits"})).contains("no credits left"));
        assert!(plain_error(429, &json!({})).contains("too many requests"));
        assert!(plain_error(503, &json!({})).contains("their side") || plain_error(503, &json!({})).contains("its side"));
        assert!(plain_error(422, &json!({"message": "model not found"})).contains("Topaz said: model not found"));
        assert!(!plain_error(401, &json!({"message": "x".repeat(500)})).contains(&"x".repeat(300)));
    }

    #[test]
    fn a_status_record_says_waiting_done_or_failed() {
        assert_eq!(read_status(&json!({"status": "Processing", "progress": 40})), Progress::Waiting(40));
        assert_eq!(read_status(&json!({"status": "Pending"})), Progress::Waiting(0));
        assert_eq!(read_status(&json!({"status": "Completed", "credits": 2})), Progress::Done(Some(2)));
        assert!(matches!(read_status(&json!({"status": "Failed"})), Progress::Failed(_)));
        assert!(matches!(read_status(&json!({"status": "Cancelled"})), Progress::Failed(_)));
    }

    #[test]
    fn the_result_is_named_beside_the_original_and_never_overwrites() {
        let dir = std::env::temp_dir().join(format!("po_topaz_{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).unwrap();
        let first = result_path(&dir, "CHAR-1_front_v01");
        assert_eq!(first.file_name().unwrap().to_str().unwrap(), "CHAR-1_front_v01_topaz.png");
        std::fs::write(&first, b"x").unwrap();
        assert_eq!(result_path(&dir, "CHAR-1_front_v01").file_name().unwrap().to_str().unwrap(), "CHAR-1_front_v01_topaz_1.png");
        assert_eq!(result_path(&dir, "../evil").file_name().unwrap().to_str().unwrap(), "evil_topaz.png");
        let _ = std::fs::remove_dir_all(&dir);
    }
}
