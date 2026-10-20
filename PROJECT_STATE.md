# PROJECT_STATE v1

- **Title:** Production Guy
- **Pitch:** Your AI Production Department — a Windows-first preproduction and visual-development studio.
- **Platform / stack:** Windows, Tauri 2, Rust, React, TypeScript, Vite.
- **Visual direction:** Dark graphite surfaces, restrained champagne-gold accents, director's-chair mark.
- **Approved scope:** Four-release product architecture and working offline production pipeline.
- **Completed evidence:** Script analysis, editable scene/asset inventory, portable prompt compiler, durable external-workflow queue, optional shot editor, performance/audio metadata, animatic timing, coverage audit, Seedance/Kling/Veo package compiler, native persistence, automated tests, and Windows packaging foundation.
- **Deferred / blocked:** Live provider verification and paid image/video generation require provider credentials and an approved spending ceiling. Model capability presets remain visibly unverified until checked against current provider documentation.
- **Key paths:** `src/domain/productionGraph.ts`, `src/data/projectStore.ts`, `src-tauri/src/lib.rs`, `MIGRATION_PLAN.md`.
- **Open blocker:** Production installers are not code-signed; Windows may display an unknown-publisher warning.
- **Next task:** Add provider credential management, official capability discovery, and one credentialed end-to-end image generation acceptance test.
- **Acceptance test:** Configure one provider, generate a labeled asset file, restart the app, and export a package referencing that verified file.
- **Last known build:** `0.4.0` Windows x64 development build.
