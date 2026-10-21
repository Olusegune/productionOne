# Production Guy 0.5.1 acceptance matrix

| Requirement | Evidence | Status |
| --- | --- | --- |
| Release 1 shell and five workspaces | Tauri build; live visual checks | Passed |
| Script intelligence and editable inventory | `analyzeScript`, file import, `EditableInventory`, domain tests | Passed for text/Fountain sources |
| Canonical Project → Scene → Shot → Asset → Variant → Sheet → Revision graph | `synchronizeProductionGraph`, dependency and synchronization tests | Passed |
| Stable IDs, revisions and selective regeneration | graph tests; live six-dependent selective regeneration check | Passed |
| Native persistence | atomic app-data project and studio commands | Passed |
| Visual development and Style Bible | persistent Style Bible, automatic sheets and story variants | Passed |
| Provider/model registry | five-provider catalog, verified metadata dates and scored recommendations | Passed with unknown capabilities explicitly marked |
| Prompt portability | universal, compact, technical and negative modes; copy; TXT/MD/JSON/CSV/ZIP | Passed |
| Durable generation queue | persisted jobs, verified output write, pause/resume/cancel/retry | Passed |
| Image QA, labeling and external reimport | native decode/inspection, deterministic bitmap label overlay, Design import | Passed |
| Direct image generation | OpenAI adapter, secure key, per-request budget gate, authenticated mock acceptance | Contract passed; paid live call awaits user key/authorization |
| Optional storyboarding | can remain disabled or be enabled later | Passed |
| Shot editing, acting, audio and micro-animation | structured editor, source dialogue, performance/audio fields | Passed |
| Animatic preview | deterministic multi-shot timing and live playback check | Passed |
| Shot Compiler | Seedance 2.0, Kling 3.0 warning, Veo 3.1 capability-aware presets | Passed |
| Production coverage | verified-file requirement, scene readiness and continuity warnings | Passed |
| Production package | required folders, manifest, ledger, Style Bible, model usage, prompts, references, validation | Passed |
| Direct video generation | KIE task/status adapter, secure key and budget gate, authenticated mock acceptance | Contract passed; paid live call awaits user key/authorization |
| Windows installers | 0.5.1 NSIS and MSI x64 bundles; launcher PE subsystem verified as `Windows GUI` | Passed, unsigned |

## External acceptance gates

No paid request was made or simulated. A credentialed live provider acceptance requires a user-owned OpenAI or KIE key and an explicit spending ceiling. Authenticode signing requires a code-signing certificate. These are external release gates, not hidden green checks.
