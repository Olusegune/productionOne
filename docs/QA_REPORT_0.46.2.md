# QA report: 0.46.2 (2026-11-17)

Scope: props that show something use the script's description; planning a scene again no longer duplicates kept shots. Found by checking the "No VIP in Hell" storyboard: the photograph insert showed a framed horned figure instead of the boy behind a birthday cake.

## Gate results
| Check | Result |
|---|---|
| Types: `npx tsc -b` | Pass |
| JS tests | 584 pass (4 more: propDescriptions.test.ts, replan test) |
| Rust tests | 84 pass (no Rust change) |
| clippy, `npm audit`, Playwright and Python suites, `rafter secrets` | Not run in this pass (no Rust or dependency change) |

## What changed and how it was checked
| Change | Unit tests | Real app (isolated copy) |
|---|---|---|
| A photograph (and picture, painting, map, letter, ...) keeps the lines that describe it; ordinary objects do not | propDescriptions.test.ts | Pass: the photograph's asset prompt read "A modest kitchen. A small boy sitting behind a birthday cake."; its insert frame showed a boy with a cake in a kitchen photograph (twice: a fresh plan and a regenerate of the existing shot) |
| Description in the prop sheet prompt, the insert shot action and the prop line of shot prompts | propDescriptions.test.ts | Pass (as above) |
| Replan keeps approved shots once and refreshes their action and cast | direct.test.ts | Partly: on a project made before 0.46.1 the new plan's titles differ from the old ones (e.g. "Master: PA VOICE and FLEX" vs "Master: FLEX and VENOMSPUR"), so those shots were added as new ones (65 -> 75). Not harmful but untidy. |

## Findings not fixed
- **Analyze script on a project opened from a file** moved nearly every shot into scene 1 (59 shots in scene 1, one in each other scene). The saved file itself is intact: reopening it without re-analysing showed 7/12/11/10/10/9/6 shots. Cause not found. Do not press Analyze script on an opened project until fixed.
- A regenerate failed once at the provider with no reason shown, and worked on retry.
- Props are still read from a noun list; an unusual object may be missed.

## Paid generation
Three images (photograph insert frames and one regenerate).
