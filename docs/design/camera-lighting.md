# Camera and lighting direction (Phase 4)

These controls **guide the picture an image model draws**. They do not simulate a physical camera, lens or lighting rig, and they do not name or emulate any real camera equipment. A shot that uses none of them is unchanged: the new fields are optional (`shot.camera`, `shot.lightingRecord`) and the existing size, angle, lens and movement controls are kept as they were.

## Honest camera terms

- **Field of view** from a focal length and a sensor: `horizontal = 2 x atan(sensor width / (2 x focal length))` (the same for vertical and diagonal with the sensor height and diagonal). "Sensor or format" is an assumption you choose; "Not set" assumes Super 35 and the app says so.
- **Perspective is set by where the camera stands, not by the lens.** A far object 4 m behind a subject 2 m away looks half its size whatever the focal length. Changing the focal length at the same spot only crops more or less of the same picture. To keep a subject the same size with a longer lens you must stand farther back, which flattens the perspective. `perspectiveRatio`, `frameFill` and `distanceForFill` in `src/domain/camera.ts` encode this and are tested.
- **Flat 2D styles** use virtual framing, foreground, middle ground and background layers, and layout language. The prompt asks for no blur, lens distortion or lens flare, and the sensor, depth-of-field and optical-character controls are switched off.
- Named equipment presets are out of scope.

## Camera record

```
shot.camera { height?, distanceM?, sensor?, focusTarget?, dof?, optical?, presetId? }
```

`focal length` stays in the existing `shot.lens` field. Applying a preset copies size, angle, lens, movement and composition into the shot and sets the record; every value stays editable and nothing else on the shot changes.

## Coverage suggestions

`adviseShot` (in `src/domain/coverageAdvice.ts`) proposes alternatives from the dramatic purpose (feeling and intensity), characters and dialogue, whether the place has a wide frame yet, the project style and what is already planned. Each shows a short reason and its limits, with confidence never above "medium". It reads the plan and never changes it; "Try this" is the only thing that edits a shot, and only when pressed.

## Lighting design

```
shot.lightingRecord { presetId?, keyAzimuth, keyElevation, sourceSize, contrast, rim, practicals, ambient, colorTempK, timeOfDay, exposure }
```

Key azimuth is in degrees around the subject as the camera sees it (0 from the camera, 90 from frame right, -90 from frame left, 180 from behind), shadows fall opposite the key. The record holds **no grading fields** (no exposure or white-balance correction, contrast curve, saturation or LUT): grading is a separate record applied over a finished picture (Phase 5). "Exposure" here is a lighting intention only. When a record is present its words replace the free-text lighting line in the picture prompt.

Lighting made through generation produces a **new candidate**. It is not relighting of known geometry, and the app says so.

**Character Lighting Test**: one picture per lighting condition for one character, same costume, pose and framing, with the neutral reference first so identity can be compared. Each picture is a separate image request made only when you press the button.

## Sensor sizes

| Sensor | Width mm | Height mm |
|---|---|---|
| Not set (assumes Super 35) | 24.89 | 18.66 |
| Micro Four Thirds | 17.3 | 13 |
| Super 35 | 24.89 | 18.66 |
| Full frame (35 mm) | 36 | 24 |
| Large format | 54.12 | 25.58 |
| 65 mm (IMAX-style) | 70.41 | 52.63 |

## Camera heights

| Height | Metres |
|---|---|
| Ground level | 0.2 |
| Knee height | 0.5 |
| Chest height | 1.2 |
| Eye height | 1.6 |
| Above head | 2.5 |
| Overhead | 5 |

## Camera presets

| Preset | Size | Angle | Focal mm | Depth of field | Movement | Purpose |
|---|---|---|---|---|---|---|
| Intimate dialogue | MCU | eye-level | 50 | shallow | static | Two people close and listening: a medium close-up at eye height, a shallow depth of field, steady. |
| Environmental character portrait | MWS | eye-level | 35 | moderate | static | A person inside the place that shapes them: medium wide, the setting readable around them. |
| Restrained dramatic close-up | CU | eye-level | 85 | shallow | static | A held close-up for a feeling that stays under the surface; a long-ish lens, no movement. |
| Wide architectural establishing frame | WS | eye-level | 24 | deep | static | Show the whole place and its lines: a wide, level frame with strong geometry. |
| Tense low-angle confrontation | MS | low | 28 | moderate | push-in | Give one person power over the frame: camera low, looking up, close enough to feel it. |
| Graphic symmetrical tableau | WS | eye-level | 40 | deep | static | A composed, flat, centred picture for a formal or comic effect. |
| Miniature-world observation | MWS | high | 50 | shallow | static | Look at a small world from close by and slightly above, as if watching a model. |
| Handheld documentary framing | MS | eye-level | 35 | moderate | handheld | Observed, slightly imperfect framing, medium distance, a hint of movement. |

## Lighting presets

| Preset | Key azimuth | Key elevation | Source | Contrast | Kelvin | Purpose |
|---|---|---|---|---|---|---|
| Neutral reference | 0 | 20 | large | low | 5500 | Even, shadow-light reference for identity and costume checks. |
| Soft daylight | -45 | 35 | large | low | 5600 | Open window or shade light, gentle shadows. |
| Overcast exterior | 0 | 70 | large | low | 6500 | Flat grey sky: no hard shadows, muted colour. |
| Warm practical interior | 60 | 25 | small | medium | 2800 | Lamps and candles in the room are the light; warm pools and falloff. |
| Moonlight | 135 | 50 | medium | high | 7500 | Cool, dim light from above and behind with soft edges. |
| Backlight / silhouette | 180 | 20 | medium | high | 4500 | Light behind the subject so the shape reads and the face does not. |
| Hard dramatic side light | 90 | 30 | small | high | 4500 | A small hard source from one side: strong shadow shapes. |
| Miniature-stage lighting | -30 | 55 | small | medium | 3800 | Small, neat, theatrical lamps over a tiny set, as for a model. |
