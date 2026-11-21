//! Looking for a newer release. It asks GitHub's public releases page for the latest version number and tells the page whether it is newer than the running app.
//! Nothing about the project, the person or the computer is sent (only a generic client name), nothing is downloaded or installed, and the page can only open
//! this project's own releases page.

use serde::{Deserialize, Serialize};
use std::time::Duration;

const LATEST_URL: &str = "https://api.github.com/repos/Olusegune/productionOne/releases/latest";
const RELEASES_PREFIX: &str = "https://github.com/Olusegune/productionOne/releases";

#[derive(Serialize, Clone, Debug, PartialEq)]
pub struct UpdateInfo {
    pub current: String,
    pub latest: String,
    pub newer: bool,
    pub url: String,
    pub notes: String,
}

#[derive(Deserialize)]
struct Release {
    tag_name: String,
    html_url: Option<String>,
    body: Option<String>,
}

/// "v1.2.3" or "1.2.3" (anything after a dash or plus is ignored) as three numbers.
pub fn parse_version(text: &str) -> Option<(u64, u64, u64)> {
    let core = text.trim().trim_start_matches(['v', 'V']).split(['-', '+']).next()?;
    let mut parts = core.split('.');
    let major = parts.next()?.parse().ok()?;
    let minor = parts.next()?.parse().ok()?;
    let patch = parts.next().unwrap_or("0").parse().ok()?;
    if parts.next().is_some() { return None; }
    Some((major, minor, patch))
}

pub fn is_newer(current: &str, latest: &str) -> bool {
    match (parse_version(current), parse_version(latest)) {
        (Some(c), Some(l)) => l > c,
        _ => false,
    }
}

/// Only this project's own releases pages may be opened from the page: the releases list or one release tag.
pub fn allowed_release_url(url: &str) -> bool {
    if url == RELEASES_PREFIX || url == format!("{RELEASES_PREFIX}/") { return true; }
    match url.strip_prefix(&format!("{RELEASES_PREFIX}/tag/")) {
        Some(tag) => !tag.is_empty() && tag.len() <= 32 && tag.chars().all(|c| c.is_ascii_alphanumeric() || matches!(c, '.' | '-' | '_')),
        None => false,
    }
}

#[tauri::command]
pub async fn check_for_update(app: tauri::AppHandle) -> Result<UpdateInfo, String> {
    let current = app.package_info().version.to_string();
    let client = reqwest::Client::builder().timeout(Duration::from_secs(8)).user_agent("ProductionOne-update-check").build().map_err(|e| e.to_string())?;
    let response = client.get(LATEST_URL).header("Accept", "application/vnd.github+json").send().await.map_err(|_| "Could not reach the releases page. Check your internet connection and try again.".to_string())?;
    if !response.status().is_success() { return Err(format!("The releases page answered with an error ({}). Try again later.", response.status().as_u16())); }
    let release: Release = response.json().await.map_err(|_| "The releases page answered in a way this version does not understand.".to_string())?;
    let latest = release.tag_name.trim_start_matches(['v', 'V']).to_string();
    let url = release.html_url.filter(|u| allowed_release_url(u)).unwrap_or_else(|| RELEASES_PREFIX.to_string());
    let notes: String = release.body.unwrap_or_default().chars().take(600).collect();
    Ok(UpdateInfo { newer: is_newer(&current, &latest), current, latest, url, notes })
}

/// Opens one of this project's releases pages in the default browser.
#[tauri::command]
pub fn open_release_page(url: String) -> Result<(), String> {
    if !allowed_release_url(&url) { return Err("That address is not one this app opens.".into()); }
    #[cfg(target_os = "windows")]
    let result = std::process::Command::new("explorer.exe").arg(&url).spawn();
    #[cfg(target_os = "macos")]
    let result = std::process::Command::new("open").arg(&url).spawn();
    #[cfg(all(unix, not(target_os = "macos")))]
    let result = std::process::Command::new("xdg-open").arg(&url).spawn();
    result.map(|_| ()).map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reads_versions_with_or_without_a_v_and_ignores_suffixes() {
        assert_eq!(parse_version("v0.61.0"), Some((0, 61, 0)));
        assert_eq!(parse_version("1.2"), Some((1, 2, 0)));
        assert_eq!(parse_version("2.0.1-beta.3"), Some((2, 0, 1)));
        assert_eq!(parse_version("not a version"), None);
        assert_eq!(parse_version("1.2.3.4"), None);
    }

    #[test]
    fn only_a_higher_version_counts_as_an_update() {
        assert!(is_newer("0.61.0", "v0.62.0"));
        assert!(is_newer("0.9.9", "0.10.0"));
        assert!(!is_newer("0.61.0", "0.61.0"));
        assert!(!is_newer("0.62.0", "0.61.9"));
        assert!(!is_newer("0.61.0", "garbage"));
    }

    #[test]
    fn only_this_projects_releases_pages_may_be_opened() {
        assert!(allowed_release_url("https://github.com/Olusegune/productionOne/releases"));
        assert!(allowed_release_url("https://github.com/Olusegune/productionOne/releases/tag/v0.62.0"));
        assert!(!allowed_release_url("https://github.com/Olusegune/productionOne/releases/tag/"));
        assert!(!allowed_release_url("https://github.com/Olusegune/productionOne/releases/tag/v1 & calc"));
        assert!(!allowed_release_url("https://github.com/Olusegune/productionOne/issues"));
        assert!(!allowed_release_url("https://evil.example/Olusegune/productionOne/releases"));
        assert!(!allowed_release_url("file:///C:/Windows/System32/calc.exe"));
        assert!(!allowed_release_url("javascript:alert(1)"));
    }
}
