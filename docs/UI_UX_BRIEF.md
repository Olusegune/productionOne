# Production One: UI/UX brief

Written 2026-11-12 at release 0.20.0 for whoever continues the work. It collects what the owner asked for, what was done, what testing on a real PC showed, and what is still to do. Nothing here needs a key or spends money except where marked.

## 1. What the owner asked for

- "Improve the overall UI/UX experience. The fonts feel dated. Something sleeker but accessible."
- Earlier: ideas to make the app production-ready and to improve the UI/UX (answered in chat; the points below restate and extend them from what testing showed).
- Wants to *see how a character moves and sounds, and the same for props like cars* ("auditioning"): this is now the Motion and Voice audition panels, which must stay easy to find and understand.
- Wants plain-language reports and honest statements of what is and is not verified. The same tone should carry into the app's own messages.

## 2. Design principles to keep

1. **One clear next step.** The Golden Path (Create, Analyze, Design, Generate, Review, Direct, Deliver) and its "Next:" card are the spine. New features must hang off it, not compete with it.
2. **Say what the model cannot do.** Identity lock, "Not applied" voice directions and unverified-provider notes are deliberate: never hide a limitation behind a success message.
3. **Spending is visible.** Anything that costs money must say so before it runs (see section 5, item 3).
4. **Accessible by default:** readable sizes, contrast, visible focus, keyboard reachable, honours reduced-motion and high-contrast settings.
5. **Calm, dark, gold-accented studio look** (already established); no tiny shouting capitals.

## 3. Done in 0.20.0 (typography and layout pass)

- Typeface changed to **Geist** (bundled with `@fontsource-variable/geist`, works offline). Fallbacks: Inter Variable, Segoe UI Variable, system. Roomier line height (1.55), tighter balanced headings, `text-wrap: balance/pretty`.
- The app was already on Inter, so the "dated" feel came from tiny labels, low-contrast greys, cramped controls and heavy outlines more than from the font.
- **No text under 12px** anywhere in the five main screens (legacy 8 to 11px labels raised; monospace boxes now 13px).
- Low-contrast greys in the older style sheets replaced. A script audit of Projects, Story, Design, Direct and Deliver found no text under 4.5:1. Caveat: computed from CSS colours only, so it is an indicator, not a WCAG audit.
- Stronger keyboard focus ring (ring plus halo), readable disabled buttons, dark thin scrollbars, `prefers-reduced-motion` and `prefers-contrast: more` honoured.
- Voice and sound panels reworked into spaced cards with aligned fields and a responsive clip grid; field labels no longer uppercase.
- All of it lives in `src/refresh.css`, imported last from `src/main.tsx`, plus bulk replacements in the legacy sheets (`src/styles.css`, `art-direction.css`, `production-one.css`, `studio-shell.css`, `animatic.css`, `delivery.css`, `director.css`, `cleanrender.css`).
- Checked in a browser preview (Vite on port 5199), not inside the packaged app.

## 4. What testing on a real PC showed (UX findings)

From the live run (see `docs/E2E_TEST_REPORT_2026-11-12.md` and `docs/ELEVENLABS_TEST_2026-11-12.md`):

1. **Re-generating is a dead end.** "Generate N views" does nothing once views exist; the person must Reject each view, then press Regenerate on each. Needs one obvious "Regenerate all / selected" action and a message when nothing is added.
2. **Identity lock was invisible** until 0.18.0. It is now a panel that opens by default; consider surfacing the state on the sheet header too (a small "Locked to front view" / "Not locked" badge next to the model name).
3. **No cost shown near Generate.** Add a per-click estimate ("5 views, about $x") next to every paid button, with the spend guard on by default.
4. **Notes are not saved** with the project and live in a small collapsed side panel; people will assume they are saved.
5. **Stale sample text** ("solar compass", "We are close") shows in Deliver > Shot compiler of a brand-new project.
6. **Crop and quality warnings** are noisy: repeated three-line warnings under every image. Group them, show one icon plus a "details" toggle, and avoid false positives.
7. **Script analysis shows its working** ("How this was read") but gives no way to fix a missed prop or missing identity facts quickly. Add "Add as prop" from the script line and "Use this as the character's age/gender/costume".
8. **Page length.** The Design screen for one character scrolls past ten screenfuls (sheets, motion, voice). Consider sticky section navigation (Identity, Turnaround, Expressions, Motion, Voice) that mirrors the Character Bible tabs and scrolls to the section.
9. **Voice panel** has many controls for one action. Group as: Engine and voice, Line, Direction, Result; hide engine-specific fields until the engine is chosen; remember the last engine (already stored) and voice per character (not yet).
10. **Focus handling when opening Settings from the Voice panel** works; after saving a key the panel refreshes its key status, but there is no confirmation inside the panel itself.
11. **Native select menus** are not captured by screenshots and are small touch targets; consider a custom listbox for long lists (voices, models).
12. **Window size.** Body minimum width is about 1100px (legacy). The packaged window opens small on first run and had to be maximised for testing.

## 5. Outstanding UI/UX work (priority order)

1. Fix the regenerate flow (finding 1) and add selection ("regenerate these 3").
2. Save notes with the project; show a "saved" state.
3. Cost estimate and confirmation next to every paid action; spend guard on by default; confirm the parse before the first paid generation.
4. Replace stale sample text with an honest empty state ("No shots planned yet").
5. Condense image warnings (finding 6).
6. Sticky in-page navigation for long character screens (finding 8); reduce vertical sprawl.
7. Voice panel regrouping and a saved voice per character (finding 9).
8. **Narrow-window and high-DPI layout**: remove the 1100px minimum width, test at 900, 1280, 1440 and 1920 wide and at 125% and 150% Windows scaling.
9. **Real accessibility audit:** full WCAG 2.2 AA pass with a screen reader (NVDA), keyboard-only walkthrough of the whole Golden Path, focus order, landmarks, form labels, status announcements (`aria-live` for generation progress and errors), target sizes of at least 24px. The Character Bible tablist already follows the ARIA pattern; the rest has not been audited.
10. **Light theme** (and respect `prefers-color-scheme`), validated for contrast.
11. **First-run onboarding:** a short guided start (add keys, paste a script, see the Golden Path), because new users currently land on a project with no explanation of keys or costs.
12. **Split `src/App.tsx`** (about 1,900 lines) into feature modules so UI work stops colliding in one file; add component tests for the Design screen.
13. Visual regression checks: screenshot tests of the main screens at two sizes in CI on a Windows runner.
14. Motion: respect reduced motion everywhere (done globally in `refresh.css`; verify the clip players and any custom transitions).

## 6. How to verify UI work

- Run `npx vite --port 5199` and open http://localhost:5199 in a browser. The browser preview runs without Tauri (desktop-only features such as keys, voices and generation are disabled but layout and the sample project "The Last Horizon" are visible).
- Contrast and size audit: run the script used in the 0.20.0 pass (walk every visible text node, compute contrast against the nearest opaque background, flag under 4.5:1 and font sizes under 12px). It is approximate; confirm borderline results with a real tool.
- Always also check the packaged app: run `ProductionOne-<version>-portable.exe` from the release folder.

## 7. Files to know

`src/refresh.css` (latest layer, imported last), `src/theme.css` (main theme, tokens `--ui`, `--display`, `--text-2`, `--text-3`, `--gold`), `src/production-one.css` and `src/studio-shell.css` (shell and Golden Path), `src/delivery.css`, `src/director.css`, `src/components/SheetStudio.tsx` (sheet panel and Identity lock), `src/components/CharacterBible.tsx`, `src/components/VoiceAudition.tsx` and `VoiceCloud.tsx`, `src/components/MotionDemo.tsx`.
