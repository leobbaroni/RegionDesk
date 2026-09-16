# Verification

## Automated checks

`npm test` checks profile validation, stable independent IDs, proxy-credential URL encoding, prohibited navigation schemes/private literal destinations, and redacted error messages.

`npm run test:desktop` launches the real Electron application and checks:

- Browsing is blocked before a connection is verified.
- All four app screens render at 1440×900 and the main browser screen fits at 1060×740.
- The proxy form saves credentials; verification is disabled while edits are unsaved.
- Leaving an edited form offers a native confirmation; cancellation retains the draft and explicit discard does not save it.
- The location choices expose native radio semantics and support arrow-key selection.
- Authenticated HTTP CONNECT carries a real TLS connection to a local HTTPS fixture.
- A matching reported country unlocks browsing; timezone, language and WebRTC policy are read from the browser.
- Passwords are absent from renderer state and plaintext profile storage.
- Website content has neither Node.js nor the application's privileged IPC bridge.
- Location requests are denied by default; a UK profile can return its configured coordinates.
- US/UK profiles do not share cookies or local storage.
- Returning to a profile and restarting the app retain its own session; startup remains locked until reverified.
- A country mismatch closes and locks the browser.
- Stopping the upstream proxy locks browsing, with zero direct requests recorded at the fixture.

The test harness uses an ephemeral certificate trusted by exact SHA-256 pin only in an unpackaged test run. It does not disable production TLS validation. Test data lives under `.test-data/`, separate from the user's normal profile. Screenshots and the run report are under `.impeccable/review/` and are excluded from Git.

## Verified build: 16 September 2026

The production build, six unit tests, and twelve desktop test groups passed. After `npm run package`, `node scripts/package-smoke.mjs` launched the packaged Windows app and confirmed packaged mode, encrypted-storage availability, a locked startup, and that development test-data overrides are ignored. This smoke check uses the normal application data directory; it does not configure a proxy or log in.

The portable executable is `release/RegionDesk-0.1.0-Windows.exe`. It is unsigned and uses the default Electron icon.

## Not established by these tests

- Actual free or paid provider availability, IP reputation or residential/mobile classification.
- Live TikTok login, CAPTCHA behavior, upload/post submission or third-party OAuth compatibility.
- The country distribution of viewers.
- Real-provider DNS/WebRTC leak testing, complete hardware-fingerprint masking or worker/iframe consistency.
- Live HTTPS-proxy or SOCKS5-provider compatibility (the automated upstream fixture uses HTTP CONNECT).

These are limitations, not passing checks. TikTok web actions remain user-controlled.
