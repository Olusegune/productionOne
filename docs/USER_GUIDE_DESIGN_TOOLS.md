# User guide: shape, camera, light, review and looks (0.52)

All of this is optional. Nothing changes in a project until you use it, and nothing here approves anything for you.

## Shape and proportions (Design > Identity, characters)

1. Open a character and press **Set target proportions**. Pick a **starting point** (Natural, Elongated, Compact, Large-headed, Long-limbed, Angular, Rounded, Custom). These are starting points, not rules.
2. Move **Stylization** (0 natural, 100 fully stylized) and the main sliders; **More controls** has the rest. A slider you move is yours: stylization and a new starting point will not move it. Reset one control, or **Reset profile**. Undo and redo keep the last 100 edits.
3. The **schematic** is a diagram drawn from your numbers. It is not a picture of the character. Warnings tell you about extreme or conflicting settings; they never stop you. **This is intentional** marks a deliberate choice (huge eyes, very long arms) so it is never treated as a problem.
4. **Generate preview** asks an image model for one candidate (one request). Moving sliders never contacts a model.
5. **Use as the world default** makes new characters start from this profile.

The four things on screen are kept apart: your **target**, the **schematic**, a **generated interpretation** (a candidate, never approved automatically) and the **approved design**.

## Fit and scale (below the proportions panel)

- **Proposed rules** for chairs, desks, doorways, reach, steps and handles come from the proportions and the character's height (set in metres; an assumption you control). Approve, reject, or mark one **intentionally cramped or oversized**. Only approved "fit" rules reach a prompt.
- **Scale and Fit reference**: a lineup, doorway, chair, desk, step and handheld prop to one scale. Sizes are labelled illustrative.
- **Redesign the imported picture** (when a character has an imported photo or drawing): your original is never changed. Landmarks are estimates until you confirm them. A stretched preview is labelled as a preview. **Generate redesign candidate** makes a new picture to compare with the original; **Approve as a new revision** is your decision.
- If approved views were made with earlier proportions, the panel counts them and leaves them as they are.

## Camera and lighting (Direct > shot editor)

- **Camera details**: start from a preset (intimate dialogue, environmental portrait, restrained close-up, wide architectural, low-angle confrontation, graphic tableau, miniature observation, handheld documentary) and edit anything. Height, distance, sensor, focus, depth of field and optical character guide the picture; they do not simulate a camera. The readout shows the field of view for the lens and sensor. Flat 2D styles use virtual framing, so lens controls are switched off.
- **Other ways to cover this shot** gives suggestions with a short reason and how sure it is. They never change your plan.
- **Lighting design**: preset or your own key direction, height, source size, contrast, rim, practicals, ambient, colour temperature and exposure intention. A different lighting is a new candidate, not a relit copy. **Make a lighting test** asks for one picture per condition of one character (neutral reference first).
- **Blocking map**: a top-down map of the scene in metres. Add people and props, seat someone on a chair, say who a chair belongs to, place the camera for this shot and turn it. Moving the camera never moves anyone. To move someone between shots, record the change with a reason.

## Visual review (Review, at the bottom)

- **Run checks** is free and instant: it compares each picture with your records (proportions, style, layout, fit).
- **Check with a vision model (this computer)** is separate and optional: it uses a vision-capable model from Local AI and sends nothing online. Its accuracy has not been measured; treat its findings as suggestions.
- A picture shows **Not checked** until a check has run (that is not a pass), **Passed** (naming the categories checked), **Needs review**, or **Unable to assess**.
- Per finding: **View evidence**, **Accept**, **Dismiss**, **Mark intentional**, **Regenerate this view with a fix**. A correction is a new revision of that view only, waits for your approval, and stops after 3 attempts or $1.00.

## Looks and grade (Direct, below the animatic)

Add a look (exposure, temperature, tint, contrast, saturation, tints), apply it to the project, a scene or one shot, and compare with the original (Show the original), with strength and reset. The picture file is never changed. LUTs are not available yet.

## Exporting

**Deliver** now adds `Project Bible/design_records.json` to the package. An export that would include a key, a credentials file or a local model file is refused with the reason.
