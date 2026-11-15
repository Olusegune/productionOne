# Production One 0.32.0

A redesign of the interface, a picture for every visual style, and the fixes found along the way.

- **One sidebar.** The top bar and the repeated step bar are replaced by a left sidebar: project name and real save state, the workspaces (Alt+1 to Alt+5 unchanged), the next step as one button with its reason, Local AI, the command palette and Providers. It shrinks to icons below 1280 px wide. Colours are calmer, primary actions are champagne, and nothing essential is under 12 px.
- **Review workspace** (sidebar, Alt+6). Every picture waiting for a decision, large, beside the approved reference it has to match. Technical checks are shown apart from your decision: Approve, Request changes (turns it down and opens its sheet; nothing is generated) or Reject (the file is kept; find it under Turned down). The sidebar badge counts what is waiting.
- **Deliver** opens with a package checklist; every open line has a button to where it is fixed, and an export is a draft until the list is done. The hand-off options come before the optional shot compiler, which is collapsed when no shots are planned.
- **Style gallery.** "Browse styles" replaces the 117-item dropdown: search, a chip per family, favourites, a detail panel, and a picture of the same scene in each of the 117 styles. Choosing a style does not lock it.
- **Fixed:** a set, prop or vehicle no longer shows Age, Gender, Race, Ethnicity or Personality (character facts saved by older projects are kept and listed). Recent projects show file names, can be closed one by one, and can be cleared (this never deletes a file).
- **Since 0.31.0 in the same line of work:** design a voice from the script or with your local AI helper (ElevenLabs Voice Design, Qwen TTS); make a character theme or a scene score with Suno through Kie.ai.

Checked: the real type check, 350+ JS tests and 78 Rust tests, a layout and contrast audit at four widths, and the packaged app on a real project. Live: ElevenLabs Voice Design, Suno, and picture generation for the gallery.

Not done: the Script and Asset Studio layouts, grouping repeated failures by cause, a compact task list in place of the department matrix. The screenshots in the guide still show the older top bar. The light theme still has a few low-contrast labels (emotion chips and two small labels).

Windows x64: installer (setup.exe), MSI and a portable zip. Not code-signed, so Windows SmartScreen may warn.
