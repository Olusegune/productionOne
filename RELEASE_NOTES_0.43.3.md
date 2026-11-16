# Production One 0.43.3

**Missing storyboard frames, audio and video clips, and reference photos are flagged too.**

## Fixed
- **Storyboard frames** whose picture is not on this computer say **Picture missing** in the Director's room and can be remade (Generate frame) or replaced (Use my own image).
- **Audio and video clips** whose file is gone show **File missing**, keep their line or prompt, and have a **Remove from list** button, instead of a player that cannot play.
- **Reference photos** that are gone are taken off their lists, since a request that sent one would fail.
- The notice names what was found.

## Checked
See `docs/QA_REPORT_0.43.3.md`.

Windows x64: installer (setup.exe), MSI and a portable zip. Not code-signed, so Windows SmartScreen may warn.
