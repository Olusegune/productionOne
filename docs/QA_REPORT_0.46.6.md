# QA report: 0.46.6 (2026-11-18)

Scope: two headings for one room made two sets (found in No VIP in Hell: the office and the office / corridor).

## Gate results
| Check | Result |
|---|---|
| tsc | Pass |
| JS tests | 598 pass |
| Rust tests | see PR |

## What changed
| Change | Unit tests | Real app |
|---|---|---|
| Slash headings fold into the plain place | castLimits.test.ts | see below |
| Merge sets | mergeAssets.test.ts, CastBoard.test.tsx | see below |

## Not checked
- clippy, Playwright, Python suites, installers on a clean machine.
- Frames made before the merge are not changed.
