# QA and release gate, 0.34.0 (2026-11-14)

Run on the branch that became 0.34.0 (failed views grouped by cause, and the Tasks list), on the release build, with the owner's real project.

## Verdict
Go. One gap in what was checked is stated below.

## Gate results
| Check | Result |
|---|---|
| Types: `npx tsc -b` | Pass |
| JS tests | 393 pass (31 new: cause sorting, grouping, the failure group screen, the task logic and screen) |
| Rust tests | 78 pass (unchanged) |
| `cargo clippy --all-targets -- -D warnings` | Clean |
| `npm audit`, `cargo audit` | 0 vulnerabilities (maintenance warnings only) |
| `rafter secrets .` | Clean |
| `rafter run` (remote SAST and SCA) | Not run: the plan's quota was used up at 0.29.2 and has not been confirmed back. The change adds no backend command, path, network call or dependency |
| Version guard, changelog, release notes | Pass |

## Found and fixed during the work
| # | Finding | Fix |
|---|---|---|
| 1 | The department board's groups came from a fixed template, so a role with nothing to do (costumes, when the script has none) showed as "needs approval" | A task's group is now decided from the project's real state; tests for each case |
| 2 | Two roles had identical "Open MARA" buttons that could not be told apart | The sound designer's button reads "Voices for MARA" |
| 3 | The old "Propose task" button only showed a message and ran nothing | Removed; the list now says there is no agent behind a task and points to where the work is |

## Interface audit (`scripts/qa/in-page-audit.js`)
| Check | Result |
|---|---|
| Deliver, dark theme, 1024, 1280 and 1440 px | No horizontal overflow, no text under 12 px, no contrast failures, no small targets |
| Deliver, light theme | Only the older note ("First/last-frame and multimodal...") below 4.5:1 |

## Checked in the packaged app, on the owner's real project
| Area | Result |
|---|---|
| Tasks list | 11 roles; "2 needs approval, 3 ready or running, 3 blocked, 3 complete"; real buttons (Open DOMINIC, Open Review, Open ARENA, Voices for DOMINIC, Choose a style); no overflow; the old board is gone; 0 console or policy errors |
| Failed views by cause | **Not seen on real data**: the project had no open failures. Checked by 21 unit and screen tests and on a throwaway page (nine failures became two groups, each with the right buttons) |
| Session safety | The test replaced the autosave; it was restored from the backup ("8 to review, 55 done") and the recents list put back |

## Not checked
- The failure groups on real failures from a real provider; the "Use {model} for these" move was tested with the queue logic, not against a live provider.
- The guide's screenshots still show the older top bar; a few light-theme labels are low contrast.
- Vocal Suno tracks and the V6 and V6 Wild models; Qwen description-as-voice against a real server; ElevenLabs sound effects.
- The installers on a clean machine; Windows SmartScreen for an unsigned installer; audio quality by ear; screen readers.
