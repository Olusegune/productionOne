# QA report: 0.47.1 (2026-11-18)

Scope: art style in prompts, typography, category icons, the card for a frame waiting for review.

## Gate results
| Check | Result |
|---|---|
| tsc (`tsc -p tsconfig.app.json`) | Pass |
| JS tests | 617 pass (6 new: art style in the frame prompt, pending frame, category icons) |
| Rust tests / clippy | Not re-run: no Rust change since 0.47.0 |
| npm run build, npm audit | Pass, 0 vulnerabilities |

## Real app (isolated copy, the 65-frame project, stylised 3D look locked)
| Check | Result |
|---|---|
| Titles in Inter 600, smaller; layout unchanged | Pass (screenshots) |
| Sheet buttons with icons (Establishing, Interior, Exterior, Layout, Lighting) | Pass |
| Icons by the asset header, asset list and bible | Pass (23 icons on the Design screen) |
| Console errors | None |

## Not checked
- The card for a frame waiting for review, in the running app (unit-tested only; a real check needed another paid image).
- Whether the fuller style makes real frames match the style better.
- The light theme; Playwright; installers on a clean machine.
