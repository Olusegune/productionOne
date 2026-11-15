# QA and release gate, 0.32.0 (2026-11-14)

Run on the release build after the interface redesign (phases 1 to 3), music with Suno, voice design, and a picture for every style. Live checks used the owner's saved Kie.ai and ElevenLabs keys.

## Verdict
Go. Three defects were found by this run's own checks and fixed before release (listed below). What is not checked is at the end.

## Gate results
| Check | Result |
|---|---|
| Types: `npx tsc -b` | Pass. **Correction:** `npx tsc --noEmit -p .`, which earlier reports and the testing guide gave, checks nothing in this project (the tsconfig is solution-style). Released builds were still type-checked because the build runs `tsc -b`; the guide and gate now say `tsc -b` |
| JS tests | 350 pass (60 files) |
| Rust tests | 78 pass |
| `cargo clippy --all-targets -- -D warnings` | Clean |
| `npm audit` | 0 vulnerabilities |
| `cargo audit` | 0 vulnerabilities (maintenance warnings only) |
| `rafter secrets .` | Clean |
| `rafter run` (remote SAST and SCA) | Not run: the plan's quota was used up at 0.29.2 and has not been confirmed back |
| Version guard, changelog, release notes | Pass |

## New tests since 0.31.0 (this release adds 32)
identity fields by asset kind (3), Review queue and checklist logic (8), Review screen decisions (6), style gallery data (8, including a picture on disk for every one of the 117 styles and an exact match between the list and the folder) and gallery screen (7). Alt+6 was added to an existing test. The in-page interface audit is now kept in `scripts/qa/in-page-audit.js`.

## Found and fixed
| # | Finding | Fix |
|---|---|---|
| 1 | A set, prop or vehicle showed Age, Gender, Race, Ethnicity, Role and Personality in its Identity tab (found by the redesign audit, confirmed in the app) | Character-only fields shown for characters only; saved character facts on other assets are kept and listed; test |
| 2 | Deliver's shot-compiler dropdowns overflowed their panel by about 290 px after the columns were reordered | Column widths and field minimums set; checked at four widths |
| 3 | Two styles differ only by letter case ("Architectural Visualization", "Architectural visualization"), so they mapped to one picture file and one was overwritten | A fixed file name for the library one; a test that every style has a distinct file |

## Interface audit (`scripts/qa/in-page-audit.js`)
| Check | Result |
|---|---|
| Dark theme, 1024, 1280, 1440 and 1920 px, Projects, Story, Design, Review, Direct, Deliver | No horizontal overflow, no text under 12 px, no contrast failures. Story has a few click targets of 20 to 24 px that predate this release |
| Style gallery dialog, 1440 px | No text under 12 px, no contrast failures, no targets under 28 px, no overflow; at 1024 px the grid scrolls and the detail panel sits above it |
| Light theme | Not clean: the emotion chips (a colour filter) and two small labels ("universal", one Deliver note) are below 4.5:1. They predate this release and are not fixed |

## Checked in the packaged app, on the owner's real project
| Area | Result |
|---|---|
| Fresh load, Review, Deliver, gallery | 0 console errors and 0 security-policy violations |
| Review | Badge showed 8 waiting (the same as the queue bar); real images shown beside the approved reference; Alt+6 opens it |
| Deliver | Checklist listed the real gaps (style not locked, assets without approved sheets, pictures waiting, failed jobs); no overflow |
| Style gallery | 117 cards; all 100 images in the library families loaded under the policy (checked before every project preset had its own picture; all 117 were present in the build tested next) |
| Live provider checks | ElevenLabs Voice Design: 3 previews returned (0.30.0). Suno through Kie.ai: 2 tracks returned in 22 s (0.31.0). Kie.ai images: 117 style pictures made in about 40 minutes with no errors and no credit problems |
| Session safety | Every live test replaced the autosave; the previous production was backed up each time and restored from it afterwards ("8 to review, 55 done"), the recents list was put back, and the test files were deleted |

## Not checked
- Vocal tracks and the V6 and V6 Wild Suno models; Qwen description-as-voice against a real server; ElevenLabs sound effects.
- Script and Asset Studio layouts were not redesigned in this release. The screenshots in the guide show the older top bar.
- The installers on a clean machine; Windows SmartScreen for an unsigned installer.
- Audio quality by ear; screen readers; keyboard paths through the gallery by hand (covered by tests only).

## After the 0.32.0 release: Script, Asset Studio and fonts (unreleased, branch `ui/phase4-script-studio`)
| Check | Result |
|---|---|
| Tests | 362 JS pass (Script workspace, Add dialog, Asset Studio tabs, look bar, fonts); 78 Rust unchanged |
| Audit, six workspaces, dark theme, 1024, 1280, 1440, 1920 px, with Space Grotesk | No horizontal overflow, no text under 12 px, no contrast failures, no small targets |
| Audit, light theme | Projects, Story, Review, Direct clean; the emotion chips, "universal" and one Deliver note still below 4.5:1 (older); two fixes made (surface tokens and white text on the dark gold had no light values) |
| Packaged app, real project | Story: 3 thumbnails shown, tabs work, no overflow. Asset Studio: Sheets tab first, four tabs, look strip one row. Fonts: Inter and Space Grotesk loaded, headings and wordmark in Space Grotesk, 0 console or policy errors. First picture starts 794 px down an 880 px window, was 988 px: better, still only just above the fold (**not met**: the brief wanted pictures above the fold at representative sizes) |
| Session | Restored from the backup after every packaged test; recents list put back |
