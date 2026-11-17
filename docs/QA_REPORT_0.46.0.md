# QA and release gate, 0.46.0 (2026-11-17)

Run on the branch that became 0.46.0, after the owner asked for: a way to change an approve/reject decision, the newest image and video models, a drop-down instead of a radio list, sets and props that can be added, and a fix for a squashed colour switch and a sliding control panel.

## Verdict
Go for the changes below. One real paid generation was run (Nano Banana Pro). The full-story run-through the owner asked for has not been done yet: the story had not arrived.

## Gate results
| Check | Result |
|---|---|
| Types: `npx tsc -b` | Pass |
| JS tests | 573 pass in 85 files (33 more; 4 tests that encoded old behaviour were rewritten) |
| Rust tests | 84 pass, 1 ignored; `cargo clippy --all-targets -D warnings` clean (kie.rs: retry the model page once; adaptive aspect) |
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
The owner's seven-scene script, with the owner's own character art (a 3D-animated King Flex and Venomspur) as the approved fronts. The art is not in the repository.
| Step | Result |
|---|---|
| Analyze | **Defect found and fixed.** Numbered headings (`SCENE 2 — INT. ...`) made the reader treat the script as a shot list: 0 dialogue, FLEX flagged "never speaking", six sets for one office. After the fix: screenplay, 7 scenes, speakers PA VOICE, FLEX, VENOMSPUR (plus RECORDED FLEX), 3 sets, 23 assets. Still imperfect: a few props are noise (`bell rings`, `picture`, `trophy`, `passes somewhere far below`) and the puffer jacket is not found as a costume. |
| Style and references | A "Stylised 3D animated feature" style was set and locked. Both characters were supplied with "Use my image" and became approved fronts. |
| Sets | Office and concourse establishing views (Nano Banana Pro) in the same stylised look. The office came with grey bars above and below (fixed: sets now ask for a full frame). |
| Direct | 58 shots planned across 7 scenes. Nine frames made and approved (scene 1 establishing, scene 2 master and two singles, scene 5 two, scene 6 master, scene 7 two). Faces, jackets, chains, glasses and the red bow tie held from the supplied art. Mis-cast found and fixed: PA VOICE was drawn as a person in a foreground shoulder. |
| Video | Kling 2.6 on Flex: worked (1248x1656, 5 s). Wan 3.0 on Venomspur: worked (1246x1662, 5 s). Seedance 2.5 on Venomspur: first run failed (422, adaptive aspect only); fixed; second run worked (836x1110, 5 s). Earlier with generated art: MiniMax H3 worked; HappyHorse 1.1 failed once on a Kie documentation hiccup (now retried), then worked; Kling 2.6 refused a photoreal face with a copyright message. |
| Money | About a dozen images and six clips across both runs; no confirmation sheet appeared for any of them. The app does not show spend; it is inside the 5-10 USD budget. |

Not covered: the remaining 49 shots, voices and music, the animatic with real frames, Deliver, Kling 4.0, PixVerse, Grok, Seedream 5.5, GPT Image 2.6 and the light theme. A shot's frame was not compared pixel by pixel with the supplied art; likeness was judged by eye.

## Paid generation (earlier, before the run-through)
One image, Nano Banana Pro through Google direct (`gemini-3-pro-image`), an Interior view of a test set built from a generated, art-free reference. It came back as a 1376x768 picture and was marked Needs review. Spend: one image. No video was generated. No other new model was run.

Finding: with no price set in the spending limit, the app did not ask for confirmation before sending that one image. It was a deliberate single test, but the owner may want a confirmation whenever the price is unknown.

## Not checked
- The full story run-through beyond the steps listed above.
- Kie.ai's request for the new video models and for Seedream 5.5, GPT Image 2.6, MiniMax H3, Ideogram Character and Wan 2.7 Image Pro was not tried (no paid run): they are listed, their requests are built from Kie's own model pages.
- Adding a set/prop/costume from an image through the Add to the bible dialog; the light theme; the native drop-down pop-up appearance.
- Installer on a clean machine; Playwright and Python suites; clippy.
