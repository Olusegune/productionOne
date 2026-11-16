# QA and release gate, 0.43.1 (2026-11-16)

Run on the branch that became 0.43.1 (missing pictures are shown as missing; two layout fixes). Prompted by the owner's screenshots of a project whose pictures were not on the computer.

## Verdict
Go for the fix. What is not checked is at the end; the main gaps are the asset-level "Approved" label and the Welcome spacing, which were not seen in the app.

## Gate results
| Check | Result |
|---|---|
| Types: `npx tsc -b` | Pass |
| JS tests | 496 pass (3 new: missing pictures become failed takes, Generate remakes them, existing files untouched) |
| Rust tests | 80 pass, 1 ignored (1 new: `missing_files`) |
| `cargo clippy --all-targets -- -D warnings` | Clean |
| `npm audit` / `cargo audit` / `rafter secrets .` | See the 0.43.0 run; no dependency changed |
| Playwright and Python suites | Not run |

## Found in the owner's screenshots
| # | Finding | Fix | Verified |
|---|---|---|---|
| 1 | Views showed Approved with "No image yet" and "Generate 0 views / Nothing new to generate" when their files were not on the computer | The files are checked when a project loads; a missing one becomes a failed take that says why, with a notice. Generate counts and remakes it; Use my image adds it again. Retry is not offered for the owner's own images (no prompt) | Real app (separate copy of the release build): a project saved with a picture, opened with no `_files` folder and an empty assets folder showed the notice, a Failed card with the reason, buttons Use model / Use my image, and "Generate 5 views" |
| 2 | Sheet tabs hid behind a horizontal scroll bar | Tabs wrap | Real app: computed style wrap, no horizontal overflow, all tabs visible |
| 3 | Counts row touched the Welcome card | 24 px space above the card | CSS only; not seen in the app (the card was already dismissed in the test copy) |

## Not checked
- **Asset-level approval.** After the picture is marked missing, the character header still says "Character · Approved" and the home page counts 1 of 17 approved, because the asset's own status is stored separately from its picture. The views are correct; the asset label is stale until the view is remade or re-approved.
- Welcome-card spacing (item 3).
- The owner's own project was not opened (it is not on this PC); the case was reproduced with a project saved by the test copy.
- Only the queue's pictures are checked. A missing picture used elsewhere (a storyboard frame, a reference photo, an audio clip) is not marked.
- Installer on a clean machine; Playwright and Python suites.
