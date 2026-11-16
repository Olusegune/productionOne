# QA and release gate, 0.44.0 (2026-11-16)

Run on the branch that became 0.44.0: engine choice on a view that must be made again, and honest Deliver advice for takes whose picture is gone (this was prepared as 0.43.5 and never released on its own).

## Verdict
Go. Tested in unit and component tests and in a separate copy of the release build. No paid generation was run for this release.

## Gate results
| Check | Result |
|---|---|
| Types: `npx tsc -b` | Pass |
| JS tests | 524 pass (14 more than at 0.43.4: engine options 5, engine switch component 3, reassigning a view 2, checklist advice 2, failure groups 2) |
| Rust tests | 81 pass, 1 ignored (no Rust change) |
| `cargo clippy --all-targets -- -D warnings` | Clean |
| `npm audit` / `rafter secrets .` | 0 vulnerabilities / clean |
| `cargo audit`, Playwright and Python suites | Not run: no dependency or engine change |

## What changed
- **Engine choice** (`quickEngines`, `EngineSwitch`): on a failed or waiting sheet view the card offers Nano Banana 2.1, Seedream 5.0 Pro, GPT Image 2.5 and a model on this computer. Choosing sends nothing; Use is the confirming click and the spending limit applies. A view built from the approved front uses the image-to-image variant. An engine without a key says which key; one that cannot take references says "no identity lock" and, when chosen, drops that view's reference and anchor (`reassignModel`, `takesReferences`). Fallbacks: OpenAI direct (GPT Image 1.5) and OpenRouter (Seedream 4.5) when there is no Kie.ai key.
- **Deliver advice:** takes whose picture is gone have their own checklist line, failure group (Open Design only) and Pictures missing count; Failed jobs counts only real failures.

## Real app (separate copy of the release build)
- Deliver, project with two pictures gone: no "Retry them, or choose a different model" line; Pictures missing 2, Failed jobs 0; the group offers Open Design only.
- Sheet view cards of a project with two failed views: two engine switches, each listing Nano Banana 2.1, Seedream 5.0 Pro, GPT Image 2.5 and "On this computer: Image: any checkpoint (SDXL and similar) (no identity lock...)"; the button reads "Use Nano Banana 2.1"; 0 console errors. The test project was made by editing a saved project file.

## Not checked
- **No picture was generated through the new engines.** Whether Seedream 5.0 Pro image-to-image or GPT Image 2.5 image-to-image on Kie.ai accept this app's request and keep the character was not tried (no paid run). The model ids come from the app's built-in list of Kie.ai's published index; Kie checks the request against its own schema at run time.
- The local option was listed but not run; ComfyUI was not started.
- Prices were not read; the cost line still follows the owner's own price setting.
- The existing "Retry" button still appears on such cards and re-sends the same engine's request; it was left as it was.
- Item "Seedance": Seedance is ByteDance's video model. The picture model offered is Seedream 5.0 Pro. Seedance is already available for video elsewhere in the app.
- The owner's own project was not opened. Welcome-card spacing (0.43.1) still unseen.
- Installer on a clean machine; Playwright and Python suites.
