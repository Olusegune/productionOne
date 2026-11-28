# QA report 0.68.0

Scope: Skin & Surface (profile, presets, controls, protected refinement, comparison), vehicles, Wardrobe preflight.

## Automated
- Type-check clean; 1564 web tests pass (1 skipped); 128 Rust tests pass; production web build clean; static accessibility gate passes; the project's acceptance script passed in 0.67.0 and was not changed.
- Skin and vehicle records are covered by the fuzz test (saved projects damaged 1500 ways never crash a reader, and reading is stable).
- Refinement: a queue contract test (each request has exactly one reference, no approval on generation), the queue-to-record approval path, retry cost history, locally refused requests left out of spend, provider capability and missing-reference messages, identity-before-approval gate, warm-undertone handling, 2D and stylized styles refused.

## Live (test copy of the app)
- A realistic project (your Summit Sprout, opened in the test window): the Skin & Surface section opens by default, Generate refinement is disabled with a plain reason until a profile is approved, then enabled; saving the profile queued nothing.
- The first refinement attempt was refused before reaching the provider because the project's pictures live outside the test app's folder. No money was spent. The refusal is now explained on screen.

## Not covered
No real picture of a refinement has been produced or judged, so the quality of skin on real characters is untested and needs a person's eyes; no screen-reader run; Mac and signing unchanged; Rafter's scan did not run (allowance used up).
