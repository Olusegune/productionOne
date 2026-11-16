# QA and release gate, 0.43.0 (2026-11-16)

Run on the branch that became 0.43.0 (pictures travel with the project).

## Verdict
Go. The change is small and was exercised in a real test copy of the release build. What is not checked is at the end.

## Gate results
| Check | Result |
|---|---|
| Types: `npx tsc -b` | Pass |
| JS tests | 493 pass (no JS change in this release) |
| Rust tests | 79 pass, 1 ignored (1 new: bundling and relinking) |
| `cargo clippy --all-targets -- -D warnings` | Clean |
| `npm audit` | 0 vulnerabilities |
| `cargo audit` | No vulnerabilities; the same 9 unmaintained-crate warnings as before |
| `rafter secrets .` | Clean |
| Python and Playwright suites | Not run: no engine or interface change in this release |
| Version guard, changelog, release notes | Present; versions bumped in the six files |

## What changed
- `src-tauri/src/desktop.rs`: Save and Save As copy every picture, sound and clip the project uses (only files from the app's own assets folder) into `<name>_files` next to the project. Open looks for any missing file there, copies it back into the app's assets folder and points the project at the copy.
- `src-tauri/src/providers.rs`: a missing reference picture now gives a message naming the picture and what to do, instead of the raw "os error 3".

## Test in a separate copy of the release build (own identifier and data folder, fresh)
1. Pasted the sample script, analyzed, added a picture as Venomspur's front view with the app's own picker (a brand image from this repository, not the owner's art): stored in the app's assets folder.
2. **Save** wrote `film.pone` and `film_files/app-icon-source_yours.webp`.
3. Stopped the copy, deleted its assets folder and its saved state, copied `film.pone` and `film_files` to another folder, started the copy again and used **Open…** on the moved project: the file reappeared in the assets folder and the front view showed "Completed, Approved" with the picture.
4. 0 console errors in the save run.

The unit test covers the same round trip with two different assets folders (as between two computers), that files outside the assets folder are not copied, that existing paths are left alone and that a project with no `_files` folder is untouched.

## Not checked
- **The original failure was not reproduced.** The cause of the "os error 3" in the owner's project is inferred (a project opened where its pictures did not exist), not confirmed. Whether this release fixes that exact project depends on whether its pictures still exist anywhere.
- A project saved by an older version has no `_files` folder; opening it elsewhere still shows missing pictures until it is opened on the computer that has them and saved again.
- Autosave does not copy files; only an explicit Save does.
- Very large projects: copying many large clips on Save was not timed.
- Playwright end-to-end suite and Python engine tests were not run (no related change).
- The installer on a clean machine, and the packaged installer (as opposed to the identical release binary run as a test copy).
- Paid providers were not used in this release's test.
