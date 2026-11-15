//! Music from Suno, reached through Kie.ai (Suno has no public API of its own, so this is a third-party route).
//!
//! Design decisions (secure-design walk):
//! - The Kie key comes only from the OS credential store and is never returned to the page.
//! - Every address the app calls is a fixed Kie address; the page supplies only text and a few allow-listed options.
//! - Result files are downloaded only from public https hosts (redirects re-checked), capped in size, and kept only if they sniff as audio.
//! - Files are written under the app's assets folder with a sanitised name, never a name or path from the service.
//! - The text sent is the prompt the person wrote or approved; nothing else from the project is sent.

use std::time::Duration;

use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

use super::kie::{is_public_https, kie_json};
use super::voice_cloud::save_audio;

const CREATE: &str = "https://api.kie.ai/api/v1/jobs/createTask";
const RECORD: &str = "https://api.kie.ai/api/v1/jobs/recordInfo";
const SUNO_TASK: &str = "ai-music-api/generate";
const MAX_TRACK_BYTES: usize = 80 * 1024 * 1024;
const MAX_TRACKS: usize = 2;
const MODELS: [&str; 3] = ["V6", "V6_MINI", "V6_WILD"];

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MusicRequest {
    pub title: String,
    pub style: String,
    pub instrumental: bool,
    #[serde(default)]
    pub lyrics: String,
    #[serde(default)]
    pub negative_tags: String,
    pub model: String,
    pub duration_seconds: Option<u32>,
    /// `m`, `f` or empty. Only a hint to the model.
    #[serde(default)]
    pub vocal_gender: String,
    pub output_name: String,
}

#[derive(Serialize, Debug, PartialEq)]
pub struct MusicTrack { pub path: String, pub title: String, pub duration: f64 }

/// A finished track as the service lists it.
#[derive(Debug, PartialEq)]
pub struct RemoteTrack { pub url: String, pub title: String, pub duration: f64 }

fn len(text: &str) -> usize { text.trim().chars().count() }

/// Checks the request against the service's limits and builds the task body. Pure, so it is tested without the network.
pub fn build_task(req: &MusicRequest) -> Result<Value, String> {
    if !MODELS.contains(&req.model.as_str()) { return Err("Choose Suno V6, V6 Mini or V6 Wild.".into()); }
    if len(&req.title) == 0 || len(&req.title) > 80 { return Err("The title must be 1 to 80 characters.".into()); }
    if len(&req.style) == 0 || len(&req.style) > 1000 { return Err("Describe the style in 1 to 1000 characters.".into()); }
    if len(&req.negative_tags) > 500 { return Err("Keep the styles to avoid under 500 characters.".into()); }
    if len(&req.lyrics) > 5000 { return Err("Lyrics can be at most 5000 characters.".into()); }
    if !req.instrumental && len(&req.lyrics) == 0 { return Err("Add lyrics, or choose instrumental.".into()); }
    if !matches!(req.vocal_gender.as_str(), "" | "m" | "f") { return Err("Vocal gender must be m, f or empty.".into()); }
    if let Some(d) = req.duration_seconds { if !(10..=360).contains(&d) { return Err("Length must be 10 to 360 seconds.".into()); } }
    let mut input = json!({ "custom_mode": true, "instrumental": req.instrumental, "model": req.model, "title": req.title.trim(), "style": req.style.trim() });
    if !req.instrumental {
        input["lyrics"] = json!(req.lyrics.trim());
        if !req.vocal_gender.is_empty() { input["vocal_gender"] = json!(req.vocal_gender); }
    }
    if !req.negative_tags.trim().is_empty() { input["negative_tags"] = json!(req.negative_tags.trim()); }
    if let Some(d) = req.duration_seconds { input["duration"] = json!(d); }
    Ok(json!({ "model": SUNO_TASK, "input": input }))
}

/// Reads a task record. `Ok(None)` means keep waiting; an error is a failed task. Tracks are read from the Suno response list, with the generic result list as a fallback.
pub fn parse_tracks(record: &Value) -> Result<Option<Vec<RemoteTrack>>, String> {
    let data = &record["data"];
    match data["state"].as_str() {
        Some("success") => {
            let mut tracks = Vec::new();
            if let Some(list) = data["response"]["data"].as_array() {
                for t in list {
                    if let Some(url) = t["audio_url"].as_str().or_else(|| t["audioUrl"].as_str()).filter(|u| !u.is_empty()) {
                        tracks.push(RemoteTrack { url: url.to_string(), title: t["title"].as_str().unwrap_or("").to_string(), duration: t["duration"].as_f64().unwrap_or(0.0) });
                    }
                }
            }
            if tracks.is_empty() {
                let result: Value = serde_json::from_str(data["resultJson"].as_str().unwrap_or("{}")).unwrap_or(Value::Null);
                if let Some(urls) = result["resultUrls"].as_array() {
                    for u in urls.iter().filter_map(Value::as_str) { tracks.push(RemoteTrack { url: u.to_string(), title: String::new(), duration: 0.0 }); }
                }
            }
            if tracks.is_empty() { Err("Suno finished but returned no audio".into()) } else { Ok(Some(tracks)) }
        }
        Some("fail") => Err(format!("Suno could not make this ({}): {}", data["failCode"].as_str().unwrap_or("failed"), data["failMsg"].as_str().unwrap_or("no details").chars().take(300).collect::<String>())),
        _ => Ok(None),
    }
}

fn download_client() -> Result<reqwest::Client, String> {
    let policy = reqwest::redirect::Policy::custom(|attempt| {
        if attempt.previous().len() >= 3 || !is_public_https(attempt.url().as_str()) { attempt.stop() } else { attempt.follow() }
    });
    reqwest::Client::builder().timeout(Duration::from_secs(300)).redirect(policy).user_agent("ProductionOne").build().map_err(|e| e.to_string())
}

/// Makes two tracks from a description of the music. This spends Kie.ai credits and can take a few minutes.
#[tauri::command]
pub async fn make_music(app: tauri::AppHandle, request: MusicRequest, wait_secs: Option<u64>) -> Result<Vec<MusicTrack>, String> {
    let body = build_task(&request)?;
    let key = super::credential("kie")?.get_password().map_err(|_| "No Kie.ai key is saved. Add it in Tools, Provider Settings.".to_string())?;
    let wait = wait_secs.unwrap_or(420).clamp(60, 900);
    let http = reqwest::Client::builder().timeout(Duration::from_secs(60)).user_agent("ProductionOne").build().map_err(|e| e.to_string())?;
    let created = kie_json(http.post(CREATE).bearer_auth(&key).json(&body)).await?;
    let task = created["data"]["taskId"].as_str().ok_or("Kie.ai did not return a task id")?.to_string();
    let started = std::time::Instant::now();
    let remote = loop {
        tokio::time::sleep(Duration::from_secs(5)).await;
        let record = kie_json(http.get(RECORD).bearer_auth(&key).query(&[("taskId", task.as_str())])).await?;
        if let Some(tracks) = parse_tracks(&record)? { break tracks; }
        if started.elapsed().as_secs() > wait { return Err(format!("Suno had not finished after {wait} seconds. The task ({task}) may still complete and be billed; check your Kie dashboard.")); }
    };
    let dl = download_client()?;
    let mut out = Vec::new();
    for (i, t) in remote.iter().take(MAX_TRACKS).enumerate() {
        if !is_public_https(&t.url) { return Err("Suno returned an address that is not a public https address, so it was not downloaded".into()); }
        let res = dl.get(&t.url).send().await.map_err(|e| format!("Could not download the track: {}", e.without_url()))?;
        if !res.status().is_success() { return Err(format!("Could not download the track ({})", res.status().as_u16())); }
        if res.content_length().is_some_and(|n| n as usize > MAX_TRACK_BYTES) { return Err("The track is larger than the 80 MB limit".into()); }
        let mut res = res;
        let mut bytes: Vec<u8> = Vec::new();
        while let Some(chunk) = res.chunk().await.map_err(|e| e.to_string())? {
            if bytes.len() + chunk.len() > MAX_TRACK_BYTES { return Err("The track is larger than the 80 MB limit".into()); }
            bytes.extend_from_slice(&chunk);
        }
        let path = save_audio(&app, &format!("{}_music_{}", request.output_name, i + 1), &bytes)?;
        out.push(MusicTrack { path, title: if t.title.is_empty() { request.title.trim().to_string() } else { t.title.clone() }, duration: t.duration });
    }
    Ok(out)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn req() -> MusicRequest {
        MusicRequest { title: "Amina's theme".into(), style: "slow strings, warm dusk, restrained".into(), instrumental: true, lyrics: String::new(), negative_tags: String::new(), model: "V6_MINI".into(), duration_seconds: Some(60), vocal_gender: String::new(), output_name: "A1".into() }
    }

    #[test]
    fn builds_an_instrumental_task_without_lyrics_or_vocal_fields() {
        let v = build_task(&req()).unwrap();
        assert_eq!(v["model"], "ai-music-api/generate");
        assert_eq!(v["input"]["custom_mode"], true);
        assert_eq!(v["input"]["instrumental"], true);
        assert_eq!(v["input"]["duration"], 60);
        assert!(v["input"].get("lyrics").is_none() && v["input"].get("vocal_gender").is_none());
    }

    #[test]
    fn a_sung_track_needs_lyrics_and_passes_the_vocal_hint() {
        let mut r = req();
        r.instrumental = false;
        assert!(build_task(&r).is_err());
        r.lyrics = "We walk toward the light".into();
        r.vocal_gender = "f".into();
        let v = build_task(&r).unwrap();
        assert_eq!(v["input"]["lyrics"], "We walk toward the light");
        assert_eq!(v["input"]["vocal_gender"], "f");
    }

    #[test]
    fn refuses_values_outside_the_services_limits() {
        for edit in [
            |r: &mut MusicRequest| r.model = "V9".into(),
            |r: &mut MusicRequest| r.title = "x".repeat(81),
            |r: &mut MusicRequest| r.title = "  ".into(),
            |r: &mut MusicRequest| r.style = String::new(),
            |r: &mut MusicRequest| r.style = "x".repeat(1001),
            |r: &mut MusicRequest| r.duration_seconds = Some(5),
            |r: &mut MusicRequest| r.duration_seconds = Some(361),
            |r: &mut MusicRequest| r.vocal_gender = "x".into(),
            |r: &mut MusicRequest| r.negative_tags = "x".repeat(501),
        ] {
            let mut r = req();
            edit(&mut r);
            assert!(build_task(&r).is_err());
        }
    }

    #[test]
    fn reads_waiting_finished_and_failed_tasks() {
        assert_eq!(parse_tracks(&json!({ "data": { "state": "generating" } })).unwrap(), None);
        let done = json!({ "data": { "state": "success", "response": { "data": [
            { "audio_url": "https://cdn.example.com/a.mp3", "title": "One", "duration": 61.5 },
            { "audio_url": "", "title": "Empty" },
            { "audioUrl": "https://cdn.example.com/b.mp3", "duration": 60.0 } ] } } });
        let tracks = parse_tracks(&done).unwrap().unwrap();
        assert_eq!(tracks.len(), 2);
        assert_eq!(tracks[0], RemoteTrack { url: "https://cdn.example.com/a.mp3".into(), title: "One".into(), duration: 61.5 });
        let generic = json!({ "data": { "state": "success", "resultJson": "{\"resultUrls\":[\"https://cdn.example.com/c.mp3\"]}" } });
        assert_eq!(parse_tracks(&generic).unwrap().unwrap()[0].url, "https://cdn.example.com/c.mp3");
        assert!(parse_tracks(&json!({ "data": { "state": "success" } })).is_err());
        let failed = parse_tracks(&json!({ "data": { "state": "fail", "failCode": "500", "failMsg": "content rejected" } })).unwrap_err();
        assert!(failed.contains("content rejected"));
    }
}
