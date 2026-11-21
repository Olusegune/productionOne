# QA report: 0.61.0 (queue strip, Deliver, proportions workspace, relink, yellow buttons), 2026-11-20

Scope: everything added since 0.60.0 plus a sweep of every screen. Run on the web build (dev server) and on a packaged build of this branch.

## Commands

| Command | Result |
|---|---|
| `npx tsc -b` | pass |
| `npx vitest run` | pass: 132 files, 1079 passed, 1 skipped |
| `cargo test` in `src-tauri` | pass: 108 passed, 1 ignored |
| `cargo clippy` | no warnings |
| `npm run build` | pass |
| `npm run acceptance` | pass |
| `npm audit --omit=dev` | 0 vulnerabilities |
| `cargo audit` | no vulnerabilities; allowed warnings only (unmaintained or yanked crates already known) |
| `rafter secrets .` | 5 findings in 2 files, the same as in earlier releases: test fixtures in `exportRecords.test.ts` and test strings in `lib.rs`. Nothing new. |
| `rafter run` (remote) | not run: needs the account quota; the new file-scanning code was reviewed by hand against the rafter code-review checklist (below) |
| In-page audit (`scripts/qa/in-page-audit.js`) | 7 screens x 4 widths (1024, 1280, 1440, 1920) x 2 themes: 0 findings after fixes |

## What the in-page audit found, and what was fixed

- **Light look**: the Assistant "Set a budget" warning was 1.8:1 against its background, and four labels were between 4.1 and 4.4:1 (the 16:9 chip, a cast tag, a helper line, the "optional" tag). Secondary text was darkened and the warning recoloured: now clean.
- **Yellow primary buttons** briefly produced 4.0:1 on disabled buttons; the disabled style was changed: clean.
- **Deliver**: the new group headings had a 50 px blank gap (a stretched grid row); fixed. In the light look a stray black rule under "Blockers" was removed.
- **Review**: the zoom toolbar was wider than its column and ran under the decision panel; fixed by giving the centre column a `minmax(0, 1fr)` track.
- **Queue strip**: showed the same missing-file failure five times; it now shows one failed take per view and never a picture whose file is missing.
- **Proportions workspace**: typed numbers only took effect when you left the field, so the arrows and typing looked dead; they now take effect as you type (out-of-range values wait). Hand size, foot size, nose, jaw, elbows, knees and rounded-to-angular were not visible in the figure; every control now changes the drawing (a test checks every control).

## Checked in the packaged app (isolated copy, real files)

- **Find missing pictures**, end to end through the real folder dialog: 49 missing, chose a folder, "5 of 49 found, 44 not in this folder", Relink 5 files; copies landed in the pictures folder, the pictures appear in Review, the queue strip and the compare pane; Deliver went from 49 to 44 missing.
- **Review compare**: Top crop gave 250% with the picture scrolled to its top centre (face in view); zoom in went to 300%; Sync zoom, previous and next, the summary strip and the queue strip (with thumbnails) all worked.
- **Proportions workspace**: opens full-window; Hand size and Advanced controls change the figure; Draft becomes Applied on Apply; Back returns.
- **Deliver**: Blockers and Review groups, package preview, Find the files button.
- **Assistant**: typical price note and counts.
- **Undo for decisions** and **Remove from project**: checked in 0.57.0 and 0.58.0 and unchanged.

## Security review of the new code (file paths, folder scanning, copying)

- The folder to search always comes from a native dialog opened by the app, never from the page.
- The scan reads directory listings only, skips links, stops at depth 8 and 200,000 entries, accepts at most 5,000 names, and returns only PNG, JPEG and WebP matches.
- The page cannot name a file to copy: `adopt_scanned` accepts only names the last scan returned, and the file is decoded as a real PNG, JPEG or WebP (50 MB limit) before it is copied into the pictures folder. The original is not touched, and the same file is not copied twice.
- Nothing is deleted.

## What was not checked

- Mac builds (unsigned) were not run.
- The installers were not run on a clean machine.
- Real image generation was not run in this pass (no new generation code).
- The yellow buttons and proportions figure were reviewed in dark and light in a browser and in the packaged dark look; the packaged light look was not inspected screen by screen.
- Screens other than those listed were covered by the automated audit only, not by eye.
- Renaming Direct to Storyboards and Story to Script (from the mock-ups) was not done: it would change the names every help page and test uses, for a small gain.
