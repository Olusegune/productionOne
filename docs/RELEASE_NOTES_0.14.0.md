# Production One 0.14.0

Professional UI overhaul, CleanRender image quality, new branding.

**Install:** run `Production One_0.14.0_x64-setup.exe` (or the `.msi`). It registers `.pone` and `.pguy` project files with their own icon. The installer is not code-signed, so Windows SmartScreen may ask you to confirm.

## New
- Character Sheet Studio with status, large previews, compare and an inspector (references, notes, identity lock, model).
- Director's room: larger cinematic shot cards, overflow menu, grid/list/large layouts, keyboard and drag reorder, resizable sectioned shot inspector.
- Delivery Center: readiness, next action, issues grouped by scene with buttons that fix them, editable shot prompt, gated verified export.
- CleanRender: style-aware prompt guidance; measurements for colour cast, clipping, noise, edge overshoot, bloom and skin smoothness; non-destructive corrections saved as new revisions with a before/after split.
- New application and project-file icons; double-click a project to open it.
- Script import for Final Draft, Fountain, Word and PDF.
- Deeper gold, restrained corner radii, one type family.

## Verified
132 UI tests, 51 Rust tests, clippy with warnings as errors, `npm audit` and a secrets scan all clean. The installed build was driven in a real window (Design, Direct, Deliver), generated a local SDXL image through ComfyUI, and saved a CleanRender revision. A silent install registered the file associations and icons.

## Not verified / known limits
- Local video (Wan 2.2 5B) generation, OpenRouter and fal.ai generation (keys rejected), LM Studio.
- CleanRender is tested on synthetic images plus one real SDXL image; it does not review faces or hands and does not measure video flicker.
- Native menus, file dialogs and Explorer double-click were not automated.
- Not done yet: Environment Bible, choreography sheets, model recommendation modes, likeness check, undo/redo of project edits, code signing, auto-update.

See `CHANGELOG.md`, `docs/TESTING.md` and `docs/UI_OVERHAUL_REPORT.md`.
