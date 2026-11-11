# Production One user guide

Follow the **Golden Path** across the top: Create, Analyze, Design, Generate, Review, Deliver (Direct is optional). The gold button at the top right always names the next useful step. **Ctrl+K** opens the command palette for any action.

## Projects and files
- **New / Open / Save** are in the File menu and on Projects. Projects are `.pone` files. Old `.pguy` projects open and are saved as a new `.pone`, leaving the original untouched.
- Double-click a `.pone` or `.pguy` in Explorer to open it. If Production One is already running the project opens in that window.
- The title bar shows *Unsaved changes* or *Autosaved*; closing with unsaved changes asks first.

## Story
Paste text or **Import script** (txt, md, Fountain, Final Draft, Word, PDF). Word and PDF come from the desktop app; scanned PDFs need OCR first. **Analyze script** lists scenes, characters, props, story variants and feelings. Every finding shows the line it came from. **Deepen with local AI** (optional) asks a local model for beats and keeps only those whose quoted evidence is in the script.

## Design: reference sheets
1. Pick an asset in the bible (left).
2. Choose **Look** (story variant), **Sheet** (turnaround, expressions, poses, wardrobe, detail) and **Model**.
3. **Generate N views**, or **Test one first**.
4. Approve what you like. The approved front view is sent as the reference for the other views (**Identity lock**).
5. **Large previews** and **Compare** (pick two views) help judge consistency. Click an image to open it full size (wheel zoom, drag, arrows, A approve, R reject).
6. **Use my image** on any view, or **Add photos** of the actor, costume or location (also by dragging files onto the window). Your own images are stored exactly as they came.

### Image quality (CleanRender)
Open **Image quality** in the sheet header. It measures the image and suggests fixes in plain language, for example "the mid-tones lean strongly yellow". **Try this** sets sliders; the split view shows original and corrected live. **Save corrected revision** writes a new file and a new revision; the original is never changed. **Apply to all** uses the same settings on every image of the sheet.
It cannot fix faces, hands, likeness or plastic-looking skin. For those it says to regenerate, use a reference photo, or retouch. If a warm or grainy look is on purpose, leave it.

## Direct (optional)
Turn on the Director's room, then **Plan all scenes**. Select a shot to edit it in the sections on the right (drag the edge to resize). Cards: **Generate frame** is the main action; the **…** menu has your own image, move, duplicate and delete. Arrow keys move between shots; drag a card to reorder inside its scene. Grid, list and large layouts are in the toolbar. Continuity notes appear under the cards. The animatic plays the frames with dialogue and a temp track. Export the shot list as CSV or Markdown.

## Deliver
The top row shows readiness, what is missing, active and failed jobs and the next action. *What still needs work* lists items by scene with buttons that take you to them. The *Shot compiler* builds the prompt for Seedance, Kling or Veo from the shot's data; you can edit it and copy it. *Export verified package* is available only when every sheet and frame is approved; *draft package* is always available and is marked as a draft.

## Providers and local AI
**Providers** stores a key per provider in the Windows credential store. **Local AI** shows Ollama, LM Studio and ComfyUI, what your GPU can run, and can install ComfyUI and download SDXL and Wan 2.2 5B (large downloads, resumable). Local models appear in the same model picker.

## Cost
Cloud models bill at the provider. The small counter in the queue dock counts requests; switch on a cap there with your own price per request if you want one.

## Troubleshooting
| Symptom | Fix |
|---|---|
| "401" or "invalid key" | The provider rejected the key: re-enter it in Providers (check for extra characters or capitals). |
| A view stays *Queued* | It waits for the approved front view, or the queue is paused, or a spending cap is on. |
| Nothing generates in the browser preview | Generation runs in the Windows app. |
| Word/PDF import says no text | The PDF is a scan; run OCR first or paste the text. |
| ComfyUI "not running" | Open Local AI and press Start. |

### Script templates
The Story workspace includes a **Script template** chooser. Use **Screenplay** for the strongest automatic extraction of scenes, characters, sets and props; use **Fountain** for plain-text screenplay files; use **Narrated treatment / PDF prose** for scripts written as prose, sermons or bracketed acts such as *Bishop Bling Bling*; and use **Shot list / visual plan** for director coverage. The template is a starting point only: imported source text is preserved, and nothing is replaced until you choose **Use as starting point**.
