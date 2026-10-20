# Production Guy 0.4.0

Production Guy now ships the connected four-release production workflow: persistent project/script intelligence, canonical production graph and asset inventory; visual-development prompts, queues, native image QA and deterministic labeling; optional shot direction, acting/audio metadata and animatic timing; and model-aware Seedance/Kling/Veo packaging with ZIP delivery.

Direct KIE/Seedance task submission is implemented and contract-tested. It remains deliberately gated behind a Windows Credential Manager key, Seedance 2.0 selection, an explicit per-task spending ceiling, and a one-task authorization checkbox. No paid task was submitted during this release build.

## Verification

- 13 frontend/domain tests passed.
- 5 Rust/native tests passed, including a local authenticated KIE request-contract test.
- TypeScript and Vite production build passed.
- Windows x64 NSIS and MSI bundles completed successfully.
- Provider and delivery controls were visually checked in the running application.

## Windows artifacts

- `Production-Guy-0.4.0-Windows-Setup.exe` — SHA-256 `E9B37CA3A27A09202576F4B28C81BF12D84299754906671A3C4F2ECD22EC7815`
- `Production-Guy-0.4.0-Windows-x64.msi` — SHA-256 `D3DA5D397D40979B2A196BC8A6F0073F857E0875C7B5B0D6BF5ED2EF7780F703`

The installers are currently unsigned, so Windows can display an unknown-publisher warning.
