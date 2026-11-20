# Spatial records, visual review and corrections (Phase 3)

## Scene state (world space) and the camera (screen space)

`studio.sceneStates[sceneId]` holds, per scene:

- `world`: the things in the scene (characters, furniture, props, landmarks) with stable asset ids, a top-down position in metres, a facing direction, a posture, who is sitting on what (`occupies`), who owns what (`ownedBy`), permitted interactions, a scale and a zone (foreground, midground, background);
- `changes`: **intentional** changes between shots (a shot id, a thing, what changes, and a required reason);
- `cameras`: one camera per shot id (position, facing, horizontal field of view).

World space and screen space are kept apart. **Screen space is derived, never stored**: `screenPlacement(world, camera, thingId)` says where a thing lands left to right and near to far for one camera. `setShotCamera` changes only that shot's camera; the world object is returned untouched. A camera change therefore cannot change chair ownership, where a character is or how the furniture is laid out (tested). Moving a thing between shots is an explicit change with a reason; the world at a shot is the starting layout plus the changes made at or before that shot.

The **Blocking map** (Direct, shot editor) is a simple top-down map: add the people and props of the shot, add a chair, drag or use the arrow keys (shift for a metre), seat a character, assign a chair to someone, place the camera and turn it, and record a deliberate move from this shot on. There is no 3D editor.

World problems found from the layout alone: two people on one chair, someone in a chair assigned to another, a seated character with no chair, a chair that is not where its sitter is.

## Visual review

Deterministic checks (rules over the project's own records) and vision-model findings are **stored in separate lists** (`studio.reviews.deterministic` and `.vision`), never mixed.

Categories: **A** identity, **B** proportions and silhouette, **C** costume continuity, **D** set landmarks, **E** placement and chair assignment, **F** scale and fit, **G** hands and anatomy, **H** intersections and ground contact, **I** art-style adherence, **J** lighting and colour continuity.

| Checked by | Categories | How |
|---|---|---|
| Rules over records (free, instant, local) | B, E, F, I | B: the output's recorded proportion profile against the character's current one. I: the style fingerprint asked for against the current one. E: world problems at that shot, and drift between consecutive shots that no recorded change explains. F: an approved seat-height rule against the furniture in the layout (skipped when the rule is intentionally cramped or oversized, or not approved). |
| A vision model on this computer (opt-in, Ollama or LM Studio) | A, B, C, G, H, J | The model is shown the output and up to two references with the rules; it must answer in strict JSON. Anything else is "unable to assess". |
| Nobody yet | D | Needs set landmarks the app does not record. |

**Each finding records:** the asset or shot id, the output revision (job id and revision), category, severity, confidence, the image region where the checker could say, the expected condition, the observed concern, the source rule, a suggested action, whether it is deterministic or from a vision model, and its status (open, accepted, dismissed, intentional exception, corrected).

**Output status:** *Passed* (at least one category was checked and nothing open remains; the categories checked are always named), *Needs review*, *Not checked* (the default; never shown as clean) and *Unable to assess* (a vision model could not tell, failed or answered badly).

**Intentional exaggeration is not a defect.** A finding about a control the character has marked as an intentional exception is set aside with a visible reason, not deleted, and can be reopened. The vision prompt tells the model not to report deliberate exaggeration and to consider occlusion, foreshortening and perspective before reporting a proportion mismatch.

**Vision accuracy is not claimed.** The tests use a mock provider and prove how answers are read, bounded and stored. How well a given model spots real problems needs an evaluation against human-labelled pictures, which has not been done.

## Corrections

Per finding: *View evidence*, *Accept*, *Dismiss*, *Mark intentional* (this also adds the exception to the character's profile), *Regenerate this view with a fix*, and a before/after comparison of the corrected revision.

- **Targeted edit** (inpainting) is offered only where the provider supports it **and** the finding has a region. No adapter in this app supports it today, so a correction regenerates that one view with its references and says so; the new picture may differ elsewhere, so it is compared before approval.
- A correction is a **new revision** of that view only (it never replaces an earlier one), records `correctionOf` (finding id, source job, source revision) in its provenance, is checked again by "Run checks" and **waits for your approval**. Nothing is approved automatically.
- **Bounded:** at most 3 attempts and $1.00 per finding (`defaultLimits`). Past a limit the app stops and explains why. Unaffected views and assets are never regenerated.
