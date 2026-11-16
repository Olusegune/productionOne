# QA and release gate, 0.43.4 (2026-11-16)

Run on the branch that became 0.43.4: a check of the exported package and the Deliver audit for missing paths.

## Verdict
Go. One real gap found and fixed, one robustness gap closed, two messages made clearer. Tested in unit tests and in a separate copy of the release build.

## Gate results
| Check | Result |
|---|---|
| Types: `npx tsc -b` | Pass |
| JS tests | 510 pass (3 new: shots whose frame is gone) |
| Rust tests | 81 pass, 1 ignored (1 new: the verified package names missing pictures by file name) |
| `cargo clippy --all-targets -- -D warnings` | Clean |
| `npm audit` / `rafter secrets .` | 0 vulnerabilities / clean |
| `cargo audit`, Playwright and Python suites | Not run: no dependency, engine or interface-test change |

## What the check found
| # | Finding | Fix | Verified |
|---|---|---|---|
| 1 | A shot stayed Approved when its storyboard frame's file was gone, so with storyboards on the audit counted the storyboard complete and the package production-ready | `reconcileShots`: such a shot goes back to planned; hand-approved and waived shots are left alone | Unit tests; real app: a project with storyboards on and an approved shot whose frame is gone showed "Incomplete shots 1", "1 storyboard frame not approved", readiness 0% and the verified export disabled |
| 2 | Files that vanish while the app is open were only noticed at load | Export package checks the tracked files first; if an approved picture is gone it updates the audit, makes no package and says so; clips and reference photos are handled in the same pass but do not block | Real app: a picture deleted while the app was open, then Export draft package: "No package was made: 1 approved picture is not on this computer...", home page changed from 1 of 17 to 0 of 17. A first version of this was overwritten by a later notice; fixed and re-run |
| 3 | The verified package's refusal printed full folder paths | Names the files, the count and the step | Rust test |
| 4 | Export sheet as one image gave a system error for a missing view | Says which view is gone | Not exercised in the app |

Checked and found sound: the audit asks which assets have a recorded picture and are Approved (so a missing picture stops "ready" since 0.43.2), and a draft package lists missing references in its readme instead of failing.

## Not checked
- Item 4 (sheet export message) was not triggered in the app.
- The Rust-side refusal for a verified package is a backstop; in the app the JS guard stops the export first, so the Rust message was tested only in a unit test.
- The "2 failed jobs: Retry them, or choose a different model" line on the Deliver page also counts takes failed because their picture is gone; its advice is not right for those and was not changed.
- The owner's own project was not opened (not on this PC). Welcome-card spacing (0.43.1) still unseen.
- Installer on a clean machine; Playwright and Python suites.
