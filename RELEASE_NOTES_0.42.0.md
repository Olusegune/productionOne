# Production One 0.42.0

**A real story through the real app, and what it found.**

A short film, THE RENEWAL (the Bureau of Infernal Affairs, with three characters from the owner's own artwork), was taken through the packaged app with real providers: story, front views from your own images, a consistent turnaround, revision compare, a paid ElevenLabs batch, a paid Suno batch, saving and reopening, and the Director's room. The sample script and world are in the `samples` folder; the full report is `docs/LIVE_TEST_THE_RENEWAL_2026-11-16.md`.

## New
- **A voice saved with each character.** Save it from the single audition (or **Remember the chosen voices** in the batch panel). The character then opens with that voice, and batches fill it in; **Tick them** ticks everyone who has one.
- A project is named from its script's title while it still has a placeholder name.
- The story reader finds objects named without a verb (a brass stamp, an umbrella), notes their condition, reads written-out ages ("nineteen") and "in plain clothes".

## Fixed
- **First run showed no pictures.** On a brand-new install the Director's frames, the full-size viewer and the players were refused until the next start. Fixed and checked on a fresh data folder.
- **Re-reading a script wiped confirmed fields** (age, personality, sound direction) and could renumber asset ids. Both are kept now.
- **Keeping the older take** (Review, Keep revision 1) left the turned-down one on show in Design; an approved take now stands for its view.
- **A sheet no longer shows Approved with one of five views.**
- CleanRender no longer calls a glowing render over-sharpened; light-theme text that was pale on pale (Character Bible, recent projects, approved state, notices) is readable.

## Checked
493 JS tests and 78 Rust tests, the real type check, clippy with warnings as errors, `npm audit`, `cargo audit`, `rafter secrets .`, and the interface audit in the real app (6 workspaces, 3 looks, dark and light). The live run spent a few cents to under a dollar by estimate, against a 5 USD budget; the figures are estimates, not provider bills.

## Not checked
Nobody has listened to the generated voices and music. No paid video clip, VoiceKiller, OpenAI, fal.ai or OpenRouter generation was run. The generated turnaround views do not match the backdrop of a supplied front view.

Windows x64: installer (setup.exe), MSI and a portable zip. Not code-signed, so Windows SmartScreen may warn.
