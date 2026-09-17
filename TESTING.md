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
- A same-country timezone mismatch closes and locks the browser.
- Dedicated workers and cross-site frames report the US profile's language and timezone.
- Main-page low/high-entropy Client Hints match the genuine engine metadata; workers and cross-site frames retain native low-entropy hints. HTTPS Accept-Language remains en-US.
- Fixture hostnames are resolved by the proxy while Chromium local hostname resolution fails as intended.
- WebRTC emits zero direct UDP STUN packets and no local ICE candidates in the controlled probe.
- Stopping the upstream proxy locks browsing, with zero direct requests recorded at the fixture.

The test harness uses an ephemeral certificate trusted by exact SHA-256 pin only in an unpackaged test run. It does not disable production TLS validation. Test data lives under `.test-data/`, separate from the user's normal profile. Screenshots and the run report are under `.impeccable/review/` and are excluded from Git.

## Verified build: 17 September 2026

The production build, six unit tests, and seventeen desktop test groups passed. `node scripts/package-smoke.mjs` checks the unpacked packaged app. The authoritative portable launch check is `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/portable-smoke.ps1`: it launches the executable extracted from the final ZIP with no debugging or sandbox-disabling arguments and requires the workspace and credential-storage status to render. These smoke checks use the normal application data directory; they do not configure a proxy or log in.

The original self-extracting portable reproduced `ERR_FAILED (-2)` from Windows Temp. Chromium logged repeated GPU-process exits with code `-2147483645` (`0x80000003`). The same archive worked outside Temp or with sandboxing disabled. A custom-protocol experiment still failed, ruling out a file-URL-only problem; that experiment was removed. v0.1.1 ships a ZIP whose extracted executable runs normally with sandboxing enabled. The original Playwright smoke test missed this location-specific sandbox launch failure. The native regression test reproduced it before the packaging correction.

The portable archive is `release/RegionDesk-0.1.3-Windows.zip`; extract all files and run `RegionDesk.exe`. It is unsigned and uses the default Electron icon.

## Live proxy regression: 17 September 2026

Both supplied Webshare LA HTTP endpoints returned HTTP 407 with the previously saved password. The current credential supplied in the screenshot succeeded. It was saved through the app using Windows encryption. In the final ZIP-extracted v0.1.2 app, both endpoints verified US / America/Los_Angeles and an embedded-browser request to api.ipify.org confirmed the same outgoing IP. The original selected profile and endpoint were restored. The fixture suite also checks that an upstream 407 produces a specific authentication message without credential disclosure.

## Not established by these tests

The bounded live Google comparison and final v0.1.3 search are documented in [GOOGLE_VERIFICATION.md](docs/GOOGLE_VERIFICATION.md). A successful search is not a guarantee of future acceptance.

- Provider availability beyond the two tested endpoints, IP reputation or residential/mobile classification.
- Live TikTok login, CAPTCHA behavior, upload/post submission or third-party OAuth compatibility.
- The country distribution of viewers.
- Real-provider DNS/WebRTC leak testing, complete hardware-fingerprint masking, or all shared/service/nested-worker variants.
- Live HTTPS-proxy or SOCKS5-provider compatibility (the automated upstream fixture uses HTTP CONNECT).

These are limitations, not passing checks. TikTok web actions remain user-controlled.
