# QA and release gate, 0.43.3 (2026-11-16)

Run on the branch that became 0.43.3 (missing storyboard frames, clips and reference photos are flagged). It closes the gap listed in the 0.43.2 report.

## Verdict
Go. Tested in unit and component tests and in a separate copy of the release build.

## Gate results
| Check | Result |
|---|---|
| Types: `npx tsc -b` | Pass |
| JS tests | 507 pass (6 new: clip flags, reference photos, the File missing component) |
| Rust tests | 80 pass, 1 ignored (no Rust change) |
| `cargo clippy --all-targets -- -D warnings` | Clean |
| `npm audit` | 0 vulnerabilities |
| `rafter secrets .` | Clean |
| `cargo audit`, Playwright and Python suites | Not run: no dependency, engine or interface-test change |

## What changed
- Storyboard frames are queue takes, so 0.43.1 already took them out of the queue; the Director's room card now says **Picture missing** (was "No frame") and Retry is not offered for the owner's own images.
- Audio and video clips get `missing` set when their file is gone (`flagMissingClips`); the Voice and Motion lists show **File missing** with the line or prompt and a Remove from list button (`MissingClip`). The flag clears if the file returns.
- Reference photos that are gone are taken off their lists (`dropMissingRefs`).
- The files checked now include clip paths and reference photos, and the notice names what was found.

## Test in a separate copy of the release build
A project was built with a storyboard frame, an audio clip, a video clip and a reference photo pointing at files that do not exist, and opened in the test copy. Result: the notice said "2 pictures (sheet views or storyboard frames), 2 audio or video clips, 1 reference photo"; the Direct card said Picture missing with Generate frame offered; the audio clip and the video clip each showed File missing with their text and Remove from list; 0 console errors. The test project was made by editing a saved project file, not by generating real frames or clips.

## Not checked
- Remove from list was covered by a component test, not clicked in the app.
- A clip whose file comes back (flag clearing) was tested in unit tests only.
- Other places that could hold a path: the exported package's references, the Deliver audit and the labelled sheet exports were not checked.
- The owner's own project was not opened (not on this PC).
- Welcome-card spacing from 0.43.1 is still unseen in the app.
- Installer on a clean machine; Playwright and Python suites.
