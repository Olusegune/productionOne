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
