# Production One 0.40.0

**The Projects home hero.** The top of the Projects screen now tells you where the production stands and what to do next.

- The title, with a line in words: "3 of 8 assets approved" (and "· 1 request running" while something is generating).
- A progress bar toward a delivery package, with the percentage.
- One large button for the next step: "Continue: Approve a visual style", "Continue: Generate references" and so on. When every step is done it reads "Open Deliver". With no script yet it reads "Add your script".
- **New**, **Open** and **Save** sit beside it.
- The look of the film as a picture: your visual style's own gallery picture (or its colours when it has none), with its name, its palette and whether it is locked. On a narrow window the picture drops under the text.
- The five count tiles (scenes, characters, props, sets, approved) sit beneath. Nothing is stored or invented; the hero reads the Golden Path and the style.

Also in this version: the guide's Projects screenshot is retaken, and `HANDOVER_FOR_CLAUDE.md` has a fresh start-here note for continuing on another PC.

Checked: the real type check, 442 JS tests and 78 Rust tests, `npm audit` and `cargo audit` (0 vulnerabilities), the interface audit on all six workspaces in all three looks, dark and light, and the packaged app on a real project.

Not done: the sheet, audition and queue screenshots in the guide still show the older top bar. The remote Rafter scan could not run (plan quota).

Windows x64: installer (setup.exe), MSI and a portable zip. Not code-signed, so Windows SmartScreen may warn.
