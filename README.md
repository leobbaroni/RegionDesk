# RegionDesk

A Windows browser workspace with separate saved profiles, verified proxy routing and regional settings. Free local app; bring your own proxy. Android support has been removed.

![RegionDesk browser](docs/images/workspace.png)

## Start without coding tools

1. **[Download the Windows installer](https://github.com/leobbaroni/RegionDesk/releases/latest/download/RegionDesk-Setup.exe)** and double-click it. It installs for your Windows account and opens RegionDesk automatically.
2. Next time, use the **RegionDesk desktop icon** or search for RegionDesk in the Start Menu.
3. In **Profiles**, choose a name and region preset, then **Save profile**.
4. In **Connections**, enter your proxy details and click **Save and connect**.
5. Open **Browser**, enter an HTTPS address, and sign in yourself.

No ZIP extraction, Node.js, Git or build commands are needed. Windows x64 is supported. The installer is unsigned, so Windows may show an unfamiliar-publisher warning. Download only from this repository's Releases page.

To update, close RegionDesk and run the latest installer. Your saved profiles and logins are kept. Uninstall through Windows **Settings → Apps → RegionDesk**; saved profile data is retained.

### Running the source instead

If you downloaded **Code → Download ZIP**, extract the complete folder and double-click **Start RegionDesk.bat**. It installs missing dependencies, builds new or changed code, and opens the app. **Setup.bat** is optional if you want to prepare the app without opening it.

Setup supports Windows x64. It reuses compatible Node.js or downloads a checksum-verified portable runtime inside the project. It does not change system PATH, Windows proxy settings or timezone. First setup needs internet access. Run `Setup.bat --no-pause` for unattended setup.

## Everyday browsing

| Action | Control |
| --- | --- |
| Address bar | `Ctrl+L` |
| New / close tab | `Ctrl+T` / `Ctrl+W` |
| Reopen closed tab | `Ctrl+Shift+T` or the undo arrow |
| Reorder tabs | Drag, or Shift+Left/Right while a tab is focused |
| Find in page | `Ctrl+F` or the magnifier |
| Save a bookmark | Star beside the bookmark bar; click a bookmark to open a new tab |
| Separate browser window | **Pop out**; **Dock browser** or close the window to return |
| Full screen | `F11`; `Esc` to leave |
| Zoom | Toolbar or `Ctrl` plus/minus; `Ctrl+0` resets |
| History | **History** or `Ctrl+H` |

Each profile keeps its own cookies, tabs, history, bookmarks and proxy. Switching profiles locks browsing until its connection is checked. Existing account history on a website is not reset. Pop-out moves the same browser session; it is not a second simultaneous account window. Downloads and arbitrary browser extensions are not currently supported.

The **+** beside your tabs opens a new tab. Bookmarks, saved shortcuts and history entries open in a new tab. A failed page shows an error in that tab; use **Reload page**, **Go back**, or enter another address. Other tabs and the verified connection remain available. An actual connection-check failure still locks browsing.

## Optional tracker blocking

Enable **Block common third-party trackers** in Profiles. It uses the open-source [Ghostery filtering engine](https://github.com/ghostery/adblocker) with a small bundled starter rule set. There are no filter downloads or extra browser engines. Turning it off and saving restores compatibility if a site breaks. This is not comprehensive ad blocking, fingerprint masking or a guarantee of site acceptance. See [integration decisions](docs/RELATED_PROJECTS.md) and [third-party notices](docs/THIRD_PARTY.md).

## Connection and privacy boundaries

Managed pages use the configured proxy with no direct fallback. A country/timezone mismatch, expired check or route failure locks browsing. Local-network requests are blocked, non-proxied WebRTC UDP is restricted and QUIC is disabled. Diagnostics separates configured preferences from measured results.

A matching IP country does not establish residential/mobile origin, account eligibility, TikTok Shop availability or audience distribution. The genuine browser engine and hardware remain observable. [Testing evidence and limitations](TESTING.md) lists what was actually verified.

## Saved data and updates

Profiles and encrypted proxy passwords live in `%APPDATA%/RegionDesk`. Cookies and site data use separate profile partitions. `browsing.json` stores tabs, up to 500 history entries, 100 bookmarks and 20 closed tabs per profile without encryption. Clearing history also clears recently closed tabs, while keeping bookmarks and cookies. **Clear session** signs out locally; **Delete profile** removes that profile's data.

To update, close the app, extract the new download into a new folder and run its setup if needed. Keep the old folder until the update starts successfully. Your AppData profiles stay in place. Do not copy another browser's personal profile into RegionDesk.

## Keep it light

**Clean Project.bat** removes generated test data and old release copies. It keeps source, dependencies, the current installer and `release/RegionDesk-Windows` (the legacy portable app folder). It does not touch the installed app or saved profiles. Close tests and packaged test apps first. Preview with `powershell -NoProfile -File scripts/clean.ps1 -Preview`.

Source, tests and documentation are small; Chromium accounts for most of the installed app size. No emulator or second browser engine is required. Build outputs, downloads and test data are ignored by Git.

## Development

Work on `main`, per the owner's requested workflow.

```powershell
npm ci
npm run dev
npm run build
npm test
npm run test:desktop
npm run package
```

`npm run package` creates `release/RegionDesk-0.3.2-Setup.exe`. The GitHub release uses the stable download name `RegionDesk-Setup.exe`. `node scripts/package-smoke.mjs` checks the unpacked app; pass an installed executable path to check the installation. Tests use isolated local fixtures and require OpenSSL (Git for Windows' bundled copy is the default).

## Troubleshooting

- **Setup cannot find files:** extract the whole ZIP; do not run inside its preview.
- **Download/build failed:** check the error, retry Setup.bat, and inspect `.setup/dependencies.log`.
- **Authentication error:** copy current credentials from your provider and use Save and connect.
- **Country/timezone mismatch:** choose a profile matching the provider's measured location or change the proxy.
- **HTTP 429:** wait for the displayed cooldown; repeated checks do not help.
- **Site fails while connected:** try another HTTPS page; disable optional tracker blocking if enabled. Site acceptance and TikTok publishing are not guaranteed.

Additional references: [browser controls](docs/BROWSER_CONTROLS.md), [proxy research](docs/PROXY_OPTIONS.md), [Google investigation](docs/GOOGLE_VERIFICATION.md).

No open-source license has been granted for RegionDesk (`UNLICENSED`). Third-party components retain their respective licenses.
