# QA report: 0.46.4 (2026-11-18)

Scope: the title bar kept "Untitled production" after Save As under a new name; set consistency in frames.

## Gate results
| Check | Result |
|---|---|
| Types: `npx tsc --noEmit` | Pass |
| JS tests | 591 pass (2 more: projectFile.test.ts, castLimits.test.ts) |
| Rust tests | 84 pass (no Rust change) |
| clippy, `npm audit`, Playwright and Python suites | Not run in this pass |

## What changed and how it was checked
| Change | Unit tests | Real app |
|---|---|---|
| Save As names the production | projectFile.test.ts (`titleFromFilePath`) | Not checked in the app |
| Set rule in the shot prompt; set picture ordered before costumes and props | castLimits.test.ts | Not checked: no frames regenerated |

## Not checked
- The title fix in the running app; the set rule on real generated frames (a model can still drift from the set picture).
- Existing frames were made before this rule and are unchanged.
- Two scene headings for one room still make two sets.
