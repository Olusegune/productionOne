# Production One 0.43.2

**An asset no longer stays Approved when its picture is gone.**

## Fixed
- When the picture that made a character, prop or set **Approved** is not on this computer, the asset kept saying Approved and the home page kept counting it. The app now removes that picture, uses another approved front view that still has a file if there is one, and otherwise sets the asset back to planned. Assets whose picture is fine are untouched.

## Checked
See `docs/QA_REPORT_0.43.2.md`.

Windows x64: installer (setup.exe), MSI and a portable zip. Not code-signed, so Windows SmartScreen may warn.
