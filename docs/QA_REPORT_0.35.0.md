# QA and release gate, 0.35.0 (2026-11-14)

Run on the branch that became 0.35.0 (the three looks, and the Story asset list fix), on the release build, with the owner's real project.

## Verdict
Go. What is not checked is listed at the end.

## Gate results
| Check | Result |
|---|---|
| Types: `npx tsc -b` | Pass |
| JS tests | 405 pass (12 new: the looks, the accent from a palette, the dialog, remembering the choice, the fonts) |
| Rust tests | 78 pass (unchanged) |
| `cargo clippy --all-targets -- -D warnings` | Clean |
| `npm audit`, `cargo audit` | 0 vulnerabilities (maintenance warnings only). Two new npm packages: `@fontsource-variable/fraunces` and `@fontsource-variable/geist` (SIL Open Font Licence) |
| `rafter secrets .` | Clean |
| `rafter run` (remote SAST and SCA) | Not run: the plan's quota was used up at 0.29.2 and has not been confirmed back. The change adds no backend command, path or network call |
| Version guard, changelog, release notes | Pass |

## Found and fixed
| # | Finding | Fix |
|---|---|---|
| 1 | The asset list on the Story screen was capped at 375 px by an older style and scrolled in a short box, clipping it (reported by the owner from a large window) | Cap removed; the pane scrolls; the old row class dropped |
| 2 | Light theme, all looks: the selected filter chip on Review had white text on a pale background (1.2:1), and the active sidebar item text was 3.8 to 4.0:1 in the new looks | Explicit selected-state colours, loaded last, for every look |
| 3 | The Cinematic wordmark wrapped onto two lines in the sidebar | Smaller size, no wrapping |

## Interface audit (`scripts/qa/in-page-audit.js`)
| Check | Result |
|---|---|
| Studio, Cinematic, Futurist, dark and light, six workspaces, 1440 px | No overflow, no text under 12 px, no contrast failures (apart from the older light-theme labels below) |
| Cinematic and Futurist, dark, 1024 px and 1920 px | Clean |
| Light theme, all looks | Only the older emotion chips, "universal" and one Deliver note are below 4.5:1 |

## Checked in the packaged app, on the owner's real project
| Area | Result |
|---|---|
| Appearance dialog | Opens from the sidebar icon; each look applies at once; Cinematic sets the accent from the style palette (#d1b47b); Futurist uses Geist; headings in Fraunces (Cinematic) or Space Grotesk; the page background follows the look |
| Fonts | Inter, Space Grotesk, Fraunces and Geist all loaded under the security policy; 0 console or policy errors |
| Session safety | The test replaced the autosave; it was restored from the backup ("8 to review, 55 done"), the look was set back to Studio, and the recents list put back |

## Not checked
- Older screens that hard-code colours (parts of Direct and the older panels) follow a look only partly; they were audited for overflow and contrast, not judged for beauty.
- Whether the looks are to the owner's taste: they were chosen to be compared on a real project, and the owner has not yet picked one.
- The guide's screenshots still show the older top bar.
- Vocal Suno tracks and the V6 and V6 Wild models; Qwen description-as-voice against a real server; ElevenLabs sound effects.
- The installers on a clean machine; Windows SmartScreen for an unsigned installer; audio quality by ear; screen readers.
