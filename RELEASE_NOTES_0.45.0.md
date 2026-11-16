# Production One 0.45.0

**New views keep the backdrop of your own front view.**

## New
- **Backdrop: Same as my front view (colour and lighting).** When you use your own front image, the other views no longer have to come out on a neutral grey. The app reads the colour of your front view's background and asks every new view to keep that colour, that soft lighting and nothing else on it. It needs an approved front view; until there is one, flat grey is used, and the panel says so.
- **Match the reference image** is renamed **Match the reference image (flat tone)**: it still asks for one flat plain tone.

- **Drop-down lists are readable everywhere.** Lists that open from a field were pale grey and could be stretched by a long label. They now have a solid, themed colour in the dark and light looks.
- **Choosing an engine for a view that must be made again** is an inline list that shows each engine and why it cannot be used, instead of a pop-up.

## Checked
See `docs/QA_REPORT_0.45.0.md`.

Windows x64: installer (setup.exe), MSI and a portable zip. Not code-signed, so Windows SmartScreen may warn.
