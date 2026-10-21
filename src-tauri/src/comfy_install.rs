//! One-click ComfyUI for people who do not want a terminal: find the right official Windows build for this graphics card, download it from ComfyUI's own GitHub releases,
//! check it against the checksum GitHub publishes, unpack it with the tar that ships with Windows, start it, and fetch the model files a ready-made workflow needs.
//! Ported from FilmCrafter's installer. Nothing is downloaded until the person presses the button, and every address downloaded from is fixed in this file.

use std::{fs, io::Write, path::{Path, PathBuf}, process::Command, time::Duration};

use serde::Serialize;
use serde_json::Value;
use sha2::{Digest, Sha256};
use tauri::{Emitter, Manager};

const RELEASE_API: &str = "https://api.github.com/repos/comfyanonymous/ComfyUI/releases/latest";
const TRUSTED: [&str; 2] = ["https://github.com/Comfy-Org/ComfyUI/releases/download/", "https://github.com/comfyanonymous/ComfyUI/releases/download/"];
const UNPACKED_PER_PACKED: f64 = 3.4;
const SPARE_GB: f64 = 4.0;
const MIN_VRAM_GB: f64 = 6.0;

#[derive(Serialize, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct Asset { pub name: String, pub size: u64, pub url: String, pub sha256: Option<String> }

#[derive(Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct InstallPlan { pub ok: bool, pub installed: bool, pub reason: String, pub dest: String, pub path: String, pub start: String, pub gpu: String, pub vendor: String, pub vram_gb: f64, pub tag: String, pub asset: Option<Asset>, pub download_gb: f64, pub need_gb: f64, pub free_gb: f64, pub warnings: Vec<String> }

fn no_window(cmd: &mut Command) -> &mut Command {
    #[cfg(windows)] { use std::os::windows::process::CommandExt; cmd.creation_flags(0x0800_0000); }
    cmd
}

pub fn asset_pattern(vendor: &str) -> Option<String> {
    matches!(vendor, "nvidia" | "amd" | "intel").then(|| format!("ComfyUI_windows_portable_{vendor}.7z"))
}

/// The release file for this kind of graphics card, accepted only from ComfyUI's own repository on github.com. Pure.
pub fn pick_asset(assets: &[Value], vendor: &str) -> Option<Asset> {
    let want = asset_pattern(vendor)?;
    let a = assets.iter().find(|x| x["name"].as_str() == Some(want.as_str()))?;
    let url = a["browser_download_url"].as_str()?;
    if !TRUSTED.iter().any(|p| url.starts_with(p)) { return None; }
    let digest = a["digest"].as_str().unwrap_or("");
    Some(Asset { name: want, size: a["size"].as_u64().unwrap_or(0), url: url.to_string(), sha256: digest.strip_prefix("sha256:").map(|d| d.to_lowercase()) })
}

pub fn space_needed_gb(size_bytes: u64) -> f64 { ((size_bytes as f64 / 1e9 * (1.0 + UNPACKED_PER_PACKED) + SPARE_GB) * 10.0).round() / 10.0 }

pub fn find_start_script(root: &Path) -> Option<PathBuf> {
    let mut bats: Vec<PathBuf> = fs::read_dir(root).ok()?.filter_map(|e| e.ok()).map(|e| e.path()).filter(|p| p.extension().map(|x| x == "bat").unwrap_or(false) && p.file_name().map(|n| n.to_string_lossy().starts_with("run_")).unwrap_or(false)).collect();
    bats.sort();
    let name = |p: &PathBuf| p.file_name().map(|n| n.to_string_lossy().to_lowercase()).unwrap_or_default();
    bats.iter().find(|p| name(p).contains("gpu")).or_else(|| bats.iter().find(|p| name(p).contains("cpu"))).cloned()
}

fn find_portable(dest: &Path) -> Option<PathBuf> {
    [dest.join("ComfyUI_windows_portable"), dest.to_path_buf()].into_iter().find(|p| p.is_dir() && find_start_script(p).is_some() && p.join("ComfyUI").is_dir())
}

fn registry_path(app: &tauri::AppHandle) -> Option<PathBuf> { app.path().app_data_dir().ok().map(|d| d.join("comfy-installs.json")) }
fn registry(app: &tauri::AppHandle) -> Vec<String> { registry_path(app).and_then(|p| fs::read_to_string(p).ok()).and_then(|t| serde_json::from_str(&t).ok()).unwrap_or_default() }
fn remember(app: &tauri::AppHandle, path: &str) {
    if let Some(p) = registry_path(app) {
        let mut cur: Vec<String> = registry(app).into_iter().filter(|x| !x.eq_ignore_ascii_case(path)).collect();
        cur.push(path.to_string());
        if let Some(parent) = p.parent() { let _ = fs::create_dir_all(parent); }
        let _ = fs::write(p, serde_json::to_string(&cur).unwrap_or_default());
    }
}

fn default_dest(app: &tauri::AppHandle) -> PathBuf { app.path().home_dir().map(|h| h.join("Production One ComfyUI")).unwrap_or_else(|_| PathBuf::from("C:\\Production One ComfyUI")) }

fn free_gb(path: &Path) -> f64 {
    let mut probe = path.to_path_buf();
    while !probe.exists() { if !probe.pop() { break; } }
    let script = format!("(Get-Item -LiteralPath '{}').PSDrive.Free", probe.to_string_lossy().replace('\'', "''"));
    no_window(Command::new("powershell").args(["-NoProfile", "-Command", &script])).output().ok().and_then(|o| String::from_utf8_lossy(&o.stdout).trim().parse::<f64>().ok()).map(|b| (b / 1e9 * 10.0).round() / 10.0).unwrap_or(0.0)
}

fn gpu() -> (String, String, f64) {
    let out = no_window(Command::new("nvidia-smi").args(["--query-gpu=name,memory.total", "--format=csv,noheader,nounits"])).output().ok();
    if let Some(o) = out { let text = String::from_utf8_lossy(&o.stdout).to_string(); if let Some(line) = text.lines().next() { let p: Vec<&str> = line.split(',').map(str::trim).collect(); if p.len() >= 2 { return (p[0].to_string(), "nvidia".into(), (p[1].parse::<f64>().unwrap_or(0.0) / 1024.0 * 10.0).round() / 10.0); } } }
    let script = "(Get-CimInstance Win32_VideoController | Select-Object -First 1 -ExpandProperty Name)";
    let name = no_window(Command::new("powershell").args(["-NoProfile", "-Command", script])).output().ok().map(|o| String::from_utf8_lossy(&o.stdout).trim().to_string()).unwrap_or_default();
    let low = name.to_lowercase();
    let vendor = if low.contains("amd") || low.contains("radeon") { "amd" } else if low.contains("intel") { "intel" } else { "" };
    (name, vendor.to_string(), 0.0)
}

/// What would be installed, where, and whether it can be. Reads one web page; downloads nothing.
#[tauri::command]
pub async fn comfy_install_plan(app: tauri::AppHandle, dest: Option<String>) -> Result<InstallPlan, String> {
    let dest = dest.map(PathBuf::from).unwrap_or_else(|| default_dest(&app));
    let mut plan = InstallPlan { dest: dest.to_string_lossy().into_owned(), ..Default::default() };
    if !cfg!(windows) { plan.reason = "One-click install is for Windows. On a Mac, ComfyUI has an official app at comfy.org/download.".into(); return Ok(plan); }
    if let Some(existing) = registry(&app).into_iter().map(PathBuf::from).find(|p| find_start_script(p).is_some()).or_else(|| find_portable(&dest)) {
        plan.installed = true; plan.path = existing.to_string_lossy().into_owned(); plan.start = find_start_script(&existing).map(|p| p.to_string_lossy().into_owned()).unwrap_or_default();
        plan.reason = "ComfyUI is already installed.".into();
        return Ok(plan);
    }
    let (name, vendor, vram) = tauri::async_runtime::spawn_blocking(gpu).await.map_err(|e| e.to_string())?;
    plan.gpu = name; plan.vendor = vendor.clone(); plan.vram_gb = vram;
    if vendor.is_empty() { plan.reason = "No NVIDIA, AMD or Intel graphics card was found, so ComfyUI would have nothing to run on. Use a cloud model instead.".into(); return Ok(plan); }
    if vram > 0.0 && vram < MIN_VRAM_GB { plan.warnings.push(format!("Your card has {vram:.0} GB of video memory. Pictures work at modest sizes; video needs about 8 GB.")); }
    if vendor == "amd" { plan.warnings.push("AMD cards work with ComfyUI on Windows, but support is newer and some models are slower than on NVIDIA.".into()); }
    if vendor == "intel" { plan.warnings.push("Intel graphics are supported but slow; best for small pictures.".into()); }
    let http = reqwest::Client::builder().timeout(Duration::from_secs(20)).user_agent("ProductionOne").build().map_err(|e| e.to_string())?;
    let rel: Value = match http.get(RELEASE_API).header("Accept", "application/vnd.github+json").send().await {
        Ok(r) => r.json().await.unwrap_or(Value::Null),
        Err(_) => { plan.reason = "Could not reach GitHub to find the latest ComfyUI. Check the internet connection and try again.".into(); return Ok(plan); }
    };
    let Some(asset) = pick_asset(rel["assets"].as_array().map(Vec::as_slice).unwrap_or(&[]), &vendor) else { plan.reason = format!("ComfyUI's latest release has no Windows build for {} cards. Download ComfyUI from comfy.org/download.", vendor.to_uppercase()); return Ok(plan); };
    if asset.sha256.is_none() { plan.reason = "GitHub did not publish a checksum for this ComfyUI build, so it cannot be verified and was not downloaded. Use ComfyUI Desktop from comfy.org instead.".into(); return Ok(plan); }
    plan.tag = rel["tag_name"].as_str().unwrap_or("").to_string();
    plan.download_gb = (asset.size as f64 / 1e9 * 10.0).round() / 10.0;
    plan.need_gb = space_needed_gb(asset.size);
    plan.free_gb = free_gb(&dest);
    plan.asset = Some(asset);
    if plan.free_gb > 0.0 && plan.free_gb < plan.need_gb { plan.reason = format!("Not enough disk space: about {} GB is needed (the download, the unpacked folder and room for models) and {} GB is free. Choose another folder or free some space.", plan.need_gb, plan.free_gb); return Ok(plan); }
    if dest.exists() && fs::read_dir(&dest).map(|mut d| d.next().is_some()).unwrap_or(false) { plan.reason = "That folder already has other files in it. Choose an empty folder.".into(); return Ok(plan); }
    plan.ok = true;
    Ok(plan)
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Progress { pub stage: String, pub progress: f64, pub detail: String }

fn emit(app: &tauri::AppHandle, stage: &str, progress: f64, detail: &str) { let _ = app.emit("local-progress", Progress { stage: stage.into(), progress, detail: detail.into() }); }

/// Downloads to `final_path`, resuming a partial `.part` file. The caller says which addresses are allowed.
async fn download(app: &tauri::AppHandle, url: &str, final_path: &Path, expected: u64, stage: &str, base_progress: f64, span: f64) -> Result<(), String> {
    if final_path.exists() && expected > 0 && fs::metadata(final_path).map(|m| m.len()).unwrap_or(0) == expected { return Ok(()); }
    if let Some(parent) = final_path.parent() { fs::create_dir_all(parent).map_err(|e| e.to_string())?; }
    let part = PathBuf::from(format!("{}.part", final_path.to_string_lossy()));
    let have = fs::metadata(&part).map(|m| m.len()).unwrap_or(0);
    let http = reqwest::Client::builder().timeout(Duration::from_secs(60 * 60 * 6)).user_agent("ProductionOne").build().map_err(|e| e.to_string())?;
    let mut req = http.get(url);
    if have > 0 { req = req.header("Range", format!("bytes={have}-")); }
    let mut resp = req.send().await.map_err(|e| format!("The download could not start: {}", e.without_url()))?;
    let resumed = resp.status().as_u16() == 206;
    if !resp.status().is_success() { return Err(format!("The download failed ({})", resp.status().as_u16())); }
    let total = if expected > 0 { expected } else { resp.content_length().map(|l| l + if resumed { have } else { 0 }).unwrap_or(0) };
    let mut file = fs::OpenOptions::new().create(true).write(true).append(resumed).truncate(!resumed).open(&part).map_err(|e| e.to_string())?;
    let mut done = if resumed { have } else { 0 };
    let mut last = -1.0f64;
    while let Some(chunk) = resp.chunk().await.map_err(|e| format!("The download was interrupted ({}). Press the button again to resume.", e.without_url()))? {
        file.write_all(&chunk).map_err(|e| e.to_string())?;
        done += chunk.len() as u64;
        let frac = if total > 0 { done as f64 / total as f64 } else { 0.0 };
        if (frac - last).abs() >= 0.005 { last = frac; emit(app, stage, base_progress + span * frac, &format!("{:.1} of {:.1} GB", done as f64 / 1e9, total as f64 / 1e9)); }
    }
    drop(file);
    if total > 0 && done != total { return Err("The download ended early. Press the button again to resume.".into()); }
    fs::rename(&part, final_path).map_err(|e| e.to_string())
}

fn sha256_of(path: &Path) -> Result<String, String> {
    let mut f = fs::File::open(path).map_err(|e| e.to_string())?;
    let mut h = Sha256::new();
    std::io::copy(&mut f, &mut h).map_err(|e| e.to_string())?;
    Ok(format!("{:x}", h.finalize()))
}

/// Downloads, checks and unpacks ComfyUI. Returns the start script. Progress arrives as "local-progress" events.
#[tauri::command]
pub async fn comfy_install(app: tauri::AppHandle, dest: Option<String>) -> Result<String, String> {
    let plan = comfy_install_plan(app.clone(), dest).await?;
    if plan.installed { return Ok(plan.start); }
    if !plan.ok { return Err(plan.reason); }
    let asset = plan.asset.clone().ok_or("No download was found")?;
    let dest = PathBuf::from(&plan.dest);
    let cache = dest.join("_download");
    let archive = cache.join(&asset.name);
    emit(&app, "Downloading ComfyUI", 0.0, "");
    download(&app, &asset.url, &archive, asset.size, "Downloading ComfyUI", 0.0, 0.6).await?;
    emit(&app, "Checking the download", 0.62, "");
    let want = asset.sha256.clone().ok_or("No checksum")?;
    let a2 = archive.clone();
    let got = tauri::async_runtime::spawn_blocking(move || sha256_of(&a2)).await.map_err(|e| e.to_string())??;
    if got != want { let _ = fs::remove_file(&archive); return Err("The downloaded file did not match the checksum GitHub published, so it was deleted. Try again.".into()); }
    emit(&app, "Unpacking", 0.7, "This takes a few minutes");
    let (a3, d3) = (archive.clone(), dest.clone());
    let status = tauri::async_runtime::spawn_blocking(move || no_window(Command::new("tar").arg("-xf").arg(&a3).arg("-C").arg(&d3)).status()).await.map_err(|e| e.to_string())?.map_err(|e| format!("Could not unpack: {e}"))?;
    if !status.success() { return Err("Windows could not unpack the ComfyUI archive. Free some disk space and try again.".into()); }
    let root = find_portable(&dest).ok_or("ComfyUI unpacked, but its folder was not where expected")?;
    let start = find_start_script(&root).ok_or("ComfyUI unpacked, but it has no start script")?;
    let _ = fs::remove_file(&archive);
    let _ = fs::remove_dir(&cache);
    remember(&app, &root.to_string_lossy());
    emit(&app, "Done", 1.0, "");
    Ok(start.to_string_lossy().into_owned())
}

/// Starts a ComfyUI that this app installed. Returns immediately: press Find local AI again in a moment.
#[tauri::command]
pub fn comfy_start(app: tauri::AppHandle, path: String) -> Result<(), String> {
    let known: Vec<PathBuf> = registry(&app).into_iter().filter_map(|r| find_start_script(Path::new(&r))).collect();
    let target = PathBuf::from(&path);
    if !known.iter().any(|k| k == &target) { return Err("That is not a ComfyUI this app installed.".into()); }
    let dir = target.parent().ok_or("Bad path")?.to_path_buf();
    no_window(Command::new("cmd").args(["/c", "start", "", &path]).current_dir(dir)).spawn().map_err(|e| e.to_string())?;
    Ok(())
}

pub struct ModelFile { pub folder: &'static str, pub name: &'static str, pub url: &'static str, pub gb: f64 }

/// Fixed download addresses: only these are ever fetched. FLUX is not here because its model page needs you to accept a licence first.
pub fn model_files(template: &str) -> Vec<ModelFile> {
    match template {
        "sdxl-keyframes" => vec![ModelFile { folder: "checkpoints", name: "sd_xl_base_1.0.safetensors", url: "https://huggingface.co/stabilityai/stable-diffusion-xl-base-1.0/resolve/main/sd_xl_base_1.0.safetensors", gb: 6.94 }],
        "wan22-5b-video" => vec![
            ModelFile { folder: "diffusion_models", name: "wan2.2_ti2v_5B_fp16.safetensors", url: "https://huggingface.co/Comfy-Org/Wan_2.2_ComfyUI_Repackaged/resolve/main/split_files/diffusion_models/wan2.2_ti2v_5B_fp16.safetensors", gb: 10.0 },
            ModelFile { folder: "text_encoders", name: "umt5_xxl_fp8_e4m3fn_scaled.safetensors", url: "https://huggingface.co/Comfy-Org/Wan_2.1_ComfyUI_repackaged/resolve/main/split_files/text_encoders/umt5_xxl_fp8_e4m3fn_scaled.safetensors", gb: 6.74 },
            ModelFile { folder: "vae", name: "wan2.2_vae.safetensors", url: "https://huggingface.co/Comfy-Org/Wan_2.2_ComfyUI_Repackaged/resolve/main/split_files/vae/wan2.2_vae.safetensors", gb: 1.41 },
        ],
        _ => vec![],
    }
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ModelPlan { pub name: String, pub folder: String, pub gb: f64, pub present: bool }

async fn models_dir(app: &tauri::AppHandle, base: &str) -> Result<PathBuf, String> {
    // A running ComfyUI knows where its models live (this also covers ComfyUI Desktop); otherwise use the copy this app installed.
    if let Ok(b) = super::local::normalize_base(base) {
        if let Ok(r) = reqwest::Client::builder().timeout(Duration::from_secs(5)).no_proxy().build().map_err(|e| e.to_string())?.get(format!("{b}/internal/folder_paths")).send().await {
            let v: Value = r.json().await.unwrap_or(Value::Null);
            if let Some(first) = v["checkpoints"][0][0].as_str().or_else(|| v["diffusion_models"][0][0].as_str()) { if let Some(parent) = Path::new(first).parent() { return Ok(parent.to_path_buf()); } }
        }
    }
    registry(app).into_iter().map(|r| PathBuf::from(r).join("ComfyUI").join("models")).find(|p| p.is_dir()).ok_or_else(|| "Could not find ComfyUI's models folder. Start ComfyUI first.".to_string())
}

#[tauri::command]
pub async fn comfy_model_plan(app: tauri::AppHandle, base: String, template: String) -> Result<Vec<ModelPlan>, String> {
    let dir = models_dir(&app, &base).await?;
    Ok(model_files(&template).into_iter().map(|f| ModelPlan { name: f.name.into(), folder: f.folder.into(), gb: f.gb, present: dir.join(f.folder).join(f.name).exists() }).collect())
}

/// Fetches the model files a ready-made workflow needs, from the fixed addresses above, into ComfyUI's models folders. Resumable.
#[tauri::command]
pub async fn comfy_download_models(app: tauri::AppHandle, base: String, template: String) -> Result<Vec<String>, String> {
    let files = model_files(&template);
    if files.is_empty() { return Err("This workflow has no automatic download. Get its model files from the model page and put them in ComfyUI's models folders.".into()); }
    let dir = models_dir(&app, &base).await?;
    let total: f64 = files.iter().map(|f| f.gb).sum();
    let mut got = Vec::new();
    let mut done_gb = 0.0;
    for f in &files {
        let target = dir.join(f.folder).join(f.name);
        let stage = format!("Downloading {}", f.name);
        download(&app, f.url, &target, 0, &stage, done_gb / total, f.gb / total).await?;
        done_gb += f.gb;
        got.push(target.to_string_lossy().into_owned());
    }
    emit(&app, "Done", 1.0, "");
    Ok(got)
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn only_picks_the_right_file_from_comfyuis_own_repository_with_a_checksum() {
        let assets = vec![
            json!({"name": "ComfyUI_windows_portable_amd.7z", "size": 1, "browser_download_url": "https://github.com/Comfy-Org/ComfyUI/releases/download/v1/ComfyUI_windows_portable_amd.7z"}),
            json!({"name": "ComfyUI_windows_portable_nvidia.7z", "size": 2_000_000_000u64, "browser_download_url": "https://github.com/Comfy-Org/ComfyUI/releases/download/v1/ComfyUI_windows_portable_nvidia.7z", "digest": "sha256:ABCDEF"}),
        ];
        let a = pick_asset(&assets, "nvidia").unwrap();
        assert_eq!((a.size, a.sha256.as_deref()), (2_000_000_000, Some("abcdef")));
        assert!(pick_asset(&assets, "amd").unwrap().sha256.is_none());
        assert!(pick_asset(&assets, "tpu").is_none());
        let evil = vec![json!({"name": "ComfyUI_windows_portable_nvidia.7z", "size": 1, "browser_download_url": "https://evil.example.com/ComfyUI_windows_portable_nvidia.7z"})];
        assert!(pick_asset(&evil, "nvidia").is_none());
        let lookalike = vec![json!({"name": "ComfyUI_windows_portable_nvidia.7z", "size": 1, "browser_download_url": "https://github.com/Comfy-Org/ComfyUI/releases/download.evil.com/x.7z"})];
        assert!(pick_asset(&lookalike, "nvidia").is_none());
    }

    #[test]
    fn estimates_space_and_finds_the_start_script() {
        assert_eq!(space_needed_gb(2_000_000_000), 12.8);
        let dir = std::env::temp_dir().join(format!("po-comfy-{}", std::process::id()));
        fs::create_dir_all(&dir).unwrap();
        fs::write(dir.join("run_cpu.bat"), "").unwrap();
        assert!(find_start_script(&dir).unwrap().ends_with("run_cpu.bat"));
        fs::write(dir.join("run_nvidia_gpu.bat"), "").unwrap();
        assert!(find_start_script(&dir).unwrap().ends_with("run_nvidia_gpu.bat"));
        let _ = fs::remove_dir_all(dir);
    }

    #[test]
    fn model_downloads_come_only_from_fixed_hugging_face_addresses() {
        for t in ["sdxl-keyframes", "wan22-5b-video"] { for f in model_files(t) { assert!(f.url.starts_with("https://huggingface.co/"), "{}", f.url); assert!(f.name.ends_with(".safetensors")); } }
        assert!(model_files("flux-dev").is_empty());
        assert_eq!(model_files("wan22-5b-video").len(), 3);
    }
}
