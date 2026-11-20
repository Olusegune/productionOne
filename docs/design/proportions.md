# Proportions (profile schema v1)

A **proportion profile** records the *target* body and face proportions for one character. It is guidance for image models and a deterministic schematic drawing. It is **not** a measurement of any generated picture: image models cannot be made to obey a number, so the profile is used to (1) draw the schematic, (2) add plain-language wording to prompts (Phase 2), and (3) give later checks something to compare against.

Four things are kept apart everywhere in the app:

1. **Target proportions**: what you want (this record).
2. **Schematic preview**: a diagram drawn only from the target. Same profile, same drawing. Not a picture of the character.
3. **Generated interpretation**: an AI candidate, requested only by pressing *Generate preview*. Never approved automatically.
4. **Approved design**: the views you have signed off. Changing the target never changes approved work.

## Record

```
proportionProfile {
  id            stable; the character's asset id
  schemaVersion 1
  preset        natural | elongated | compact | large-headed | long-limbed | angular | rounded | custom
  stylization   0..100
  controls      { <controlId>: { value, unit, source: "default" | "override" } }   (all 17 are always present)
  heightM       the character's height in metres (default 1.75, range 0.2 to 3); an assumption you set, used for fit rules
  exceptions    [ { control, note } ]   deliberate departures for this character
}
```

Stored in the project file as the optional `studio.proportions` map (asset id to profile). A project saved before this existed has no such field and is read as "no profiles": its prompts and drawings are unchanged (a golden test compares every prompt of a saved 0.51.2 project, byte for byte). Reading a saved profile never throws: missing or invalid fields take the defaults below and values are clamped to range.

The profile has a content fingerprint (`pp1-` plus eight hex digits) over its preset, stylization, height, controls and exceptions. Outputs store it (and a copy of the profile) so a later change can be noticed; see `character-layers-and-fit.md`.

## Measurement conventions

- **Head unit**: one *head height*, chin to crown. Body lengths are in head units.
- **Head width**: face width at the cheekbones. Shoulder and hip widths are in head widths.
- **Stacked height** (used by the conflict warning): head (1) + neck + torso + legs. A simplified vertical decomposition that ignores the overlap of chin and shoulders. It equals the height control for every starter profile.
- Eye size, jaw and elongation are ratios of face width or head height, as stated per control.
- The unit shown beside every value is the denominator.

## Controls

| Id | Label | Unit | Min | Max | Default | At stylization 100 | How it is measured |
|---|---|---|---|---|---|---|---|
| `heightInHeads` | Head size (height in heads) | heads | 3 | 10 | 7.5 | 5 | Total height divided by head height (chin to crown). A smaller number means a larger head. |
| `torsoLength` | Torso length | heads | 1.5 | 4.5 | 3 | 1.85 | Shoulder line to crotch, in head heights. |
| `legLength` | Leg length | heads | 1.5 | 6 | 3.2 | 2 | Crotch to floor, in head heights. |
| `legBalance` | Upper / lower leg balance | percent | 40 | 60 | 50 | - | Thigh length as a share of the whole leg (hip to ankle). 50 is an even split. |
| `armLength` | Arm length | heads | 1.8 | 4.5 | 3 | 2.2 | Shoulder joint to fingertip, in head heights. |
| `armBalance` | Upper / lower arm balance | percent | 40 | 60 | 52 | - | Upper arm as a share of shoulder-to-wrist length. |
| `handSize` | Hand size | head heights | 0.4 | 1.3 | 0.75 | 0.95 | Wrist to middle fingertip, as a fraction of head height. |
| `footSize` | Foot size | head heights | 0.5 | 1.6 | 1 | 1.2 | Heel to toe, as a fraction of head height. |
| `shoulderWidth` | Shoulder width | head widths | 1.2 | 4 | 2.6 | - | Shoulder to shoulder, in head widths (face width at the cheekbones). |
| `hipWidth` | Hip width | head widths | 1.2 | 3.8 | 2 | - | Widest point of the hips, in head widths. |
| `neckLength` | Neck length | heads | 0.05 | 0.9 | 0.3 | 0.15 | Chin to shoulder line, in head heights. |
| `eyeSize` | Eye size | face widths | 0.1 | 0.4 | 0.2 | 0.3 | Width of one eye as a fraction of face width. |
| `eyeSpacing` | Eye spacing | eye widths | 0.5 | 2.2 | 1 | - | Gap between the inner corners of the eyes, in eye widths. |
| `noseLength` | Nose length | head heights | 0.1 | 0.4 | 0.25 | - | Brow line to base of the nose, as a fraction of head height. |
| `jawChin` | Jaw and chin | ratio | 0.5 | 1 | 0.75 | 0.62 | Jaw width at the mouth line divided by face width at the cheekbones. Lower is a narrower, more pointed chin. |
| `facialElongation` | Facial elongation | ratio | 1 | 1.9 | 1.35 | 1.2 | Face height (crown to chin) divided by face width. Higher is a longer face. |
| `shapeLanguage` | Rounded to angular | score | -100 | 100 | 0 | - | A style score for the shapes of the body and face: -100 fully rounded, 0 neutral, 100 fully angular. |

## Starter profiles

| Profile | Stylization | Differs from Natural | Note |
|---|---|---|---|
| Natural | 0 | (Natural values) | Typical adult human proportions, about 7.5 heads tall. |
| Elongated | 20 | heightInHeads=8.7, legLength=4.3, neckLength=0.4, armLength=3.5, facialElongation=1.5, shoulderWidth=2.3, hipWidth=1.8 | Tall and slender, a fashion-illustration figure. |
| Compact | 25 | heightInHeads=6.25, torsoLength=2.6, legLength=2.5, armLength=2.6, neckLength=0.15, shoulderWidth=2.8, hipWidth=2.2 | Short and sturdy. |
| Large-headed | 60 | heightInHeads=4.9, torsoLength=1.9, legLength=1.9, armLength=2.2, neckLength=0.1, eyeSize=0.28, handSize=0.9, footSize=1.15 | A big head on a small body, common in cartoons and chibi-like designs. |
| Long-limbed | 30 | heightInHeads=8.5, legLength=4.1, armLength=3.8, handSize=0.9, footSize=1.2, neckLength=0.4 | Normal head and torso with extended arms and legs. |
| Angular | 40 | shapeLanguage=75, jawChin=0.6, facialElongation=1.5, shoulderWidth=3, hipWidth=1.7 | Sharp planes, strong shoulders, a pointed chin. |
| Rounded | 40 | shapeLanguage=-75, jawChin=0.9, facialElongation=1.15, shoulderWidth=2.4, hipWidth=2.4, eyeSize=0.24 | Soft curves, a round face, full hips. |
| Custom | 0 | (Natural values) | Starts from Natural; set every control yourself. |

These are **starting points, not rules**. Natural is an ordinary adult about 7.5 heads tall. Nothing here is a claim about what a character should look like; an intentionally large eye or long arm is a valid design and is never "corrected" toward the Natural values.

## Linked controls and overrides

**Stylization** (0 to 100) moves the controls that have an "At stylization 100" value, in a straight line from the starter profile's value to that target: `value = base + (target - base) x stylization / 100`. Height, neck, torso, legs and arms move together, so the stacked height stays equal to the height control. Every other control is untouched.

Any control can be **overridden**: moving its slider marks it `override`. An override is never moved by stylization or by choosing another starter profile. *Reset* on a control returns it to the derived value; *Reset profile* removes every override and every exception and returns to the profile's starter values.

## Undo and redo

The panel keeps the last 100 edits (at least 50 are required) per character while it is open. Choosing another character starts a fresh history; the saved profile is always the latest state.

## Warnings

Warnings never block. A control within 5% of its range from either end is **extreme**. **Conflicts**: parts that do not add up to the height; eyes that do not fit across the face; arms too short for the torso and legs; large hands on short arms; angular shape language with a very wide jaw. *This is intentional* records an exception for a single-control warning and hides it.

## Schematic preview

A front-view mannequin: head ellipse (with eyes), neck, torso, hips, arms in two segments with a hand, legs in two segments with feet. One head height is 36 px. Redrawing is a pure function and takes well under a millisecond; moving a slider makes **zero provider or network calls** (tested with a mock that fails on any call). There is no 3D editor.

## Groups

A profile belongs to a character. A project-wide default and group inheritance are not implemented; the record has no group field yet.
