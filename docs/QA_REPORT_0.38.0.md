# QA and release gate, 0.38.0 (2026-11-15)

Run on the branch that became 0.38.0 (cast board on small windows, light-theme contrast, retaken guide screenshots).

## Verdict
Go. What is not checked is listed at the end.

## Gate results
| Check | Result |
|---|---|
| Types: `npx tsc -b` | Pass |
| JS tests | 428 pass (4 new: emotion chip colours on every surface, both themes) |
| Rust tests | 78 pass (unchanged) |
| `cargo clippy --all-targets -- -D warnings` | Clean |
| `npm audit`, `cargo audit` | 0 vulnerabilities (the yanked-crate lookup timed out offline) |
| `rafter secrets .` | Clean |
| `rafter run` (remote SAST and SCA) | Not run: plan quota. No backend command, path, network call or dependency changed |
| Version guard, changelog, release notes | Pass |

## Found and fixed during the work
| # | Finding | Fix |
|---|---|---|
| 1 | Emotion chips failed 4.5:1 on their own tint (neutral 3.6:1 in the dark theme, several in the light theme) | Per-theme colours; a test checks every emotion on every surface |
| 2 | The audit reported sidebar labels at 1.0 to 1.9:1 in the light theme | An audit artefact: colour transitions had not finished. The audit now switches transitions off while it measures, and understands `color-mix()` backgrounds and the page colour as its base |
| 3 | On a 1100 x 700 window the cast cards began at 760 px, below the first screen | The script source height follows the window below 1280 px; the card row is first and pinned. Cards now begin at 584 px |
| 4 | In the packaged app on the real project (which has approved assets and failing counts) two light-theme labels failed: the green "approved" marker in Design (2.1:1) and the red count in Deliver (2.0:1); the demo project does not show them | Light-theme colours for approved, failing counts and capability notes; re-audited clean |

## Interface audit (`scripts/qa/in-page-audit.js`)
| Check | Result |
|---|---|
| Projects, Story, Design, Review, Direct, Deliver, Cinematic, Studio and Futurist, dark and light, 1440 px | No overflow, no text under 12 px, no contrast failures, no small targets |
| Story, 1440 x 900 | Card row 292 to 489 px, preview beneath, all within the window |

## Checked in the packaged app, on the owner's real project
| Area | Result |
|---|---|
| Audit, six workspaces, dark and light | Clean (after finding 4) |
| Cast board | Five cards load |
| Session safety | The test replaced the autosave; it was restored from the backup ("8 to review, 55 done") and the recents list put back |

## Not checked
- The guide's sheet, voice, audition and queue pictures are older and show the previous top bar.
- Cast board metrics at 1024 and 1920 px after the reorder were not re-measured (the audit passed at 1440 px).
