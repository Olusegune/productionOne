# QA report: 0.48.0 (2026-11-18)

Scope: Image quality (brightness, contrast, enlarge), Image quality in the Director's room, adding several images at once.

## Gate results
| Check | Result |
|---|---|
| tsc (`tsc -p tsconfig.app.json`) | Pass |
| JS tests | 625 pass (8 new) |
| Rust tests | 88 pass (2 new) |
| clippy -D warnings | Pass |
| npm run build, npm audit | Pass, 0 vulnerabilities |

## Real app (isolated copy, the 65-frame project)
| Check | Result |
|---|---|
| Image quality button in the Director's room opens on the scene's frames | Pass |
| Brightness and Contrast sliders give a live before/after | Pass (screenshot) |
| Save with Contrast 45, Brightness -20, Enlarge 2x: new file 2752x1536 from 1376x768, darker, original kept | Pass (measured) |
| A second save from the saved copy at 2x (5504x3072) stays under the 8192 limit | Pass |
| Add several images at once: 3 files typed into the native dialog, 3 props added, named "Silver microphone 2" (a repeat), "Venomspur office" (code dropped), "Prop 3" (number-only file name) | Pass |
| Console errors | None |

## Not checked
- A 4x enlargement, and how enlarged frames look beyond the 2x test.
- The light theme, Playwright, installers on a clean machine.
- Choosing many files on a path with spaces.
