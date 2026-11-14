# Production One 0.15.0

## Highlights

- **Character Bible shows real progress.** Each section (Identity, Turnaround, Poses, Expressions, Wardrobe, Details) now shows its state — not started, generating, needs review, approved — derived from the generation queue using the newest revision of every view. Motion video unlocks only when Identity and Turnaround are approved; Voice unlocks when the script has dialogue for the character. Locked sections say exactly what to do next instead of showing a toast.
- **Accessible section tabs.** The Character Bible tabs are a true ARIA tablist with roving tabindex and Left/Right/Home/End keyboard navigation, a labelled tabpanel and a live-region next step.
- **Explainable script parsing.** The reading panel has a new "How this was read" section: why the format was chosen, a high/medium/low confidence for every character (e.g. found only in action lines), scenes missing INT/EXT or time of day, and a jump link to the source line. Items needing review are listed first.

## Compatibility

No project-file, queue, or provider changes. Existing `.pone` / `.pguy` projects open unchanged.

## Validation

See docs/QA_REPORT_0.15.0.md.
