# QA report: 0.49.0 (2026-11-18)

Scope: upscalers in Image quality (Real-ESRGAN, Topaz, Magnific).

## Gate results
| Check | Result |
|---|---|
| tsc (`tsc -p tsconfig.app.json`) | Pass |
| JS tests | 630 pass (5 new) |
| Rust tests | 96 pass (8 new) |
| clippy -D warnings, npm run build, npm audit | Pass, 0 vulnerabilities |

## Real app (isolated copy)
| Check | Result |
|---|---|
| Enlarge shows the four methods; picking Topaz shows the cost warning and a button named "Upscale 2x with Topaz (paid) and save" | Pass |
| Pressing it sends the picture to Kie | Reached Kie: upload and task creation worked |
| Topaz result | **Failed**: Kie answered "ConnectException: Operation timed out" on three tries (about 4 minutes each). No file was produced. |
| The failure is shown inside the panel | Pass (found because the first attempt showed nothing; fixed) |

## Follow-up (2026-11-19)
Topaz was tried twice more: with a proper file extension on the upload, and with Kie's own documented example image URL in place of our upload. Both gave the same 500 ConnectException timeout, so the failure is on Kie's Topaz service, not in the app's upload. Still no successful Topaz result.

## Not checked
- A successful Topaz upscale. Cause unknown: Kie's service, or its access to the uploaded file.
- Magnific (no key; built from docs) and Real-ESRGAN end to end (no ComfyUI with the model).
- Whether the failed Topaz tasks were charged (check the Kie dashboard).
- The light theme, Playwright, installers on a clean machine.
