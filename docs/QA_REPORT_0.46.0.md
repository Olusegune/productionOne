# QA and release gate, 0.46.0 (2026-11-17)

Run on the branch that became 0.46.0, after the owner asked for: a way to change an approve/reject decision, the newest image and video models, a drop-down instead of a radio list, sets and props that can be added, and a fix for a squashed colour switch and a sliding control panel.

## Verdict
Go for the changes below. One real paid generation was run (Nano Banana Pro). The full-story run-through the owner asked for has not been done yet: the story had not arrived.

## Gate results
| Check | Result |
|---|---|
| Types: `npx tsc -b` | Pass |
| JS tests | 570 pass in 85 files (30 more; 4 tests that encoded old behaviour were rewritten) |
| Rust tests | 83 pass, 1 ignored (one small change in kie.rs: retry the model page once) |
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

## Story run-through ("No VIP in Hell", real app, isolated copy)
The owner's seven-scene script was pasted into a new production and taken as far as one paid clip.
| Step | Result |
|---|---|
| Analyze | **Defect found and fixed.** Numbered headings (`SCENE 2 — INT. ...`) made the reader treat the script as a shot list: 0 dialogue, FLEX flagged "never speaking", six sets for one office. After the fix: screenplay, 7 scenes, speakers PA VOICE, FLEX, VENOMSPUR (plus RECORDED FLEX), 3 sets, 23 assets. Still imperfect: a few props are noise (`bell rings`, `picture`, `trophy`, `passes somewhere far below`), costumes (the puffer jacket) are not found, and RECORDED FLEX is a recording, not a character. |
| Design | Style locked; Venomspur and King Flex front views (Nano Banana Pro, Google direct) matched the script's description; the office establishing view showed the desk, lamp, typewriter and arched window. All three approved (3 of 27). |
| Direct | Planned scene 2 into 10 shots; the Master shot used both approved characters and the approved office (one frame, approved). |
| Motion (video) | Kling 2.6 on Venomspur: refused by Kie.ai with a copyright-restriction message (no clip). MiniMax H3 image-to-video: worked (1440x1920, 5.2 s, same character). HappyHorse 1.1 image-to-video: first attempt said Kie had no such model page (wrong: the page exists; a transient fetch failure), second attempt worked (1244x1666, 5.2 s). |
| Money | Four Nano Banana Pro images and two video clips. No confirmation sheet appeared for any of them (price unknown for images; the motion demo has none). Exact spend is not shown by the app; it is well inside the 5-10 USD budget. |

Not covered: scenes 1 and 3 to 7, voices and music, the animatic with real frames, Deliver, and the other new video and image models (Seedance 2.5, Kling 4.0, Wan 3.0, PixVerse, Grok, Seedream 5.5, GPT Image 2.6).

## Paid generation (earlier, before the run-through)
One image, Nano Banana Pro through Google direct (`gemini-3-pro-image`), an Interior view of a test set built from a generated, art-free reference. It came back as a 1376x768 picture and was marked Needs review. Spend: one image. No video was generated. No other new model was run.

Finding: with no price set in the spending limit, the app did not ask for confirmation before sending that one image. It was a deliberate single test, but the owner may want a confirmation whenever the price is unknown.

## Not checked
- The full story run-through beyond the steps listed above.
- Kie.ai's request for the new video models and for Seedream 5.5, GPT Image 2.6, MiniMax H3, Ideogram Character and Wan 2.7 Image Pro was not tried (no paid run): they are listed, their requests are built from Kie's own model pages.
- Adding a set/prop/costume from an image through the Add to the bible dialog; the light theme; the native drop-down pop-up appearance.
- Installer on a clean machine; Playwright and Python suites; clippy.
