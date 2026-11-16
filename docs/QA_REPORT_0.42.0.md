# QA and release gate, 0.42.0 (2026-11-16)

Run on the branch that became 0.42.0 (a real story through the real app, and the fixes it found).

## Verdict
Go for the branch and its installers. What is not checked is at the end; the main gaps are that nobody has listened to the generated voices and music, and that the packaged installer itself (as opposed to the identical release binary run as a test copy) was not driven on the owner's real project.

## Gate results
| Check | Result |
|---|---|
| Types: `npx tsc -b` | Pass |
| JS tests | 493 pass (465 at 0.41.0: saved voices and re-analysis 7, reader and the sample story 11, character bible and take selection 10 (3 rewritten), batch file names 1, project title 4 and others) |
| Rust tests | 78 pass (the changes are the asset scope at start-up and a threshold) |
| `cargo clippy --all-targets -- -D warnings` | Clean |
| `npm audit` | 0 vulnerabilities |
| `cargo audit` | No vulnerabilities; the same unmaintained-crate warnings as before |
| `rafter secrets .` | Clean |
| `rafter run` (remote SAST and SCA) | Not run: plan quota. No dependency or network call changed |
| Version guard, changelog, release notes | Pass |

## Live test (real app, real providers, 5 USD budget)
See `docs/LIVE_TEST_THE_RENEWAL_2026-11-16.md`. In short: story, own images, a consistent turnaround, revision compare, a real ElevenLabs batch (3 lines), a real Suno batch (2 requests), saved voices through re-analysis and a save and reopen, 41 planned shots and one real storyboard frame, interface audit in the real app. Spend estimated well under 1 USD.

## Bugs found by the live run and fixed here
| # | Finding | Fix | Verified |
|---|---|---|---|
| 1 | First run: pictures refused (403) because the assets folder did not exist when the asset scope was built | Create and allow the folder at start-up | Fresh data folder: folder exists at launch; first picture opens full size, 0 console errors |
| 2 | Re-analysis wiped confirmed fields and could renumber ids | `mergeAnalysis`, matched by type and name, keeps the old id | Unit tests; live: voices survived re-analysis |
| 3 | Keeping the older take left the turned-down one on show | `betterTake` (approved beats newer) in the sheet and the Character Bible | Unit tests; the live app showed the bug before the fix. The fixed build was run on a fresh folder only, so the fix is verified by tests, not on the real Side view |
| 4 | A sheet was Approved with 1 of 5 views | Fixed-size sheets count planned views | Unit tests; live: seen before the fix |
| 5 | Reader: objects without a verb, written-out ages, "plain clothes", junk prop | Reader changes | Unit tests on the sample story; live: 10 props found, no junk |
| 6 | Project kept the sample's name | `titleFromScript` | Unit tests |
| 7 | Light theme pale on pale (Character Bible, recent projects, approved, notice) | `looks.css` rules | In-page audit in the real app: clean after, in all three looks |
| 8 | CleanRender over-sharpening false alarm on a glowing render | Threshold 0.18 to 0.33, calibrated on 3 supplied and 6 generated images | Measured offline on the images; not re-run in the app |
| 9 | Clip labels and file names | Label by voice name; tidy tags | Unit tests |

## Interface audit (`scripts/qa/in-page-audit.js`)
Real app (release build), the reopened Renewal project with the Batch panel open: 6 workspaces x Studio, Cinematic, Futurist x dark, light. Dark: clean. Light: failures 1 to 3 above before the fix; the fix was tested by injecting the same CSS into the live page (clean in all three looks) and is in `looks.css`. The shipped build was not re-audited after the CSS was added to the stylesheet.

## Not checked
- **Listening.** No one has listened to the generated voices or music.
- **Paid video, VoiceKiller, OpenAI, fal.ai, OpenRouter, local engines** were not run in this test.
- **The installer on a clean machine**, and the packaged app on the owner's real project (not on this PC).
- **Revision compare after the take fix** in the real app (tested in unit tests; the live run showed the bug on the pre-fix build).
- The 403 error is explained by the empty assets folder on a fresh data folder; the shipped installs that already have a folder were not affected, which is why it was not seen before.
- Provider prices were not read; spend figures are estimates.
