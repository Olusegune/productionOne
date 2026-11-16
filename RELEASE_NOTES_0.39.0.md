# Production One 0.39.0

**Older screens follow the looks, and a light-theme sidebar fix.**

- **Cinematic, light theme: the sidebar.** The dark gradient meant for the dark theme also applied in the light theme, so the logo and the navigation labels were dark on dark (about 1.5 to 2:1, barely readable). The light theme now has a light sidebar. This affected 0.35.0 to 0.38.1.
- **Older screens.** The Providers dialog, its cards and fields, the prompt box and prompt editor, the style picker button, the model notes and the cost pop-up were written with fixed graphite colours and looked cool and flat next to the warm Cinematic surfaces. In Cinematic and Futurist they now take the look's own surfaces. Studio keeps its colours.
- **Light theme.** The grey "Not generated" label on empty picture tiles is darker, and the green "approved" marker and red failing counts that 0.38.0 fixed stay fixed.
- **Guide.** The voice-casting screenshot is retaken for the sidebar layout.

Checked: the real type check, 433 JS tests and 78 Rust tests, `npm audit` and `cargo audit` (0 vulnerabilities), the interface audit (now reading gradient backgrounds too) on all six workspaces in all three looks, dark and light, and the packaged app on a real project.

Not done: the sheet, audition and queue screenshots in the guide still show the older top bar. The remote Rafter scan could not run (plan quota).

Windows x64: installer (setup.exe), MSI and a portable zip. Not code-signed, so Windows SmartScreen may warn.
