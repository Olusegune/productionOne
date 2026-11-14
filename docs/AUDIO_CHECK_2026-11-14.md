# Audio check, 2026-11-14

The tester cannot hear audio, so every voice clip made in the 0.28.x live tests was measured with ffmpeg and librosa and transcribed with a local speech model (whisper.cpp `ggml-base.en.bin`, run through ffmpeg's `whisper` filter). This checks signal quality and whether the words are right. It does not judge how a voice sounds, whether it suits the character, or acting; a person has to do that.

## Signal
| Clip | Length | Loudness (LUFS) | Pitch median (Hz) | Clipping |
|---|---|---|---|---|
| ElevenLabs Joy, test line | 4.2 s | -26.7 | 176 | none |
| VoiceKiller Bella, test line | 3.8 s | -24.2 | 173 | none |
| Windows Zira, test line | 3.7 s | -21.5 | 198 | none |
| MARA, ElevenLabs Joy | 2.1 s | -24.6 | 226 | none |
| MARA, Windows Zira | 2.2 s | -19.9 | 184 | none |
| CASSIUS, ElevenLabs Harry | 1.3 s | -18.8 | 253 | none |
| CASSIUS, Windows David | 1.7 s | -19.4 | 86 | none |
| DOMINIC, ElevenLabs Daniel | 1.0 s | -21.7 | 148 | none |
| DOMINIC, Windows David | 1.5 s | -21.6 | 88 | none |

Peaks are between about -1.5 and -9 dBFS. Every clip starts within 0.15 s. The Windows voices end with about 0.75 to 0.8 s of silence; the ElevenLabs clips with 0.15 to 0.33 s.

## Words (speech recognition against the intended line)
| Clip | Heard |
|---|---|
| Windows Zira, David (all) | Exact |
| ElevenLabs Joy (MARA), Harry (CASSIUS), Daniel (DOMINIC) | Exact |
| VoiceKiller Bella | "We are close. The compass is warm." then a 0.5 s "home." (a breath-like tail, probably not a word) |
| ElevenLabs Joy, test line (with an `[exhales]` tag) | "We are close. The compo- This is worn." The energy envelope shows about 0.4 s of silence inside the phrase, so the second half was delivered after a pause and was garbled. The tag itself was not read aloud |

## Video audio
The Kling turntable clips have no audio track. The Seedance turntable clip has an AAC track whose mean level is -46 dB; the recogniser labelled it "[MUSIC PLAYING]": an unrequested soundtrack. Fixed in 0.29.1: the app turns a Kie model's soundtrack switch off.

## Open items (for a person, or for later work)
- Listen to CASSIUS's ElevenLabs "Harry - Fierce Warrior": its median pitch is 253 Hz, high for a male warrior voice. It may be a shouted line or a pitch-tracker octave error on a 1.3 s clip.
- Loudness differs by up to 8 LU between clips, which biases voice casting toward the loudest. Fixed in 0.29.2: audition playback is level-matched.
- The roughly 0.8 s of trailing silence the Windows voices add. Fixed in 0.29.2: trimmed at playback.
- A tag placed mid-line can break a line (the ElevenLabs test line). Keep delivery tags at the start of a clause, one per clause.
- Nothing here checks the Nigerian-language draft lines: a speech model trained mainly on English is not a native speaker.
