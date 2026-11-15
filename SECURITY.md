# Security and privacy

## What stays on your computer
- **Projects, images, references and scripts** are files on your disk (`.pone` projects; generated images under the app data folder). Nothing is uploaded to a Production One server: there is none.
- **API keys** live only in the Windows Credential Manager (service "Production Guy", one entry per provider). They are never written to project files, logs or the queue, and each request passes the provider only its own key.
- **Local AI** (Ollama, LM Studio, ComfyUI) is reached only at loopback or private-network addresses. Public addresses are refused.

## What leaves your computer
Only what you start: prompts and reference images go to the provider you picked for a generation (Kie.ai, Google, OpenAI, OpenRouter, fal.ai), the model lists are fetched from each provider, and ComfyUI and model files are downloaded from fixed GitHub and Hugging Face addresses with a checksum check where one is published. No analytics or telemetry.

## Protections in the code
- Every file name that comes from a script or a provider is cleaned before it becomes a path; image tools only read inside the assets folder.
- Key shape is checked on save so a mistyped key fails with a clear message instead of a 401 later.
- Downloads use an allowlist of hosts; archives are unpacked by the system `tar`, not by shell commands built from text.
- The page never uses `innerHTML`, `eval` or shell strings. A strict content-security policy is set (0.29.2): scripts only from the app's own bundle, no inline scripts, images and media only from the app, data and blob URLs and the app's own assets folder, no frames, no forms, no plugins. Checked in the packaged app: a remote script, an inline script and a remote image are all blocked, and the app itself loads with no violations.
- Backend commands that take a file path from the page confine it: images, audio, CleanRender, QA, sheet export, `label_image` and `inspect_image` only touch files inside the assets folder; a labelled image can only be a new `.png` directly in that folder; ComfyUI can only be started from an install the app made; saved projects always end in `.pone`.
- CleanRender never overwrites the original image: corrections are saved as new numbered files.
- Scans before a release: `rafter secrets .` (clean), `npm audit` (0 vulnerabilities), `cargo audit` (0 vulnerabilities at 0.29.2; see below for maintenance warnings), `cargo clippy --all-targets -D warnings` (clean). The remote `rafter run` scan could not run at 0.29.2 because the plan's quota was used up.

## Known gaps
- The installer is not code-signed.
- `cargo audit` reports maintenance warnings (not vulnerabilities) for two crates in the Windows build: `unsafe-libyaml` (through `serde_yaml`, used to read Kie model pages) and `ttf-parser` (through the PDF reader). Linux-only crates in the lock file (`glib`, `zbus`, `rustix` and others) are not part of the Windows build.
- A spending cap is optional and local; the provider's own billing limits are the real protection.
- `pdf-extract` parses PDFs you choose to import and `zip` reads Word files you choose to import; both libraries were upgraded in 0.29.2 to clear published advisories, but only import files you trust.

## Reporting a problem
Open a private security advisory on the GitHub repository, or email the maintainer. Please do not post keys or project files publicly.

- Music (0.31.0): Suno is reached through Kie.ai with the same Kie key (kept in the Windows Credential Manager). Only the text you write is sent, and only when you press Make music. Result files are downloaded only from public https addresses (redirects re-checked), capped at 80 MB while streaming, kept only if they are audio, and saved under the assets folder with a sanitised name. The address check reads the host text and does not resolve DNS.
