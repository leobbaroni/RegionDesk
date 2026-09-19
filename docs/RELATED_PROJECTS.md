# Free projects and integration decisions

Reviewed 19 September 2026 for a lightweight Electron browser with persistent profiles.

| Project | Fit | Decision |
| --- | --- | --- |
| [Ghostery adblocker](https://github.com/ghostery/adblocker) | Embeddable JavaScript engine, MPL-2.0. | Integrated its core matcher with a small bundled tracker rule set, inside the existing request gate. Optional per profile. No remote filter updates or injected cosmetic scripts. |
| [Min browser](https://github.com/minbrowser/min) | A compact Electron browser. | Useful UX reference. Implemented bookmarks and session tools in RegionDesk's own profile store; no Min source copied. |
| [Camoufox](https://github.com/daijro/camoufox) | Firefox-based anti-detect browser; upstream describes it as under development. | Not embedded: it requires a separate engine and a different integration, increasing size and maintenance. Its claims do not establish TikTok compatibility. |
| [Apify fingerprint-suite](https://github.com/apify/fingerprint-suite) | Fingerprint generation/injection tools for automated browsers. | Not integrated. Generated attributes would not prove coherent native hardware/TLS behavior or US account status. Preserve actual engine metadata and test regional settings. |
| [proxy-chain](https://github.com/apify/proxy-chain) | Authenticated proxy bridge already used by RegionDesk. | Retained, including fail-closed routing and explicit authentication/429 handling. |

Ghostery's Electron adapter installs request listeners. RegionDesk uses only its core matcher so the current routing/security gate remains authoritative. Basic tracker blocking does not claim comprehensive ad blocking or anti-detection. Exact rule scope is in `electron/privacy.ts`; dependencies are pinned in `package-lock.json`.

The chosen work improves normal browser use without a second runtime: a larger browser canvas, bookmarks, find-in-page, closed-tab recovery, saved profiles, native pop-out/fullscreen, and simpler connection setup. Extensions, full download management and simultaneous independent profile windows remain future features rather than implied capabilities.
