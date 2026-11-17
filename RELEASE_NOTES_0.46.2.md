# Production One 0.46.2

**Props that show something now look like what the script says.**

## Fixed
- **Analyze script no longer moves a planned storyboard's shots into scene 1.** Shots keep their scene, cast and frames when the script is read again.
- A photograph, picture, map, letter and similar props keep the script's description of what they show. In the "No VIP in Hell" script the photograph is a small boy behind a birthday cake; its insert shot used to show an unrelated framed figure. The description now reaches the prop's picture prompt, its insert shot and every shot prompt it appears in.
- Planning a scene again no longer draws shots that already have an approved frame a second time; it refreshes their action and cast instead.

## Checked
See `docs/QA_REPORT_0.46.2.md`.

Windows x64: installer (setup.exe), MSI and a portable zip. Not code-signed, so Windows SmartScreen may warn.
