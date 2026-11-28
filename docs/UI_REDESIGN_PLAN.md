# ProducerOne UI redesign: reading of the package, mapping and plan

Source: `ProducerOne-Complete-UI-Redesign.zip` (39 screen concepts, design system, information architecture, agent brief, README). The package is the master for how the app should look. Its README says the images are design references, that source project data is authoritative, and that behaviour must keep working. This document is the route and action mapping the brief asks for before any migration, plus the order of work. Nothing has been migrated yet.

Note on spelling: the package uses "ProducerOne" as the single product spelling. The app and installers currently say "Production One". Changing the product name is a separate decision (installer name, window title, file associations and the data folder name all derive from it), so it is not part of the visual migration unless you say so.

## 1. What the design asks for

- **Look.** Graphite surfaces and one champagne accent (App `#0B0E11`, panel `#14181D`, raised `#1C2127`, input `#20262D`, border `#343B43`, text `#F1F0EB` / `#B7BDC5`, accent `#D9B971`). Gold marks selection and primary actions and never tints pictures. Green means approved only, always with an icon and a label. Inter for the interface (already bundled), IBM Plex Mono for numbers and timecode, one outlined icon family (Lucide, already used), 4/8/12/16/24/32 spacing, 6/10/12 radii, 150 to 200 ms motion that respects reduced motion.
- **Layout.** A slim global rail (about 96 px), a Production Bible browser (about 280 px) with large Characters / Assets / Worlds image cards, counts, search and portrait rows, a flexible central workspace, and one contextual inspector (about 280 px). Both side panels resize and collapse independently. A compact queue dock of about 56 px runs along the bottom.
- **Less text.** Large previews replace repeated explanation. Studio tabs become image cards with a label. One concise title, one status and a small action group per card; less frequent actions go in an overflow menu; destructive actions live there too.
- **Truthfulness.** Counts, ages and approval labels in the images are illustrative; the project's own data is used. Unknown cost stays "Unknown". A passed technical check or a finished job is never creative approval. Approval is per version and per deliverable. A hash match is "equal or not equal", never a percentage. Anatomy numbers stay deterministic; Review makes no claim about mesh topology or rig correctness from a raster. Colour grading never claims to move lights.
- **Skin surface.** The package marks screen 39 as PROPOSED. That feature now exists (Skin & Surface, milestones 1 to 3). Where the mock differs, the built behaviour wins: skin choices are named levels (no 0.62 sliders), approval needs a separate identity confirmation, and a model that edits the whole picture is said to do so.

## 2. How the design maps onto what already exists

The information architecture in the package matches the app's: Projects, Script, Design, Review, Storyboards (the optional Direct room), Deliver, Assistant, with utilities. Two differences to settle, neither blocking:

| Package | Today | Plan |
|---|---|---|
| Rail labels: Projects, Script, Design, Review, Storyboards, Deliver, Assistant | Same seven (the app calls the optional room "Storyboards" in the rail already) | Keep |
| Bible browser: three image category cards plus Overview link | A segmented switcher (Characters, Assets, Worlds, Overview) with a flat list | Replace the switcher with image cards (using each group's first approved portraits, neutral fallback illustrations when empty); the Overview page stays as it is |
| Studio tabs with thumbnails and a More overflow | Ten text tabs that wrap | Visual tab cards for Sheets, Wardrobe, Age & appearance, Transformations, Looks & continuity, with the rest (Relationships, Anatomy, Identity, Motion, Voice) under More |
| One contextual inspector | A right panel on Sheets only, and per-studio side forms elsewhere | One inspector component whose content follows the selected tab and asset |
| Header with portrait, name, revision and approval | A text title with a type tag | AssetHeader |

## 3. Route and action mapping (to be completed per screen before each migration step)

| Package screens | Existing home | Existing actions that must stay reachable | New location |
|---|---|---|---|
| 01 Projects | Projects workspace (`ProjectHero`, recent list, open, save, import) | New, open recent, open file, save, save as, import legacy `.pone`, project hero next step | AppShell project switcher plus Projects page |
| 02 Script breakdown | Script workspace (`StoryView`, `CharacterBible`, `CastBoard`) | Import, analyze, templates, questions, reading, add asset, merge assets, show in script, voice casting entry | Same page, new components |
| 03 Bible overview | `ProductionBibleOverview` | Open a group | BibleBrowser overview |
| 04 to 05, 12 | `SheetStudio`, `AssetLab`, `ProportionPanel`, identity tools | Generate views, export sheet, reference photos, notes, identity lock, model, proportions, regenerate with proportions | Sheets / Identity tabs and inspector |
| 06 to 07, 10 | `WardrobeStudio`, `ConditionStudio`, `LooksStudio`, `ContinuityPanel` | Design garment, previews, fit, conditions, compose look, freeze scene, branch | Wardrobe / Looks tabs |
| 08 to 09 | `AgeStudio`, `TransformStudio` | Target ages, protected features, candidates, approve, relative character | Age & appearance / Transformations tabs |
| 11, 13 to 16, 19 | `RelationshipsStudio`, `AnatomyStudio`, `MachineAbilityStudio`, `ProfilesStudio`, `VehicleStudio`, `FitPanel` | Relationships, anatomy, machine parts, powers, species and factions, vehicles, props sizes, scale sheet | Relationships / Anatomy under More and Assets; Anatomy subtools stay nested, no new global items |
| 17 to 18 | `SheetStudio` for props, sets | Same as sheets for assets and worlds | Assets / Worlds views |
| 20 to 21 | `MotionDemo`, `VoiceAudition`, `BatchAudio`, `MusicMaker` | Motion references, voice audition, batch audio, music brief | Motion / Voice & sound tabs |
| 22 to 23 | Style gallery, `ArtDirectionBar`, image quality (`CleanRender`, `TopazEnhance`) | Choose and lock style, 2D styles, quality pass, upscale | Style bar and inspector |
| 24 | `ReviewView`, `VisualReviewPanel`, `CandidateVision` | Compare, findings, approve, request changes, reject, corrections ledger | Review page with `CompareViewer` |
| 25 to 27 | `DirectRoom`, animatic, looks (`LookPanel`, `grade.ts`) | Shots, camera, lighting, blocking map, animatic, looks | Storyboards page |
| 28 | `DeliveryCenter` | Package checklist, verified versus draft export, tasks | Deliver page |
| 29 | `Assistant` | Brief, attachments, plan, model and cost, approve | Assistant page |
| 30 to 36, 37, 38 | `QueueDock`, `QueueStrip`, providers panel, `LocalAiPanel`, `RelinkDialog`, `AppearanceMenu`, command palette, add-asset dialog, `HelpCenter`, `Tour`, `UnsavedSheet` | Pause, retry, providers and keys, local AI, relink, appearance, command palette, add asset, help, recovery | Utilities, unchanged behaviour |
| 39 | `SkinStudio`, `SkinRefinement`, `SkinLightingTest` | Profile, refine, compare, lighting test | Character tab "Skin & Surface" |

Keyboard shortcuts, advanced prompt tools, imports, identity anchors and provider selection stay reachable throughout.

## 4. Order of work

1. **Foundation.** Shared tokens (colour, spacing, radius, motion) added as CSS variables behind a new stylesheet that wins over the old ones in one place; bundle IBM Plex Mono (needs a font package; this is the only dependency the package implies and needs your OK, otherwise the system monospace is used); icon sizes and focus rings. Checks: contrast test for every token pair in the new palette, reduced-motion, 125 to 200 percent scaling.
2. **AppShell and panels.** Rail, project switcher, save state, resizable and collapsible Bible and inspector with remembered sizes, queue dock. Selection survives page changes (a stated requirement).
3. **Design first.** BibleBrowser (image cards, search, portrait rows), AssetHeader, StudioNavigation (image tabs), ReferenceCard, one Inspector, CompareViewer (reuse the existing synchronized zoom). Handlers, data and approval gates untouched.
4. **Review.** Same components plus truthful JobCard and StatusBadge.
5. **Script, Storyboards, Deliver, Assistant.**
6. **Utilities.** Settings, providers, queue, relink (hash equal or not equal, never a percentage), recovery, command palette.
7. **Verification.** Save and reopen, portable assets, candidate revisions, approvals, stale dependencies, keyboard-only use, 1920x1080, 1440x900, 1280x800, scaling, reduced motion, empty/loading/error/offline states. No paid generation for UI checks.

Preset pictures: where a card needs a neutral illustration (an empty category, a new project), they can be made in the app as before. No picture is generated when a screen opens.

## 5. Points to decide

1. **Product name.** Keep "Production One" for now, or change everywhere to "ProducerOne" (a larger change than a visual one).
2. **IBM Plex Mono.** Add the bundled font (a small dependency), or use the system monospace.
3. **Order against the remaining skin work.** Milestone 4 of Skin & Surface is in progress; the design's skin screen also depends on it.
