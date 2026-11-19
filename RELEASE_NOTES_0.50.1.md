# Production One 0.50.1

**A long sheet no longer fails on Kie's documentation site.**

## Fixed
- "Kie's documentation site answered 403" stopped long sheets halfway (poses and costume views failed after about fifteen pictures in a row). The app now remembers each model's page for six hours, retries a refused request up to three times, and falls back to the last copy it read. Tested: the ten failed views were retried and all succeeded.

## Also in this release
- The full in-app route (describe a character, prop or place, make a first concept, approve it, then generate every sheet) was taken end to end in one 2D style on one model. Results, including the weaknesses, are in `docs/2D_LIVE_TEST_2026-11-19.md`.

## Be aware
- One style and one model were tested. The other 37 presets, other models, and long productions are not checked. In that test *sitting* and *walking* poses barely changed, and the floor plan came back as a perspective drawing.
