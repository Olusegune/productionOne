# QA and release gate, 0.40.0 (2026-11-15)

Run on the branch that became 0.40.0 (the Projects home hero).

## Verdict
Go. What is not checked is listed at the end.

## Gate results
| Check | Result |
|---|---|
| Types: `npx tsc -b` | Pass |
| JS tests | 442 pass (9 new: the summary logic 5, the hero component 4) |
| Rust tests | 78 pass (unchanged) |
| `cargo clippy --all-targets -- -D warnings` | Clean |
| `npm audit`, `cargo audit` | 0 vulnerabilities |
| `rafter secrets .` | Clean |
| `rafter run` (remote SAST and SCA) | Not run: plan quota. No backend command, path, network call or dependency changed |
| Version guard, changelog, release notes | Pass |

## Found and fixed during the work
| # | Finding | Fix |
|---|---|---|
| 1 | The first version used a `header` element; an older global rule gave it a fixed height so the next sections overlapped it | A plain `div` with a group role |
| 2 | The audit flagged the pale caption over the style picture in the light theme (it cannot see photos) | A solid dark caption band, so the text sits on a known colour |
| 3 | On a narrow window the picture cropped to the face | Crop anchored higher, shorter picture below 1100 px |

## Interface audit (`scripts/qa/in-page-audit.js`)
| Check | Result |
|---|---|
| Six workspaces, Cinematic, Studio, Futurist, dark and light, 1440 px (demo project) | No overflow, no text under 12 px, no contrast failures, no small targets |
| Projects at 1000 and 1920 px | No overflow |

## Checked in the packaged app, on the owner's real project
| Area | Result |
|---|---|
| Audit, six workspaces, three looks, dark and light | Clean (no findings) |
| The hero on the real project | Shows the title, "2 of 5 assets approved", "Continue: Approve a visual style", 33%, and the style name |
| Session safety | The test replaced the autosave; it was restored from the backup ("8 to review, 55 done") and the recents list put back |

## Not checked
- The hero with a locked style that has its own non-gallery palette only on the real project beyond the audit.
- The guide's sheet, audition and queue pictures are older and show the previous top bar.
