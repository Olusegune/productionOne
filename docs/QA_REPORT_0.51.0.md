# QA report: 0.51.0 (2026-11-19)

Scope: the Assistant (chat, attachments, plan, run, report) and its two Rust commands.

## Gate results
| Check | Result |
|---|---|
| tsc (`tsc -p tsconfig.app.json`) | Pass |
| JS tests | 706 pass, 1 skipped |
| Rust tests | 97 pass (6 new) |
| clippy -D warnings, npm run build, npm audit | Pass, 0 vulnerabilities |

## What the tests prove (mocked image model: data flow, not visual quality)
- The plan counts pictures and cost correctly (3 items, standard: 35 pictures; quick: 11), refuses without a price and a budget or when over budget, and does not count pictures that already exist.
- A run makes the concepts, stops at the checkpoint and approves nothing itself; waits at the checkpoint until Continue; makes every sheet only for approved concepts; can approve clean concepts itself (and keeps a record) while a concept with quality notes still waits; respects an asset's own style; asks for no references from a model that takes none; makes one storyboard frame per shot in the project shape.
- The budget guard is put on the queue at Start and taken off at the end; Stop cancels what has not started.
- The report lists what failed and why, and says the cost is an estimate.
- The chat: reads attached scripts (Word/PDF text), says plainly when a file cannot be used, turns pictures into the chosen kind of item, writes a script from an idea only when a key is saved and says so when not, and takes a pasted script as it is.
- Rust: file kinds, the two request bodies and answers, the model-id check.

## Live run (real image model, isolated app, Kie.ai `google/pro-image-to-image`, 2026-11-19)
A three-line script (a harbour pilot with a grey braid and a navy coat, a brass lantern, a harbour office) was attached with the paperclip (the native file dialog), read, planned, and run with **Quick**, price $0.10, budget $3.00, *Stop after the first concepts* unticked, project style Clean digital cel animation. Pressing Start was the only click.
| Check | Result |
|---|---|
| Attach a .txt script through the native dialog; read: 1 scene, 3 items | Pass |
| Plan shown: 11 pictures, about $1.10 (Quick) | Pass |
| Start: 3 concepts made, the 3 clean concepts approved automatically, then 8 sheet pictures (the rest of Mira's turnaround and the lantern's four views and the place's reverse view), 11 in all, no failures | Pass |
| Report: 11 made, 3 approved automatically, 8 waiting for the person, nothing failed, about $1.10 | Pass (after a fix: the first run showed no cost) |
| Time | About 5 minutes for 11 pictures |
**Two bugs found by the live runs, fixed, and re-run:** (1) the report said "cost not worked out" because the price had been put back with the budget guard; (2) the script's own description of the character and the place was not in the picture requests, so the first run drew a generic woman. After the fix the second run drew the described woman (grey braid, long navy coat with brass buttons) consistently across front, three-quarter, side and rear, and the lantern consistently across its views.
**Weaknesses seen:** the character holds the lantern in every view because her script line says so; the establishing view of the harbour office was an exterior with the pilot standing in it (the place's description was a line about the pilot, fixed afterwards so a place is described only by a line about the place, not re-run).

## Not checked
- Writing a script from an idea with a real language model (no Gemini or OpenRouter key was available).
- The checkpoint path (stopping for approval, then Continue) in the real app: only the mocked tests cover it; the live run used the auto-approve choice.
- A real Word or PDF through the paperclip (a .txt was used live).
- Reading a real PDF through the attach button (the readers have their own tests).
- Drag-and-drop of files, an MCP server (not built), the light theme, Playwright, installers on a clean machine.
