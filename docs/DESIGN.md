# Design notes (0.29.0)

Production One is a tool people sit in for hours, next to footage and reference art. The interface is therefore quiet: it gets out of the way of the images, and the things that matter (the next step, what needs review, what is running) are the only things that glow.

The look borrows two ideas on purpose. From **Apple**: one typeface used with care, generous but not wasteful space, soft radii, and a focus ring that tells you where you are. From **DaVinci Resolve**: neutral charcoal surfaces so colour in the artwork is judged against grey and not against a tint, thin separators instead of heavy boxes, compact controls, and a page bar (the workspace tabs) that always shows where you are.

![Design workspace](screenshots/design-style.png)

## Typography
- **One family: Inter**, loaded with its optical-size axis (`@fontsource-variable/inter/opsz.css`). Large titles use tighter tracking and heavier weight (display cut); small text opens up (text cut). It is bundled, so the app looks the same offline. Courier Prime is kept only for the script editor, where screenplay format needs a monospaced face.
- The stack falls back to the system fonts (`-apple-system`, `SF Pro`, `Segoe UI Variable`), so on a Mac or a modern Windows machine a missing font degrades to the platform's own design face.
- **Scale:** 14 px base, 13 px controls, 12 px field labels, 11 px uppercase micro-labels (`.eyebrow`, tracking 0.075em). Titles are 1.2 to 2.4 rem, weight 650 to 700, tracking -0.022em to -0.032em.
- **Tabular numbers** on anything that is a reading (counters, costs, the queue, stat tiles), so digits do not jitter as values change, like a timecode.
- **The lowercase l has a tail** (`cv05`). In Inter a capital I and a lowercase l are identical, and this app is full of names ("Ione" must not read "lone").

## Colour
- Tokens live on `:root` in `src/polish.css` (the last layer): `--bg`, `--surface`, `--surface-2`, `--stroke`, `--stroke-strong`, `--text`, `--text-2`, `--text-3`, plus the gold accent. Components use the tokens; the light theme only redefines them (`:root[data-theme="light"]`).
- Gold is the single accent and always means "the next thing" or "selected". Status colours (green approved, amber needs review, blue running, red failed) are used only on state.
- Muted text (`--text-3`) is kept at 4.5:1 or better against its surface in both themes; `prefers-contrast: more` raises it further.

## Shape and motion
- Radii: 12 px panels, 8 px controls, 7 px small elements. Shadows are soft and short.
- Motion is short and meaningful (screen entrance, step completion, hover), and all of it respects `prefers-reduced-motion`.
- Sheet thumbnails take the shape of their sheet, so a landscape location is shown as a landscape card.

![A prop's sheet, with thumbnails in the sheet's own shape](screenshots/sheet-prop.png)

## Keyboard and focus
Every control is reachable by keyboard. One focus ring everywhere: a 2 px gold ring offset 2 px outside the control. Ctrl+K opens the command palette; Alt+1 to Alt+5 switches workspace; the lightbox, shot editor and sheet cards have their own arrow-key paths (see the user guide).

![Command palette](screenshots/palette.png)

## Light theme
The light theme is opt-in (palette: *Switch between dark and light theme*). It is warm paper with the same structure. Older stylesheets hard-coded pale greys for the dark theme, so the light theme carries a targeted block that maps every muted and strong text role back to the tokens.

![Light theme](screenshots/light-theme.png)

## How the UI is checked
An automated audit (run in the browser pane against the live app, kept in the QA report) walks all five workspaces at 1024, 1280, 1440 and 1920 pixels wide, in both themes, and reports: horizontal overflow, clipped text, text under 11.5 px that is not an uppercase micro-label, click targets under 26 px, and text contrast below WCAG AA (4.5:1, or 3:1 for large text). 0.29.0 passes in the dark theme. The light theme's only flagged items are the emotion chips, whose contrast comes from a colour filter the audit cannot measure.

## What is deliberately not done
- No custom window chrome and no Mica or acrylic: the Windows title bar and menus are left to the system.
- No icon-only navigation: workspace tabs always carry their name (the optional tag on Direct hides below 1500 px).
- No second typeface for display. A serif was tried in 0.26 to 0.28 and replaced: a single family reads calmer next to colourful artwork.
