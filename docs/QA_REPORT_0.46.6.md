# QA report: 0.46.6 (2026-11-18)

Scope: two headings for one room made two sets (found in No VIP in Hell: the office and the office / corridor).

## Gate results
| Check | Result |
|---|---|
| tsc | Pass |
| JS tests | 598 pass |
| Rust tests | 84 pass (no Rust change) |

## What changed
| Change | Unit tests | Real app |
|---|---|---|
| Slash headings fold into the plain place | castLimits.test.ts | Not run on its own; the folded heading is seen in the unit test |
| Merge sets | mergeAssets.test.ts, CastBoard.test.tsx | Pass in an isolated copy with the No VIP in Hell project: scene 7's set showed the Merge control and listed the other two sets; merging took the project from 21 to 20 assets and 3 to 2 sets. Not saved. |

## Not checked
- clippy, Playwright, Python suites, installers on a clean machine.
- Frames made before the merge are not changed.
