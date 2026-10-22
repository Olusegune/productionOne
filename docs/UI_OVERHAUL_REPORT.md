# UI/UX overhaul, CleanRender and release hardening: audit, plan and report (0.14.0)

## 1. Current-state audit (before the work)
- **Stack.** Tauri 2 + React 19/TS/Vite. No component library: three CSS layers (`styles.css` legacy, `studio-shell.css`, `theme.css`/`director.css`) with 104 hard-coded `border-radius` values (16 to 99 px), a pale champagne gold (#d9bd86) and a serif display face next to Inter.
- **Screens traced.** Character Sheet Studio = `SheetStudio.tsx`; shot cards and shot inspector = `DirectRoom.tsx`; Deliver = an inline block in `App.tsx` (three fixed `.panel`s inside `.legacy-ui`, which zoomed content by 1.18); queue = `generationQueue.ts` + `useImageQueue.ts`.
- **CleanRender.** The name appeared only in planning docs. The only image check was `qa_image` (blank image, figure touching the frame edge). No colour, noise, highlight or sharpness analysis, no correction, no revision of corrected files. So: nothing prevented, detected or corrected the listed artifacts.
- **Branding/installer.** `icon.ico` and an unused `project-file.ico` from the earlier mark; no `.pone` association; no open-with handling (launch arguments ignored); each launch opened a new instance.
- **Tests at start.** 125 vitest, 39 Rust; no e2e in the repo (live checks were driven ad hoc).
- **Release blockers found.** No document icon, no association, in-app mark differed from the new artwork, Deliver issues were raw IDs, CleanRender missing.

## 2. Screenshot findings and what was done
| Screenshot | Problems | Change |
|---|---|---|
| 1 Character sheets | Empty cards, reference box dominating, long model sentence, weak status | Status header (approved/to review/in queue), toolbar, grid or large previews, compare, inspector with reference thumbnails, notes, identity lock, model in folds; actions first when narrow |
| 2 Inspector | Narrow, chips, camera mixed with cast | Resizable inspector (drag or arrow keys, remembered), folds: Camera, Composition (checkbox grid), Blocking (segmented), Cast and wardrobe (tiles), Lighting, Performance, Audio. All existing fields and bindings kept |
| 3 / 6 Shot card | Small, many tiny buttons | Larger card, spec grid, one primary action, overflow menu, grid/list/large, arrow-key selection, drag reorder, double-click to open full size |
| 4 / 5 Deliver | Empty panels, IDs, buried prompt | Delivery Center: readiness, counts, next action; issues grouped by scene with names and "Open sheet / Review shot / Retry"; editable prompt with copy; verified (gated), draft and direct exports with prerequisites |

Design tokens: radii 4-10 px by role, gold #C49A46 (hover #D6AD59, pressed #A77E31, dark text #17140E), single Inter family, 14-15 px body.

## 3. The three-level model
Canvas (artwork), Inspector (folds for the selected asset or shot), Production intelligence (status line, continuity list, CleanRender suggestions, Deliver next action). Sheet Studio, Director's room and Deliver follow it; the status strings are `aria-live`.

## 4. CleanRender assessment
- **A (prevention).** `cleanGuidance.ts` adds style-aware guidance to sheet and storyboard prompts. Tests: realistic gets skin-texture and neutral colour lines, OpenAI models get the extra "no yellow/sepia tint", stylised styles never get photographic texture, warm styles keep their warmth.
- **B (inspection).** `cleanrender.rs::analyze`: mid-tone red-blue cast, clipped highlights and shadows, noise (MAD residual), edge overshoot, bloom around bright regions (reduced copy), skin smoothness in a narrow YCbCr range. All are heuristics, say so, and a smooth-skin hit offers *regenerate or retouch*, not a filter. Not implemented: vision-model review and video flicker (no decoder bundled).
- **C (correction).** `apply`: temperature, tint, colour strength, highlight recovery, bloom reduction, edge-preserving denoise with texture protection, sharpen/soften, overall strength. Preview and save use the same function. Output is a new numbered PNG; the queue gets a new revision (`source: "cleaned"`) that keeps the approval; undo, reset, apply to all.
- **Limits stated in the UI.** Filters cannot fix faces, hands, likeness or plastic skin; intentional warm or grainy looks should be left alone.

## 5. Branding
`scripts/make-icons.py` turns the two approved images into clean rounded squares with real transparency and writes multi-size `.ico` files (16 to 256). Mapping verified by content: image 2 (film-strip P with chair, soft halo) = application icon; image 4 (clean P with glow) = project-file icon. NSIS hook writes a `DefaultIcon` for `.pone` and `.pguy`; `fileAssociations` register both; single-instance plugin forwards a second launch's file to the open window.

## 6. Mockups
Separate mockups were not produced: the redesign was built directly in the real components with real data and reviewed from screenshots of the running UI (Sheet Studio narrow layout, Deliver, Director's room). If you want static mockups for sign-off, they can be drawn from these screens.

## 7. Phase reports
| Phase | Result |
|---|---|
| 1 Audit | Done (above) |
| 2 Design system | Done (tokens in `theme.css`; `Fold` component) |
| 3 UI | Done for Sheet Studio, Director's room, Deliver. Not restyled: Projects, Story editor, Bible, Providers and Local AI panels (they pick up radii, gold and type from the tokens) |
| 4 CleanRender | A, B, C done; vision-model and video checks not done |
| 5 Branding | Icons, association, open-with done; installer branding images not made |
| 6 Verification | See TESTING.md and section 8 |
| 7 Release | See section 8 |

## 8. Verification evidence
Filled in at release time in the release notes: test counts, build result, installer checks.
