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

# Milestone 5: transformations

Status: the "Transformations" tab (Design, for a character) makes a character change in stages, with the character kept recognisable.

## Model

- A transformation is a **line of stages** (subtle symptoms, partial transformation, full form, or your own). Each stage is a record with its own revisions. A stage continues from the approved stage before it (`TransformationSpec.from`), which must be the same character and the same kind; the first stage starts from the character's approved picture. So a later stage is stale when an earlier one is replaced.
- Each stage stores intensity, a **recognisability target** (1 to 5, a creative target a person judges, never a score), what must remain recognisable, free design fields (anatomy and silhouette, skin and surface, features, what changes from the previous stage), symmetry, what happens to the costume (kept, adapted, damaged), and how strong it may be for the audience.
- Presets (zombie or infected, monster, supernatural, robotic, hybrid, elemental, custom) only fill the boxes; every field stays editable and Custom starts empty. Saving your own presets is not implemented.
- The art style is not part of a transformation: a 2D style stays drawn and a rendered style stays rendered (tested at the prompt level).
- Approving a stage makes a look of the character in that stage. A garment can be fitted to a transformed body (`FitSpec.body` may be a stage); that fit goes stale when the stage is replaced.

## Expected anatomy

`expectedAnatomy` lines such as `fingers: six on each hand` replace the human default for that part (`anatomyRules`): the default human rules (five fingers, two arms, two legs, two eyes, one head) apply to anything not declared. The declared anatomy is written into the generation prompt as deliberate, and **given to the existing vision review** (`visionAnatomyRules`, used by the Review screen) so a six-finger hand is not reported as a mistake. This was tested with a six-finger case and with the rule broken on purpose. The vision review itself was not run live (it needs a vision model on this computer).

## Checks

`checkTransformation` runs on the settings: anchors named, recognisability set, the change described, declared anatomy when the anatomy changes, a later stage goes further than the one before and says what changed. Only anchors, a target and a described change stop a candidate; the rest are shown as "needs a look". "The picture is still recognisably the character" and "the picture's anatomy matches what was declared" are always reported as not checked.

## Live provider report (Nano Banana 2.1, judged by eye)

- Subtle stage: red-rimmed, tired eyes and a slightly paler look; recognisably the same man in the same tunic.
- Partial stage: grey, veined arm and hand, a clouded eye, same man and tunic.
- **Left and right were wrong in both attempts**: "the left arm/hand" and "the left eye" were drawn on the left of the picture (the character's right). The prompt says which side is meant and where it lands, but this model did not follow it for body parts (it did for the jacket tear). Screens therefore show a warning whenever a side is named, and the guide says to check it. This is a known limitation, not a fixed one.
- The portrait first came out full body; a close-up framing line was added for the non-full-body view, and the second attempt was a proper close-up.
- Whether the changed hand had six fingers was not confirmed at the size inspected.
- The full-form stage was not generated.

# Milestone 6: looks, continuity and export

Status: the "Looks & continuity" tab composes looks, shows conflicts and what needs updating, and the package records the revision ids.

## Composing a look

A look is only a combination of parts that already exist and are approved: a body (as approved, an age, or a transformation stage), an outfit, a condition, accessories. Nothing makes every combination. `checkComposition` reports what clashes, each with a fix:

- an outfit fitted to a different body than the one chosen (blocks); for a transformed body the message says the clothes may not fit or may clash with the new anatomy;
- a condition the outfit picture does not show, or made from a different version of the garment than the outfit uses (blocks);
- two accessories that go on the same place (blocks);
- a part that is not approved, missing, or another character's (blocks);
- a part approved before something it uses changed (warns);
- an age and a transformation stage together, for which no picture exists (warns).

A warning can be accepted by the person; a block cannot. `composeLook` approves the look pinned to exactly the chosen revisions; composing the same name again is a new revision. Choosing an outfit fills in the body and condition it was made for.

## Targeted regeneration

`regenerationPlan` lists only the current approved version of each record that is out of date, why, and the order to remake it (what depends on nothing stale first), and counts the approvals that are untouched. It makes nothing and spends nothing. `refreshLook` moves a look to the newest approved versions of its parts, and refuses while any part is still out of date; the earlier look revision stays.

## Export

- The design records in a verified package gain a `variations` section once any record exists: every record with revision ids, status, dependencies, whether it is out of date, its pictures (file names only), and the quality state of the checks that were run; the out-of-date list with what to do; and for each picture made for them the provider, model, attempts, provider task id, estimated cost (from the price you entered, else none), prompt, and each reference with the part it played. Approved pictures carry the revision they were made for. Older projects write exactly what they always did (tested).
- Comparison sheets (age, transformation stages, a garment and its conditions) use the existing contact-sheet export; labels carry the version ids.
- Variation pictures are ordinary queue pictures, so the project's existing missing-file relinking covers them; `variationFiles` lists every file the records point at so none is silently left out (tested).

## Live report

Run against the real app and a real export. The Looks screen listed the looks, caught "torn-jacket outfit with the 65-year-old body" as blocked with the fix, approved the matching look, and exported an age comparison sheet (base and age 65, labelled with the version id). A verified package was exported and its design records contained 23 records, 17 generation records, version links, providers, attempts, costs and reference roles, with no folder paths.

Not run live: bringing a look up to date after a real change, the Director's room warning, the transformation and condition comparison sheets, opening an exported project on a second computer.

# Acceptance scenarios

"Automated" means a test that runs on every build. "Live" means it was run in the real app against the real model and judged by eye. Nothing was verified on a second computer, in a 2D style, or with a vision model.

| # | Scenario | Automated | Live |
|---|---|---|---|
| 1 | Design a jacket absent from the original picture | wardrobe.test | yes |
| 2 | Fit it, preserving face and body | wardrobe.test (prompt, reference order) | yes (face kept) |
| 3 | Reuse the garment on another character, separate fit | wardrobe.test | no |
| 4 | Threadbare cuffs, rest of the garment kept | conditions.test | no (a tear was tested) |
| 5 | Character-left sleeve tear, kept across views | conditions.test | yes (front, back, fit) |
| 6 | Wetness keeps the approved tear | conditions.test | no |
| 7 | Repaired branch leaves the original history alone | conditions.test | no |
| 8 | Age, keeping identity and art style | age.test | yes (3D; 2D prompt only) |
| 9 | Update clothing fit for an age | age.test | yes |
| 10 | Partial and full transformation with protected anchors | transformation.test | subtle and partial; side was wrong |
| 11 | Intentional creature anatomy in QA | transformation.test (rules, vision rules) | no vision review run |
| 12 | Assemble an age, outfit, condition (and transformation) look | looksAndRelease.test | yes (outfit and condition; age and transformation as a record only) |
| 13 | Change the base garment, mark only dependents stale | variations.test, looksAndRelease.test | no |
| 14 | Retry a failed generation, keep costs, no duplicate request | looksAndRelease.test | no |
| 15 | Reopen a collected project on another computer | looksAndRelease.test, variationFixture.test | reopened on the same computer only |
| 16 | Load an older project without losing looks or approvals | variationFixture.test (0.51.2 and 0.65.1 fixtures) | no |

# Known limitations

- Nothing reads pictures. Placement of damage, recognisability, and the anatomy of a picture are for a person; the vision review only suggests.
- Left and right are asked for in the prompt but models can get them wrong, especially for the body and face. Screens warn and the guide says to check.
- Damage is by garment part and wearer's side, not drawn masks or coordinates.
- An age and a transformation stage cannot be shown in one picture; a look that combines them is a record only.
- A fit sends two reference pictures (the character, then the garment). There is no strategy yet for more references than a model accepts.
- Relative and transformation presets cannot be saved as your own.
- Seeds are not recorded.
- Taking back a picture's approval in Review does not undo an approved record; make a new version.

# Exact remaining work

- Garments from reference pictures and from combinations of inputs; the same garment in different art styles as explicit variants; garment preset thumbnails.
- Drawn masks, normalised coordinates and per-view annotations for damage.
- Vision-model suggestions for garment cut drift, damage on the wrong side, clothing intersections and inconsistent views, with evidence and affected regions.
- A reference-limit strategy when identity, garment and condition pictures exceed a model's limit.
- A clothing-only layering sheet, a damage and repair detail sheet, and automatic updated poses and expressions when anatomy changes.
- Story intervals other than a whole scene for assigning a look.
- Live checks not yet run: a 2D style, a second character wearing the same garment, threadbare, wet and repaired conditions, the full-form stage, the vision review with declared anatomy, a second computer.
- Mac builds are not signed (the signing certificate secret is not valid), so there is no Mac file for this release.

# QA record for 0.66.0

## Automated

- Unit and screen tests: 154 files, 1355 tests passing; Rust tests 119 passing; type check clean.
- Test coverage of the new domain code (measured once with the coverage tool, which is not part of the project): about 93% of statements and 84% of branches before the edge-case tests were added. The tests added afterwards cover the stale-reason texts, damaged-file reading, condition-history failures, record validation and look naming.
- Tests were checked against deliberate breakage: removing the staleness rule, the body-mismatch conflict rule and the declared-anatomy override each made tests fail.
- The legacy golden prompts and project fixtures (0.51.2 and 0.65.1) pass; saving an older project writes back exactly what it read.
- A security review was done by hand because the scan service's allowance for this account was used up (1 of 1). It found that a damaged or hand-edited project file with a record missing its settings could crash the screens that read the records. Reading is now strict (known kinds, valid revision numbers and decisions, a settings object, a picture list; anything else is dropped), with tests that every reader keeps working on a mangled file. Other points checked: the export writes file names only, never folders or keys (tested); loops in histories and stage lines are guarded; no shell, network or credential use was added.

## Interface and accessibility audit (live app, dark and light themes, 1440, 1100 and 900 wide)

Run with the project's own in-page audit plus checks for unnamed controls, duplicate control names, buttons without names, pictures without alt text and overflow.

Found and fixed:
- Two controls both named "Target age" (age slider and number).
- Two fields both named "Name" in the Wardrobe studio (now "Name of this condition").
- Sideways overflow in the Wardrobe studio (a fieldset and a grid that would not shrink) and 9px in Looks (a dropdown stretched by a long option name).
- Status colours (Approved badge, warnings, conflicts) too pale in the light theme.
- Layout that was cramped when the panel was narrow: the studios now respond to their own width, stacking the condition tree above the form and letting button text wrap.

Results after the fixes: no horizontal overflow in any of the four new tabs at 1440 in either theme; no unnamed controls, nameless buttons or pictures without alt text; no new contrast failures. What remains is the same as on the existing Sheets and Identity tabs and is not new: page-level overflow and small text or small click targets at 1100 and 900 wide, and the existing "contempt" chip at 4.4:1. A disabled button measures below the contrast ratio, which is exempt.

Not done: screen-reader testing, keyboard-only walkthrough of every control, and a phone-sized layout.

# Vision QA, interface fixes and security (after 0.66.0)

## Vision QA: what it does

Under each candidate's pictures (garment previews, conditions, outfits, ages, stages) and in the Review screen there is **Check against what it was made from**. It gives two kinds of result, always labelled and never mixed:

- **Record facts** (free, instant): rules over the records, for example a condition whose change names no side, an age with no named recognisable feature, a picture made without its reference, an outfit made from a garment that has since changed. They say nothing about the picture and never count as "the picture was checked".
- **Suggestions from a vision model that runs on this computer** (free, opt-in, nothing leaves it): closed questions, compared by the app (below). A suggestion shows how sure it was, what it expected, what the model saw, where, and what to do. It can be dismissed or accepted, and a fix is made in Review as a new candidate for the same record (a correction keeps its link to the record and is never approved automatically).

States are the honest four: Not checked, Needs a look, Passed for the checks performed (with which categories were looked at), Unable to assess (with the reason in plain words, for example the model is not running).

## Why closed questions, not "judge this picture": a labelled test

Model: `qwen2.5vl:7b` through Ollama, on this computer. Pictures: real pictures from the test project, downscaled to 1024 pixels. Where a case needed a known wrong answer, a **mirrored copy** of a correct picture was used (the tear on the other side) or a **different person** was used.

**Open-ended review** (the model is given the rules and asked what is wrong), 13 cases, 7 of them with a known problem:
- It reported the actual problem in **0 of 7** cases.
- For the four damage-side pictures it said "no damage" or "the sleeve is not torn" for all four, including the correct picture that has a clear tear.
- On 5 of the 13 cases (four that compared three pictures, one that compared two) it failed outright, with no usable answer.
- It missed a wrong person entirely (Lyra given as an aged Kael), and for another wrong person (Voss) described the person without reporting a mismatch.
- It also filled the findings list with statements that nothing was wrong ("no damage"). Those are now filtered out and never shown as findings.

**Closed questions** (the model only says what it sees; the app holds the expectation and compares), each asked twice with temperature 0:
- "Is the torn sleeve on the left or the right of the picture?": **14 of 14** correct, over 7 pictures (correct tear, mirrored tear, front and back views, an outfit, and an undamaged garment answered "none").
- "Are these two pictures the same person?": **14 of 14** (aged Kael, Kael in a jacket, Kael in a torn jacket, a stage of the transformation; Voss and Lyra answered "different").
- "Is the person wearing this garment?": **10 of 10** (two wearing it, three not).
- "Which side of the picture is the grey, veined hand on?": **2 of 6**. Not offered.

Only the kinds of question that passed are asked: which side of the picture a described change is on (expected side is the wearer's side turned into the picture's side for that view), same person as the approved picture, and wearing the designed garment. Each is asked twice; two different answers mean "could not tell", never a finding. A finding earns 80% confidence when both answers agree and 50% when the model could not see the change at all (a small model can miss a small tear).

**What this does not show.** One character and one garment. About 40 questions. The tear is large. The "different person" examples were very different people, which is the easy case: a subtle drift between similar people was not tested. No 2D picture was tested. The model was never asked about anatomy or hands. A different or larger model would have to be measured the same way before it is trusted; the questions and the way to run them are above.

## A bug this found in the existing vision feature

A full-size picture (1792 by 2400) used 4183 tokens, more than Ollama's default 4096, so the request was refused and the review said only "Unable to assess". Smaller pictures worked, which is why it had not shown up. Pictures are now shrunk to 1024 pixels on the long edge (JPEG) before they go to a local model; smaller pictures are sent as they are. When a model cannot answer, the screen now says why in plain words.

## Interface fixes (found by the audit and from screenshots)

- Eight section tabs overflowed their column into the right-hand panel, labels wrapped inside the tab, and the active tab became a circle (79 pixels tall). The bar now wraps onto a second row, each tab stays on one line, and nothing overlaps (checked live: bar ends 14 pixels before the panel, tabs 37 pixels tall).
- A long unbroken path in a note on a picture card widened the card, which blew the picture up and left the card beside it with a large gap. Notes now wrap inside the card, and the cards stay the same width.
- Notes from the engine were written for developers (two long folder paths and an operating-system message). They are now plain sentences with what to do ("This picture's file is stored outside the Production One folder... use Use my image"), both when the note is made and when old notes are shown. Folder paths are shortened to a file name everywhere.
- The Wardrobe studio no longer overflows sideways; the studios respond to their own width; light-theme status colours meet contrast; duplicate control names were removed.

## Security review

The scan service could not be used (this account's allowance is used up), so the review was done by hand over the changed surface and the commands that read files.

Already sound: a strict content policy for the page; the picture protocol limited to the app's assets folder; previews, checks, labelling, clean-up renders, sheet exports, Topaz and audio clips all refuse a file outside the assets folder; a block-list stops credentials, keys and model files going into a package, and exported text is scanned for keys and tokens; local model addresses must be this computer or the local network and cannot carry a password.

Found and fixed:
1. **A shared project could make the app upload any picture on this computer.** The two helpers that read reference pictures (for a cloud provider, and for the local model) read any path and only checked that the bytes were an image. A `.pone` project from someone else could list any picture on the computer as a "reference", and pressing Generate would send it to the provider. Both now only read from inside the app's assets folder, with a 64 MB limit, and a missing file keeps its own message. (Pictures people bring in are copied into that folder first, so nothing legitimate is affected.)
2. **A shared project could make a package include any existing file.** The package took any existing file a project pointed at (apart from credentials by name) and put it in the zip that is then shared. It now only includes files from the assets folder, and says which file was refused.
3. **A damaged project file could crash the screens that read the new records.** Reading is now strict (known kinds, valid numbers and decisions, a settings object, a picture list; anything else is dropped) and every reader is tested on a mangled file.

Tested: six new Rust tests on the folder rule (inside, a sub-folder, outside, `..` climbing out, a folder whose name only starts like the assets folder, a missing file), a size limit, a file that is not a picture, and three on shrinking; plus tests for damaged records.

Not fixed: `missing_files` tells the page whether a path exists (it only reveals existence to the page itself). Not reviewed: the scan by file name that finds moved pictures, how provider keys are stored, and the dependencies. A scan by a real tool should be run when the allowance is available.

### Live check through the real app (vision QA)

Run in the test copy of the app, with the real local model and a full-size (not shrunk by hand) picture:

- Correct torn-jacket outfit, checked from the screen: "Passed for the checks performed" (looked at Identity, Costume continuity, Damage and wear placement; about 4 seconds).
- The same question through the real command, each asked twice: the correct outfit answered "right" (2 of 2); a mirrored copy of it answered "left" (2 of 2). The app expects "right", so the mirrored one would be reported as a suggestion.
- Not run live: an aged-picture check, 2D styles, a second character.
