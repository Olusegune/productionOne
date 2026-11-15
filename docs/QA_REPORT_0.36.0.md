# QA and release gate, 0.36.0 (2026-11-14)

Run on the branch that became 0.36.0 (Cinematic as the default look, and its polish), on the release build, with the owner's real project.

## Verdict
Go. What is not checked is listed at the end.

## Gate results
| Check | Result |
|---|---|
| Types: `npx tsc -b` | Pass |
| JS tests | 406 pass (1 new: nothing stored until a look is chosen, the version-2 key, an old stored value ignored; 3 changed for the new default) |
| Rust tests | 78 pass (unchanged) |
| `cargo clippy --all-targets -- -D warnings` | Clean |
| `npm audit`, `cargo audit` | 0 vulnerabilities (maintenance warnings only) |
| `rafter secrets .` | Clean |
| `rafter run` (remote SAST and SCA) | Not run: the plan's quota was used up at 0.29.2 and has not been confirmed back. The change adds no backend command, path, network call or dependency |
| Version guard, changelog, release notes | Pass |

## Found and fixed
| # | Finding | Fix |
|---|---|---|
| 1 | The first version of the looks stored its default on every start, so a stored "Studio" could not be told from a choice, and a new default would not have reached anyone who had run 0.35 | New key `po.look.v2`, written only when a look is chosen; the old key is ignored. Verified in the packaged app: an old stored "studio" was ignored and Cinematic loaded |
| 2 | The audit reported every Cinematic primary button as 1.0:1 because the gradient left the element with no background colour | The button has a real background colour under its gradient; the audit now measures it correctly, and the buttons pass |
| 3 | The asset type select cut "Character" to "Char..." | Wider select |

## Interface audit (`scripts/qa/in-page-audit.js`)
| Check | Result |
|---|---|
| Cinematic, dark and light, six workspaces, 1024, 1440 and 1920 px | No overflow, no text under 12 px, no contrast failures (apart from the older light-theme labels below) |
| Light theme | Only the older emotion chips, "universal" and one Deliver note are below 4.5:1 |

## Checked in the packaged app, on the owner's real project
| Area | Result |
|---|---|
| Default look | Cinematic with nothing stored; Fraunces headings; the page tint present; three cast thumbnails at 76 px; 0 console or policy errors |
| Session safety | The test replaced the autosave; it was restored from the backup ("8 to review, 55 done") and the recents list put back |

## Not checked
- The wider asset type select was fixed after the packaged screenshot, so it was checked in the unit tests and the CSS only, not by eye in the packaged app.
- Older screens that hard-code colours follow a look only partly.
- The guide's screenshots still show the older top bar.
- Vocal Suno tracks and the V6 and V6 Wild models; Qwen description-as-voice against a real server; ElevenLabs sound effects.
- The installers on a clean machine; Windows SmartScreen for an unsigned installer; audio quality by ear; screen readers.
