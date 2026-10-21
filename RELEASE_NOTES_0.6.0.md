# Production Guy 0.6.0

This release modernizes the Projects workspace with a cinematic unified project hero, real production statistics, clearer hierarchy, responsive department cards, and four original Production Guy visual assets for Story, Design, Direct, and Deliver.

The five-workspace architecture remains intact. Card labels and controls are native accessible UI rather than text baked into imagery, and every department card navigates to its working workspace.

Verification:

- 24 frontend/domain tests passed.
- Eight Rust/native tests passed.
- TypeScript/Vite production build passed.
- Wide-desktop and compact responsive visual checks passed.
- Department-card navigation was verified in the live application.
- NSIS and MSI packaging passed.
- The executable remains PE subsystem `2` (`Windows GUI`), without the former console window.

Windows SHA-256:

- Setup EXE: `0DB13973C00081B01A33B5476B5B616F45C51252C95F19933EDBD4CEF2BAF80D`
- MSI: `7FBA8983523C47A56B2CD56AD74C16C152325A6DBB67C4FBF080C1626E673172`

The installers remain unsigned.
