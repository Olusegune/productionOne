# QA and release gate, 0.45.0 (2026-11-16)

Run on the branch that became 0.45.0: new views keep the backdrop of the person's own front view.

## Verdict
Go for the option. It was tested in unit tests and in the real app up to the prompt; no picture was generated with it, so how well a model keeps the backdrop is not checked.

## Gate results
| Check | Result |
|---|---|
| Types: `npx tsc -b` | Pass |
| JS tests | 538 pass (14 new: colour wording, the new backdrop line, the prompt, the engine list) |
| Rust tests | 83 pass, 1 ignored (2 new: backdrop colour from the edge of a picture) |
| `cargo clippy --all-targets -- -D warnings` | Clean |
| `npm audit` / `rafter secrets .` | 0 vulnerabilities / clean |
| `cargo audit`, Playwright and Python suites | Not run: no dependency or engine change |

## What changed
- New **Backdrop** choice **Same as my front view (colour and lighting)**. The colour of the approved front view's background is read by `backdrop_colour` (the middle value of the pixels along the top, the sides and the bottom corners, so a figure in the middle or touching the bottom does not change it). Every new view's prompt then asks for exactly the front's background: the same colour (named, and as a hex value), the same soft lighting and falloff, nothing added. With no approved front view, flat grey is used and the panel says so.
- The earlier **Match the reference image** choice (a flat plain tone) is kept and renamed **(flat tone)**.
- The colour is read once per front view and kept, so generating does not wait on it and the queue is not touched while it is read.

## Real app (separate copy of the release build)
A picture with a teal background (about #1e4a52) and a figure in the middle was added as Venomspur's front view. The Backdrop list showed the four choices; with the new one selected, the panel first said "Needs an approved front view. Until there is one, flat grey is used.", and after the front was added said "Keeps your front view's backdrop (about #1e4a52)." 0 console errors. The test picture is a plain drawing made for the test, not the owner's art.

## Drop-down lists (owner's report: the engine drop-down looked ugly)
- **Cause:** the app's fields have a translucent fill, so the pop-up list of every native `<select>` blended it over white and came out pale grey; one very long label also stretched the list.
- **Fix:** every drop-down list gets a solid, themed colour (dark and light looks) in `looks.css`, and disabled choices are dimmed. The engine choice on a view that must be made again is now an inline list (radio rows with the reason an engine cannot be used shown), not a pop-up. Three long labels were shortened (video purpose shows its short name with the full text on hover; the draft casting lines keep their "a native speaker must check" warning in fewer words).
- **Audit in the real app** (all six workspaces and the character tabs, 96 to 102 drop-downs): every option now has a solid background (rgb(38, 32, 25) in the dark Studio look) and a dark colour scheme; the longest label went from 74 characters to 60.
- **Engine list in the real app:** four compact rows (38 px, 57 px with a note), selected row highlighted, "no identity lock" note visible, no pop-up.
- **Not seen:** the browser's own pop-up list is drawn by the operating system and is not in the page, so I could not screenshot it; I checked the computed colours of every option instead. The owner should confirm the list looks right. The light theme was checked by its CSS only, not looked at.

## Not checked
- **No picture was generated with the option.** Whether a model keeps the colour and lighting, and whether it still keeps the figure's identity, depends on the model and was not tried (no paid run). The earlier live test noticed the mismatch (teal front, grey views); this option addresses it in the prompt only.
- The prompt asks for the same lighting and falloff, not for a pixel-exact backdrop; models may drift slightly.
- Views already made keep their backdrop; only new ones follow the choice.
- A front with a busy or photographic background gives a single average colour; the prompt still asks to keep the background as in the reference.
- The owner's own front images were not used; Welcome-card spacing (0.43.1) still unseen.
- Installer on a clean machine; Playwright and Python suites.
