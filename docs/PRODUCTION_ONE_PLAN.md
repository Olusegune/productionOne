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
