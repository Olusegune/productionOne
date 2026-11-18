//! Local AI: find Ollama, LM Studio and ComfyUI on this computer (or your network), talk to them, and read what the machine can run. Nothing here needs the internet.
//!
//! The ComfyUI part ports FilmCrafter's tested approach: read the running ComfyUI's node list and model files (`/object_info`), turn ready-made workflow templates into
//! graphs that fit what is installed, fill the placeholders, queue the graph, wait, and fetch the first saved image or video. Templates say exactly which model file is
//! missing when they cannot run yet. A workflow you export from ComfyUI ("Save (API Format)") works too, with {{prompt}}, {{image}}, {{seed}} and friends.

use std::{fs, path::{Path, PathBuf}, process::Command, time::Duration};

use base64::Engine;
use serde::Serialize;
use serde_json::{json, Map, Value};
use tauri::Manager;

use super::{inspect_image_file, safe_package_name, ImportedAsset};

const ENGINE: base64::engine::GeneralPurpose = base64::engine::general_purpose::STANDARD;
const COMFY_PORTS: [u16; 5] = [8188, 8000, 8189, 8288, 8001];
const NO_WINDOW: u32 = 0x0800_0000;

/// Only this computer or machines on your own network: a local AI address is never an internet host.
pub fn normalize_base(url: &str) -> Result<String, String> {
    let trimmed = url.trim().trim_end_matches('/');
    let rest = trimmed.strip_prefix("http://").ok_or("A local AI address must start with http://")?;
    let host_port = rest.split('/').next().unwrap_or("");
    let host = host_port.rsplit_once(':').map(|(h, p)| if p.chars().all(|c| c.is_ascii_digit()) { h } else { host_port }).unwrap_or(host_port);
    let host = host.trim_matches(['[', ']']);
    let private = host == "localhost" || host == "::1" || host.ends_with(".local") || host.parse::<std::net::Ipv4Addr>().map(|ip| ip.is_loopback() || ip.is_private()).unwrap_or(false);
    if !private { return Err("Local AI addresses must be this computer (127.0.0.1, localhost) or a machine on your own network".into()); }
    if host_port.contains('@') { return Err("The address must not contain a user name or password".into()); }
    Ok(trimmed.to_string())
}

fn client(secs: u64) -> Result<reqwest::Client, String> {
    reqwest::Client::builder().timeout(Duration::from_secs(secs)).no_proxy().build().map_err(|e| e.to_string())
}

#[derive(Serialize, Default, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ModelInfo { pub name: String, pub size_gb: f64, pub detail: String }

#[derive(Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct ServiceInfo { pub url: String, pub up: bool, pub version: String, pub models: Vec<ModelInfo> }

#[derive(Serialize, Default, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ComfyInfo { pub url: String, pub version: String, pub device: String, pub vram_gb: f64 }

#[derive(Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct Hardware { pub gpu: String, pub vram_gb: f64, pub vram_free_gb: f64, pub ram_gb: f64 }

#[derive(Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct LocalStatus { pub ollama: ServiceInfo, pub lmstudio: ServiceInfo, pub comfyui: Vec<ComfyInfo>, pub hardware: Hardware }

pub fn parse_nvidia_smi(text: &str) -> Option<(String, f64, f64)> {
    let line = text.lines().find(|l| !l.trim().is_empty())?;
    let p: Vec<&str> = line.split(',').map(str::trim).collect();
    if p.len() < 3 { return None; }
    let total: f64 = p[1].parse().ok()?;
    let used: f64 = p[2].parse().ok()?;
    Some((p[0].to_string(), (total / 1024.0 * 10.0).round() / 10.0, ((total - used) / 1024.0 * 10.0).round() / 10.0))
}

fn hardware() -> Hardware {
    let mut h = Hardware::default();
    if let Ok(out) = Command::new("nvidia-smi").args(["--query-gpu=name,memory.total,memory.used", "--format=csv,noheader,nounits"]).creation_flags_hidden().output() {
        if let Some((name, total, free)) = parse_nvidia_smi(&String::from_utf8_lossy(&out.stdout)) { h.gpu = name; h.vram_gb = total; h.vram_free_gb = free; }
    }
    if let Ok(out) = Command::new("powershell").args(["-NoProfile", "-Command", "(Get-CimInstance Win32_ComputerSystem).TotalPhysicalMemory"]).creation_flags_hidden().output() {
        if let Ok(bytes) = String::from_utf8_lossy(&out.stdout).trim().parse::<f64>() { h.ram_gb = (bytes / 1e9 * 10.0).round() / 10.0; }
    }
    h
}

trait Hidden { fn creation_flags_hidden(&mut self) -> &mut Self; }
impl Hidden for Command {
    #[cfg(windows)]
    fn creation_flags_hidden(&mut self) -> &mut Self { use std::os::windows::process::CommandExt; self.creation_flags(NO_WINDOW) }
    #[cfg(not(windows))]
    fn creation_flags_hidden(&mut self) -> &mut Self { self }
}

async fn probe_ollama(base: &str) -> ServiceInfo {
    let mut info = ServiceInfo { url: base.to_string(), ..Default::default() };
    let Ok(http) = client(2) else { return info };
    let Ok(version) = http.get(format!("{base}/api/version")).send().await else { return info };
    let v: Value = version.json().await.unwrap_or(Value::Null);
    info.up = v["version"].is_string();
    info.version = v["version"].as_str().unwrap_or("").to_string();
    if let Ok(r) = http.get(format!("{base}/api/tags")).send().await {
        let t: Value = r.json().await.unwrap_or(Value::Null);
        info.models = t["models"].as_array().map(|list| list.iter().filter_map(|m| Some(ModelInfo { name: m["name"].as_str()?.to_string(), size_gb: (m["size"].as_f64().unwrap_or(0.0) / 1e8).round() / 10.0, detail: format!("{} {}", m["details"]["family"].as_str().unwrap_or(""), m["details"]["parameter_size"].as_str().unwrap_or("")).trim().to_string() })).collect()).unwrap_or_default();
    }
    info
}

async fn probe_lmstudio(base: &str) -> ServiceInfo {
    let mut info = ServiceInfo { url: base.to_string(), ..Default::default() };
    let Ok(http) = client(2) else { return info };
    let Ok(r) = http.get(format!("{base}/v1/models")).send().await else { return info };
    let v: Value = r.json().await.unwrap_or(Value::Null);
    if let Some(list) = v["data"].as_array() {
        info.up = true;
        info.models = list.iter().filter_map(|m| Some(ModelInfo { name: m["id"].as_str()?.to_string(), ..Default::default() })).collect();
    }
    info
}

async fn probe_comfy(base: &str) -> Option<ComfyInfo> {
    let r = client(1).ok()?.get(format!("{base}/system_stats")).send().await.ok()?;
    let s: Value = r.json().await.ok()?;
    s["system"].as_object()?;
    let dev = &s["devices"][0];
    Some(ComfyInfo { url: base.to_string(), version: s["system"]["comfyui_version"].as_str().unwrap_or("").to_string(), device: dev["name"].as_str().unwrap_or("").to_string(), vram_gb: ((dev["vram_total"].as_f64().unwrap_or(0.0) / 1e9) * 10.0).round() / 10.0 })
}

/// Looks for Ollama, LM Studio and ComfyUI on their usual ports (or the addresses you set) and reads the computer's graphics memory and RAM. Changes nothing.
#[tauri::command]
pub async fn local_detect(ollama_url: Option<String>, lmstudio_url: Option<String>, comfy_url: Option<String>) -> Result<LocalStatus, String> {
    let ollama_base = normalize_base(&ollama_url.unwrap_or_else(|| "http://127.0.0.1:11434".into()))?;
    let lm_base = normalize_base(&lmstudio_url.unwrap_or_else(|| "http://127.0.0.1:1234".into()))?;
    let mut comfy_bases: Vec<String> = COMFY_PORTS.iter().map(|p| format!("http://127.0.0.1:{p}")).collect();
    if let Some(custom) = comfy_url { let c = normalize_base(&custom)?; if !comfy_bases.contains(&c) { comfy_bases.insert(0, c); } }
    let comfy_task = async { let mut found = Vec::new(); for b in &comfy_bases { if let Some(i) = probe_comfy(b).await { if !found.iter().any(|x: &ComfyInfo| x.url == i.url) { found.push(i); } } } found };
    let (ollama, lmstudio, comfyui) = tokio::join!(probe_ollama(&ollama_base), probe_lmstudio(&lm_base), comfy_task);
    let hw = tauri::async_runtime::spawn_blocking(hardware).await.unwrap_or_default();
    Ok(LocalStatus { ollama, lmstudio, comfyui, hardware: hw })
}

fn data_url(path: &str) -> Result<(String, String), String> {
    let bytes = fs::read(path).map_err(|e| format!("Could not read image: {e}"))?;
    let mime = match image::guess_format(&bytes).map_err(|e| e.to_string())? { image::ImageFormat::Png => "image/png", image::ImageFormat::Jpeg => "image/jpeg", image::ImageFormat::WebP => "image/webp", _ => return Err("Images must be PNG, JPEG or WebP".into()) };
    Ok((mime.to_string(), ENGINE.encode(bytes)))
}

pub fn ollama_body(model: &str, system: &str, prompt: &str, json_mode: bool, images_b64: &[String]) -> Value {
    let mut user = json!({ "role": "user", "content": prompt });
    if !images_b64.is_empty() { user["images"] = json!(images_b64); }
    let mut body = json!({ "model": model, "stream": false, "messages": [{ "role": "system", "content": system }, user], "options": { "temperature": 0.2 } });
    if json_mode { body["format"] = json!("json"); }
    body
}

pub fn openai_chat_body(model: &str, system: &str, prompt: &str, images: &[(String, String)]) -> Value {
    let mut parts = vec![json!({ "type": "text", "text": prompt })];
    for (mime, data) in images { parts.push(json!({ "type": "image_url", "image_url": { "url": format!("data:{mime};base64,{data}") } })); }
    json!({ "model": model, "temperature": 0.2, "stream": false, "messages": [{ "role": "system", "content": system }, { "role": "user", "content": if images.is_empty() { json!(prompt) } else { json!(parts) } }] })
}

/// Asks a local model (Ollama or LM Studio) a question and returns its answer. Images are attached for models that can see.
#[tauri::command]
pub async fn local_llm(kind: String, base: String, model: String, system: String, prompt: String, json_mode: bool, images: Vec<String>) -> Result<String, String> {
    let base = normalize_base(&base)?;
    if model.trim().is_empty() || model.len() > 200 { return Err("Choose a model first".into()); }
    if images.len() > 6 { return Err("At most 6 images can be sent with one question".into()); }
    let http = client(600)?;
    match kind.as_str() {
        "ollama" => {
            let b64: Vec<String> = images.iter().map(|p| data_url(p).map(|(_, d)| d)).collect::<Result<_, _>>()?;
            let r = http.post(format!("{base}/api/chat")).json(&ollama_body(&model, &system, &prompt, json_mode, &b64)).send().await.map_err(|e| format!("Ollama could not be reached: {}", e.without_url()))?;
            let status = r.status();
            let v: Value = r.json().await.unwrap_or(Value::Null);
            if !status.is_success() { return Err(format!("Ollama request failed ({}): {}", status.as_u16(), v["error"].as_str().unwrap_or("no details"))); }
            v["message"]["content"].as_str().map(str::to_string).ok_or_else(|| "Ollama returned no answer".to_string())
        }
        "lmstudio" => {
            let imgs: Vec<(String, String)> = images.iter().map(|p| data_url(p)).collect::<Result<_, _>>()?;
            let r = http.post(format!("{base}/v1/chat/completions")).json(&openai_chat_body(&model, &system, &prompt, &imgs)).send().await.map_err(|e| format!("LM Studio could not be reached: {}", e.without_url()))?;
            let status = r.status();
            let v: Value = r.json().await.unwrap_or(Value::Null);
            if !status.is_success() { return Err(format!("LM Studio request failed ({}): {}", status.as_u16(), v["error"]["message"].as_str().or_else(|| v["error"].as_str()).unwrap_or("no details"))); }
            v["choices"][0]["message"]["content"].as_str().map(str::to_string).ok_or_else(|| "LM Studio returned no answer".to_string())
        }
        _ => Err("Unknown local model server".into()),
    }
}

// ------------------------------------------------------------------ ComfyUI

fn options(info: &Value, node: &str, field: &str) -> Vec<String> {
    info[node]["input"]["required"][field][0].as_array().map(|a| a.iter().filter_map(|x| x.as_str().map(str::to_string)).collect()).unwrap_or_default()
}

fn pick(options: &[String], needles: &[&str]) -> Option<String> {
    for n in needles { if let Some(hit) = options.iter().find(|o| o.to_lowercase().contains(n)) { return Some(hit.clone()); } }
    None
}

fn still_template(ckpt: &str) -> Value {
    json!({
        "1": {"class_type": "CheckpointLoaderSimple", "inputs": {"ckpt_name": ckpt}},
        "2": {"class_type": "CLIPTextEncode", "inputs": {"text": "{{prompt}}", "clip": ["1", 1]}},
        "3": {"class_type": "CLIPTextEncode", "inputs": {"text": "{{negative}}", "clip": ["1", 1]}},
        "4": {"class_type": "EmptyLatentImage", "inputs": {"width": "{{width}}", "height": "{{height}}", "batch_size": 1}},
        "5": {"class_type": "KSampler", "inputs": {"model": ["1", 0], "positive": ["2", 0], "negative": ["3", 0], "latent_image": ["4", 0], "seed": "{{seed}}", "steps": 28, "cfg": 6.0, "sampler_name": "dpmpp_2m", "scheduler": "karras", "denoise": 1.0}},
        "6": {"class_type": "VAEDecode", "inputs": {"samples": ["5", 0], "vae": ["1", 2]}},
        "7": {"class_type": "SaveImage", "inputs": {"images": ["6", 0], "filename_prefix": "production_one"}}
    })
}

/// FLUX.1 [dev] text to image, the layout of ComfyUI's own FLUX template. Built from ComfyUI's standard nodes; not run by this app.
fn flux_template(unet: &str, clip_l: &str, t5: &str, vae: &str) -> Value {
    json!({
        "1": {"class_type": "UNETLoader", "inputs": {"unet_name": unet, "weight_dtype": "default"}},
        "2": {"class_type": "DualCLIPLoader", "inputs": {"clip_name1": t5, "clip_name2": clip_l, "type": "flux", "device": "default"}},
        "3": {"class_type": "VAELoader", "inputs": {"vae_name": vae}},
        "4": {"class_type": "CLIPTextEncode", "inputs": {"text": "{{prompt}}", "clip": ["2", 0]}},
        "5": {"class_type": "FluxGuidance", "inputs": {"conditioning": ["4", 0], "guidance": 3.5}},
        "6": {"class_type": "BasicGuider", "inputs": {"model": ["1", 0], "conditioning": ["5", 0]}},
        "7": {"class_type": "RandomNoise", "inputs": {"noise_seed": "{{seed}}"}},
        "8": {"class_type": "KSamplerSelect", "inputs": {"sampler_name": "euler"}},
        "9": {"class_type": "BasicScheduler", "inputs": {"model": ["1", 0], "scheduler": "simple", "steps": 24, "denoise": 1.0}},
        "10": {"class_type": "EmptySD3LatentImage", "inputs": {"width": "{{width}}", "height": "{{height}}", "batch_size": 1}},
        "11": {"class_type": "SamplerCustomAdvanced", "inputs": {"noise": ["7", 0], "guider": ["6", 0], "sampler": ["8", 0], "sigmas": ["9", 0], "latent_image": ["10", 0]}},
        "12": {"class_type": "VAEDecode", "inputs": {"samples": ["11", 0], "vae": ["3", 0]}},
        "13": {"class_type": "SaveImage", "inputs": {"images": ["12", 0], "filename_prefix": "production_one"}}
    })
}

/// Wan 2.2 TI2V 5B, image to video from an approved reference (the layout of ComfyUI's own template; FilmCrafter has run this one).
fn wan22_template(unet: &str, clip: &str, vae: &str) -> Value {
    json!({
        "1": {"class_type": "UNETLoader", "inputs": {"unet_name": unet, "weight_dtype": "default"}},
        "2": {"class_type": "CLIPLoader", "inputs": {"clip_name": clip, "type": "wan", "device": "default"}},
        "3": {"class_type": "VAELoader", "inputs": {"vae_name": vae}},
        "4": {"class_type": "LoadImage", "inputs": {"image": "{{image}}"}},
        "5": {"class_type": "CLIPTextEncode", "inputs": {"text": "{{prompt}}", "clip": ["2", 0]}},
        "6": {"class_type": "CLIPTextEncode", "inputs": {"text": "{{negative}}", "clip": ["2", 0]}},
        "7": {"class_type": "ModelSamplingSD3", "inputs": {"model": ["1", 0], "shift": 8.0}},
        "8": {"class_type": "Wan22ImageToVideoLatent", "inputs": {"vae": ["3", 0], "start_image": ["4", 0], "width": "{{width}}", "height": "{{height}}", "length": "{{frames}}", "batch_size": 1}},
        "9": {"class_type": "KSampler", "inputs": {"model": ["7", 0], "positive": ["5", 0], "negative": ["6", 0], "latent_image": ["8", 0], "seed": "{{seed}}", "steps": 20, "cfg": 5.0, "sampler_name": "uni_pc", "scheduler": "simple", "denoise": 1.0}},
        "10": {"class_type": "VAEDecode", "inputs": {"samples": ["9", 0], "vae": ["3", 0]}},
        "11": {"class_type": "CreateVideo", "inputs": {"images": ["10", 0], "fps": "{{fps}}"}},
        "12": {"class_type": "SaveVideo", "inputs": {"video": ["11", 0], "filename_prefix": "production_one_clip", "format": "mp4", "codec": "h264"}}
    })
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Template { pub id: String, pub title: String, pub kind: String, pub ready: bool, pub uses: String, pub missing: Vec<String>, pub takes_reference: bool, pub note: String, #[serde(skip)] pub graph: Option<Value> }

/// Which ready-made workflows this ComfyUI can run right now, from its nodes and model files. Pure: no network.
pub fn plan_templates(info: &Value) -> Vec<Template> {
    let mut out = Vec::new();
    let ckpts = options(info, "CheckpointLoaderSimple", "ckpt_name");
    let ck = pick(&ckpts, &["xl", "juggernaut", "realvis", "dreamshaper", "sd_xl", "v1-5"]).or_else(|| ckpts.first().cloned());
    out.push(Template { id: "sdxl-keyframes".into(), title: "Image: any checkpoint (SDXL and similar)".into(), kind: "image".into(), ready: ck.is_some(), uses: ck.clone().unwrap_or_default(), missing: if ck.is_some() { vec![] } else { vec!["any image checkpoint in models/checkpoints (for example an SDXL model)".into()] }, takes_reference: false, note: "Works on modest graphics cards. Text only: no reference images.".into(), graph: ck.map(|c| still_template(&c)) });

    let unets = options(info, "UNETLoader", "unet_name");
    let clips_dual = options(info, "DualCLIPLoader", "clip_name1");
    let vaes = options(info, "VAELoader", "vae_name");
    let (fu, fl, ft, fv) = (pick(&unets, &["flux1-dev", "flux-dev", "flux_dev", "flux1_dev"]), pick(&clips_dual, &["clip_l"]), pick(&clips_dual, &["t5xxl"]), pick(&vaes, &["ae.safetensors", "flux", "ae."]));
    let mut flux_missing = Vec::new();
    for n in ["UNETLoader", "DualCLIPLoader", "FluxGuidance", "BasicGuider", "SamplerCustomAdvanced", "EmptySD3LatentImage"] { if info.get(n).is_none() { flux_missing.push(format!("a newer ComfyUI (missing the {n} node)")); break; } }
    if fu.is_none() { flux_missing.push("flux1-dev (a FLUX.1 [dev] model in models/diffusion_models; GGUF or fp8 versions suit 12 GB cards)".into()); }
    if fl.is_none() { flux_missing.push("clip_l.safetensors (in models/text_encoders)".into()); }
    if ft.is_none() { flux_missing.push("t5xxl_fp8_e4m3fn.safetensors (in models/text_encoders)".into()); }
    if fv.is_none() { flux_missing.push("ae.safetensors (the FLUX VAE, in models/vae)".into()); }
    let flux_ready = flux_missing.is_empty();
    out.push(Template { id: "flux-dev".into(), title: "Image: FLUX.1 [dev]".into(), kind: "image".into(), ready: flux_ready, uses: [fu.clone(), fl.clone(), ft.clone(), fv.clone()].into_iter().flatten().collect::<Vec<_>>().join(", "), missing: flux_missing, takes_reference: false, note: "Top-tier local image quality and text. Built from ComfyUI's standard FLUX nodes; this app has not run it yet.".into(), graph: if flux_ready { Some(flux_template(&fu.unwrap(), &fl.unwrap(), &ft.unwrap(), &fv.unwrap())) } else { None } });

    let wclips = options(info, "CLIPLoader", "clip_name");
    let (wu, wc, wv) = (pick(&unets, &["ti2v_5b", "wan2.2_ti2v", "ti2v"]), pick(&wclips, &["umt5"]), pick(&vaes, &["wan2.2_vae", "wan2_2_vae"]));
    let mut wan_missing = Vec::new();
    let need: Vec<&str> = ["UNETLoader", "CLIPLoader", "VAELoader", "Wan22ImageToVideoLatent", "CreateVideo", "SaveVideo", "ModelSamplingSD3"].into_iter().filter(|n| info.get(*n).is_none()).collect();
    if !need.is_empty() { wan_missing.push(format!("a newer ComfyUI (update it: missing {})", need.join(", "))); }
    if wu.is_none() { wan_missing.push("wan2.2_ti2v_5B_fp16.safetensors (diffusion_models, 10 GB)".into()); }
    if wc.is_none() { wan_missing.push("umt5_xxl_fp8_e4m3fn_scaled.safetensors (text_encoders, 6.7 GB)".into()); }
    if wv.is_none() { wan_missing.push("wan2.2_vae.safetensors (vae, 1.4 GB)".into()); }
    let wan_ready = wan_missing.is_empty();
    out.push(Template { id: "wan22-5b-video".into(), title: "Video: Wan 2.2 5B (from your approved image)".into(), kind: "video".into(), ready: wan_ready, uses: [wu.clone(), wc.clone(), wv.clone()].into_iter().flatten().collect::<Vec<_>>().join(", "), missing: wan_missing, takes_reference: true, note: "Runs on ordinary graphics cards. Made for clips of about 5 seconds. FilmCrafter has run this workflow.".into(), graph: if wan_ready { Some(wan22_template(&wu.unwrap(), &wc.unwrap(), &wv.unwrap())) } else { None } });
    // Real-ESRGAN (and similar 4x models): a picture in, a picture four times larger out. Free and local.
    let up_models = options(info, "UpscaleModelLoader", "model_name");
    let up = pick(&up_models, &["realesrgan", "esrgan", "4x", "ultrasharp", "swinir"]);
    let mut up_missing = Vec::new();
    for n in ["LoadImage", "UpscaleModelLoader", "ImageUpscaleWithModel", "SaveImage"] { if info.get(n).is_none() { up_missing.push(format!("a newer ComfyUI (missing the {n} node)")); break; } }
    if up.is_none() { up_missing.push("an upscale model such as RealESRGAN_x4plus.pth in models/upscale_models".into()); }
    let up_ready = up_missing.is_empty();
    out.push(Template { id: "upscale-esrgan".into(), title: "Upscale: Real-ESRGAN (4x, from a picture)".into(), kind: "upscale".into(), ready: up_ready, uses: up.clone().unwrap_or_default(), missing: up_missing, takes_reference: true, note: "Free. Makes a picture four times larger and cleaner on your own computer. Used by Image quality > Enlarge.".into(), graph: up.map(|m| json!({
        "1": {"class_type": "LoadImage", "inputs": {"image": "{{image}}"}},
        "2": {"class_type": "UpscaleModelLoader", "inputs": {"model_name": m}},
        "3": {"class_type": "ImageUpscaleWithModel", "inputs": {"upscale_model": ["2", 0], "image": ["1", 0]}},
        "4": {"class_type": "SaveImage", "inputs": {"images": ["3", 0], "filename_prefix": "production_one_upscale"}}
    })).filter(|_| up_ready) });
    out
}

pub fn dims(aspect: &str, max_side: f64) -> (u32, u32) {
    let (a, b) = aspect.split_once(':').and_then(|(x, y)| Some((x.parse::<f64>().ok()?, y.parse::<f64>().ok()?))).filter(|(x, y)| *x > 0.0 && *y > 0.0).unwrap_or((16.0, 9.0));
    let (w, h) = if a >= b { (max_side, max_side * b / a) } else { (max_side * a / b, max_side) };
    (((w / 16.0).round() * 16.0) as u32, ((h / 16.0).round() * 16.0) as u32)
}

/// Puts the request's values into a copy of the graph. A string that is exactly {{name}} becomes a number where one is needed.
pub fn fill(graph: &Value, values: &Map<String, Value>) -> Value {
    fn sub(v: &Value, values: &Map<String, Value>) -> Value {
        match v {
            Value::String(s) => {
                let t = s.trim();
                if let Some(name) = t.strip_prefix("{{").and_then(|x| x.strip_suffix("}}")) { if let Some(val) = values.get(name.trim()) { return val.clone(); } }
                let mut out = s.clone();
                for (k, val) in values { let pat = format!("{{{{{k}}}}}"); if out.contains(&pat) { out = out.replace(&pat, &match val { Value::String(x) => x.clone(), other => other.to_string() }); } }
                Value::String(out)
            }
            Value::Array(a) => Value::Array(a.iter().map(|x| sub(x, values)).collect()),
            Value::Object(o) => Value::Object(o.iter().map(|(k, x)| (k.clone(), sub(x, values))).collect()),
            other => other.clone(),
        }
    }
    sub(graph, values)
}

fn friendly(msg: &str) -> String {
    let m = msg.to_lowercase();
    if m.contains("out of memory") || m.contains("oom") { return format!("The graphics card ran out of memory. Try a smaller size, a lighter model (a GGUF or fp8 version), or close other programs. ({msg})"); }
    msg.to_string()
}

#[tauri::command]
pub async fn comfy_templates(base: String) -> Result<Value, String> {
    let base = normalize_base(&base)?;
    let info: Value = client(60)?.get(format!("{base}/object_info")).send().await.map_err(|_| format!("ComfyUI is not answering at {base}. Start it, then press Find local AI."))?.json().await.map_err(|e| e.to_string())?;
    serde_json::to_value(plan_templates(&info)).map_err(|e| e.to_string())
}

fn comfy_dir(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    app.path().app_data_dir().map(|d| d.join("comfy-workflows")).map_err(|e| e.to_string())
}

/// Lists workflows you exported from ComfyUI (API format) and saved here.
#[tauri::command]
pub fn comfy_custom_workflows(app: tauri::AppHandle) -> Vec<String> {
    comfy_dir(&app).ok().and_then(|d| fs::read_dir(d).ok()).map(|rd| rd.filter_map(|e| e.ok()).filter_map(|e| e.file_name().to_str().and_then(|n| n.strip_suffix(".json").map(str::to_string))).collect()).unwrap_or_default()
}

/// Lets the person choose a ComfyUI workflow file (.json).
#[tauri::command]
pub async fn pick_workflow_file(app: tauri::AppHandle) -> Result<Option<String>, String> {
    use tauri_plugin_dialog::DialogExt;
    let picked = app.dialog().file().set_title("Choose a ComfyUI workflow").add_filter("ComfyUI workflow (API format)", &["json"]).blocking_pick_file();
    match picked { Some(f) => Ok(Some(f.into_path().map_err(|e| e.to_string())?.to_string_lossy().into_owned())), None => Ok(None) }
}

#[tauri::command]
pub fn comfy_add_workflow(app: tauri::AppHandle, path: String) -> Result<String, String> {
    let text = fs::read_to_string(&path).map_err(|e| format!("Could not read the file: {e}"))?;
    let g: Value = serde_json::from_str(&text).map_err(|_| "That file is not JSON".to_string())?;
    let ok = g.as_object().map(|o| !o.is_empty() && o.values().all(|n| n.get("class_type").is_some())).unwrap_or(false);
    if !ok { return Err("That is not a ComfyUI API-format workflow. In ComfyUI use Workflow, Export (API).".into()); }
    let name = safe_package_name(Path::new(&path).file_stem().and_then(|s| s.to_str()).unwrap_or("workflow"));
    if name.is_empty() { return Err("Give the file a plain name".into()); }
    let dir = comfy_dir(&app)?;
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    fs::write(dir.join(format!("{name}.json")), text).map_err(|e| e.to_string())?;
    Ok(name)
}

pub struct ComfyRequest { pub base: String, pub model: String, pub prompt: String, pub negative: String, pub aspect: String, pub seed: Option<i64>, pub image: Option<String>, pub duration: f64, pub max_side: f64, pub wait_secs: u64 }

pub async fn comfy_run(app: &tauri::AppHandle, r: ComfyRequest) -> Result<(Vec<u8>, String), String> {
    let base = normalize_base(&r.base)?;
    let http = client(120)?;
    let info: Value = http.get(format!("{base}/object_info")).send().await.map_err(|_| format!("ComfyUI is not answering at {base}"))?.json().await.map_err(|e| e.to_string())?;
    let graph = if let Some(t) = plan_templates(&info).into_iter().find(|t| t.id == r.model) {
        if !t.ready { return Err(format!("{} cannot run yet. Missing: {}", t.title, t.missing.join("; "))); }
        t.graph.ok_or("The template has no graph")?
    } else {
        let file = comfy_dir(app)?.join(format!("{}.json", safe_package_name(&r.model)));
        serde_json::from_str(&fs::read_to_string(&file).map_err(|_| format!("There is no workflow called {}", r.model))?).map_err(|e| e.to_string())?
    };
    let mut values = Map::new();
    let (w, h) = dims(&r.aspect, r.max_side);
    let fps = 24.0;
    values.insert("prompt".into(), json!(r.prompt));
    values.insert("negative".into(), json!(r.negative));
    values.insert("seed".into(), json!(r.seed.unwrap_or_else(|| std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|d| d.as_nanos() as i64).unwrap_or(1) & 0x7fff_ffff)));
    values.insert("width".into(), json!(w));
    values.insert("height".into(), json!(h));
    values.insert("frames".into(), json!(((r.duration * fps / 4.0).round() as i64) * 4 + 1));
    values.insert("fps".into(), json!(fps as i64));
    values.insert("duration".into(), json!(r.duration));
    if let Some(path) = &r.image {
        let bytes = fs::read(path).map_err(|e| format!("Could not read the reference image: {e}"))?;
        let name = Path::new(path).file_name().map(|n| n.to_string_lossy().into_owned()).unwrap_or_else(|| "reference.png".into());
        let part = reqwest::multipart::Part::bytes(bytes).file_name(name);
        let form = reqwest::multipart::Form::new().part("image", part).text("overwrite", "true").text("type", "input");
        let up: Value = http.post(format!("{base}/upload/image")).multipart(form).send().await.map_err(|e| format!("Could not upload the image to ComfyUI: {}", e.without_url()))?.json().await.map_err(|e| e.to_string())?;
        let uploaded = up["name"].as_str().ok_or("ComfyUI did not accept the image")?;
        values.insert("image".into(), json!(match up["subfolder"].as_str() { Some(s) if !s.is_empty() => format!("{s}/{uploaded}"), _ => uploaded.to_string() }));
    }
    let filled = fill(&graph, &values);
    let queued = http.post(format!("{base}/prompt")).json(&json!({ "prompt": filled, "client_id": "production-one" })).send().await.map_err(|e| format!("ComfyUI could not be reached: {}", e.without_url()))?;
    let status = queued.status();
    let qv: Value = queued.json().await.unwrap_or(Value::Null);
    if !status.is_success() {
        let errs: Vec<String> = qv["node_errors"].as_object().map(|o| o.values().flat_map(|n| n["errors"].as_array().cloned().unwrap_or_default().into_iter().map(move |e| format!("{}: {} {}", n["class_type"].as_str().unwrap_or("node"), e["message"].as_str().unwrap_or(""), e["details"].as_str().unwrap_or("")))).collect()).unwrap_or_default();
        return Err(format!("ComfyUI refused the workflow ({}): {}", status.as_u16(), if errs.is_empty() { qv["error"]["message"].as_str().unwrap_or("no details").to_string() } else { errs.join("; ") }));
    }
    let id = qv["prompt_id"].as_str().ok_or("ComfyUI did not return a job id")?.to_string();
    let started = std::time::Instant::now();
    let file = loop {
        tokio::time::sleep(Duration::from_secs(2)).await;
        let h: Value = http.get(format!("{base}/history/{id}")).send().await.map_err(|e| e.to_string())?.json().await.unwrap_or(Value::Null);
        if let Some(entry) = h.get(&id) {
            if entry["status"]["status_str"] == "error" {
                let msg = entry["status"]["messages"].as_array().and_then(|m| m.iter().find(|x| x[0] == "execution_error")).and_then(|x| x[1]["exception_message"].as_str()).unwrap_or("The workflow failed in ComfyUI.");
                return Err(friendly(msg));
            }
            let mut files: Vec<(u8, Value)> = Vec::new();
            for out in entry["outputs"].as_object().into_iter().flat_map(|o| o.values()) {
                for (rank, key) in [(0u8, "videos"), (1, "gifs"), (2, "images")] { for f in out[key].as_array().into_iter().flatten() { if f["type"] == "output" { files.push((rank, f.clone())); } } }
            }
            files.sort_by_key(|(rank, _)| *rank);
            match files.into_iter().next() { Some((_, f)) => break f, None => return Err("The workflow finished but saved no image or video. Add a Save node.".into()) }
        }
        if started.elapsed().as_secs() > r.wait_secs { return Err(format!("ComfyUI had not finished after {} seconds. It may still be working: check the ComfyUI window.", r.wait_secs)); }
    };
    let bytes = http.get(format!("{base}/view")).query(&[("filename", file["filename"].as_str().unwrap_or("")), ("subfolder", file["subfolder"].as_str().unwrap_or("")), ("type", "output")]).send().await.map_err(|e| e.to_string())?.bytes().await.map_err(|e| e.to_string())?.to_vec();
    let ext = if bytes.len() > 12 && &bytes[4..8] == b"ftyp" { "mp4" } else if bytes.starts_with(&[0x1A, 0x45, 0xDF, 0xA3]) { "webm" } else { match image::guess_format(&bytes) { Ok(image::ImageFormat::Png) => "png", Ok(image::ImageFormat::Jpeg) => "jpg", Ok(image::ImageFormat::WebP) => "webp", _ => return Err("ComfyUI returned a file this app cannot read".into()) } };
    Ok((bytes, ext.to_string()))
}

pub fn save_output(app: &tauri::AppHandle, stem: &str, bytes: &[u8], ext: &str) -> Result<PathBuf, String> {
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?.join("assets");
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let mut path = dir.join(format!("{stem}.{ext}"));
    let mut n = 2;
    while path.exists() { path = dir.join(format!("{stem}_{n}.{ext}")); n += 1; }
    fs::write(&path, bytes).map_err(|e| e.to_string())?;
    Ok(path)
}

/// Makes one image with ComfyUI from a template (or your own exported workflow). Free and offline.
#[tauri::command]
pub async fn comfy_generate_image(app: tauri::AppHandle, base: String, model: String, prompt: String, aspect: String, reference: Option<String>, output_name: String, max_side: Option<f64>) -> Result<ImportedAsset, String> {
    let stem = safe_package_name(&output_name);
    if stem.is_empty() || prompt.trim().is_empty() { return Err("A prompt and an output name are required".into()); }
    let (bytes, ext) = comfy_run(&app, ComfyRequest { base, model, prompt, negative: "blurry, low quality, text, watermark, extra limbs, deformed hands, cropped".into(), aspect, seed: None, image: reference, duration: 5.0, max_side: max_side.unwrap_or(1024.0), wait_secs: 900 }).await?;
    if ext == "mp4" || ext == "webm" { return Err("That workflow made a video, not an image. Choose an image workflow.".into()); }
    let path = save_output(&app, &stem, &bytes, &ext)?;
    let inspection = inspect_image_file(&path)?;
    Ok(ImportedAsset { path: path.to_string_lossy().into_owned(), inspection })
}

/// Makes a short clip with ComfyUI (Wan 2.2 and similar) from an approved image.
#[tauri::command]
pub async fn comfy_generate_video(app: tauri::AppHandle, base: String, model: String, prompt: String, aspect: String, reference: String, output_name: String, duration: f64) -> Result<String, String> {
    let stem = safe_package_name(&output_name);
    if stem.is_empty() || prompt.trim().is_empty() { return Err("A prompt and an output name are required".into()); }
    let (bytes, ext) = comfy_run(&app, ComfyRequest { base, model, prompt, negative: "blurry, distorted, extra limbs, flicker, text, watermark, cut".into(), aspect, seed: None, image: Some(reference), duration: duration.clamp(1.0, 10.0), max_side: 832.0, wait_secs: 1800 }).await?;
    if ext != "mp4" && ext != "webm" { return Err("That workflow made an image, not a video. Choose a video workflow.".into()); }
    Ok(save_output(&app, &stem, &bytes, &ext)?.to_string_lossy().into_owned())
}

fn config_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    app.path().app_data_dir().map(|d| d.join("local-ai.json")).map_err(|e| e.to_string())
}

/// Where each local service was found, and which local model answers text questions. Saved so the connection is automatic next time.
#[tauri::command]
pub fn local_config_get(app: tauri::AppHandle) -> Value {
    config_path(&app).ok().and_then(|p| fs::read_to_string(p).ok()).and_then(|t| serde_json::from_str(&t).ok()).unwrap_or_else(|| json!({}))
}

#[tauri::command]
pub fn local_config_set(app: tauri::AppHandle, config: Value) -> Result<(), String> {
    let obj = config.as_object().ok_or("Invalid settings")?;
    let mut clean = Map::new();
    for key in ["ollamaUrl", "lmstudioUrl", "comfyUrl"] { if let Some(v) = obj.get(key).and_then(Value::as_str) { clean.insert(key.into(), json!(normalize_base(v)?)); } }
    for key in ["textProvider", "textModel", "visionModel"] { if let Some(v) = obj.get(key).and_then(Value::as_str) { if v.len() <= 200 { clean.insert(key.into(), json!(v)); } } }
    for key in ["autoConnect"] { if let Some(v) = obj.get(key).and_then(Value::as_bool) { clean.insert(key.into(), json!(v)); } }
    let path = config_path(&app)?;
    if let Some(parent) = path.parent() { fs::create_dir_all(parent).map_err(|e| e.to_string())?; }
    fs::write(path, serde_json::to_string_pretty(&Value::Object(clean)).map_err(|e| e.to_string())?).map_err(|e| e.to_string())
}

pub fn comfy_base(app: &tauri::AppHandle) -> String {
    local_config_get(app.clone())["comfyUrl"].as_str().and_then(|u| normalize_base(u).ok()).unwrap_or_else(|| "http://127.0.0.1:8188".to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn only_accepts_this_computer_or_your_own_network() {
        for ok in ["http://127.0.0.1:8188", "http://localhost:11434/", "http://192.168.1.20:8188", "http://10.0.0.5:1234", "http://172.16.4.2:8188", "http://my-pc.local:8188"] { assert!(normalize_base(ok).is_ok(), "{ok}"); }
        for bad in ["https://127.0.0.1:8188", "http://example.com:8188", "http://8.8.8.8:8188", "http://user:pw@127.0.0.1:8188", "127.0.0.1:8188", "http://172.32.0.1:8188", "http://localhost.evil.com"] { assert!(normalize_base(bad).is_err(), "{bad}"); }
        assert_eq!(normalize_base("http://127.0.0.1:8188/").unwrap(), "http://127.0.0.1:8188");
    }

    #[test]
    fn reads_nvidia_smi_output() {
        assert_eq!(parse_nvidia_smi("NVIDIA GeForce RTX 3060, 12288, 1213\n"), Some(("NVIDIA GeForce RTX 3060".to_string(), 12.0, 10.8)));
        assert_eq!(parse_nvidia_smi(""), None);
    }

    fn info() -> Value {
        json!({
            "CheckpointLoaderSimple": {"input": {"required": {"ckpt_name": [["v1-5-pruned.safetensors", "juggernautXL_v9.safetensors"]]}}},
            "UNETLoader": {"input": {"required": {"unet_name": [["flux1-dev-fp8.safetensors", "wan2.2_ti2v_5B_fp16.safetensors"]]}}},
            "DualCLIPLoader": {"input": {"required": {"clip_name1": [["clip_l.safetensors", "t5xxl_fp8_e4m3fn.safetensors"]]}}},
            "CLIPLoader": {"input": {"required": {"clip_name": [["umt5_xxl_fp8_e4m3fn_scaled.safetensors"]]}}},
            "VAELoader": {"input": {"required": {"vae_name": [["ae.safetensors", "wan2.2_vae.safetensors"]]}}},
            "FluxGuidance": {}, "BasicGuider": {}, "SamplerCustomAdvanced": {}, "EmptySD3LatentImage": {},
            "UpscaleModelLoader": {"input": {"required": {"model_name": [["RealESRGAN_x4plus.pth", "4x-UltraSharp.pth"]]}}}, "ImageUpscaleWithModel": {}, "SaveImage": {}, "LoadImage": {},
            "Wan22ImageToVideoLatent": {}, "CreateVideo": {}, "SaveVideo": {}, "ModelSamplingSD3": {}
        })
    }

    #[test]
    fn picks_installed_models_and_says_what_is_missing() {
        let t = plan_templates(&info());
        assert!(t.iter().all(|x| x.ready), "{:?}", t.iter().map(|x| x.missing.clone()).collect::<Vec<_>>());
        assert_eq!(t[0].uses, "juggernautXL_v9.safetensors");
        let bare = plan_templates(&json!({"CheckpointLoaderSimple": {"input": {"required": {"ckpt_name": [[]]}}}}));
        assert!(!bare[0].ready && bare[0].missing[0].contains("checkpoint"));
        assert!(!bare[1].ready && bare[1].missing.iter().any(|m| m.contains("flux1-dev")));
        assert!(!bare[2].ready && bare[2].missing.iter().any(|m| m.contains("wan2.2_ti2v_5B")));
        assert!(bare[2].graph.is_none());
        let up = t.iter().find(|x| x.id == "upscale-esrgan").expect("the upscale workflow is listed");
        assert!(up.ready && up.uses == "RealESRGAN_x4plus.pth" && up.takes_reference && up.graph.is_some());
        let none = plan_templates(&json!({}));
        let up = none.iter().find(|x| x.id == "upscale-esrgan").unwrap();
        assert!(!up.ready && up.graph.is_none() && up.missing.iter().any(|m| m.contains("RealESRGAN")));
    }

    #[test]
    fn fills_placeholders_with_numbers_where_a_number_is_needed() {
        let t = plan_templates(&info());
        let mut v = Map::new();
        v.insert("prompt".into(), json!("a knight"));
        v.insert("negative".into(), json!("blurry"));
        v.insert("seed".into(), json!(42));
        v.insert("width".into(), json!(768));
        v.insert("height".into(), json!(1024));
        let g = fill(t[0].graph.as_ref().unwrap(), &v);
        assert_eq!(g["2"]["inputs"]["text"], "a knight");
        assert_eq!(g["5"]["inputs"]["seed"], 42);
        assert_eq!(g["4"]["inputs"]["width"], 768);
        assert!(!g.to_string().contains("{{"));
        assert_eq!(fill(&json!({"1": {"inputs": {"text": "A {{prompt}} by night"}}}), &v)["1"]["inputs"]["text"], "A a knight by night");
    }

    #[test]
    fn sizes_images_to_the_aspect_in_multiples_of_16() {
        assert_eq!(dims("16:9", 1024.0), (1024, 576));
        assert_eq!(dims("3:4", 1024.0), (768, 1024));
        assert_eq!(dims("1:1", 1024.0), (1024, 1024));
        assert_eq!(dims("bad", 832.0), (832, 464));
    }

    #[test]
    fn builds_local_chat_bodies() {
        let o = ollama_body("gemma3:12b", "sys", "hi", true, &["QUJD".to_string()]);
        assert_eq!(o["format"], "json");
        assert_eq!(o["messages"][1]["images"][0], "QUJD");
        assert_eq!(o["stream"], false);
        let l = openai_chat_body("m", "sys", "hi", &[("image/png".to_string(), "QUJD".to_string())]);
        assert!(l["messages"][1]["content"][1]["image_url"]["url"].as_str().unwrap().starts_with("data:image/png;base64,"));
        assert_eq!(openai_chat_body("m", "s", "hi", &[])["messages"][1]["content"], "hi");
    }
}
