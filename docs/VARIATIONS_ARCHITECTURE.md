# Variations: architecture and schema notes (Milestone 1, foundations)

Status: foundations only. There is no new screen yet. This milestone adds the records, the rules for how they change, the dependency checks, the reading of older projects and the shared candidate workflow that the wardrobe, age, transformation and looks studios will use.

## What already existed, and what this builds on

| Existing | How it is reused |
|---|---|
| Costume is an asset type with a Wardrobe sheet | Each costume asset becomes a derived garment (read only) |
| Characters are separate layers: identity, proportions, style (`characterLayers.ts`) | Variation records are more layers related by character id. None rewrites identity or style |
| Generation jobs carry a `variant` name ("Canonical", an age, a costume change) and revisions | Looks keep that name as `queueVariant`, so existing pictures and the queue keep working |
| Shots pick a look by variant name (`ShotRecord.looks`) | Unchanged for now; looks assigned to scenes arrive in Milestone 3 |
| Projects add optional fields to `StudioState` and stay at file version 1 | `variations` is an optional field. No file version change, so older app builds still open the file |
| Colour grades are called "looks" in the app (`StudioState.looks`) | The new concept is `ProductionLook` in code. The screen label is to be decided in Milestone 6 |

## Records

All six are an `Entity` with a stable id (`GAR-001`, `FIT-001`, `CND-001`, `AGE-001`, `TRN-001`, `LOOK-001`) and numbered `Revision`s.

- **Garment**: the design (description, category, pieces, details). Not tied to a character and not tied to an art style.
- **Fit**: a garment revision on one character (optionally for an age or transformation revision). The same garment has a separate fit per person.
- **Condition**: wear, damage, dirt, wetness or repair derived from a garment revision, with regions (component, wearer's side, view, anchor picture revision, severity, description). `from` points at the condition it continues, which is how histories branch.
- **Age variant**: `same-person` or `redesign`. A relative is a separate character, not an age variant.
- **Transformation**: stage, kind, intensity, anchors that stay recognisable, expected anatomy, and the stage it continues from.
- **Production look**: pinned revisions for age, transformation, fit, condition and accessories, plus style fingerprint and scene ids.

## Rules

- A revision's spec is written once. Editing means adding a revision (`addRevision`). Earlier revisions are never changed.
- A revision starts as a candidate and is decided once: approved or rejected. An approved revision cannot be turned down or reopened, and its pictures are closed. To change it, add a new revision.
- References always name a revision (`{ id, revision }`), never a name or "the newest".
- Ids are never reused (a counter per prefix).
- Every function returns a new state and never edits the one it was given. Specs are copied on the way in.

## Staleness

A pinned revision is stale when something it was made from has a newer approved revision, is missing, is not approved, is the wrong kind of record, or is itself stale (checked through the whole chain, with a loop guard). Nothing is changed by this: a stale look still points at the revisions it was approved with, and unrelated approvals are untouched. Candidates are not reported, because nothing has relied on them yet.

`dependentsOf` lists everything downstream of a revision. `validateVariations` checks the records: duplicate ids, revision numbering, references that do not exist or are the wrong kind, and a look that uses another character's records.

## Older projects (the "migration")

There is no file rewrite. A project without `variations` opens exactly as before, and saving it again writes exactly what it read (tested against a fixture). `variationsOf(studio)` returns the saved records, or derives them:

- one garment per costume asset: its description, approved pictures and approval;
- one look per character per variant name the generation queue already uses, approved only where a picture was approved.

Derived ids are stable (`GAR-L-<asset id>`, `LOOK-L-<character id>-<variant>`), so the same project always produces the same records. Derived revisions carry a `legacy` marker so they can be approved without a new picture. When a person first makes something new, the full set is saved under `variations` and that saved copy is used from then on.

Fixtures: `fixtures/legacy/project-0.65.1-variants.pone` (costume asset, base, an approved age variant, an unapproved costume-change variant) and the existing `project-0.51.2.pone`. Both are read by `src/data/variationFixture.test.ts`.

## Candidate workflow (shared by every studio)

Configure, preview, compare, approve, then sheets (`candidateFlow.ts`). `standingOf` says where a revision is and what to do next; approval needs a picture to look at (except carried-over records). Settings being adjusted live in a local `Draft`: moving a slider changes only the draft. Nothing is saved and nothing is requested until `commitDraft` makes a candidate, and even that does not start generation. `estimateCost` uses only the price the person entered.

## Not done in this milestone

- No screens, no generation, no provider calls. Nothing here has been exercised against a real provider.
- Generation jobs do not yet carry variation revision ids, and the export manifest does not list them (Milestone 2 starts writing them; Milestone 6 finishes the manifest).
- `collectProject` does not yet gather variation media. No screen can create variation media yet, so nothing is lost today; this must be done before Milestone 2 ships.
- Conflict detection beyond staleness (clothing intersecting new anatomy, mutually exclusive accessories) is Milestone 6.
- Scene assignments exist as a field on a look but are not wired to the scene or continuity model (Milestone 3).


# Milestone 2: wardrobe design and fitting

Status: the Wardrobe tab (Design, for a character) lets you design a garment, preview it as clothing only, approve it, fit it to a character, approve the outfit and open that outfit's sheets.

## How it reuses what exists

- **A garment is a real costume asset** (`COSTUME-GAR-001`) plus a garment record. Its pictures are ordinary queue jobs, so Review, the queue strip, missing-file relinking and export all work on them. Its previews are filed under the variant name `GAR-001 r1`.
- **An outfit is a look of the character**, filed in the queue under the variant name `MARA in Field jacket`. That is the mechanism the Look list already uses, so the existing Wardrobe sheet (costume front, side, rear, fabric) is made for the outfit from the Sheets tab, anchored on the approved outfit front.
- **A fit is a record per character per garment**: the same garment on Tom is a separate fit. A second try for the same pair is a new revision of the same fit.
- **Approving an outfit makes its production look** (pinned to that fit revision). Combining age, condition and transformation in one look is Milestone 6.

## Jobs carry the link

`ImageJob.variation` (and `JobRequest.variation`) records `{ id, revision, role, uses[] }`: which revision the picture was made for and which reference played which part (`reference-1-character`, `reference-2-garment`, `source-picture`). `syncWardrobe` (run whenever the queue changes) attaches finished pictures to the candidate once, approves a candidate when one of its pictures is approved anywhere (Review included) and records which picture was chosen, rejects it when every picture is turned down, and makes looks for approved outfits. Approved and rejected revisions are never changed by it. Media paths are snapshots: `currentPath` follows a relinked file through the job id.

## Prompts

- **Garment**: clothing only (no person, mannequin head, hands or feet), neutral even lighting, the project's style, three views (front, back, fabric and construction). Free fields (silhouette, fabric, colour, closures, era, occupation, climate, trim, layering, footwear, practical fit) are optional and every list has Custom. A new version of an approved garment is sent with its approved picture as a reference.
- **Fit**: names the references by role in order (1 the character, 2 the garment), says to dress the character in the garment and not to copy the clothing in reference 1, lists what must stay the same (face and hair, body, pose, accessories; the person's choice), and leaves out the character's own description because it may describe the clothes being replaced.
- A model that cannot receive reference pictures is refused for fitting, with the reason, instead of guessed at.

## Other changes

- Approving an outfit's or age variant's front view no longer replaces the character's own picture in the bible; only the base look sets it (or any look, when the character has none).
- The Sheets tab's Look list includes the character's approved outfits; "Make wardrobe sheets for this look" opens it on that outfit.
- Project files: `variations` is saved when the first garment is made. Older projects are unchanged until then.

## Verified, and what was not

- Tests: domain (revision rules, queue following, prompts, fits, looks, stale marking), the screen (gating, cost shown before anything is requested, three linked requests), and the fixtures from Milestone 1.
- Acceptance scenarios covered by automated tests: 1 (a jacket that is not in the character picture), 2 (fit keeps face and body: prompt and reference order), 3 (reuse on another character with a separate fit), 13 (changing the base garment marks only its fit, condition and look stale).
- Live provider check: see the Milestone 2 live report below.

## Not done in this milestone

- Garment condition, age and transformation studios (Milestones 3 to 5).
- Fits for an age or transformation body variant.
- A clothing-only layering sheet and a costume turnaround of the garment alone (the garment has front, back and detail).
- Reference-image limits: a fit sends two references. A strategy for more (identity plus garment plus condition) arrives with conditions.
- Taking back a picture's approval in Review does not undo an approved revision (decisions are made once); make a new revision instead.

## Milestone 2 live provider report (Nano Banana 2.1 through Kie.ai)

Run in a test copy of the app against the real model, on a character with an approved front view. Pictures were looked at by a person; nothing was scored automatically. Screenshots of these runs are kept with the project deliverable, not in this repository, because they show the user's own story art.

- A garment designed from words only (deep green waxed jacket, corduroy collar, four patch pockets, brass snaps) came back as clothing only, no person, front, back and fabric views, matching the description.
- Fitting it on the approved character (two references: the character first, the garment second) kept the face and hair and put the jacket on, with the collar and pockets as designed.
- Approving the outfit made a look that appears in the Sheets tab's Look list, and the "Make wardrobe sheets" button opens Sheets on it.
- Cost: 3 pictures for the garment and 1 for the fit, at the price the person entered.
- Found and fixed from this run: the new tab clashed with the bible's own "Wardrobe" sheet tab (now "Wardrobe studio"); the studio was squeezed by the story inspector (it now takes the full width); the fit comparison showed the pristine garment when a condition was chosen.

# Milestone 3: conditions and continuity

Status: a garment can be put in a condition (wear, damage, dirt, wetness, repair) from the Wardrobe studio, with histories that branch, and the garment in that condition can be fitted on a character and used in scenes.

## Model

- A condition is derived from one garment revision (`ConditionSpec.garment`) and may continue from an approved earlier condition (`from`). Conditions of the same garment form a tree (`conditionTree`); the tree on screen is that.
- Each change is a region: garment part, **the wearer's side** (wearer's left, wearer's right, centre, both), severity, description, optionally the view it was marked on.
- What an earlier condition established stays a requirement: `inheritedRegions` collects every region along the history, oldest first, and the prompt for a later condition lists them under "already established ... must stay exactly as in the attached picture". Wet-on-torn therefore keeps the tear; a separate repaired branch is built from the garment and changes nothing in the other branch (tested).
- A condition is made from the approved picture of its parent (the earlier condition, else the garment) as the single reference.
- A fit can carry a condition (`FitSpec.condition`): the garment picture sent as reference 2 is the condition's approved picture and the condition's requirements are written into the prompt ("show it exactly as it appears in reference image 2 ... do not repair, clean or add to them"). It is a separate fit with its own look name ("KAEL in Field jacket, Left sleeve torn").

## Left and right

Left and right always mean the wearer's. For a front view the wearer's left is on the right of the picture; for a back view it is on the left; for a detail or any other view the prompt says only "the wearer's left" and states nothing about the picture. A region marked on one view is described to another view as "marked on the X view: place it consistently, do not copy its position". Regions are semantic (part and side) in this version. Normalised coordinates and drawn masks are not implemented.

## Scene assignment

A look can be assigned to scenes (`assignLook`: a new approved revision of the look with `sceneIds`; earlier assignments stay in its history). `checkLookAssignments` appears among the Director's room continuity findings: it warns when a shot's chosen look differs from the look assigned to its scene, and says when the assigned look was approved before something it uses changed. It reads the plan and the records, not the pictures. Story intervals other than a whole scene are not modelled.

## Record checks

`checkCondition` runs fixed rules on the record (every change names a part and a side and says what happened; made from a garment in this project; the garment has not changed since; continues from an approved condition of the same garment). Its states are the honest ones: needs review, or passed for the checks performed. "The changes are in the right place in each picture" is always reported as not checked. There is no image analysis in this version.

## Live provider report

Run in a test copy against the real model. A left-sleeve tear on the jacket: the front view showed the tear on the right of the picture and the back view on the left (the wearer's left in each), and the fit of the character in that condition showed the tear on the same side. Face and hair were kept. Judged by eye.

## Not done in Milestone 3

- Drawn masks, normalised coordinates and per-view annotations.
- A vision-model suggestion of misplaced damage (nothing reads the pictures).
- A clothing-only damage and repair detail sheet beyond the three condition previews.
- Assigning a condition to a story interval other than a whole scene.

# Milestone 4: age variants

Status: the "Age & appearance" tab (Design, for a character) makes the same character at another age, a younger or older redesign, or a relative.

## What is what

- **Same person at another age**: a variant of the character. The prompt asks for the same bone structure, eyes, nose, mouth and ears with only the changes time makes, and lists what the person said must stay recognisable.
- **Younger- or older-looking redesign**: also a variant, with more freedom in the face.
- **A relative**: a new, separate character (`ExtractedAsset.relativeOf = { assetId, relation }`), made with no pictures and no cost. It is never an age record.

## Behaviour

- The target-age slider and every advanced control edit a local draft only. No record is made and no request is sent until the button is pressed (tested at the screen level).
- The character's current age and description are left out of the aging prompt (the age would contradict the target; the description may describe the clothes). Reference image 1 is the approved picture of the character.
- The costume, pose and marks are kept unless the person unticks them. In a 2D style the prompt says age is drawn, not rendered, and forbids photographic or 3D rendering and realistic wrinkle texture (tested against a 2D and a 3D style).
- A model that cannot receive reference pictures is refused for this, with the reason.
- Two candidates are made: full-body front (which the age's sheets are later made from) and a portrait. Approving one approves the age and makes a look of the character at that age, filed in the queue under its name ("MARA at 65"), so Turnaround and the other sheets are made from the Sheets tab on that look, anchored on the approved front.
- Fitting a garment to an age variant is a separate fit (`FitSpec.body`): reference image 1 is the age variant's approved picture and the prompt says to cut and drape the garment for that body. If the age variant later gets a newer approved version, the fit and the looks pinned to the older one are marked stale; the garment is not.
- Setting checks (`checkAgeSpec`): the target is a number, differs from now, at least one recognisable feature is named for a same-person variant, the costume is kept. Whether the aged picture is recognisably the same person is "not checked": it is a person's judgement and no number is given.

## Not done in Milestone 4

- The age comparison sheet (an assembled image of the base and each age side by side) is a Milestone 6 export.
- Updated poses and expressions for an age are made from the Sheets tab on the age's look; they are not queued automatically.
- No vision-model comparison against the source.

## Milestone 4 live provider report

Run in a test copy against the real model (Nano Banana 2.1 through Kie.ai), judged by eye.

- Moving the target-age slider several times changed nothing on the project and the spend counter stayed the same.
- Kael at 65 (same person, the face features he said must stay, grey hair, a slight stoop): recognisably the same man, with an older face and grey hair, the same slate-blue tunic and pose, and the same 3D style. No photographic rendering appeared. The portrait kept the same eyes and face structure.
- Approving it made a look "KAEL at 65" that appears in the Sheets Look list.
- Fitting the jacket to that body used the aged picture as reference 1: the aged Kael kept his grey hair and wore the jacket as designed.
- The bible still shows Kael's own base picture, not an age or outfit picture.
- A 2D style was tested at the prompt level only (the 2D rule is in the prompt and covered by a test); no 2D picture was generated for this milestone.
- Cost: 2 pictures for the age and 1 for the fit.
- Found and fixed from this run: two controls were both named "Target age" (found by a test); the slider now has its own name.

## Verified after closing and reopening the test app

The garment, its approval, the tear condition and its tree came back after the app was closed and reopened (project autosave). The studio fills the width with no horizontal scroll and the story inspector hidden.
