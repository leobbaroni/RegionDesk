# Verification — v0.3.0

RegionDesk is browser-only. Android integration and setup helpers were removed at the owner's request. Tests use isolated data, not the user's saved accounts.

## Automated coverage

- 12 unit tests: profile validation, URL/private-network restrictions, credential-safe errors, tab/history/bookmark persistence and separation, closed-tab recovery, and third-party tracker matching without blocking first-party or lookalike domains.
- 28 real Electron desktop groups: initial lock, save-and-connect, HTTP CONNECT authentication and 407 errors, verification/lease expiry, 429 recovery, country/timezone rejection, profile/cookie/storage isolation, native browser metadata, workers and cross-site frames, WebRTC fixture, permissions, zoom, pop-out/fullscreen, draggable tabs, address suggestions, history, restart persistence, bookmarks, find-in-page, reopening tabs and tracker blocking.
- Browser traffic in the desktop suite uses an isolated HTTPS/proxy fixture. It reports zero direct fixture requests; the local WebRTC fixture receives no direct STUN packet. Neither result is comprehensive live-provider leak certification.
- UI screenshots cover 1440px and minimum desktop layouts plus the compact floating window. Optional settings and provider comparisons are collapsed by default.

Commands: `npm test`, `npm run test:desktop`, `npm run build`. Set `REGIONDESK_CAPTURE=1` to capture screenshots under `.impeccable/review`. Tests require OpenSSL; `OPENSSL_BIN` overrides the default Git for Windows path.

## Packaging and setup

`node scripts/package-smoke.mjs` checks the packaged app, Windows password encryption, locked startup and included beginner guide. Pass an executable path to test the extracted ZIP. `scripts/portable-smoke.ps1` is an older native launch harness; it is not part of this version's executed checks.

Both the unpacked v0.3.0 app and exact ZIP extracted to the stable portable folder passed. The updated app was launched. Cleanup removed more than 4 GB of old releases and generated test data; the final project is approximately 1.1 GB including dependencies, one installed app and one current ZIP. User profiles were retained.

`Setup.bat` installs missing dependencies and builds in place; `Start RegionDesk.bat` launches it. Earlier verification exercised portable Node download and a folder path with spaces. `scripts/clean.ps1 -Preview` enumerates only generated data and superseded release copies, validates every resolved path stays within the project and refuses directory links. It never targets AppData profiles.

## Live evidence and limits

Earlier supplied-proxy checks confirmed an outgoing US IP and configured language/timezone; they are historical results, not current uptime guarantees. Live TikTok login, uploads, publishing, Shop eligibility and audience distribution are not established by this release. Residential/mobile origin, hardware-fingerprint masking and complete DNS/WebRTC leak coverage remain unverified. A US proxy cannot erase existing online-account history.

Tracker blocking uses an unmodified Ghostery engine with a small local starter list. Only network matching is used inside RegionDesk's request gate. It does not install a replacement request listener, inject browser fingerprints, fetch lists or change the route. Existing profiles keep blocking disabled until explicitly enabled. Login and upload compatibility with blocking enabled needs real-site verification; turn it off if a site breaks.

The installed app remains unsigned. Source, dependencies and user profiles have different lifetimes: deleting generated tests/releases is safe for saved accounts, whereas deleting `%APPDATA%/RegionDesk` is not.
