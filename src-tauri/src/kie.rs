//! Kie.ai Market adapter for images and video. Kie publishes an OpenAPI block on every model page (https://docs.kie.ai/market/<model>.md); the request is built from
//! that block, so each model gets its own field names, aspect-ratio values, reference-image field and required settings instead of one guessed shape.
//!
//! Flow (the shape FilmCrafter has run against Kie): upload reference images to Kie's file service, POST /api/v1/jobs/createTask, poll /api/v1/jobs/recordInfo,
//! download the result. No Kie call has been made by this build yet: the parsers and builders are unit-tested, the network path is not.

use std::time::Duration;

use serde::Serialize;
use serde_json::{json, Map, Value};

use super::providers::{aspect_ratio_f, DiscoveredModel};

const IMAGE_KEYS: [&str; 7] = ["image_input", "image_urls", "input_urls", "image_url", "first_frame_url", "reference_image_urls", "image"];
const ASPECT_KEYS: [&str; 2] = ["aspect_ratio", "image_size"];
/// Optional on/off switches for a generated soundtrack. Reference clips and sheets are silent, so the app always turns one of these off; it does not leave it at the provider's default (often on).
const AUDIO_KEYS: [&str; 6] = ["generate_audio", "sound", "audio", "with_audio", "enable_audio", "generateAudio"];

#[derive(Debug, Clone)]
pub struct ImageField { pub key: String, pub array: bool, pub max: usize, pub required: bool }

#[derive(Debug, Clone)]
pub struct KieSchema {
    pub model: String,
    pub prompt_max: Option<usize>,
    pub aspect_key: Option<String>,
    pub aspect_values: Vec<String>,
    pub image: Option<ImageField>,
    pub duration_key: Option<String>,
    pub duration_values: Vec<String>,
    pub duration_is_number: bool,
    /// Required settings other than the prompt, aspect, images and duration, filled from the model's own default (or first listed value).
    pub fixed: Vec<(String, Value)>,
    /// The model's own soundtrack switch, if it has one (a boolean named in AUDIO_KEYS).
    pub audio_key: Option<String>,
}

pub fn valid_doc_id(id: &str) -> bool {
    !id.is_empty() && id.len() <= 100 && !id.contains("..") && !id.starts_with('/') && id.chars().all(|c| c.is_ascii_alphanumeric() || matches!(c, '/' | '-' | '_' | '.'))
}

fn yaml_block(md: &str) -> Option<&str> {
    let start = md.find("```yaml")?;
    let rest = &md[start + 7..];
    let body = &rest[rest.find('\n')? + 1..];
    let end = body.find("\n```").unwrap_or(body.len());
    Some(&body[..end])
}

fn enum_strings(v: &serde_yaml::Value) -> Vec<String> {
    v["enum"].as_sequence().map(|seq| seq.iter().filter_map(|x| x.as_str().map(str::to_string).or_else(|| x.as_i64().map(|n| n.to_string())).or_else(|| x.as_f64().map(|n| n.to_string()))).collect()).unwrap_or_default()
}

fn yaml_to_json(v: &serde_yaml::Value) -> Value {
    serde_json::to_value(v).unwrap_or(Value::Null)
}

pub fn parse_kie_doc(md: &str) -> Result<KieSchema, String> {
    let block = yaml_block(md).ok_or("Kie has not published a readable request schema for this model")?;
    let doc: serde_yaml::Value = serde_yaml::from_str(block).map_err(|e| format!("Kie's schema for this model could not be read: {e}"))?;
    let schema = &doc["paths"]["/api/v1/jobs/createTask"]["post"]["requestBody"]["content"]["application/json"]["schema"];
    let props = &schema["properties"];
    let model = props["model"]["enum"][0].as_str().or_else(|| props["model"]["default"].as_str()).ok_or("Kie's schema names no model id")?.to_string();
    let input = &props["input"];
    let fields = input["properties"].as_mapping().ok_or("Kie's schema lists no input fields")?;
    let required: Vec<String> = input["required"].as_sequence().map(|s| s.iter().filter_map(|x| x.as_str().map(str::to_string)).collect()).unwrap_or_default();
    let get = |key: &str| fields.get(serde_yaml::Value::String(key.to_string()));
    if get("prompt").is_none() { return Err("This Kie model takes no text prompt, so it cannot be used for generation here".into()); }
    let prompt_max = get("prompt").and_then(|p| p["maxLength"].as_u64()).map(|n| n as usize);
    let aspect_key = ASPECT_KEYS.iter().find(|k| get(k).is_some()).map(|k| k.to_string());
    let aspect_values = aspect_key.as_ref().and_then(|k| get(k)).map(enum_strings).unwrap_or_default();
    let image = IMAGE_KEYS.iter().find_map(|k| get(k).map(|f| ImageField { key: k.to_string(), array: f["type"].as_str() == Some("array"), max: f["maxItems"].as_u64().unwrap_or(1) as usize, required: required.iter().any(|r| r == k) }));
    let duration_key = get("duration").map(|_| "duration".to_string());
    let (duration_values, duration_is_number) = duration_key.as_ref().and_then(|k| get(k)).map(|f| (enum_strings(f), matches!(f["type"].as_str(), Some("integer") | Some("number")))).unwrap_or_default();
    let audio_key = AUDIO_KEYS.iter().find(|k| get(k).is_some_and(|f| f["type"].as_str() == Some("boolean"))).map(|k| k.to_string());
    let handled: Vec<&str> = vec!["prompt", "duration"];
    let mut fixed = Vec::new();
    for key in &required {
        if handled.contains(&key.as_str()) || Some(key) == aspect_key.as_ref() || image.as_ref().map(|i| &i.key) == Some(key) { continue; }
        let f = get(key).ok_or_else(|| format!("Kie requires {key} but does not describe it"))?;
        let value = if !f["default"].is_null() { yaml_to_json(&f["default"]) } else if let Some(first) = f["enum"][0].as_str().map(|s| json!(s)).or_else(|| f["enum"][0].as_i64().map(|n| json!(n))) { first } else if f["type"].as_str() == Some("boolean") { json!(false) } else if let Some(min) = f["minimum"].as_i64() { json!(min) } else { return Err(format!("Kie requires a setting called {key} that this app does not know how to fill")) };
        fixed.push((key.clone(), value));
    }
    Ok(KieSchema { model, prompt_max, aspect_key, aspect_values, image, duration_key, duration_values, duration_is_number, fixed, audio_key })
}

fn ratio(value: &str) -> Option<f64> {
    aspect_ratio_f(value)
}

/// The listed aspect value closest in shape to the one asked for.
pub fn nearest_aspect(requested: &str, listed: &[String]) -> Option<String> {
    if listed.iter().any(|v| v == requested) { return Some(requested.to_string()); }
    let want = ratio(requested)?;
    listed.iter().filter_map(|v| Some((v, ratio(v)?))).min_by(|a, b| (a.1 / want).ln().abs().partial_cmp(&(b.1 / want).ln().abs()).unwrap_or(std::cmp::Ordering::Equal)).map(|(v, _)| v.clone())
}

fn nearest_duration(requested: u32, listed: &[String]) -> Option<String> {
    listed.iter().filter_map(|v| Some((v, v.trim_end_matches('s').parse::<f64>().ok()?))).min_by(|a, b| (a.1 - requested as f64).abs().partial_cmp(&(b.1 - requested as f64).abs()).unwrap_or(std::cmp::Ordering::Equal)).map(|(v, _)| v.clone())
}

pub fn build_input(schema: &KieSchema, prompt: &str, aspect: &str, image_urls: &[String], duration: Option<u32>) -> Result<Value, String> {
    if let Some(max) = schema.prompt_max { if prompt.chars().count() > max { return Err(format!("The prompt is {} characters but this Kie model accepts at most {max}", prompt.chars().count())); } }
    let mut input = Map::new();
    input.insert("prompt".into(), json!(prompt));
    if let Some(key) = &schema.aspect_key {
        // Models such as Seedance 2.5 accept only "adaptive" when the video starts from a picture: the picture sets the shape.
        let adaptive = !image_urls.is_empty() && schema.aspect_values.iter().any(|v| v == "adaptive");
        let chosen = if adaptive { Some("adaptive".to_string()) } else if schema.aspect_values.is_empty() { Some(aspect.to_string()) } else { nearest_aspect(aspect, &schema.aspect_values) };
        if let Some(v) = chosen { input.insert(key.clone(), json!(v)); }
    }
    match (&schema.image, image_urls.is_empty()) {
        (Some(f), false) => {
            let urls: Vec<&String> = image_urls.iter().take(f.max.max(1)).collect();
            input.insert(f.key.clone(), if f.array { json!(urls) } else { json!(urls[0]) });
        }
        (None, false) => return Err("This Kie model takes no reference images. Choose an image-to-image or edit model, or one that lists an image input.".into()),
        (Some(f), true) if f.required => return Err("This Kie model needs a starting image. Approve a front view first, or use your own image.".into()),
        _ => {}
    }
    if let (Some(key), Some(d)) = (&schema.duration_key, duration) {
        if let Some(v) = nearest_duration(d, &schema.duration_values) { input.insert(key.clone(), if schema.duration_is_number { json!(v.trim_end_matches('s').parse::<f64>().unwrap_or(d as f64) as i64) } else { json!(v) }); }
        else if schema.duration_values.is_empty() { input.insert(key.clone(), if schema.duration_is_number { json!(d) } else { json!(d.to_string()) }); }
    }
    if let Some(key) = &schema.audio_key { input.insert(key.clone(), json!(false)); }
    for (k, v) in &schema.fixed { input.entry(k.clone()).or_insert(v.clone()); }
    Ok(Value::Object(input))
}

/// Lines of https://docs.kie.ai/llms.txt look like: - Image    Models > Google [Google - Nano Banana 2.1](google/nanobanana-2-1.md): ...
pub fn parse_index(text: &str, kind: &str) -> Vec<DiscoveredModel> {
    let label = if kind == "video" { "- Video" } else { "- Image" };
    let tool = ["upscale", "remove-background", "segment", "layer-decomposition", "callbacks", "motion-control", "avatar", "lip-sync", "extend", "video-to-video", "animate-", "speech-to-video", "transformation", "identification", "subject-detection", "edit-video", "video-edit"];
    let mut out: Vec<DiscoveredModel> = Vec::new();
    for line in text.lines() {
        if !line.starts_with(label) { continue; }
        let Some(after) = line.split("Models > ").nth(1) else { continue };
        let family = after.split(" [").next().unwrap_or("").trim();
        let (Some(open), Some(mid)) = (after.find('['), after.find("](")) else { continue };
        let title = after[open + 1..mid].trim();
        let Some(close) = after[mid + 2..].find(')') else { continue };
        let raw = &after[mid + 2..mid + 2 + close];
        // The live index uses absolute market URLs; only those (and plain relative paths) are model pages. Other hosts and paths are separate API styles.
        let path = raw.strip_prefix("https://docs.kie.ai/market/").unwrap_or(raw);
        if path.starts_with("http") || path.starts_with("cn/") || !path.ends_with(".md") || path.contains("..") { continue; }
        let id = path.trim_end_matches(".md");
        if !valid_doc_id(id) || tool.iter().any(|t| id.contains(t)) { continue; }
        if kind == "video" && !(id.contains("image-to-video") || id.contains("seedance") || id.contains("kling-3") || id.contains("kling/image") || id.contains("text-to-video")) { continue; }
        if !out.iter().any(|m| m.id == id) { out.push(DiscoveredModel { id: id.to_string(), name: if title.to_ascii_lowercase().contains(&family.to_ascii_lowercase()) { title.to_string() } else { format!("{family} · {title}") } }); }
    }
    out
}

pub(crate) fn is_public_https(url: &str) -> bool {
    let Some(rest) = url.strip_prefix("https://") else { return false };
    let host = rest.split(['/', '?', '#']).next().unwrap_or("");
    let host = host.rsplit('@').next().unwrap_or("").split(':').next().unwrap_or("");
    !host.is_empty() && host != "localhost" && !host.ends_with(".local") && host.parse::<std::net::IpAddr>().is_err() && host.contains('.')
}

fn client(secs: u64) -> Result<reqwest::Client, String> {
    reqwest::Client::builder().timeout(Duration::from_secs(secs)).build().map_err(|e| e.to_string())
}

pub(crate) async fn kie_json(req: reqwest::RequestBuilder) -> Result<Value, String> {
    let response = req.send().await.map_err(|e| if e.is_timeout() { "Kie.ai timed out (timeout)".to_string() } else { format!("Kie.ai could not be reached: {}", e.without_url()) })?;
    let http = response.status();
    let body: Value = response.json().await.unwrap_or(Value::Null);
    let code = body["code"].as_i64().unwrap_or(http.as_u16() as i64);
    if !http.is_success() || (code != 200 && !body["code"].is_null()) {
        let msg = body["msg"].as_str().or_else(|| body["message"].as_str()).unwrap_or("no details");
        return Err(format!("Kie.ai request failed ({code}): {}", msg.chars().take(300).collect::<String>()));
    }
    Ok(body)
}

pub fn result_url(record: &Value) -> Result<Option<String>, String> {
    match record["data"]["state"].as_str() {
        Some("success") => {
            let result: Value = serde_json::from_str(record["data"]["resultJson"].as_str().unwrap_or("{}")).unwrap_or(Value::Null);
            result["resultUrls"][0].as_str().map(|u| Some(u.to_string())).ok_or_else(|| "Kie.ai finished but returned no file".to_string())
        }
        Some("fail") => Err(format!("Kie.ai could not make this ({}): {}", record["data"]["failCode"].as_str().unwrap_or("failed"), record["data"]["failMsg"].as_str().unwrap_or("no details"))),
        _ => Ok(None),
    }
}

#[derive(Serialize)]
pub struct KieFile { pub bytes: Vec<u8>, pub extension: &'static str }

pub async fn run(api_key: &str, doc_id: &str, prompt: &str, aspect: &str, references: &[(String, String, String)], duration: Option<u32>, wait_secs: u64) -> Result<KieFile, String> {
    if !valid_doc_id(doc_id) { return Err("That Kie model id is not valid".into()); }
    let http = client(120)?;
    let page_url = format!("https://docs.kie.ai/market/{doc_id}.md");
    // Kie's documentation site sometimes answers a first request with a hiccup (a 5xx or 429, or a dropped connection). Try once more before blaming the model id; only a 404 means the page is gone.
    let mut md = http.get(&page_url).send().await;
    if md.as_ref().map(|r| r.status().as_u16() == 429 || r.status().is_server_error()).unwrap_or(true) {
        tokio::time::sleep(std::time::Duration::from_millis(1500)).await;
        md = http.get(&page_url).send().await;
    }
    let md = md.map_err(|e| format!("Could not read Kie's model page: {}", e.without_url()))?;
    if md.status().as_u16() == 404 { return Err(format!("Kie has no model page called {doc_id} (it may have been renamed). Press Refresh models.")); }
    if !md.status().is_success() { return Err(format!("Kie's documentation site answered {} for {doc_id}. This is usually temporary: try again in a moment.", md.status().as_u16())); }
    let schema = parse_kie_doc(&md.text().await.map_err(|e| e.to_string())?)?;
    let mut urls = Vec::new();
    if !references.is_empty() && schema.image.is_none() { return Err("This Kie model takes no reference images. Choose an image-to-image or edit model, or one that lists an image input.".into()); }
    for (mime, data, name) in references.iter().take(schema.image.as_ref().map(|i| i.max.max(1)).unwrap_or(0)) {
        let body = json!({ "base64Data": format!("data:{mime};base64,{data}"), "uploadPath": "production-one", "fileName": name });
        let up = kie_json(http.post("https://kieai.redpandaai.co/api/file-base64-upload").bearer_auth(api_key).json(&body)).await?;
        let d = if up["data"].is_null() { &up } else { &up["data"] };
        let url = d["downloadUrl"].as_str().or_else(|| d["fileUrl"].as_str()).or_else(|| d["url"].as_str()).ok_or("Kie's file upload returned no address")?;
        urls.push(url.to_string());
    }
    let input = build_input(&schema, prompt, aspect, &urls, duration)?;
    let created = kie_json(http.post("https://api.kie.ai/api/v1/jobs/createTask").bearer_auth(api_key).json(&json!({ "model": schema.model, "input": input }))).await?;
    let task = created["data"]["taskId"].as_str().ok_or("Kie.ai did not return a task id")?.to_string();
    let started = std::time::Instant::now();
    let file_url = loop {
        tokio::time::sleep(Duration::from_secs(4)).await;
        let record = kie_json(http.get("https://api.kie.ai/api/v1/jobs/recordInfo").bearer_auth(api_key).query(&[("taskId", task.as_str())])).await?;
        if let Some(url) = result_url(&record)? { break url; }
        if started.elapsed().as_secs() > wait_secs { return Err(format!("Kie.ai had not finished after {wait_secs} seconds. The task ({task}) may still complete and be billed; check your Kie dashboard.")); }
    };
    if !is_public_https(&file_url) { return Err("Kie.ai returned a file address that is not a public https address, so it was not downloaded".into()); }
    let response = client(300)?.get(&file_url).send().await.map_err(|e| format!("Could not download the Kie.ai result: {}", e.without_url()))?;
    if !response.status().is_success() { return Err(format!("Could not download the Kie.ai result ({})", response.status().as_u16())); }
    let bytes = response.bytes().await.map_err(|e| e.to_string())?.to_vec();
    let extension = if bytes.len() > 12 && &bytes[4..8] == b"ftyp" { "mp4" } else if bytes.starts_with(&[0x1A, 0x45, 0xDF, 0xA3]) { "webm" } else { match image::guess_format(&bytes) { Ok(image::ImageFormat::Png) => "png", Ok(image::ImageFormat::Jpeg) => "jpg", Ok(image::ImageFormat::WebP) => "webp", _ => return Err("Kie.ai returned a file this app cannot read".into()) } };
    Ok(KieFile { bytes, extension })
}

#[cfg(test)]
mod tests {
    use super::*;

    const DOC: &str = "# Google - Nano Banana 2.1\n\n## OpenAPI Specification\n\n```yaml\nopenapi: 3.0.1\npaths:\n  /api/v1/jobs/createTask:\n    post:\n      requestBody:\n        content:\n          application/json:\n            schema:\n              type: object\n              properties:\n                model:\n                  type: string\n                  enum:\n                    - nano-banana-2-1\n                input:\n                  type: object\n                  required:\n                    - prompt\n                    - resolution\n                  properties:\n                    prompt:\n                      type: string\n                      maxLength: 20000\n                    image_input:\n                      type: array\n                      maxItems: 10\n                    aspect_ratio:\n                      type: string\n                      enum:\n                        - auto\n                        - '1:1'\n                        - '3:4'\n                        - '16:9'\n                    resolution:\n                      type: string\n                      default: 1K\n                      enum:\n                        - 1K\n                        - 2K\n```\n\ntext after\n";

    #[test]
    fn reads_a_model_page_into_a_request_plan() {
        let s = parse_kie_doc(DOC).unwrap();
        assert_eq!(s.model, "nano-banana-2-1");
        assert_eq!(s.prompt_max, Some(20000));
        assert_eq!(s.aspect_key.as_deref(), Some("aspect_ratio"));
        let image = s.image.clone().unwrap();
        assert_eq!((image.key.as_str(), image.array, image.max), ("image_input", true, 10));
        assert_eq!(s.fixed, vec![("resolution".to_string(), json!("1K"))]);
    }

    #[test]
    fn fills_a_required_switch_with_off_and_reads_string_durations() {
        let doc = DOC.replace("                    - resolution
", "                    - sound
                    - duration
").replace("                    resolution:
                      type: string
                      default: 1K
                      enum:
                        - 1K
                        - 2K
", "                    sound:
                      type: boolean
                    duration:
                      type: string
                      enum:
                        - '5'
                        - '10'
");
        let s = parse_kie_doc(&doc).unwrap();
        assert!(s.fixed.contains(&("sound".to_string(), json!(false))));
        let input = build_input(&s, "p", "1:1", &[], Some(8)).unwrap();
        assert_eq!(input["sound"], false);
        assert_eq!(input["duration"], "10");
    }

    #[test]
    fn turns_an_optional_soundtrack_switch_off_instead_of_leaving_the_providers_default() {
        let doc = DOC.replace("                    resolution:
", "                    generate_audio:
                      type: boolean
                      default: true
                    resolution:
");
        let s = parse_kie_doc(&doc).unwrap();
        assert_eq!(s.audio_key.as_deref(), Some("generate_audio"));
        let input = build_input(&s, "p", "1:1", &[], None).unwrap();
        assert_eq!(input["generate_audio"], false);
        let plain = parse_kie_doc(DOC).unwrap();
        assert_eq!(plain.audio_key, None);
        assert!(build_input(&plain, "p", "1:1", &[], None).unwrap().get("generate_audio").is_none());
    }

    #[test]
    fn builds_the_input_with_the_nearest_listed_aspect_and_the_reference() {
        let s = parse_kie_doc(DOC).unwrap();
        let input = build_input(&s, "a prompt", "2:3", &["https://x.example/a.png".to_string()], None).unwrap();
        assert_eq!(input["aspect_ratio"], "3:4");
        assert_eq!(input["image_input"][0], "https://x.example/a.png");
        assert_eq!(input["resolution"], "1K");
        assert!(build_input(&s, &"x".repeat(20001), "1:1", &[], None).is_err());
    }

    #[test]
    fn refuses_references_for_a_model_with_no_image_field_instead_of_dropping_them() {
        let mut s = parse_kie_doc(DOC).unwrap();
        s.image = None;
        assert!(build_input(&s, "p", "1:1", &["https://x.example/a.png".to_string()], None).unwrap_err().contains("no reference images"));
    }

    #[test]
    fn a_video_from_a_picture_uses_adaptive_when_the_model_lists_it() {
        let schema = KieSchema { model: "m".into(), prompt_max: None, aspect_key: Some("aspect_ratio".into()), aspect_values: vec!["16:9".into(), "9:16".into(), "adaptive".into()], image: Some(ImageField { key: "first_frame_url".into(), array: false, max: 1, required: false }), duration_key: None, duration_values: vec![], duration_is_number: false, fixed: vec![], audio_key: None };
        let with_picture = build_input(&schema, "p", "3:4", &["https://x/y.png".to_string()], None).unwrap();
        assert_eq!(with_picture["aspect_ratio"], "adaptive");
        let without = build_input(&schema, "p", "9:16", &[], None).unwrap();
        assert_eq!(without["aspect_ratio"], "9:16");
    }

    #[test]
    fn picks_aspects_and_durations() {
        let listed: Vec<String> = ["1:1", "4:3", "16:9"].iter().map(|s| s.to_string()).collect();
        assert_eq!(nearest_aspect("3:4", &listed).as_deref(), Some("1:1"));
        assert_eq!(nearest_aspect("16:9", &listed).as_deref(), Some("16:9"));
        let d: Vec<String> = ["5", "10"].iter().map(|s| s.to_string()).collect();
        assert_eq!(nearest_duration(6, &d).as_deref(), Some("5"));
        assert_eq!(nearest_duration(9, &d).as_deref(), Some("10"));
    }

    #[test]
    fn reads_the_published_index_and_skips_tools_and_foreign_pages() {
        let text = "- Image    Models > Google [Google - Nano Banana 2.1](google/nanobanana-2-1.md): Image generation\n- Image    Models > Topaz [Topaz - Image Upscale](topaz/image-upscale.md): x\n- Image    Models > 4o Image API [Generate 4o Image](https://docs.kie.ai/4o-image-api/generate-4-o-image.md): x\n- Image    Models > Seedream [Seedream5.0 Pro - Text to Image](seedream/5-pro-text-to-image.md): x\n- Image    Models > Seedream [x](cn/market/seedream/a.md): x\n- Video    Models > Kling [Kling 2.6 Image to Video](kling/image-to-video.md): x\n- Video    Models > Kling [Kling 2.6 motion-control](kling/motion-control.md): x\n";
        let images = parse_index(text, "image");
        assert_eq!(images.iter().map(|m| m.id.as_str()).collect::<Vec<_>>(), vec!["google/nanobanana-2-1", "seedream/5-pro-text-to-image"]);
        assert_eq!(parse_index(text, "video").iter().map(|m| m.id.as_str()).collect::<Vec<_>>(), vec!["kling/image-to-video"]);
    }

    #[test]
    fn reads_task_results_and_failures() {
        assert_eq!(result_url(&json!({"data":{"state":"generating"}})).unwrap(), None);
        assert_eq!(result_url(&json!({"data":{"state":"success","resultJson":"{\"resultUrls\":[\"https://a.example/x.png\"]}"}})).unwrap().as_deref(), Some("https://a.example/x.png"));
        assert!(result_url(&json!({"data":{"state":"fail","failMsg":"bad prompt"}})).unwrap_err().contains("bad prompt"));
        assert!(result_url(&json!({"data":{"state":"success","resultJson":"{}"}})).is_err());
    }

    #[test]
    fn only_downloads_from_public_https_hosts() {
        assert!(is_public_https("https://tempfile.example.com/a.png"));
        assert!(!is_public_https("http://tempfile.example.com/a.png"));
        assert!(!is_public_https("https://127.0.0.1/a.png"));
        assert!(!is_public_https("https://localhost/a.png"));
        assert!(!is_public_https("https://a@127.0.0.1/a.png"));
        assert!(valid_doc_id("google/nanobanana-2-1") && !valid_doc_id("../x") && !valid_doc_id("a b"));
    }

    /// Reads a saved copy of the real https://docs.kie.ai/llms.txt (set KIE_LLMS to its path): cargo test real_index -- --ignored --nocapture
    #[test]
    #[ignore]
    fn real_index() {
        let text = std::fs::read_to_string(std::env::var("KIE_LLMS").unwrap()).unwrap();
        let images = parse_index(&text, "image");
        let videos = parse_index(&text, "video");
        println!("{} image models, {} video models", images.len(), videos.len());
        for m in images.iter().take(70) { println!("IMG {} | {}", m.id, m.name); }
        for m in videos.iter().take(40) { println!("VID {} | {}", m.id, m.name); }
        assert!(images.len() > 30 && !videos.is_empty());
    }
}
