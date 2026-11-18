# QA report: 0.47.0 (2026-11-18)

Scope: project Format, the storyboard card, and the guide.

## Gate results
| Check | Result |
|---|---|
| tsc (app project, `tsc -p tsconfig.app.json`) | Pass |
| JS tests | 611 pass (10 new) |
| Rust tests / clippy | Not re-run: no Rust change since 0.46.8 (86 pass, clippy clean there) |
| npm run build | Pass |
| npm audit | 0 vulnerabilities |

## Real app (isolated copy, the 65-frame project)
| Check | Result |
|---|---|
| Format panel on Projects | Pass (screenshot) |
| Format row in the Director's room; switching to TikTok shows tall cards | Pass |
| Frames made at 16:9 are tagged and counted ("7 frames were made at another shape") | Pass |
| No image generated or queued by changing the format | Pass (unit test and app) |
| Card layout (badge, name, action, tags, one main button, menu) | Pass (screenshot) |
| Console errors | None |

## Not checked
- No real image was generated at 9:16, 4:5 or 21:9, so what each provider returns is untested.
- The light theme, and every other screen after the earlier corner change.
- Playwright, installers on a clean machine.
- The root `npx tsc --noEmit` checks nothing in this repo (its tsconfig lists no files); the real type check is `tsc -p tsconfig.app.json` (also run by `npm run build`).
