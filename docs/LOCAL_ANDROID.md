# Local Android support

RegionDesk can coordinate an existing local BlueStacks instance. Android keeps its own persistent app data; browser cookies are not converted into native-app logins. The emulator remains identifiable as an emulator. This feature does not provide hardware attestation, a SIM, or guaranteed regional account status.

## Verified setup, 19 September 2026

- BlueStacks Android 9, existing Samsung model preset, US English.
- SocksTun 8.0 from F-Droid, package `hev.sockstun`, installed through local ADB.
- Authenticated SOCKS5 route verified in Android Chrome: exit IP matched the supplied proxy. Credentials are not recorded here.
- Global IPv4/IPv6 tunnel and remote DNS selected. DNS leak testing beyond Android route inspection has not been performed.
- Android always-on VPN and block-without-VPN enabled.
- Force-stopping SocksTun removed the tunnel. Chrome failed a hostname request and an IP-literal HTTPS request (`ERR_NETWORK_ACCESS_DENIED`). Restarting SocksTun recovered the tunnel.
- Timezone changed from Europe/Lisbon to America/Los_Angeles; US English retained.
- TikTok mobile web loaded. Initial captions were Portuguese/Spanish; a later sample had English captions. No Shop tab was observed. One video reported “Unable to play media.” This is not a successful media-playback, native-app, login, upload, or US-account verification.

APK source: https://f-droid.org/repo/hev.sockstun_12.apk

Downloaded SHA-256: `c0d76c042974e9ca1333d135562d759604b62a4ae2adedc177aaf1f38a8e4d25` (recorded download hash, not an independent signing-key verification).

## Scope

In RegionDesk, select a workspace with the intended language and timezone, then open **Android**. Save the BlueStacks installation directory, instance ID (for this installation, `Pie64`) and local ADB port (`5555`). Enable local ADB in BlueStacks Settings → Advanced; leave remote ADB disabled. **Inspect Android** reads the actual settings rather than changing them.

Configure SocksTun credentials inside Android. Enable Global mode and Remote DNS, then enable Always-on VPN and Block connections without VPN in Android's VPN settings. Set the Android language/timezone to match the workspace. **Check IP in Android Chrome** requires tunnel protection; **Open TikTok web** additionally requires matching language/timezone. Confirm the displayed IP against your provider manually. RegionDesk does not certify the Android exit country or continuously monitor it.

**Copy video to Android** opens a local file chooser and transfers the selected video into `Movies/RegionDesk`. Android retains its apps, cookies and logins across RegionDesk restarts. Use separate BlueStacks instances for separate Android identities; pairings reject reuse of the same instance or port. Removing a workspace removes only its pairing, not Android data. Pairing metadata lives in `%APPDATA%/RegionDesk/android.json`; Android proxy credentials stay in SocksTun.

The opt-in `npm run test:android:live` uses isolated RegionDesk settings but the real paired emulator: it opens the IP-check page and briefly copies/removes its own generated video. It requires an already configured default BlueStacks instance and FFmpeg on PATH (`FFMPEG_BIN` can override it). Eight checks passed: pairing UI, live inspection, regional launch rejection, IP-check launch, byte-for-byte video transfer, action allowlist, duplicate pairing rejection and persistence without stale evidence after restart.

Pair each workspace with a specific emulator instance and local ADB port. Open the emulator, inspect current Android settings, open its tunnel/settings, check the exit IP in Chrome, launch TikTok web, and transfer a video to Android storage. Keep Android evidence separate from the embedded browser's connection status.

Existing Android apps and tunnel settings are user-managed. RegionDesk does not root the device, patch TikTok, bypass integrity checks, rotate device identifiers, or automatically clone signed-in instances. Local ADB gives control over Android; keep remote ADB disabled.

Acceptance requires fresh device inspection, tunnel presence, always-on lockdown, matching timezone/language, and manual confirmation of the exit IP. A tunnel interface alone does not establish the proxy's country or destination compatibility.
