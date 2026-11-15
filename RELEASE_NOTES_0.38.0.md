# Production One 0.38.0

**Polish.** Three loose ends from 0.37.0 are tied up.

- **Cast board on small windows.** The row of cards now comes first in the Assets tab and stays pinned at the top while you scroll the selected asset; selecting a card scrolls it into view. On windows narrower than 1280 px the script source takes a height that follows the window, so the cards start on the first screen.
- **Light theme.** The last low-contrast labels now read clearly: the emotion chips (each emotion has its own darker colour in the light theme), the "universal" prompt tabs and the Deliver video-model notes. All six workspaces pass the contrast audit in all three looks, dark and light.
- **Guide screenshots** for Projects, Story, Design, Direct, Deliver, the command palette and the light theme are retaken to show the sidebar layout.

Checked: the real type check, 428 JS tests and 78 Rust tests, `npm audit` and `cargo audit` (0 vulnerabilities), a layout and contrast audit of all six workspaces in all three looks, dark and light, and the packaged app on a real project.

Not done: the sheet, voice, audition and queue screenshots in the guide still show the older top bar. The remote Rafter scan could not run (plan quota).

Windows x64: installer (setup.exe), MSI and a portable zip. Not code-signed, so Windows SmartScreen may warn.
