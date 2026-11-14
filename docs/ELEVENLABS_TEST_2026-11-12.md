# ElevenLabs test on Production One 0.19.1 (2026-11-12)
Run through the app with the key saved in Settings. Voice "Joy - Soft Spoken" (first voice on the account), model "Latest" (shown as eleven_v4).

| Step | Result |
|---|---|
| Key saved in Settings dialog (same place as other providers) | PASS |
| Load my voices | PASS (voice list returned) |
| Model "Latest" | Shown as eleven_v4. Whether it came from the account's /v1/models list or the built-in fallback was not checked. |
| Speak "Come on, old girl. One more night." + laugh after the line | PASS: 3.5 s MP3 returned. The app sent `[laughs]` as a tag. I could not listen, so whether a laugh is audible is NOT verified: please listen to CHAR-AMINA-002_voice_audition.mp3 |
| Sound effect: "a middle-aged woman's short effortful grunt ... tired exhale" | PASS: 2.0 s MP3. Please listen to judge quality. |
| Voice design: Lagos mechanic description | PASS: 3 previews (13-14 s each). NOT kept: keeping uses a custom voice slot. |

Not tested: VoiceKiller (no key), keeping a designed voice, other models, props sound effects.
Cost: a few thousand ElevenLabs credits at most (check your usage page).
