# Migration notes: opening older projects in 0.52

**Short version: every older project opens, looks and renders exactly as before, and nothing is rewritten until you save.**

## What changed in the file

Nothing about the file format version: `production-one-project` is still **version 1**. 0.52 adds optional fields to the saved studio state (proportion profiles, world rules, fit rules, scene states, review results, correction ledgers, looks) and optional fields on shots (`camera`, `lightingRecord`) and on queue jobs (`provenance`). A file without them is read as "none of this is set up".

## Upgrade paths tested with real files

| From | Fixture | What the test proves |
|---|---|---|
| Production Guy `.pguy` / `.pguy.json` (the original app) | `fixtures/legacy/production-guy-0.9.pguy.json` | Opens, is marked legacy, every new record is at its default, the shot is unchanged |
| Production One 0.51.2 `.pone` | `fixtures/legacy/project-0.51.2.pone` | Opens with no new records; saving it again gives the same file byte for byte (as data); every prompt it renders equals a golden file written by the 0.51.2 code (`prompts-0.51.2.json`) |
| Production One 0.52 `.pone` with every record | `fixtures/acceptance/project-0.52.pone` | Every record survives open and save exactly |
| A file from a newer app (`version` 2) | made in the test | Refused with a clear message, not half-read |

`WRITE_FIXTURES=1 npx vitest run ...` regenerates the 0.51.2 and 0.52 fixtures. Do that only on purpose: the 0.51.2 files are meant to be what 0.51.2 wrote.

## Missing and damaged fields

Each record has a reader that fills defaults, clamps numbers and drops what it cannot understand (see `data-schemas.md`). Examples: a missing profile means "no profile" (not Natural); a damaged lighting record on a shot is repaired (`keyAzimuth` 999 becomes 180) or dropped; an unknown fit-rule status becomes `proposed`; an unknown finding status becomes `open`; a look assignment to a look that no longer exists is dropped.

## What you may notice

- A new optional **Shape and proportions** panel in Design > Identity for characters. Until you set proportions, a character is untouched.
- **Camera details**, **Lighting design** and **Blocking map** in the Director's room shot editor; **Looks and grade** below the animatic; **Visual review** at the bottom of Review.
- The Golden Path shows optional extras (Shape, Camera and light, Visual review, Looks) only after you have started using them. They never block Deliver and never change the progress percentage.
- Packages now contain `Project Bible/design_records.json`.

## Going back

An older app does not read what 0.52 adds. Its reader does not check for unknown fields, so a version 1 file should still open there without the new records (this has not been tried on an older build).
