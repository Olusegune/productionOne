# Production One 0.34.0

Two changes to Deliver.

- **Failed views are grouped by cause.** Views that failed for the same reason are one group, not a long list: how many, which models, what happened in plain language, and only the fixes that can help: **Refresh models**, **Use the model you chose for these**, **Choose a model**, **Provider Settings** and **Retry all**. Each view's own message is under Details, with its own Retry. Nothing is sent until you press a button, and retrying may use credits.
- **A Tasks list replaces the Agent Department Board.** Grouped as Needs approval, Ready or running, Blocked and Complete. Each line gives the role, what it is about, why it is in that group, and a button to the place the work is done. A role's group follows your project's real state (a role with nothing to do shows as complete). The old "Propose task" button only showed a message and is gone: there is no agent behind a task, the list tells you where the work is.

Checked: the real type check, 393 JS tests and 78 Rust tests, `npm audit` and `cargo audit` (0 vulnerabilities), the layout and contrast audit of Deliver at three widths, and the packaged app on a real project.

Not seen on real data: the failure groups (your project had no open failures); they were checked in tests and on a test page. Still open: the guide's screenshots show the older top bar, a few light-theme labels are low contrast, and the remote Rafter scan could not run (plan quota).

Windows x64: installer (setup.exe), MSI and a portable zip. Not code-signed, so Windows SmartScreen may warn.
