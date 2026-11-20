# QA report: design tools (phases 1 to 6), 2026-11-20

Scope: proportion profiles, character layers and propagation, fit rules and redesign, camera and lighting direction, scene state and the blocking map, visual review and corrections, non-destructive grading and looks, design records in packages, export safety, migration, and the acceptance project.

## Commands

| Command | Result |
|---|---|
| `npx tsc -b` (typecheck; `npx tsc --noEmit -p .` is a no-op here because `tsconfig.json` has `files: []`) | pass |
| `npx vitest run` | pass (see the counts in the pull request) |
| `cargo test --lib` in `src-tauri` | pass |
| `npm run build` | pass |
| `npm run acceptance` | pass (writes `docs/ACCEPTANCE_REPORT.md`) |
| `rafter secrets .` | no secrets found |
| `rafter run` (remote SAST, SCA, secrets) | not run: the account's fast-scan quota for the period was used; reviewed by hand against the rafter code-review checklist instead |
| Lint | none configured in this repository |

## What the tests prove

- **Records**: ranges, defaults and documented numbers match the docs (tests read the docs); every record round-trips through JSON; every reader accepts nothing, junk and half-records.
- **Behaviour that must never regress**: no profile means identical prompts (golden file from 0.51.2 code); moving a slider makes zero provider or network calls; a camera change leaves the world identical; a grade leaves the original's bytes and hash unchanged and never compounds; an unchecked picture is never "passed"; a correction is a new revision that waits for approval and stops at its limits; nothing approves a picture except a button press.
- **Export**: credentials and model files are refused in both the app and the package writer; records carry file names only.
- **Acceptance project**: ten steps with a mock provider, scored defect detection, byte-identical on two runs.

## What the tests do not prove

- **Visual quality.** Mocked pictures are a few bytes. Whether any image model follows the proportion, camera or lighting wording was not tested.
- **Vision accuracy.** A scripted stand-in finds, misses and falsely flags on purpose to exercise scoring. A real model needs human-labelled evaluation.
- **The running app.** The panels were exercised in a test renderer (jsdom). Dragging on the blocking map and the canvas preview are not exercised there. Screenshots from the running app: see the pull request for which were captured.
- **Live providers.** No live image call was made in this work.

## Known limitations

See `PROVIDER_LIMITATIONS.md`. Deferred: LUT import, category D (set landmarks) checks, a cloud vision provider, applying looks to non-storyboard outputs, a separate lineup sheet type, dragging landmarks on an imported picture.
