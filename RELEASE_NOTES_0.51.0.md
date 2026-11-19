# Production One 0.51.0

**The Assistant: give it a script or an idea, and it makes the production inside your budget.**

## New
- An **Assistant** screen: attach a Word, PDF, text, Fountain or Final Draft script; or describe a short film and it writes the script (needs a Google Gemini or OpenRouter key); or attach pictures to turn into characters, props and places.
- A **plan with the number of pictures and the cost** before anything is made, and your own **budget**. It will not start without a price and a budget, and it stops at the budget.
- It makes first concepts, then the sheets, then optionally storyboard frames, by itself. By default it **stops after the concepts** for your approval; you can let it approve clean concepts itself.
- A report of what was made, what failed and why, and what it spent (an estimate from your price).
- **Connected agents (MCP), off by default:** let Claude Desktop or another agent read your project, hand it a script and ask for a plan. Starting a run needs a separate switch, a budget within your limit and an explicit confirm. See the guide.
- **A macOS app** (Apple silicon and Intel disk images). Unsigned: macOS will warn on first open.

## Fixed on the way
- A character's or place's description written in the script now reaches every picture request (before, only descriptions you typed by hand did).

## Be aware
- Writing a script from an idea has **not** been tried with a real language model.
- The MCP server has been tested with a fake client, not with Claude Desktop itself.
- The Mac app has never been run by me on a Mac (I build on Windows), and it is unsigned.
- No drag-and-drop of files onto the window (use the paperclip).
- The cost is your own estimate from the price you enter, not a bill.

## Not checked
- See the QA report for what was and was not run live.
