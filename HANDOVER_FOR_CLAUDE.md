# Production One handover (START HERE)

**Update 2026-11-14 (release 0.32.0).** `main` carries everything from 0.21 to 0.32.0 (the work branch `ui/0.21-polish` was merged in PR #1 and deleted) (UI polish, image-first characters, per-sheet Shape and Backdrop, sheet export, backups, casting lines, personality and Never fields, a full systems and stress run, and a design refresh). Read `CHANGELOG.md` from the top, `docs/QA_REPORT_0.29.0.md`, `docs/DESIGN.md` and `docs/USER_GUIDE.md`. Test counts at 0.29.2: 296 JS, 73 Rust. Run the release gate in `docs/TESTING.md` before every release (it caught 7 dependency advisories, a missing content-security policy and two unconfined path commands at 0.29.2). `src/versionSync.test.ts` fails when the version differs between files, so bump them together (package.json, package-lock.json twice, tauri.conf.json, Cargo.toml, Cargo.lock, public/splash.html, CHANGELOG.md, RELEASE_NOTES_<version>.md). A live test of the packaged app replaces the autosave of the owner's session (the app backs it up to `Documents\Production One\Backups` first). The text below was written at 0.20.0.

Written 2026-11-12 at release 0.20.0. Older notes are kept unchanged under "Earlier notes" at the bottom.

## Where the code is

- **GitHub:** https://github.com/Olusegune/productionOne
- **Working branch:** `release/0.14.3-asset-lab` (all work since v0.14.10 is on it; history is intact, nothing was rewritten)
- **Release tags (newest first):** v0.20.0, v0.19.1, v0.19.0, v0.18.0, v0.17.2, v0.17.1, v0.17.0, v0.16.0, v0.15.0
- Windows installers for each release were built to `C:\Users\eduni\Desktop\ProductionOne-Release-<version>` (setup EXE, MSI, portable EXE, portable ZIP, SHA256, notes). Those binaries are NOT in git. Rebuild with the steps below.
- Per-release detail: `CHANGELOG.md` and `RELEASE_NOTES_<version>.md`. QA notes: `docs/QA_REPORT_*.md`. Live test results from the paid end-to-end runs: `docs/E2E_TEST_REPORT_2026-11-12.md` and `docs/ELEVENLABS_TEST_2026-11-12.md` (summarised below; the generated images, video and audio stay on the owner's Desktop, not in git).

## What the app is

Tauri 2 + React + TypeScript + Rust Windows desktop studio that turns a script into production-ready reference assets: it parses a script, plans reference sheets, queues image generation (Kie.ai, OpenAI, Google, fal, OpenRouter, local ComfyUI), supports review and approval, then exports a package. Motion and voice "auditions" let you see and hear a character or prop before committing. It does not render finished films.

## Build, test, release (Windows)

```
npm ci
npx tsc --noEmit -p .          # typecheck
npx vitest run                 # JS tests (177 pass at 0.20.0)
cd src-tauri && cargo test     # Rust tests (65 pass at 0.19.1)
# build installers. The long scratch path breaks the linker (LNK1104), so use a SHORT target dir:
CARGO_TARGET_DIR='C:\t\po' npx tauri build
```

Gotchas learned the hard way:
- Repo files are CRLF on disk; string-replace scripts must normalise line endings first.
- Version lives in: `package.json`, `package-lock.json` (two places), `src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml`, `src-tauri/Cargo.lock` (production-guy entry), `public/splash.html`.
- Portable EXE = `C:\t\po\release\ProductionOne.exe`. The NSIS silent switch (`/S`) did nothing on the owner's PC and the MSI needs admin; the interactive NSIS setup works but remembers an old install folder (`C:\Users\eduni\po-install-test`). Running the portable build from the release folder is the easy way to test.
- Only one copy of the app can run at once (a second launch hands off to the first).
- Commit messages end with the Claude co-author line; keys are never committed.

## Secrets

API keys are entered by the owner in the app: Settings dialog (the "AI Provider Registry") and are stored in the Windows Credential Manager under these names: `kie`, `fal`, `openai`, `google`, `openrouter`, `elevenlabs`, `voicekiller`, `voicekiller-user`. Never put a key in code, notes or chat. Live tests spend the owner's credits: ask first.

## What was built since 0.14.10

| Release | Summary |
|---|---|
| 0.15.0 | Character Bible progress derived from the queue, ARIA tabs, explainable script reading, pinned dependencies, Windows CI |
| 0.16.0 | Motion audition (presets for characters, vehicles, props), voice audition with Windows voices, sound briefs for props, confirmed identity facts now reach every image and motion prompt |
| 0.17.x | Voice engines through any local `/v1/audio/speech` server (Chatterbox, Qwen TTS, WazobiaVoice via `tools/wazobia_server.py`), per-line performance direction (state, emotion, laugh/grunt cues) that is honest about what each engine can do; prompts demand one image per view; sheet notes per asset; fewer false crop warnings |
| 0.18.0 | Identity lock made visible: panel says locked / waiting for approved front / unprotected, and offers one-click "Switch to <reference model>"; reference prompts say the attached image is the same subject |
| 0.19.x | ElevenLabs (speech, voice design, sound effects; "Latest" model follows the account's own model list, v4 now) and VoiceKiller (speech with instructions); voice keys in Settings |
| 0.20.0 | Geist typeface, no text under 12px, higher contrast, stronger focus ring, tidier voice/sound panels |

Key new files: `src/domain/voiceDirection.ts` (providers + performance logic), `src/domain/elevenModels.ts`, `src/domain/identityAnchor.ts`, `src/components/VoiceAudition.tsx`, `src/components/VoiceCloud.tsx`, `src-tauri/src/voice.rs` (Windows voices + local speech servers), `src-tauri/src/voice_cloud.rs` (ElevenLabs, VoiceKiller), `src/refresh.css` (loaded last), `tools/wazobia_server.py`.

## What was verified live, and what was not

Verified on the owner's PC (2026-11-12) through the real app, with real keys:
- Kie.ai image generation (Seedream 5.0 Flash, Nano Banana 2.1), turnaround, expression and prop sheets, approval gating, Kling 5 s image-to-video clip (identity held, no audio track), Windows-voice audition.
- Reference anchoring: after switching to Nano Banana 2.1, a regenerated Side view matched the approved Front (one sample).
- ElevenLabs: key save in Settings, load voices, speak a line with a `[laughs]` tag (3.5 s MP3), a sound effect (2 s MP3), voice design (3 previews). Nobody has LISTENED to the audio yet.

NOT verified: VoiceKiller (no key; voice-list reply shape unknown), keeping a designed ElevenLabs voice, whether "Latest" came from `/v1/models` or the fallback, Chatterbox/Qwen/Wazobia servers, prop sound effects, truck motion, pose/set sheets, anything in the packaged installer UI beyond the screens listed above.

## UI/UX brief

The full brief is **docs/UI_UX_BRIEF.md**: what the owner asked for (sleeker but accessible type, an interface that makes auditioning motion and voice easy), what 0.20.0 changed, 14 UX findings from the real-PC test, and a prioritised UI/UX to-do list (regenerate flow, notes saved, cost shown before paid actions, stale sample text, noisy warnings, long Design screen, voice panel regrouping, narrow-window layout, real WCAG/screen-reader audit, light theme, onboarding, splitting App.tsx). Read it before touching the interface.

## OUTSTANDING (in rough priority order)

### Image pipeline
1. **"Generate N views" does nothing when views already exist.** Users must Reject each view then Regenerate. Needs a clear "regenerate all" path.
2. **Sheet notes are not saved with the project** (kept per asset in memory only, lost on reload). No UI test covers the per-asset notes fix.
3. **Parser misses**: a lowercase prop in an action line ("old rusted blue pickup truck") was not detected; age, gender, ethnicity and costume colour written in the script were not extracted into the asset.
4. **Contact sheets**: prompts now demand one image per view and four samples complied, but there is no automatic detection of collages.
5. **Crop warning** still flagged a side edge on one regenerated image (may be real); the check is heuristic.
6. **Anchor**: only the newest approved *front* view is used. Let the owner pick the anchor, consider several references, and warn when approved views disagree (the earlier green-suit approval does not match the navy front).
7. **No cost estimate** next to Generate buttons; spend guard should be on by default; add a parse-confirmation step before paid generation.
8. **Stale sample shot text** ("solar compass", "We are close") appears in Deliver > Shot compiler in a new project with no shots.

### Voice and sound
9. **Listen to and judge the ElevenLabs outputs**; then verify the "Latest" model path against `/v1/models`, keeping a designed voice (uses a custom voice slot), and prop sound effects.
10. **Persist a voice per character** (provider, voice id, model, direction) so every line reuses it. Today only free-text `soundDirection` is saved.
11. **VoiceKiller**: needs the owner's key + user ID for a live test; confirm the voice-list reply shape; clone endpoint (`/api/generate-speech/clone`) and speaking styles are not wired.
12. **Local engines**: Chatterbox, Qwen TTS and `tools/wazobia_server.py` are unrun. WazobiaVoice weights are research/non-commercial only: get the owner's commercial answer before shipping it. Qwen cloud route not built. Suno via Kie is song generation, not dialogue, and is not integrated.
13. **Speaking while eating / carrying a heavy load** cannot be done reliably by TTS. Current behaviour: tags or instructions where documented, otherwise listed as "not applied" and kept in the casting brief. Idea not built: a small mixer that layers a generated effect (breath, grunt, chewing) under the line.
14. Motion clips have **no audio**; Kie's `generate_audio` flag exists in `kie_task_body` but is not exposed. A "speak while moving" clip needs audio muxed or a video model with audio.

### Platform and quality
15. **Installer**: silent install is a no-op, MSI needs admin, installs go to a remembered old folder; builds are **unsigned**; no WebView2 smoke test on a clean Windows runner in CI.
16. **UI**: narrow-window layout (still needs about 1100px), full screen-reader pass, light theme, and `App.tsx` is about 1,900 lines and should be split. The contrast audit was approximate (computed from CSS colours); run a real WCAG audit.
17. Audit provider adapters and reconciliation, review the reference-image workflow and model/aspect pickers.
18. Housekeeping: `@fontsource-variable/fraunces` is still a dependency but no longer imported.

## Owner preferences seen so far

Wants plain-language reports that say what was and was not verified; wants real models for voice (ElevenLabs latest, Qwen, Chatterbox, Wazobia, VoiceKiller) both local and cloud; wants motion and voice "auditions" for characters and props (cars etc.); wants a sleek but accessible interface; keeps the base history intact and each release in its own Desktop folder.

---

# Earlier notes (unchanged)

## Current state

Current release: 0.16.0. 0.16.0 adds Motion and Voice auditions (src/components/MotionDemo.tsx, VoiceAudition.tsx, src/domain/voiceAudition.ts, src-tauri/src/voice.rs using Windows System.Speech), per-asset-type motion presets, and threads confirmed identity fields (identityFacts in sheetSpecs.ts) into image and motion prompts. Audio clips reuse DemoClip with kind: 'audio'. NOT yet verified live: video generation, voice playback, on-screen layout. Earlier: 0.15.0 Character Bible progress/explainable parsing. 0.15.0 adds queue-derived Character Bible progress (src/domain/characterBible.ts), an ARIA tablist with keyboard navigation, gated Motion/Voice sections, and an explainable script reading (src/engine/explain.ts, "How this was read" in ReadingPanel). Earlier: 0.14.10 calm studio UI/UX pass. This release adds the calm studio UI/UX pass: reduced navigation and surface density, clearer primary actions, compact design rails, responsive collapse behavior, and horizontally scrollable section tabs. It also includes the Character Bible with linked Identity, Turnaround, Poses, Expressions, Wardrobe, Details, Motion video, and Voice sections, plus the Asset Lab Golden Path with Identity, Motion, Interaction, Sound, and Continuity modes.

Production One is a Tauri 2 + React + TypeScript + Rust desktop asset-preparation studio. It analyzes scripts, plans references, queues image work, supports technical/creative review, and exports production packages. It does not render finished films.

## This pass

- Preserved cumulative submission attempts across retry and provider/model reassignment.
- Added durable attempt metadata: attempt ID, submission state, receipt time, recovery note.
- Restart recovery now exposes ambiguous provider outcomes instead of blindly resubmitting potentially paid work.
- Added explicit draft/verified package export modes.
- Verified exports reject incomplete manifests and missing references.
- Draft packages include an incomplete-reference report.
- Package writes use a temporary file and refuse silent overwrite.
- Removed the hardcoded `The-Last-Horizon` export filename.
- Added frontend and Rust regression coverage.
- Added a SQLite WAL event ledger with durable submission-intent and ambiguous-outcome event support.
- Added portable package contract validation for schema, relative paths, hashes, sizes, approval, and stale state.
- Added deterministic acceptance-project tests, collect/relink tests, review-history snapshots, and a CI quality workflow.
- Added a static accessibility release gate and release-manifest signing script requiring an externally managed private key.
- Expanded the Delivery Center readiness summary with review and recorded-spend indicators.

## Validation completed (0.15.0)

- `npm test`: 150 passed. `npm run build` and `npm run qa:accessibility` passed. See docs/QA_REPORT_0.15.0.md.

## Next steps recommended after 0.15.0

- Real Motion-video and Voice panels (currently guidance only; Motion test generation is not wired to a Character Bible section).
- Responsive/visual QA at 1024px and below needs a WebView2 run; only the static a11y gate and unit tests were run.
- Expose explainStory confidence as editable asset confirmation before generation.
- Reduce App.tsx (~1860 lines) into feature modules.

## Older validation (0.14.x)

- `npm test`: 138 tests passed.
- `npm run build`: passed.
- `cargo test --manifest-path src-tauri/Cargo.toml`: 53 passed, 1 ignored.
- `npm run qa:accessibility`: passed.
- `npm run desktop:build`: passed again after the SQLite release changes.

## Desktop release artifacts

- `ProductionOne-0.14.0-portable.exe`
- `ProductionOne-0.14.0-portable.zip`
- `ProductionOne-0.14.0-setup.exe`
- `ProductionOne-0.14.0.msi`
- `ProductionOne-0.14.0-SHA256.csv`

These were copied to the Windows Desktop. The installer is not code-signed.

## Important limitations

- Provider task reconciliation is not yet implemented for every provider. Ambiguous jobs are surfaced for human reconciliation.
- The SQLite ledger command is available in the native layer; wiring every provider adapter to emit receipt/reconciliation events is the next integration step.
- The deterministic acceptance fixture and CI workflow are present; a full packaged-app acceptance runner still requires a Windows WebView2 runner.
- Model discovery is evidence-aware in parts of the codebase but does not provide universal live verification.

## Recommended next engineering slice

1. Add a versioned SQLite submission ledger with project ID, job ID, attempt ID, provider task ID, request fingerprint, intent event, receipt event, completion event, and reconciliation status.
2. Add provider adapters with idempotency/reconciliation capabilities declared explicitly per provider.
3. Build the deterministic acceptance project and run it in CI.
4. Make approval and stale dependency checks first-class package validation inputs.
5. Add contract-test consumers for FilmCrafter, Pulseframe, and Greenroom only where real contracts are available.

## Professionalization ideas

- Immutable event history and signed delivery manifests.
- Review gates with named approvers, timestamps, and exact revision/dependency snapshots.
- Project collect/relink with path portability tests.
- Provider capability evidence with verification dates and schema fingerprints.
- Accessibility and keyboard-navigation audit as release criteria.
- Crash/restart fault injection in CI.
- Export reproducibility checks and content-addressed media storage.
- Human-readable production codes separated from immutable IDs.

## Release honesty

Do not claim guaranteed identity consistency, artifact-free images, universal model support, exactly-once paid execution, or Hollywood-standard output. Those require provider capabilities and human review that are not universally available.


## 0.17.0 voice engines
- `src/domain/voiceDirection.ts`: provider registry (windows, chatterbox, qwen-tts, speech-server), `buildPerformance` (applied vs notApplied), `performanceBrief`.
- `src-tauri/src/voice.rs`: `speak_http` (local/private addresses only via `local::normalize_base`; `audio_extension` rejects non-audio).
- UI: `VoiceAudition.tsx`. All HTTP providers are `verified: false` until run against a live server. Next: live test, then Kie/other providers once docs are available.


## 0.17.1
- Wazobia provider in `voiceDirection.ts`; `tools/wazobia_server.py` follows the HF model card (`WazobiaVoiceMultilingualTTS.generate`). Unrun. `speak_http` takes `extra` (whitelisted by `merge_extra`).


## 0.17.2
- SheetStudio notes now `notesByAsset`; `buildViewPrompt` adds a single-image line; `qa_pixels` uses per-edge median. Remaining defects: see CHANGELOG 0.17.2 and Desktop/ProductionOne-E2E-Test-0.17.1/E2E_TEST_REPORT.md.


## 0.18.0
- `src/domain/identityAnchor.ts` (suggestReferenceModel, anchorStatus, anchoredPromptLine); SheetStudio Identity lock panel; `buildViewPrompt` `anchored` flag. Existing machinery: `anchorFor`, `useAnchor`, `waitingForAnchor`. Next: live test that the face holds; per-view choice of anchor; save notes with project.


## 0.19.0
- `src-tauri/src/voice_cloud.rs` (ElevenLabs: /v1/text-to-speech, /v1/sound-generation, /v1/text-to-voice/design + /v1/text-to-voice, /v2/voices; VoiceKiller: /api/generate-speech, /voicelist). Credential names: elevenlabs, voicekiller, voicekiller-user. UI: `VoiceCloud.tsx`; direction logic in `voiceDirection.ts` (eventTags/stateTags/tagModels/takesInstructions). All unverified live. VoiceKiller clone endpoint not wired.


## 0.19.1
- `src/domain/elevenModels.ts` (latest model by account list, tag support by pattern), `elevenlabs_models` command, voice keys added to `providerRegistry` (Settings dialog). VoiceCloud no longer holds key entry.


## 0.20.0
- `src/refresh.css` loads after all styles (imported last in main.tsx); Geist via @fontsource-variable/geist. Legacy sheets had their 8-11px sizes and low-contrast greys bulk-replaced. Contrast audit snippet is approximate (CSS colours only).
