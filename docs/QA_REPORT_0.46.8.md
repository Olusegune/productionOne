# QA report: 0.46.8 (2026-11-18)

Scope: storyboard aspect ratios across image providers, and smaller corner radii.

## Gate results
| Check | Result |
|---|---|
| tsc | Pass |
| JS tests | 601 pass (1 more) |
| Rust tests | 86 pass (2 new: provider ratio mapping, trimming) |
| clippy -D warnings | Pass |
| npm run build | Pass |

## Not checked
- No real image was generated at 21:9, 2.39:1 or 9:16: provider output shapes are from their documented lists, not observed.
- Playwright, Python suites (none in this repo), npm audit re-run, installers on a clean machine.
- Corner radii were changed by script across 18 stylesheets; every screen was not reviewed, and the light theme was not looked at.
