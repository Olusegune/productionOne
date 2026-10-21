# Production Guy

**Your AI Production Department.** A Windows-first preproduction and visual-development studio.

## Current release

- Premium graphite-and-champagne application shell
- Five primary workspaces: Projects, Story, Design, Direct, Deliver
- Optional storyboarding surfaced through Direct
- Canonical typed Production Graph: Project → Scene → Shot → Asset → Story Variant → Sheet → Revision
- Stable IDs, revision increments, transitive dependency discovery, and selective stale-state marking
- Native atomic project persistence with schema versioning
- Editable script-derived inventory and persistent custom Style Bible
- Sheet matrix, story-variant detection, prompt modes and model matching
- Durable prompt queue with pause, resume, cancel, retry and verified outputs
- Native image import, QA, deterministic labels and budget-gated OpenAI generation
- Multi-shot director, acting/audio metadata and timed animatic preview
- Seedance/Kling/Veo Shot Compiler, scene coverage and validated production ZIPs

## Run locally

```powershell
npm install
npm run dev
```

## Run as a Windows desktop application

```powershell
npm run desktop:dev
```

## Build Windows installers

```powershell
npm run desktop:build
```

The MSI and NSIS installers are written under `src-tauri/target/release/bundle/`.

## Verify

```powershell
npm test
npm run build
cargo test --manifest-path src-tauri/Cargo.toml
```

See [MIGRATION_PLAN.md](./MIGRATION_PLAN.md) for the repository audit and phased preservation strategy.
