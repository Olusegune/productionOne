# Testing

## Commands
```powershell
npx tsc --noEmit -p .                               # types
npx vitest run                                      # unit and component tests (318 at 0.31.0)
cargo test --manifest-path src-tauri/Cargo.toml     # Rust tests (78 at 0.31.0; set CARGO_TARGET_DIR if the app is running)
cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings
npm audit
cargo audit                                         # in src-tauri; needs `cargo install cargo-audit`
npm run build
rafter secrets .                                    # before every push
```

## What is covered
| Area | Where | Notes |
|---|---|---|
| Story reader, emotions, AI-beat validation, script importers | `src/engine/*.test.ts` | Final Draft, Fountain, flat Word/PDF text |
| Generation queue, anchors, revisions, spend token, corrected revisions, retry classification | `src/domain/generationQueue.test.ts`, `CleanRender.test.tsx` | |
| Queue at scale and under random pressure | `src/domain/stress.test.ts` | 3,000-job queue, 3,000-job project round trip, 5,000-voice filter, a seeded fuzz of 4,000 random operations with invariants, and a check of every view of every asset type (unique keys, valid shapes, clean prompts) |
| Sheet specs, shape and backdrop, prompts, identity facts (including the Never clause) | `src/domain/sheetSpecs.test.ts` | |
| Casting lines, personality tags, pangram letter coverage | `src/domain/voiceAudition.test.ts`, `personality.test.ts` | The Spanish, French and German pangrams are checked to use all 26 letters |
| Backups before New/Open, adding a character from an image | `src/domain/projectSafety.test.ts`, `readingActions.test.ts` | |
| Golden Path | `src/domain/goldenPath.test.ts` | Includes projects started from images |
| Sheet Studio (generate, own images, reference photos, shape, backdrop, export one sheet, export every sheet), queue bar, voice picker, casting lines, voice suggestion, Add from image | `src/components/*.test.tsx` | `invoke` is mocked |
| Director's room, Lightbox, CleanRender | `src/components/*.test.tsx` | |
| Every workspace and Alt+number | `src/App.test.tsx` | Guards the split of App.tsx |
| Audition loudness and trimming, the level-matched player | `src/domain/audioLevel.test.ts`, `LevelledAudio.test.tsx` | Loudness is checked against ffmpeg's ebur128 value for a tone at three sample rates |
| Versions agree everywhere | `src/versionSync.test.ts` | package.json, package-lock.json, tauri.conf.json, Cargo.toml, Cargo.lock, splash, changelog, release notes |
| Providers, Kie parser, VoiceKiller list, local AI, script files, CleanRender maths, launch arguments, backups, sheet export layout | Rust `#[cfg(test)]` modules | |

## Live checks (real app, real providers)
Driven through the app's own window with WebView2's debug port (`--remote-debugging-port`) and `window.__TAURI_INTERNALS__.invoke`. The full run for 0.28.9 to 0.29.0, with results, is in [QA_REPORT_0.29.0.md](QA_REPORT_0.29.0.md). Earlier runs: 0.12.3 and 0.13.1 (Kie, Gemini, OpenAI, a Kling video, own-image drop, lightbox, animatic, Ollama, ComfyUI install), 0.28.x (image-first characters, turntable videos, ElevenLabs and VoiceKiller speech).

A second copy of the app cannot run beside an installed one (single-instance), and the app shares one data folder, so a live test replaces the autosave. The app backs the previous production up first (Backups folder); reopen it afterwards.

## Release gate (run before every release)
1. `npx tsc --noEmit -p .`, `npx vitest run`, `cargo test`, `cargo clippy --all-targets -- -D warnings`.
2. `npm audit` and `cargo audit` (0 vulnerabilities).
3. `rafter secrets .`, and `rafter run` when the plan's quota allows.
4. Build, then in the packaged app: a fresh load with console and security-policy violations recorded (none expected), a walk of every workspace and sheet, thumbnails, audio and video playback, an export, PDF and Word import, a ledger write, and the path-confinement checks (commands given a path outside the assets folder must refuse it). The 0.31.0 run is in [QA_REPORT_0.31.0.md](QA_REPORT_0.31.0.md); the 0.30.0 run is in [QA_REPORT_0.30.0.md](QA_REPORT_0.30.0.md); the 0.29.2 run is in [QA_REPORT_0.29.2.md](QA_REPORT_0.29.2.md).
5. Version guard (`versionSync.test.ts`), changelog, release notes, documentation.

## Interface audit
An in-page script (see QA report) checks, per workspace and per width (1024, 1280, 1440, 1920) and per theme: horizontal overflow, clipped text, tiny text, small click targets and WCAG contrast. Re-run it after any CSS change.

## Not checked (be aware)
- Native menus, Open/Save dialogs and Explorer drag-and-drop are not driven by automation (the file picker was driven once with keystrokes).
- fal.ai and OpenRouter generation (no keys saved), LM Studio, FLUX in ComfyUI.
- CleanRender on real model output: measurements and corrections are tested on synthetic images only. Video flicker is not measured.
- The installers on a clean machine, the file-association icon and uninstall (checked from the generated script and package contents only), and Windows SmartScreen for an unsigned installer.
- Audio quality; screen readers; the light theme's emotion-chip contrast (a colour filter the audit cannot measure).
