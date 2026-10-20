# CharacterForge → Production Guy migration plan

## Audit result

The supplied GitHub repository was empty on 2026-10-20: no commits, branches with content, application files, database, provider adapters, queue, or exports were available to preserve. Production Guy therefore starts as a small Release 1 foundation while retaining the complete CharacterForge requirements as its forward compatibility contract.

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

## Immediate next increment

Replace browser storage with a Tauri/SQLite repository implementing the same graph interface, then add script ingestion that produces editable scenes and asset inventory. Keep the current domain tests as contract tests for the desktop repository.
