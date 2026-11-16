# Live test: THE RENEWAL (2026-11-16)

A short film written for this test, taken through the packaged app with the owner's saved keys and a budget of 5 USD. The three characters are the owner's own artwork (kept outside the repository). The story and world are in `samples/the-renewal.fountain` and `samples/WORLD_BUREAU_OF_INFERNAL_AFFAIRS.md`.

## Method
- A separate copy of the release build with its own identifier (`com.productionguy.studio.livetest`), so the owner's running app and real project were never touched. It reads the same saved keys. Driven over WebView2's debug port (playwright-core); native file dialogs were driven by keystrokes into the app's own picker.
- The app's spending cap was switched on (2 USD, 0.12 USD per request assumed) as a safety net.

## What was run, and the result
| Step | Result |
|---|---|
| Paste the script, analyze | 8 scenes, 3 characters, 10 props, 4 sets in the real app (see reader fixes below) |
| Style | "Caricatured cinematic 3D" chosen from the gallery |
| Own images as front views | All three added through the app's picker, stored as they came (928x1232), approved on arrival |
| Venomspur turnaround (Gemini nano-banana 2.1, direct) | 4 views in 35 s from his front as the reference; glasses, ears, bow tie, pocket square and posture held in every view. The generated views use a neutral grey backdrop while the supplied front has the teal studio one |
| Review | Approved 3 views; regenerated Side (revision 2); **Other takes** showed both takes side by side; kept revision 1. Found bug 1 below |
| ElevenLabs batch (real, paid) | 3 lines, 110 characters, 3 voices from the owner's account, made in 9 s; the confirm step showed the plan and estimate first |
| Suno batch (real, paid) | 2 requests (Venomspur theme, scene 3 score), 4 tracks, 54 s. Themes for characters with no stated personality were skipped with the reason, as designed |
| Saved voices | Saved with **Remember the chosen voices**; survived re-analysis; survived save to `.pone` and reopening (a voice cleared in memory came back from the file) |
| Storyboard (Director's room) | 41 shots planned across 8 scenes; one frame (pier meeting) generated in 25 s: both characters recognisable, the rain-soaked coat from the script, believable harbour. Found bug 3 below |
| Save and reopen the project | Voices, picture history (including both Side revisions), 7 audio clips came back |
| Interface audit, real app | 6 workspaces x 3 looks x 2 themes; found light-theme failures (bug 7), fixed; clean after |

## Spend
Six images (5 turnaround views including the regenerated one, plus 1 storyboard frame), 110 characters of speech and 2 music requests. The app's own counter showed 0.72 USD at the assumed 0.12 USD per image request, which is an upper bound for the images; the voice and music prices were not read from the providers. Far below the 5 USD budget on any plausible price. These are estimates, not measured bills.

## Bugs found by the run, and fixed
1. **Keeping the older take left the turned-down one on show** (Design card and Character Bible used the newest revision, not the approved one).
2. **A sheet showed Approved with one of five views.**
3. **First run showed no pictures**: on a fresh data folder the Director's frame, the full-size viewer and the players got 403 because the asset scope did not cover the not-yet-created assets folder. Fixed at start-up; verified on a fresh folder.
4. **Re-analyzing wiped confirmed fields and could renumber asset ids** (found while preparing the stories).
5. **The story reader missed objects without a verb, written-out ages and "plain clothes"**, and produced a junk prop.
6. **The project kept the sample's name** instead of the script's title.
7. **Light-theme contrast** (Character Bible, recent projects, "approved", notice banner).
8. **CleanRender called a neon-lit render over-sharpened** (threshold calibrated on the owner's art and generated images).
9. Smaller: ElevenLabs clips were labelled with the voice id; batch music files had clumsy names.

## Not done in this run
- Listening to the generated voices and music (no one has listened to them).
- Video (no paid clip was made), Windows voices and local engines, VoiceKiller, OpenAI/fal/OpenRouter generation.
- The generated views do not match the supplied front's backdrop; a "match the backdrop of my own front view" option is a possible improvement.
- Skipped themes (no personality) need a trip to Identity; an inline "set personality" in the batch panel would save the trip.
