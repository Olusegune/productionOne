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
| LUT application | **not implemented** (see below) | none |

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

`exportLooks` produces `production-one-looks` metadata: the looks, where they apply, and the originals (with content hashes when known). It states `bakedIntoOriginals: false` and `lut: null`. **No LUT file is exported**: LUT import and application are not implemented, and a colour described in words is not a LUT.

## LUT import: deferred

Not built. When it is built it must validate format and size, state its input and output colour-space expectations, test parsing and interpolation against reference values, handle out-of-range values explicitly, warn about unsupported LUTs and refuse to apply a log-camera LUT to sRGB pictures by default. Until then the grade record has no LUT field.

## Scope in this phase

Looks are previewed on **storyboard frames** in the Director's room. Applying a look to other outputs (character sheets, set views) and to the exported frames is not done: the metadata is exported, the pixels are not.
