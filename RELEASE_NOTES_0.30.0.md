# Production One 0.30.0

Two changes you asked for.

- **Close recent projects.** Each entry on the Projects screen has a close button, and the list has "Clear list". This only removes entries from the list; your project files are never deleted. Entries now show the file name instead of the full path (Windows paths showed in full before).
- **Design a voice from the script or with an AI helper.** Under a character's voice engine, "Fill from the script" writes a voice description from the character's confirmed age, gender, role, personality and sound direction, plus their own dialogue, and shows what it was built from. Nothing is guessed. "Ask the AI helper" has your local model (Ollama or LM Studio) write the description from a rough idea of yours; only confirmed fields and the character's lines are sent, and nothing leaves your computer. It works with ElevenLabs Voice Design (3 previews, then save) and with Qwen TTS. Chatterbox clones from a recording rather than a description, so it shows a note.

Checked live: ElevenLabs Voice Design with a script-built description returned 3 valid previews.

Not included: Suno music (it is only reachable through the Kie.ai reseller; waiting on your decision). Not tested: Qwen's description-as-voice against a real server, and ElevenLabs sound effects.

Windows x64: installer (setup.exe), MSI and a portable zip. Not code-signed, so Windows SmartScreen may warn.
