# QA report: 0.50.0 (2026-11-19)

Scope: 2D style library, prompt compilation, gallery, asset style override, reinterpret, starter assets, place layout.

## Gate results
| Check | Result |
|---|---|
| tsc (`tsc -p tsconfig.app.json`) | Pass |
| JS tests | 671 pass, 1 skipped (the file writer, run with WRITE_2D_DEMO=1) |
| Rust tests | 89 pass (1 new: a compiled 2D prompt reaches every provider body unchanged) |
| clippy -D warnings, npm run build, npm audit | see the PR checks and final report |

## What the tests prove (mocked: data flow and request construction, not visual quality)
- Existing presets: same names in the same order, text and palette unchanged, default style unchanged, non-2D prompts identical to before, old projects open with the style unchanged.
- New presets: searchable and selectable; every one compiles different text (no two alike, no duplicate line or shading text).
- A 2D style reaches the job prompt and every provider request body; no pores, studio light, 5500K, white balance or "photographic frame" in any 2D prompt; storyboard frames use a drawn layout instead of a lens.
- Intentional texture survives the quality guidance; no colour cast is added.
- Character, prop and place sheets (turnaround, expressions, poses, costume, multi-view, establishing, plan) carry the style; the layout is in every place view and shot; sheets are built from the newest approved reference; reinterpret creates a new unapproved revision and keeps the original approved.
- Style override, description and layout survive save and reopen; the exported style JSON carries the whole 2D spec; no absolute paths or keys.

## Real app (isolated copy, new project)
| Check | Result |
|---|---|
| 2D chip shows 38 styles; search "pixel" finds 2; detail shows settings, what the app makes and the provider note | Pass |
| Add a set from a description and layout; no character fields for a set | Pass |
| Style row: inherited, then overridden with Watercolor Storybook, then back | Pass |
| Layout and description fields on the sheet controls | Pass |
| Console errors | None |

## Not checked
- **No live generation.** No 2D preset was generated with any image model. Style adherence, identity, linework, palette and sheet consistency are unverified, and no model is claimed to do any style well.
- Reinterpret and "Add and make a first concept" were not pressed in the real app (each costs an image request); they are tested with mocks.
- Pixel-art grid accuracy, the light theme, Playwright, installers on a clean machine.
