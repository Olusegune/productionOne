# Production One 0.38.1

**Failure groups read real status codes.** Live checks against the real providers showed they write a failure's status as "(500 Internal Server Error)" or "answered 503 Service Unavailable", not just "(500)". The grouping only understood the short form, so server errors landed under "The request was not accepted" instead of "The provider had an error", and ElevenLabs errors lost their code. Both shapes are now read.

Also checked live in this round, with no change needed: Suno vocals (V6 Mini with lyrics and a female voice), Suno V6 and V6 Wild, an ElevenLabs sound effect, and the local Qwen voice-description helper.

Checked: the real type check, 433 JS tests and 78 Rust tests, `npm audit` and `cargo audit` (0 vulnerabilities), and the packaged app on a real project.

Not done: the sheet, voice, audition and queue screenshots in the guide still show the older top bar. The remote Rafter scan could not run (plan quota).

Windows x64: installer (setup.exe), MSI and a portable zip. Not code-signed, so Windows SmartScreen may warn.
