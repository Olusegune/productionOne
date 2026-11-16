# Production One 0.44.0

**Choose the engine for a view that must be made again.**

## New
- On a failed or waiting view, choose **Nano Banana**, **Seedream 5.0 Pro**, **GPT Image 2.5** or a model **on this computer** (ComfyUI), then press **Use**. Nothing is sent by choosing, and your spending limit still applies.
- A view built from the approved front uses the image-to-image version of the model, so the character stays the same. An engine that cannot take reference images says **no identity lock**. An engine whose key is missing says which key to add.
- Without a Kie.ai key, GPT Image uses OpenAI directly (GPT Image 1.5) and Seedream uses OpenRouter (Seedream 4.5).

## Fixed
- Takes whose picture is not on this computer were counted as failed jobs on Deliver, with the advice "Retry them, or choose a different model". They now have their own line, group and count, and the only button is **Open Design**.

## Checked
See `docs/QA_REPORT_0.44.0.md`.

Windows x64: installer (setup.exe), MSI and a portable zip. Not code-signed, so Windows SmartScreen may warn.
