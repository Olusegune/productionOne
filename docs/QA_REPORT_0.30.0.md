# QA and release gate, 0.30.0 (2026-11-14)

Run on the release build of `main` plus the version bump, with the owner's saved provider keys.

## Verdict
Go. Nothing was found that needed a fix. What is not checked is listed at the end.

## Gate results
| Check | Result |
|---|---|
| Types (`tsc`), 308 JS tests, 74 Rust tests | Pass |
| `cargo clippy --all-targets -- -D warnings` | Clean |
| `npm audit` | 0 vulnerabilities |
| `cargo audit` | 0 vulnerabilities (maintenance, unsound and yanked warnings only, none new from this release's code) |
| `rafter secrets .` | Clean |
| `rafter run` (remote SAST and SCA) | Not run: the plan's quota was used up at 0.29.2 and has not been confirmed back. This release adds no backend command that takes a path, no new network endpoint and no new dependency |
| Version guard, changelog, release notes | Pass |

## Checked in the packaged app (release build)
| Area | Result |
|---|---|
| Fresh load: console errors and security-policy violations | 0 |
| Recent projects | Shows file names only; a close button on each of 5 entries and "Clear list"; closing one removed it from the list and from `recent-projects.json` and left the project file on disk |
| Voice tools (Design, MARA, Qwen TTS engine) | "Fill from the script" refused to invent a description for a character with no stated fields and said what was missing; "Ask the AI helper" (local qwen2.5vl:7b through Ollama) wrote a usable description from a typed idea |
| ElevenLabs Voice Design (earlier the same day, backend of 0.29.2, same command) | 3 valid previews of 9.4 to 11.3 s; none saved to the account |
| Session safety | The test replaced the autosave; it was restored from the backup ("8 to review, 55 done"), the recents list and the voice-engine setting were put back |

## Not checked
- Qwen description-as-voice against a real server; ElevenLabs sound effects; the AI helper's output through ElevenLabs end to end in the window (the two halves were checked separately).
- The installers on a clean machine; Windows SmartScreen for an unsigned installer.
- Audio quality by ear; screen readers.
