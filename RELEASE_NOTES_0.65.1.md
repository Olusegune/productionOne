# Production One 0.65.1

- **A character's picture no longer turns into the room.** Script import used to copy the whole first scene paragraph that mentioned a character into their description, so a "front view" could come back as a bedroom. It now keeps only the bracketed introduction after the name (for example "KAEL (40s, weary engineer, slate-blue tunic)"), or the one sentence that names them.
- **Head-and-shoulders pictures are real close-ups.** The prompt now says the framing comes from the request, not from the full-body reference.
- **Sets are drawn empty.** Set pictures ask for the place without people, so they can be reused.
- **A retried failure no longer blocks delivery.** A failed job replaced by a later take is not counted in Deliver or in the checklist, so "Export verified package" is available when everything is approved.
- **The cost popover closes** with Esc or a click elsewhere.
- **Review no longer clips** when a message holds a long file path.
- Known and not fixed: no voice-only flag for characters like a voice on a speaker; the queue strip counts pictures waiting for a front view as queued.

Found by generating a full 8-scene story (6 characters, 7 sets, 7 props, 85 pictures) in the app.
