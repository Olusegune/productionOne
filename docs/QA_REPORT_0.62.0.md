# QA report: 0.62.0 (guided start, update check, Head view, Locate file, renames), 2026-11-21

Scope: what changed since 0.61.0, plus a UX and UI audit of every screen and the fixes that came from it.

## Commands

| Command | Result |
|---|---|
| `npx tsc -b` | pass |
| `npx vitest run` | pass: 134 files, 1092 passed, 1 skipped |
| `cargo test` in `src-tauri` | pass: 112 passed, 1 ignored |
| `cargo clippy` | no warnings |
| `npm run build` | pass |
| `npm run acceptance` | pass |
| `npm audit --omit=dev` | 0 vulnerabilities |
| In-page audit, all 7 screens x 4 widths x 2 looks | 0 findings |
| In-page audit on a brand-new empty project, 6 screens x 2 widths x 2 looks | 0 findings (after two fixes) |
| `rafter run` (remote) | not run: needs the account quota. The new code that touches files, folders and the network was reviewed by hand (below). |

## Live checks (real provider, real files), budget US$5, about US$0.08 spent

- **Proportions wording vs real pictures**: see `docs/LIVE_TEST_PROPORTIONS_2026-11-21.md`. Long legs, long arms and large hands visibly changed the picture in the asked-for direction.
- **Update check**: the packaged app asked GitHub's public releases page and got `current 0.61.0, latest 0.61.0, newer false`.
- **Review Head view**: on a plain-backdrop picture it found the head and zoomed to head and shoulders (250%); no "could not find" note.
- **Assistant**: starts on Quick, shows the plan cost and a one-click budget suggestion.
- **Script**: after the script is read, "Analyze script" is a normal button and "Continue to Design" is the yellow one.
- **New project** (web build): opens on Projects with the three start choices.

## What the audit found, and what changed

- **First screen for a new project** was the Script editor with a template card. It now opens Projects with "How do you want to start?" (Ask the Assistant, Add a script, Start from my pictures), the easiest first.
- **The Assistant was easy to miss**: it now carries a "new" badge until opened once, and is the first start choice.
- **The Assistant plan** defaulted to the Standard run (about US$4.80 for the sample): it now defaults to Quick (about US$0.44), and offers "Use $X as my budget" in one click. The Quick/Standard choice no longer runs off the panel.
- **Script**: the yellow button was "Analyze script" even after the script was read. The yellow button is now the next step, "Continue to Design".
- **Design**: Pause and Cancel waiting sat at the top with nothing to pause; they now show only when there is a queue.
- **Storyboards** (was Direct) was a nearly empty page: it now shows what you get in three steps and says it can wait.
- **Projects**: the Format picker took a large block; it is now one line with Change. A few cards had a blank gap under their heading (a stretched grid row); fixed.
- **Light look**: the script template card was dark-on-dark text (2.3:1) and the Deliver readiness figure was 2.0:1; both fixed.
- **Names**: Story is now Script and Direct is now Storyboards on screen (help, tour, palette, sidebar). Saved projects, links and shortcuts use the same internal names as before.

## Security review of the new code

- **Update check** (`update.rs`): one fixed GitHub URL, an 8 second timeout, a generic client name, nothing about the person or project sent, nothing downloaded or installed. The page can open only this project's own releases page (strict pattern, tested with injection attempts such as `&`, `file://` and `javascript:`), through `explorer.exe`/`open`/`xdg-open` with the address as a single argument, never through a shell.
- **Locate file and Find files**: the file or folder comes from a native dialog; the page cannot name a path. The copy step accepts only names a scan or a located file produced, decodes the file as a real PNG, JPEG or WebP (50 MB limit) first, never overwrites, and does not touch the original.
- **Head estimate**: reads one picture inside the app's pictures folder (the same check as the picture preview); it returns numbers only.
- **Mac signing workflow**: reads six secrets only when they exist; nothing is printed; unsigned builds are unchanged.

## What was not checked

- The Mac build and signing (needs an Apple Developer account; the workflow is ready and `docs/MAC_SIGNING.md` says what to add). Updates are announced, not installed automatically.
- **Locate file** was tested with component tests and Rust tests but not through the real file dialog.
- The Head view was seen working on one picture; it needs a plain backdrop and says so when it cannot find the head. It is an estimate from the outline, not face recognition.
- Installers on a clean machine; the packaged light look screen by screen (the automated audit covers it).
