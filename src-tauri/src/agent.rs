//! A local door for agents. When the person switches it on, Production One listens on 127.0.0.1 only, and a program on this computer that knows the access code
//! (an MCP server, for example) can ask the running app to do what the Assistant does. The app answers through the same screen the person sees, so every
//! action is visible, and the screen refuses to spend unless the person has separately allowed it and given a budget.
//! Off by default. The access code changes every time it is switched on and is kept only in this app's data folder.

use std::collections::hash_map::RandomState;
use std::collections::HashMap;
use std::hash::{BuildHasher, Hasher};
use std::io::{Read, Write};
use std::net::{Ipv4Addr, SocketAddr, TcpListener, TcpStream};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::mpsc::{channel, Sender};
use std::sync::{Arc, Mutex};
use std::time::Duration;

use serde::Serialize;
use serde_json::{json, Value};
use tauri::{Emitter, Manager, State};

const MAX_BODY: usize = 2 * 1024 * 1024;
const MAX_HEAD: usize = 16 * 1024;
const ANSWER_WAIT: Duration = Duration::from_secs(600);

struct Running { stop: Arc<AtomicBool>, port: u16 }

#[derive(Default)]
pub struct AgentState {
    pending: Arc<Mutex<HashMap<String, Sender<Value>>>>,
    running: Mutex<Option<Running>>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentInfo { pub enabled: bool, pub port: Option<u16>, pub token: Option<String>, pub config_path: Option<String> }

/// An access code from the operating system's random keys (no extra crate): 32 hex characters.
pub fn make_token() -> String {
    let mut out = String::new();
    for _ in 0..2 {
        let mut h = RandomState::new().build_hasher();
        h.write_u128(std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|d| d.as_nanos()).unwrap_or(0));
        out.push_str(&format!("{:016x}", h.finish()));
    }
    out
}

pub struct Request { pub method: String, pub path: String, pub headers: HashMap<String, String>, pub body: Vec<u8> }

/// Reads one HTTP request. Refuses oversized heads and bodies.
pub fn parse_request(stream: &mut impl Read) -> Result<Request, String> {
    let mut buf = Vec::new();
    let mut chunk = [0u8; 2048];
    let head_end = loop {
        let n = stream.read(&mut chunk).map_err(|e| e.to_string())?;
        if n == 0 { return Err("The connection closed before a full request".into()); }
        buf.extend_from_slice(&chunk[..n]);
        if let Some(i) = buf.windows(4).position(|w| w == b"\r\n\r\n") { break i; }
        if buf.len() > MAX_HEAD { return Err("The request head is too large".into()); }
    };
    let head = String::from_utf8_lossy(&buf[..head_end]).into_owned();
    let mut lines = head.split("\r\n");
    let first = lines.next().unwrap_or("");
    let mut parts = first.split_whitespace();
    let (method, path) = (parts.next().unwrap_or("").to_string(), parts.next().unwrap_or("").to_string());
    let headers: HashMap<String, String> = lines.filter_map(|l| l.split_once(':')).map(|(k, v)| (k.trim().to_ascii_lowercase(), v.trim().to_string())).collect();
    let len: usize = headers.get("content-length").and_then(|v| v.parse().ok()).unwrap_or(0);
    if len > MAX_BODY { return Err("The request body is too large".into()); }
    let mut body = buf[head_end + 4..].to_vec();
    while body.len() < len {
        let n = stream.read(&mut chunk).map_err(|e| e.to_string())?;
        if n == 0 { return Err("The connection closed before the whole body arrived".into()); }
        body.extend_from_slice(&chunk[..n]);
    }
    body.truncate(len);
    Ok(Request { method, path, headers, body })
}

/// Whether a request may be answered: right method and path, a matching access code, and not from a web page (no Origin) or a rebinding trick (Host must be this computer).
pub fn check(req: &Request, token: &str) -> Result<(), (u16, &'static str)> {
    if let Some(origin) = req.headers.get("origin") { if !origin.is_empty() { return Err((403, "Requests from web pages are refused")); } }
    let host = req.headers.get("host").map(|h| h.split(':').next().unwrap_or("").to_ascii_lowercase()).unwrap_or_default();
    if host != "127.0.0.1" && host != "localhost" { return Err((403, "Only this computer may connect")); }
    if req.method != "POST" || req.path != "/call" { return Err((404, "Not found")); }
    let given = req.headers.get("authorization").and_then(|v| v.strip_prefix("Bearer ")).unwrap_or("");
    if given.len() != token.len() || given.bytes().zip(token.bytes()).fold(0u8, |acc, (a, b)| acc | (a ^ b)) != 0 { return Err((401, "Wrong access code")); }
    Ok(())
}

fn respond(stream: &mut TcpStream, status: u16, body: &Value) {
    let text = body.to_string();
    let reason = match status { 200 => "OK", 401 => "Unauthorized", 403 => "Forbidden", 404 => "Not Found", 408 => "Request Timeout", _ => "Error" };
    let _ = write!(stream, "HTTP/1.1 {status} {reason}\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{text}", text.len());
}

fn serve(app: tauri::AppHandle, mut stream: TcpStream, token: String, pending: Arc<Mutex<HashMap<String, Sender<Value>>>>) {
    let _ = stream.set_read_timeout(Some(Duration::from_secs(10)));
    let req = match parse_request(&mut stream) { Ok(r) => r, Err(e) => { respond(&mut stream, 400, &json!({ "error": e })); return; } };
    if let Err((code, why)) = check(&req, &token) { respond(&mut stream, code, &json!({ "error": why })); return; }
    let Ok(call) = serde_json::from_slice::<Value>(&req.body) else { respond(&mut stream, 400, &json!({ "error": "The body is not JSON" })); return };
    if call["tool"].as_str().is_none_or(|t| t.is_empty() || t.len() > 64) { respond(&mut stream, 400, &json!({ "error": "Name a tool" })); return; }
    let id = make_token();
    let (tx, rx) = channel();
    if let Ok(mut p) = pending.lock() { p.insert(id.clone(), tx); }
    if app.emit("agent-request", json!({ "id": id, "tool": call["tool"], "args": call["args"] })).is_err() { respond(&mut stream, 500, &json!({ "error": "The app window did not take the request" })); return; }
    let answer = rx.recv_timeout(ANSWER_WAIT);
    if let Ok(mut p) = pending.lock() { p.remove(&id); }
    match answer {
        Ok(v) => respond(&mut stream, 200, &v),
        Err(_) => respond(&mut stream, 408, &json!({ "error": "The app did not answer in time. Is the Assistant screen open and the project loaded?" })),
    }
}

fn config_path(app: &tauri::AppHandle) -> Result<std::path::PathBuf, String> {
    app.path().app_data_dir().map(|d| d.join("agent.json")).map_err(|e| e.to_string())
}

fn info(app: &tauri::AppHandle, state: &AgentState) -> AgentInfo {
    let guard = state.running.lock().ok();
    let run = guard.as_ref().and_then(|g| g.as_ref());
    let token = run.and_then(|_| config_path(app).ok()).and_then(|p| std::fs::read_to_string(p).ok()).and_then(|t| serde_json::from_str::<Value>(&t).ok()).and_then(|v| v["token"].as_str().map(String::from));
    AgentInfo { enabled: run.is_some(), port: run.map(|r| r.port), token, config_path: config_path(app).ok().map(|p| p.to_string_lossy().into_owned()) }
}

/// Switches the local door on or off. On: a new access code and port are written to `agent.json` in the app's data folder, which the MCP server reads.
#[tauri::command]
pub fn agent_enable(app: tauri::AppHandle, state: State<'_, AgentState>, enabled: bool) -> Result<AgentInfo, String> {
    let mut guard = state.running.lock().map_err(|_| "busy".to_string())?;
    if let Some(run) = guard.take() {
        run.stop.store(true, Ordering::SeqCst);
        let _ = TcpStream::connect(SocketAddr::from((Ipv4Addr::LOCALHOST, run.port)));
        if let Ok(p) = config_path(&app) { let _ = std::fs::remove_file(p); }
    }
    if enabled {
        let listener = TcpListener::bind(SocketAddr::from((Ipv4Addr::LOCALHOST, 0))).map_err(|e| format!("Could not open the local door: {e}"))?;
        let port = listener.local_addr().map_err(|e| e.to_string())?.port();
        let token = make_token();
        let path = config_path(&app)?;
        if let Some(dir) = path.parent() { std::fs::create_dir_all(dir).map_err(|e| e.to_string())?; }
        std::fs::write(&path, json!({ "port": port, "token": token }).to_string()).map_err(|e| e.to_string())?;
        let stop = Arc::new(AtomicBool::new(false));
        let (stop2, pending, handle, token2) = (stop.clone(), state.pending.clone(), app.clone(), token.clone());
        std::thread::spawn(move || {
            for conn in listener.incoming() {
                if stop2.load(Ordering::SeqCst) { break; }
                if let Ok(stream) = conn { let (h, t, p) = (handle.clone(), token2.clone(), pending.clone()); std::thread::spawn(move || serve(h, stream, t, p)); }
            }
        });
        *guard = Some(Running { stop, port });
    }
    drop(guard);
    Ok(info(&app, &state))
}

#[tauri::command]
pub fn agent_status(app: tauri::AppHandle, state: State<'_, AgentState>) -> AgentInfo { info(&app, &state) }

/// The screen's answer to a request.
#[tauri::command]
pub fn agent_reply(state: State<'_, AgentState>, id: String, result: Value) -> Result<(), String> {
    let tx = state.pending.lock().map_err(|_| "busy".to_string())?.get(&id).cloned();
    match tx { Some(tx) => tx.send(result).map_err(|_| "The caller has gone away".to_string()), None => Err("No such request (it may have timed out)".into()) }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Cursor;

    fn req(method: &str, path: &str, headers: &[(&str, &str)], body: &str) -> Request {
        Request { method: method.into(), path: path.into(), headers: headers.iter().map(|(k, v)| (k.to_string(), v.to_string())).collect(), body: body.as_bytes().to_vec() }
    }
    const TOKEN: &str = "0123456789abcdef0123456789abcdef";

    #[test]
    fn makes_a_different_32_character_code_each_time() {
        let (a, b) = (make_token(), make_token());
        assert_eq!((a.len(), b.len()), (32, 32));
        assert_ne!(a, b);
        assert!(a.chars().all(|c| c.is_ascii_hexdigit()));
    }

    #[test]
    fn reads_a_request_with_a_body() {
        let raw = "POST /call HTTP/1.1\r\nHost: 127.0.0.1:5000\r\nAuthorization: Bearer abc\r\nContent-Length: 15\r\n\r\n{\"tool\":\"ping\"}EXTRA";
        let r = parse_request(&mut Cursor::new(raw.as_bytes().to_vec())).unwrap();
        assert_eq!((r.method.as_str(), r.path.as_str()), ("POST", "/call"));
        assert_eq!(r.headers.get("authorization").map(String::as_str), Some("Bearer abc"));
        assert_eq!(String::from_utf8(r.body).unwrap(), "{\"tool\":\"ping\"}");
    }

    #[test]
    fn refuses_a_head_or_body_that_is_too_large_or_cut_short() {
        let big = format!("POST /call HTTP/1.1\r\nContent-Length: {}\r\n\r\n", MAX_BODY + 1);
        assert!(parse_request(&mut Cursor::new(big.into_bytes())).is_err());
        let junk = vec![b'a'; MAX_HEAD + 10];
        assert!(parse_request(&mut Cursor::new(junk)).is_err());
        assert!(parse_request(&mut Cursor::new(b"POST /call HTTP/1.1\r\nContent-Length: 50\r\n\r\nshort".to_vec())).is_err());
    }

    #[test]
    fn answers_only_the_right_caller() {
        let good = req("POST", "/call", &[("host", "127.0.0.1:4000"), ("authorization", &format!("Bearer {TOKEN}"))], "{}");
        assert!(check(&good, TOKEN).is_ok());
        let local = req("POST", "/call", &[("host", "localhost:4000"), ("authorization", &format!("Bearer {TOKEN}"))], "{}");
        assert!(check(&local, TOKEN).is_ok());
        assert_eq!(check(&req("POST", "/call", &[("host", "127.0.0.1"), ("authorization", "Bearer nope")], "{}"), TOKEN).unwrap_err().0, 401);
        assert_eq!(check(&req("POST", "/call", &[("host", "127.0.0.1")], "{}"), TOKEN).unwrap_err().0, 401);
        assert_eq!(check(&req("POST", "/call", &[("host", "evil.example.com"), ("authorization", &format!("Bearer {TOKEN}"))], "{}"), TOKEN).unwrap_err().0, 403);
        assert_eq!(check(&req("POST", "/call", &[("host", "127.0.0.1"), ("origin", "https://evil.example.com"), ("authorization", &format!("Bearer {TOKEN}"))], "{}"), TOKEN).unwrap_err().0, 403);
        assert_eq!(check(&req("GET", "/call", &[("host", "127.0.0.1"), ("authorization", &format!("Bearer {TOKEN}"))], ""), TOKEN).unwrap_err().0, 404);
        assert_eq!(check(&req("POST", "/other", &[("host", "127.0.0.1"), ("authorization", &format!("Bearer {TOKEN}"))], ""), TOKEN).unwrap_err().0, 404);
    }
}
