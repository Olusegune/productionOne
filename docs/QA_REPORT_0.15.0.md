# QA report — 0.15.0

| Check | Result |
|---|---|
| `npm test` | 29 files, 150 tests passed (baseline 141) |
| `npm run build` (tsc + vite) | passed |
| `npm run qa:accessibility` | static gate passed, 31 TSX files |
| `npm run desktop:build` | see build section in release notes / handover |
| Visual/responsive QA (1024px and narrower) | NOT run: needs a WebView2 session |
| Provider live calls | NOT run: no keys in this environment |

## Review findings (0.14.10 code)
- Character Bible tabs were plain buttons with no tab semantics or arrow-key support; Motion/Voice only raised a toast. Fixed in 0.15.0.
- Bible sections showed no state, so users could not tell what to do next. Fixed (queue-derived state).
- Script parsing had warnings but no per-finding confidence. Added "How this was read".
- Remaining: App.tsx is ~1860 lines; Motion/Voice are guidance-only; the build is not code-signed.
