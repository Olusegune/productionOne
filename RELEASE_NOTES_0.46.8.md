# Production One 0.46.8

**Wide and tall storyboards at every Canvas choice, and smaller corners.**

## Changed
- Storyboard frames at 21:9, 2.39:1, 2:1, 9:16 and the other Canvas choices: the app asks each image provider for the closest shape it accepts, then trims the picture to exactly the ratio you chose. 2.39:1 is no longer refused, and fal.ai no longer refuses ratios outside its five.
- Very wide or tall frames ask the image model to keep people and important objects in the middle, since the edges may be trimmed.
- Cards, buttons, boxes, fields and dialogs have smaller corners.

## Not checked
- What each image provider returns at these ratios (no paid image was made for this release).
- Trimming a 3:2 picture to 21:9 loses about a third of its height.
