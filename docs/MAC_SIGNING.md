# Signing the Mac builds

Mac builds are unsigned, so macOS warns the first time someone opens the app ("cannot be opened because the developer cannot be verified"). Signing and notarizing removes the warning. This needs an Apple Developer Program membership (about US$99 a year), which only the account owner can set up. The workflow in `.github/workflows/mac.yml` is already prepared: it signs and notarizes **only when the secrets below exist**, and builds an unsigned app (as before) when they do not.

## What to do once

1. Join the Apple Developer Program (developer.apple.com/programs).
2. In Xcode or the developer site, create a **Developer ID Application** certificate and export it from Keychain Access as a `.p12` file with a password.
3. Make an **app-specific password** for your Apple ID (appleid.apple.com, Sign-In and Security).
4. Add these secrets to the GitHub repository (Settings, Secrets and variables, Actions):

| Secret | What it is |
|---|---|
| `APPLE_CERTIFICATE` | the `.p12` file, base64 encoded (`base64 -i certificate.p12 | pbcopy` on a Mac) |
| `APPLE_CERTIFICATE_PASSWORD` | the password you gave the `.p12` |
| `APPLE_SIGNING_IDENTITY` | the certificate's name, for example `Developer ID Application: Your Name (TEAMID)` |
| `APPLE_ID` | your Apple ID email |
| `APPLE_PASSWORD` | the app-specific password from step 3 |
| `APPLE_TEAM_ID` | your 10-character team ID |

5. Run the **macOS build** workflow as usual. The log step "Say whether the app is signed" prints `SIGNED` or `UNSIGNED`.

## Notes

- Never put these values in the repository or in a message; the secrets page is the only place.
- Tauri signs and notarizes automatically when it sees these environment variables; no other change is needed.
- Windows installers are not code-signed either (SmartScreen may warn). That needs a code-signing certificate and is separate.

## Updates

The app can tell you when a newer version exists (Project settings, Updates; Help, Check for Updates). It looks up the latest release number on the public releases page and opens that page in your browser. It does not download or install anything by itself. A fully automatic updater needs signed builds first, so it is a later step.
