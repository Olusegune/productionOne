# Skin & Surface: guide

For photorealistic characters. It helps you ask for believable skin (natural texture, restrained highlights, natural tone) without losing who the person is. It never promises a perfect picture: an image model tries, and you decide.

Where it is: **Design, pick a character, Age & appearance, Skin & Surface.** It opens by itself only when the project's style is photorealistic. In a 2D or stylized project it stays closed and nothing here is ever written into pictures, so the style is never pushed toward realism.

## 1. The profile (free)

Pick a starting preset, then change anything you like:

| Preset | What it sets |
|---|---|
| Natural | Natural texture and tone, restrained highlights, no retouching |
| Clean portrait | The same natural detail, a polished presentation, even tone, light retouch |
| Weathered | Pronounced texture, matte finish, varied tone. It does not change the age |
| Custom | Start from Natural and set each control yourself |

Controls: texture detail, surface finish, tonal variation, fine facial hair, retouching. Each is a named level with a one-line explanation. Add **distinctive marks** (what and where, both required). Choose what a refinement must **not change**: facial structure, complexion, age, expression, hair, marks, body proportions, wardrobe, pose, background. Regional controls (forehead, cheeks, nose, eye area, lips, neck, hands) are hidden until you open them.

Complexion and undertone are only your own words. Nothing else in the profile is chosen from them. Makeup has its own box. Temporary conditions (sweat, dirt, wetness) have their own list and never change the approved profile. Saving a profile makes no picture and costs nothing. Once approved, it is written into new pictures of that character.

## 2. Refining the skin of an approved picture (spends money)

Under the profile, **Refine the skin of the approved picture**. It needs an approved profile, an approved front view of the character, a photorealistic style and a model that accepts a reference picture. When something is missing it says which, and nothing starts.

Press **Generate refinement** (the card above it says what will be made, kept and left alone, and the cost; an unknown cost stays "unknown"). Two candidates are made, a head-and-shoulders and a full-front, each from the approved original of that view. The original is never changed. The candidates are filed under their own look ("<Name>, refined skin").

Compare: side by side, original only or candidate only; synchronized zoom and pan; **Look closely at** forehead, eye area, cheeks or mouth (found from the detected head, so a looking aid and not a measurement). Two decisions are kept apart: **Identity** (same face, age, expression, marks) and **Surface** (more natural). You cannot approve without confirming identity: better-looking skin alone is never enough. **Request changes** keeps the candidate in history; **Turn down** rejects it. Approving makes the candidate an approved version and a look you can make sheets for.

**Check skin surface (advisory)** is free and runs on this computer. It measures the face area of the original and the candidate and can notice a picture that is much smoother, much rougher, shinier, or a different average colour. It shows the evidence, how uncertain it is, what to do and which checker made the finding, and puts open items in Review (category L, Skin surface). It cannot see identity, aging, moved marks, makeup, detail across views or sharpening halos, and says so. "Passed for the checks performed" never means the picture is right.

## 3. Lighting test (spends money)

**Lighting test** makes the same approved person and skin profile under four lights: neutral diffuse, soft side, directional and backlight (the face stays readable). The lighting is stored separately from the skin profile and tied to the exact skin version it was made with; approve a newer skin profile and the test is marked out of date, nothing else.

Each picture is a new candidate from an image model, not the same picture relit, and never a colour filter. Warm light and natural undertones can be intentional, so nothing tries to remove a warm cast. For every light the screen says what that light is expected to do to colour and asks you three separate questions (same person; complexion matches allowing for the light; surface still natural). Keeping a light as a reference needs identity and complexion confirmed.

## 4. Ages, transformations, robots

An age variant of a photorealistic character carries the approved profile plus age-appropriate fine detail for that age. Aging is fine surface detail only: it is never dirt, damage or heavy weathering, and the same marks and complexion are kept. A character declared as a machine, a stylized style, and a transformation stage that replaces human skin (scales, metal, decay, another material) get no human-skin wording and no human-skin checks; the screen says why.

## 5. Provider notes

- A refinement and a lighting test need a model that accepts a reference picture. The app only knows whether a model does, not how many pictures it accepts, so it sends exactly one reference and never trims silently.
- Models edit the whole picture. None of the connected providers can be limited to a region and **masks are not supported**, so regional controls are wording in the request. A candidate can change more than the skin.
- Only the opening sentence of the request differs by provider family; what to preserve and what to refine is identical. Whether the wording differences change results has not been measured.
- A picture must be inside the app's own pictures folder to be used as a reference (a safety rule). If a project was opened from another folder, a request is refused on this computer before it is sent, the screen says so, and nothing is charged.
- Retries add to the spend shown; requests refused on this computer are counted separately and not charged.

## 6. Known limits

- No real refinement or lighting run has been judged yet. Whether the skin looks right across ages, complexions, makeup, facial hair and lighting needs a person's eyes on real runs.
- The measured checks are heuristics: a difference can come from framing, focus or resolution. They work best on the head-and-shoulders picture and fall back to a fixed middle area when no head is found.
- No colour numbers are shown for complexion; colour is judged by a person against the reference and the light.
- Marks are protected by instruction only; a model can still move one, which is why the check list names it as not checked.
- Skin conditions (sweat, dirt) are recorded but not yet used to make condition pictures.
