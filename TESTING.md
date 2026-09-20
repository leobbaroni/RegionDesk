# Verification — v0.3.3

RegionDesk is browser-only. Android integration and setup helpers were removed at the owner's request. Tests use isolated data, not the user's saved accounts.

Version 0.3.2 changes distribution and source-launch freshness. The browser checks below passed for the unchanged browser code in v0.3.1. The installer and setup fingerprint checks were run for v0.3.2.

Version 0.3.3 adds manual GitHub update controls. Fifteen unit tests passed, including update version/URL validation, corrupt/truncated download rejection, explicit installation, duplicate-action protection and a second checksum check immediately before installer launch. A real public GitHub release lookup and installer download passed both checksum checks; the live-download test deliberately did not execute the installer. Full update-to-a-future-version replacement remains to be exercised when a newer release exists.

## Automated coverage

- 12 unit tests: profile validation, URL/private-network restrictions, credential-safe errors, tab/history/bookmark persistence and separation, closed-tab recovery, and third-party tracker matching without blocking first-party or lookalike domains.
- 32 real Electron desktop groups: initial lock, save-and-connect, HTTP CONNECT authentication and 407 errors, verification/lease expiry, 429 recovery, country/timezone rejection, profile/cookie/storage isolation, native browser metadata, workers and cross-site frames, WebRTC fixture, permissions, zoom, pop-out/fullscreen, draggable tabs, address suggestions, history, restart persistence, bookmarks, find-in-page, reopening tabs and tracker blocking. New regressions cover destination tunnel failures, invalid addresses, failed popups, renderer crash/reload, short-lived frames, login redirects, server HTTP error pages, adjacent new-tab controls and bookmark clicks opening new tabs.
- Browser traffic in the desktop suite uses an isolated HTTPS/proxy fixture. It reports zero direct fixture requests; the local WebRTC fixture receives no direct STUN packet. Neither result is comprehensive live-provider leak certification.
- UI screenshots cover 1440px and minimum desktop layouts plus the compact floating window. Optional settings and provider comparisons are collapsed by default.

Commands: `npm test`, `npm run test:desktop`, `npm run build`. Set `REGIONDESK_CAPTURE=1` to capture screenshots under `.impeccable/review`. Tests require OpenSSL; `OPENSSL_BIN` overrides the default Git for Windows path.

## Packaging and setup

`node scripts/package-smoke.mjs` checks the packaged app, Windows password encryption, locked startup and included beginner guide. Pass an installed executable path to test the installation. `scripts/portable-smoke.ps1` is an older native launch harness; it is not part of this version's executed checks.

The v0.3.2 NSIS installer was installed for the current Windows user with `/S`. Verified the installed executable, desktop shortcut, Start Menu shortcut and Windows uninstall registration. Saved `profiles.json` was byte-identical before and after installation. The installed app passed the packaged smoke check and was reopened. Interactive automatic launch is configured through NSIS `runAfterFinish`; the silent installation test deliberately launches the app separately. Uninstall was not executed against the user's installation.

`powershell -NoProfile -ExecutionPolicy Bypass -File scripts/setup-test.ps1` passed: the source fingerprint remains stable for unchanged code, changes for edited/new files even with preserved timestamps, and handles folder paths containing spaces. The source launcher rebuilds when this fingerprint changes or its build stamp is absent. This release did not repeat a clean-machine dependency download.

`Setup.bat` installs missing dependencies and builds in place; `Start RegionDesk.bat` launches it. Earlier verification exercised portable Node download and a folder path with spaces. `scripts/clean.ps1 -Preview` enumerates only generated data and superseded release copies, validates every resolved path stays within the project and refuses directory links. It never targets AppData profiles.

## Live evidence and limits

Earlier supplied-proxy checks confirmed an outgoing US IP and configured language/timezone; they are historical results, not current uptime guarantees. Live TikTok login, uploads, publishing, Shop eligibility and audience distribution are not established by this release. Residential/mobile origin, hardware-fingerprint masking and complete DNS/WebRTC leak coverage remain unverified. A US proxy cannot erase existing online-account history.

Tracker blocking uses an unmodified Ghostery engine with a small local starter list. Only network matching is used inside RegionDesk's request gate. It does not install a replacement request listener, inject browser fingerprints, fetch lists or change the route. Existing profiles keep blocking disabled until explicitly enabled. Login and upload compatibility with blocking enabled needs real-site verification; turn it off if a site breaks.

The installed app remains unsigned. Source, dependencies and user profiles have different lifetimes: deleting generated tests/releases is safe for saved accounts, whereas deleting `%APPDATA%/RegionDesk` is not.
