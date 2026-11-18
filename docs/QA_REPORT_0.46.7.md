# QA report: 0.46.7 (2026-11-18)

Scope: guidance around a project started from images (no script). Found by the image-only end-to-end test.

## Gate results
| Check | Result |
|---|---|
| tsc | Pass |
| JS tests | 600 pass (2 more) |
| Rust tests | not re-run (no Rust change) |

## Real app (isolated copy, new empty project)
| Change | Result |
|---|---|
| Start from images button and new status line | Pass |
| Adding from an image says "added with your image as the approved front" | Pass |
| Add to the bible dialog is opaque | Pass (screenshot) |
| Pill says "Ready to export" instead of "Deliver complete" | Pass |

## Not checked
- With one approved front view the project reads 83 percent and "Ready to export", because the audit only needs one approved sheet per asset. That rule is unchanged.
- clippy, Playwright, Python suites, installers on a clean machine, the light theme dialog.
