# QA report 0.28.9 to 0.29.0 (2026-11-14)

Run on the packaged Windows app with the owner's saved provider keys, a four-character test project, and a 3,000-job synthetic queue. Spend was kept inside the $5 budget the owner set; real provider prices are not known to the app, so the owner checks the provider billing pages.

## Verdict
Go for the areas listed under *Checked*. The areas under *Not checked* are not part of this verdict.

## Checked

### Live generation (Kie Nano Banana 2.1, Kling image-to-video, ElevenLabs, VoiceKiller, Windows voices)
| Area | Result |
|---|---|
| Characters from supplied images (3) | Turnaround (5 views), poses (8), expressions (8) each; identity held across all views |
| Wardrobe costume front | Was a different person (made from text alone). Fixed in 0.28.6; re-made live, now the right character |
| Sets: all five location sheets | 6 images; consistent architecture across establishing, reverse, interior, exterior, floor plan, lighting |
| Props: multi-view, functional, detail | 8 images; one object, four views, a working-state view and a scale view |
| Wardrobe and detail for a character | 9 images, one flat grey backdrop |
| Turntable video | One full 360 degree turn (after the 0.28.4 prompt fix); face and costume held; one character's expression drifted slightly |
| Voice lines | Windows, ElevenLabs eleven_v4 and VoiceKiller all produced valid audio (not listened to) |
| Local AI (Ollama) | Text model read a script correctly; vision model described a generated image correctly |

### Stress and failure handling
| Test | Result |
|---|---|
| 23 images queued at once | Ran two at a time with no failures |
| Pause and resume mid-batch | Running work finished, queued work held, resume continued |
| Hard kill during generation | Two in-flight images came back as *failed, may already be billed*; 16 waiting jobs kept; queue started paused; retry worked |
| 300 rapid workspace switches | No errors; memory returned to baseline |
| Walk of every sheet of every asset type | All render; every default shape correct |
| 3,000-job queue, 3,000-job project save and reopen, 5,000-voice filter | Within time limits (tests) |
| Seeded fuzz: 10 seeds x 400 random queue operations | Every invariant held (attempts never decrease, one job per view and revision, every job counted once, approved implies completed); all job states reached |

### Interface (browser pane against the live app, 1024 / 1280 / 1440 / 1920 wide, both themes)
No horizontal overflow; no dark-theme contrast failures; no clipped text after the fixes below.

## Found and fixed
| # | Found | Fix |
|---|---|---|
| 1 | New or Open replaced unsaved work with no copy | Automatic backup first (0.28.3) |
| 2 | A Kie "no model page" refusal failed until retried by hand | Automatic retry after a pause (0.28.3) |
| 3 | Queue bar showed "failed" for views already re-made | Superseded failures are no longer counted (0.28.3) |
| 4 | Wardrobe costume front made a different person | Front-type views use the approved front from another sheet (0.28.6) |
| 5 | No way to override a sheet's shape or backdrop | Per-sheet Shape and Backdrop (0.28.6) |
| 6 | "11 queued, 0 running" looked stuck while views waited for approval | Queue bar says what is waiting and offers Open sheets (0.28.9) |
| 7 | A new character kept the previous character's Windows voice | Voice suggested per character (0.28.9) |
| 8 | Exported sheet captions cut off or colliding | Captions shrink to fit (0.28.9) |
| 9 | Locations with one view per sheet could not be exported | Export every sheet as one image (0.28.9) |
| 10 | "Approve identity" squeezed to 36 px with its label cut off | Action rows wrap (0.29.0) |
| 11 | Sticky tab bar let headings show through | Opaque bar (0.29.0) |
| 12 | Capital I and lowercase l identical in names | Tailed l (0.29.0) |
| 13 | Many light-theme text colours unreadable | Targeted light-theme block (0.29.0) |
| 14 | Splash screen said version 0.20.0 | Real version, guarded by a test (0.29.0) |
| 15 | "1 scenes", "1 canonical assets" | Singular forms (0.29.0) |

## Not checked
- fal.ai and OpenRouter (no keys saved), LM Studio and ComfyUI (not running).
- The installers on a clean machine (only the package contents were compared); Windows SmartScreen with an unsigned installer.
- Audio quality (the tester cannot listen); the Nigerian-language casting lines (drafts, not checked by a native speaker).
- Light theme emotion-chip contrast (a colour filter the audit cannot measure).
- Screen-reader behaviour (keyboard paths and contrast are checked; a real screen-reader pass is not).
- The Rafter remote scan could not run (plan quota used up); the local secrets scan is clean and the new Rust code was reviewed by hand (path containment, size limits, filename sanitising).
