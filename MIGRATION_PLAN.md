# CharacterForge → Production Guy migration plan

## Audit result

The supplied GitHub repository was empty on 2026-10-20: no commits, branches with content, application files, database, provider adapters, queue, or exports were available to preserve. Production Guy therefore started from a clean foundation while retaining the complete CharacterForge requirements as its forward compatibility contract. The repository now contains the connected 0.4 Windows implementation; the ledger below distinguishes working features from deeper roadmap work.

## Preservation map

| CharacterForge capability | Production Guy destination | Sequence |
| --- | --- | --- |
| Project creation and persistence | Projects + versioned project store | R1 |
| Script analysis and asset extraction | Story + graph ingestion | R1 |
| Character, costume, set, prop and environment sheets | Design departments on shared asset nodes | R2 |
| Style Bible and custom styles | Design / Art Direction | R2 |
| Provider adapters and model registry | Global services, outside primary navigation | R2 |
| Prompt compiler and external reimport | Design + Deliver | R2 |
| Durable generation queues, labeling and QA | Deliver | R2 |
| Optional storyboards, acting, audio and animatics | Direct | R3 |
| Video-model Shot Compiler and packages | Deliver | R4 |

## Canonical data migration contract

All imported or newly extracted records receive stable IDs. Legacy entities map into `asset` nodes, story-specific ages/costumes/conditions into `storyVariant`, requested outputs into `sheet`, and files into immutable `revision` records. Scenes and shots point to exact variants rather than display names. Edges drive impact analysis: modifying an upstream node marks only its downstream outputs stale; approved creative decisions are never overwritten automatically.

## Current implementation ledger

| Area | State | Evidence |
| --- | --- | --- |
| Windows shell, five workspaces, branding | Tested | Tauri production build; visual browser checks |
| Script scenes, dialogue provenance and inventory | Tested | `productionStudio.test.ts` |
| Canonical graph, revisions and impact discovery | Tested | `productionGraph.test.ts` |
| Native project/studio persistence | Tested | Tauri commands plus restart-safe app-data files |
| Prompt modes and external workflow queue | Working | Domain compiler, persisted studio jobs, Design UI |
| Native external-image import, QA and labels | Working | Rust decoding/inspection/label commands and Design UI |
| Optional storyboard direction and animatic | Tested | Multi-shot editor, reorder/duplicate/delete, timed playback tests and visual check |
| Video-model Shot Compiler and packages | Tested | Seedance/Veo verified presets, Kling warning, ZIP exporter |
| Direct KIE/Seedance adapter | Contract-tested | Authenticated local HTTP acceptance test; paid live call awaits user credential/budget |
| Code signing | Blocked externally | Signing certificate not supplied |

## Highest-priority remaining work

Expand Release 2 from the present connected workflow into the complete CharacterForge visual-development specification: persistent Style Bible and reference boards; sheet matrices and variants; richer provider/model metadata and recommendations; durable pause/resume/cancel/retry with cost accounting; prompt copy/TXT/Markdown/CSV/ZIP exports; gallery review; and validated full production folder structure. SQLite remains an optional migration when concurrent querying or multi-project scale requires it—the current native atomic JSON repository already supplies reliable Windows persistence without introducing an unused service tier.
