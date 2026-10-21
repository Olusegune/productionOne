# Production Guy 0.5.1

This hotfix corrects the Windows launcher subsystem. Production Guy release builds now run as native GUI applications and no longer open a black console window whose closure terminates the application.

Verification:

- 24 frontend/domain tests passed.
- Eight Rust/native tests passed.
- TypeScript/Vite production build passed.
- NSIS and MSI packaging passed.
- The compiled executable reports PE subsystem `2` (`Windows GUI`).
- A launch smoke test produced the Production Guy main window without a parent console.

Windows SHA-256:

- Setup EXE: `3081827E72B127CF4963ED6CFC1A1AC5C3D4759DC2E5978E5DCD56CDE596E91B`
- MSI: `709EDE1A9D7A6ED159070859852F362D8ABBF1B4A0A52D4DC11F2E9A1469996C`

The installers remain unsigned. Paid live provider acceptance remains gated on a user credential and explicit budget authorization.
