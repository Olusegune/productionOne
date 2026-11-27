# Wardrobe, age and transformation: a guide

These tabs sit inside a character in **Design**: **Wardrobe studio**, **Age & appearance**, **Transformations** and **Looks & continuity**. They let you design clothes, show a character at another age, change them in stages, and keep track of which combination is approved. The face you approved stays the starting point throughout.

## Before you start

- Approve the character's **front view** (Sheets, Identity). Everything below is made from it, so each tab says so if it is missing.
- Pick an image model that accepts **reference pictures** (for example Nano Banana). A model that cannot see a picture cannot keep a face, so these tabs refuse it and say why instead of guessing.
- Open the cost chip and set a price per request. Every button shows what it will cost before it does anything. Moving a slider or typing never costs anything.
- Nothing is approved for you. Each picture waits for your decision.

## The same steps in every tab

**Set it up, make a preview, compare, approve, then make the reference sheets.** Previews are candidates: you can turn one down and make another, and a decision, once made, is never changed behind your back. To change something that is approved, you make a new version; the old one stays.

## Wardrobe studio

1. **New garment.** Name it and describe it in your own words. The boxes (silhouette, fabric, colour, closures, era, climate and more) are optional, and every list has **Custom**. The garment is drawn on its own, as clothing only, so it never depends on what the character happens to be wearing.
2. **Make previews.** You get a front, a back and a fabric close-up. Approve the one that is right.
3. **Fit it to the character.** Choose what must stay exactly the same (face and hair, body, pose, accessories) and press **Fit it**. Compare the candidate with the approved character and the garment side by side, and approve the outfit. Image models cannot fit clothes exactly, so look at every candidate.
4. **Make wardrobe sheets for this look** opens the Sheets tab on that outfit.

The same garment fitted to another character is a separate fit. Changing the garment later marks only its fits, conditions and looks as out of date.

### Conditions: wear, damage, dirt, wetness, repair

Under an approved garment, **New condition**. Choose a kind, then add each change: the part (sleeve, cuff, hem...), **the wearer's side**, how heavy it is, and what happened. Left and right always mean the wearer's own: in a front view their left is on the right of the picture. A condition can start from the pristine garment or from an earlier approved condition; what the earlier one established (a tear, a patch) stays. That is how you build pristine, dusty, torn, wet, and a separate branch such as repaired, faded.

To put the garment in a condition on a character, choose the condition in **Condition of the garment** before **Fit it**.

## Age & appearance

Choose what you want:

- **The same person at another age**: recognisably them. Name what must stay recognisable (for example the scar through the left eyebrow).
- **A younger- or older-looking redesign**: the same role and costume with more freedom in the face.
- **A relative**: a new, separate, linked character. It is not an age of the first, and it costs nothing to make.

Drag the age and adjust the details as much as you like: **nothing is made until you press the button**. You get a full-body picture and a portrait; compare them with the source and approve. The costume, pose and marks are kept unless you untick them. In a 2D style the result stays drawn, not rendered. Image models do not predict how a particular person ages, so treat a candidate as a plausible picture for you to judge.

To dress the aged character, use **Fit it to** in the Wardrobe studio.

## Transformations

Pick a kind (zombie or infected, monster, supernatural, robotic, hybrid, elemental, or Custom). A preset only fills the boxes; change any of them. Then make the stages in order, for example subtle symptoms, partial transformation, full form. Each stage starts from the approved stage before it and records what changes, so they read as one character changing.

- **What must remain recognisable** names features that are kept in every stage.
- The **recognisability slider** is a creative target that you judge by eye. It is not a score.
- **What the body is meant to have** (for example `fingers: six on each hand`) tells the checks that a feature is deliberate. A creature with six fingers is judged as six, not as a human with a mistake. This is also given to the vision review when you run it.
- Choose whether the costume is kept, adapted to the new body, or damaged by the change, and how strong the result may be for your audience.

## Looks & continuity

A look is an approved combination of a body (as approved, an age, or a transformation stage), an outfit, a condition and accessories, pinned to the exact versions you chose.

- **Compose a look**: pick the parts and the screen shows what clashes and what to do about it: an outfit fitted to a different body, a condition the outfit picture does not show, a condition made from another version of the garment, two accessories for the same place. Some conflicts block approval. Others you can accept after reading them.
- **Needs updating** lists exactly what is out of date after something changes, in the order to remake it, and how many other approvals are untouched. **Bring up to date** moves a look to the newest approved versions once its parts have been remade.
- **In the story** shows which look each scene uses. The Director's room warns when a shot uses a different look from the one assigned to its scene.
- **Comparison sheets** export one labelled image of the base character beside every approved age, every stage of a transformation, or a garment and each of its conditions. Each label carries its version id.

## Exporting and moving a project

- **Export verified package** (Deliver) includes the design records. Once you have made garments, ages, transformations or looks, they include a section listing every record with its version ids, what it depends on, which approvals are out of date, and for each picture the provider, model, attempts, estimated cost, prompt and which reference picture played which part. It contains file names only, never folders, keys or tokens.
- Saving the project (`.pone`) keeps all the records. Pictures are files on disk: when you move a project to another computer, use the app's relink so the pictures are found again; nothing is silently dropped.

## What it cannot do

- It cannot check that a picture looks right. Checks cover your settings and records; whether a face is recognisable, a tear is on the correct sleeve or a hand has the right fingers is for you (or the vision review, which only suggests).
- A look that combines an age with a transformation stage has no picture of that exact combination; it can only be approved as a record after you accept the warning.
- Damage is chosen by part and side, not drawn on the picture. There are no drawn masks yet.
- Models can still get left and right, or a detail, wrong. The prompts say which side is meant, but you check the result.
