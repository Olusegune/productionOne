//! One labelled image per sheet: the views of a turnaround, pose or expression sheet laid out in a grid, ready to hand to a client or drop into a deck.
use image::{imageops::FilterType, ImageBuffer, Rgba};
use serde::Deserialize;
use std::fs;
use tauri::Manager;

#[derive(Deserialize)]
pub struct SheetCell { pub path: String, pub label: String }

const CELL_W: u32 = 360;
const CAPTION_H: u32 = 34;
const TITLE_H: u32 = 64;
const GAP: u32 = 10;
const MAX_CELLS: usize = 40;
const BACKGROUND: Rgba<u8> = Rgba([17, 20, 24, 255]);

/// Height of the picture area for a cell, from the first image's shape: portrait stays tall, landscape stays short, nothing extreme.
pub fn picture_height(width: u32, height: u32) -> u32 {
    if width == 0 { return CELL_W; }
    ((height as u64 * CELL_W as u64 / width as u64) as u32).clamp(220, 560)
}

/// A caption in the app's 8-pixel font at the biggest scale (2, else 1) that fits the cell; a caption too long even at scale 1 is cut with "...".
pub fn caption_fit(text: &str) -> (String, u32) {
    let upper = text.to_uppercase();
    // Each character advances 9 pixels at scale 1 (8 for the glyph, 1 of spacing), as the label drawing does.
    let max_chars = |scale: u32| ((CELL_W - 8) / (9 * scale)) as usize;
    let n = upper.chars().count();
    if n <= max_chars(2) { return (upper, 2); }
    if n <= max_chars(1) { return (upper, 1); }
    let cut: String = upper.chars().take(max_chars(1).saturating_sub(3)).collect();
    (format!("{}...", cut.trim_end()), 1)
}

/// (columns, rows, total width, total height) for `count` cells.
pub fn grid(count: usize, columns: u32, picture_h: u32) -> (u32, u32, u32, u32) {
    let cols = columns.clamp(1, 6).min(count.max(1) as u32);
    let rows = (count as u32).div_ceil(cols).max(1);
    let cell_h = picture_h + CAPTION_H;
    (cols, rows, GAP + cols * (CELL_W + GAP), TITLE_H + GAP + rows * (cell_h + GAP))
}

#[tauri::command]
pub fn export_contact_sheet(app: tauri::AppHandle, title: String, cells: Vec<SheetCell>, columns: u32) -> Result<String, String> {
    if cells.is_empty() { return Err("There are no images on this sheet yet.".into()); }
    if cells.len() > MAX_CELLS { return Err(format!("An image holds up to {MAX_CELLS} views.")); }
    // Only images this app saved are read, so a path from the page cannot pull in any other file.
    let mut images = Vec::new();
    for cell in &cells {
        let path = crate::providers::inside_assets(&app, &cell.path)?;
        images.push(image::open(&path).map_err(|e| format!("Could not read {}: {e}", cell.label))?);
    }
    let picture_h = picture_height(images[0].width(), images[0].height());
    let (cols, _rows, width, height) = grid(images.len(), columns, picture_h);
    let mut sheet = ImageBuffer::from_pixel(width, height, BACKGROUND);
    crate::draw_label_text(&mut sheet, &title.to_uppercase(), GAP + 6, 20, 3);
    for (index, (cell, img)) in cells.iter().zip(&images).enumerate() {
        let col = index as u32 % cols;
        let row = index as u32 / cols;
        let x = GAP + col * (CELL_W + GAP);
        let y = TITLE_H + GAP + row * (picture_h + CAPTION_H + GAP);
        let fitted = img.resize(CELL_W, picture_h, FilterType::Lanczos3).to_rgba8();
        image::imageops::overlay(&mut sheet, &fitted, (x + (CELL_W - fitted.width()) / 2) as i64, (y + (picture_h - fitted.height()) / 2) as i64);
        let (caption, scale) = caption_fit(&cell.label);
        crate::draw_label_text(&mut sheet, &caption, x + 4, y + picture_h + if scale == 2 { 10 } else { 14 }, scale);
    }
    let dir = app.path().document_dir().map_err(|e| e.to_string())?.join("Production One").join("Sheets");
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let name = crate::safe_package_name(&title);
    let name = if name.is_empty() { "sheet".to_string() } else { name.chars().take(60).collect() };
    let secs = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|d| d.as_secs()).unwrap_or(0);
    let out = dir.join(format!("{name}-{}.png", crate::utc_stamp(secs)));
    sheet.save(&out).map_err(|e| e.to_string())?;
    Ok(out.to_string_lossy().into_owned())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn portrait_pictures_stay_tall_but_bounded() {
        assert_eq!(picture_height(816, 1456), 560, "a very tall picture is capped");
        assert_eq!(picture_height(1024, 1024), 360);
        assert_eq!(picture_height(2000, 500), 220);
        assert_eq!(picture_height(0, 100), CELL_W);
    }

    #[test]
    fn captions_shrink_to_fit_and_are_cut_only_as_a_last_resort() {
        assert_eq!(caption_fit("Front"), ("FRONT".to_string(), 2));
        assert_eq!(caption_fit("Fabric and construction").1, 1, "23 characters do not fit at scale 2");
        assert_eq!(caption_fit("Fabric and construction").0, "FABRIC AND CONSTRUCTION");
        assert_eq!(caption_fit("Poses: neutral A-pose").1, 1, "21 characters at scale 2 would run into the next cell");
        for text in ["Poses: neutral A-pose", "Wardrobe: costume side", "Turnaround: three-quarter front", "Front", "Establishing: reverse view"] {
            let (shown, scale) = caption_fit(text);
            assert!(shown.chars().count() as u32 * 9 * scale <= CELL_W - 8, "{shown} must fit its cell");
        }
        let long = "Turnaround: three-quarter rear view of the whole figure";
        let (cut, scale) = caption_fit(long);
        assert_eq!(scale, 1);
        assert!(cut.ends_with("...") && cut.chars().count() <= 39, "{cut}");
    }

    #[test]
    fn the_grid_fits_every_view() {
        let (cols, rows, w, h) = grid(8, 4, 360);
        assert_eq!((cols, rows), (4, 2));
        assert_eq!(w, GAP + 4 * (CELL_W + GAP));
        assert_eq!(h, TITLE_H + GAP + 2 * (360 + CAPTION_H + GAP));
        assert_eq!(grid(3, 6, 360).0, 3, "never more columns than views");
        assert_eq!(grid(5, 0, 360).0, 1, "at least one column");
        assert_eq!(grid(5, 99, 360).0, 5usize as u32, "at most six columns, and not more than the views");
        assert_eq!(grid(9, 99, 360).0, 6);
    }
}
