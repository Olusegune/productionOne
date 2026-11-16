# QA and release gate, 0.43.2 (2026-11-16)

Run on the branch that became 0.43.2 (an asset no longer stays Approved when its picture is gone). It closes the gap listed in the 0.43.1 report.

## Verdict
Go. A small change, tested in unit tests and in a separate copy of the release build.

## Gate results
| Check | Result |
|---|---|
| Types: `npx tsc -b` | Pass |
| JS tests | 501 pass (5 new in `missingFiles.test.ts`) |
| Rust tests | 80 pass, 1 ignored (no Rust change) |
| `cargo clippy --all-targets -- -D warnings` | Clean |
| `npm audit` | 0 vulnerabilities |
| `rafter secrets .` | Clean |
| `cargo audit`, Playwright and Python suites | Not run: no dependency, engine or interface-test change |

## What changed
`reconcileMissing` (`src/domain/missingFiles.ts`), called when the app finds pictures missing: an asset whose recorded picture is gone loses that picture; another approved front view that still has a file stands in if there is one; otherwise the asset goes back to planned. The asset's own recorded picture is now checked together with the queue's. Assets whose picture is fine, and assets never marked approved, are untouched.

## Test in a separate copy of the release build
A project saved with an approved front view was opened with no `_files` folder and an empty assets folder. Before the fix the home page said 1 of 17 approved and the character header said Approved. After: the home page says "0 of 17 assets approved", the header shows no Approved label, the view card is Failed with the reason, and "Generate 5 views" is offered. 0 console errors.

## Not checked
- Other pictures that go missing: storyboard frames, reference photos and audio clips are not checked.
- The case where an asset keeps its approval through a stand-in picture was tested in unit tests only, not in the app.
- The owner's own project was not opened (not on this PC).
- Welcome-card spacing from 0.43.1 is still unseen in the app.
- Installer on a clean machine; Playwright and Python suites.
