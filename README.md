# Production Guy

**Your AI Production Department.** A Windows-first preproduction and visual-development studio.

## Current foundation

- Premium graphite-and-champagne application shell
- Five primary workspaces: Projects, Story, Design, Direct, Deliver
- Optional storyboarding surfaced through Direct
- Canonical typed Production Graph: Project → Scene → Shot → Asset → Story Variant → Sheet → Revision
- Stable IDs, revision increments, transitive dependency discovery, and selective stale-state marking
- Local project persistence with schema versioning

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
```

See [MIGRATION_PLAN.md](./MIGRATION_PLAN.md) for the repository audit and phased preservation strategy.
