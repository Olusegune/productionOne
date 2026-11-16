# QA and release gate, 0.41.0 (2026-11-16)

Run on the branch that became 0.41.0 (revision compare, then batch voice and music), on a new PC (Windows, Node 24, Rust 1.98).

## Verdict
Go for the branch and its installers. What is not checked is listed at the end; the main gap is that no paid batch was run and the new screens were not seen in the packaged app on a real project.

## Gate results
| Check | Result |
|---|---|
| Types: `npx tsc -b` | Pass |
| JS tests | 465 pass (442 before: 8 revision compare, 15 batch voice and music) |
| Rust tests | 78 pass (no Rust code changed; run at the start of the session on this PC) |
| `cargo clippy --all-targets -- -D warnings` | Clean |
| `npm audit` | 0 vulnerabilities |
| `cargo audit` | No vulnerabilities; 9 allowed warnings (yanked or unmaintained crates, unchanged) |
| `rafter secrets .` | Clean |
| `rafter run` (remote SAST and SCA) | Not run: plan quota. No backend command, path, network call or dependency changed |
| Version guard, changelog, release notes | Pass |

## What was tested
- **Revision compare:** which takes of a view are offered (same asset, look, sheet and view; failed and file-less jobs ignored); the default take (approved, else newest other, else none); keeping one approves it and turns the approved or waiting others down without deleting anything; a turned-down take can be brought back; a take with no file does nothing; the screen flow for keeping the new or the old take.
- **Batch voice and music plan:** only characters; the first scripted line or a typed line; skipped with a reason for no line, no voice, no stated personality or no character in the scene; counts of characters and requests; dollars only from a typed price; free engines never show dollars; the 20-item paid cap; key and credit failures stop the batch while ordinary failures do not.
- **Batch screen** (with `invoke` mocked): nothing is sent before the confirming click; a free batch makes each ticked character with the chosen voice and saves the clips; a cloud batch shows characters and the typed price, the confirm button says it spends credits, and the latest ElevenLabs model is used; a 401 stops the rest and saves nothing; a skipped character cannot be run; music makes one request per item with the right title, style and model.

## Interface audit (`scripts/qa/in-page-audit.js`, browser preview, demo project)
Design with the Batch panel open, 1440 px: Studio, Cinematic and Futurist, dark and light, and the Music tab: no overflow, no text under 12 px, no contrast failures, no small targets. The other workspaces were not changed.

## Not checked
- **A real paid batch.** No provider was called (no keys on this PC, and the owner's spend budget is small). The request shapes reuse the single-audition calls (`speak_local`, `speak_http`, `speak_elevenlabs`, `speak_voicekiller`, `make_music`), which were checked live earlier, but a batch itself has not been run against a real provider.
- **The packaged app.** The new screens were seen in the browser preview with the demo project only; the owner's real project is not on this PC. The installer and portable build were built here but not driven on a real project.
- **Revision compare with real pictures.** The demo project has no generated images; the logic and flow are tested, the look with real art is not.
- VoiceKiller's billing unit is not confirmed; it is treated as characters, and the screen asks for the person's own price.
- The guide has no new screenshot for the Batch panel.
