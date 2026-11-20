# Provider limitations (what the new controls can and cannot do)

Production One passes your direction to an image model as words and reference pictures. Models differ and none is guaranteed to follow a number. This page says plainly where the limits are.

| Control | What the app does | What it cannot promise |
|---|---|---|
| Target proportions | Draws a schematic from the numbers; writes plain-language wording (large head, long arms, wide-set eyes...) into the request, only where they differ from Natural | That the picture's proportions match. Models treat wording as a hint. The review can notice a change of target, not measure a picture |
| Stylization and presets | Linear blend of documented values | That a style will draw the proportions the way you picture them |
| Field of view, sensor, depth of field, optical character | Computes a field of view from focal length and sensor and puts the words in the request | A physical camera or lens. Perspective comes from where the camera stands, not the lens. 2D styles use virtual framing only |
| Lighting design | Words for key direction, source size, contrast, rim, practicals, colour temperature | Relighting. Different lighting is a new candidate, so the face, pose and set can change a little |
| References | Sends the approved front view and photos to models that accept references (check the model picker: some models take none; fal.ai Nano Banana here is text-only) | That the character stays identical on a model that accepts no references |
| Targeted edit (inpainting) | Offered only where a provider supports it and a region is known | **No adapter in this app supports it today**, so a correction regenerates the whole view and may change other things |
| Vision review | Runs a vision-capable model **on this computer** (Ollama or LM Studio), only when you press the button, reads its answer strictly | Accuracy. It has not been measured against human-labelled pictures. "Unable to assess" is shown when a model cannot tell, fails or answers in the wrong form. No cloud vision provider is wired |
| Grading | A pure colour transform over the original pixels, previewed on storyboard frames | Colour management (no ICC or wide gamut), LUTs (not implemented), moving lights or rebuilding shadows |
| Package export | Writes records and file names | A format for any other program. Nothing is shaped for a downstream import contract |

## Provider facts worth knowing

- **Kie.ai** is preferred for Nano Banana 2.1 and Pro when a Kie key is saved; Google direct is used otherwise. fal.ai models here are text-to-image only.
- **Assistant writing models** (Gemini, OpenAI, OpenRouter, Ollama, LM Studio) only write a script from an idea. They do not make pictures.
- **Costs**: tests use a mock provider and never spend. In the app, every picture request is explicit; the correction loop stops at 3 attempts or $1.00 per finding.
