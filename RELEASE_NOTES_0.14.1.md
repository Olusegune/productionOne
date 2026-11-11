# Production One 0.14.1

## Splash refresh

Replaced the previous character-led splash artwork with a production-design studio scene. The new composition keeps the application identity, preproduction focus, and cinematic energy while avoiding prominent generated hands and faces that could distract during startup. The splash now includes the Production One name, version `0.14.1`, a Documentation button, and restrained CSS motion with reduced-motion support.

The previous artwork is preserved as `public/splash-v1.jpg`.

![Production One 0.14.1 splash](screenshots/splash-0.14.1.png)

## QA

- Frontend unit/component tests passed.
- Rust tests passed.
- TypeScript/Vite production build passed.
- Accessibility release gate passed.
- Windows EXE, NSIS, MSI, and portable ZIP rebuilt.

The Windows installer is not digitally signed in this release because no signing certificate was supplied.

## Script parsing and style selection

- Narrated PDF scripts with bracketed sections such as `[OPENING]`, `[ACT ONE]`, and `[ENDING]` are now separated into evidence-bearing story sections instead of being treated as one undifferentiated set.
- Repeated named people in prose are surfaced as inferred characters with source evidence; this supports scripts that do not use screenplay cue lines.
- The Art Direction workspace now exposes selectable starter style presets, including watercolor storybook, stylized 3D feature, graphic novel noir, documentary naturalism, and custom style.
