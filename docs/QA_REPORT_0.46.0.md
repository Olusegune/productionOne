# QA and release gate, 0.46.0 (2026-11-17)

Run on the branch that became 0.46.0, after the owner asked for: a way to change an approve/reject decision, the newest image and video models, a drop-down instead of a radio list, sets and props that can be added, and a fix for a squashed colour switch and a sliding control panel.

## Verdict
Go for the changes below. One real paid generation was run (Nano Banana Pro). The full-story run-through the owner asked for has not been done yet: the story had not arrived.

## Gate results
| Check | Result |
|---|---|
| Types: `npx tsc -b` | Pass |
| JS tests | 566 pass in 84 files (26 more; 4 tests that encoded old behaviour were rewritten) |
| Rust tests | 83 pass, 1 ignored (no Rust change) |
| `npm audit` | 0 vulnerabilities |
| `cargo clippy`, `cargo audit`, Playwright and Python suites, `rafter secrets` | Not run in this pass (no Rust, dependency or engine change); run before release |

## What changed and how it was checked
| Change | Unit / component tests | Real app (isolated copy of the build) |
|---|---|---|
| Approve a rejected picture; reject an approved one; Undo approval / Undo reject / Not decided | generationQueue (approve, reject, reconsider, no approval without a file), review (approved list), Review view (4 flows), Lightbox (U key, buttons) | Pass: supplied image -> Undo approval -> Approve -> Reject -> Undo reject -> Reject -> Approve; the bible's "N approved" count and the card label followed each step. Review: approve, Approved list, Take back approval, Reject, Turned down, Approve. |
| Taking back the only approved front removes the asset's Approved label | via `reconcileMissing` (existing tests) and the app wiring | Pass (count 1 -> 0 -> 1) |
| Newest models (Seedream 5.5, GPT Image 2.6, MiniMax H3, Nano Banana Pro) in a drop-down, every other image model below | imageCatalog (12 tests), EngineSwitch (5 tests) | Pass: a failed view listed "Newest models" (8) and "Other image models" (33); Nano Banana 2.1 marked used before |
| Add to the bible (character, costume, prop, set; with or without image) | BibleAdd (6), readingActions (4 more) | Pass for a set without an image (appears under Sets, selectable). Adding with an image through the native file dialog was run for "Use my image" only, not for this dialog. |
| More video models (Seedance 2.5, Kling 4.0, Wan 3.0, HappyHorse 1.1, MiniMax H3, PixVerse V6, Grok Imagine 1.5) | videoPresets (3), MotionDemo drop-down (1), imageCatalog | Deliver's model list shows all of them (checked). The motion demo drop-down was checked in a component test only: no character in the test project had an approved front. |
| Colour-scheme switch no longer squashed; sheet controls no longer scroll in their own box; Shape field no longer zero width | computed-style checks | Pass: switch buttons 136x38 px with their words; rail position static / overflow visible; Shape and Backdrop fields 261 px each |

## Paid generation
One image, Nano Banana Pro through Google direct (`gemini-3-pro-image`), an Interior view of a test set built from a generated, art-free reference. It came back as a 1376x768 picture and was marked Needs review. Spend: one image. No video was generated. No other new model was run.

Finding: with no price set in the spending limit, the app did not ask for confirmation before sending that one image. It was a deliberate single test, but the owner may want a confirmation whenever the price is unknown.

## Not checked
- The full story run-through (story not received).
- Kie.ai's request for the new video models and for Seedream 5.5, GPT Image 2.6, MiniMax H3, Ideogram Character and Wan 2.7 Image Pro was not tried (no paid run): they are listed, their requests are built from Kie's own model pages.
- Adding a set/prop/costume from an image through the Add to the bible dialog; the light theme; the native drop-down pop-up appearance.
- Installer on a clean machine; Playwright and Python suites; clippy.
