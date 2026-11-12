# Production One 0.16.0 — Auditions

## Hear and see a character or prop before you commit

- **Motion audition.** The motion panel now offers tests that fit the asset: characters get turntable, idle, walk, run, speaks-to-camera and emotion beat; vehicles get drive-past, start-up and idle, door open/close; other props get handling and open/close. Every prompt repeats the identity rule and now carries the confirmed identity fields.
- **Voice audition (characters).** Pick a line the character actually speaks in the script (or type one), choose an installed Windows voice (suggested from the stated gender and age, never guessed), set the pace, and hear it. Audio is made on this computer, free and offline, and saved with the project. These are stand-in voices for casting and timing, not final performance. A "Copy casting brief" button prepares text for an outside voice tool.
- **Sound audition (props and vehicles).** A sound brief (engine start, idle, pass-by, door, horn for vehicles; handling and material sounds for other props) is saved with the asset and can be copied. Sound is not generated in this version.
- **Character Bible Motion and Voice tabs** now open these panels directly.

## Consistency fix

The identity fields you confirm (age, gender, race, ethnicity, role) were only used in the exported prompt package. They are now included in every image sheet prompt and every motion prompt for that character.

## Engineering

- Dependencies that used `latest` are pinned to the installed versions.
- Added a CI workflow (unit tests, build, accessibility gate, Rust tests).
- Rust: new `voice` module with unit tests (56 Rust tests pass).

## Limits

Video generation, voice playback and the new panels have not been exercised against a live provider or on-screen in this release. See docs/QA_REPORT_0.16.0.md. Compatibility: no project-format change; older projects open unchanged and their clips are treated as video.
