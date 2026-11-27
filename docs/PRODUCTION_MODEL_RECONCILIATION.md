# Production model expansion: reconciliation

Status: **reconciliation only. No application code was changed for this document.** It is written against the code on `feat/vision-qa` (0.66.0 plus the vision QA work in PR #80). Where I have not verified something in the code, it says so.

## 1. What is implemented today

**Project and assets**
- One project state (`StudioState`, `src/data/projectStore.ts`) with optional blocks added over time: `proportions`, `fitRules`, `sceneStates`, `reviews`, `corrections`, `looks` (grades), `world`, `variations`. Older projects open because every block is optional and has a reader that tolerates absence.
- Asset types today: `character | costume | prop | set | environment` (`AssetType`, `productionStudio.ts`). There is no vehicle, creature, robot, species, faction or world-profile type. Words like "creature" appear only in prompts and style text, not in data.
- Reference sheets per asset (`sheetSpecs.ts`), a generation queue with jobs, revisions and approval, a Review workspace, packages for hand-off.

**Variation model (0.66.0)** (`src/domain/variations.ts` and neighbours)
- Six entity kinds: garment, fit, condition, age, transformation, look. Every entity has immutable numbered revisions (`Ref {id, revision}`), a status (candidate/approved/rejected), media with roles, and a typed spec.
- Dependency graph (`variationGraph.ts`): which revision depends on which, staleness (newer, missing, not approved, wrong kind, upstream stale, cycle), `dependentsOf`, regeneration plans.
- Looks pin exact revisions per slot and carry scene assignments; composition conflicts are checked.
- Provenance: jobs carry a `variation` link (`id, revision, role, uses[]`); packages include a `variationManifest`.
- Migration: `variationsOf`/`deriveFromLegacy`, strict `readVariations`.
- Transformation spec already has `expectedAnatomy` (intentional features), `anchors`, `symmetry`, `costume` behaviour, `audience`, free `details`.

**Space and scale**
- `sceneState.ts`: world-space things (character/furniture/prop/landmark), positions, posture, `occupies`, `ownedBy`, relationships, per-shot cameras, explicit changes with reasons, `worldIssues` (chair taken / not owned / seated without chair / chair moved), drift detection.
- `proportions.ts`, `fit.ts`: body proportions in heads and metres, fit rules proposed per character and approved by a person, a scale sheet (lineup, doorway, chair, desk, stair, prop).
- `worldRules.ts`: the **project-level** default body profile and scale convention. Inheritance is project to character only; the file says no group behaviour exists.

**QA**
- Deterministic checks, a local vision model with closed questions compared by the app (side, same person, wearing), honest four-state status, corrections that keep their link to the record.

**Interface**
- Six workspaces: Projects, Story, Design, Direct (optional), Deliver, Assistant. Design holds the character bible with eight section tabs and the Wardrobe/Age/Transform/Looks studios. A golden-path component and a first-run exist.

## 2. What remains (against the new brief)

| Brief area | State | Gap |
|---|---|---|
| Shared production model (asset type/subtype, typed specs, relationships, provenance, QA, staleness, portable manifests) | Partly | Variation entities are character-bound (`characterId` in each spec). Assets (props, sets) are a separate older record with no revisions. No cross-asset relationship records. |
| Specialist templates (human, creature, alien, hero, villain, robot, mech, props, vehicles, environments) | Not started | One generic character path. No subtype, no per-type spec. |
| Creature & Anatomy Lab | Foundation only | `expectedAnatomy` exists on transformations; no creature spec, no anatomy rules that the checks read for non-transformations, no limb/digit counts. |
| Power & Ability Designer | Not started | Nothing models abilities or their states. |
| Robot & Mech Workshop | Not started | No joints/sensors/panels spec, no cutaway/design-reference labelling. |
| Prop & Vehicle Workshop | Not started | Props are plain assets; no hand/body fit, no scale reference. |
| Scale / Interaction / Ownership relationships | Partly | Scene state has `occupies`/`ownedBy` and chair issues, but it is per scene, not a reusable relationship between assets, and not tied to references, QA, or staleness. |
| World / Species / Faction profiles | Partly | Project-level defaults only. No species, no faction, no overrides with provenance, no proposals. |
| Scene-state continuity with branches and exact revision refs | Partly | Looks pin revisions and carry scene ids; scene states do not reference revisions and have no branches. |
| UI grouping (Characters / Assets / Worlds / Production Bible) | Not started | Today: Design workspace with a character bible. |
| Agent behaviour (show intended changes, protected features, affected assets/scenes, inputs, deliverables, cost before executing) | Partly | Cost is shown before generation and the assistant works from approved scope; the full pre-flight plan view is not built (I have not audited every agent path). |

## 3. What the architecture already supports

- **Immutable revisions, pinned refs, staleness and regeneration plans** are generic over `EntityKind`; adding kinds is additive (`PREFIX`, `depsOf`, readers).
- **`depsOf` is the single place** that says what depends on what, so asset relationships can be added as dependencies and staleness follows without new machinery.
- **Optional project blocks + strict readers** give a safe path for migration: add a block, add a reader, never rewrite old data.
- **Package manifests** already carry variation data; relationships can ride the same route.
- **The vision checks** take expectations from records and ask closed questions, so "six fingers" and "robot joints visible" can be expressed as probes, with the same honesty rules. Hand-level questions were measured as unreliable (2 of 6), so those stay record-facts and human review until a model proves otherwise.
- **`ownedBy`/`occupies` and `worldIssues`** already encode the VIP chair rule at scene level.

## 4. Schema and interface adjustments needed

1. **Generalise the owner of an entity.** Replace the implicit "character" with a subject ref `{ kind: 'character'|'asset'|'world', id }` on specs. Existing specs keep `characterId`; a reader maps it to a subject. No file rewrite.
2. **New entity kinds** (additive): `relationship`, `ability`, `profile` (species/faction/world), and typed asset specs (`creature`, `robot`, `prop`, `vehicle`). Assets with revisions are needed for props and vehicles; today they are unrevisioned.
3. **Relationship record**: `{ a: Ref|subject, b: Ref|subject, kind: scale | interaction | ownership | attachment, params (heights, hand/grip, occupies), basis: declared | measured }`. It is a dependency in `depsOf`, so changing either side marks the other's references stale. Scene `ownedBy`/`occupies` become views over approved relationships rather than a parallel store (migrated by reading, not rewriting).
4. **Profiles with inheritance**: world, then species, then faction, then character, each with `overrides` and provenance. Changing a profile produces **proposals** against approved assets (a list the person accepts per item); it never edits an approved revision.
5. **Scene-state branches**: a scene state holds exact `Ref`s (no "current condition" field) and a `branchOf`. Historical states keep the revisions they used by construction, since refs are immutable.
6. **Declared vs generated**: every spec field carries whether it is a declared fact or a generated suggestion, so QA reads only declared facts as expectations.
7. **Version flags**: `variations.schema` stays at 1 for additive kinds; a reader drops unknown kinds, so an older app opens a newer file without crashing. A new block (`relationships`, `profiles`) is optional. The project file version stays 1.
8. **Interface**: no change to existing navigation in the first milestones. New studios appear inside Design.

## 5. Recommended order (revised)

Your order stands, with two adjustments marked.

1. **Finish the original wardrobe/age/transformation work.** Remaining from earlier lists: garments from reference images or styles, drawn masks, reference-limit strategy, extra sheets, preset thumbnails, more live checks. PR #80 (vision QA) awaits your decision.
2. **Asset relationships and dependency tracking.** Subject refs, the relationship entity, `depsOf` and staleness for it, migration from scene `ownedBy`/`occupies`. *Adjustment: include the VIP chair/desk regression here as the first acceptance test, because it exercises ownership, scale and scene together.*
3. **Props and scale/interaction references.** Revisioned prop assets, hand/body fit, scale reference sheets generated from declared sizes.
4. **Creature Lab and robot specs.** Typed specs, intentional-anatomy rules read by the checks, labelled design-reference views. *Adjustment: hero/villain are narrative roles on a character (a field), not body types, so they land with the templates, not as a separate model.*
5. **Abilities.** Inactive/activation/controlled/peak/recovery/aftermath as pinned references; no "transparent" label unless the picture has real alpha (a check on the file).
6. **Species, faction and world profiles** with overrides and proposals.
7. **Scene-state continuity and release QA**, including portable-project and migration scenarios.

After each: working code, verification results, screenshots, docs, known limitations, next step.

## 6. The thirteen verification scenarios

Each is tagged with the test layer it needs. They stay separate and are reported separately: **D** deterministic unit test, **M** mocked provider, **R** real provider (costs money, run sparingly), **H** human visual review (I cannot judge these for you).

| # | Scenario | Planned layers | Milestone |
|---|---|---|---|
| 1 | Nonhumanoid creature fields | D | 4 |
| 2 | Six-finger QA (intentional vs artifact) | D (declared count), M, R, H | 4 |
| 3 | Hero and villain share a body | D | 4 |
| 4 | Power visual language across intensity | D, R, H | 5 |
| 5 | Clothing reacts to transformation only where requested | D (exists for `costume`), H | 4 to 5 |
| 6 | Robot joints/sensors/panels across views | D, R, H | 4 |
| 7 | Prop fits hand/body scale | D | 3 |
| 8 | Chair ownership distinct; rapper not in Venomspur's chair or through the desk | D | 2 |
| 9 | World rules produce proposals, never overwrite approved | D | 6 |
| 10 | Faction exceptions | D | 6 |
| 11 | Historical scene states keep original revisions | D | 7 |
| 12 | Portable project carries specs, refs, relationships, media | D | 7 |
| 13 | Existing projects migrate | D (fixture from 0.65/0.66 saves) | every milestone |

Honest expectation: deterministic tests will cover the model and rules thoroughly; they will **not** prove a picture looks right. Picture quality claims will come only from labelled real-model runs, with numbers and limits stated as for the vision QA.

## 7. Interface direction: "sleek, futuristic, magical", golden path, not overwhelming

I recommend against a redesign. The app already has six workspaces, a golden-path component and a lot of power; the risk is that each new studio adds another tab bar and another long page. My recommendation:

1. **One guided next step per screen.** A single, visible "what to do next" per character/asset, computed from state (the golden path already does this at project level). Everything else is secondary.
2. **Progressive disclosure.** Each studio opens on a short form with the few fields that matter and a quiet "More options" for the rest. Creature, ability and robot specs use the same pattern: pick a template, fill three to five fields, generate, then refine.
3. **The picture is the hero.** Large previews first, controls beside or beneath, status as small chips. The vision-QA state and staleness appear as one calm line, not a panel.
4. **Group by what people think about:** Characters, Assets, Worlds, Production Bible. Introduce as a **grouping inside Design** (a left rail or segmented control) first, leaving the six top-level workspaces untouched, and move to a full restructure only if you approve it after seeing it.
5. **Restrained motion and glow.** Soft depth, a single accent, subtle transitions on state change (a revision appearing, a look composing), all honouring reduced-motion. "Magical" should be felt in generation moments (a shimmer while a picture is made, a gentle reveal) rather than decoration everywhere.
6. **Preflight before spending.** Before any agent action: what will change, what is protected, what is affected, inputs, deliverables, cost, and stop-points. This is one reusable component used by every studio and the assistant.
7. **Plain words, everywhere.** The same rule as the notes fix: no paths, ids or engine messages in front of people.

Cost: items 1 to 3 and 6 to 7 are modest and improve every studio. Item 4 is a medium change. Item 5 is small if done with the existing theme tokens. I would do them with each milestone, not as a separate project, so every new screen is born in the new style. I will show screenshots at each milestone; tell me if the direction misses.

## 8. Risks and limits stated up front

- Small local vision models are poor at anatomy and hand detail (measured); anatomy QA will be mostly declared rules and human review.
- Generated pictures of cutaways, power effects and "transparent" glows cannot be guaranteed; the app labels what it can verify (alpha present or not) and says the rest is a design reference.
- Real-provider testing has a $5 budget on top of a $9 project cap, about $4.24 spent. Live tests will be few and targeted.
- This work is large; I will not merge or release anything until you say "Merge and release".

## 9. Decisions I need from you

1. Approve the order in section 5, or change it.
2. Approve the grouping-inside-Design approach for Characters / Assets / Worlds / Production Bible (section 7, item 4) before any restructure.
3. Decide what happens to PR #80 first (merge and release, or hold). This branch was cut from it.

## Milestone 2 status: asset relationships and dependency tracking

Done: a `relationship` record kind (ownership, interaction, scale, attachment) with immutable revisions, pinned to the body or outfit it was agreed for, so the existing staleness machinery flags it when that changes; a strict reader that drops damaged records; conflicts (two owners, two sizes); approved ownership feeds scene checks (the Direct blocking map and Review) without storing anything twice; scene things can have a footprint so a character standing inside a desk is reported; a Relationships tab in Design (record, approve, turn down, confirm after a change, keep what a scene already says). Tests: 1419 web tests pass, including the VIP chair/desk regression. Checked live in the test copy of the app (record, approve, tab bar fits).

Not done / limits: footprints are axis-aligned rectangles (no rotation); scale relationships are recorded and checked for contradiction but do not yet drive prompts or reference images (Milestone 3); no screenshot-reviewed polish of the new tab beyond the first pass; a fresh live run after the final picker filter was not repeated; the Rust side was not changed or re-run.
