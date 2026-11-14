# Changelog

## 0.28.6 (2026-11-14): wardrobe identity fix, shape and backdrop controls
- Fix (wrong person): a Wardrobe sheet's "Costume front" was made from the text alone, so it could show a different person from the character's approved front (seen with CASSIUS). A front-type view now uses the character's approved front from another sheet as its reference, as every other view already did. It still goes without a reference when nothing is approved yet, and never uses another character's or another look's image. Covered by unit tests; the live re-make was not done in the packaged app (see notes).
- New: "Shape" control per sheet (portrait 3:4, tall 9:16, square 1:1, landscape 4:3, wide 16:9). The default still follows the asset: characters portrait, props landscape 4:3, locations wide 16:9. The choice is saved with the project and applies to new images; existing images keep their shape.
- New: "Backdrop" control per sheet: flat grey (default), flat white, or match the reference image. One flat-field rule is written into every prompt on the sheet (no floor, wall, horizon, cast shadow or colour spill), so the views agree with each other instead of each model choosing its own background.
- Turnaround front, side and rear prompts now ask for a dead-on view (square shoulders and hips, even weight, a true 90 degree profile, spine centred from behind).
- Turntable and other motion prompts now ask for a flat uniform grey field, real-time speed and no slow motion.
- Layout: the sheet controls sit in one tidy grid.
- Ideas taken from the Castkit, Shotcaller, Voicesheet and Motiondojo files you supplied were reworded, not copied; see the notes in the conversation for what was and was not adopted.
- Tests: 227 JS, 69 Rust. Checked in the browser preview; not exercised in the packaged app, because your installed app was open and a second copy cannot run beside it.

## 0.28.5 (2026-11-13): sheet export, steadier turntables, voice picker fixes
Fixes for everything the three-character run found and left open.
- New: "Export sheet as one image" on every sheet. Combines the views that have a picture (turnaround, poses, expressions, wardrobe, detail) into one labelled PNG in Documents\Production One\Sheets. Only images in the app's own assets folder are read; at most 24 views per image. Checked in the packaged app: nine sheets exported and looked right.
- Fix: the cloud voice list (ElevenLabs, VoiceKiller) is remembered for the session; switching engine or character no longer empties it and forces "Load my voices" again. Checked in the packaged app.
- Fix: a character added from an image can be given a gender (optional, never guessed), so the voice picker chooses a matching Windows voice instead of defaulting to a male one.
- Fix: the turntable prompt also asks the model to keep the face, expression and costume as in the reference. Re-run: CASSIUS and MARA now turn a full 360 degrees and CASSIUS keeps his stern face to the end; MARA's eyes opened in the clip although they are closed in her image, so expression is only partly held.
- Tests: 219 JS, 69 Rust. Local secrets scan clean. The remote Rafter scan was not run (plan quota used up); the new export command was reviewed by hand (path containment, size limits, filename sanitising).
- Not verified: the gender field was checked for rendering and by unit test, not by completing a real image pick; audio quality unheard.

## 0.28.4 (2026-11-13): live video and voice test on a character added from an image
- Test with your keys: MARA, added from her Midjourney image with "Add from image", made a 5 s 1076x1924 24 fps Kling turntable clip (face, hood, robe and jar held), a Windows (Zira) line and an ElevenLabs eleven_v4 "Joy - Soft Spoken" line. Not heard by me; the clip turned only about 180 degrees.
- Fix: the turntable prompt now asks for one complete 360-degree rotation that ends facing the camera. Not re-run (it would spend a second video), so unverified.
- Fix: the ElevenLabs and VoiceKiller panels no longer say "Not yet run against the live service"; speech for both was checked live. Voice design, sound effects and VoiceKiller cloning are still untested.

## 0.28.3 (2026-11-13): no lost work, start from your own images, retries
Found by running the packaged app with three Midjourney characters (full turnaround, 8 poses and 8 expressions each).
- Fix (data loss): New and Open replaced the single autosave slot, so an unsaved production could be lost with no warning. When the open production has work that is not safely in a saved file, the app now copies it to Documents\Production One\Backups first (newest 30 kept; only files the app wrote are ever pruned) and names the copy in the message. If the copy cannot be made, nothing is replaced.
- New: "Add from image" in the Production Bible. Type a name, choose an image (for example from Midjourney); it becomes the approved front view and the turnaround, poses, expressions and the rest are built from it with the identity lock on. No script needed.
- Fix: a Golden Path for a project started from images no longer says "Add your script"; Create and Analyze count as done.
- Fix: Kie sometimes refuses a model it served minutes earlier ("no model page"). It is now retried automatically after a pause, within the normal three-attempt limit, instead of failing until you press Retry.
- Fix: the queue bar and the Bible dot kept counting "failed" for a view that a later retry had already produced. Superseded failures stay in the record and the request count but are no longer reported as failed.
- Change: when a reference image is attached, prompts ask for a background matching it (your white Midjourney backdrops) instead of always light grey.
- Tests: 213 JS, 67 Rust. Rafter: local secrets scan clean; the remote scan could not run (plan quota used for this period), so the diff was reviewed by hand against the CWE list (path traversal, deletion, JSON parsing).
- Not verified: the Kie retry cannot be triggered on demand, so it is covered by unit tests only.

## 0.28.2 (2026-11-13): VoiceKiller verified live; voice list fixed
- Live test with your keys (one short line each): ElevenLabs eleven_v4 produced a valid 3 s MP3; VoiceKiller (voice "Bella") produced a valid 4 s 128 kbps MP3; Google Gemini 3.1 Flash Lite Image produced a five-view AMINA turnaround with the identity lock holding.
- Fix: VoiceKiller's voice list is one name per line, not JSON, so the picker said "not in a shape this app knows". It now reads that shape and still refuses markup, braces, colons or long lines. Tests extended.
- Not tested live: OpenAI, Kie, motion video, VoiceKiller cloning.

## 0.28.1 (2026-11-13): fixes from running the packaged app
- Run for real (WebView2 debugging port): Fraunces and Plus Jakarta Sans load; free Windows voice audition produced a real 3.6 s, 22 kHz mono WAV with Microsoft David and Zira listed; no provider keys were saved so no paid generation was run.
- Fixes: "Local AI" no longer wraps onto two lines, the first-run card no longer has a gap under its title, Asset Lab titles use the display font, Production Bible group headings are left-aligned, the "optional" tag on Direct hides below 1500px so the next-step button is not cut off.

## 0.28.0 (2026-11-13): App.tsx split into views; empty project no longer "ready"
- App.tsx is now about 1,300 lines (from 1,860): the Projects, Story, Design and Direct workspaces live in src/views/ with typed props. Deliver is still inline.
- New App-level tests walk every workspace and the Alt+number shortcuts, guarding the split.
- Fix: a brand-new empty project showed Deliver as complete (and "Deliver complete" in the header) because the audit was vacuously ready with zero assets. Deliver now needs at least one asset.
- Checked on screen in a browser preview: illustrated empty states (cast, reading) and the Project settings dialog.
- Tests: 197 JS, 65 Rust.

## 0.27.0 (2026-11-13): icons on every screen, illustrated empty states, first views split out
- Icons on the Story, Direct, Deliver and Animatic panel labels, and on the Settings, Providers, Help and Unsaved dialogs.
- Illustrated empty states (cast, reading, reference sheets) with a soft colour glow and drifting sparkles; still under reduced-motion. Image slots waiting for a picture now show a tinted wash (gold waiting, blue in progress, red failed).
- App.tsx: Projects and Story workspaces moved to src/views/ProjectsView.tsx and StoryView.tsx (App.tsx 1,860 to about 1,790 lines; Design and Direct still inline).
- Tests: 194 JS, 65 Rust.

## 0.26.0 (2026-11-13): new type pairing, icons everywhere
- Fonts: Fraunces (cinematic serif) for titles, Plus Jakarta Sans for everything else; both bundled, work offline. Replaces Geist.
- Icons: every workspace tab, every Golden Path step (icon medallions), Production Bible groups and assets (coloured avatar with a status badge), New/Open/Save.
- Projects screen: five icon stat tiles (Scenes, Characters, Props, Sets, Approved) replace the sentence of numbers.
- Layout fixes for the wider serif: bible names no longer wrap mid-word; style name no longer clipped.
- Tests: 191 JS, 65 Rust. Checked in a browser preview at 1024px.

## 0.25.0 (2026-11-13): progress ring, step acknowledgement, shortcuts
- Golden Path progress ring around the logo (with a text equivalent for screen readers).
- A quiet "<Step> complete" chip appears when a step becomes done (not on load); still under reduced-motion, without animation.
- Alt+1..5 switches workspace; hint on the Projects screen.
- App.tsx: constants and download helpers moved to src/appHelpers.ts (App.tsx is still about 1,860 lines; the larger split is not done).
- Tests: 191 JS, 65 Rust.

## 0.24.0 (2026-11-13): searchable voice lists
- New SearchSelect (WAI-ARIA combobox: type to filter, arrow keys, Home/End, Enter, Escape, live match count) used for the Windows voice list and the ElevenLabs/VoiceKiller voice list. Multi-word search matches in any order.
- Tests: 188 JS, 65 Rust. The component is covered by unit tests only; not yet seen in the packaged app, no screen-reader pass.
- Not done: replacing the remaining short native dropdowns; splitting App.tsx.

## 0.23.0 (2026-11-13): voice groups, script reading actions
- Voice audition is now four numbered groups: Engine and voice, Line, Direction, Result.
- Script reading: "Add as prop" for a prop the reading missed (never duplicates an asset), and "Use as <name>'s age" on an age the reading found; the age is saved as the character's confirmed age and flows into image prompts.
- Tests: 183 JS, 65 Rust.
- Not done: searchable replacements for long native dropdowns; splitting App.tsx.

## 0.22.0 (2026-11-13): first-run guide, saved notes, light theme
- First-run guide on Projects (keys, script, Golden Path); dismiss once, remembered.
- Sheet notes are now saved with the project (they used to vanish on close).
- Light theme, opt-in: command palette (Ctrl+K) > "Switch between dark and light theme". Dark stays the default. Best effort: the main screens were checked in a preview, the Direct, Deliver and dialog screens were not.
- Tests: 180 JS, 65 Rust.

## 0.21.0 (2026-11-13): polish, regenerate and cost
- New `src/polish.css` layer: one easing curve, screen entrance, sliding tab indicator, breathing Golden Path step, tactile buttons, key chips, slow background light. All motion switches off under reduced-motion.
- Header: tabs wrap to their own row at 1180px and below, so nothing clips at 1024px.
- Reference sheets: "Generate" now counts only views that need an image. New "Regenerate N unapproved" and "Regenerate N selected" (tick Select on a view). Approved views are never regenerated unless ticked. When nothing is added the message says what to do next.
- Cost: every paid button shows its count and cost at the person's own price per request (never an invented price; "cost unknown" until one is set in the spending limit).
- Several image warnings collapse into one "N quality notes" toggle.
- Design screen: sticky in-page navigation (Identity, Reference sheets, Motion, Voice and sound).
- Tests: 180 JS. Checked in a browser preview and as a packaged build; no screen-reader pass, no light theme yet.

## 0.20.0 (2026-11-12): type and layout refresh
- New typeface: Geist (bundled, works offline) with Inter and Segoe UI Variable as fallbacks; roomier line height, tighter headings, balanced wrapping.
- Accessibility: no text under 12px (legacy 8-11px labels raised; monospace boxes 13px); low-contrast greys in the older style sheets lifted; a script audit of the Projects, Story, Design, Direct and Deliver screens found no text below 4.5:1 (approximate, computed from CSS colours, not a full WCAG audit); stronger focus ring; readable disabled buttons; reduced-motion and high-contrast settings honoured.
- Layout: voice and sound panels are now spaced cards with aligned fields; clip lists use a responsive grid; field labels no longer shout in capitals.
- Not done: narrow-window layout (the app still needs about 1100px width), full screen-reader pass, light theme.
- Tests: 177 JS, 65 Rust.

## 0.19.1 (2026-11-12): ElevenLabs v4 that keeps itself current; keys in Settings
- ElevenLabs now defaults to "Latest": the newest speech model your own account lists (GET /v1/models), falling back to eleven_v4. A newer generation (v5...) is picked up and its audio-tag support recognised without an app update. You can still pin a model.
- ElevenLabs and VoiceKiller keys (and VoiceKiller user ID) are now saved in the same Settings dialog as every other provider key, not inside the Voice audition. The audition shows key status and a button that opens Settings.
- Not run against the live services. Tests: 177 JS, 65 Rust.

## 0.19.0 (2026-11-12): ElevenLabs and VoiceKiller
- ElevenLabs (cloud): speak lines (Eleven v3 reads inline tags such as [whispers], [laughs], [sighs]), load your voices, design a new voice from a written description then keep it, and make separate sound effects (grunts, laughs, engines) for characters and props.
- VoiceKiller (cloud): speak lines; emotion and physical state go in its instructions field; voice list read leniently because its reply shape is not published.
- Keys are entered by you in the Connect section and stored in the Windows Credential Manager; never shown again.
- Direction is honest per engine: tags only where documented, otherwise listed as not applied.
- NOT run against either live service. Calls follow the published API pages. Every action spends your credits.
- Tests: 173 JS, 64 Rust.

## 0.18.0 (2026-11-12): reference-anchored generation made visible
- Anchoring already existed for models that accept reference images; it was invisible and off with the default text-only model. Now the Identity lock panel opens by default, says whether the character is locked, waiting for an approved front view, or unprotected, and offers one-click "Switch to <model>" (a reference-capable model on a provider you have a key for).
- Views that travel with the approved front view as a reference now tell the model it is the exact same subject (face, hair, skin, build, costume) and to change only the pose, angle or expression.
- Not live-tested yet: that a reference model actually keeps the face across views.
- Tests: 171 JS, 59 Rust.

## 0.17.2 (2026-11-12): fixes from the end-to-end test
- Every sheet prompt now demands exactly one image of one subject in one view (no grids, contact sheets or collages). Models can still ignore it; no automatic detection of collages yet.
- Sheet notes are kept per asset, so one asset's notes no longer appear in another's prompts.
- Cropped-figure check compares each edge with its own tone, so studio gradients and floor shadows are no longer flagged as a cropped head or feet.
- Not fixed: truck/prop and identity details not extracted from action lines, stale sample shot text in Deliver, no cost estimate on Generate, no cross-view consistency for text-only models.
- Tests: 164 JS, 59 Rust.

## 0.17.1 (2026-11-12): WazobiaVoice engine
- New voice engine WazobiaVoice (Yoruba, Hausa, Igbo, Pidgin, Nigerian English) with language picker, expressiveness slider and optional reference-clip path.
- `tools/wazobia_server.py`: local-only (127.0.0.1) /v1/audio/speech server around the model card API. Syntax-checked only; never run (gated weights, no GPU here). Weights are non-commercial research licence.
- `speak_http` passes only language, exaggeration and cfg_weight onward. Tests: 164 JS, 58 Rust.

## 0.17.0 (2026-11-12): voice engines and performance direction
- Voice audition can now use a speech server on this computer or your network (`POST /v1/audio/speech`): presets for Chatterbox and Qwen TTS, plus any other server. New `speak_http` command; address must be local or private network; returned bytes are checked to be real audio.
- Performance direction per line: physical state, emotion and laugh/grunt/cough cues. The app applies only what the engine supports (inline tags, pauses) and lists everything else as not applied; the casting brief carries it.
- NOT verified against a live server. Suno via Kie, VoiceKiller and Wazobia are not integrated (no documented API available).
- Tests: 164 JS, 57 Rust.

## 0.16.0 (2026-11-12): motion and voice auditions
- Motion audition presets by asset type (characters, vehicles, props); voice audition with installed Windows voices; sound briefs for props.
- Confirmed identity fields now reach every image sheet prompt and motion prompt.
- Pinned dependencies, added CI. Tests: 159 JS, 56 Rust.

## 0.15.0 (2026-11-12): Character Bible progress, accessible tabs, explainable parsing
- Character Bible sections derive state from the generation queue (newest revision per view); Motion and Voice are gated with plain next steps.
- Character Bible tabs are an ARIA tablist with arrow/Home/End navigation and a tabpanel.
- New `explainStory` engine and "How this was read" panel with per-finding confidence and source-line links.
- Tests: 150 (was 141). No data-format changes.

## 0.14.0 (2026-10-22): professional UI, CleanRender, branding
- **Design system.** Restrained radii (panels 8, cards 6, controls 5-6), deeper gold (#C49A46, hover #D6AD59, pressed #A77E31), one type family (Inter), primary buttons flat gold with dark text.
- **Character Sheet Studio.** Status header (approved, to review, in queue), toolbar, large previews (grid or large), side-by-side compare, and an inspector with reference thumbnails, notes, identity lock and model, in collapsible sections. Narrow panels move the actions first and settings below the artwork.
- **Director's room.** Larger cinematic cards with spec grid and one primary action; secondary actions in an overflow menu; grid, list and large layouts; arrow-key navigation; drag to reorder; a resizable inspector with Camera, Composition, Blocking, Cast and wardrobe, Lighting, Performance and Audio sections (checkboxes and segmented controls instead of chips).
- **Delivery Center.** Readiness percentage, counts, next recommended action; missing items grouped by scene with human names and buttons that open the sheet or shot; retry for failed jobs; shot compiler with shot and model pickers, capability checks, editable prompt, copy; verified, draft and direct exports with prerequisites.
- **CleanRender.** Layer A: style-aware prompt guidance (natural skin for realistic styles, neutral white balance unless the style is warm, nothing photographic on stylised projects). Layer B: measurements for colour cast, clipped highlights, noise, edge overshoot, bloom and skin smoothness, with honest messages and remedies. Layer C: non-destructive correction (temperature, tint, colour strength, highlight recovery, bloom reduction, noise reduction with texture protection, sharpness) with live split before/after, undo, reset, save as a new revision, and apply to all.
- **Branding.** New application icon and project-file icon built into multi-resolution `.ico` files; installer, shortcuts, taskbar and in-app mark use them; `.pone` and `.pguy` are registered by the installer; double-clicking a project opens it in the running window.
- **Script import.** Final Draft, Fountain cleanup, Word and PDF through the native picker.

## 0.13.1 (2026-10-21)
Local AI: Ollama, LM Studio and ComfyUI detection; one-click ComfyUI install; local image and video workflows; AI beat pass.

Earlier releases are described in [docs/PRODUCTION_ONE_PLAN.md](docs/PRODUCTION_ONE_PLAN.md).
# Unreleased

- Preserved cumulative submission attempts and spending history across manual retries and model reassignment.
- Added explicit draft/verified package export modes, missing-reference reporting, and non-overwriting atomic delivery writes.
# 0.14.10

## UI/UX: calm studio pass

- Reduced shell, panel, rail, and action density so the selected asset and next action lead.
- Added responsive workspace collapse rules for narrower windows.
- Made Character Bible sections horizontally scrollable instead of wrapping into a busy control wall.
- Tightened Design workspace columns, spacing, shadows, and sheet-card density.

# 0.14.9

- Added Character Bible navigation linking identity, turnaround, poses, expressions, wardrobe, details, motion, and voice.
- Character Bible tabs drive the separate sheet generator while sharing the approved identity anchor.

# 0.14.8

- Added broad aspect-ratio selection for storyboard and video workflows, including 21:9 and 2.39:1 cinema formats.
- Expanded character pose sheets with neutral A-pose, profile, crouch, walk, run, sit, and gesture views.

# 0.14.7

- Added provider-aware video model catalog for Kie.ai, Gemini, and fal.ai.
- Added task capability metadata for turnaround, acting, pose, expression, vehicles, props, cloth, dialogue, and extensions.
- Added explicit export-only and direct-generation status messaging.

# 0.14.6

- Replaced the oversized native style dropdown with a searchable, grouped visual-style browser.
- Added category filtering and style descriptions for faster selection.

# 0.14.5

- Added a 100-style visual library with independent animation approaches and world treatments.
- Added style-bible controls for movement language and world coherence.

# 0.14.4

- Expanded the project style library with animation, anime-inspired, stop-motion, graphic, futuristic, fantasy, architectural, and editorial families.
- Made the project-wide style bible explicitly flow into assets, motion, storyboards, and delivery.

# 0.14.3

- Added Asset Lab Golden Path for identity, motion, interaction, sound, and continuity.
- Added asset-specific motion studies for characters, costumes, props, sets, and environments.
- Added editable motion, interaction, sound, and character identity direction.

# 0.14.2

- Added Story workspace script templates for screenplay, Fountain, narrated prose/PDF, and shot-list workflows.
- Improved guidance for structured extraction of characters, scenes, sets, and props.

# 0.14.1

- Replaced the startup splash artwork with a production-design studio composition that avoids prominent generated hands and faces.
- Preserved the previous splash as `public/splash-v1.jpg`.

