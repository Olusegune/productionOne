# PROJECT_STATE v1

- **Title:** Production One (formerly Production Guy)
- **Pitch:** Your AI Production Department — a Windows-first preproduction and visual-development studio.
- **Platform / stack:** Windows, Tauri 2, Rust, React, TypeScript, Vite.
- **Visual direction:** Neutral charcoal surfaces, one typeface (Inter), a single champagne-gold accent, director's-chair mark; light theme opt-in. See `docs/DESIGN.md`.
- **Approved scope:** Four-release product architecture and working offline production pipeline.
- **Completed evidence:** Script analysis, editable scene/asset inventory, portable prompt compiler, durable external-workflow queue, optional multi-shot editor, reorder/duplicate/delete, real timed animatic playback, performance/audio metadata, coverage audit, verified Seedance/Veo presets, explicit Kling verification warning, native persistence, secure credentials, native image QA/labeling, ZIP production packages, automated tests, and Windows installers.
- **Deferred / blocked:** A paid live provider acceptance call requires a user-supplied credential and an approved spending ceiling. No credential or paid call is simulated.
- **Key paths:** `src/domain/productionGraph.ts`, `src/data/projectStore.ts`, `src-tauri/src/lib.rs`, `MIGRATION_PLAN.md`.
- **Open blocker:** Production installers are not code-signed; Windows may display an unknown-publisher warning.
- **Next task:** Run one user-authorized credentialed paid acceptance task and code-sign the resulting installers when signing credentials are available.
- **Acceptance test:** Configure KIE, enter an explicit per-task spending ceiling, submit one Seedance task, poll it to completion, import/label the result, restart the app, and export a ZIP referencing that verified file.
- **Last known build:** `0.42.0` Windows x64 NSIS and MSI, on `main`. Latest QA: `docs/QA_REPORT_0.42.0.md`. 493 JS and 78 Rust tests pass; `cargo audit` and `npm audit` report 0 vulnerabilities. User guide with screenshots: `docs/USER_GUIDE.md`.
