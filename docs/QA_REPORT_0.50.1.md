# QA report: 0.50.1 (2026-11-19)

Scope: a Kie docs-page cache and retry, found by a long live workflow.

## Gate results
| Check | Result |
|---|---|
| tsc (`tsc -p tsconfig.app.json`) | Pass |
| JS tests | 672 pass |
| Rust tests | 91 pass (2 new: page cache; which statuses are retried) |
| clippy -D warnings, npm run build, npm audit | Pass, 0 vulnerabilities |

## Live (real model, isolated app)
| Check | Result |
|---|---|
| Before the fix: 15 requests in a row for one character's sheets | 10 of the 14 following views failed with a 403 from Kie's docs site |
| After the fix: Retry on the 10 failed views | All 10 made, no errors |
| Prop (5 more views) and place (3 more views) after the fix | All made, no failures |

## Not checked
- Whether Kie's docs site ever blocks for longer than the three retries and the six-hour copy cover (a fresh install on a blocked network has no copy to fall back to).
- Other providers (this affects only Kie); the other 37 2D presets; the light theme; installers on a clean machine.
