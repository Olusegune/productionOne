# Production One 0.55.0

- **LUT import.** Add a `.cube` LUT to a look (Direct, Looks and grade). It is applied after the grade with its own strength, changes colour only, and your original pictures are never touched. Broken files are refused with the line and the reason; LUTs that look like log or HDR LUTs are warned about and not applied unless you confirm. Each LUT is exported with the package.
- **A UX polish pass:** screens open at the top instead of partway down; Design no longer wastes a column at smaller window sizes; the style picker no longer shrinks to "Re…"; "1 shot" and "1 frame" read properly; the animatic play button has a name for screen readers; the Visual review notes are no longer run together.

Not checked: LUTs were checked against calculated values, not against another program's output or a real colourist LUT; installers were not run on a clean machine. Mac builds are unsigned.
