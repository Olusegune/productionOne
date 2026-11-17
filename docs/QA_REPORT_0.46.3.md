# QA report: 0.46.3 (2026-11-17)

Scope: no extra people in a shot that has a cast; a described prop shows only what it describes. Found by looking at the regenerated "No VIP in Hell" frames: scene 1's master had background demons the script never mentions, and the photograph insert showed a woman beside the boy.

## Gate results
| Check | Result |
|---|---|
| Types: `npx tsc -b` | Pass |
| JS tests | 589 pass (3 more: castLimits.test.ts) |
| Rust tests | 84 pass (no Rust change) |
| clippy, `npm audit`, Playwright and Python suites, `rafter secrets` | Not run in this pass (no Rust or dependency change) |

## What changed and how it was checked
| Change | Unit tests | Real app (isolated copy) |
|---|---|---|
| A shot with a cast asks for only those people (not establishing shots) | castLimits.test.ts | Pass: the scene 1 master, regenerated, shows only Flex and Venomspur (before: demons in the background) |
| A described prop's shot prompt and sheet prompt ask for exactly the description | castLimits.test.ts | Pass: the photograph's own picture (regenerated) shows the boy alone, and its insert frame (regenerated from it) shows the same boy with no woman. The first insert regenerate, with only the shot prompt changed, still had the woman: she came from the prop's reference picture, which is why the sheet prompt needed the rule too. |

## Not checked
- The other 63 frames were not regenerated with the new rule, so they may still carry extra figures; only scene 1's master and the photograph insert were redone.
- The new rule only asks the model; a model can still ignore it.
- clippy, Playwright, Python suites; installers on a clean machine.

## Paid generation
Five images (scene 1 master twice, photograph picture, photograph insert twice).
