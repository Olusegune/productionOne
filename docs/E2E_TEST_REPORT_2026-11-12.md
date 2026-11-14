# Production One 0.17.1: end-to-end test report (2026-11-12)

Driven through the installed app (`%LOCALAPPDATA%\Production One`, 0.17.1) on the Desktop PC. New project, short script "The Long Haul" (one set, one character AMINA, one truck).

## What ran (all through the app's UI)
| Step | Result |
|---|---|
| Script analysis | PASS for set + character. The truck (a lowercase prop in an action line) was NOT detected: 0 props. Added by hand. Age/gender/ethnicity from "(40s, Nigerian woman...)" were not extracted; typed by hand. |
| Character turnaround (5 views, Seedream 5.0 Flash via Kie) | PASS: 5 separate images. Front was generated before the costume note and came out blue; the other four are green. |
| Expression sheet (8 views) | PARTIAL: 8 files, but several are contact sheets (neutral = 2x2 grid, sadness = 12 faces, fear = triple view), not one face each. |
| Prop multi-view, truck (4 views) | PARTIAL: 4 files, each a collage of several trucks rather than one view. |
| Approve + unlock | PASS: approving a front view unlocks Motion. |
| Motion audition, "Speaks to camera", Kling 5 s | PASS: 5.04 s, 1244x1660 clip, identity stable. Movement is subtle (slight head/mouth motion). No audio track in the file. |
| Voice audition, Windows voice + direction | PASS: 4 s WAV. "Out of breath" applied as pauses; "laugh after the line" correctly reported "Not applied" for this engine. |
| Real voice engines (Chatterbox, Qwen, Wazobia) | NOT TESTED: no server running. |
| Pose sheet, set (GARAGE) sheets, truck motion/sound audition | NOT RUN (time; truck front is a collage so not a fair motion source). |

Requests made: 17 images + 1 video clip. Exact cost not read from the Kie dashboard; check it. Well under the $5 cap.

## Defects found (to fix next)
1. **Contact sheets instead of single views** (expressions, truck). Prompts need an explicit "one single image of one subject, no grid, collage or multiple views"; QA should detect multi-panel images.
2. **Crop warnings are false positives**: every full-body turnaround is flagged "head/feet may be cropped" though fully in frame with margin.
3. **Notes are not per asset**: the truck's note appeared while viewing AMINA's expressions. Risk of leaking one asset's notes into another's prompts.
4. **Stale demo shot text** in Deliver > Shot compiler ("solar compass", "We are close") shown in a new project with no shots.
5. **Script details not carried**: costume colour and identity facts written in the script are not extracted into the asset; costume had to be re-typed as a note.
6. **No consistency across views** with text-to-image models ("model has no references"): the front view differs in costume from the rest. Use a reference-capable model with the approved front as anchor.
7. **No cost estimate** shown next to Generate buttons.
8. Silent installer does nothing and the MSI needs admin; only the interactive setup works.

## Files
- `character-AMINA/`: 13 images. `prop-truck/`: 4 images. `video/`: speak clip + frame strip. `audio/`: voice audition WAV.

---
# Re-test on 0.17.2 (installed copy at C:\Users\eduni\po-install-test; the AppData copy is still 0.17.1)
Regenerated 4 views (4 image requests; total now 21) through the app's Reject and Regenerate buttons. Files are in `retest-0.17.2/`.

| Fix | Result |
|---|---|
| One subject per image | PASS on all 4 samples: truck front (was a 4-truck strip), neutral (was 2x2 grid), sadness (was 12 faces), side turnaround. Only a sample; the model can still ignore the instruction. |
| Notes per asset | PASS: the truck note did not appear on AMINA, and AMINA's notes stayed empty. |
| False crop warnings | PARTIAL: the regenerated Side view went from 3 warnings to 1 ("side edge"), which may be a real tight crop. Old images keep their old warnings until regenerated. |

New problems seen:
- **Identity drift:** regenerated views do not match the originals (AMINA's hair changed to a topknot and the suit from green to blue; sadness/neutral faces differ from the joy face). Text-only models cannot hold a face. Next step: reference-capable model with the approved front as anchor.
- **Re-generation needs Reject first:** "Generate N views" does nothing when views already exist; users must reject each view, then Regenerate.
- **Notes lost on reload:** notes are kept per asset only in memory, not saved with the project.
- Motion and voice were not re-run (code unchanged in 0.17.2).

---
# Anchor check on 0.18.0 (portable build, run from the Desktop folder)
Switched to Nano Banana 2.1 with the "Switch to" button in the Identity lock panel (panel then read "on: locked to the approved front view"). Regenerated the Side view (1 image request, 22 total). Files: `retest-0.18.0-anchor/`.
- Result: the new Side view matches the approved Front: same navy grease-stained shirt, brown trousers, belt pouches, short natural hair (the text-only version had a topknot and different suit). One sample only.
- Caveat: the anchor is the approved **Front** view (navy). The earlier approved three-quarter view (green suit) was generated without an anchor and does not match; approve the best front view first, then regenerate the rest.
- Also confirmed: the panel shows "off: model has no references" plus a Switch button when the model is text-only.
