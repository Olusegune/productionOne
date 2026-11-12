//! Local voice auditions. Uses the Windows speech voices already installed on this computer (System.Speech), so a voice can be heard
//! for free and offline. These are stand-in voices for casting and timing, not final performances.

use std::{fs, process::Command};

use serde::Serialize;
use serde_json::Value;
use tauri::Manager;

use super::safe_package_name;

#[derive(Serialize, Clone, Debug, PartialEq)]
pub struct LocalVoice { pub name: String, pub gender: String, pub age: String, pub culture: String }

const MAX_TEXT: usize = 1200;

/// Rate is clamped to the range System.Speech accepts.
pub fn clamp_rate(rate: i32) -> i32 { rate.clamp(-10, 10) }

pub fn validate_text(text: &str) -> Result<String, String> {
    let t = text.trim();
    if t.is_empty() { return Err("There is no line to speak.".into()); }
    if t.chars().count() > MAX_TEXT { return Err(format!("Keep the line under {MAX_TEXT} characters for an audition.")); }
    Ok(t.to_string())
}

pub fn parse_voices(json: &str) -> Vec<LocalVoice> {
    let value: Value = match serde_json::from_str(json.trim()) { Ok(v) => v, Err(_) => return vec![] };
    let items = match value { Value::Array(a) => a, Value::Object(_) => vec![value], _ => vec![] };
    items.iter().filter_map(|v| {
        let name = v.get("Name")?.as_str()?.to_string();
        let text = |k: &str| v.get(k).map(|x| x.as_str().map(str::to_string).unwrap_or_else(|| x.to_string())).unwrap_or_default();
        Some(LocalVoice { name, gender: text("Gender"), age: text("Age"), culture: text("Culture") })
    }).collect()
}

#[cfg(windows)]
fn powershell(script: &str, envs: &[(&str, String)]) -> Result<String, String> {
    use std::os::windows::process::CommandExt;
    let mut cmd = Command::new("powershell.exe");
    cmd.args(["-NoProfile", "-NonInteractive", "-Command", script]).creation_flags(0x0800_0000);
    for (k, v) in envs { cmd.env(k, v); }
    let out = cmd.output().map_err(|e| format!("Could not start Windows speech: {e}"))?;
    if !out.status.success() { return Err(format!("Windows speech failed: {}", String::from_utf8_lossy(&out.stderr).trim())); }
    Ok(String::from_utf8_lossy(&out.stdout).into_owned())
}

#[cfg(not(windows))]
fn powershell(_: &str, _: &[(&str, String)]) -> Result<String, String> { Err("Local voice auditions run in the Windows app.".into()) }

#[tauri::command]
pub fn local_voices() -> Result<Vec<LocalVoice>, String> {
    let script = "Add-Type -AssemblyName System.Speech; $s=New-Object System.Speech.Synthesis.SpeechSynthesizer; $s.GetInstalledVoices() | Where-Object { $_.Enabled } | ForEach-Object { [pscustomobject]@{ Name=$_.VoiceInfo.Name; Gender=[string]$_.VoiceInfo.Gender; Age=[string]$_.VoiceInfo.Age; Culture=$_.VoiceInfo.Culture.Name } } | ConvertTo-Json -Compress";
    Ok(parse_voices(&powershell(script, &[])?))
}

/// Speaks one line with an installed voice and saves a WAV in the assets folder. Text, voice and path travel in environment variables, never in the script.
#[tauri::command]
pub fn speak_local(app: tauri::AppHandle, text: String, voice: String, rate: i32, output_name: String) -> Result<String, String> {
    let text = validate_text(&text)?;
    let stem = safe_package_name(&output_name);
    if stem.is_empty() { return Err("Output name is required".into()); }
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?.join("assets");
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let mut path = dir.join(format!("{stem}.wav"));
    let mut n = 2;
    while path.exists() { path = dir.join(format!("{stem}_{n}.wav")); n += 1; }
    let script = "Add-Type -AssemblyName System.Speech; $s=New-Object System.Speech.Synthesis.SpeechSynthesizer; if ($env:PO_VOICE) { $s.SelectVoice($env:PO_VOICE) }; $s.Rate=[int]$env:PO_RATE; $s.SetOutputToWaveFile($env:PO_OUT); $s.Speak($env:PO_TEXT); $s.Dispose()";
    powershell(script, &[("PO_VOICE", voice), ("PO_RATE", clamp_rate(rate).to_string()), ("PO_OUT", path.to_string_lossy().into_owned()), ("PO_TEXT", text)])?;
    if !path.exists() { return Err("No audio file was produced.".into()); }
    Ok(path.to_string_lossy().into_owned())
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn rate_is_clamped() { assert_eq!(clamp_rate(99), 10); assert_eq!(clamp_rate(-99), -10); assert_eq!(clamp_rate(2), 2); }
    #[test]
    fn text_is_validated() {
        assert!(validate_text("   ").is_err());
        assert!(validate_text(&"a".repeat(2000)).is_err());
        assert_eq!(validate_text("  Hello  ").unwrap(), "Hello");
    }
    #[test]
    fn voices_parse_from_one_or_many() {
        let many = r#"[{"Name":"Microsoft David Desktop","Gender":"Male","Age":"Adult","Culture":"en-US"},{"Name":"Microsoft Zira Desktop","Gender":"Female","Age":"Adult","Culture":"en-US"}]"#;
        assert_eq!(parse_voices(many).len(), 2);
        let one = r#"{"Name":"Microsoft David Desktop","Gender":"Male","Age":"Adult","Culture":"en-US"}"#;
        assert_eq!(parse_voices(one)[0].name, "Microsoft David Desktop");
        assert!(parse_voices("not json").is_empty());
    }
}
