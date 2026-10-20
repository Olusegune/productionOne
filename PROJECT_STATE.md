# PROJECT_STATE v1

- **Title:** Production Guy
- **Pitch:** Your AI Production Department — a Windows-first preproduction and visual-development studio.
- **Platform / stack:** Windows, Tauri 2, Rust, React, TypeScript, Vite.
- **Visual direction:** Dark graphite surfaces, restrained champagne-gold accents, director's-chair mark.
- **Approved scope:** Four-release product architecture and working offline production pipeline.
- **Completed evidence:** Script analysis, editable scene/asset inventory, portable prompt compiler, durable external-workflow queue, optional shot editor, performance/audio metadata, animatic timing, coverage audit, verified Seedance/Veo presets, explicit Kling verification warning, native persistence, secure credentials, native image QA/labeling, ZIP production packages, automated tests, and Windows packaging foundation.
- **Deferred / blocked:** A paid live provider acceptance call requires a user-supplied credential and an approved spending ceiling. No credential or paid call is simulated.
- **Key paths:** `src/domain/productionGraph.ts`, `src/data/projectStore.ts`, `src-tauri/src/lib.rs`, `MIGRATION_PLAN.md`.
- **Open blocker:** Production installers are not code-signed; Windows may display an unknown-publisher warning.
- **Next task:** Connect native asset import/labeling controls and credential status/removal to the desktop interface, then run one user-authorized credentialed acceptance call.
- **Acceptance test:** Configure one provider, generate a labeled asset file, restart the app, and export a package referencing that verified file.
- **Last known build:** `0.4.0` Windows x64 development build.
