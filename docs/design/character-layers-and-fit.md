# Character layers, propagation, fit rules and redesign (Phase 2)

## Three layers

A character is three related records, joined by the character's id:

| Layer | Holds | Where |
|---|---|---|
| Identity | face, age, hair, distinguishing features, costume, approved characteristics (name, age, gender, role, "never drift", description, approval status) | the character record (`ExtractedAsset`) |
| Proportion and shape | the target proportion profile (Phase 1) | `studio.proportions[assetId]` |
| Rendering style | the art style: the project's, or an override on this character | `StyleBible` (project) or `asset.style` |

Changing one layer never rewrites another: a new style does not reset anatomy, and new proportions do not replace identity (`src/domain/characterLayers.ts`, tested). An intentionally large eye or a long arm is a valid design and is never corrected toward a human baseline: overrides survive stylization and preset changes, exceptions hide warnings, and the fit rules use the character's own numbers.

## Where the proportions travel

The target proportions are written into the picture request as plain words, **only where they differ from Natural** (`proportions.describe`), for every kind of output:

- identity sheets, turnarounds, expression sheets, pose sheets, costume ("Wardrobe") sheets and detail views (every character sheet view goes through `buildViewPrompt`);
- the Assistant's concepts and sheets (`autopilot.ts`);
- storyboard frames, for each character in the frame (`buildShotPrompt`).

A character with no profile gets exactly the prompts it always did (a golden test over a saved 0.51.2 project proves it). Props and places never get a character proportion line.

## What each output records

Every queued picture carries `provenance`: a copy of the exact proportion profile used and its content fingerprint (`pp1-xxxxxxxx`), and the reference pictures sent with it (path, and job and revision when known). Editing the profile later cannot change that record. If an **approved** view was made with an earlier version of the proportions, the panel says how many, and leaves them as they are: nothing is regenerated or re-approved for you.

## Reviewing views

Each view is a separate job with its own approval. Approving one view does not approve the others (tested at the queue level).

## Redesigning an imported character

1. The original picture is **never changed or replaced**; it is attached as the reference for a new candidate.
2. Landmark positions are **estimates** (the app cannot see the picture): each is marked "estimated, uncertain" until a person confirms it.
3. A stretched preview is optional and always labelled: "Preview only: the picture is stretched to show the change. It is not a redesign and is never saved as one."
4. The real redesign is a newly generated **candidate** ("redraw, do not stretch"), shown beside the original.
5. **Approve as a new revision** is a button press; it approves that candidate only. A new candidate is a new revision.

## Fit rules for sets and props

From a character's profile and a height in metres you set (default 1.75 m, shown as an assumption), the app **proposes** rules in three kinds, kept apart:

- **Functional fit**: chair seat height, desk height, doorway height and width, headroom with a helmet, standing reach, step height, handle thickness.
- **Spatial layout**: clear space for the arms.
- **Visual language**: sharp or soft furniture for an angular or rounded character.

Every rule starts as `proposed`. Approve, reject, or mark it **intentionally cramped or oversized** (a deliberate tight or huge space stays possible). Only approved "fit" rules are written into set or prop wording; proposed, rejected and intentional ones are not. A decided rule is never replaced by a newer proposal: it only notes "the proportions now suggest N m".

All numbers are **illustrative**: they come from the profile, not from measured geometry. Formulas (head height `h = height / heightInHeads`): seat = lower leg; desk = lower leg + 0.28 torso; doorway = height + 0.15 m; doorway width = shoulders + 0.3 m; headroom = height + 0.5 h; reach = leg + torso + arm; step = 0.45 lower leg; handle = 0.22 hand length.

## Scale and Fit reference sheet

A lineup, a doorway, a chair, a desk, a step and a handheld prop, all in **one convention**: metres, one ground line, one scale. Sizes are labelled **illustrative** unless a measured value is supplied for that item, in which case it is labelled **verified**. The sheet is made by one explicit button press (one image request).
