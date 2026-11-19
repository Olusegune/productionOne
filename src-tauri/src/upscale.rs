//! Upscaling an image into a new, larger file next to the original: Topaz (through the Kie.ai key), Magnific (its own key) or Real-ESRGAN (free, through ComfyUI).
//! The original is never changed. A paid method spends only when the person presses its button; nothing here runs on its own.

use std::io::Cursor;
use std::path::{Path, PathBuf};
use std::time::Duration;

use base64::{engine::general_purpose::STANDARD as ENGINE, Engine};
use image::{imageops::FilterType, DynamicImage, ImageFormat};
use serde_json::{json, Value};

use crate::cleanrender::Saved;

/// The largest output, in pixels, a paid method is asked for (Magnific's own limit is 25.3 million).
const MAX_PIXELS: u64 = 25_000_000;
/// Topaz takes up to 10 MB per image.
const TOPAZ_MAX_BYTES: usize = 9_500_000;
const MAGNIFIC_MAX_BYTES: usize = 20_000_000;

pub fn valid_factor(factor: u32) -> Result<u32, String> {
    match factor { 2 | 4 => Ok(factor), _ => Err("Choose 2x or 4x.".to_string()) }
}

/// The three Magnific Precision V2 flavours; anything else becomes `photo`.
pub fn magnific_flavor(flavor: &str) -> &'static str {
    match flavor { "sublime" => "sublime", "photo_denoiser" => "photo_denoiser", _ => "photo" }
}

pub fn topaz_body(image_url: &str, factor: u32) -> Value {
    json!({ "model": "topaz/image-upscale", "input": { "image_url": image_url, "upscale_factor": factor.to_string() } })
}

pub fn magnific_body(image_base64: &str, factor: u32, flavor: &str) -> Value {
    json!({ "image": image_base64, "scale_factor": factor, "flavor": magnific_flavor(flavor), "sharpen": 7, "smart_grain": 7, "ultra_detail": 30 })
}

/// Magnific's task record: the finished picture's address, nothing yet while it works, or the reason it failed.
pub fn magnific_result(record: &Value) -> Result<Option<String>, String> {
    let data = if record["data"].is_null() { record } else { &record["data"] };
    match data["status"].as_str() {
        Some("COMPLETED") => data["generated"][0].as_str().map(|u| Some(u.to_string())).ok_or_else(|| "Magnific finished but returned no picture".to_string()),
        Some("FAILED") => Err("Magnific could not upscale this picture".to_string()),
        _ => Ok(None),
    }
}

fn mime_of(bytes: &[u8]) -> Option<&'static str> {
    match image::guess_format(bytes).ok()? { ImageFormat::Png => Some("image/png"), ImageFormat::Jpeg => Some("image/jpeg"), ImageFormat::WebP => Some("image/webp"), _ => None }
}

/// The picture as it will be sent: unchanged if it is a PNG, JPEG or WebP within the limit, otherwise re-encoded as a high-quality JPEG that fits.
pub fn prepare(bytes: Vec<u8>, max_bytes: usize) -> Result<(Vec<u8>, &'static str), String> {
    let mime = mime_of(&bytes).ok_or("Only PNG, JPEG and WebP pictures can be upscaled")?;
    if bytes.len() <= max_bytes { return Ok((bytes, mime)); }
    let rgb = image::load_from_memory(&bytes).map_err(|e| format!("Could not read the picture: {e}"))?.to_rgb8();
    for quality in [92u8, 85, 75] {
        let mut out = Vec::new();
        image::codecs::jpeg::JpegEncoder::new_with_quality(&mut out, quality).encode_image(&DynamicImage::ImageRgb8(rgb.clone())).map_err(|e| e.to_string())?;
        if out.len() <= max_bytes { return Ok((out, "image/jpeg")); }
    }
    Err("The picture is too large to send. Make it smaller first.".to_string())
}

/// The file name sent with an upload. Kie's upscaler decides what the file is from its extension, so it must have one that matches the picture.
pub fn upload_name(mime: &str) -> &'static str {
    match mime { "image/jpeg" => "upscale-source.jpg", "image/webp" => "upscale-source.webp", _ => "upscale-source.png" }
}

fn dimensions(bytes: &[u8]) -> Result<(u32, u32), String> {
    image::ImageReader::new(Cursor::new(bytes)).with_guessed_format().map_err(|e| e.to_string())?.into_dimensions().map_err(|e| format!("Could not read the picture's size: {e}"))
}

/// Refuses before anything is spent if the result would be too big.
pub fn check_output_size(width: u32, height: u32, factor: u32, longest_edge: Option<u32>) -> Result<(), String> {
    let (w, h) = (width as u64 * factor as u64, height as u64 * factor as u64);
    if let Some(edge) = longest_edge { if w.max(h) > edge as u64 { return Err(format!("{factor}x of this picture would be {w} by {h} pixels, more than the {edge} pixel limit. Choose 2x or use a smaller picture.")); } }
    if w * h > MAX_PIXELS { return Err(format!("{factor}x of this picture would be {w} by {h} pixels (over {} million). Choose 2x or use a smaller picture.", MAX_PIXELS / 1_000_000)); }
    Ok(())
}

fn extension_of(bytes: &[u8]) -> Result<&'static str, String> {
    match image::guess_format(bytes) { Ok(ImageFormat::Png) => Ok("png"), Ok(ImageFormat::Jpeg) => Ok("jpg"), Ok(ImageFormat::WebP) => Ok("webp"), _ => Err("The service did not return a readable picture".to_string()) }
}

/// Next free `<name>_up_NN.<ext>` beside the original.
pub fn up_path(original: &Path, ext: &str) -> PathBuf {
    let stem = original.file_stem().map(|s| s.to_string_lossy().into_owned()).unwrap_or_else(|| "image".into());
    let base = stem.split("_up_").next().unwrap_or(&stem).to_string();
    let dir = original.parent().map(Path::to_path_buf).unwrap_or_default();
    (1..1000).map(|n| dir.join(format!("{base}_up_{n:02}.{ext}"))).find(|p| !p.exists()).unwrap_or_else(|| dir.join(format!("{base}_up_999.{ext}")))
}

fn http(secs: u64) -> Result<reqwest::Client, String> {
    reqwest::Client::builder().timeout(Duration::from_secs(secs)).build().map_err(|e| e.to_string())
}

async fn download(url: &str, service: &str) -> Result<Vec<u8>, String> {
    if !crate::kie::is_public_https(url) { return Err(format!("{service} returned an address that is not a public https address, so it was not downloaded")); }
    let response = http(300)?.get(url).send().await.map_err(|e| format!("Could not download the {service} result: {}", e.without_url()))?;
    if !response.status().is_success() { return Err(format!("Could not download the {service} result ({})", response.status().as_u16())); }
    let bytes = response.bytes().await.map_err(|e| e.to_string())?.to_vec();
    if bytes.len() > 120 * 1024 * 1024 { return Err(format!("The {service} result is larger than 120 MB")); }
    Ok(bytes)
}

async fn topaz(api_key: &str, bytes: Vec<u8>, factor: u32) -> Result<Vec<u8>, String> {
    let (data, mime) = prepare(bytes, TOPAZ_MAX_BYTES)?;
    let client = http(120)?;
    let upload = json!({ "base64Data": format!("data:{mime};base64,{}", ENGINE.encode(&data)), "uploadPath": "production-one", "fileName": upload_name(mime) });
    let up = crate::kie::kie_json(client.post("https://kieai.redpandaai.co/api/file-base64-upload").bearer_auth(api_key).json(&upload)).await?;
    let d = if up["data"].is_null() { &up } else { &up["data"] };
    let url = d["downloadUrl"].as_str().or_else(|| d["fileUrl"].as_str()).or_else(|| d["url"].as_str()).ok_or("Kie's file upload returned no address")?.to_string();
    let created = crate::kie::kie_json(client.post("https://api.kie.ai/api/v1/jobs/createTask").bearer_auth(api_key).json(&topaz_body(&url, factor))).await?;
    let task = created["data"]["taskId"].as_str().ok_or("Kie.ai did not return a task id")?.to_string();
    let started = std::time::Instant::now();
    let result = loop {
        tokio::time::sleep(Duration::from_secs(4)).await;
        let record = crate::kie::kie_json(client.get("https://api.kie.ai/api/v1/jobs/recordInfo").bearer_auth(api_key).query(&[("taskId", task.as_str())])).await?;
        if let Some(url) = crate::kie::result_url(&record)? { break url; }
        if started.elapsed().as_secs() > 300 { return Err(format!("Kie.ai had not finished after 300 seconds. The task ({task}) may still complete and be billed; check your Kie dashboard.")); }
    };
    download(&result, "Kie.ai").await
}

async fn magnific(api_key: &str, bytes: Vec<u8>, factor: u32, flavor: &str) -> Result<Vec<u8>, String> {
    let (data, _) = prepare(bytes, MAGNIFIC_MAX_BYTES)?;
    let client = http(120)?;
    let send = |req: reqwest::RequestBuilder| async move {
        let response = req.header("x-magnific-api-key", api_key).send().await.map_err(|e| format!("Magnific could not be reached: {}", e.without_url()))?;
        let status = response.status();
        let body: Value = response.json().await.unwrap_or(Value::Null);
        if !status.is_success() {
            let msg = body["message"].as_str().or_else(|| body["error"]["message"].as_str()).unwrap_or("no details");
            return Err(format!("Magnific request failed ({}): {}", status.as_u16(), msg.chars().take(300).collect::<String>()));
        }
        Ok(body)
    };
    let base = "https://api.magnific.com/v1/ai/image-upscaler-precision-v2";
    let created = send(client.post(base).json(&magnific_body(&ENGINE.encode(&data), factor, flavor))).await?;
    let task = created["data"]["task_id"].as_str().ok_or("Magnific did not return a task id")?.to_string();
    let started = std::time::Instant::now();
    let result = loop {
        tokio::time::sleep(Duration::from_secs(4)).await;
        let record = send(client.get(format!("{base}/{task}"))).await?;
        if let Some(url) = magnific_result(&record)? { break url; }
        if started.elapsed().as_secs() > 420 { return Err(format!("Magnific had not finished after 420 seconds. The task ({task}) may still complete and be billed; check your Magnific account.")); }
    };
    download(&result, "Magnific").await
}

async fn local(app: &tauri::AppHandle, path: &str, factor: u32) -> Result<Vec<u8>, String> {
    let request = crate::local::ComfyRequest { base: crate::local::comfy_base(app), model: "upscale-esrgan".into(), prompt: String::new(), negative: String::new(), aspect: "1:1".into(), seed: None, image: Some(path.to_string()), duration: 0.0, max_side: 1024.0, wait_secs: 900 };
    let (bytes, ext) = crate::local::comfy_run(app, request).await?;
    if ext == "mp4" || ext == "webm" { return Err("ComfyUI returned a video, not a picture".to_string()); }
    // The model enlarges 4x. For 2x the result is brought back down with a smooth filter, which is sharper than enlarging a small picture.
    if factor == 2 {
        let img = image::load_from_memory(&bytes).map_err(|e| format!("Could not read the ComfyUI result: {e}"))?;
        let small = img.resize_exact((img.width() / 2).max(1), (img.height() / 2).max(1), FilterType::Lanczos3);
        let mut out = Cursor::new(Vec::new());
        small.write_to(&mut out, ImageFormat::Png).map_err(|e| e.to_string())?;
        return Ok(out.into_inner());
    }
    Ok(bytes)
}

/// Makes a larger copy of an image and saves it as a new file beside the original. `method` is `topaz`, `magnific` or `local`.
#[tauri::command]
pub async fn upscale_image(app: tauri::AppHandle, method: String, path: String, factor: u32, flavor: Option<String>) -> Result<Saved, String> {
    let factor = valid_factor(factor)?;
    let file = crate::providers::inside_assets(&app, &path)?;
    let original = std::fs::read(&file).map_err(|e| format!("Could not read the picture: {e}"))?;
    let (w, h) = dimensions(&original)?;
    let result = match method.as_str() {
        "topaz" => { check_output_size(w, h, factor, None)?; topaz(&crate::providers::key_for("kie")?, original, factor).await? }
        "magnific" => { check_output_size(w, h, factor, None)?; magnific(&crate::providers::key_for("magnific")?, original, factor, flavor.as_deref().unwrap_or("photo")).await? }
        "local" => { check_output_size(w, h, factor, Some(8192))?; drop(original); local(&app, &file.to_string_lossy(), factor).await? }
        _ => return Err("Choose Topaz, Magnific or Real-ESRGAN.".to_string()),
    };
    let ext = extension_of(&result)?;
    let (rw, rh) = dimensions(&result)?;
    let dest = up_path(&file, ext);
    std::fs::write(&dest, &result).map_err(|e| e.to_string())?;
    Ok(Saved { path: dest.to_string_lossy().into_owned(), width: rw, height: rh })
}

#[cfg(test)]
mod tests {
    use super::*;
    use image::{Rgb, RgbImage};

    fn png(w: u32, h: u32) -> Vec<u8> {
        let mut seed = 7u32;
        let img = RgbImage::from_fn(w, h, |_, _| { seed = seed.wrapping_mul(1664525).wrapping_add(1013904223); let v = (seed >> 24) as u8; Rgb([v, v ^ 0x55, v.wrapping_add(90)]) });
        let mut out = Cursor::new(Vec::new());
        DynamicImage::ImageRgb8(img).write_to(&mut out, ImageFormat::Png).unwrap();
        out.into_inner()
    }

    #[test]
    fn the_upload_has_a_file_name_with_the_right_extension() {
        assert_eq!(upload_name("image/png"), "upscale-source.png");
        assert_eq!(upload_name("image/jpeg"), "upscale-source.jpg");
        assert_eq!(upload_name("image/webp"), "upscale-source.webp");
    }

    #[test]
    fn only_two_and_four_times_are_offered() {
        assert_eq!((valid_factor(2), valid_factor(4)), (Ok(2), Ok(4)));
        for bad in [0, 1, 3, 8, 16] { assert!(valid_factor(bad).is_err(), "{bad}"); }
    }

    #[test]
    fn builds_the_topaz_request_with_the_factor_as_text() {
        let body = topaz_body("https://files.example.com/a.png", 4);
        assert_eq!(body["model"], "topaz/image-upscale");
        assert_eq!(body["input"]["image_url"], "https://files.example.com/a.png");
        assert_eq!(body["input"]["upscale_factor"], "4");
    }

    #[test]
    fn builds_the_magnific_request_and_falls_back_to_the_photo_flavour() {
        let body = magnific_body("QUJD", 2, "sublime");
        assert_eq!((body["image"].as_str(), body["scale_factor"].as_i64(), body["flavor"].as_str()), (Some("QUJD"), Some(2), Some("sublime")));
        assert_eq!(magnific_body("QUJD", 4, "anything else")["flavor"], "photo");
        assert_eq!(magnific_flavor("photo_denoiser"), "photo_denoiser");
    }

    #[test]
    fn reads_a_magnific_task_record() {
        assert_eq!(magnific_result(&json!({ "data": { "status": "IN_PROGRESS", "generated": [] } })), Ok(None));
        assert_eq!(magnific_result(&json!({ "data": { "status": "CREATED" } })), Ok(None));
        assert_eq!(magnific_result(&json!({ "data": { "status": "COMPLETED", "generated": ["https://cdn.magnific.com/x.png"] } })), Ok(Some("https://cdn.magnific.com/x.png".to_string())));
        assert!(magnific_result(&json!({ "data": { "status": "COMPLETED", "generated": [] } })).is_err());
        assert!(magnific_result(&json!({ "data": { "status": "FAILED" } })).is_err());
    }

    #[test]
    fn leaves_a_picture_that_fits_alone_and_shrinks_one_that_does_not() {
        let small = png(40, 30);
        let (same, mime) = prepare(small.clone(), 1_000_000).unwrap();
        assert_eq!((same, mime), (small, "image/png"));
        let big = png(400, 300);
        let (jpeg, mime) = prepare(big.clone(), big.len() / 2).unwrap();
        assert_eq!(mime, "image/jpeg");
        assert!(jpeg.len() <= big.len() / 2 && image::guess_format(&jpeg).unwrap() == ImageFormat::Jpeg);
        assert!(prepare(big, 100).is_err());
        assert!(prepare(b"not a picture".to_vec(), 1_000_000).is_err());
    }

    #[test]
    fn refuses_a_result_that_is_too_big_before_anything_is_spent() {
        assert!(check_output_size(1376, 768, 2, None).is_ok());
        assert!(check_output_size(1376, 768, 4, None).is_ok());
        assert!(check_output_size(4000, 3000, 4, None).is_err());
        assert!(check_output_size(2752, 1536, 4, Some(8192)).is_err());
        assert!(check_output_size(1800, 800, 4, Some(8192)).is_ok());
        assert!(check_output_size(2000, 1000, 4, Some(8192)).is_err(), "8000 by 4000 is over 25 million pixels");
    }

    #[test]
    fn names_the_new_file_beside_the_original_and_never_overwrites() {
        let dir = std::env::temp_dir().join(format!("po-up-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let original = dir.join("SHOT-001_v01.png");
        let first = up_path(&original, "png");
        assert_eq!(first.file_name().unwrap().to_string_lossy(), "SHOT-001_v01_up_01.png");
        std::fs::write(&first, b"x").unwrap();
        assert_eq!(up_path(&original, "png").file_name().unwrap().to_string_lossy(), "SHOT-001_v01_up_02.png");
        assert_eq!(up_path(&first, "jpg").file_name().unwrap().to_string_lossy(), "SHOT-001_v01_up_01.jpg", "a copy of a copy keeps the original name");
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn reads_the_extension_from_the_bytes() {
        assert_eq!(extension_of(&png(8, 8)), Ok("png"));
        assert!(extension_of(b"nope").is_err());
    }
}
