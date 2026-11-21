# Production One 0.64.0

- **Topaz Labs in the app.** On a picture in Review, **Enhance with Topaz…** enlarges and sharpens it (2x or 4x) into a new, larger picture, using your own Topaz API key.
  - **Set up once:** create a key at topazlabs.com (My account, API keys) and add it under Providers (Topaz Labs).
  - **Safe by design:** only Topaz's non-generative Enhance models are offered (Standard, High fidelity, Low resolution, CGI and illustration, Text), so faces, costume and pose are not redrawn. The window shows the new size and a likely cost before anything is sent, refuses a result that is too large, and shows your Topaz balance. Nothing is sent and no credit is used until you press **Enhance (uses Topaz credits)**.
  - **The result** is a new revision that waits for your decision. The original is kept. The key is used only by the app, and the download link never receives it.

Not tested against the live Topaz service (it needs your key): the request and response handling follow Topaz's published API reference and are covered by tests. Model names in Topaz's documentation disagree in places; if Topaz rejects one, the app shows Topaz's message. Not checked: Mac build, Locate file through the real dialog, installers on a clean machine.
