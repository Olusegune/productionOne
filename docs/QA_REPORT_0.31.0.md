# QA and release gate, 0.31.0 (2026-11-14)

Run on `main` after PR #8 (music with Suno), on the release build, with the owner's saved Kie key.

## Verdict
Go. One hardening fix was made during review (downloads are now streamed with a hard size cap instead of read whole before the check). What is not checked is listed at the end.

## Gate results
| Check | Result |
|---|---|
| Types (`tsc`), 318 JS tests, 78 Rust tests | Pass |
| `cargo clippy --all-targets -- -D warnings` | Clean |
| `npm audit`, `cargo audit` | 0 vulnerabilities (maintenance warnings only) |
| `rafter secrets .` | Clean |
| `rafter run` (remote SAST and SCA) | Not run: plan quota |
| Secure-design walk and code review of `suno.rs` | Done; see below |
| Version guard, changelog, release notes | Pass |

## Review of the new backend command (`make_music`)
| Question | Answer |
|---|---|
| Where do addresses come from? | Fixed Kie addresses in the code; the page supplies text and allow-listed options only |
| Can the page choose a file name or path? | No: names are sanitised and files go under the assets folder |
| What can the service make the app download? | Public https hosts only, redirects re-checked (max 3), streamed with an 80 MB cap, kept only if it sniffs as audio |
| Where is the key? | Windows Credential Manager, never returned to the page |
| What does the local AI helper's output do? | Fills editable text boxes only; no actions |
| Known limit | The host check reads the address text and does not resolve DNS; the address comes from Kie's own response |

## Checked live and in the packaged app
| Area | Result |
|---|---|
| One instrumental V6 Mini request | Two valid 48 kHz stereo mp3 tracks of 10.4 s and 10.0 s in 22 s; test files deleted |
| Music panel in the packaged app | Renders for a character with its scenes, Make music disabled until a title and style are set; no console errors |
| Session safety | The test replaced the autosave; restored from the backup ("8 to review, 55 done"), recents list restored |

## Not checked
- Vocal tracks and the V6 and V6 Wild models; Kie.ai failure and out-of-credit behaviour beyond the unit-tested parsing.
- The installers on a clean machine; SmartScreen for an unsigned installer; audio quality by ear; screen readers.
