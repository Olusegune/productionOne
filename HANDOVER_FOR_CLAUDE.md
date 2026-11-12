# Production One handover

## Current state

Current release: 0.16.0. 0.16.0 adds Motion and Voice auditions (src/components/MotionDemo.tsx, VoiceAudition.tsx, src/domain/voiceAudition.ts, src-tauri/src/voice.rs using Windows System.Speech), per-asset-type motion presets, and threads confirmed identity fields (identityFacts in sheetSpecs.ts) into image and motion prompts. Audio clips reuse DemoClip with kind: 'audio'. NOT yet verified live: video generation, voice playback, on-screen layout. Earlier: 0.15.0 Character Bible progress/explainable parsing. 0.15.0 adds queue-derived Character Bible progress (src/domain/characterBible.ts), an ARIA tablist with keyboard navigation, gated Motion/Voice sections, and an explainable script reading (src/engine/explain.ts, "How this was read" in ReadingPanel). Earlier: 0.14.10 calm studio UI/UX pass. This release adds the calm studio UI/UX pass: reduced navigation and surface density, clearer primary actions, compact design rails, responsive collapse behavior, and horizontally scrollable section tabs. It also includes the Character Bible with linked Identity, Turnaround, Poses, Expressions, Wardrobe, Details, Motion video, and Voice sections, plus the Asset Lab Golden Path with Identity, Motion, Interaction, Sound, and Continuity modes.

Production One is a Tauri 2 + React + TypeScript + Rust desktop asset-preparation studio. It analyzes scripts, plans references, queues image work, supports technical/creative review, and exports production packages. It does not render finished films.

## This pass

- Preserved cumulative submission attempts across retry and provider/model reassignment.
- Added durable attempt metadata: attempt ID, submission state, receipt time, recovery note.
- Restart recovery now exposes ambiguous provider outcomes instead of blindly resubmitting potentially paid work.
- Added explicit draft/verified package export modes.
- Verified exports reject incomplete manifests and missing references.
- Draft packages include an incomplete-reference report.
- Package writes use a temporary file and refuse silent overwrite.
- Removed the hardcoded `The-Last-Horizon` export filename.
- Added frontend and Rust regression coverage.
- Added a SQLite WAL event ledger with durable submission-intent and ambiguous-outcome event support.
- Added portable package contract validation for schema, relative paths, hashes, sizes, approval, and stale state.
- Added deterministic acceptance-project tests, collect/relink tests, review-history snapshots, and a CI quality workflow.
- Added a static accessibility release gate and release-manifest signing script requiring an externally managed private key.
- Expanded the Delivery Center readiness summary with review and recorded-spend indicators.

## Validation completed (0.15.0)

- `npm test`: 150 passed. `npm run build` and `npm run qa:accessibility` passed. See docs/QA_REPORT_0.15.0.md.

## Next steps recommended after 0.15.0

- Real Motion-video and Voice panels (currently guidance only; Motion test generation is not wired to a Character Bible section).
- Responsive/visual QA at 1024px and below needs a WebView2 run; only the static a11y gate and unit tests were run.
- Expose explainStory confidence as editable asset confirmation before generation.
- Reduce App.tsx (~1860 lines) into feature modules.

## Older validation (0.14.x)

- `npm test`: 138 tests passed.
- `npm run build`: passed.
- `cargo test --manifest-path src-tauri/Cargo.toml`: 53 passed, 1 ignored.
- `npm run qa:accessibility`: passed.
- `npm run desktop:build`: passed again after the SQLite release changes.

## Desktop release artifacts

- `ProductionOne-0.14.0-portable.exe`
- `ProductionOne-0.14.0-portable.zip`
- `ProductionOne-0.14.0-setup.exe`
- `ProductionOne-0.14.0.msi`
- `ProductionOne-0.14.0-SHA256.csv`

These were copied to the Windows Desktop. The installer is not code-signed.

## Important limitations

- Provider task reconciliation is not yet implemented for every provider. Ambiguous jobs are surfaced for human reconciliation.
- The SQLite ledger command is available in the native layer; wiring every provider adapter to emit receipt/reconciliation events is the next integration step.
- The deterministic acceptance fixture and CI workflow are present; a full packaged-app acceptance runner still requires a Windows WebView2 runner.
- Model discovery is evidence-aware in parts of the codebase but does not provide universal live verification.

## Recommended next engineering slice

1. Add a versioned SQLite submission ledger with project ID, job ID, attempt ID, provider task ID, request fingerprint, intent event, receipt event, completion event, and reconciliation status.
2. Add provider adapters with idempotency/reconciliation capabilities declared explicitly per provider.
3. Build the deterministic acceptance project and run it in CI.
4. Make approval and stale dependency checks first-class package validation inputs.
5. Add contract-test consumers for FilmCrafter, Pulseframe, and Greenroom only where real contracts are available.

## Professionalization ideas

- Immutable event history and signed delivery manifests.
- Review gates with named approvers, timestamps, and exact revision/dependency snapshots.
- Project collect/relink with path portability tests.
- Provider capability evidence with verification dates and schema fingerprints.
- Accessibility and keyboard-navigation audit as release criteria.
- Crash/restart fault injection in CI.
- Export reproducibility checks and content-addressed media storage.
- Human-readable production codes separated from immutable IDs.

## Release honesty

Do not claim guaranteed identity consistency, artifact-free images, universal model support, exactly-once paid execution, or Hollywood-standard output. Those require provider capabilities and human review that are not universally available.


## 0.17.0 voice engines
- `src/domain/voiceDirection.ts`: provider registry (windows, chatterbox, qwen-tts, speech-server), `buildPerformance` (applied vs notApplied), `performanceBrief`.
- `src-tauri/src/voice.rs`: `speak_http` (local/private addresses only via `local::normalize_base`; `audio_extension` rejects non-audio).
- UI: `VoiceAudition.tsx`. All HTTP providers are `verified: false` until run against a live server. Next: live test, then Kie/other providers once docs are available.


## 0.17.1
- Wazobia provider in `voiceDirection.ts`; `tools/wazobia_server.py` follows the HF model card (`WazobiaVoiceMultilingualTTS.generate`). Unrun. `speak_http` takes `extra` (whitelisted by `merge_extra`).
