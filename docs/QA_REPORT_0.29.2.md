# QA and release gate, 0.29.2 (2026-11-14)

Run on `main` after PR #4 (level-matched audition playback), on the exact build that was released, with the owner's saved provider keys. No paid generation was needed for this gate; the free Windows voices were used for the audio check.

## Verdict
Go. Everything found was fixed before release. What is not checked is listed at the end.

## Gate results
| Check | Result |
|---|---|
| Types (`tsc`), 296 JS tests, 73 Rust tests | Pass |
| `cargo clippy --all-targets -- -D warnings` | Was failing (2 errors); fixed; clean |
| `npm audit` | 0 vulnerabilities |
| `cargo audit` | Was 7 vulnerabilities; fixed; 0 (see below) |
| `rafter secrets .` | Clean |
| `rafter run` (remote SAST and SCA) | Could not run: the plan's quota is used up |
| Risky front-end patterns (`innerHTML`, `eval`, `new Function`, `document.write`) | None |
| Review of every backend command that takes a path from the page | Two were unconfined; fixed (below) |
| Version guard, changelog, release notes | Pass |

## Found and fixed
| # | Finding | Fix |
|---|---|---|
| 1 | `tokio` 1.54.0: race condition in `tokio::time::Interval` (RUSTSEC-2026-0384) | 1.54.1 |
| 2 | `zip` 4.6.1: four advisories about extracting archives (RUSTSEC-2026-0367, 0368, 0369, 0429). The app writes and reads zip files but never calls `extract`, so it was not reachable, but the library is also the Word importer | `zip` 9.5.1 |
| 3 | `libsqlite3-sys` 0.30.1 (RUSTSEC-2026-0459), the SQLite behind the production ledger | `rusqlite` 0.42 (SQLite 0.40) |
| 4 | `lopdf` 0.36.0: stack overflow on deeply nested PDF objects (RUSTSEC-2026-0187), reachable by importing a crafted PDF | `pdf-extract` 0.12 (`lopdf` 0.42) |
| 5 | No content-security policy (`csp: null`) | Strict policy set and tested in the packaged app |
| 6 | `label_image` wrote to, and `inspect_image` read from, any path the page gave | Confined to the assets folder; a labelled image can only be a new `.png` directly in it; unit test |
| 7 | Clippy: `unknown lint chunks_exact_to_as_chunks` in `cleanrender.rs`, and a `map_or` from 0.29.1 | `allow(unknown_lints)` and `is_some_and` |

## Checked in the packaged app (release build, fresh load, console and security-policy violations recorded)
| Area | Result |
|---|---|
| Console errors and policy violations on load and through a full walk | 0 |
| Fonts (Inter), inline styles (progress ring), five workspaces | Work under the policy |
| Thumbnails of generated images (sets, props, characters) | All loaded |
| Video through the asset protocol (a 5 s, 1076 px clip) | Plays (ready state 4, no error) |
| Full-size image through the asset protocol | Loads |
| Audio: a new Windows-voice clip, level-matched player, play and stop | Works; the player's measurements matched ffmpeg's to 0.1 LU for the same files |
| Sheet export (writes a file through the backend), command palette, theme switch | Work |
| Policy probes: a remote script, an inline script, a remote image | All three blocked |
| Path checks: `label_image`, `inspect_image` and `read_audio_clip` given files outside the assets folder | All refused |
| PDF import (new `lopdf`), Word import (new `zip`), ledger write (new SQLite) | Correct text from both files; ledger row written (and removed afterwards) |
| Session safety | The test replaced the autosave; the app backed up the previous production first and it was restored afterwards |

## Not fixed, listed
- `cargo audit` maintenance warnings (not vulnerabilities) for `unsafe-libyaml` (through `serde_yaml`) and `ttf-parser` (through the PDF reader) in the Windows build. Linux-only crates in the lock file are not built on Windows.
- The remote Rafter scan could not run (quota); the local scan, both dependency audits, clippy and a hand review of every path-taking command stand in for it.

## Not checked
- fal.ai, OpenRouter, LM Studio and ComfyUI; the installers on a clean machine; Windows SmartScreen with an unsigned installer.
- Audio quality by ear. The level-matched player was verified by measurement and by behaviour, not by listening.
- Screen readers.
