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

The production build, seven unit tests, and twenty-three desktop test groups passed. `node scripts/package-smoke.mjs` checks the unpacked packaged app. The authoritative portable launch check is `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/portable-smoke.ps1`: it launches the executable extracted from the final ZIP with no debugging or sandbox-disabling arguments and requires the workspace and credential-storage status to render. These smoke checks use the normal application data directory; they do not configure a proxy or log in.

The original self-extracting portable reproduced `ERR_FAILED (-2)` from Windows Temp. Chromium logged repeated GPU-process exits with code `-2147483645` (`0x80000003`). The same archive worked outside Temp or with sandboxing disabled. A custom-protocol experiment still failed, ruling out a file-URL-only problem; that experiment was removed. v0.1.1 ships a ZIP whose extracted executable runs normally with sandboxing enabled. The original Playwright smoke test missed this location-specific sandbox launch failure. The native regression test reproduced it before the packaging correction.

The portable archive is `release/RegionDesk-0.1.4-Windows.zip`; extract all files and run `RegionDesk.exe`. It is unsigned and uses the default Electron icon.

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

## v0.1.4 browser controls and rate limits

Startup 429 stays locked and retries after the cooldown. Service/tunnel 429s preserve an existing verified page, respect Retry-After and recover automatically. A simulated expired lease still locks browsing. Tests exercise toolbar and keyboard zoom, floating/full-screen/HTML fullscreen and close-to-dock, preserved browser identity, default camera/notification denial, configured grants, and blocked private-network requests. Profile switching closes the detached browser. Screenshots cover full/compact controls and the permissions editor. See [controls](docs/BROWSER_CONTROLS.md).

The final ZIP-extracted v0.1.4 passed both package checks. A native launch with a temporary fixed debugging port verified the saved LA proxy, then requested api.ipify.org before and after moving the same page to a floating window. Both readings matched the verified US endpoint, en-US and America/Los_Angeles; navigator.webdriver was false. Fullscreen and docking passed. The owned TCP listeners were restricted to 127.0.0.1 (proxy bridge and the temporary test debugger). Evidence: `.impeccable/review/live-controls.json`. No Windows Firewall settings were changed; this is not comprehensive real-provider leak certification.

## v0.1.5 tabs and profile history: 18 September 2026

The production build, 10 unit tests and 26 desktop groups passed. New coverage checks live page retention across tab switching, popup-created tabs, switching tabs in a floating window, keyboard history suggestions, searchable/removable profile history, profile separation and restart restoration of tab IDs/order/selection without page requests before verification. Store tests cover reordering, clearing history independently of tabs, closing the last tab, and invalid destinations. Existing route-failure, lease-expiry, permission, zoom and fullscreen checks remain passing.

Both packaged launch checks passed for v0.1.5, including native sandboxed launch of the executable extracted from `RegionDesk-0.1.5-Windows.zip` into `release/RegionDesk-Windows`. The desktop shortcut had still targeted v0.1.1; it now points to that stable folder. No new live-provider or TikTok check was performed in this release.

## v0.1.6 floating browser and draggable tabs: 18 September 2026

Build, 10 unit tests and 27 desktop groups passed. Real drag gestures reorder tabs in the workspace and floating browser; both windows share the saved order. The floating shell provides visible tab switching, new/close tabs, address entry and history suggestions. Tests check page placement below the controls, preserved page state, native and website fullscreen, close-to-dock, and that the floating shell cannot invoke profile-management IPC. Screenshots cover 1184px and 600px content widths.

Both v0.1.6 packaged-launch checks passed, including native sandboxed launch from the final ZIP at the stable portable path. The desktop shortcut reopened the updated app. No new live-provider test was performed.

## Folder-local Windows setup: 19 September 2026

`Setup.bat --no-pause` passed when launched from outside the project directory, detecting existing Node and skipping already installed dependencies. An isolated copy in a path containing spaces, with Node removed from PATH and no node_modules, downloaded and checksum-verified portable Node 22.22.0 and installed the locked packages. The completed setup also installed the Electron runtime and built successfully using that portable Node. Profiles remain in the existing application data location. Setup does not alter system PATH or require an administrator installer. The normal app launch UI was not re-tested for this script-only change.
