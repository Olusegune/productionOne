# Production One 0.43.4

**The Deliver audit and the package no longer trust pictures that are gone.**

## Fixed
- **A shot stayed Approved when its storyboard frame was gone**, so with storyboards on, the Deliver audit counted the storyboard as complete and the package as production-ready. Such a shot now goes back to planned. Shots approved by hand or waived are left alone.
- **Files that vanish while the app is open** are caught when you press Export package: the audit is updated, no package is made, and the message says what to do.
- **Clearer refusals:** the verified package names the missing files instead of full folder paths, and **Export sheet as one image** says which view is gone.

## Checked
See `docs/QA_REPORT_0.43.4.md`.

Windows x64: installer (setup.exe), MSI and a portable zip. Not code-signed, so Windows SmartScreen may warn.
