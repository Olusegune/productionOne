# QA report: 0.46.1 (2026-11-17)

Scope: costumes and props, found from the script and used in the storyboard frames. Found while running "No VIP in Hell" through 0.46.0.

## Gate results
| Check | Result |
|---|---|
| Types: `npx tsc -b` | Pass |
| JS tests | 580 pass (7 more: `src/engine/costumes.test.ts`) |
| Rust tests | 84 pass (no Rust change) |
| `cargo clippy`, `npm audit`, Playwright and Python suites, `rafter secrets` | Not run in this pass (no Rust or dependency change); run before relying on this release |

## What changed and how it was checked
| Change | Unit tests | Real app (isolated copy of the build) |
|---|---|---|
| Costumes read from the script (one costume per character, from a sentence or the fragments that follow it; two worn items needed; later actions are not clothes) | costumes.test.ts (story reading, a single "in a coat" is not a wardrobe) | Pass: the script now shows Costumes 2 (FLEX costume, VENOMSPUR costume), before 0 |
| Costume description (the script's words) in the wardrobe sheet prompt | costumes.test.ts | Pass: one costume picture for VENOMSPUR showed the black suit, red bow tie, red pocket square and round glasses from the script words |
| Cleaner props (a bell ringing, a lift passing and a simile are not props; photograph and picture are one) | costumes.test.ts, engine tests | Pass: Props 12 (before 16), no `bell rings`, `picture`, `trophy`, `passes somewhere far below` |
| Costumes and props in shots (master and dialogue shots, wardrobe and props lines in the prompt, approved costume/prop pictures as references, inserts for props that return) | costumes.test.ts (planning, prompt, references) | Pass: scene 2 now plans 12 shots including inserts for the fountain pen and the typewriter; the master frame showed the typewriter, lamp and pen on the desk and both costumes as designed |

## Paid generation
Two images through Nano Banana Pro (one costume picture, one storyboard master frame), plus the earlier references. No video.

## Not checked
- The typewriter insert frame (the click missed after the first approval) and the other 63 shots.
- Costumes for characters described only in prose (no screenplay format), other languages, and a costume that changes between scenes (only one costume per character is made).
- Flex's trainers lose "with glowing orange soles" (the item is cut at "with").
- Props are still found by noun list and verbs: an unusual object may be missed.
- Installer on a clean machine; clippy, Playwright, Python suites.
