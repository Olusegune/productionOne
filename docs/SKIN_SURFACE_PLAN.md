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

## 6. What the two prompting books added (guidance only, summarised in our own words)

The user supplied two prompting guides: a photographer-style prompt book for one image model, and a reference on describing people with ChatGPT image generation (the second was too large for the file viewer; its text was extracted and searched for skin-related passages, and read only where it mentioned skin, texture or stereotyping). Neither is about skin surface in depth, and neither is copied here. What they support:

- **One variable at a time, in a fixed order.** Both advise a repeatable sentence structure so that when a result improves or fails you know which variable did it. The skin line is already kept separate from lighting, age, makeup and conditions for the same reason, and the lighting-test sheet changes only the light.
- **Name the lighting by its setup in plain terms** (diffuse or soft, side, directional or hard, backlight or rim), with a realistic capture description. The lighting-test sheet in milestone 3 will use those names with `lighting.ts`. Both books say some models relight a photo reliably; this app will not assume that. A lighting test is a new candidate that is compared with the approved reference, never a promise of the same face under new light.
- **Describe the person explicitly instead of by nationality.** The second book notes that a bare nationality invites stereotyped features. This matches the rule already built in: complexion and undertone are only the person's own words, and nothing else is derived from them.
- **Possible experiment, not adopted yet:** a realistic capture cue (a plain camera description, restrained grain) is said to reduce the "AI look". It can also shift colour, so it will be tried as a measured A/B with a real provider in milestone 2, within the budget, and kept only if the comparison supports it.

## 7. Milestone 1 status

Done and tested (deterministic and component tests; live check in the test copy): the `skin` record, presets as data, the five essential controls, marks with locations that must stay protected, protected-feature choices, regional controls on demand (as wording), separate makeup, complexion, undertone and temporary conditions, the wording compiler, `isPhotorealStyle`, the Skin & Surface section in the Age & appearance tab (open by default only for photorealistic styles), the skin line in prompts for approved profiles on photorealistic characters only, strict reading, older-project and damaged-file tests, and the fuzz test.

Not done: any generation (no refinement request exists yet, so nothing can be spent); comparison; approval of refined pictures; downstream references; lighting tests; skin QA; age and transformation integration. The live test project's style is stylized, so the photorealistic path (section open, wording in prompts) is covered by tests, not yet seen in the running app on a photorealistic project.

## 8. Milestone 2 status: protected refinement

Done and tested (deterministic and component tests, including a queue contract test and the queue-to-record approval path; live in the test app on a realistic project):
- **Explicit Generate.** Controls and presets never start anything; only "Generate refinement" does. A preflight card says what will be made, kept, left alone, affected, started from and the cost.
- **One approved original per view, never changed.** Two requests (head and shoulders, full front), each with exactly one reference: the approved original of that view, or the approved front view as the fallback. The refinement is filed under its own look name ("<Name>, refined skin") as a new CANDIDATE revision of the profile; the approved profile and the original picture are untouched. Generated pictures are never approved automatically.
- **Provider-aware.** A model that cannot take references is refused with what to do. For models that can, the app says plainly that the model edits the whole picture and cannot be limited to one region. Only the opening sentence of the request differs by provider family (edit instruction versus "using reference image 1"); everything that says what to preserve and what to refine is identical. These wording differences are not a verified difference in results.
- **No universal "remove yellow".** A warm or golden complexion or undertone written by the person suppresses the neutral-white-balance instruction; otherwise the existing project guidance applies.
- **Missing things are named.** Not photorealistic, no approved profile, no approved picture, or a model without references each give their own plain message, and nothing starts.
- **Comparison.** Original and candidate at the same framing with synchronized zoom and pan, a before/after toggle (side by side, original only, candidate only), "Look closely at" forehead, eye area, cheeks and mouth (found from the detected head, so an aid for looking and not a measurement), and lists of what is protected and what is meant to change.
- **Identity and surface are separate decisions.** Approval needs the person to confirm identity (face, age, expression, marks). Better-looking skin alone never enables Approve. Request changes keeps the candidate in history; Turn down rejects it and the approved profile stays.
- **Cost history.** Spend is read from the queue's attempt counts; a retry adds to it and never replaces it.
- **Downstream.** An approved refinement makes its look name available in the sheet studio, whose sheets anchor on the approved front view of that look, and the skin wording is applied for the character.

Not done: the real-provider run (it spends money on the user's project; see the handoff question), masks (no adapter supports them), lighting tests, skin QA categories, age and transformation integration, and a head-and-shoulders close-up of the original when none was ever approved (the front view is used and the head is cropped for comparison).

## 9. First real-provider attempt, and what it found

The user approved one real refinement of LILA (two pictures) from the Summit Sprout project, which was open in the test window. **No pictures were made and nothing was spent.** Both requests were refused on this computer before they reached the provider: LILA's pictures live in the real app's assets folder, and the test window uses its own, so the app's file-access rule from 0.67.0 (only files in the app's own folder may be read for a provider) correctly refused them. That is the rule working, not a fault in the refinement.

What it changed in the app: the screen now says in plain words why pictures could not be made and that a request refused on this computer was not charged; the spend line counts such refusals separately and leaves them out of the dollar estimate, so a refusal can no longer look like spend.

Why the run was not repeated on a stand-in character: the request has the same shape as the age studio's, which has run against the provider before, so a second run would only test the provider's picture quality on a stylized test character, which says nothing about realistic skin. The meaningful run is on a realistic character in the installed app (its own folder holds the pictures) and judging the result needs a person.
