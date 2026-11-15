# QA and release gate, 0.38.1 (2026-11-15)

Run on the branch that became 0.38.1: live checks of the paid and local providers, and the one bug they found.

## Verdict
Go. What is not checked is listed at the end.

## Gate results
| Check | Result |
|---|---|
| Types: `npx tsc -b` | Pass |
| JS tests | 433 pass (5 new: status codes as providers write them) |
| Rust tests | 78 pass (unchanged) |
| `cargo clippy --all-targets -- -D warnings` | Clean |
| `npm audit`, `cargo audit` | 0 vulnerabilities |
| `rafter secrets .` | Clean |
| `rafter run` (remote SAST and SCA) | Not run: plan quota. The change is one regular expression and its tests |
| Version guard, changelog, release notes | Pass |

## Live checks (the packaged 0.38.0 build, with the owner's saved keys)
| Check | Result |
|---|---|
| Suno vocals, V6 Mini, lyrics, female voice | Two valid MP3 tracks in 32 s |
| Suno V6 | Two valid tracks in 22 s (durations 17.7 s and 12 s for a 10 s request) |
| Suno V6 Wild | Two valid tracks in 22 s |
| ElevenLabs sound effect | A valid MP3 in 2 s |
| Local Qwen voice description (`qwen2.5vl:7b`, Ollama) | Valid JSON in 11 s; it added "rough" as a timbre that the input did not give |
| ElevenLabs speech with an unknown voice | A real 404 message, used to test the failure grouping |

The audio was checked as files (MP3 headers, sizes), not by listening. Whether the vocal tracks sing the given lyrics is not verified.

## Found and fixed
| # | Finding | Fix |
|---|---|---|
| 1 | Providers write statuses as "(500 Internal Server Error)" or "answered 503 Service Unavailable"; the grouping read only "(500)", so server errors fell into "other" and ElevenLabs codes were ignored | The pattern accepts both shapes; 5 tests with the real message formats |

## Checked in the packaged app, on the owner's real project
| Area | Result |
|---|---|
| Session safety | The live checks ran in the packaged app, replacing the autosave; it was restored from the backup ("8 to review, 55 done") and the recents list put back. Test audio files were deleted |
| 0.38.1 build | Starts on the real project with the sidebar and tabs, "8 to review, 55 done", no console problems; the change has no interface, so the audit was not repeated |

## Not checked
- A real failed image generation in the project (it would change the owner's queue); real provider messages were used instead.
- Listening to the generated audio.
- The guide's sheet, voice, audition and queue pictures are older and show the previous top bar.
