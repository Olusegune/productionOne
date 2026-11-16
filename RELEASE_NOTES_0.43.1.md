# Production One 0.43.1

**Missing pictures are shown as missing.**

## Fixed
- A project opened where its pictures are not (another computer, a deleted data folder) used to show every view as **Approved** with "No image yet" and "Nothing new to generate". The app now checks the files when a project loads, marks each missing picture as needing a new one, and tells you. **Generate** remakes those views; **Use my image** adds your own again.
- **Sheet tabs wrap** instead of hiding behind a horizontal scroll bar.
- **Projects home:** the counts row and the Welcome card no longer touch.

## Checked
See `docs/QA_REPORT_0.43.1.md`.

Windows x64: installer (setup.exe), MSI and a portable zip. Not code-signed, so Windows SmartScreen may warn.
