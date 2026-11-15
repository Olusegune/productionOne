# Production One 0.36.0

**Cinematic is now the default look**, and it has been polished.

- **Default.** The app starts in Cinematic. Studio and Futurist are still in Appearance (the palette icon at the bottom of the sidebar, or Ctrl+K, then "Appearance"). A look is remembered only when you choose one, so everyone starts in Cinematic once, whatever an earlier version had saved.
- **Polish.**
  - The page takes a soft tint from your visual style's palette.
  - Panels have depth, and page titles are larger, in a serif face.
  - The script is shown as a centred, page-width column.
  - The cast has bigger portraits (76 px), and the asset type no longer cuts "Character" short.
  - The gold primary button has a gentle gradient and glow.
  - Cards lift and rows warm on hover (switched off when your system asks for reduced motion).
  - Selection and scrollbars follow the accent.

Checked: the real type check, 406 JS tests and 78 Rust tests, `npm audit` and `cargo audit` (0 vulnerabilities), a layout and contrast audit of all six workspaces in Cinematic (dark and light, 1024, 1440 and 1920 px), and the packaged app on a real project.

Not done: older screens that hard-code colours follow a look only partly. A few light-theme labels (emotion chips, "universal", one Deliver note) are still low contrast. The guide's screenshots still show the older top bar. The remote Rafter scan could not run (plan quota).

Windows x64: installer (setup.exe), MSI and a portable zip. Not code-signed, so Windows SmartScreen may warn.
