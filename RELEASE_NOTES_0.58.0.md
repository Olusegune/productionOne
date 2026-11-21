# Production One 0.58.0

- **Undo for decisions.** After you approve or reject a picture, or take a decision back, a bar offers Undo for 15 seconds on any screen. It puts that one picture, its approved picture and the asset's Approved label back. It never touches a file, and does nothing if the picture was regenerated or decided again since.
- **Modern sliders.** All sliders have a thin filled track and a round handle. Shape and proportion rows show the name and value on one line with the slider beneath.
- **A solid mannequin.** The proportion schematic is a soft shaded figure on a height ruler counted in heads, instead of a wire diagram.
- Spacing fix on the Remove from project dialog.

Not checked: the new sliders and mannequin were inspected in the dark look in a browser, not in the packaged app or the light look; Undo was tried live for an approval only (reject and take-back are covered by unit tests); installers were not run on a clean machine. Mac builds are unsigned.
