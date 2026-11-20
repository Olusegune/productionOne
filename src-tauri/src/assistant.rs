//! The assistant's two native pieces: choosing attachments (scripts, Word and PDF documents, pictures) and one plain text answer from a language model.
//! A language model is optional. Without one the assistant still reads documents and runs the plan; it just cannot write a script from a short brief.
//! Keys stay in the credential store and are never logged or returned.

use std::path::Path;
use std::time::Duration;

use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

const MAX_TEXT_CHARS: usize = 200_000;
const MAX_MESSAGES: usize = 40;
const MAX_MESSAGE_CHARS: usize = 120_000;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Attachment {
    pub path: String,
    pub name: String,
    /// `script` (text we could read), `image`, or `unsupported`.
    pub kind: String,
    pub text: Option<String>,
    pub error: Option<String>,
}

/// What a chosen file is, from its extension. Pictures are returned as paths only; the app imports them the way it imports any picture.
pub fn classify(path: &Path) -> &'static str {
    match path.extension().and_then(|e| e.to_str()).map(|e| e.to_ascii_lowercase()).as_deref() {
        Some("txt" | "md" | "markdown" | "fountain" | "spmd" | "screenplay" | "fdx" | "docx" | "pdf") => "script",
        Some("png" | "jpg" | "jpeg" | "webp") => "image",
        _ => "unsupported",
    }
}

fn read_one(path: &Path) -> Attachment {
    let name = path.file_name().map(|n| n.to_string_lossy().into_owned()).unwrap_or_default();
    let path_text = path.to_string_lossy().into_owned();
    match classify(path) {
        "script" => match crate::script_file::read_script(path) {
            Ok(file) => {
                let mut text = file.text;
                if text.chars().count() > MAX_TEXT_CHARS { text = text.chars().take(MAX_TEXT_CHARS).collect(); }
                Attachment { path: path_text, name, kind: "script".into(), text: Some(text), error: None }
            }
            Err(error) => Attachment { path: path_text, name, kind: "unsupported".into(), text: None, error: Some(error) },
        },
        "image" => Attachment { path: path_text, name, kind: "image".into(), text: None, error: None },
        _ => Attachment { path: path_text, name, kind: "unsupported".into(), text: None, error: Some("Production One reads scripts (.txt, .md, .fountain, .fdx, .docx, .pdf) and pictures (.png, .jpg, .webp).".into()) },
    }
}

/// Lets the person choose several files at once. Documents are read here; pictures come back as paths.
#[tauri::command]
pub async fn pick_attachments(app: tauri::AppHandle) -> Result<Vec<Attachment>, String> {
    use tauri_plugin_dialog::DialogExt;
    let picked = app.dialog().file().set_title("Attach files").add_filter("Scripts, documents and pictures", &["txt", "md", "fountain", "fdx", "docx", "pdf", "png", "jpg", "jpeg", "webp"]).blocking_pick_files();
    let Some(files) = picked else { return Ok(vec![]) };
    let paths: Vec<std::path::PathBuf> = files.into_iter().take(12).filter_map(|f| f.into_path().ok()).collect();
    tauri::async_runtime::spawn_blocking(move || paths.iter().map(|p| read_one(p)).collect()).await.map_err(|e| e.to_string())
}

/// Reads files that were dropped on the window (same rules as picking them).
#[tauri::command]
pub async fn read_attachments(paths: Vec<String>) -> Result<Vec<Attachment>, String> {
    let paths: Vec<std::path::PathBuf> = paths.into_iter().take(12).map(std::path::PathBuf::from).collect();
    tauri::async_runtime::spawn_blocking(move || paths.iter().map(|p| read_one(p)).collect()).await.map_err(|e| e.to_string())
}

#[derive(Deserialize, Clone)]
pub struct ChatMessage { pub role: String, pub text: String }

fn clean_messages(messages: &[ChatMessage]) -> Result<Vec<ChatMessage>, String> {
    if messages.is_empty() { return Err("Nothing to answer".into()); }
    let mut out: Vec<ChatMessage> = messages.iter().rev().take(MAX_MESSAGES).rev().map(|m| ChatMessage { role: if m.role == "assistant" { "assistant".into() } else { "user".into() }, text: m.text.chars().take(MAX_MESSAGE_CHARS).collect() }).collect();
    while out.first().is_some_and(|m| m.role == "assistant") { out.remove(0); }
    if out.is_empty() { return Err("Nothing to answer".into()); }
    Ok(out)
}

pub fn gemini_chat_body(system: &str, messages: &[ChatMessage]) -> Value {
    json!({
        "systemInstruction": { "parts": [{ "text": system }] },
        "contents": messages.iter().map(|m| json!({ "role": if m.role == "assistant" { "model" } else { "user" }, "parts": [{ "text": m.text }] })).collect::<Vec<_>>(),
        "generationConfig": { "temperature": 0.7 },
    })
}

pub fn openrouter_chat_body(model: &str, system: &str, messages: &[ChatMessage]) -> Value {
    let mut list = vec![json!({ "role": "system", "content": system })];
    list.extend(messages.iter().map(|m| json!({ "role": m.role, "content": m.text })));
    json!({ "model": model, "messages": list })
}

pub fn extract_gemini_text(body: &Value) -> Result<String, String> {
    let parts = body["candidates"][0]["content"]["parts"].as_array().ok_or_else(|| body["promptFeedback"]["blockReason"].as_str().map(|r| format!("The model declined to answer ({r})")).unwrap_or_else(|| "The model returned no answer".to_string()))?;
    let text: String = parts.iter().filter_map(|p| p["text"].as_str()).collect();
    if text.trim().is_empty() { Err("The model returned an empty answer".into()) } else { Ok(text) }
}

pub fn extract_openrouter_text(body: &Value) -> Result<String, String> {
    let text = body["choices"][0]["message"]["content"].as_str().unwrap_or("");
    if text.trim().is_empty() { Err(body["error"]["message"].as_str().map(|m| format!("The model returned no answer: {}", m.chars().take(200).collect::<String>())).unwrap_or_else(|| "The model returned no answer".to_string())) } else { Ok(text.to_string()) }
}

fn model_ok(model: &str) -> bool { !model.is_empty() && model.len() <= 120 && model.chars().all(|c| c.is_ascii_alphanumeric() || matches!(c, '.' | '_' | '-' | ':' | '/')) }

/// Where a chat-style provider is called, and whether it needs a saved key. Cloud providers use fixed addresses; the two local servers use the address
/// the person set (or the usual one) and are only accepted on this computer or their own network.
pub fn chat_endpoint(provider: &str, base: Option<&str>) -> Result<(String, bool), String> {
    match provider {
        "openai" => Ok(("https://api.openai.com/v1/chat/completions".into(), true)),
        "openrouter" => Ok(("https://openrouter.ai/api/v1/chat/completions".into(), true)),
        "ollama" | "lmstudio" => {
            let default = if provider == "ollama" { "http://127.0.0.1:11434" } else { "http://127.0.0.1:1234" };
            let root = crate::local::normalize_base(base.filter(|b| !b.trim().is_empty()).unwrap_or(default))?;
            Ok((format!("{root}/v1/chat/completions"), false))
        }
        _ => Err("The assistant can write with Google Gemini, OpenAI (ChatGPT), OpenRouter, Ollama or LM Studio.".into()),
    }
}

/// One text answer from Google Gemini, OpenAI, OpenRouter, or a model on this computer (Ollama, LM Studio). Cloud providers use the key already saved for them.
#[tauri::command]
pub async fn assistant_complete(provider: String, model: String, system: String, messages: Vec<ChatMessage>, base: Option<String>) -> Result<String, String> {
    if !model_ok(&model) { return Err("That model id is not valid".into()); }
    let messages = clean_messages(&messages)?;
    let system: String = system.chars().take(20_000).collect();
    let local = matches!(provider.as_str(), "ollama" | "lmstudio");
    let mut builder = reqwest::Client::builder().timeout(Duration::from_secs(if local { 600 } else { 120 }));
    if local { builder = builder.no_proxy(); }
    let client = builder.build().map_err(|e| e.to_string())?;
    let google = provider == "google";
    let request = if google {
        let key = crate::providers::key_for("google")?;
        client.post(format!("https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent")).header("x-goog-api-key", &key).json(&gemini_chat_body(&system, &messages))
    } else {
        let (url, needs_key) = chat_endpoint(&provider, base.as_deref())?;
        let req = client.post(url).json(&openrouter_chat_body(&model, &system, &messages));
        if needs_key { req.bearer_auth(crate::providers::key_for(&provider)?) } else { req }
    };
    let response = request.send().await.map_err(|e| format!("The language model could not be reached: {}", e.without_url()))?;
    let status = response.status();
    let body: Value = response.json().await.unwrap_or(Value::Null);
    if !status.is_success() {
        let message = body["error"]["message"].as_str().or_else(|| body["error"].as_str()).unwrap_or("no details");
        return Err(format!("The language model answered {}: {}", status.as_u16(), message.chars().take(300).collect::<String>()));
    }
    if google { extract_gemini_text(&body) } else { extract_openrouter_text(&body) }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn msg(role: &str, text: &str) -> ChatMessage { ChatMessage { role: role.into(), text: text.into() } }

    #[test]
    fn sorts_files_into_scripts_pictures_and_the_rest() {
        for name in ["a.txt", "b.MD", "c.fountain", "d.fdx", "e.docx", "f.PDF"] { assert_eq!(classify(Path::new(name)), "script", "{name}"); }
        for name in ["a.png", "b.JPG", "c.jpeg", "d.webp"] { assert_eq!(classify(Path::new(name)), "image", "{name}"); }
        for name in ["a.exe", "b.zip", "c", "d.gif", "e.pptx"] { assert_eq!(classify(Path::new(name)), "unsupported", "{name}"); }
    }

    #[test]
    fn a_picture_comes_back_as_a_path_and_an_unreadable_file_says_why() {
        let dir = std::env::temp_dir().join(format!("po-asst-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let pic = dir.join("hero.png");
        std::fs::write(&pic, b"x").unwrap();
        let a = read_one(&pic);
        assert_eq!((a.kind.as_str(), a.text.is_none(), a.error.is_none()), ("image", true, true));
        let bad = dir.join("notes.exe");
        std::fs::write(&bad, b"x").unwrap();
        let b = read_one(&bad);
        assert_eq!(b.kind, "unsupported");
        assert!(b.error.unwrap().contains("reads scripts"));
        let txt = dir.join("film.txt");
        std::fs::write(&txt, "INT. HARBOUR - DAWN\nMira waits.").unwrap();
        let t = read_one(&txt);
        assert_eq!((t.kind.as_str(), t.text.as_deref()), ("script", Some("INT. HARBOUR - DAWN\nMira waits.")));
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn drops_a_leading_assistant_turn_and_keeps_the_latest_messages() {
        let cleaned = clean_messages(&[msg("assistant", "hi"), msg("user", "a"), msg("assistant", "b"), msg("user", "c")]).unwrap();
        assert_eq!(cleaned.iter().map(|m| m.text.as_str()).collect::<Vec<_>>(), vec!["a", "b", "c"]);
        assert!(clean_messages(&[]).is_err());
        assert!(clean_messages(&[msg("assistant", "only me")]).is_err());
        let many: Vec<ChatMessage> = (0..100).map(|i| msg(if i % 2 == 0 { "user" } else { "assistant" }, &i.to_string())).collect();
        assert!(clean_messages(&many).unwrap().len() <= MAX_MESSAGES);
    }

    #[test]
    fn builds_the_two_provider_requests() {
        let m = [msg("user", "Write a scene"), msg("assistant", "Sure"), msg("user", "Shorter")];
        let g = gemini_chat_body("Be brief", &m);
        assert_eq!(g["systemInstruction"]["parts"][0]["text"], "Be brief");
        assert_eq!((g["contents"][1]["role"].as_str(), g["contents"][2]["parts"][0]["text"].as_str()), (Some("model"), Some("Shorter")));
        let o = openrouter_chat_body("google/x", "Be brief", &m);
        assert_eq!((o["model"].as_str(), o["messages"][0]["role"].as_str(), o["messages"][2]["role"].as_str()), (Some("google/x"), Some("system"), Some("assistant")));
    }

    #[test]
    fn reads_the_two_answers_and_the_refusals() {
        assert_eq!(extract_gemini_text(&json!({ "candidates": [{ "content": { "parts": [{ "text": "Hello " }, { "text": "world" }] } }] })).unwrap(), "Hello world");
        assert!(extract_gemini_text(&json!({ "promptFeedback": { "blockReason": "SAFETY" } })).unwrap_err().contains("SAFETY"));
        assert!(extract_gemini_text(&json!({ "candidates": [{ "content": { "parts": [{ "text": "  " }] } }] })).is_err());
        assert_eq!(extract_openrouter_text(&json!({ "choices": [{ "message": { "content": "Hi" } }] })).unwrap(), "Hi");
        assert!(extract_openrouter_text(&json!({ "error": { "message": "no credits" } })).unwrap_err().contains("no credits"));
    }

    #[test]
    fn picks_the_chat_address_for_each_provider() {
        assert_eq!(chat_endpoint("openai", None).unwrap(), ("https://api.openai.com/v1/chat/completions".to_string(), true));
        assert_eq!(chat_endpoint("ollama", None).unwrap(), ("http://127.0.0.1:11434/v1/chat/completions".to_string(), false));
        assert_eq!(chat_endpoint("lmstudio", Some("")).unwrap().0, "http://127.0.0.1:1234/v1/chat/completions");
        assert_eq!(chat_endpoint("ollama", Some("http://192.168.1.20:11434/")).unwrap().0, "http://192.168.1.20:11434/v1/chat/completions");
        assert!(chat_endpoint("ollama", Some("http://example.com:11434")).is_err());
        assert!(chat_endpoint("ollama", Some("https://127.0.0.1:11434")).is_err());
        assert!(chat_endpoint("mystery", None).is_err());
    }

    #[test]
    fn only_plain_model_ids_are_accepted() {
        for ok in ["gemini-2.5-flash", "google/gemini-2.5-pro", "anthropic/claude:beta"] { assert!(model_ok(ok), "{ok}"); }
        for bad in ["", "a b", "x?y=1", "m;rm", &"a".repeat(121)] { assert!(!model_ok(bad), "{bad}"); }
    }
}
