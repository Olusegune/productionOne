//! CleanRender: measures common AI-image artifacts and applies gentle, adjustable corrections without touching the original file.
//!
//! What it does well: colour casts, clipped highlights, noise, haze around bright areas, over- or under-sharpening.
//! What it cannot do: fix identity, anatomy or plastic-looking skin. Those are reported with the right remedy (regenerate, reference-condition, retouch) instead of being filtered.
//! All maths runs on sRGB values scaled 0..1; each step is simple and its strength is a single slider, so results are predictable.

use std::{fs, path::{Path, PathBuf}};

use base64::{engine::general_purpose::STANDARD as ENGINE, Engine};
use image::{imageops::FilterType, DynamicImage, RgbImage};
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase", default)]
pub struct CleanParams {
    /// -100 cooler .. +100 warmer
    pub temperature: f32,
    /// -100 greener .. +100 more magenta
    pub tint: f32,
    /// -100 .. +100
    pub saturation: f32,
    /// 0..100 edge-preserving noise reduction
    pub denoise: f32,
    /// 0..100 pull bright areas back from clipping
    pub highlights: f32,
    /// 0..100 reduce haze spilling out of bright areas
    pub bloom: f32,
    /// -100 softer .. +100 sharper
    pub sharpen: f32,
    /// 0..100 how much natural texture is protected from smoothing
    pub texture: f32,
    /// 0..100 master strength applied to every control above
    pub intensity: f32,
}

impl Default for CleanParams {
    fn default() -> Self { CleanParams { temperature: 0.0, tint: 0.0, saturation: 0.0, denoise: 0.0, highlights: 0.0, bloom: 0.0, sharpen: 0.0, texture: 50.0, intensity: 100.0 } }
}

impl CleanParams {
    fn is_neutral(&self) -> bool { self.temperature == 0.0 && self.tint == 0.0 && self.saturation == 0.0 && self.denoise == 0.0 && self.highlights == 0.0 && self.bloom == 0.0 && self.sharpen == 0.0 }
    fn scaled(&self) -> CleanParams { let k = (self.intensity / 100.0).clamp(0.0, 1.0); CleanParams { temperature: self.temperature * k, tint: self.tint * k, saturation: self.saturation * k, denoise: self.denoise * k, highlights: self.highlights * k, bloom: self.bloom * k, sharpen: self.sharpen * k, texture: self.texture, intensity: 100.0 } }
}

struct Plane { w: usize, h: usize, d: Vec<f32> }

fn to_plane(img: &RgbImage) -> Plane { Plane { w: img.width() as usize, h: img.height() as usize, d: img.as_raw().iter().map(|&v| v as f32 / 255.0).collect() } }
fn from_plane(p: &Plane) -> RgbImage { RgbImage::from_raw(p.w as u32, p.h as u32, p.d.iter().map(|&v| (v.clamp(0.0, 1.0) * 255.0 + 0.5) as u8).collect()).unwrap() }
fn luma3(r: f32, g: f32, b: f32) -> f32 { 0.2126 * r + 0.7152 * g + 0.0722 * b }
fn smoothstep(a: f32, b: f32, x: f32) -> f32 { let t = ((x - a) / (b - a)).clamp(0.0, 1.0); t * t * (3.0 - 2.0 * t) }

/// Separable box blur of `ch` interleaved channels with edge clamping.
fn box_blur(src: &[f32], w: usize, h: usize, ch: usize, radius: usize) -> Vec<f32> {
    if radius == 0 { return src.to_vec(); }
    let n = (2 * radius + 1) as f32;
    let mut tmp = vec![0.0f32; src.len()];
    for y in 0..h {
        for c in 0..ch {
            let at = |x: isize| src[(y * w + x.clamp(0, w as isize - 1) as usize) * ch + c];
            let mut acc: f32 = (-(radius as isize)..=radius as isize).map(at).sum();
            for x in 0..w {
                tmp[(y * w + x) * ch + c] = acc / n;
                acc += at(x as isize + radius as isize + 1) - at(x as isize - radius as isize);
            }
        }
    }
    let mut out = vec![0.0f32; src.len()];
    for x in 0..w {
        for c in 0..ch {
            let at = |y: isize| tmp[(y.clamp(0, h as isize - 1) as usize * w + x) * ch + c];
            let mut acc: f32 = (-(radius as isize)..=radius as isize).map(at).sum();
            for y in 0..h {
                out[(y * w + x) * ch + c] = acc / n;
                acc += at(y as isize + radius as isize + 1) - at(y as isize - radius as isize);
            }
        }
    }
    out
}

/// Applies the corrections. The result is always a new image; the input is never modified.
pub fn apply(img: &RgbImage, params: &CleanParams) -> RgbImage {
    if params.is_neutral() { return img.clone(); }
    let p = params.scaled();
    let mut plane = to_plane(img);
    let (w, h) = (plane.w, plane.h);
    let longest = w.max(h) as f32;

    // 1. Colour: temperature and tint as gentle channel gains, then saturation.
    if p.temperature != 0.0 || p.tint != 0.0 || p.saturation != 0.0 {
        let t = p.temperature / 100.0;
        let g = p.tint / 100.0;
        let s = 1.0 + p.saturation / 100.0;
        for px in plane.d.chunks_exact_mut(3) {
            let (mut r, mut gr, mut b) = (px[0] * (1.0 + 0.18 * t), px[1] * (1.0 - 0.10 * g), px[2] * (1.0 - 0.18 * t));
            r *= 1.0 + 0.04 * g; b *= 1.0 + 0.04 * g;
            let y = luma3(r, gr, b);
            r = y + (r - y) * s; gr = y + (gr - y) * s; b = y + (b - y) * s;
            px[0] = r.clamp(0.0, 1.0); px[1] = gr.clamp(0.0, 1.0); px[2] = b.clamp(0.0, 1.0);
        }
    }

    // 2. Highlight recovery: compress only the brightest tones, keeping hue.
    if p.highlights > 0.0 {
        let a = p.highlights / 100.0;
        for px in plane.d.chunks_exact_mut(3) {
            let y = luma3(px[0], px[1], px[2]);
            let k = 1.0 - a * 0.4 * smoothstep(0.78, 1.0, y);
            px[0] *= k; px[1] *= k; px[2] *= k;
        }
    }

    // 3. Bloom: remove the soft glow that bright areas spill onto their surroundings, without dimming the bright source itself.
    if p.bloom > 0.0 {
        let a = p.bloom / 100.0;
        let glow_src: Vec<f32> = plane.d.chunks_exact(3).map(|px| (luma3(px[0], px[1], px[2]) - 0.8).max(0.0)).collect();
        let radius = ((longest / 60.0) as usize).clamp(2, 40);
        let glow = box_blur(&glow_src, w, h, 1, radius);
        for (i, px) in plane.d.chunks_exact_mut(3).enumerate() {
            let y = luma3(px[0], px[1], px[2]);
            let outside = 1.0 - smoothstep(0.88, 0.98, y);
            let cut = a * 0.9 * glow[i] * outside;
            px[0] = (px[0] - cut).max(0.0); px[1] = (px[1] - cut).max(0.0); px[2] = (px[2] - cut).max(0.0);
        }
    }

    // 4. Noise: blend toward a local average only where the difference is small enough to be noise; structure keeps its sharpness.
    if p.denoise > 0.0 {
        let a = (p.denoise / 100.0) * (1.0 - 0.6 * (p.texture / 100.0).clamp(0.0, 1.0));
        let radius = if longest > 1800.0 { 2 } else { 1 };
        let blurred = box_blur(&plane.d, w, h, 3, radius);
        let sigma = 0.02 + 0.06 * (p.denoise / 100.0);
        for (px, bl) in plane.d.chunks_exact_mut(3).zip(blurred.chunks_exact(3)) {
            let diff = ((px[0] - bl[0]).abs() + (px[1] - bl[1]).abs() + (px[2] - bl[2]).abs()) / 3.0;
            let wgt = (-(diff / sigma).powi(2)).exp();
            for c in 0..3 { px[c] += (bl[c] - px[c]) * a * wgt; }
        }
    }

    // 5. Sharpness: unsharp mask for positive values, a soft blend for negative ones (undoing over-sharpening).
    if p.sharpen != 0.0 {
        let radius = ((longest / 900.0).round() as usize).clamp(1, 3);
        let blurred = box_blur(&plane.d, w, h, 3, radius);
        let amount = p.sharpen / 100.0;
        for (px, bl) in plane.d.chunks_exact_mut(3).zip(blurred.chunks_exact(3)) {
            for c in 0..3 { px[c] = if amount > 0.0 { px[c] + (px[c] - bl[c]) * amount * 1.2 } else { px[c] + (bl[c] - px[c]) * -amount * 0.8 }; }
        }
    }
    from_plane(&plane)
}

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct Suggestion {
    pub id: String,
    /// "info", "suggest" or "warn"
    pub severity: String,
    pub message: String,
    /// What to do when a filter is not the right tool.
    pub remedy: String,
    pub params: Option<CleanParams>,
}

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct CleanReport {
    pub width: u32,
    pub height: u32,
    pub warm_cast: f32,
    pub clipped_highlights: f32,
    pub clipped_shadows: f32,
    pub noise: f32,
    pub edge_overshoot: f32,
    pub bloom: f32,
    pub skin_fraction: f32,
    pub skin_detail: f32,
    pub suggestions: Vec<Suggestion>,
}

fn is_skin(r: f32, g: f32, b: f32) -> bool {
    // YCbCr skin range; deliberately narrow so only clear skin tones count.
    let y = 0.299 * r + 0.587 * g + 0.114 * b;
    let cb = 0.5 + (-0.168736 * r - 0.331264 * g + 0.5 * b);
    let cr = 0.5 + (0.5 * r - 0.418688 * g - 0.081312 * b);
    y > 0.25 && y < 0.9 && cb > 0.30 && cb < 0.50 && cr > 0.52 && cr < 0.68
}

/// Measures the image. Every number is a heuristic and the messages say so; none of them is a verdict on quality.
pub fn analyze(img: &RgbImage) -> CleanReport {
    let plane = to_plane(img);
    let (w, h) = (plane.w, plane.h);
    let n = (w * h) as f32;
    let lum: Vec<f32> = plane.d.chunks_exact(3).map(|p| luma3(p[0], p[1], p[2])).collect();

    // Colour cast: mean red-minus-blue of the mid-tones. Neutral scenes sit near zero; golden or orange casts are clearly positive.
    let (mut cast, mut mid) = (0.0f32, 0u32);
    let (mut hi, mut lo) = (0u32, 0u32);
    for (i, p) in plane.d.chunks_exact(3).enumerate() {
        let y = lum[i];
        if y > 0.25 && y < 0.8 { cast += p[0] - p[2]; mid += 1; }
        if y >= 0.985 { hi += 1; }
        if y <= 0.02 { lo += 1; }
    }
    let warm = if mid > 0 { cast / mid as f32 } else { 0.0 };
    let clipped_hi = hi as f32 / n;
    let clipped_lo = lo as f32 / n;

    // Noise: median absolute deviation of the difference from a 3x3 average, which is dominated by noise in flat areas.
    let blur1 = box_blur(&lum, w, h, 1, 1);
    let mut resid: Vec<f32> = lum.iter().zip(&blur1).map(|(a, b)| (a - b).abs()).collect();
    let step = (resid.len() / 20000).max(1);
    let mut sample: Vec<f32> = resid.iter().step_by(step).copied().collect();
    sample.sort_by(|a, b| a.partial_cmp(b).unwrap());
    let mad = sample.get(sample.len() / 2).copied().unwrap_or(0.0);
    let noise = mad / 0.6745 * 1.5 * 255.0;
    resid.clear();

    // Edge overshoot: how far pixels next to strong edges swing past both neighbours (the signature of aggressive sharpening).
    let (mut strong, mut over) = (0u32, 0u32);
    for y in 2..h.saturating_sub(2) {
        for x in 2..w.saturating_sub(2) {
            let c = lum[y * w + x];
            let l = lum[y * w + x - 2]; let r = lum[y * w + x + 2];
            if (l - r).abs() > 0.25 {
                strong += 1;
                let (lo_v, hi_v) = (l.min(r), l.max(r));
                if c < lo_v - 0.03 || c > hi_v + 0.03 { over += 1; }
            }
        }
    }
    let overshoot = if strong > 50 { over as f32 / strong as f32 } else { 0.0 };

    // Bloom: how much of the area next to very bright regions is itself lifted. Measured on a reduced copy.
    let cell = (w.max(h) / 160).max(1);
    let (cw, ch) = (w / cell, h / cell);
    let mut bloom_score = 0.0f32;
    if cw > 8 && ch > 8 {
        let mut small = vec![0.0f32; cw * ch];
        for cy in 0..ch { for cx in 0..cw { let mut s = 0.0; for dy in 0..cell { for dx in 0..cell { s += lum[(cy * cell + dy) * w + cx * cell + dx]; } } small[cy * cw + cx] = s / (cell * cell) as f32; } }
        let (mut bright, mut ring_lift) = (0u32, 0.0f32);
        let mut ring_n = 0u32;
        for cy in 2..ch - 2 { for cx in 2..cw - 2 {
            if small[cy * cw + cx] < 0.92 { continue; }
            bright += 1;
            for (dx, dy) in [(-2i32, 0i32), (2, 0), (0, -2), (0, 2)] {
                let v = small[((cy as i32 + dy) as usize) * cw + (cx as i32 + dx) as usize];
                if v < 0.92 { ring_n += 1; ring_lift += v; }
            }
        } }
        if bright >= 3 && ring_n > 0 { bloom_score = ring_lift / ring_n as f32; }
    }

    // Skin smoothness: texture energy inside clearly skin-coloured pixels. Very low energy over a large area can mean plastic skin.
    let (mut skin_n, mut skin_e) = (0u32, 0.0f32);
    let blur2 = box_blur(&lum, w, h, 1, 2);
    for (i, p) in plane.d.chunks_exact(3).enumerate() {
        if is_skin(p[0], p[1], p[2]) { skin_n += 1; skin_e += (lum[i] - blur2[i]).abs(); }
    }
    let skin_fraction = skin_n as f32 / n;
    let skin_detail = if skin_n > 0 { skin_e / skin_n as f32 * 255.0 } else { 0.0 };

    let mut suggestions = Vec::new();
    if warm > 0.22 {
        let amount = -((warm - 0.12) * 220.0).clamp(10.0, 40.0);
        suggestions.push(Suggestion { id: "warm-cast".into(), severity: "suggest".into(), message: format!("The mid-tones lean strongly yellow or orange ({:.0}% more red than blue). If this is the golden light you wanted, leave it. If everything looks tinted, cool it.", warm * 100.0), remedy: "Cooling shifts the whole image. If only the skin is yellow, regenerate with neutral lighting in the prompt.".into(), params: Some(CleanParams { temperature: amount, ..CleanParams::default() }) });
    }
    if clipped_hi > 0.02 {
        suggestions.push(Suggestion { id: "clipped-highlights".into(), severity: "suggest".into(), message: format!("{:.1}% of the image is pure white. Detail in those areas cannot be recovered, only toned down.", clipped_hi * 100.0), remedy: "If a face or costume is blown out, regenerate with softer lighting.".into(), params: Some(CleanParams { highlights: (clipped_hi * 1500.0).clamp(30.0, 70.0), ..CleanParams::default() }) });
    }
    if noise > 7.0 {
        suggestions.push(Suggestion { id: "noise".into(), severity: "suggest".into(), message: format!("Visible grain or noise (about {:.0} levels). Gentle smoothing keeps edges and natural texture.", noise), remedy: "Heavy grain from a low-quality generation is better regenerated than smoothed.".into(), params: Some(CleanParams { denoise: (noise * 5.0).clamp(25.0, 65.0), texture: 70.0, ..CleanParams::default() }) });
    }
    if overshoot > 0.18 {
        suggestions.push(Suggestion { id: "over-sharpened".into(), severity: "suggest".into(), message: "Edges show bright and dark outlines that look like over-sharpening.".into(), remedy: "Softening reduces the outlines but cannot restore lost detail.".into(), params: Some(CleanParams { sharpen: -30.0, ..CleanParams::default() }) });
    }
    if bloom_score > 0.66 {
        suggestions.push(Suggestion { id: "bloom".into(), severity: "suggest".into(), message: "A soft glow spreads from the brightest areas into their surroundings. Reducing it brings back contrast near lights and windows.".into(), remedy: "If the glow is part of the look, keep it.".into(), params: Some(CleanParams { bloom: 50.0, ..CleanParams::default() }) });
    }
    if skin_fraction > 0.03 && skin_detail < 1.1 {
        suggestions.push(Suggestion { id: "waxy-skin".into(), severity: "warn".into(), message: "The skin is extremely smooth, which can look waxy or plastic. A filter cannot add believable pores and texture.".into(), remedy: "Regenerate with natural skin texture in the prompt, use a reference photo, or retouch by hand. Stylised characters are fine as they are.".into(), params: None });
    }
    if suggestions.is_empty() {
        suggestions.push(Suggestion { id: "clean".into(), severity: "info".into(), message: "No common artifact stood out in these measurements. This does not check faces, hands or likeness.".into(), remedy: String::new(), params: None });
    }
    CleanReport { width: w as u32, height: h as u32, warm_cast: warm, clipped_highlights: clipped_hi, clipped_shadows: clipped_lo, noise, edge_overshoot: overshoot, bloom: bloom_score, skin_fraction, skin_detail, suggestions }
}

fn load(path: &Path, max_edge: Option<u32>) -> Result<RgbImage, String> {
    let img = image::open(path).map_err(|e| format!("Could not open the image: {e}"))?;
    let img = match max_edge { Some(m) if img.width().max(img.height()) > m => img.resize(m, m, FilterType::Triangle), _ => img };
    Ok(img.to_rgb8())
}

/// Next free `<name>_clean_NN.png` beside the original.
fn revision_path(original: &Path) -> PathBuf {
    let stem = original.file_stem().map(|s| s.to_string_lossy().into_owned()).unwrap_or_else(|| "image".into());
    let base = stem.split("_clean_").next().unwrap_or(&stem).to_string();
    let dir = original.parent().map(Path::to_path_buf).unwrap_or_default();
    (1..1000).map(|n| dir.join(format!("{base}_clean_{n:02}.png"))).find(|p| !p.exists()).unwrap_or_else(|| dir.join(format!("{base}_clean_999.png")))
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Saved { pub path: String, pub width: u32, pub height: u32 }

#[tauri::command]
pub async fn clean_analyze(app: tauri::AppHandle, path: String) -> Result<CleanReport, String> {
    let file = crate::providers::inside_assets(&app, &path)?;
    tauri::async_runtime::spawn_blocking(move || { let img = load(&file, Some(2048))?; if img.width() < 32 || img.height() < 32 { return Err("The image is too small to check".to_string()); } Ok(analyze(&img)) }).await.map_err(|e| e.to_string())?
}

/// A reduced-size JPEG of the image with the corrections applied (or the untouched original), for the live before/after view. Same code as the saved result.
#[tauri::command]
pub async fn clean_preview(app: tauri::AppHandle, path: String, params: CleanParams, max_edge: u32, original: bool) -> Result<String, String> {
    let file = crate::providers::inside_assets(&app, &path)?;
    tauri::async_runtime::spawn_blocking(move || {
        let img = load(&file, Some(max_edge.clamp(256, 1600)))?;
        let out = if original { img } else { apply(&img, &params) };
        let mut buf = Vec::new();
        image::codecs::jpeg::JpegEncoder::new_with_quality(&mut buf, 88).encode_image(&DynamicImage::ImageRgb8(out)).map_err(|e| e.to_string())?;
        Ok(format!("data:image/jpeg;base64,{}", ENGINE.encode(buf)))
    }).await.map_err(|e| e.to_string())?
}

/// Saves a corrected copy as a new PNG next to the original. The original is never changed.
#[tauri::command]
pub async fn clean_save(app: tauri::AppHandle, path: String, params: CleanParams) -> Result<Saved, String> {
    let file = crate::providers::inside_assets(&app, &path)?;
    tauri::async_runtime::spawn_blocking(move || {
        if params.is_neutral() { return Err("Nothing to apply: every control is at zero.".to_string()); }
        let img = load(&file, None)?;
        let out = apply(&img, &params);
        let dest = revision_path(&file);
        out.save(&dest).map_err(|e| e.to_string())?;
        Ok(Saved { path: dest.to_string_lossy().into_owned(), width: out.width(), height: out.height() })
    }).await.map_err(|e| e.to_string())?
}


#[cfg(test)]
mod tests {
    use super::*;
    use image::Rgb;

    fn grey(w: u32, h: u32, v: u8) -> RgbImage { RgbImage::from_pixel(w, h, Rgb([v, v, v])) }
    fn noisy(w: u32, h: u32, amp: i32) -> RgbImage {
        let mut seed = 12345u32;
        RgbImage::from_fn(w, h, |_, _| { seed = seed.wrapping_mul(1664525).wrapping_add(1013904223); let n = ((seed >> 16) % (2 * amp as u32 + 1)) as i32 - amp; let v = (128 + n).clamp(0, 255) as u8; Rgb([v, v, v]) })
    }
    fn noise_of(img: &RgbImage) -> f32 { analyze(img).noise }

    #[test]
    fn neutral_params_return_the_same_pixels() {
        let img = noisy(40, 40, 20);
        assert_eq!(apply(&img, &CleanParams::default()), img);
    }

    #[test]
    fn cooling_moves_red_down_and_blue_up_and_intensity_scales_it() {
        let img = RgbImage::from_pixel(20, 20, Rgb([200, 160, 100]));
        let full = apply(&img, &CleanParams { temperature: -50.0, ..Default::default() }).get_pixel(5, 5).0;
        let half = apply(&img, &CleanParams { temperature: -50.0, intensity: 50.0, ..Default::default() }).get_pixel(5, 5).0;
        assert!(full[0] < 200 && full[2] > 100);
        assert!(half[0] < 200 && half[0] > full[0]);
    }

    #[test]
    fn denoise_lowers_measured_noise_but_leaves_a_hard_edge_alone() {
        let img = noisy(96, 96, 18);
        let out = apply(&img, &CleanParams { denoise: 80.0, texture: 0.0, ..Default::default() });
        assert!(noise_of(&out) < noise_of(&img) * 0.8, "{} vs {}", noise_of(&out), noise_of(&img));
        let mut edge = grey(64, 64, 30);
        for y in 0..64 { for x in 32..64 { edge.put_pixel(x, y, Rgb([220, 220, 220])); } }
        let smoothed = apply(&edge, &CleanParams { denoise: 100.0, texture: 0.0, ..Default::default() });
        assert!(smoothed.get_pixel(30, 30)[0] < 40 && smoothed.get_pixel(34, 30)[0] > 210, "edge preserved");
    }

    #[test]
    fn texture_protection_keeps_more_detail() {
        let img = noisy(80, 80, 12);
        let flat = apply(&img, &CleanParams { denoise: 80.0, texture: 0.0, ..Default::default() });
        let kept = apply(&img, &CleanParams { denoise: 80.0, texture: 100.0, ..Default::default() });
        assert!(noise_of(&kept) > noise_of(&flat));
    }

    #[test]
    fn highlight_recovery_darkens_whites_and_leaves_shadows() {
        let mut img = grey(30, 30, 40);
        for x in 15..30 { for y in 0..30 { img.put_pixel(x, y, Rgb([255, 255, 255])); } }
        let out = apply(&img, &CleanParams { highlights: 100.0, ..Default::default() });
        assert!(out.get_pixel(25, 5)[0] < 240);
        assert_eq!(out.get_pixel(3, 5)[0], 40);
    }

    #[test]
    fn bloom_reduction_darkens_the_glow_but_not_the_light_source() {
        let mut img = grey(120, 120, 120);
        for y in 50..70 { for x in 50..70 { img.put_pixel(x, y, Rgb([255, 255, 255])); } }
        let out = apply(&img, &CleanParams { bloom: 100.0, ..Default::default() });
        assert!(out.get_pixel(71, 60)[0] < 118, "glow next to the source is reduced");
        assert!(out.get_pixel(60, 60)[0] > 240, "the source stays bright");
    }

    #[test]
    fn sharpen_and_soften_move_opposite_ways_at_an_edge() {
        let mut edge = grey(64, 64, 80);
        for y in 0..64 { for x in 32..64 { edge.put_pixel(x, y, Rgb([170, 170, 170])); } }
        let sharp = apply(&edge, &CleanParams { sharpen: 100.0, ..Default::default() });
        let soft = apply(&edge, &CleanParams { sharpen: -100.0, ..Default::default() });
        assert!(sharp.get_pixel(31, 30)[0] < 80 && sharp.get_pixel(32, 30)[0] > 170);
        assert!(soft.get_pixel(32, 30)[0] < 170 && soft.get_pixel(31, 30)[0] > 80);
    }

    #[test]
    fn analysis_flags_a_golden_cast_clipping_and_noise_but_not_a_clean_neutral_image() {
        let warm = RgbImage::from_pixel(64, 64, Rgb([210, 160, 90]));
        assert!(analyze(&warm).suggestions.iter().any(|s| s.id == "warm-cast" && s.params.as_ref().unwrap().temperature < 0.0));
        let mut blown = grey(64, 64, 90);
        for y in 0..20 { for x in 0..64 { blown.put_pixel(x, y, Rgb([255, 255, 255])); } }
        assert!(analyze(&blown).suggestions.iter().any(|s| s.id == "clipped-highlights"));
        assert!(analyze(&noisy(96, 96, 30)).suggestions.iter().any(|s| s.id == "noise"));
        let clean = analyze(&grey(64, 64, 120));
        assert_eq!(clean.suggestions.len(), 1);
        assert_eq!(clean.suggestions[0].id, "clean");
    }

    #[test]
    fn very_smooth_skin_is_reported_with_a_regenerate_remedy_and_no_filter() {
        let skin = RgbImage::from_pixel(80, 80, Rgb([205, 150, 125]));
        let report = analyze(&skin);
        let s = report.suggestions.iter().find(|s| s.id == "waxy-skin").expect("waxy skin flagged");
        assert!(s.params.is_none() && s.remedy.to_lowercase().contains("regenerate"));
    }

    #[test]
    fn a_sharpened_image_measures_more_edge_overshoot_than_the_original() {
        let mut edge = grey(96, 96, 70);
        for y in 0..96 { for x in 48..96 { edge.put_pixel(x, y, Rgb([200, 200, 200])); } }
        let soft = apply(&edge, &CleanParams { sharpen: -50.0, ..Default::default() });
        let hard = apply(&soft, &CleanParams { sharpen: 100.0, ..Default::default() });
        assert!(analyze(&hard).edge_overshoot >= analyze(&soft).edge_overshoot);
    }

    #[test]
    fn revisions_are_new_numbered_files_and_the_original_is_untouched() {
        let dir = std::env::temp_dir().join(format!("po-clean-{}", std::process::id()));
        fs::create_dir_all(&dir).unwrap();
        let original = dir.join("SAVANNA_front_v01.png");
        let img = RgbImage::from_pixel(32, 32, Rgb([210, 160, 90]));
        img.save(&original).unwrap();
        let before = fs::read(&original).unwrap();
        let first = revision_path(&original);
        assert!(first.to_string_lossy().ends_with("SAVANNA_front_v01_clean_01.png"));
        apply(&img, &CleanParams { temperature: -30.0, ..Default::default() }).save(&first).unwrap();
        let second = revision_path(&first);
        assert!(second.to_string_lossy().ends_with("SAVANNA_front_v01_clean_02.png"), "{}", second.display());
        assert_eq!(fs::read(&original).unwrap(), before);
        let _ = fs::remove_dir_all(dir);
    }
}
