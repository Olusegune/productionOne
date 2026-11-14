# QA report — 0.16.0

| Check | Result |
|---|---|
| `npm test` | 30 files, 159 tests passed |
| `cargo test --lib` | 56 passed, 1 ignored (includes new voice module tests) |
| `npm run build` | passed |
| `npm run qa:accessibility` | static gate passed, 32 TSX files |
| Installers built | NSIS, MSI, portable EXE, portable ZIP |
| Installed and launched on a PC | NOT done (no approved screen control) |
| Live video generation (KIE) | NOT run; no credit spent |
| Windows voice playback | NOT run end to end; PowerShell/System.Speech call is untested outside unit tests of its parsing and validation |
| Visual/responsive check | NOT run |

## Known risks
- `speak_local` depends on System.Speech voices being installed; if none, the panel says so.
- Audio clip files live in the app assets folder; clips from older projects have no `kind` and are treated as video.
- Sound for props is a brief only; no sound generation exists.
- A previous 0.15.0 installer run was left open on the PC and may need closing.
