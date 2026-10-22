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
- The page never uses `innerHTML`, `eval` or shell strings. The renderer's content-security policy is not locked down yet (`csp: null`); this is listed below.
- CleanRender never overwrites the original image: corrections are saved as new numbered files.
- Scans: `rafter secrets` before every push (clean at last run); `npm audit`; `cargo clippy -D warnings`.

## Known gaps
- The installer is not code-signed.
- No content-security policy yet (the app loads only its own bundle, but a strict policy would add defence in depth).
- A spending cap is optional and local; the provider's own billing limits are the real protection.
- `pdf-extract` parses PDFs you choose to import; only import files you trust.

## Reporting a problem
Open a private security advisory on the GitHub repository, or email the maintainer. Please do not post keys or project files publicly.
