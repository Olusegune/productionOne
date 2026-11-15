# Production One 0.35.0

You can now choose how the app looks.

- **Appearance.** Open the palette icon at the bottom of the sidebar (or Ctrl+K, then "Appearance"). Pick a look and it applies at once, with a preview of each. Your choice is remembered on this computer.
  - **Studio**: the calm graphite and champagne look, as before.
  - **Cinematic**: warmer surfaces, serif page titles (Fraunces), rounder panels, and an accent taken from your visual style's palette, so changing the style changes the accent.
  - **Futurist**: near-black blue, a cyan accent with a soft glow, tighter corners, uppercase labels and a sharper body font (Geist).
  Each look has a dark and a light form, and the same dialog switches between them. A look changes colours, fonts and shapes only; it never changes what a control does.
- **Fixed:** the asset list on the Story screen was cut off after about three rows; it now fills the pane.
- **Fixed:** in the light theme, selected chips and the active sidebar item could have unreadable text.
- Two bundled fonts were added (Fraunces, Geist); nothing is fetched from the network.

Checked: the real type check, 405 JS tests and 78 Rust tests, `npm audit` and `cargo audit` (0 vulnerabilities), a layout and contrast audit of all six workspaces in all three looks (dark and light at 1440 px; the two new looks also at 1024 and 1920 px in the dark theme), and the packaged app (each look applies, the new fonts load, no console errors).

Not done: older screens that hard-code colours follow a look only partly. A few light-theme labels (emotion chips, "universal", one Deliver note) are still low contrast. The guide's screenshots still show the older top bar. The remote Rafter scan could not run (plan quota).

Windows x64: installer (setup.exe), MSI and a portable zip. Not code-signed, so Windows SmartScreen may warn.
