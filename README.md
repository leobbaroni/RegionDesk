# RegionDesk

A local Windows workspace with an embedded Chromium browser, separate persistent profiles, proxy routing and regional browser preferences. Built with Electron, React and TypeScript. No app subscription or video studio.

## Run

Extract `release/RegionDesk-0.1.3-Windows.zip` into a normal folder and open `RegionDesk.exe` inside it. Keep all extracted files together. The ZIP replaces the self-extracting EXE, which failed to launch sandboxed Chromium from Windows Temp on this machine. This portable, unsigned build does not install a system proxy or change Windows language/timezone.

For development (Node.js 22.12 or newer):

```powershell
npm ci
npm run dev
```

To build and run:

```powershell
npm run build
npm start
```

## First connection

1. Open **Profiles**. Choose a preset or enter the desired two-letter country code, locale, IANA timezone and optional coordinates. Save.
2. Open **Connections**. Enter your provider's host, port and optional username/password. HTTP CONNECT, HTTPS proxy and SOCKS5 upstreams are supported through a local proxy bridge.
3. Add an optional provider label.
4. Save, then **Verify connection**. The app requests IP/country information from `https://ipwho.is/` through the configured proxy. The country must match; a reported timezone must also match the profile. Service outages or mismatches keep it locked.
5. Open **Browser → TikTok** or enter an HTTPS URL. Sign in yourself. **Upload a video** opens TikTok's own web uploader inside the same profile. RegionDesk does not submit posts automatically.

No free or paid proxy is bundled. The Connections screen compares vendor offers and opens their sites in your normal browser. The account browser itself never intentionally falls back to the host connection.

## Features

- Persistent, separate cookie jars, site storage, cache and proxy settings per profile.
- Regional presets for the US (East/West), UK, Canada, Australia, Germany, France, Spain, Portugal, Brazil, Japan and Singapore; editable custom regions.
- Browser language/Accept-Language, Intl locale, IANA timezone and optional coarse configured geolocation.
- Location requests blocked by default; camera, microphone, display capture, notifications and device permissions denied.
- Non-proxied WebRTC UDP restricted and QUIC disabled. These are policies, not a claim of universal fingerprint protection.
- Chromium local DNS resolution and DNS prefetching blocked; website hostnames go through the proxy. The local bridge still resolves your proxy provider's hostname.
- Regional language applied to child contexts before their scripts start. Dedicated-worker and cross-site-frame language/timezone consistency are tested.
- Genuine Chromium Client Hints preserved when applying regional preferences; diagnostics show the observed automation flag and Client Hints platform.
- Fixed upstream proxy routing without a DIRECT fallback, a connection lease, periodic verification and browser shutdown on check failure.
- Encrypted proxy-password persistence via Electron safeStorage (Windows protection); no password/cookie values in reports or logs.
- Back, forward, refresh/stop, HTTPS address entry, same-profile popup navigation, TikTok shortcuts and file upload through the web page.
- Real browser/network readings, in-memory activity log, JSON diagnostic export, per-profile session clearing and deletion.
- Keyboard navigation, Ctrl+L for address focus and reduced-motion support.

## Evidence and boundaries

An IP geolocation result is an estimate. It does not prove residential/mobile origin, a real SIM, account eligibility, undetectability, or US audience distribution. RegionDesk preserves genuine website cookies; it does not invent signed login cookies or account history.

The Windows/Chromium engine, graphics/hardware capabilities and browser behavior remain observable. All worker variants, DNS/WebRTC leak behavior across real providers, and platform acceptance are not certified. Browser checks are not an OS-wide firewall.

Connection verification uses one external service and matches country and the reported timezone, not city. Website compatibility can differ in embedded Chromium; Google/other third-party OAuth popups may require site-specific handling. New windows open in the same account view. Downloads and external app protocols are blocked. There is no ad/tracker blocklist that could silently break login or upload.

Live verification and embedded-browser outgoing-IP checks passed for the two supplied Webshare US/Los_Angeles HTTP endpoints on September 17, 2026. Live TikTok login, posting and audience distribution have **not** been verified. The repeatable automated regional tests use a clearly labeled local fixture.

The v0.1.3 Google search check returned results without a challenge. Ordinary Chrome through the same proxy was challenged during the comparison, so future CAPTCHA-free access is not established. See [Google verification](docs/GOOGLE_VERIFICATION.md) for the controls and limits.

## Local data

Profile settings and encrypted proxy passwords are stored under Electron's Windows user-data directory (normally `%APPDATA%/RegionDesk`). Chromium stores each profile under a separate `Partitions/regiondesk-<id>` directory. Sessions belong to this Windows user; keep the Windows account protected. Copying the profile file to another computer does not transfer decryptable passwords reliably.

Deleting a profile removes its settings, credentials and website data after confirmation. It does not delete the online account. **Clear session** signs out locally while retaining profile and proxy settings.

## Verification and packaging

```powershell
npm test
npm run build
npm run test:desktop
npm run package
node scripts/package-smoke.mjs
Expand-Archive release/RegionDesk-0.1.3-Windows.zip release/RegionDesk-0.1.3-Windows
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/portable-smoke.ps1
```

The desktop tests launch the real Electron app with new, isolated test data and a local authenticated proxy/HTTPS fixture. They need OpenSSL; on Windows the default is the copy bundled with Git. Override `OPENSSL_BIN` if needed. The fixture's exact certificate is pinned only in unpackaged test runs; packaged builds ignore test overrides. Set `REGIONDESK_CAPTURE=1` to capture the UI into `.impeccable/review/`.

See [TESTING.md](TESTING.md) for the verification boundary and [proxy options](docs/PROXY_OPTIONS.md) for the free/paid comparison.
