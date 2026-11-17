# QA and release gate, 0.45.1 (2026-11-16)

Run on the branch that became 0.45.1, after the owner pointed out that Nano Banana had disappeared from the engine choice.

## Verdict
Go. A small fix to a list, tested in unit and component tests and in the real app. No picture was generated.

## Gate results
| Check | Result |
|---|---|
| Types: `npx tsc -b` | Pass |
| JS tests | 540 pass (2 more; 3 tests that encoded the old behaviour were rewritten) |
| Rust tests | 83 pass, 1 ignored (no Rust change) |
| `cargo clippy --all-targets -- -D warnings` | Not re-run: no Rust change since 0.45.0 |
| `npm audit` / `rafter secrets .` | See below |
| `cargo audit`, Playwright and Python suites | Not run: no dependency or engine change |

## Cause and fix
`EngineSwitch` removed from its list the engine the view had used before. For a view made with Nano Banana 2.1 that removed Nano Banana, so it looked as if the series had been taken out. Now every engine is always listed; the one used before is marked "used before" and can be chosen again. The main image-model picker was not touched and still lists every Nano Banana model.

More image models were added to the list: Nano Banana Pro (Google key), Ideogram Character and Wan 2.7 Image Pro (Kie.ai), next to Nano Banana 2.1, Seedream 5.0 Pro, GPT Image 2.5 and a model on this computer.

## Real app (separate copy of the release build)
A project with two failed views that had been made with Nano Banana 2.1 (Google) listed: Nano Banana 2.1 (used before, selected), Nano Banana Pro, Seedream 5.0 Pro, GPT Image 2.5, Ideogram Character, Wan 2.7 Image Pro, and the local model with "no identity lock". The button read "Use Nano Banana 2.1". 0 console errors.

## Not checked
- No picture was generated through any engine in this list; whether Kie.ai accepts the request for Ideogram Character or Wan 2.7 Image Pro with this app's references was not tried (no paid run).
- Nano Banana Pro through Google was listed from the app's built-in catalog; the id was not tested against Google.
- The owner's own project was not opened.
- Installer on a clean machine; Playwright and Python suites.
