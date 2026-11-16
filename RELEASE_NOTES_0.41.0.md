# Production One 0.41.0

**Revision compare, and batch voice and music.**

## Revision compare (Review)
When a view has more than one take (for example Profile revision 1 approved and revision 2 waiting), Review shows **Other takes (n)** beside the usual comparison with the approved reference. Two takes sit side by side, with a picker for which other take to compare with, and **Keep revision N** under each. Keeping one approves it and turns the other approved or waiting takes of that view down. No file is deleted; a turned-down take is still under *Turned down* and can be kept later. Nothing is generated.

## Batch voice and music (Design, Voice, Batch)
Cast several characters or score several themes and scenes at once.
- **Voices:** choose an engine (Windows voices, a local speech server, ElevenLabs or VoiceKiller), tick the characters and choose a voice for each. Each speaks the first line the script gives them, or a line you type.
- **Music:** tick character themes and scene scores. Each is built from the personality, role and scene heading the script states, never invented (Suno V6 Mini through Kie.ai, instrumental, about 45 seconds).
- **Cost first.** Before anything is sent you see the plan and what it will spend: nothing for Windows voices and speech servers on your network; otherwise the number of characters (ElevenLabs, VoiceKiller) or requests (Suno, two tracks each). A dollar figure appears only from a price you type, because the app does not know any provider's price.
- **Safe by design.** Nothing is sent until the confirming click. A paid batch is capped at 20 items. A key or credit problem stops the batch instead of repeating it. Characters with no line or no voice, and themes with nothing stated, are listed as skipped with the reason. Results are saved with the audio clips. **Stop after this one** is always there while it runs.

Checked: the real type check, 465 JS tests (23 new) and 78 Rust tests, clippy, `npm audit`, `cargo audit`, `rafter secrets .`. Not checked: a real paid batch (no provider was called); the new screens in the packaged app on a real project (the owner's real project is not on this PC); the interface audit on the new panels. See `docs/QA_REPORT_0.41.0.md`.

Windows x64: installer (setup.exe), MSI and a portable zip. Not code-signed, so Windows SmartScreen may warn.
