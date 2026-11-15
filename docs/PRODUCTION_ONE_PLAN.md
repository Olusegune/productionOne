# Production One: audit and plans (v1, 2026-10-21)

Decision of record: **Production One is Production Guy 0.6.0 renamed and grown**, with proven FilmCrafter engine parts ported in phases. History of `Olusegune/productionguy` is kept (remote `legacy-productionguy`). Target repo `Olusegune/productionOne` did not exist on 2026-10-21 (HTTP 404); work is local until the owner creates it.

## A. Current-state audit

| Source | What it is | Reuse |
| --- | --- | --- |
| productionguy 0.6.0 (110 files, ~2.8k lines + 1.8k-line `App.tsx`) | Tauri 2 + React/TS + Rust. Production Graph (`src/domain/productionGraph.ts`), script analysis, prompt compiler, Seedance/Veo presets, KIE adapter, OpenAI image call, native image QA/labels, ZIP exports, keyring credentials, tests (vitest, cargo). | **Base.** |
| FilmCrafter 0.28.0 (665 files, ~1,700 engine tests, ~475 UI tests) | Tauri 2 + React 19 + Python engine. Providers, durable queue, continuity QA, camera, blocking, storyboards, exports, docs screenshots, a11y sweeps. | **Port from** (adapters, queue, QA, cinematography, export validation). |
| PULSEFRAME (working folder `code/pulseframe`) | Music-video app. | Not used. |

Gaps in the base versus the brief (all real, none faked): one project only (app-data file, no Open/Save As/recent), no native menus or file dialogs, no `.pone` association, no SQLite, no Python engine, one monolithic `App.tsx`, only OpenAI/KIE wired (no Gemini, fal.ai, OpenRouter), no model discovery, no splash window, no autosave/crash recovery UI, no undo/redo, no installer branding, unsigned installers.

Risks: renaming the Tauri `identifier` moves the app-data folder and strands existing data; renaming the keyring service strands API keys. Both are **kept as legacy identifiers** on purpose.

## B. Requirement map (summary)

| Brief section | Release | Notes |
| --- | --- | --- |
| 2-3 Rebrand, brand system | R1 | This milestone. |
| 4-7 UI system, workspaces, menus, Golden Path | R1 (menus, projects, persistence), R2 (workspaces filled) | Split `App.tsx` per workspace. |
| 8 Production Graph | R1 | Exists; add stable-ID migration + SQLite store. |
| 9-10, 13, 16-18 Sheets, providers, queue, QA, export | R2 | Port FilmCrafter adapters/queue. |
| 11-12 Cinematography, storyboards | R3 | Port FilmCrafter camera/blocking. |
| 14-15 Prompt Studio, Shot Compiler | R2/R4 | Seedance/Veo presets exist; Kling stays flagged unverified. |
| 19 Stack | R1-R2 | Keep Tauri/React/Rust; add SQLite (`rusqlite`) and a Python sidecar only where the ported QA needs it. |

## C. Architecture

Keep: Tauri 2 shell, React/TS UI, Rust commands. Add: `src/workspaces/{projects,story,design,direct,deliver}`, a project package format `.pone` (a folder-backed project with `project.json` + SQLite), `legacy/pguy.ts` importer. Queue persisted in SQLite, jobs idempotent by key. Secrets only in the OS credential store.

## D. UI/UX

Tokens: Obsidian `#111418`, Graphite `#20262D`, Champagne Gold `#D1B47B`, Soft Ivory `#E9EDF0`, Technical Blue `#5C93B8`. Type scale 14-15 / 16-18 / 18-22 / 28-32 px. Reduced-motion and keyboard focus honoured. Splash: the supplied artwork shown in a frameless window, closed when the UI has mounted (no fake progress).

## E. Golden Path

Create → Analyze → Design → Generate → Review → Deliver (Direct optional). Each step must show done / missing / running / cost / next action. Acceptance list (21 steps in the brief) becomes `docs/GOLDEN_PATH.md` with one automated test per step as each lands; steps not yet automated are listed as **not verified**.

## F. Brand migration

1. Visible name, window title, exe (`ProductionOne.exe`), publisher, installer text, exports, package format id → Production One.
2. Kept internally: bundle identifier `com.productionguy.studio`, keyring service `Production Guy`, localStorage keys, `*.pguy.json` data files.
3. `.pguy` projects keep opening; Save As writes `.pone`; never overwrite silently. File association registered by the installer in R1b once `.pone` open-with is implemented.
4. "Production Guy" survives only as the optional assistant persona name.

## G. Roadmap

R1 Rebrand+Foundation → R2 Visual development → R3 Director's Room → R4 Video pipeline → R5 Hardening, per the brief. R1 exit: renamed app builds, tests pass, legacy data opens, menus + Open/Save As/recent work, splash integrated.

## H. Tests and release

`npx tsc --noEmit`, `npx vitest run`, `cargo test`, `npm run build`, `npm run tauri build`; verify exe metadata (ProductName/FileDescription) and icons; upgrade test with existing app-data. Paid generation and live provider calls only with explicit approval and a spending ceiling.

## Status log

**0.7.0 (2026-10-21), Release 1 in progress.** Done and tested: rename, splash window, icons, native menu bar (File/Edit/View/Project/Tools/Window/Help), native Open/Save As dialogs, `.pone` saving, legacy `.pguy` opening (never overwritten), recent projects, unsaved-changes protection (sheet and window close), project settings (rename), Golden Path card driven by real project data, help sheets, 33 UI tests, 11 Rust tests. **Not yet done:** `.pone` file association in the installer, undo/redo of project edits (Edit menu uses the system text-edit actions only), SQLite store, installer branding images, Playwright e2e, splash cropped to brand-only, all of Releases 2-5.

**0.8.0 (2026-10-21), Release 2 started.** Built: image adapters for OpenAI, Google Gemini, OpenRouter and fal.ai (`src-tauri/src/providers.rs`), model discovery with a dated built-in fallback catalog, a durable image queue (`src/domain/generationQueue.ts`, runner `src/data/useImageQueue.ts`) with pause/resume/cancel/retry/reassign, rate-limit back-off, crash recovery, a spending gate and idempotent revisions; reference sheets as separate per-view images (`src/domain/sheetSpecs.ts`) for turnarounds, expressions (3 intensities), poses, wardrobe, details, props and sets; deterministic image QA (blank image, cropped figure); Design workspace panel `SheetStudio`.
**Live-verified: nothing.** No provider call has been made with a real key; request/response shapes follow provider documentation and are unit-tested only. Model ids in the built-in catalog are not live-tested. Reference images are sent only to Gemini and OpenRouter (OpenAI and fal.ai text-only for now). Kie.ai image generation is not wired (Kie video adapter from 0.6 is unchanged). Prices are never stated: the person enters price per image and a ceiling.
**Not done:** choreography sheets, Environment Bible, CleanRender, model recommendation modes (Best Quality/Balanced/Best Value/Fastest/Manual), scheduled catalog refresh, SQLite queue storage (the queue persists in the autosaved project file), identity/expression-distinctness QA beyond the deterministic checks, `.pone` file association.

**0.9.0 (2026-10-21), new studio and story engine.** Replaced the Production Guy page-per-department layout with a single studio: top bar with the five workspaces, a step bar driven by real data, a persistent next-action button, Ctrl+K command palette, a production bible tree (left), canvas (centre), asset inspector with script evidence and emotional arc (right) and a queue dock. Projects is now a calm launcher. New engine in `src/engine/`: `story.ts` reads screenplay, shot-list, lyrics and prose (scenes, INT/EXT, time, dialogue with parentheticals and V.O., props with condition, ages/wardrobe/injury/state variants, pronoun resolution) with the source line of every finding; `emotion.ts` reads emotion and intensity from words, delivery notes, negation and intensifiers (rules only, with cues and confidence), builds per-character arcs and an expression plan that drives the Expressions sheet. 33 new tests (76 total).
**Borrowed ideas:** FilmCrafter (step bar with hint, one primary action, command palette, queue dock, test-one-before-batch), PULSEFRAME (loose script formats, cast board drift, export guardian, engine-side spend token: not yet ported).
**Not done:** optional AI emotion pass (priced, with evidence), PDF/DOCX import, Environment Bible, choreography sheets, CleanRender, "test one first" flow, castboard drift checks, guardian-level export validation, studio screens for Direct and Deliver (they inherit the new chrome but keep the old panels), Playwright and axe sweeps, live provider verification.

**0.10.0 (2026-10-21), Kie.ai and current models.** Kie.ai is now a full image provider (`src-tauri/src/kie.rs`): each request is built from the OpenAPI block Kie publishes on the model page (field names, aspect values, reference-image field, required settings), reference images are uploaded to Kie's file service, the task is created and polled, and the result is downloaded. The model list is read live from Kie's published index with no key (59 image models and 47 video models on 2026-10-21, including Nano Banana 2.1 and Pro, GPT Image 2 and 2.5, Seedream 5.0, FLUX 3 Klein, Grok Imagine 2.0, Wan 2.7, Qwen3, Ideogram Character), refreshed once a day and on demand. Google Gemini image models now use the interactions endpoint FilmCrafter runs against (default `gemini-nano-banana-2.1`; `gemini-3.1-flash-image` is marked retiring 29 Oct 2026 in FilmCrafter's notes). New motion demo: a short turnaround, walk, idle or pose clip made from an approved front view with a Kie video model (Kling 2.6 image-to-video, Seedance 2.0 Fast, or any listed model), saved in the project.
**Still unverified live:** every provider call, including Kie. Parsers and request builders are unit-tested (25 Rust, 86 UI tests); the network path has not run. Kie prices are not stated; the person enters price and ceiling.

**0.11.0 (2026-10-21), flow, not friction.** Verified by the owner: an image rendered through the app. Changes from their feedback: (1) cost no longer interrupts: the spending guard is optional and off by default, a small chip in the queue dock counts requests (retries included) and lets the person switch on a cap with their own price; the Kie and OpenAI legacy panels no longer demand a ceiling either; (2) a lightbox (click any image: wheel/+/- zoom, drag to pan, double-click for 100%, arrows between views, A to approve, R to reject) that opens the original file; (3) one searchable model picker across all providers with any custom model id allowed; (4) visual refresh: bundled Inter and Fraunces fonts (no web fonts), depth instead of outlines, segmented top bar, tinted chips, image-first cards, dark scrollbars, larger text on the older Direct/Deliver screens.
**Not done:** custom image import, a studio redesign of Direct and Deliver, dark/light theme options, live verification of video and Gemini paths.

**0.12.0 (2026-10-21), the director-first release.** (1) Your own images: "Use my image" on every view (copied byte for byte, approved on arrival, becomes the anchor; earlier revisions kept), a reference-photo strip per asset sent with every request to models that accept references, and drag and drop onto a card or the photo strip. (2) The Director's room replaces the old Direct screen (the classic editor and video compiler stay below it): coverage planning per scene from rules (establishing, master, over-the-shoulder pairs that keep screen direction, close-ups where the script's feeling peaks, inserts for props with a condition), a shot board with frames, a shot editor (size, angle, lens, movement, screen direction, composition, looks per character, set, action, dialogue, feeling, lighting, sound) with a framing guide, storyboard frames generated from the approved anchors (people, set) of each shot in a fixed named order, regenerate that never deletes older revisions, continuity checks (no approved reference, camera crossing the line, a look that disagrees with the script), an animatic player with slow camera moves, dialogue subtitles and a temp track, and shot-list export to CSV and Markdown.
**Unverified live:** storyboard frames have not been generated with a real key; the continuity checks read the plan, not the pixels. **Not done:** floor-plan blocking, frame-by-frame video export of the animatic, FDX/PDF/DOCX import, the AI beat pass.

**0.12.3 (2026-10-21), live-tested in the installed app.** The real app was driven through its own window (WebView2 debug port) with the owner's saved keys. Verified live: Kie (Nano Banana 2.1, Nano Banana Pro, GPT Image 2 via Kie), Google Gemini Nano Banana 2.1, OpenAI gpt-image-1.5 direct, a 5-view consistent turnaround using the approved front as the reference, a storyboard frame from approved anchors with script-derived costumes, a 5-second Kling 2.6 turntable video, own-image drop onto a card, reference photos, lightbox, cap notice, animatic playback; model lists refreshed live from Kie (59 image models), OpenAI (10) and OpenRouter (63). Not working: the saved OpenRouter key (provider returns 401) and fal.ai key (401). Bugs found by the live run and fixed: an old saved spending cap silently blocked all new work; Gemini accepts only image/jpeg as its response format; Kling needs a required `sound` setting; the lightbox was confined to its panel (rendered through a portal now) and did not fit the screen; stale notices never cleared; a plain title line triggered a warning; an empty box and empty dialogue quotes on Deliver.
**Not tested natively:** OS file dialogs (Open/Save As, image picker), the menu bar, drag from Explorer (the same event was emitted instead), exporting CSV/Markdown through the save dialog, Direct frames beyond one shot, the Direct video compiler.

**0.13.1 (2026-10-21), local AI.** Production One now finds and uses AI on this computer or your network, with no internet needed: Ollama and LM Studio (text and image-reading models) and ComfyUI (images and video). A Local AI panel auto-detects all three (ports 11434, 1234, 8188/8000 and the addresses you set), reads the GPU and RAM, suggests models that fit, and shows which ComfyUI workflows are ready or exactly which model file is missing. ComfyUI workflows ported from FilmCrafter: any image checkpoint (SDXL and similar), FLUX.1 dev (built from ComfyUI standard nodes, not run yet), and Wan 2.2 5B image-to-video (run by FilmCrafter); your own exported workflows work with {{prompt}}-style placeholders. ComfyUI models appear in the same picker as cloud models; the motion demo can run on a local video workflow. One-click ComfyUI install (official portable build from ComfyUI's GitHub releases, checksum verified, resumable), start, and model downloads from fixed Hugging Face addresses. A new optional AI beat pass reads each scene with a local model and keeps only beats whose quoted evidence appears in the script, with subtext and physical tells, marked in the UI.
**Verified live:** detection of Ollama (gemma3:12b) and the RTX 3060, the AI beat pass on the sample script (3 scenes, 5 beats kept, 0 dropped, 87 s), the install plan from GitHub. **Not verified live:** ComfyUI install, start, model download and ComfyUI image/video generation (no ComfyUI on this machine yet), LM Studio.

**0.14.0 (2026-10-22), professional UI, CleanRender, branding.** Full report in [UI_OVERHAUL_REPORT.md](UI_OVERHAUL_REPORT.md). New: restrained design tokens and deeper gold; Sheet Studio workspace (status, inspector folds, compare, large previews); Director's room cards, overflow menu, layouts, keyboard and drag reorder, resizable sectioned inspector; Delivery Center (readiness, grouped fixes with actions, editable compiler, gated verified export); CleanRender (prompt guidance, measurements, non-destructive corrections as new revisions, split view); approved icons, `.pone`/`.pguy` association, open-with, single instance; script import for Final Draft, Fountain, Word and PDF. 132 UI tests, 51 Rust tests, clippy clean, `npm audit` clean, rafter clean.
**Not done:** Environment Bible, choreography sheets, model recommendation modes, likeness check with a vision model, undo/redo of project edits, video flicker analysis, installer branding images, SQLite queue store, code signing, auto-update. ComfyUI image/video generation not yet live-verified (Wan 2.2 5B download incomplete at the time of writing).

**0.15.0 to 0.32.0 (2026-10-22 to 2026-11-14), see `CHANGELOG.md` for each release.** Highlights since this log was last updated: image-first characters, per-sheet shape and backdrop, sheet export, CleanRender, safe backups, casting lines and personalities, a security gate (strict content-security policy, confined path commands, dependency advisories cleared), level-matched audition playback (0.29.2), voice design from the script or a local AI helper (0.30.0), Suno music through Kie.ai (0.31.0), and the interface redesign with a sidebar, a Review workspace, a Deliver checklist and a style gallery with a picture for every style (0.32.0). Test counts at 0.32.0: 350 JS and 78 Rust. Release gate: `docs/TESTING.md`; latest QA: `docs/QA_REPORT_0.32.0.md`.
