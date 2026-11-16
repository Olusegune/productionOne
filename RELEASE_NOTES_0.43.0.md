# Production One 0.43.0

**Pictures travel with the project.**

Save and Save As now write a folder next to the project (`film_files` beside `film.pone`) holding every picture, sound and clip the project uses. Open the project on another computer, or from another data folder, and anything missing is found in that folder and copied back, so views no longer fail with "The system cannot find the path specified".

## New
- **A saved project carries its media.** Move the `.pone` and its `_files` folder together. Autosave does not copy files; an explicit Save does.

## Fixed
- A view built from a picture that is no longer on the computer used to fail with a raw "os error 3". It now names the picture and says to add it again with **Use my image**, then retry.

## Checked
See `docs/QA_REPORT_0.43.0.md`.

Windows x64: installer (setup.exe), MSI and a portable zip. Not code-signed, so Windows SmartScreen may warn.
