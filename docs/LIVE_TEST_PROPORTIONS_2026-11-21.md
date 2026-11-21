# Live check: does the proportions wording change real pictures? (2026-11-21)

**Question.** Production One writes a character's proportions into the prompt in words and head units. Does an image model actually follow that wording?

**Method.** One character (KOFI, an elderly man), one image model (Nano Banana 2 through Kie.ai), the same project style and description, run from the packaged app with the real provider key. Two requests, one picture each, made with the "Generate design preview" button:

1. **Natural**: the default proportions (7.5 head units tall, legs 3.2, arms 3, hands 0.75). The prompt adds nothing about proportions.
2. **Long**: legs 4.9, arms 4.0 and hands 1.3, everything else Natural. The prompt adds the proportion sentence ("long legs ... long arms ... large hands", with the numbers in head units).

**Cost.** Two pictures, about US$0.08 at the typical price of $0.04 each. Nothing else was generated.

**What the two pictures show.**

- The Natural picture is a stockier standing figure: the torso is long against the legs, the arm hangs to about mid-thigh, the hand is ordinary in size.
- The Long picture is visibly different in the ways that were asked for: the legs are longer and thinner against the torso, the arms hang much lower (the fingertips reach below the knee line), and the hands are larger and more prominent. The head also reads smaller against the whole figure.
- Everything that was not changed stayed close: the same age and face character, the same kind of clothing and sandals, a plain room.

**Conclusion.** For this model and this wording, the proportion sentence does move the picture in the asked-for direction, and the effect is easy to see. Two pictures are a spot check, not a measurement: different models and different seeds will vary, a stronger setting gives a stronger effect, and nothing here proves exact head-unit ratios. The numbers are still given once for models that can use them.

**Not done.** No other model was tried, no repeat runs were made to see how much the same prompt varies, and the pictures were not kept in the repository (they are the project's own art).
