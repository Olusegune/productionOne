# PROJECT_STATE v1

- **Title:** Production Guy
- **Pitch:** Your AI Production Department — a Windows-first preproduction and visual-development studio.
- **Platform / stack:** Windows, Tauri 2, Rust, React, TypeScript, Vite.
- **Visual direction:** Dark graphite surfaces, restrained champagne-gold accents, director's-chair mark.
- **Approved scope:** Release 1 application shell, five workspaces, canonical Production Graph, stable IDs, revision impact analysis, native project persistence, Windows installers.
- **Completed evidence:** Three frontend domain tests, one Rust test, TypeScript production build, optimized Windows executable, NSIS installer, MSI installer.
- **Deferred:** Script intelligence, SQLite repository, production asset editing, providers, model registry, queues, real image generation, QA/export pipeline, optional storyboard director, Shot Compiler.
- **Key paths:** `src/domain/productionGraph.ts`, `src/data/projectStore.ts`, `src-tauri/src/lib.rs`, `MIGRATION_PLAN.md`.
- **Open blocker:** Production installers are not code-signed; Windows may display an unknown-publisher warning.
- **Next task:** Implement script import and editable production inventory on a SQLite-backed graph repository.
- **Acceptance test:** Import a script and persist accurate editable scene-to-asset relationships across app restarts.
- **Last known build:** `0.1.0` Windows x64 alpha.
