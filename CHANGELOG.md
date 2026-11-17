# Changelog

## 0.46.2 (2026-11-17): props that show something use the script's description
- **A photograph looks like what the script says it shows.** A prop that carries an image or text (photograph, picture, painting, portrait, map, letter, notebook, diary, poster, projection, scroll, contract, ledger) now keeps the lines that describe it: for "A photograph slips from the file. A modest kitchen. A small boy sitting behind a birthday cake." the photograph is a boy behind a birthday cake in a modest kitchen. The description goes into the prop's sheet prompt, into its insert shot (which now says what it shows) and into the prop line of every shot prompt it is in. Before, the insert of that photograph was a framed picture of a horned figure.
- Ordinary objects are unchanged: their name already carries their look, and the lines after them are about the room.
- **Planning a scene again no longer draws kept shots twice.** A shot with an approved frame is kept; the same shot in the new plan (same coverage and title) only refreshes its action and cast, so the new description reaches the next frame. Before, the whole new plan was added next to the kept shots (a scene with 10 framed shots gained 10 more).
- Tests: 584 JS (4 more), 84 Rust.

## 0.46.1 (2026-11-17): costumes and props, found and used
- **Costumes are read from the script.** What a character wears, as the script describes them in one sentence (`oversized coral-red puffer jacket, layered gold chains, black cargo trousers, trainers`) or in the short lines that follow (`Black three-piece suit. Fitted tailcoat. Red bow tie.`), becomes a **costume** for that character, with the script's own words as its description. Before, Costumes was always empty unless you added one by hand. A passing "in a coat" is not a wardrobe (two worn items are needed), and later actions such as "removes his glasses" are not clothes.
- **Cleaner props.** A bell ringing, a lift passing, and a simile ("like a trophy") are no longer props; "the photograph" and "the picture" are one prop; typewriters, recorders, cheques and blotters are recognised.
- **Costumes and props reach the frames.** Master and dialogue shots now carry each person's costume and the props the script puts near that moment; the shot prompt states the wardrobe in the script's words and lists the props; an approved costume or prop picture is sent as a reference. A prop that returns in two or more scenes (the typewriter, the photograph) gets an insert shot where it first appears.
- Tests: 580 JS (7 more), 84 Rust.

## 0.46.0 (2026-11-17): change your mind, newest models, sets and props you can add, more video models
- **You can change your mind about a picture.** A picture you rejected by mistake can be approved straight away (before, Approve did nothing on a rejected picture); an approved one can be rejected. **Undo approval**, **Undo reject** and **Not decided** put a picture back among those waiting, without deleting or generating anything. They are on every view card in Design, in Review (new **Approved** list beside Waiting and Turned down), in the full-size viewer (key **U**) and on storyboard frames. Taking back the only approved front of an asset also removes its Approved label and its picture.
- **The newest models, in a drop-down.** The engine choice on a failed or waiting view is now a drop-down: the newest model of each family first (Nano Banana 2.1, Nano Banana Pro, **Seedream 5.5**, **GPT Image 2.6**, Ideogram Character, Wan 2.7 Image Pro, **MiniMax H3**, a model on this computer), then every other image model in the catalog. Seedream 5.0 Pro and GPT Image 2.5 stay in the catalog and are used only if the newer ones are not listed. Upscalers, background removers and similar tools are never offered as a way to make a view. Nano Banana Pro now works with only a Kie.ai key (Google direct is used when it has a key).
- **Add a set, prop, costume or character any time.** **Add to the bible** (Design) takes a type, a name, and an image or not. With an image it becomes the approved reference (a set's establishing view, a prop's front, a costume's front, a character's front) and the other sheets are built from it. The bible now always lists Characters, Costumes, Props and Sets, saying "None yet" for an empty group; sets and props normally come from analysing a script, so a project started from a character image had none and they looked hidden.
- **More video models.** The Deliver model list and the motion-demo list now include Seedance 2.5, Kling 4.0, Wan 3.0, HappyHorse 1.1, MiniMax H3, PixVerse V6 and Grok Imagine 1.5 next to Seedance 2.0, Kling 3.0, Hailuo 2.3, Wan 2.6 and Kling 4.0 Flash. The motion demo's video model is a drop-down (with "Another model id" for anything else on Kie.ai). The new ones are marked not verified: Kie.ai builds the request from each model's own page, so the first run is a test.
- **Layout.** The colour-scheme switch (Dark / Light) is as wide as its words instead of a squashed icon button. The right-hand sheet controls no longer scroll inside their own box: they scroll with the page. In the folded Shape / Backdrop / Image model settings the Shape field had been squeezed to zero width (its label ran into Backdrop's); one field per row now.
- **Scripts with numbered headings are read properly.** A heading such as `SCENE 2 — INT. OFFICE — NIGHT` was not recognised as a screenplay heading, so the whole script was read as a shot list: no one was found speaking, and every beat (`INT. OFFICE — THE ACCOUNT`) became its own set. Now the script is read as a screenplay, speakers and lines are found, beats after a dash fold into the plain location (one room, one set), `TIMELESS` is a time of day, and on-screen text such as `TICKET: 8,004,119.` or a verse reference is no longer a speaker. Typewriters, recorders, cheques and blotters are recognised as props.
- **Motion demo lists only models that start from a picture.** Text-to-video models Kie.ai lists are left out of the picture-based list.
- **A hiccup on Kie's documentation site is no longer reported as a missing model.** The model page is asked for twice, and only a 404 says the model was renamed; any other answer shows its status and says to try again.
- **Sets are drawn full frame.** A set's establishing view was asked for on a flat grey field, which put grey bars above and below the room (and carried them into storyboard frames). A set or environment now asks for the place edge to edge.
- **A voice on a loudspeaker or a recording is not cast in the picture.** `PA VOICE`, narrators, announcers and `RECORDED ...` speakers are heard, not seen: they no longer appear in master shots or take a side of the line (a PA VOICE had been drawn as a uniformed person in the foreground).
- **Seedance 2.5 works from a picture.** Kie.ai accepts only `adaptive` as the shape of a video that starts from a picture for this model; the app sent an explicit ratio and got a 422. It now sends `adaptive` whenever the model lists it and a picture starts the clip.
- **Video models by price class.** The motion demo's model list starts on a lower-cost model (Kling 2.6) and groups the rest as **Lower cost (usually)**, **Premium (usually costs more)** (Seedance 2.5, Kling 4.0, Wan 3.0, Hailuo 2.3 Pro and the reference-to-video models) and **Other models on Kie.ai**. Every model stays available. The classes come from the model family, not a price list: Kie.ai sets the real price.
- Tests: 573 JS (33 more), 84 Rust.

## 0.45.1 (2026-11-16): Nano Banana stays in the engine list, and there are more image models
- **Fixed: Nano Banana vanished from the engine choice.** In 0.44.0 the list on a failed or waiting view left out the engine the view had used before, which for most views was Nano Banana 2.1, so the Nano Banana series seemed to have been removed. Every engine is now always listed; the one used before is marked "used before" and can be chosen again (that is how a view is simply tried once more).
- **More image models in that list:** Nano Banana 2.1, **Nano Banana Pro**, Seedream 5.0 Pro, GPT Image 2.5, **Ideogram Character**, **Wan 2.7 Image Pro**, and a model on this computer. As before, an engine without a key says which key it needs, and one that cannot take reference images says "no identity lock". The main image-model picker was not changed and still lists every Nano Banana model.
- Tests: 540 JS (2 more), 83 Rust.

## 0.45.0 (2026-11-16): new views keep the backdrop of your own front view
- **New Backdrop choice: Same as my front view (colour and lighting).** When you use your own front image, the other views used to come out on a neutral grey while your front had its own studio backdrop (teal, in the live test). With this choice the app reads the colour of your approved front view's background (the middle value of its outer edge, so the figure does not change it), and every new view on the sheet is asked to keep that backdrop: the same colour (named and as a hex value), the same soft lighting and falloff, nothing added. Until there is an approved front view, flat grey is used, and the panel says so. The existing **Match the reference image** choice, which asks for a flat plain tone, is kept and now says so in its name. Command `backdrop_colour` in `src-tauri/src/providers.rs`; wording in `src/domain/backdropColour.ts` and `src/domain/sheetSpecs.ts`.
- **Drop-down lists are readable everywhere.** The list that opens from a field (every one in the app) came out pale grey, because the field's translucent fill was blended over white, and a long label stretched it. The lists now have a solid, themed colour in the dark and light looks (`looks.css`), and a disabled choice is dimmed. The engine choice on a view that must be made again is no longer a pop-up at all: it is an inline list with each engine's name and the reason it cannot be used (a missing key, or no identity lock) in plain sight, then **Use**.
- Tests: 538 JS (14 more), 83 Rust (2 more).

## 0.44.0 (2026-11-16): choose the engine for a view that must be made again, and honest advice on Deliver
- **Choose another engine on a failed or waiting view.** Besides Nano Banana, the view card now offers **Seedream 5.0 Pro**, **GPT Image 2.5** and a model **on this computer** (ComfyUI). Pick one, then press **Use**; nothing is sent by choosing, and the spending limit still applies. A view built from the approved front uses the image-to-image variant, so the character's identity holds. An engine whose key is missing says which key (Kie.ai, Google, OpenAI, OpenRouter) or to start ComfyUI from Local AI; without a Kie.ai key, GPT Image falls back to OpenAI direct (GPT Image 1.5) and Seedream to OpenRouter (Seedream 4.5). An engine that cannot take reference images says **no identity lock**, and switching to it drops that view's reference so the request is not refused. Only models in the app's own list are offered, so a retired id never appears (`quickEngines` in `src/domain/imageCatalog.ts`, component `src/components/EngineSwitch.tsx`). Seedance is ByteDance's video model; its picture model is Seedream, which is what is offered here.
- **Fixed: wrong advice for takes whose picture is not on this computer.** The Deliver checklist said "N failed jobs: Retry them, or choose a different model", the Failed views group offered Retry and Choose a model, and the Failed jobs count included them. A picture that is gone cannot be brought back by a retry or another model. They now have their own line (**N pictures are not on this computer**, button Open Design), their own group in Failed views with only **Open Design**, and their own **Pictures missing** count; **Failed jobs** counts only real provider failures (`MISSING_FILE_ERROR`, `isMissingFile` in `src/domain/generationQueue.ts`).
- Tests: 524 JS (14 more than 0.43.4), 81 Rust.

## 0.43.4 (2026-11-16): the Deliver audit and the package no longer trust pictures that are gone
Checked the package and the Deliver audit for missing paths. Findings and fixes:
- **A shot stayed Approved when its storyboard frame was gone**, so with storyboards on, the Deliver audit counted the storyboard as complete and the package as production-ready with a frame that does not exist. A shot whose frame file is missing now goes back to planned. Shots approved by hand, or waived, are left alone. (`reconcileShots` in `src/domain/missingFiles.ts`.)
- **Files that vanish while the app is open** were only noticed when a project loaded. Pressing Export package now checks the approved pictures first; if any are gone it updates the audit, makes no package and says which step to take.
- **The verified package's refusal** named the full folder path of each missing picture; it now names the files, says how many, and what to do. **Export sheet as one image** says which view is gone instead of a system error.
- Checked and found sound: the audit asks which assets have a recorded picture and are Approved, so since 0.43.2 a missing picture already stops "ready"; a draft package lists missing references in its readme instead of failing.
- Tests: 510 JS (3 more), 81 Rust (1 more).

## 0.43.3 (2026-11-16): missing storyboard frames, clips and reference photos are flagged too
- **Storyboard frames** whose picture is not on this computer are marked **Picture missing** in the Director's room (they were already taken out of the queue by 0.43.1; the card now says so) and can be remade with Generate frame or Use my own image. Retry is not offered for your own images.
- **Audio and video clips** whose file is gone show **File missing** with their line or prompt kept, and a **Remove from list** button, instead of a player that cannot play. The flag clears if the file is back.
- **Reference photos** that are gone are taken off their lists, since a request that sent one would fail.
- The notice names what was found: pictures, clips and reference photos. Logic and tests: `src/domain/missingFiles.ts`; component `src/components/MissingClip.tsx`.
- Tests: 507 JS (6 more), 80 Rust.

## 0.43.2 (2026-11-16): an asset no longer stays Approved when its picture is gone
- **Fixed: the stale Approved label.** When the picture that made a character, prop or set Approved is not on this computer, the asset went on saying "Approved" and the home page kept counting it. The app now removes that picture from the asset, points it at another approved front view that still has a file if there is one, and otherwise sets the asset back to planned. Assets approved another way, or whose picture is fine, are untouched. The asset's recorded picture is checked along with the queue's. Logic and tests: `src/domain/missingFiles.ts`.
- Tests: 501 JS (5 more), 80 Rust.

## 0.43.1 (2026-11-16): missing pictures are shown as missing, and two layout fixes
- **A picture that is not on this computer is no longer shown as Approved.** A project opened where its pictures are not (another computer, a deleted data folder) used to show every view as Approved with "No image yet" and "Nothing new to generate", and a view built from such a picture failed with a path error. The app now checks the files when a project loads, turns each missing take into a failed one that says why, and says so in a notice. **Generate** then counts and remakes those views, and **Use my image** adds your own again. Your own images cannot be remade by Retry (it has no prompt), so only Generate and Use my image are offered for them. Command `missing_files` in `src-tauri/src/providers.rs`; logic `dropMissing` in `src/domain/generationQueue.ts`.
- **Sheet tabs wrap** (Identity, Turnaround, Poses, Expressions, Wardrobe, Detail) instead of hiding behind a horizontal scroll bar.
- **Projects home:** the counts row and the Welcome card are no longer touching.
- Tests: 496 JS (3 more), 80 Rust (1 more).

## 0.43.0 (2026-11-16): pictures travel with the project
- **A saved project carries its pictures.** Save and Save As now also write a folder named like the project (`film_files` next to `film.pone`) holding every picture, sound and clip the project uses. Opening a project on another computer, or from another data folder, finds any missing file in that folder and copies it back into the app, so nothing shows "no image" and nothing fails. Move the `.pone` and its `_files` folder together. Autosave does not copy files; an explicit Save does. Logic and test: `src-tauri/src/desktop.rs`.
- **Clearer failure when a picture is missing.** A view built from a picture that is no longer on the computer used to fail with "The system cannot find the path specified. (os error 3)". It now names the picture and says to add it again with **Use my image**, then retry.
- Tests: 493 JS, 79 Rust (1 more).

## 0.42.0 (2026-11-16): a real story through the real app
A short film, THE RENEWAL (the Bureau of Infernal Affairs, three characters from the owner's own artwork), was taken through the packaged app with real providers: story, front views from the owner's images, a consistent turnaround, revision compare, a paid ElevenLabs batch, a paid Suno batch, saving and reopening, and the Director's room. It found real bugs; they are fixed here. Report: `docs/LIVE_TEST_THE_RENEWAL_2026-11-16.md`. Sample script and world: `samples/`.
- **Saved voice per character.** The single audition has **Save as this character's voice** (and Clear); a character with a saved voice opens with that engine and voice chosen. The batch panel fills in each character's saved voice, **Tick them** ticks everyone who has one, and **Remember the chosen voices** saves a whole batch's casting. Saved with the project (`castVoice`). Logic: `src/domain/castVoice.ts`.
- **Fixed: first run showed no pictures.** The asset protocol serves only what its scope allows, and on a brand-new install the assets folder does not exist when the app starts, so the Director's frames, the full-size viewer and the audio and video players were refused (403) until the next start. The folder is now created and allowed at start-up. Found on a fresh data folder; the full-size image loaded on the first run afterwards.
- **Fixed: re-reading a script wiped what you had confirmed** (age, personality, never, sound direction, approvals) and could renumber asset ids when a new location was added earlier in the script, orphaning pictures and shots. `mergeAnalysis` keeps both.
- **Fixed: keeping the older take left the turned-down one on show.** After Review, **Keep revision 1**, the Design card and the Character Bible still used the newer, rejected revision. An approved take now stands for its view (`betterTake`).
- **Fixed: a sheet showed Approved with one of five views.** A fixed-size sheet (Identity, Turnaround, Poses, Wardrobe, Detail) is approved only when every planned view is, and says "1 of 5 views are approved. Generate the other 4."
- **Story reader:** finds objects named without a verb (a brass stamp, an umbrella, a leather folio) and their condition from the next sentence ("The stamp is chipped"); drops junk like "microphone out of habit"; reads written-out ages ("nineteen" is 19); reads "in plain clothes" as a look.
- **A project is named from its script's title** while it still has a placeholder name (THE RENEWAL becomes The Renewal); a name you chose is never replaced.
- **Batch:** saved files get tidy names (`..._theme_batch`, `..._scene-3_batch`); ElevenLabs clips are labelled with the voice's name, not its id.
- **CleanRender:** the over-sharpening check is calibrated on AI renders (clean glowing images score up to 0.30, strongly sharpened ones 0.31 to 0.57); the threshold moved from 0.18 to 0.33 so a neon-lit character is no longer called over-sharpened.
- **Light theme (found by auditing a real project):** the Character Bible tabs and next-step line, the recent-projects button, the "approved" state and the notice banner were pale on pale (1.1 to 2:1); they follow the look and theme now.
- Tests: 493 JS (465 at 0.41.0), 78 Rust.

## 0.41.0 (2026-11-16): revision compare and batch voice and music
- **Batch voice and music.** In Design, Voice, a new **Batch** panel casts several characters or scores several themes and scenes in one go. Voices: pick an engine (Windows voices, local speech servers, ElevenLabs, VoiceKiller), tick the characters, choose a voice for each; each speaks the first line the script gives them, or a line you type. Music: tick character themes and scene scores; each is built from the stated personality, role and scene heading, as the single maker does (Suno V6 Mini through Kie.ai, instrumental, about 45 seconds). **Before anything is sent** the panel shows the plan and what it will spend: free for Windows voices and speech servers on your network, otherwise characters (ElevenLabs, VoiceKiller) or requests (Suno, two tracks each); dollars appear only from a price you type (the app does not know prices). Nothing is sent until the confirming click; a paid batch is limited to 20 items; the batch stops on a key or credit problem instead of repeating it; characters with no line or no voice, and themes with nothing stated, are listed as skipped with the reason. Results are saved with the audio clips. New logic in `src/domain/batchAudio.ts`; screen `src/components/BatchAudio.tsx`.
- **Revision compare on Review.** When a view has more than one take (for example Profile revision 1 approved and revision 2 waiting), Review offers **Other takes (n)** next to the usual comparison with the approved reference. It shows two takes side by side, with a picker for which other take to compare with (approved, waiting or turned down), and **Keep revision N** under each. Keeping one approves it and turns the other approved or waiting takes of that view down; no file is deleted, and a turned-down take can be found under *Turned down* and kept later. Nothing is generated. New logic in `src/domain/review.ts` (`revisionsOfView`, `otherRevisions`, `defaultCompareTarget`, `keepRevision`).
- Tests: 465 JS (5 revision logic and 3 revision screen; 10 batch logic and 5 batch screen).

## 0.40.0 (2026-11-15): the Projects hero
- **Projects home hero.** The top of Projects is now a hero: the title, a line saying where the production stands ("3 of 8 assets approved · 1 request running"), a progress bar to a delivery package, one big button for the next step ("Continue: Approve a visual style", or "Open Deliver" when everything is done), New / Open / Save, and the look of the film as a picture (the style's own gallery picture, or its palette) with its name and colours. The five count tiles sit under it. Nothing new is stored or invented: it reads the Golden Path and the style.
- Tests: 442 JS (5 for the summary, 4 for the hero component).

## 0.39.0 (2026-11-15): older screens follow the looks
- **Older screens follow the looks.** The Providers dialog, its cards and fields, the prompt box and prompt editor, the style picker button, the model notes and the cost pop-up were written with fixed graphite colours; in Cinematic and Futurist they now take the look's own surfaces (Studio keeps its colours).
- **Cinematic, light theme: the sidebar.** The dark gradient meant for the dark theme also applied in the light theme, so the logo and the navigation labels were dark on dark (about 1.5 to 2:1). The light theme now has a light sidebar. The in-page audit missed this because it ignored gradient backgrounds; it now averages a gradient's colours, and it also caught the grey "Not generated" label (3.7:1), now darker in the light theme.
- Guide: the voice-casting screenshot is retaken from the demo project. The sheet, audition and queue pictures stay older (they need generated pictures and jobs).

## 0.38.1 (2026-11-15): failure groups fix
- **Failure groups read real status codes.** Providers write the status as "(500 Internal Server Error)" or "answered 503 Service Unavailable", not just "(500)", so server errors landed in "other" and ElevenLabs errors lost their code. Found by live checks; 5 new tests.

## 0.38.0 (2026-11-15): polish
- **Cast board on small windows.** The row of cards now comes first in the Assets tab and stays pinned at the top while you scroll the selected asset (a single scrolling row of narrow cards); selecting a card scrolls it into view. On windows narrower than 1280 px the script source takes a height that follows the window (180–360 px) so the cards start on the first screen.
- **Light theme contrast.** The emotion chips have their own darkened colours in the light theme (and lifted ones in the dark theme), the "universal" prompt tabs and the Deliver video-model notes read at 4.5:1; the in-page audit now also understands `color-mix()` backgrounds and switches off colour transitions while it measures. The six workspaces pass in all three looks, dark and light.
- **Status colours in the light theme.** The green "approved" marker and the red failing count were too pale on light panels; found by auditing the packaged app on a real project.
- **Guide screenshots retaken** for the sidebar layout (Projects, Story, Design, Direct, Deliver, palette, light theme), from the art-free demo project.
- Tests: 428 JS (4 new: emotion chip colours on every surface).

## 0.37.0 (2026-11-14): the cast board
- **Cast board.** The Assets tab on the Story screen now shows a card for every character, costume, prop and set (its approved picture, name, type and status; a coloured top edge for each kind), and for the one you select, a large picture beside what the script says about it: the first description line that names a character (or their first line of dialogue), the line a prop was found on, or a set's first scene heading, each with **Show in the script**; the scenes it is in as chips that jump to them; and, folded under a disclosure, the ages and costumes the script gives a character and the facts that go into image prompts. Name, type and facts stay editable; **Remove** removes the selected asset; **Make its sheets** or **Open in Design** takes you to its sheets. Arrow keys, Home and End move between cards. **List** switches to the compact list (remembered). Nothing is written for you: every quote is from the script.
- Tests: 424 JS (the evidence and scene logic, the board, the list switch).

## 0.36.0 (2026-11-14): Cinematic is the default look
- **Cinematic is now the default look.** Studio and Futurist stay one click away in Appearance. A look is remembered only when you choose one (the first version stored its default on every start, so it could not tell a choice from a default); the key is now `po.look.v2`, so everyone starts in Cinematic once.
- Cinematic polish: the page takes a soft tint from the accent (your style's palette) at the top and corner; panels have depth (an inner highlight and a long shadow); titles are larger; the script is a centred, page-width column on a slightly lifted sheet; the cast has bigger portraits (76 px); the primary button has a gentle gradient and glow; cards lift and rows warm on hover (off when the system asks for reduced motion); selection and scrollbars follow the accent.
- Checked: Cinematic, dark and light, all six workspaces at 1024, 1440 and 1920 px: no overflow, no text under 12 px, no contrast failures (apart from the older emotion-chip, "universal" and Deliver-note labels in the light theme). The audit now sees the primary button's real background colour.
- Tests: 406 JS (the default, the version-2 key, nothing stored until a choice).

## 0.35.0 (2026-11-14): Appearance, three looks
- **Appearance: three looks.** The palette icon at the bottom of the sidebar (or Ctrl+K, then "Appearance") opens a dialog to try a look on your own project, at once, with a preview of each. **Studio** is the default. **Cinematic** has warmer surfaces, serif page titles (Fraunces), rounder panels, and an accent taken from your visual style's palette (the most colourful entry, lifted until it reads at 4.5:1; a palette with no colour keeps the gold). **Futurist** has near-black blue surfaces, a cyan accent with a soft glow, tighter corners, uppercase tracked labels and a sharper body font (Geist). Each look has a dark and a light form; the dialog also switches dark and light. The choice is remembered on this computer. A look changes colours, fonts and shapes only, never what a control does. Palette commands: Appearance: Studio, Cinematic, Futurist.
- Two bundled fonts added (SIL Open Font Licence): Fraunces and Geist, about 66 KB. Nothing is fetched from the network.
- Light theme, all looks: the selected chips and the active sidebar item had unreadable text on some screens (white on a pale background, 1.2:1); fixed.
- Checked: Studio, Cinematic and Futurist, dark and light, all six workspaces at 1440 px; the two new looks in the dark theme also at 1024 and 1920 px: no overflow, no text under 12 px, no contrast failures (the older emotion-chip, "universal" and Deliver-note labels in the light theme are unchanged).
- Tests: 405 JS (the looks, the accent from a palette, the dialog, remembering the choice, the fonts).
- Fixed: on the Story screen the asset list was cut off after about three rows and scrolled inside a short box, leaving the rest of the pane empty (an older style capped it at 375 px). The list now fills the pane, and the pane scrolls.

## 0.34.0 (2026-11-14): failed views by cause, a Tasks list
- Deliver, failed views by cause: views that failed for the same reason are now one group ("The model is not available", "Not enough credits", "The key was missing or rejected", "The provider is rate limiting", "The connection failed", "The provider had an error", "The request was refused", or "The request was not accepted"), with the count, the models involved, a plain-language explanation and only the fixes that can help: **Refresh models**, **Use {the model you chose} for these N** (moves the affected views to it), **Choose a model**, **Provider Settings**, and **Retry all N**. The per-view messages are under Details, each with its own Retry. A failure that a newer attempt replaced is not counted. Nothing is sent until you press a button, and a retry never replaces a view that already has a picture.
- Deliver, tasks: the Agent Department Board (a long list of expandable rows with a "Propose task" button that only showed a message) is replaced by a compact **Tasks** list grouped as Needs approval, Ready or running, Blocked and Complete (folded). Each line gives the role, what it is about, why it is in that group, and a button to the place the work is done (the first asset still without an approved sheet, Review, the style gallery, Story). The brief, evidence, what it waits on and the cost open under the line. A role's group now comes from the project's real state (pictures waiting, assets without an approved sheet, what is in the queue), not from a fixed template, so a role with nothing to do (for example costumes when the script has none) shows as complete. There is no agent behind these tasks: they say where the work is.
- Tests: 393 JS (cause sorting, grouping, the failure group screen, the task logic and screen).

## 0.33.0 (2026-11-14): Script and Asset Studio redesign, Space Grotesk
- Interface, phase 4: the Script and Asset Studio layouts. **Script:** a toolbar (Import, Analyze, Templates) over the script and a breakdown with three tabs: Assets (type, name, picture, status, scenes, an Evidence button, a Facts toggle), Questions (what needs your check, apart from what the script supports) and Reading; templates only when the script is empty or on request in a dialog. **Asset Studio:** a one-line look strip (Browse styles, palette, Lock) with the settings folded away; four tabs per asset (Sheets first, Identity, Motion, Voice and sound) that keep their state when you switch; the Add character form moved into a dialog; shape, backdrop and model folded under one line on each sheet.
- Light theme: the surface tokens now have light values, and text on the dark-gold accent is white, so the new screens and the Review, Deliver and gallery screens read in both themes.
- Fonts: headings, page titles, the wordmark and the big numbers now use **Space Grotesk** (a geometric face); text and controls stay in **Inter**, and the script stays in Courier Prime. Space Grotesk (SIL Open Font Licence) is bundled with the app, about 60 KB, so it looks the same offline and needs no network. The older Fraunces, Geist and Inter heading definitions in three stylesheets were replaced, so there is one heading font.
- Asset Studio, pictures first: on a window wide enough for the side inspector (1281 px and up) the sheet's controls (pause, image quality, look, sheet, shape, backdrop and model, Generate, reference photos, notes, identity lock) are drawn in the inspector and only the pictures stay in the centre; below that width they stay above the pictures as before. The look strip is one row, the headers no longer repeat the asset name. Measured in the packaged app on a character with five views: the first picture starts 600 px down an 880 px window, was 988 px, and the first picture is visible without scrolling.
- Tests: 364 JS (the Script workspace, the Add dialog, the Asset Studio tabs, the look bar, the fonts, the controls in the inspector).

## 0.32.0 (2026-11-14): redesign phases 1 to 3, a picture for every style
- Interface, phase 1 of the redesign: one left sidebar replaces the top bar and the repeated step bar. It holds the project name and its real save state, the five workspaces (same names, same Alt+1 to Alt+5), the next step as a single button with its reason, Local AI, the command palette and Providers. Below 1280 px it collapses to icons (with names for screen readers). Progress through the steps stays on the Projects screen.
- Colours and sizes: a calmer graphite base, champagne primary actions and cyan focus, new surface tokens, and nothing essential below 12 px (the 11 px labels are now 12 px). Checked at 1024, 1280, 1440 and 1920 px in the dark theme: no horizontal overflow, no text under 12 px, no contrast failures.
- Fixed: a set, prop or vehicle no longer shows Age, Gender, Race, Ethnicity, Role and Personality in its Identity tab (found by the redesign audit; confirmed in the app). It shows only "Never"; any character facts an older project had saved on such an asset are kept and listed, not deleted.
- Known, not changed: in the light theme the emotion chips and a few small labels ("universal", one Deliver note) are below 4.5:1 contrast; they predate this change.
- Interface, phase 2: a Review workspace (sidebar, Alt+6, with a badge for pictures waiting). It shows one picture large beside the approved reference it has to match, with technical checks kept apart from your decision: Approve, Request changes, or Reject. Request changes turns the picture down and opens its sheet; it never generates anything. Rejected pictures stay findable under Turned down. Generation details and the prompt are one click away.
- Deliver now leads with a package checklist (script read, style locked, every asset has an approved sheet, nothing waiting for review, failed jobs), each open line with a button to where it is fixed, and says plainly that an export is a draft until the list is done. The hand-off panel comes before the shot compiler, which is collapsed as optional when no shots are planned, and the department board moved below. Fixed a horizontal overflow in the compiler's selects.
- Testing: `npx tsc --noEmit -p .` checked nothing in this project (the config is solution-style); the real type check is `npx tsc -b`. The released builds were not affected, because the build runs `tsc -b`, but the gate and docs now say `tsc -b`. 335 JS tests.
- Interface, phase 3 (Art Direction): the 117-item dropdown is replaced by a style gallery opened with "Browse styles": search (every word must match), a chip for each family with its count, favourites (kept on this computer), a picture card for each style, and a detail panel with description, palette, materials, rendering and lighting. Choosing a style never locks it. Picking is by single click, then "Use this style"; Escape closes and focus returns to where it was.
- Every one of the 117 styles has a picture of its own, made for this release with Kie.ai (Nano Banana 2.1): one neutral subject (a lighthouse keeper at dusk, no project art) rendered in each style, so only the style changes. 480 px webp, 3.7 MB in total, in `public/style-thumbs/styles/`; eight family pictures remain as a fallback. A test requires a picture on disk for every style and that the list in `src/domain/styleThumbs.ts` matches the folder exactly. Two names differ only by letter case ("Architectural Visualization", a project preset, and "Architectural visualization", a library style); they have the same look and share one picture under two file names.
- Not done in the redesign: Script and Asset Studio layouts, grouping repeated failures by cause, and a compact task list in place of the department matrix.

## 0.31.0 (2026-11-14): music with Suno
- Music with Suno: in a character's Voice and sound, "Make music with Suno" makes a character theme or the score for a scene the character is in. Write the style from the script (stated personality, role, and the scene's heading: where and when), with the local AI helper, or by hand; choose the model (V6 Mini, V6, V6 Wild), length (10 to 180 s), instrumental or your own lyrics. Each request makes two tracks, saved with the audio clips and played by the level-matched player.
- Suno is reached through Kie.ai (a third-party route: Suno has no public API), with the Kie key already used for images and video. Your text goes to Kie.ai only when you press Make music; it spends Kie credits. The screen says so, and to check Kie's and Suno's terms before commercial use.
- Backend: new command `make_music` (Rust `suno.rs`): fixed Kie addresses, allow-listed model, length and text limits checked before anything is sent, result files downloaded only from public https hosts (redirects re-checked), capped at 80 MB, kept only if they sniff as audio, saved under the assets folder with a sanitised name.
- Checked live (2026-11-14): one instrumental V6 Mini request returned two valid 48 kHz stereo mp3 tracks of 10.4 s and 10.0 s in 22 s; the test files were deleted.
- Not done: lyrics generation, extending or covering a track, WAV conversion, vocals from your own voice, music for a whole film timeline; vocal tracks and the V6 and V6 Wild models were not run live.

## 0.30.0 (2026-11-14): close recent projects, design voices from the script
- Recent projects: each entry has a close button and the list has "Clear list" (the project file is never deleted). Entries show the file name only; Windows paths showed in full before because the name was split on a malformed pattern.
- Voice design: under a character's voice engine, "Fill from the script" builds a voice description from the character's confirmed fields (age, gender, role, personality, sound direction) and their own dialogue, and shows what it was built from; nothing is guessed. "Ask the AI helper" has the local model (Ollama or LM Studio) write the description from a rough idea, and only confirmed fields and the character's lines are sent to it. Works with ElevenLabs Voice Design and with Qwen TTS (description as the voice). Chatterbox clones from a recording, so it shows a note instead.
- Not done: Suno music (only reachable through the Kie.ai reseller; awaiting a go-ahead); the Qwen description-as-voice path is untested against a real server.
- Checked live (2026-11-14, installed 0.29.2 backend, saved ElevenLabs key): Voice Design with a script-built description returned 3 previews, valid mp3 files of 9.4 to 11.3 s. Previews were not saved to the account (no voice slot used) and the test files were deleted.

## 0.29.2 (2026-11-14): level-matched, trimmed audition playback
From the audio check (docs/AUDIO_CHECK_2026-11-14.md): clips differed by up to 8 LU in loudness, so voice casting favoured the loudest, and the Windows voices ended with about 0.8 s of dead air.
- Audition clips (voice auditions and cloud voice previews) now play level-matched to -20 LUFS and with silence trimmed at the two ends only (never inside a line), with a little air kept at each end. Loudness is measured the broadcast way (ITU-R BS.1770 K-weighting with EBU R128 gating) and matches ffmpeg's measurement; boost is capped at 12 dB and never pushes a peak past -1 dBFS. The clip line says what was done ("+5.3 dB to -20 LUFS, 0.8 s of silence trimmed").
- A "Level-matched" switch plays the original instead, for comparison; one switch covers every clip on screen and is remembered. Playing one clip stops the one before it, so clips can be compared by ear.
- Nothing is written to disk: the saved files are exactly as the voice engine returned them. Where a clip cannot be decoded, the plain browser player is used.
- New Rust command `read_audio_clip` reads a saved clip for the player: only files inside the app's assets folder, only audio extensions, at most 64 MB.
- Tests (audio work): 296 JS (loudness against ffmpeg's value for a tone at three sample rates, gating, safety limits, silence trimming that never cuts inside a line, and the player with a fake audio engine), 72 Rust.
- Not done: levelling is for listening only; exported or delivered audio files are still unprocessed, and there is no "save a levelled copy" button yet.

Release gate for 0.29.2 (everything below was found and fixed before release; details in docs/QA_REPORT_0.29.2.md):
- Security, dependencies: `cargo audit` reported 7 vulnerabilities. `tokio` 1.54.0 to 1.54.1 (a timer race), `zip` 4 to 9 (four advisories about extracting archives; the app writes and reads zip files but never calls extract), `rusqlite` 0.32 to 0.42 (a newer bundled SQLite), `pdf-extract` 0.9 to 0.12 (brings `lopdf` 0.42, which fixes a stack overflow on deeply nested PDFs). `cargo audit` now reports 0 vulnerabilities. PDF import, Word import and the SQLite ledger were re-checked in the packaged app.
- Security, hardening: the app had no content-security policy (`csp: null`); a strict one is now set and was tested in the packaged app (zero violations during a full walk; a remote script, an inline script and a remote image are all blocked; fonts, inline styles, thumbnails, video through the asset protocol, audio and export all still work). `label_image` and `inspect_image` accepted any path from the page; both are now confined to the assets folder, and a labelled image can only be a new `.png` directly in it. New unit tests for both.
- Lint: `cargo clippy --all-targets -D warnings` was failing (an old allow for a lint this toolchain does not know, and a `map_or` from 0.29.1); both fixed, clippy is clean.
- Tests: 296 JS, 73 Rust. `npm audit`: 0 vulnerabilities. Local secrets scan clean. The remote Rafter scan could not run (plan quota used up).
- Still listed, not fixed: maintenance warnings (not vulnerabilities) for `unsafe-libyaml` and `ttf-parser` in the Windows build.

## 0.29.1 (2026-11-14): motion clips are silent; audio check
- Found by measuring and transcribing every audio clip made in testing (see `docs/AUDIO_CHECK_2026-11-14.md`): a Seedance turntable clip carried an unrequested, very quiet soundtrack (the recogniser labelled it "[MUSIC PLAYING]"). The app left the model's optional audio switch at the provider's default, which is on. It now turns a model's soundtrack switch (`generate_audio`, `sound`, `audio` and similar) off for every Kie request, so reference clips are silent. Covered by a Rust test.
- Audio check: all nine voice clips are clean (no clipping, no dead lead-in); seven were transcribed word for word by a local speech model, one ElevenLabs line had a mid-phrase pause that garbled the second half, and one VoiceKiller clip ended with a breath-like extra sound. Loudness differs by up to 8 LU between clips and the Windows voices end with about 0.8 s of silence; both are recorded as improvements, not yet made.
- Tests: 273 JS, 71 Rust.

## 0.29.0 (2026-11-14): design refresh, light theme, documentation with screenshots
- Typography: Inter (with its optical-size axis, so large titles tighten like a display face and small text opens up like a text face) replaces Fraunces, Plus Jakarta Sans and Geist. One family everywhere, tabular numbers for readings (counters, costs, queue), and the lowercase l with a tail so a capital I and an l can be told apart in names ("Ione" is not "lone"). The three removed font packages shrink the installer by about 90 KB.
- Surfaces: neutral charcoal, thin separators, calmer shadows, 12 px panels and 8 px controls, compact 13 px controls and a 14 px base size, in the spirit of Apple's and DaVinci Resolve's interfaces. One consistent keyboard focus ring.
- Sheet thumbnails take the shape of their sheet (portrait characters, 4:3 props, 16:9 locations) instead of one fixed portrait frame, so landscape images no longer sit in tall empty frames.
- Fix: action rows in the asset panel wrapped badly and squeezed "Approve identity" to a 36 px sliver with its label cut off; they now wrap.
- Fix: the sticky tab bar let the panel heading show through it; it is now opaque.
- Light theme: readable text on every screen (a checked audit replaced dozens of pale greys carried over from the dark theme). The only items still flagged are the emotion chips, whose contrast comes from a colour filter the audit cannot measure.
- Fix: "1 scenes" and "1 canonical assets" now read "1 scene" and "1 canonical asset".
- Fix: the splash screen showed "VERSION 0.20.0" for many releases; it now shows the real version, and a test fails whenever the version differs between package.json, package-lock.json, tauri.conf.json, Cargo.toml, Cargo.lock, the splash screen, the changelog and the release notes.
- Documentation: new user guide, design notes, QA report and testing notes, with screenshots of the Projects, Story, Design, sheet, voice, queue, Direct, Deliver, command-palette and light-theme screens (taken from the packaged app; paths and user names are masked). The screenshots use a location and a prop; character art is not in the repository.
- Audited at 1024, 1280, 1440 and 1920 pixels wide across all five workspaces: no horizontal overflow, no contrast failures in the dark theme, no clipped buttons.
- Tests: 273 JS (including a version-consistency test), 70 Rust.

## 0.28.9 (2026-11-14): full systems check, stress tests, and the fixes they found
Run on the packaged app with your keys: every sheet of every asset type, sets, props, wardrobe and detail sheets (23 images), pause and resume, a hard kill in the middle of generation, 300 rapid workspace switches, local AI, voices, providers.
Found and fixed:
- The queue bar said "11 queued, 0 running" while views waited for you to approve a front view (they match it), which looked stuck. The bar now says how many are waiting and offers "Open sheets". (The cards already explained it.)
- A new character's Windows voice kept the previous character's voice (a female character showed David). Each character now gets its own suggestion from its stated gender and age.
- Long captions on exported sheets were cut off ("FABRIC AND CONSTRUCTI") or ran into the next caption. Captions now shrink to fit their cell and are cut with "..." only as a last resort. Checked on a real 32-view export.
- Locations whose sheets hold one view each could not be exported. New "Export every sheet as one image" puts the pictures of all of an asset's sheets into one labelled image (up to 40).
Also new: DRAFT casting lines for Nigerian Pidgin, Yoruba, Igbo and Hausa in the casting-line picker. They were written here, not by a native speaker, and are labelled so; they are not proven to cover every sound.
Checked and fine: crash recovery (the two images that were generating become "failed, may already be billed", the 16 waiting jobs are kept and the queue starts paused), pause drains running work and holds the rest, 300 workspace switches with no errors, personality and Never field in the app, Add from image with a gender through the real file dialog, local text and vision AI (Ollama).
Tests: 268 JS (including a 3,000-job queue, a 3,000-job project round-trip, a 5,000-voice list, a seeded fuzz of 4,000 random queue operations, and a check of every view of every asset type), 70 Rust.
Not tested: fal.ai and OpenRouter (no keys saved), LM Studio and ComfyUI (not running), the installers on a clean machine (only checked as packages), audio quality (unheard).

## 0.28.8 (2026-11-14): personality, more pangram languages, costume-front fix checked live
- Checked live (Kie Nano Banana 2.1, one image): CASSIUS's Wardrobe "Costume front", which earlier showed a different man, now comes out as CASSIUS with his face, plume, armor and sword, on the flat grey backdrop. Before and after are in a Desktop folder.
- New: "Personality" on a character's identity fields (timid, cool, bratty, aggressive, warm, or not set). It shapes the delivery tags of the emotional-range casting line (a cool character's shout reads as "cold disbelief, still controlled", a bratty one's as "loud, playfully annoyed"), and adds one line about carriage and expression to that character's motion prompts. It never changes how the character looks.
- New: Spanish, French and German pangrams in the casting-line picker. They are well-known public sentences that use every letter (a test checks all 26); a letter pangram is not a sound pangram, so each is labelled to be checked by a native speaker. Not included: Nigerian Pidgin, Yoruba, Igbo and Hausa, because a pangram for those needs a native speaker to write and check it.
- Tests: 240 JS, 69 Rust. Personality, tags and pangrams are covered by unit tests; the new select was not clicked in the packaged app.

## 0.28.7 (2026-11-14): casting lines and a per-character "Never" field
Both ideas came from the resources you supplied, reworded and fitted to this app.
- New: "Casting line" in Voice Audition. One click fills the line box with a fixed line, so every candidate voice is compared on the same words: a pangram that uses every English sound, or a short emotional-range line (curious, playful, laugh, whisper, gasp, shout, sigh). Delivery tags such as [whispers] are added only for an ElevenLabs model that reads them (Eleven v3 or later); any other engine gets the plain text, so nothing is read aloud as "bracket whispers". The English pangram is a long-standing public one; the range line is original.
- New: "Never (what must not drift)" on each character's identity fields, in the person's own words (for example "never pale porcelain skin"). It is written into every image and video prompt for that character as "Must never drift: ...", repeated as written. Saved with the project.
- Tests: 233 JS, 69 Rust. Local secrets scan clean. Not run in the packaged app: your installed app was open, and a second copy cannot run beside it. The pickers and field are covered by component and unit tests only.
- Not done: other languages for the pangram (a self-written pangram for another language should be read by a native speaker before it is used), and the tags are not yet shaped to a character's personality.

## 0.28.6 (2026-11-14): wardrobe identity fix, shape and backdrop controls
- Fix (wrong person): a Wardrobe sheet's "Costume front" was made from the text alone, so it could show a different person from the character's approved front (seen with CASSIUS). A front-type view now uses the character's approved front from another sheet as its reference, as every other view already did. It still goes without a reference when nothing is approved yet, and never uses another character's or another look's image. Covered by unit tests; the live re-make was not done in the packaged app (see notes).
- New: "Shape" control per sheet (portrait 3:4, tall 9:16, square 1:1, landscape 4:3, wide 16:9). The default still follows the asset: characters portrait, props landscape 4:3, locations wide 16:9. The choice is saved with the project and applies to new images; existing images keep their shape.
- New: "Backdrop" control per sheet: flat grey (default), flat white, or match the reference image. One flat-field rule is written into every prompt on the sheet (no floor, wall, horizon, cast shadow or colour spill), so the views agree with each other instead of each model choosing its own background.
- Turnaround front, side and rear prompts now ask for a dead-on view (square shoulders and hips, even weight, a true 90 degree profile, spine centred from behind).
- Turntable and other motion prompts now ask for a flat uniform grey field, real-time speed and no slow motion.
- Layout: the sheet controls sit in one tidy grid.
- Ideas taken from the Castkit, Shotcaller, Voicesheet and Motiondojo files you supplied were reworded, not copied; see the notes in the conversation for what was and was not adopted.
- Tests: 227 JS, 69 Rust. Checked in the browser preview; not exercised in the packaged app, because your installed app was open and a second copy cannot run beside it.

## 0.28.5 (2026-11-13): sheet export, steadier turntables, voice picker fixes
Fixes for everything the three-character run found and left open.
- New: "Export sheet as one image" on every sheet. Combines the views that have a picture (turnaround, poses, expressions, wardrobe, detail) into one labelled PNG in Documents\Production One\Sheets. Only images in the app's own assets folder are read; at most 24 views per image. Checked in the packaged app: nine sheets exported and looked right.
- Fix: the cloud voice list (ElevenLabs, VoiceKiller) is remembered for the session; switching engine or character no longer empties it and forces "Load my voices" again. Checked in the packaged app.
- Fix: a character added from an image can be given a gender (optional, never guessed), so the voice picker chooses a matching Windows voice instead of defaulting to a male one.
- Fix: the turntable prompt also asks the model to keep the face, expression and costume as in the reference. Re-run: CASSIUS and MARA now turn a full 360 degrees and CASSIUS keeps his stern face to the end; MARA's eyes opened in the clip although they are closed in her image, so expression is only partly held.
- Tests: 219 JS, 69 Rust. Local secrets scan clean. The remote Rafter scan was not run (plan quota used up); the new export command was reviewed by hand (path containment, size limits, filename sanitising).
- Not verified: the gender field was checked for rendering and by unit test, not by completing a real image pick; audio quality unheard.

## 0.28.4 (2026-11-13): live video and voice test on a character added from an image
- Test with your keys: MARA, added from her Midjourney image with "Add from image", made a 5 s 1076x1924 24 fps Kling turntable clip (face, hood, robe and jar held), a Windows (Zira) line and an ElevenLabs eleven_v4 "Joy - Soft Spoken" line. Not heard by me; the clip turned only about 180 degrees.
- Fix: the turntable prompt now asks for one complete 360-degree rotation that ends facing the camera. Not re-run (it would spend a second video), so unverified.
- Fix: the ElevenLabs and VoiceKiller panels no longer say "Not yet run against the live service"; speech for both was checked live. Voice design, sound effects and VoiceKiller cloning are still untested.

## 0.28.3 (2026-11-13): no lost work, start from your own images, retries
Found by running the packaged app with three Midjourney characters (full turnaround, 8 poses and 8 expressions each).
- Fix (data loss): New and Open replaced the single autosave slot, so an unsaved production could be lost with no warning. When the open production has work that is not safely in a saved file, the app now copies it to Documents\Production One\Backups first (newest 30 kept; only files the app wrote are ever pruned) and names the copy in the message. If the copy cannot be made, nothing is replaced.
- New: "Add from image" in the Production Bible. Type a name, choose an image (for example from Midjourney); it becomes the approved front view and the turnaround, poses, expressions and the rest are built from it with the identity lock on. No script needed.
- Fix: a Golden Path for a project started from images no longer says "Add your script"; Create and Analyze count as done.
- Fix: Kie sometimes refuses a model it served minutes earlier ("no model page"). It is now retried automatically after a pause, within the normal three-attempt limit, instead of failing until you press Retry.
- Fix: the queue bar and the Bible dot kept counting "failed" for a view that a later retry had already produced. Superseded failures stay in the record and the request count but are no longer reported as failed.
- Change: when a reference image is attached, prompts ask for a background matching it (your white Midjourney backdrops) instead of always light grey.
- Tests: 213 JS, 67 Rust. Rafter: local secrets scan clean; the remote scan could not run (plan quota used for this period), so the diff was reviewed by hand against the CWE list (path traversal, deletion, JSON parsing).
- Not verified: the Kie retry cannot be triggered on demand, so it is covered by unit tests only.

## 0.28.2 (2026-11-13): VoiceKiller verified live; voice list fixed
- Live test with your keys (one short line each): ElevenLabs eleven_v4 produced a valid 3 s MP3; VoiceKiller (voice "Bella") produced a valid 4 s 128 kbps MP3; Google Gemini 3.1 Flash Lite Image produced a five-view AMINA turnaround with the identity lock holding.
- Fix: VoiceKiller's voice list is one name per line, not JSON, so the picker said "not in a shape this app knows". It now reads that shape and still refuses markup, braces, colons or long lines. Tests extended.
- Not tested live: OpenAI, Kie, motion video, VoiceKiller cloning.

## 0.28.1 (2026-11-13): fixes from running the packaged app
- Run for real (WebView2 debugging port): Fraunces and Plus Jakarta Sans load; free Windows voice audition produced a real 3.6 s, 22 kHz mono WAV with Microsoft David and Zira listed; no provider keys were saved so no paid generation was run.
- Fixes: "Local AI" no longer wraps onto two lines, the first-run card no longer has a gap under its title, Asset Lab titles use the display font, Production Bible group headings are left-aligned, the "optional" tag on Direct hides below 1500px so the next-step button is not cut off.

## 0.28.0 (2026-11-13): App.tsx split into views; empty project no longer "ready"
- App.tsx is now about 1,300 lines (from 1,860): the Projects, Story, Design and Direct workspaces live in src/views/ with typed props. Deliver is still inline.
- New App-level tests walk every workspace and the Alt+number shortcuts, guarding the split.
- Fix: a brand-new empty project showed Deliver as complete (and "Deliver complete" in the header) because the audit was vacuously ready with zero assets. Deliver now needs at least one asset.
- Checked on screen in a browser preview: illustrated empty states (cast, reading) and the Project settings dialog.
- Tests: 197 JS, 65 Rust.

## 0.27.0 (2026-11-13): icons on every screen, illustrated empty states, first views split out
- Icons on the Story, Direct, Deliver and Animatic panel labels, and on the Settings, Providers, Help and Unsaved dialogs.
- Illustrated empty states (cast, reading, reference sheets) with a soft colour glow and drifting sparkles; still under reduced-motion. Image slots waiting for a picture now show a tinted wash (gold waiting, blue in progress, red failed).
- App.tsx: Projects and Story workspaces moved to src/views/ProjectsView.tsx and StoryView.tsx (App.tsx 1,860 to about 1,790 lines; Design and Direct still inline).
- Tests: 194 JS, 65 Rust.

## 0.26.0 (2026-11-13): new type pairing, icons everywhere
- Fonts: Fraunces (cinematic serif) for titles, Plus Jakarta Sans for everything else; both bundled, work offline. Replaces Geist.
- Icons: every workspace tab, every Golden Path step (icon medallions), Production Bible groups and assets (coloured avatar with a status badge), New/Open/Save.
- Projects screen: five icon stat tiles (Scenes, Characters, Props, Sets, Approved) replace the sentence of numbers.
- Layout fixes for the wider serif: bible names no longer wrap mid-word; style name no longer clipped.
- Tests: 191 JS, 65 Rust. Checked in a browser preview at 1024px.

## 0.25.0 (2026-11-13): progress ring, step acknowledgement, shortcuts
- Golden Path progress ring around the logo (with a text equivalent for screen readers).
- A quiet "<Step> complete" chip appears when a step becomes done (not on load); still under reduced-motion, without animation.
- Alt+1..5 switches workspace; hint on the Projects screen.
- App.tsx: constants and download helpers moved to src/appHelpers.ts (App.tsx is still about 1,860 lines; the larger split is not done).
- Tests: 191 JS, 65 Rust.

## 0.24.0 (2026-11-13): searchable voice lists
- New SearchSelect (WAI-ARIA combobox: type to filter, arrow keys, Home/End, Enter, Escape, live match count) used for the Windows voice list and the ElevenLabs/VoiceKiller voice list. Multi-word search matches in any order.
- Tests: 188 JS, 65 Rust. The component is covered by unit tests only; not yet seen in the packaged app, no screen-reader pass.
- Not done: replacing the remaining short native dropdowns; splitting App.tsx.

## 0.23.0 (2026-11-13): voice groups, script reading actions
- Voice audition is now four numbered groups: Engine and voice, Line, Direction, Result.
- Script reading: "Add as prop" for a prop the reading missed (never duplicates an asset), and "Use as <name>'s age" on an age the reading found; the age is saved as the character's confirmed age and flows into image prompts.
- Tests: 183 JS, 65 Rust.
- Not done: searchable replacements for long native dropdowns; splitting App.tsx.

## 0.22.0 (2026-11-13): first-run guide, saved notes, light theme
- First-run guide on Projects (keys, script, Golden Path); dismiss once, remembered.
- Sheet notes are now saved with the project (they used to vanish on close).
- Light theme, opt-in: command palette (Ctrl+K) > "Switch between dark and light theme". Dark stays the default. Best effort: the main screens were checked in a preview, the Direct, Deliver and dialog screens were not.
- Tests: 180 JS, 65 Rust.

## 0.21.0 (2026-11-13): polish, regenerate and cost
- New `src/polish.css` layer: one easing curve, screen entrance, sliding tab indicator, breathing Golden Path step, tactile buttons, key chips, slow background light. All motion switches off under reduced-motion.
- Header: tabs wrap to their own row at 1180px and below, so nothing clips at 1024px.
- Reference sheets: "Generate" now counts only views that need an image. New "Regenerate N unapproved" and "Regenerate N selected" (tick Select on a view). Approved views are never regenerated unless ticked. When nothing is added the message says what to do next.
- Cost: every paid button shows its count and cost at the person's own price per request (never an invented price; "cost unknown" until one is set in the spending limit).
- Several image warnings collapse into one "N quality notes" toggle.
- Design screen: sticky in-page navigation (Identity, Reference sheets, Motion, Voice and sound).
- Tests: 180 JS. Checked in a browser preview and as a packaged build; no screen-reader pass, no light theme yet.

## 0.20.0 (2026-11-12): type and layout refresh
- New typeface: Geist (bundled, works offline) with Inter and Segoe UI Variable as fallbacks; roomier line height, tighter headings, balanced wrapping.
- Accessibility: no text under 12px (legacy 8-11px labels raised; monospace boxes 13px); low-contrast greys in the older style sheets lifted; a script audit of the Projects, Story, Design, Direct and Deliver screens found no text below 4.5:1 (approximate, computed from CSS colours, not a full WCAG audit); stronger focus ring; readable disabled buttons; reduced-motion and high-contrast settings honoured.
- Layout: voice and sound panels are now spaced cards with aligned fields; clip lists use a responsive grid; field labels no longer shout in capitals.
- Not done: narrow-window layout (the app still needs about 1100px width), full screen-reader pass, light theme.
- Tests: 177 JS, 65 Rust.

## 0.19.1 (2026-11-12): ElevenLabs v4 that keeps itself current; keys in Settings
- ElevenLabs now defaults to "Latest": the newest speech model your own account lists (GET /v1/models), falling back to eleven_v4. A newer generation (v5...) is picked up and its audio-tag support recognised without an app update. You can still pin a model.
- ElevenLabs and VoiceKiller keys (and VoiceKiller user ID) are now saved in the same Settings dialog as every other provider key, not inside the Voice audition. The audition shows key status and a button that opens Settings.
- Not run against the live services. Tests: 177 JS, 65 Rust.

## 0.19.0 (2026-11-12): ElevenLabs and VoiceKiller
- ElevenLabs (cloud): speak lines (Eleven v3 reads inline tags such as [whispers], [laughs], [sighs]), load your voices, design a new voice from a written description then keep it, and make separate sound effects (grunts, laughs, engines) for characters and props.
- VoiceKiller (cloud): speak lines; emotion and physical state go in its instructions field; voice list read leniently because its reply shape is not published.
- Keys are entered by you in the Connect section and stored in the Windows Credential Manager; never shown again.
- Direction is honest per engine: tags only where documented, otherwise listed as not applied.
- NOT run against either live service. Calls follow the published API pages. Every action spends your credits.
- Tests: 173 JS, 64 Rust.

## 0.18.0 (2026-11-12): reference-anchored generation made visible
- Anchoring already existed for models that accept reference images; it was invisible and off with the default text-only model. Now the Identity lock panel opens by default, says whether the character is locked, waiting for an approved front view, or unprotected, and offers one-click "Switch to <model>" (a reference-capable model on a provider you have a key for).
- Views that travel with the approved front view as a reference now tell the model it is the exact same subject (face, hair, skin, build, costume) and to change only the pose, angle or expression.
- Not live-tested yet: that a reference model actually keeps the face across views.
- Tests: 171 JS, 59 Rust.

## 0.17.2 (2026-11-12): fixes from the end-to-end test
- Every sheet prompt now demands exactly one image of one subject in one view (no grids, contact sheets or collages). Models can still ignore it; no automatic detection of collages yet.
- Sheet notes are kept per asset, so one asset's notes no longer appear in another's prompts.
- Cropped-figure check compares each edge with its own tone, so studio gradients and floor shadows are no longer flagged as a cropped head or feet.
- Not fixed: truck/prop and identity details not extracted from action lines, stale sample shot text in Deliver, no cost estimate on Generate, no cross-view consistency for text-only models.
- Tests: 164 JS, 59 Rust.

## 0.17.1 (2026-11-12): WazobiaVoice engine
- New voice engine WazobiaVoice (Yoruba, Hausa, Igbo, Pidgin, Nigerian English) with language picker, expressiveness slider and optional reference-clip path.
- `tools/wazobia_server.py`: local-only (127.0.0.1) /v1/audio/speech server around the model card API. Syntax-checked only; never run (gated weights, no GPU here). Weights are non-commercial research licence.
- `speak_http` passes only language, exaggeration and cfg_weight onward. Tests: 164 JS, 58 Rust.

## 0.17.0 (2026-11-12): voice engines and performance direction
- Voice audition can now use a speech server on this computer or your network (`POST /v1/audio/speech`): presets for Chatterbox and Qwen TTS, plus any other server. New `speak_http` command; address must be local or private network; returned bytes are checked to be real audio.
- Performance direction per line: physical state, emotion and laugh/grunt/cough cues. The app applies only what the engine supports (inline tags, pauses) and lists everything else as not applied; the casting brief carries it.
- NOT verified against a live server. Suno via Kie, VoiceKiller and Wazobia are not integrated (no documented API available).
- Tests: 164 JS, 57 Rust.

## 0.16.0 (2026-11-12): motion and voice auditions
- Motion audition presets by asset type (characters, vehicles, props); voice audition with installed Windows voices; sound briefs for props.
- Confirmed identity fields now reach every image sheet prompt and motion prompt.
- Pinned dependencies, added CI. Tests: 159 JS, 56 Rust.

## 0.15.0 (2026-11-12): Character Bible progress, accessible tabs, explainable parsing
- Character Bible sections derive state from the generation queue (newest revision per view); Motion and Voice are gated with plain next steps.
- Character Bible tabs are an ARIA tablist with arrow/Home/End navigation and a tabpanel.
- New `explainStory` engine and "How this was read" panel with per-finding confidence and source-line links.
- Tests: 150 (was 141). No data-format changes.

## 0.14.0 (2026-10-22): professional UI, CleanRender, branding
- **Design system.** Restrained radii (panels 8, cards 6, controls 5-6), deeper gold (#C49A46, hover #D6AD59, pressed #A77E31), one type family (Inter), primary buttons flat gold with dark text.
- **Character Sheet Studio.** Status header (approved, to review, in queue), toolbar, large previews (grid or large), side-by-side compare, and an inspector with reference thumbnails, notes, identity lock and model, in collapsible sections. Narrow panels move the actions first and settings below the artwork.
- **Director's room.** Larger cinematic cards with spec grid and one primary action; secondary actions in an overflow menu; grid, list and large layouts; arrow-key navigation; drag to reorder; a resizable inspector with Camera, Composition, Blocking, Cast and wardrobe, Lighting, Performance and Audio sections (checkboxes and segmented controls instead of chips).
- **Delivery Center.** Readiness percentage, counts, next recommended action; missing items grouped by scene with human names and buttons that open the sheet or shot; retry for failed jobs; shot compiler with shot and model pickers, capability checks, editable prompt, copy; verified, draft and direct exports with prerequisites.
- **CleanRender.** Layer A: style-aware prompt guidance (natural skin for realistic styles, neutral white balance unless the style is warm, nothing photographic on stylised projects). Layer B: measurements for colour cast, clipped highlights, noise, edge overshoot, bloom and skin smoothness, with honest messages and remedies. Layer C: non-destructive correction (temperature, tint, colour strength, highlight recovery, bloom reduction, noise reduction with texture protection, sharpness) with live split before/after, undo, reset, save as a new revision, and apply to all.
- **Branding.** New application icon and project-file icon built into multi-resolution `.ico` files; installer, shortcuts, taskbar and in-app mark use them; `.pone` and `.pguy` are registered by the installer; double-clicking a project opens it in the running window.
- **Script import.** Final Draft, Fountain cleanup, Word and PDF through the native picker.

## 0.13.1 (2026-10-21)
Local AI: Ollama, LM Studio and ComfyUI detection; one-click ComfyUI install; local image and video workflows; AI beat pass.

Earlier releases are described in [docs/PRODUCTION_ONE_PLAN.md](docs/PRODUCTION_ONE_PLAN.md).
# Unreleased

- Preserved cumulative submission attempts and spending history across manual retries and model reassignment.
- Added explicit draft/verified package export modes, missing-reference reporting, and non-overwriting atomic delivery writes.
# 0.14.10

## UI/UX: calm studio pass

- Reduced shell, panel, rail, and action density so the selected asset and next action lead.
- Added responsive workspace collapse rules for narrower windows.
- Made Character Bible sections horizontally scrollable instead of wrapping into a busy control wall.
- Tightened Design workspace columns, spacing, shadows, and sheet-card density.

# 0.14.9

- Added Character Bible navigation linking identity, turnaround, poses, expressions, wardrobe, details, motion, and voice.
- Character Bible tabs drive the separate sheet generator while sharing the approved identity anchor.

# 0.14.8

- Added broad aspect-ratio selection for storyboard and video workflows, including 21:9 and 2.39:1 cinema formats.
- Expanded character pose sheets with neutral A-pose, profile, crouch, walk, run, sit, and gesture views.

# 0.14.7

- Added provider-aware video model catalog for Kie.ai, Gemini, and fal.ai.
- Added task capability metadata for turnaround, acting, pose, expression, vehicles, props, cloth, dialogue, and extensions.
- Added explicit export-only and direct-generation status messaging.

# 0.14.6

- Replaced the oversized native style dropdown with a searchable, grouped visual-style browser.
- Added category filtering and style descriptions for faster selection.

# 0.14.5

- Added a 100-style visual library with independent animation approaches and world treatments.
- Added style-bible controls for movement language and world coherence.

# 0.14.4

- Expanded the project style library with animation, anime-inspired, stop-motion, graphic, futuristic, fantasy, architectural, and editorial families.
- Made the project-wide style bible explicitly flow into assets, motion, storyboards, and delivery.

# 0.14.3

- Added Asset Lab Golden Path for identity, motion, interaction, sound, and continuity.
- Added asset-specific motion studies for characters, costumes, props, sets, and environments.
- Added editable motion, interaction, sound, and character identity direction.

# 0.14.2

- Added Story workspace script templates for screenplay, Fountain, narrated prose/PDF, and shot-list workflows.
- Improved guidance for structured extraction of characters, scenes, sets, and props.

# 0.14.1

- Replaced the startup splash artwork with a production-design studio composition that avoids prominent generated hands and faces.
- Preserved the previous splash as `public/splash-v1.jpg`.

