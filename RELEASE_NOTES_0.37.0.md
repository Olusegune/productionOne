# Production One 0.37.0

**The cast board.** The Assets tab on the Story screen now shows your cast and places as pictures.

- A card for every character, costume, prop and set: its approved picture, name, type and status, with a coloured top edge for each kind.
- Select one and you see a large picture beside what the script says about it: the line that introduces a character (or their first line of dialogue), the line a prop was found on, or a set's first scene, each with **Show in the script**. The scenes it appears in are chips that jump straight to them. Nothing is written for you; every quote is from your script.
- Under **Looks and facts** are the ages and costumes the script gives a character and the facts that go into image prompts. The name, type and facts stay editable; **Remove** removes the selected asset. **Make its sheets** (or **Open in Design**) takes you to the asset's sheets.
- Arrow keys, Home and End move between cards. **List** switches to the compact list for projects with many assets, and the choice is remembered.

Checked: the real type check, 424 JS tests and 78 Rust tests, `npm audit` and `cargo audit` (0 vulnerabilities), a layout and contrast audit of the Story screen in all three looks, dark and light (1440 px; Cinematic also at 1024 and 1920 px), and the packaged app on a real project with real pictures.

Not done: on the cast board the card grid starts at the bottom of the pane on a small window, so you scroll to see more than the first row. A few light-theme labels (emotion chips, "universal", one Deliver note) are still low contrast. The guide's screenshots still show the older top bar. The remote Rafter scan could not run (plan quota).

Windows x64: installer (setup.exe), MSI and a portable zip. Not code-signed, so Windows SmartScreen may warn.
