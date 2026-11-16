# QA and release gate, 0.39.0 (2026-11-15)

Run on the branch that became 0.39.0 (older screens follow the looks).

## Verdict
Go. What is not checked is listed at the end.

## Gate results
| Check | Result |
|---|---|
| Types: `npx tsc -b` | Pass |
| JS tests | 433 pass (unchanged; the change is styles and the audit script) |
| Rust tests | 78 pass (unchanged) |
| `cargo clippy --all-targets -- -D warnings` | Clean |
| `npm audit`, `cargo audit` | 0 vulnerabilities |
| `rafter secrets .` | Clean |
| `rafter run` (remote SAST and SCA) | Not run: plan quota. Only styles and a QA script changed |
| Version guard, changelog, release notes | Pass |

## Found and fixed during the work
| # | Finding | Fix |
|---|---|---|
| 1 | Cinematic in the light theme: the sidebar kept its dark gradient under dark text (about 1.5 to 2:1) in 0.35.0 to 0.38.1 | A light gradient for the light theme |
| 2 | The audit ignored gradient backgrounds, so finding 1 passed | The audit averages a gradient's colours; it then found finding 3 |
| 3 | "Not generated" tile label 3.7:1 in the light theme | Full text colour in the light theme |
| 4 | Providers dialog, prompt box and editor, style picker, model notes, cost pop-up used fixed cool-grey colours | Token-based surfaces in Cinematic and Futurist (found by scanning every screen for dark surfaces cooler than the look's panel colour) |

## Interface audit (`scripts/qa/in-page-audit.js`)
| Check | Result |
|---|---|
| Projects, Story, Design, Review, Direct, Deliver; Cinematic, Studio, Futurist; dark and light; 1440 px (demo project) | No overflow, no text under 12 px, no contrast failures, no small targets |

## Checked in the packaged app, on the owner's real project
| Area | Result |
|---|---|
| Audit, six workspaces, three looks, dark and light | Clean (no findings) |
| Session safety | The test replaced the autosave; it was restored from the backup ("8 to review, 55 done") and the recents list put back |

## Not checked
- The Local AI and help dialogs (the capture script could not open them), and a pass of the Providers dialog in the light theme beyond the audit.
- Sizes other than 1440 px for this change.
- The guide's sheet, audition and queue pictures are older and show the previous top bar.
