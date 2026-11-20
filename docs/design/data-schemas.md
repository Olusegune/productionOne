# Architecture and data schemas (0.52)

Production One prepares characters, props, sets, environments, reference sheets and storyboards for filmmaking applications. It does not assemble or render films. Everything below is **optional**: a project that uses none of it opens and renders exactly as before.

## Where the records live

All new records are optional fields of `StudioState` (`src/data/projectStore.ts`), saved inside the `.pone` project file (format `production-one-project`, **version 1, unchanged**). Adding an optional field needs no version bump: an older file simply lacks it. A file from a newer app (`version` above 1) is refused with a message.

| Field | Type | Module | Doc |
|---|---|---|---|
| `proportions[assetId]` | `ProportionProfile` v1 | `domain/proportions.ts` | `proportions.md` |
| `world` | `WorldRules` | `domain/worldRules.ts` | below |
| `fitRules[assetId]` | `FitRule[]` | `domain/fit.ts` | `character-layers-and-fit.md` |
| `shots[].camera` | `CameraDirection` | `domain/camera.ts` | `camera-lighting.md` |
| `shots[].lightingRecord` | `LightingRecord` | `domain/lighting.ts` | `camera-lighting.md` |
| `sceneStates[sceneId]` | `SceneState` | `domain/sceneState.ts` | `spatial-and-review.md` |
| `reviews` | `Reviews` (deterministic, vision, checked) | `domain/visualReview.ts` | `spatial-and-review.md` |
| `corrections[findingId]` | `CorrectionLedger` | `domain/correction.ts` | `spatial-and-review.md` |
| `looks` | `LookState` | `domain/grade.ts` | `grading-and-looks.md` |
| `queue.jobs[].provenance` | `Provenance` | `domain/characterLayers.ts` | `character-layers-and-fit.md` |

Every record has a **reader** (`readProfiles`, `readFitRules`, `readSceneStates`, `readReviews`, `readLedgers`, `readLooks`, `readWorld`, `normalizeShots`) that never throws: missing fields take the documented defaults, numbers are clamped to their ranges, unknown values are dropped, and anything that could hide something (an unknown finding status, an unknown fit-rule status) becomes the safe value (`open`, `proposed`). Tests feed every reader nothing, junk and half-records.

## World rules

```
world { profile?: { preset, stylization }, scaleConvention: "metres", notes? }
```

The starting point new characters begin from (set with "Use as the world default" in the proportions panel) and the one scale convention. **Inheritance is project to character only**: a character's profile is the world default plus that character's own changes, which are exactly its `override` controls (`deltasOf`). There is no group field and no group behaviour.

## Flow of a picture request

```
character (identity) ──┐
proportion profile ────┼─► prompt words ─► queue job ─► provider ─► output file
style (project/asset) ─┘        │              │
camera + lighting (shots)       │              └─► provenance { profile copy, fingerprint, references, correctionOf? }
fit rules (approved only) ──────┘
```

- **Prompts**: `buildViewPrompt` (sheets), `buildShotPrompt` (frames), `autopilot.ts` (Assistant). Proportion wording is added only where a profile differs from Natural.
- **Queue**: `generationQueue.ts`. Every regenerate is a new revision; nothing overwrites an earlier picture or an approval. Approval is only ever a person pressing a button (`approve`).
- **Review**: `visualReview.ts` reads the queue's provenance and the other records and writes findings; `correction.ts` queues a correction as a new revision.
- **Grading**: `grade.ts` is a pure function over original pixels; looks are metadata.

## Package export

`export_production_package` (Rust) writes the existing package plus `Project Bible/design_records.json` (`production-one-design-records` v1, built by `domain/exportRecords.ts`): proportions with fingerprints, world rules, fit rules, scale convention, scene states, camera and lighting per shot, looks metadata (`bakedIntoOriginals: false`, `lut: null`), review findings with exceptions and correction ledgers, and the approved revisions with their references and source corrections. File **names** only: no folder from this machine is written.

**Refused exports.** Before anything is written, both the app (`domain/exportSafety.ts`) and the package writer (Rust `unsafe_export_file`, `unsafe_export_text`) refuse a package that would include an environment file, SSH key, key or certificate file, credentials file, machine-specific model file (`.safetensors`, `.ckpt`, `.gguf`, ...), a file under a local ComfyUI or Ollama install, or text that holds an API key, bearer token or private key. The message names the file and the reason and never echoes the secret.

Nothing is exported in any other program's import format: no downstream contract is claimed, and no endpoint is invented.

## Persistence limits

Records are saved with the project (autosave and Save). Review results, findings and ledgers are saved too, so a reopened project shows the same statuses. Output pictures are referenced by path; "Collect project" (`collectPlan`) gathers them into `media/` for a portable copy.
