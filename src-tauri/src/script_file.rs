//! Reading scripts from the files writers actually have: plain text, Markdown, Fountain, Final Draft (.fdx, read as text and converted in the UI), Word (.docx) and PDF.
//! Nothing is sent anywhere; the file is read on this computer and its text handed to the story reader.

use std::{fs, io::Read, path::Path};

use serde::Serialize;

const MAX_BYTES: u64 = 25 * 1024 * 1024;

#[derive(Serialize)]
pub struct ScriptFile { pub name: String, pub kind: String, pub text: String }

fn decode_entities(s: &str) -> String {
    s.replace("&lt;", "<").replace("&gt;", ">").replace("&quot;", "\"").replace("&apos;", "'").replace("&#39;", "'").replace("&amp;", "&")
}

/// Paragraph text from a Word document's XML: every <w:p> becomes one line, <w:tab/> a gap and <w:br/> a line break.
pub fn docx_text(xml: &str) -> String {
    let mut lines: Vec<String> = Vec::new();
    for para in xml.split("</w:p>") {
        let Some(start) = para.find("<w:p") else { continue };
        let body = &para[start..];
        let mut line = String::new();
        let mut i = 0;
        let bytes = body.as_bytes();
        while i < bytes.len() {
            if body[i..].starts_with("<w:t>") || body[i..].starts_with("<w:t ") {
                let open_end = body[i..].find('>').map(|n| i + n + 1).unwrap_or(bytes.len());
                let close = body[open_end..].find("</w:t>").map(|n| open_end + n).unwrap_or(bytes.len());
                line.push_str(&decode_entities(&body[open_end..close]));
                i = close;
            } else if body[i..].starts_with("<w:tab/>") { line.push_str("    "); i += 8; }
            else if body[i..].starts_with("<w:br/>") || body[i..].starts_with("<w:br ") { line.push('\n'); i += 1; }
            else { i += 1; }
        }
        lines.push(line);
    }
    lines.join("\n")
}

fn read_docx(path: &Path) -> Result<String, String> {
    let file = fs::File::open(path).map_err(|e| e.to_string())?;
    let mut zip = zip::ZipArchive::new(file).map_err(|_| "That does not look like a Word (.docx) file".to_string())?;
    let mut xml = String::new();
    zip.by_name("word/document.xml").map_err(|_| "That Word file has no document text".to_string())?.take(MAX_BYTES).read_to_string(&mut xml).map_err(|e| e.to_string())?;
    Ok(docx_text(&xml))
}

fn read_pdf(path: &Path) -> Result<String, String> {
    let text = pdf_extract::extract_text(path).map_err(|e| format!("This PDF could not be read ({e}). If it is a scan, run it through OCR first, or paste the text."))?;
    if text.trim().len() < 20 { return Err("This PDF has no readable text (it may be a scan). Run it through OCR first, or paste the text.".into()); }
    Ok(text)
}

/// Reads a script file into text. `.fdx` is returned as its XML so the UI can convert it with the same code that handles pasted XML.
pub fn read_script(path: &Path) -> Result<ScriptFile, String> {
    let meta = fs::metadata(path).map_err(|e| format!("Could not open the file: {e}"))?;
    if !meta.is_file() || meta.len() == 0 { return Err("That is not a readable file".into()); }
    if meta.len() > MAX_BYTES { return Err("That file is larger than 25 MB, which is too large for a script".into()); }
    let ext = path.extension().and_then(|e| e.to_str()).unwrap_or("").to_ascii_lowercase();
    let name = path.file_name().map(|n| n.to_string_lossy().into_owned()).unwrap_or_default();
    let (kind, text) = match ext.as_str() {
        "txt" | "md" | "markdown" | "fountain" | "spmd" | "screenplay" => ("text", fs::read_to_string(path).map_err(|_| "That file is not plain text in UTF-8".to_string())?),
        "fdx" => ("fdx", fs::read_to_string(path).map_err(|_| "That Final Draft file could not be read as text".to_string())?),
        "docx" => ("docx", read_docx(path)?),
        "pdf" => ("pdf", read_pdf(path)?),
        _ => return Err("Production One reads .txt, .md, .fountain, .fdx (Final Draft), .docx (Word) and .pdf scripts".into()),
    };
    Ok(ScriptFile { name, kind: kind.to_string(), text })
}

#[tauri::command]
pub async fn pick_script_file(app: tauri::AppHandle) -> Result<Option<ScriptFile>, String> {
    use tauri_plugin_dialog::DialogExt;
    let picked = app.dialog().file().set_title("Import a script").add_filter("Scripts", &["txt", "md", "fountain", "fdx", "docx", "pdf"]).blocking_pick_file();
    let Some(f) = picked else { return Ok(None) };
    let path = f.into_path().map_err(|e| e.to_string())?;
    tauri::async_runtime::spawn_blocking(move || read_script(&path).map(Some)).await.map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn read_script_path(path: String) -> Result<ScriptFile, String> {
    tauri::async_runtime::spawn_blocking(move || read_script(Path::new(&path))).await.map_err(|e| e.to_string())?
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;

    #[test]
    fn reads_word_paragraphs_tabs_breaks_and_entities() {
        let xml = r#"<w:body><w:p><w:r><w:t>INT. KITCHEN - DAY</w:t></w:r></w:p><w:p><w:r><w:t xml:space="preserve">Tom &amp; Anna </w:t></w:r><w:r><w:t>talk.</w:t></w:r></w:p><w:p><w:r><w:tab/><w:t>ANNA</w:t></w:r></w:p><w:p/><w:p><w:r><w:t>Line one</w:t><w:br/><w:t>line two</w:t></w:r></w:p></w:body>"#;
        let t = docx_text(xml);
        let lines: Vec<&str> = t.lines().collect();
        assert_eq!(lines[0], "INT. KITCHEN - DAY");
        assert_eq!(lines[1], "Tom & Anna talk.");
        assert_eq!(lines[2].trim(), "ANNA");
        assert!(t.contains("Line one\nline two"));
    }

    #[test]
    fn reads_a_docx_file_and_plain_files_and_refuses_other_types() {
        let dir = std::env::temp_dir().join(format!("po-script-{}", std::process::id()));
        fs::create_dir_all(&dir).unwrap();
        let docx = dir.join("film.docx");
        let mut zip = zip::ZipWriter::new(fs::File::create(&docx).unwrap());
        zip.start_file("word/document.xml", zip::write::SimpleFileOptions::default()).unwrap();
        zip.write_all(b"<w:document><w:body><w:p><w:r><w:t>EXT. HARBOR - DAWN</w:t></w:r></w:p></w:body></w:document>").unwrap();
        zip.finish().unwrap();
        let r = read_script(&docx).unwrap();
        assert_eq!((r.kind.as_str(), r.text.as_str()), ("docx", "EXT. HARBOR - DAWN"));
        let fountain = dir.join("a.fountain");
        fs::write(&fountain, "Title: X\n\nINT. A - DAY").unwrap();
        assert_eq!(read_script(&fountain).unwrap().kind, "text");
        let fdx = dir.join("a.fdx");
        fs::write(&fdx, "<FinalDraft/>").unwrap();
        assert_eq!(read_script(&fdx).unwrap().kind, "fdx");
        let exe = dir.join("a.exe");
        fs::write(&exe, "x").unwrap();
        assert!(read_script(&exe).is_err());
        assert!(read_script(&dir.join("missing.txt")).is_err());
        let _ = fs::remove_dir_all(dir);
    }
}
