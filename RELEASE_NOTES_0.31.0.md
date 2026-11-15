# Production One 0.31.0

**Music with Suno.** In a character's Voice and sound section, "Make music with Suno" makes a character theme or the score for a scene the character is in.

- Write the style from the script (the character's stated personality and role, and the scene's heading: where and when), with the local AI helper, or by hand. If the script says too little, it tells you what is missing instead of inventing a style.
- Choose the model (V6 Mini, V6, V6 Wild), the length (10 to 180 seconds), and instrumental or your own lyrics. Each request makes two tracks, saved with the audio clips and played by the level-matched player.
- Suno has no public API, so this goes through Kie.ai with the Kie key you already use for images and video. Your text is sent to Kie.ai only when you press Make music, and each request spends Kie credits. Check Kie's and Suno's terms before using the music commercially.

Checked live: one instrumental request returned two valid stereo tracks in 22 seconds.

Not included: lyrics generation, extending or covering a track, WAV conversion, and music for a whole film timeline. Not tested: vocal tracks, and the V6 and V6 Wild models.

Windows x64: installer (setup.exe), MSI and a portable zip. Not code-signed, so Windows SmartScreen may warn.
