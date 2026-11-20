# Non-destructive grading and looks (Phase 5)

## What a grade is

A **grade** is metadata applied over an original picture. The original is **never changed**, a grade is **never baked into it**, and grading again **never compounds**: every render starts from the original pixels (`gradeBytes` returns a new array and leaves its input alone; a test hashes the original before and after).

The data model keeps these apart:

| Record | Holds | Where |
|---|---|---|
| Lighting instructions | where the light comes from and how it feels, as asked of the image model (`key light`, `source size`, shadow-depth intention, `colour temperature of the light`, practicals...) | `shot.lightingRecord` (Phase 4) |
| Exposure and white balance (technical) | `exposureEv` (-3 to 3 stops), `temperature` (cool to warm), `tint` (green to magenta) | `grade.technical` |
| Tone | `contrast`, `saturation` (-100 to 100) | `grade.tone` |
| Creative grade | shadow tint, highlight tint, amount | `grade.creative` |
| LUT application | an optional `.cube` table applied after the grade | `grade.lut` (the table is in `looks.luts`) |

`contrast` appears in both a lighting record and a grade on purpose and means different things: in lighting it is the depth of the shadows the light is asked to make (low, medium, high); in a grade it is a curve over the pixels. No other field is shared (tested).

A grade changes colour only. **It does not move lights or rebuild shadows**: the same input colour always gives the same output colour wherever it sits in the picture (tested).

## The transform

Per pixel, in order: exposure and white balance in **linear light** (exposure is a gain of 2^EV; temperature and tint scale red, blue and green), back to sRGB; **contrast** around mid-grey; **saturation** around luma; the **creative tints** weighted toward shadows or highlights. The result is clamped to 0 to 255.

**Strength** (0 to 100) blends the graded pixel with the original pixel: 0 returns the original exactly, 100 the full grade. **Reset** returns a neutral grade, which returns the original exactly. Known-value tests cover exposure (+1 stop doubles linear light: sRGB 128 becomes about 175), the warm/cool direction, contrast, saturation -100 (grey), tints, clamping and out-of-range values.

## Looks

A **look** is a named grade. Looks apply to the whole project, to a scene, or to a single shot; a shot look beats a scene look, which beats the project look. The **colour script** lists every scene with the look it ends up with, where that look came from (shot, scene or project) and a strip of six swatches (the grade applied to black, three greys, white, a skin-like colour and a sky-like colour). Removing a look removes where it was used and touches no picture.

The **Looks and grade** panel (Direct, below the animatic) previews a look on a storyboard frame next to the original (toggle "Show the original"), with strength and reset. The preview is drawn in the panel from the original's pixels; nothing is written to the picture file.

## Technical QA is on the original

`qaInput(original, graded)` always returns the original. A graded copy is never an input to a technical check, so a creative grade cannot hide or cause a technical problem.

## Export

`exportLooks` produces `production-one-looks` metadata: the looks, where they apply, and the originals (with content hashes when known). It states `bakedIntoOriginals: false` and lists each LUT with the `.cube` file it is exported as. A colour described in words is not a LUT and is never exported as one.

## LUT import (`.cube`)

A **LUT** is a table of colour changes. In a look, choose **Import a LUT (.cube)**; the LUT is applied **after** the grade, with its own strength (0 to 100). It changes colour only: it **does not move lights or rebuild shadows** (the same input colour always gives the same output colour wherever it sits in the picture; tested).

- **Formats:** Adobe/Resolve `.cube`, 3D (size 2 to 65) or 1D (size 2 to 16384). A file with both a 1D and a 3D table, an unknown keyword, a wrong number of rows, a non-number, a missing size, a bad `DOMAIN_MIN`/`DOMAIN_MAX`, binary content or more than 12 MB is refused with the line and the reason. Other formats (.3dl, .lut, .csp) are not supported.
- **Interpolation:** trilinear for 3D, linear for 1D, red index fastest then green then blue, as the format defines. Tests check it against known values (identity, inversion, a curve read between nodes, a channel-rotating table that proves the ordering, a custom input range, 1D).
- **Colour space:** the app treats a picture as display-referred sRGB (Rec.709-like) and expects a LUT that goes from that to that. A LUT whose title or file name suggests a **log, linear or HDR** format (LogC, S-Log, V-Log, HLG, PQ, ACES, Rec.2020...) is **not applied** to an ordinary picture unless you tick "I know this LUT is meant for ordinary pictures"; it is warned about on import.
- **Out-of-range values:** table values outside 0 to 1 are counted, warned about and clamped when applied. Picture values outside a LUT's own input range are clamped to it. Results are always clamped to 0 to 255.
- **Storage:** each table is kept once in the project (`looks.luts`), as 16-bit values in base64 (precision 1/65535 of the range, finer than an 8-bit picture), recognised by a hash so importing the same LUT twice adds nothing. A project holds up to 8 LUTs and about 2 MB of tables; a damaged table is dropped on opening together with the references to it.
- **Export:** each LUT is exported into the package as `Looks/<name> (LUT-xxxxxxxx).cube` (rewritten from the stored table; reading it back gives the same table), listed in `design_records.json` with its input and output colour space and whether it looked like a log LUT. File names are plain characters, one folder deep; the package writer refuses anything else. No folder from your computer is written.
- **Still not done:** `.3dl`, `.csp` and other formats, tetrahedral interpolation (trilinear is used), colour-managed (ICC, wide-gamut) pipelines.

## Scope in this phase

Looks are previewed on **storyboard frames** in the Director's room. Applying a look to other outputs (character sheets, set views) and to the exported frames is not done: the metadata is exported, the pixels are not.
