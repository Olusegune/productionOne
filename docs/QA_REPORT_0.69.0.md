# QA report 0.69.0

Scope: Skin & Surface milestones 3 and 4 (lighting test; measured skin surface check; applicability rules; age integration), plus documentation.

## Automated
- Type-check clean; 1615 web tests pass (1 skipped); 132 Rust tests pass (four new, for the measurement); production web build clean; static accessibility gate passes; clippy clean; npm audit 0 vulnerabilities.
- Lighting test: four lights with no grading or skin fields; the skin wording, protected features, complexion and marks are word for word identical in all four prompts and only the lighting sentence differs; a warm undertone is never fought; lighting stored apart and pinned to the skin revision, a newer skin revision marks the test out of date; one reference per request; nothing approved automatically; locally refused requests explained and not counted as spend; per-light identity and complexion confirmations.
- Skin surface check: thresholds, evidence text with real numbers, uncertainty and checker version on every finding, the four honest states, findings in Review as open category L, unable-to-check shows the reason and records nothing, never offers a colour filter.
- Applicability: stylized, machine and skin-replacing stages excluded; base look and mild stages still checked.
- Age: wording by band, marks and complexion kept verbatim at 30, 50 and 70, one reference, the same person; ages never edit the profile.
- Portability and migration: all pictures and records present in the project data, round trip loses nothing, manifest has the skin dependency and no credentials, older projects gain nothing. The fuzz test covers the new records.

## Live (test copy of the app)
- A realistic project (Summit Sprout, opened in the test window): the lighting test unlocks only after a profile is approved, starts nothing until Generate, and shows the right preflight.
- The Rust measurement on real pictures: a picture against itself gives identical numbers; two different characters give clearly different numbers; the head is found in one and the fixed area used for the other and the result says which; a picture outside the app's folder is refused.

## Not covered
No real refinement or lighting generation has been produced or judged; no varied visual evaluation set; the measured checks have no measured accuracy against a person's judgement; no screen-reader run; Mac and signing unchanged; Rafter's scan did not run (allowance used up).
