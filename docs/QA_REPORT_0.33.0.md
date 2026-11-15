# QA and release gate, 0.33.0 (2026-11-14)

Run on the branch that became 0.33.0 (the Script and Asset Studio redesign, Space Grotesk headings and the sheet controls in the side inspector), on the release build, with the owner's real project.

## Verdict
Go. Defects found by this run's checks were fixed before release (listed below). What is not checked is at the end.

## Gate results
| Check | Result |
|---|---|
| Types: `npx tsc -b` | Pass |
| JS tests | 364 pass |
| Rust tests | 78 pass (unchanged) |
| `cargo clippy --all-targets -- -D warnings` | Clean |
| `npm audit`, `cargo audit` | 0 vulnerabilities (maintenance warnings only). One new npm package: `@fontsource-variable/space-grotesk` (SIL Open Font Licence) |
| `rafter secrets .` | Clean |
| `rafter run` (remote SAST and SCA) | Not run: the plan's quota was used up at 0.29.2 and has not been confirmed back |
| Version guard, changelog, release notes | Pass |

## New tests since 0.32.0 (14)
Script workspace (6), Asset Studio tabs and the look bar in the app (2), the Add character dialog closing with Escape (1), fonts bundled and first in their stacks and the policy allowing only the app's own fonts (3), sheet controls drawn into a slot or inline (2).

## Found and fixed
| # | Finding | Fix |
|---|---|---|
| 1 | The heading font setting was defined in four stylesheets (Fraunces, Geist, Inter and a new one); the last loaded won, so a change in one file did nothing | All four set to the same stack; a test checks the stack |
| 2 | The surface tokens (`--panel-1`, `--panel-2`, `--line-1`) had no light-theme values, so new screens were unreadable in the light theme; text on the dark-gold accent in the light theme failed contrast | Light values added; white text on the gold in the light theme |
| 3 | Selected chips in the light theme had white text on a near-transparent gold | Solid gold background |
| 4 | In Asset Studio the first picture started 988 px down an 880 px window | Look strip in one row, repeated names removed, controls moved into the side inspector on wide windows: now 600 px, visible without scrolling |
| 5 | The style trigger's "Browse styles" text overlapped the palette in the look strip | Text hidden, icon kept |

## Interface audit (`scripts/qa/in-page-audit.js`)
| Check | Result |
|---|---|
| Dark theme, all six workspaces, 1024, 1280, 1440 and 1920 px, with Space Grotesk | No horizontal overflow, no text under 12 px, no contrast failures, no small targets |
| Light theme | Projects, Story, Review, Direct clean. Still below 4.5:1 (older): the emotion chips, "universal", one Deliver note |
| Controls in the inspector | At 1440 px they are in the inspector; at 1280 px (inspector hidden) they fall back inline above the pictures. Both audited clean |

## Checked in the packaged app, on the owner's real project
| Area | Result |
|---|---|
| Story | 3 thumbnails shown, three tabs, no overflow |
| Asset Studio | Sheets tab first; four tabs; Generate and the other controls are inside the inspector; the first picture is visible without scrolling (600 px of 880) |
| Fonts | Inter and Space Grotesk loaded; headings and the wordmark in Space Grotesk; 0 console or security-policy errors |
| Session safety | Every packaged test replaced the autosave; it was restored from the backup ("8 to review, 55 done") and the recents list put back each time |

## Not checked
- Grouping repeated failures by cause and a compact task list were not built.
- The guide's screenshots still show the older top bar.
- Vocal Suno tracks and the V6 and V6 Wild models; Qwen description-as-voice against a real server; ElevenLabs sound effects.
- The installers on a clean machine; Windows SmartScreen for an unsigned installer.
- Audio quality by ear; screen readers; keyboard paths through the new dialogs by hand (covered by tests only).
