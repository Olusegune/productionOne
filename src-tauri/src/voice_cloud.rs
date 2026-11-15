//! Cloud voice and sound services: ElevenLabs (speech, sound effects, voice design, voice list) and VoiceKiller (speech, voice list).
//! Keys live in the Windows Credential Manager like every other provider key and are never returned to the page.
//! Written from the providers' published API pages; none of it has been run against the live services yet.

use std::{fs, time::Duration};

use base64::Engine;
use serde::Serialize;
use serde_json::{json, Value};
use tauri::Manager;

use super::safe_package_name;
use super::voice::{audio_extension, validate_text};

const ELEVEN: &str = "https://api.elevenlabs.io";
const VOICEKILLER: &str = "https://voicekiller.com";
const B64: base64::engine::GeneralPurpose = base64::engine::general_purpose::STANDARD;

fn secret(provider: &str) -> Result<String, String> {
    super::credential(provider)?.get_password().map_err(|_| format!("No {provider} key is saved yet. Add it under Connect in the Voice audition."))
}

fn client() -> Result<reqwest::Client, String> {
    reqwest::Client::builder().timeout(Duration::from_secs(180)).user_agent("ProductionOne").build().map_err(|e| e.to_string())
}

/// Voice ids are plain alphanumerics; anything else would let a value change the request path.
pub fn valid_id(id: &str) -> bool { !id.is_empty() && id.len() <= 64 && id.chars().all(|c| c.is_ascii_alphanumeric() || c == '_' || c == '-') }

fn trim_body(bytes: &[u8]) -> String { String::from_utf8_lossy(bytes).chars().take(300).collect() }

pub(crate) fn save_audio(app: &tauri::AppHandle, output_name: &str, bytes: &[u8]) -> Result<String, String> {
    let stem = safe_package_name(output_name);
    if stem.is_empty() { return Err("Output name is required".into()); }
    let ext = audio_extension(bytes).ok_or("The service did not return audio.")?;
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?.join("assets");
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let mut path = dir.join(format!("{stem}.{ext}"));
    let mut n = 2;
    while path.exists() { path = dir.join(format!("{stem}_{n}.{ext}")); n += 1; }
    fs::write(&path, bytes).map_err(|e| e.to_string())?;
    Ok(path.to_string_lossy().into_owned())
}

async fn audio_response(res: reqwest::Response, who: &str) -> Result<Vec<u8>, String> {
    let status = res.status();
    let bytes = res.bytes().await.map_err(|e| e.to_string())?;
    if !status.is_success() { return Err(format!("{who} answered {status}: {}", trim_body(&bytes))); }
    Ok(bytes.to_vec())
}

#[derive(Serialize, Clone, Debug, PartialEq)]
pub struct CloudVoice { pub id: String, pub name: String, pub detail: String }

pub fn parse_eleven_voices(json: &str) -> Vec<CloudVoice> {
    let v: Value = match serde_json::from_str(json) { Ok(v) => v, Err(_) => return vec![] };
    v.get("voices").and_then(Value::as_array).map(|a| a.iter().filter_map(|x| {
        let id = x.get("voice_id")?.as_str()?.to_string();
        let name = x.get("name")?.as_str()?.to_string();
        let detail = x.get("category").and_then(Value::as_str).unwrap_or("").to_string();
        valid_id(&id).then_some(CloudVoice { id, name, detail })
    }).collect()).unwrap_or_default()
}

/// Live check (2026-11-13): VoiceKiller's voicelist answers with one voice name per line, not JSON. Accept that, but refuse anything that looks like a page or an error (markup, braces, long lines).
pub fn parse_voice_lines(text: &str) -> Vec<CloudVoice> {
    let lines: Vec<&str> = text.lines().map(str::trim).filter(|l| !l.is_empty()).collect();
    if lines.is_empty() || lines.iter().any(|l| l.len() > 60 || l.contains(['<', '>', '{', '}', ':'])) { return vec![]; }
    lines.into_iter().map(|l| CloudVoice { id: l.to_string(), name: l.to_string(), detail: String::new() }).collect()
}

/// The voice list reply shape is not in the public page, so accept the plausible shapes (a list of names, a list of objects, or an object holding such a list) and say so when none fits.
pub fn parse_voicekiller_voices(json: &str) -> Vec<CloudVoice> {
    let v: Value = match serde_json::from_str(json) { Ok(v) => v, Err(_) => return parse_voice_lines(json) };
    let list = match &v { Value::Array(a) => Some(a), Value::Object(o) => ["voices", "data", "result"].iter().find_map(|k| o.get(*k).and_then(Value::as_array)), _ => None };
    list.map(|a| a.iter().filter_map(|x| {
        let name = match x { Value::String(s) => s.clone(), Value::Object(o) => ["voice_name", "name", "voice"].iter().find_map(|k| o.get(*k).and_then(Value::as_str))?.to_string(), _ => return None };
        (!name.trim().is_empty() && name.len() <= 120).then(|| CloudVoice { id: name.clone(), name, detail: String::new() })
    }).collect()).unwrap_or_default()
}

/// Speech models only (not voice-conversion or alpha-access ones), as id and name.
pub fn parse_eleven_models(json: &str) -> Vec<CloudVoice> {
    let v: Value = match serde_json::from_str(json) { Ok(v) => v, Err(_) => return vec![] };
    v.as_array().map(|a| a.iter().filter_map(|m| {
        if !m.get("can_do_text_to_speech").and_then(Value::as_bool).unwrap_or(false) { return None; }
        if m.get("requires_alpha_access").and_then(Value::as_bool).unwrap_or(false) { return None; }
        let id = m.get("model_id")?.as_str()?.to_string();
        let name = m.get("name").and_then(Value::as_str).unwrap_or(&id).to_string();
        let detail = m.get("description").and_then(Value::as_str).unwrap_or("").chars().take(160).collect();
        valid_id(&id).then_some(CloudVoice { id, name, detail })
    }).collect()).unwrap_or_default()
}

pub fn parse_previews(json: &str) -> Vec<(String, Vec<u8>)> {
    let v: Value = match serde_json::from_str(json) { Ok(v) => v, Err(_) => return vec![] };
    v.get("previews").and_then(Value::as_array).map(|a| a.iter().filter_map(|p| {
        let id = p.get("generated_voice_id")?.as_str()?.to_string();
        let audio = B64.decode(p.get("audio_base_64")?.as_str()?).ok()?;
        valid_id(&id).then_some((id, audio))
    }).collect()).unwrap_or_default()
}

fn eleven_body(text: &str, model: &str, stability: f64, speed: f64) -> Value {
    json!({ "text": text, "model_id": model, "voice_settings": { "stability": stability.clamp(0.0, 1.0), "speed": speed.clamp(0.7, 1.2) } })
}

#[tauri::command]
pub async fn elevenlabs_voices() -> Result<Vec<CloudVoice>, String> {
    let key = secret("elevenlabs")?;
    let res = client()?.get(format!("{ELEVEN}/v2/voices?page_size=100")).header("xi-api-key", key).send().await.map_err(|e| format!("Could not reach ElevenLabs: {e}"))?;
    let status = res.status();
    let text = res.text().await.map_err(|e| e.to_string())?;
    if !status.is_success() { return Err(format!("ElevenLabs answered {status}: {}", text.chars().take(300).collect::<String>())); }
    Ok(parse_eleven_voices(&text))
}

/// The text-to-speech models this account can use, straight from ElevenLabs, so new generations appear without an app update.
#[tauri::command]
pub async fn elevenlabs_models() -> Result<Vec<CloudVoice>, String> {
    let key = secret("elevenlabs")?;
    let res = client()?.get(format!("{ELEVEN}/v1/models")).header("xi-api-key", key).send().await.map_err(|e| format!("Could not reach ElevenLabs: {e}"))?;
    let status = res.status();
    let text = res.text().await.map_err(|e| e.to_string())?;
    if !status.is_success() { return Err(format!("ElevenLabs answered {status}: {}", text.chars().take(300).collect::<String>())); }
    Ok(parse_eleven_models(&text))
}

#[tauri::command]
pub async fn speak_elevenlabs(app: tauri::AppHandle, voice_id: String, model_id: String, text: String, stability: f64, speed: f64, output_name: String) -> Result<String, String> {
    if !valid_id(&voice_id) { return Err("Choose an ElevenLabs voice first.".into()); }
    if !valid_id(&model_id) { return Err("The model id is not valid.".into()); }
    let text = validate_text(&text)?;
    let key = secret("elevenlabs")?;
    let res = client()?.post(format!("{ELEVEN}/v1/text-to-speech/{voice_id}?output_format=mp3_44100_128")).header("xi-api-key", key)
        .json(&eleven_body(&text, &model_id, stability, speed)).send().await.map_err(|e| format!("Could not reach ElevenLabs: {e}"))?;
    save_audio(&app, &output_name, &audio_response(res, "ElevenLabs").await?)
}

/// A separate sound effect (a grunt, a laugh, an engine start) to layer under or beside a line.
#[tauri::command]
pub async fn sound_elevenlabs(app: tauri::AppHandle, text: String, duration_seconds: Option<f64>, prompt_influence: f64, output_name: String) -> Result<String, String> {
    let text = text.trim().to_string();
    if text.is_empty() || text.chars().count() > 450 { return Err("Describe the sound in under 450 characters.".into()); }
    let key = secret("elevenlabs")?;
    let mut body = json!({ "text": text, "prompt_influence": prompt_influence.clamp(0.0, 1.0) });
    if let Some(d) = duration_seconds { body["duration_seconds"] = json!(d.clamp(0.5, 30.0)); }
    let res = client()?.post(format!("{ELEVEN}/v1/sound-generation?output_format=mp3_44100_128")).header("xi-api-key", key).json(&body).send().await.map_err(|e| format!("Could not reach ElevenLabs: {e}"))?;
    save_audio(&app, &output_name, &audio_response(res, "ElevenLabs").await?)
}

#[derive(Serialize)]
pub struct VoicePreview { pub id: String, pub path: String }

/// Voice design, step 1: write the voice in words; get a few previews to listen to. Nothing is kept until a preview is saved.
#[tauri::command]
pub async fn design_voice(app: tauri::AppHandle, description: String, sample_text: String, output_name: String) -> Result<Vec<VoicePreview>, String> {
    let description = description.trim().to_string();
    if description.chars().count() < 20 { return Err("Describe the voice in at least 20 characters (age, accent, tone, pace).".into()); }
    if description.chars().count() > 1000 { return Err("Keep the voice description under 1000 characters.".into()); }
    let sample = sample_text.trim().to_string();
    let n = sample.chars().count();
    if !(100..=1000).contains(&n) { return Err("The sample text must be 100 to 1000 characters so the voice can be judged.".into()); }
    let key = secret("elevenlabs")?;
    let res = client()?.post(format!("{ELEVEN}/v1/text-to-voice/design?output_format=mp3_44100_128")).header("xi-api-key", key)
        .json(&json!({ "voice_description": description, "text": sample })).send().await.map_err(|e| format!("Could not reach ElevenLabs: {e}"))?;
    let status = res.status();
    let body = res.text().await.map_err(|e| e.to_string())?;
    if !status.is_success() { return Err(format!("ElevenLabs answered {status}: {}", body.chars().take(300).collect::<String>())); }
    let previews = parse_previews(&body);
    if previews.is_empty() { return Err("ElevenLabs returned no previews.".into()); }
    previews.into_iter().enumerate().map(|(i, (id, audio))| Ok(VoicePreview { id, path: save_audio(&app, &format!("{output_name}_preview{}", i + 1), &audio)? })).collect()
}

/// Voice design, step 2: keep one preview as a named voice. This uses one of your ElevenLabs custom voice slots.
#[tauri::command]
pub async fn save_designed_voice(name: String, description: String, generated_voice_id: String) -> Result<CloudVoice, String> {
    if !valid_id(&generated_voice_id) { return Err("That preview is not valid.".into()); }
    let name = name.trim().to_string();
    if name.is_empty() || name.chars().count() > 80 { return Err("Give the voice a name (up to 80 characters).".into()); }
    let key = secret("elevenlabs")?;
    let res = client()?.post(format!("{ELEVEN}/v1/text-to-voice")).header("xi-api-key", key)
        .json(&json!({ "voice_name": name, "voice_description": description.trim(), "generated_voice_id": generated_voice_id })).send().await.map_err(|e| format!("Could not reach ElevenLabs: {e}"))?;
    let status = res.status();
    let text = res.text().await.map_err(|e| e.to_string())?;
    if !status.is_success() { return Err(format!("ElevenLabs answered {status}: {}", text.chars().take(300).collect::<String>())); }
    let v: Value = serde_json::from_str(&text).map_err(|_| "ElevenLabs reply was not understood.".to_string())?;
    let id = v.get("voice_id").and_then(Value::as_str).filter(|i| valid_id(i)).ok_or("ElevenLabs did not return a voice id.")?.to_string();
    Ok(CloudVoice { id, name, detail: "designed".into() })
}

fn voicekiller_headers(req: reqwest::RequestBuilder) -> Result<reqwest::RequestBuilder, String> {
    Ok(req.header("api-key", secret("voicekiller")?).header("userid", secret("voicekiller-user")?))
}

#[tauri::command]
pub async fn voicekiller_voices() -> Result<Vec<CloudVoice>, String> {
    let res = voicekiller_headers(client()?.post(format!("{VOICEKILLER}/api/generate-speech/voicelist")))?.send().await.map_err(|e| format!("Could not reach VoiceKiller: {e}"))?;
    let status = res.status();
    let text = res.text().await.map_err(|e| e.to_string())?;
    if !status.is_success() { return Err(format!("VoiceKiller answered {status}: {}", text.chars().take(300).collect::<String>())); }
    let voices = parse_voicekiller_voices(&text);
    if voices.is_empty() { return Err(format!("VoiceKiller's voice list was not in a shape this app knows. Type the voice name by hand. Start of reply: {}", text.chars().take(120).collect::<String>())); }
    Ok(voices)
}

#[tauri::command]
pub async fn speak_voicekiller(app: tauri::AppHandle, voice_name: String, script: String, instructions: String, output_name: String) -> Result<String, String> {
    let script = validate_text(&script)?;
    let voice_name = voice_name.trim().to_string();
    if voice_name.is_empty() || voice_name.chars().count() > 120 { return Err("Choose or type a VoiceKiller voice name.".into()); }
    let instructions: String = instructions.trim().chars().take(2000).collect();
    let mut body = json!({ "script": script, "voice_name": voice_name });
    if !instructions.is_empty() { body["instructions"] = json!(instructions); }
    let res = voicekiller_headers(client()?.post(format!("{VOICEKILLER}/api/generate-speech")))?.json(&body).send().await.map_err(|e| format!("Could not reach VoiceKiller: {e}"))?;
    save_audio(&app, &output_name, &audio_response(res, "VoiceKiller").await?)
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn ids_cannot_change_the_request_path() {
        assert!(valid_id("21m00Tcm4TlvDq8ikWAM"));
        assert!(!valid_id("../v1/user"));
        assert!(!valid_id("a/b"));
        assert!(!valid_id(""));
    }
    #[test]
    fn eleven_voices_parse() {
        let j = r#"{"voices":[{"voice_id":"abc123","name":"Rachel","category":"premade"},{"voice_id":"../x","name":"Bad"}],"has_more":false}"#;
        assert_eq!(parse_eleven_voices(j), vec![CloudVoice { id: "abc123".into(), name: "Rachel".into(), detail: "premade".into() }]);
        assert!(parse_eleven_voices("nope").is_empty());
    }
    #[test]
    fn voicekiller_voice_list_accepts_plausible_shapes() {
        assert_eq!(parse_voicekiller_voices(r#"["Jett","Abby"]"#).len(), 2);
        assert_eq!(parse_voicekiller_voices(r#"{"voices":[{"voice_name":"Jett"}]}"#)[0].name, "Jett");
        assert!(parse_voicekiller_voices(r#"{"ok":true}"#).is_empty());
        let lines = parse_voicekiller_voices("alloy
Ashton
Bella

Coraline
");
        assert_eq!(lines.iter().map(|v| v.name.as_str()).collect::<Vec<_>>(), ["alloy", "Ashton", "Bella", "Coraline"]);
        assert!(parse_voicekiller_voices("<html><body>Error</body></html>").is_empty());
        assert!(parse_voicekiller_voices("error: not allowed").is_empty());
        assert!(parse_voicekiller_voices("   \n ").is_empty());
    }
    #[test]
    fn only_speech_models_are_listed() {
        let j = r#"[{"model_id":"eleven_v4","name":"Eleven v4","can_do_text_to_speech":true},{"model_id":"eleven_sts","can_do_text_to_speech":false},{"model_id":"eleven_alpha","can_do_text_to_speech":true,"requires_alpha_access":true},{"model_id":"../x","can_do_text_to_speech":true}]"#;
        let m = parse_eleven_models(j);
        assert_eq!(m.len(), 1);
        assert_eq!(m[0].id, "eleven_v4");
    }
    #[test]
    fn previews_decode() {
        let j = format!(r#"{{"previews":[{{"generated_voice_id":"gv1","audio_base_64":"{}"}}],"text":"x"}}"#, B64.encode(b"ID3abc"));
        let p = parse_previews(&j);
        assert_eq!(p[0].0, "gv1");
        assert_eq!(p[0].1, b"ID3abc");
    }
    #[test]
    fn speech_settings_are_clamped() {
        let b = eleven_body("hi", "eleven_v3", 5.0, 9.0);
        assert_eq!(b["voice_settings"]["stability"], 1.0);
        assert_eq!(b["voice_settings"]["speed"], 1.2);
    }
}
