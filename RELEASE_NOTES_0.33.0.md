# Production One 0.33.0

The Script and Asset Studio screens are redesigned, and headings now use a sleeker font.

- **Script.** A toolbar (Import script, Analyze script, Templates) over the script and a breakdown with three tabs: **Assets** (type, name, picture, status, scenes, an **Evidence** button that jumps the script to the source line, and a **Facts** toggle for characters), **Questions** (what needs your check, apart from what the script clearly supports) and **Reading**. Templates appear only when the script is empty, or on request from the toolbar.
- **Asset Studio.** One row for the film's look (Browse styles, palette, Lock style). Each asset has four tabs: **Sheets** (first), Identity, Motion, and Voice and sound; switching tabs never loses your place. The Add character form is a dialog. On a wide window the sheet's controls (Look, Sheet, shape, backdrop, model, Generate, reference photos, notes) are in the side panel, so the pictures have the centre and the first picture is visible without scrolling (600 px down an 880 px window, was 988).
- **Fonts.** Headings, page titles, the wordmark and the big numbers are in **Space Grotesk**; text and controls stay in Inter; the script stays in Courier Prime. The fonts are bundled, so the app looks the same offline.
- **Light theme.** The new screens now read properly in the light theme.

Checked: the real type check, 364 JS tests and 78 Rust tests, `npm audit` and `cargo audit` (0 vulnerabilities), a layout and contrast audit of all six workspaces at four widths, and the packaged app on a real project.

Not done: grouping repeated failures by cause, and a compact task list in place of the department matrix. The guide's screenshots still show the older top bar. A few light-theme labels (emotion chips, "universal", one Deliver note) are still low contrast. The remote Rafter scan could not run (plan quota).

Windows x64: installer (setup.exe), MSI and a portable zip. Not code-signed, so Windows SmartScreen may warn.
