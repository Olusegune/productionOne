# QA report 0.67.0

Scope: milestones 2 to 7 of the production model expansion, vision QA for candidates, the production bible grouping, colour and icon cues, and a stabilisation pass.

## Automated
- Type-check clean; 1503 web tests pass (1 skipped); 128 Rust tests pass; production web build clean; static accessibility gate passes; the project's acceptance script passes.
- Fuzz test: a rich saved project damaged 1500 different ways never crashes any reader or summary, and reading is stable.
- Scale test: 60 characters and about 840 records; every summary finishes in under 15 ms.
- Colour test: every icon hue has at least 3:1 contrast against the page and panels in dark and light themes.
- The 13 scenarios for the new records each have a deterministic test (see docs/PRODUCTION_MODEL_RECONCILIATION.md).

## Live (test copy of the app on a copy of the stress-test project, real local vision model)
- Every workspace, every group and every tab audited at 1440, 1100 and 900 px: console errors, controls cut off by their container, unnamed buttons, duplicate ids, images without alt, unlabeled inputs. Clean at the end.
- Keyboard: arrow keys, Home and End move between tabs; focus rings visible.
- Light and dark themes checked by eye.
- Vision QA: a correct torn-jacket outfit passed; the same question on the correct and a mirrored picture answered "right" and "left" (2 of 2 each).

## Defects found and fixed
1. Script asset card cut off its controls. 2. Tabs not usable from the keyboard. 3. Bible list a one-item sideways strip at 900 px; icon rail buttons 18 px wide. 4. Long names pushed list buttons past the panel. 5. Studio header rule cut through text. 6. Oval tab bar. 7. Earlier: squeezed Anatomy and Relationships tabs, overlapping foldable sections (class name clash), stretched Start branch button, full-size pictures failing against a local model.

## Not covered
No screen-reader run; nothing below 900 px or on a high-resolution screen; no provider calls in this pass, so the picture quality of anything made from the new records is untested; the Mac build (signing certificate secret invalid); Rafter's scan did not run (allowance used up), so the security review was by hand.
