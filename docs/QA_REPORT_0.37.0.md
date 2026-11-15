# QA and release gate, 0.37.0 (2026-11-14)

Run on the branch that became 0.37.0 (the cast board on the Story screen), on the release build, with the owner's real project and pictures.

## Verdict
Go. What is not checked is listed at the end.

## Gate results
| Check | Result |
|---|---|
| Types: `npx tsc -b` | Pass |
| JS tests | 424 pass (18 new: evidence and scene logic 10, the board 8; two Script workspace tests changed to use the list view) |
| Rust tests | 78 pass (unchanged) |
| `cargo clippy --all-targets -- -D warnings` | Clean |
| `npm audit`, `cargo audit` | 0 vulnerabilities (maintenance warnings only) |
| `rafter secrets .` | Clean |
| `rafter run` (remote SAST and SCA) | Not run: the plan's quota was used up at 0.29.2 and has not been confirmed back. The change adds no backend command, path, network call or dependency |
| Version guard, changelog, release notes | Pass |

## Found and fixed during the work
| # | Finding | Fix |
|---|---|---|
| 1 | My first reorder put the card grid inside the selected asset's detail panel (a tool slip), making the preview 1268 px tall | Grid moved back out; the structure checked by measuring the element tree |
| 2 | The preview sat below the card grid, off screen in a long pane | The selected asset now sits above the grid; its height was cut from about 670 px to about 350 px (looks and facts folded under a disclosure, three-line quote, scenes in one row) |
| 3 | Two Script workspace tests looked for the old list's buttons | They now switch to the list first; new board tests cover the board |

## Interface audit (`scripts/qa/in-page-audit.js`)
| Check | Result |
|---|---|
| Story, Cinematic, Studio and Futurist, dark and light, 1440 px | No overflow, no text under 12 px, no contrast failures, no small targets |
| Story, Cinematic, 1024 and 1920 px, dark and light | Clean; at 1920 x 1080 the pane is 817 px tall and the preview 349 px |

## Checked in the packaged app, on the owner's real project
| Area | Result |
|---|---|
| Cast board | Five cards (ARENA, DOMINIC, MARA, CASSIUS, clay water jar) with their kinds and states; three pictures loaded on the cards; MARA's large picture and her quote from the script with "Show in the script (line 10)", her scene chip and "Open in Design"; no horizontal overflow; 0 console or policy errors |
| Session safety | The test replaced the autosave; it was restored from the backup ("8 to review, 55 done") and the recents list put back |

## Not checked
- On a small window the first row of cards is at the bottom of the pane, so a scroll is needed to see more than the preview.
- The cast board was not tried with a very large project (dozens of assets); the compact list is there for that.
- "Show in the script" and the scene chips were tested by calling the jump handler, not by watching the script scroll in the packaged app.
- The guide's screenshots still show the older top bar. A few light-theme labels are low contrast.
- Vocal Suno tracks and the V6 and V6 Wild models; Qwen description-as-voice against a real server; ElevenLabs sound effects.
- The installers on a clean machine; Windows SmartScreen for an unsigned installer; audio quality by ear; screen readers.
