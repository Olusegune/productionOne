# Skin & Surface: reconciliation and plan

ProducerOne's own workflow for photorealistic characters with believable skin. It is not attributed to any outside method. The controls state desired visual outcomes for an image model to attempt; they are not physical shader values, and nothing here promises artifact-free pictures.

## 1. What exists and will be reused

| Need | Already in the app | How it is reused |
|---|---|---|
| Identity and approved references | The approved front view per character (`anchorFor` in `generationQueue.ts`), the Identity sheet, variants filed under look names | The source of every refinement is the approved identity picture; refined pictures are filed under their own variant so the original and its approval history are never touched |
| Photorealistic styles and prompts | `StyleBible` (`family`, `name`, `rendering`), the style library ("Realistic 3D": Photoreal cinematic CG, Naturalistic digital human...), `buildViewPrompt` | `isPhotorealStyle(style)` decides whether Skin & Surface is shown prominently; the skin line is only written into prompts for photorealistic styles, so 2D and stylized 3D are never pushed toward realism |
| Generation and editing | `JobRequest` + `enqueue`, one request per view with `references`, `variation` link, `useAnchor`, cost preview, retries and remote task reconciliation in the queue | Skin refinement is a new `JobRequest` builder modelled on `ageRequests`; no new provider pipeline |
| Reference selection and limits | `modelTakesReferences(provider, model)` (true or false only) | Refinement needs a reference-taking model and says so plainly otherwise. **No per-model reference count is known**, so the first version sends exactly one identity anchor and never trims silently; a later close-up anchor is added only where a count is known |
| Age, appearance, transformation | Revisioned `age` and `transformation` records, `AgeSpec.adjustments.skin` (free text), "Age & appearance" tab | Skin & Surface sits in the same tab. Age variants derive skin targets later (milestone 4); aging is never equated with dirt or heavy wrinkles |
| Lighting and grading | `lighting.ts` (`LightingRecord`, presets, `lightingTestPrompts`), `grade.ts` looks (metadata, never baked in) | The lighting-test sheet reuses these presets and stores lighting separately from skin. No LUT is ever used to fake relighting |
| Visual QA | `visualReview.ts` categories A to K, findings with evidence, the honest four states, `CandidateVision` and closed vision probes | New skin categories join the same finding model; vision is advisory, never a pass it did not earn. Probe reliability for subtle skin detail is **not measured**; those checks start as record facts and human review |
| Revisions, approval, persistence, export | Immutable revisions, `variations` block in the project file, strict readers, package manifest, collected projects | Skin Profile is a new record kind in the same system |
| Temporary conditions | `ConditionSpec` exists but is garment-based | Skin conditions (sweat, dirt, bruising, wetness) become a separate list that never edits the approved profile; reusing the garment condition record for skin is not possible without changing its meaning, so this is a small new field, not a second approval system |

## 2. What is missing (the work)

- A **Skin Profile** record: structured attributes, presets as data, regional targets, marks with locations, makeup, protected features, provenance, QA state.
- A **protected refinement request** compiled per provider capability, an explicit Generate action, comparison view, approval as a new revision.
- **Regional controls and lighting tests.** Masks: *no adapter in the app supports masks or inpainting today.* Regional targets will therefore be wording in the request, said honestly ("this model cannot isolate a region"), and masks wait until an adapter supports editing with a mask. Mask coordinates and source revisions are designed into the record now so nothing has to change later.
- **Skin QA categories** and the age and transformation rules (a robot never fails a human-skin check; a stylized character is never pushed toward photorealism).

## 3. Schema

`skin` is a new record kind (id prefix `SKN`) in the existing `variations` block: numbered immutable revisions, approval by a person, strict reader, package manifest. Optional and additive: older projects open and save exactly as before and have none.

`SkinSpec` (revision content): `characterId`, `identity` (the approved identity picture it was made for: job id and revision), `preset` (`natural | clean-portrait | weathered | custom`), essential controls (`textureDetail`, `surfaceFinish`, `tonalVariation`, `fineFacialHair`, `retouching` as named levels; `marks` as a list), `complexion` and `undertone` (free descriptions the person writes, never derived), `regions` (forehead, cheeks, nose, eye area, lips, neck, hands: optional texture and finish targets), `makeup` (separate text), `protect` (facial structure, complexion, age, expression, hair, marks, body proportions, wardrobe, pose, background), `conditions` (temporary, separate), and later `provenance`, `references`, `qa`.

Kept apart by construction: age (age record), lighting (`LightingRecord`), grading (look records), makeup (own field), temporary conditions (own list). Complexion and ethnicity are never inputs to any surface characteristic: no field is derived from another's text, and a test checks the compiled wording.

## 4. Milestones

1. **Skin Profile record, presets, migration, basic controls.** Done in this branch: the record, the three presets plus Custom as structured data, essential controls, marks, protected features, strict reader, older-project fixtures, the Skin & Surface section in the Age & appearance tab (open by default for photorealistic styles), the skin line in prompts for photorealistic characters only. No paid request exists in this milestone.
2. **Protected refinement generation, comparison, approval, downstream use.** Explicit Generate refinement (never while dragging), provider-aware request, matching close-up comparison with synchronized zoom, approve as a new revision under its own variant, sheets from the approved skin reference. This is the first success criterion.
3. **Regional controls, marks, lighting tests.** Regional wording, marks with locations, lighting-test sheet from `lighting.ts`; masks only if an adapter supports them.
4. **Skin QA, age and transformation integration, portability, release verification.**

## 5. Verification approach (stated up front)

Deterministic and component tests for the record, presets, requests, no-paid-request-on-edit, migration and round trip. Mocked-provider contract tests for requests and retries. Real-provider runs, within the remaining budget (about $4.24 of $9.00 used), will be few and recorded with their actual outcomes. Human visual acceptance (does the skin look right, across ages, complexions, lighting, makeup, facial hair) cannot be done by code or by me: it needs your eyes, and no claim about picture quality is made without it.
