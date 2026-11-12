# Changelog

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

