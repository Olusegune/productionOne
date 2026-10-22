# Testing

## Commands
```powershell
npx tsc -b                                          # types
npx vitest run                                      # unit and component tests
cargo test --manifest-path src-tauri/Cargo.toml     # Rust tests (set CARGO_TARGET_DIR if the app is running)
cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings
npm audit
npm run build
rafter secrets .                                    # before every push
```

## What is covered
| Area | Where | Notes |
|---|---|---|
| Story reader, emotions, AI-beat validation, script importers | `src/engine/*.test.ts` | Final Draft, Fountain, flat Word/PDF text |
| Generation queue, anchors, revisions, spend token, corrected revisions | `src/domain/generationQueue.test.ts`, `CleanRender.test.tsx` | |
| Sheet specs, shot planning, continuity, prompt guidance | `src/domain/*.test.ts` | Guidance never forces photographic texture on a stylised project |
| Sheet Studio, Director's room, Lightbox, CleanRender | `src/components/*.test.tsx` | `invoke` is mocked |
| Providers, Kie parser, local AI, script files, CleanRender maths, launch arguments | Rust `#[cfg(test)]` modules | CleanRender has synthetic-image tests for each correction and each measurement |

## Live checks (real app, real providers)
Driven through the app's own window with WebView2's debug port and playwright-core (`connectOverCDP`). Done in 0.12.3 and 0.13.1: Kie, Gemini and OpenAI generation, a five-view consistent turnaround, storyboard frame from anchors, a Kling video, own-image drop, lightbox, animatic, Ollama detection and the AI beat pass, ComfyUI install and start.

## Not checked (be aware)
- Native menus, Open/Save dialogs and Explorer drag-and-drop were not driven by automation.
- OpenRouter and fal.ai generation (the saved keys were rejected by the providers).
- LM Studio, FLUX in ComfyUI, and (until the model download finishes) ComfyUI image and video generation.
- CleanRender on real model output: measurements and corrections are tested on synthetic images only. Video flicker is not measured (no video decoder is bundled).
- The installer's file-association icon and uninstall were checked by reading the generated installer script, not on a clean machine.
- Accessibility: keyboard paths exist (menus, arrows between shots, resizable inspector); no automated axe sweep has been run on the new screens.
- Windows SmartScreen behaviour for an unsigned installer.
