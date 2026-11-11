# Production One

**Your AI Production Department.** A Windows desktop studio for directors and producers: read the story, build the production bible, make consistent reference sheets, plan shots, generate storyboard frames, check continuity, play an animatic and deliver a package, with cloud models or AI running on your own computer.

Built with Tauri 2 (Rust), React and TypeScript. Projects are saved as `.pone` files; older Production Guy `.pguy` projects still open and are never overwritten.

## What it does

| Step | What you get |
|---|---|
| **Create / Story** | Paste or import a script (`.txt`, `.md`, Fountain, Final Draft `.fdx`, Word `.docx`, PDF). The reader finds scenes, characters, props, story variants (wardrobe, injury, age) and emotions, and shows the line each finding came from. |
| **Design** | A production bible, a style bible, and reference sheets per character, prop and set (turnarounds, expressions from the story's feelings, poses, wardrobe, details). Your own images and reference photos work everywhere. Approved front views become the anchor that keeps later views consistent. Image quality (CleanRender) checks colour casts, clipping, noise, bloom and sharpness and corrects them as separate revisions. |
| **Direct** (optional) | The Director's room: coverage planned per scene, a shot editor (camera, composition, blocking, cast and wardrobe, lighting, performance, audio), storyboard frames from your approved references, continuity checks and an animatic. |
| **Deliver** | A readiness summary with the next thing to fix, a shot compiler with an editable prompt for Seedance, Kling and Veo, and verified or draft packages. |

**Models.** Kie.ai (59 image and 47 video models read live), Google Gemini, OpenAI, OpenRouter, fal.ai, and local ComfyUI, Ollama and LM Studio. One searchable picker; any model id can be typed. Cost never interrupts you: an optional spending cap lives in the queue dock.

**Local AI, no internet.** Production One finds Ollama, LM Studio and ComfyUI on your machine, can install ComfyUI and download SDXL and Wan 2.2 5B for you, and runs images, video and the optional AI story pass offline.

## Install

Download `Production One_<version>_x64-setup.exe` (or the `.msi`) from the [latest release](https://github.com/Olusegune/productionOne/releases), run it, and open Production One from the Start menu. The installer registers `.pone` and `.pguy` so double-clicking a project opens it.

Windows 10 or 11 with WebView2 (included in Windows 11; the installer adds it on Windows 10).

## First five minutes

1. **Providers** (top bar): paste a key for one provider. Keys are stored in the Windows credential store, never in project files.
2. **Story**: paste a script or choose **Import script**, then **Analyze script**.
3. **Design**: approve the visual style, pick a character, choose a model, press **Generate**. Use **Test one first** to check the look cheaply.
4. Approve the front view; the other views use it as their reference.
5. **Direct → Plan all scenes**, then **Generate frames**. **Deliver** shows what is left.

No key? Open **Local AI** (top bar) and let it find or install ComfyUI.

## Develop

```powershell
npm install
npm run dev            # browser preview (plans only; generation needs the desktop app)
npm run desktop:dev    # desktop app with hot reload
npm test               # 130+ unit and component tests
cargo test --manifest-path src-tauri/Cargo.toml
npm run desktop:build  # installers under src-tauri/target/release/bundle/
python scripts/make-icons.py   # rebuild icons from branding/
```

Architecture and status log: [docs/PRODUCTION_ONE_PLAN.md](docs/PRODUCTION_ONE_PLAN.md). Testing and what is not covered: [docs/TESTING.md](docs/TESTING.md). Security and privacy: [SECURITY.md](SECURITY.md). Using the app: [docs/USER_GUIDE.md](docs/USER_GUIDE.md). Changes: [CHANGELOG.md](CHANGELOG.md).

## Honest limits

- AI images can have wrong hands, drifting faces and plastic skin. Production One reduces these (prompt guidance, anchors, checks) and tells you when a filter cannot help; it does not remove them.
- Cloud generation costs money at your provider. Production One never states prices; set your own cap if you want one.
- The installer is not code-signed yet, so Windows SmartScreen may warn on first run.

### Delivery modes

Desktop package export is explicit: incomplete projects are exported as `draft` and include an incomplete-reference report. A `verified` export is rejected when referenced media is missing, and deliveries never silently overwrite an earlier ZIP. The app validates the manifest and required package records; provider billing and remote-task reconciliation remain provider-dependent.
