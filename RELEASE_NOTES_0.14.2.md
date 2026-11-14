# Production One 0.14.2

## Script templates

The Story workspace now provides guided templates for screenplay, Fountain, narrated treatment/PDF prose, and shot-list workflows. Templates include examples and extraction guidance while preserving the user’s imported source text.

The narrated-prose reader now ignores title/front-matter text before the first bracketed section, avoids creating a false untitled scene, and filters ordinary words such as “because” and “another” from character extraction. Recurring named people remain evidence-backed and reviewable.

## QA

- Web unit tests: passed
- Rust unit tests: passed
- Production build: passed
- Accessibility release gate: passed
