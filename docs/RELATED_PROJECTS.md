# Related projects and integration decisions

Reviewed 17 September 2026 against RegionDesk's Electron 44 / React / TypeScript app. This is a source and architecture review, not a claim that these projects passed RegionDesk's runtime tests. No external browser code was copied or merged in this release.

## Best candidates

| Project | Current evidence | Fit and decision |
| --- | --- | --- |
| [Min](https://github.com/minbrowser/min) | Apache-2.0; not archived; repository pushed 30 August 2026. Current package uses Electron 43.4.1. | Best reference for bookmarks, history, tab groups and permission UX. Adapt individual features to profile IDs and React; do not replace our session/network manager with its whole browser. |
| [Ghostery adblocker](https://github.com/ghostery/adblocker) | MPL-2.0; not archived; pushed 16 September 2026. Embeddable filtering engine. | Strong candidate for optional per-profile tracker blocking. Use the core matching engine inside our existing request gate. Do not directly enable its Electron session adapter: it installs its own `onBeforeRequest` listener, which would replace ours. Filter updates must use an explicit protected route; login/upload compatibility needs testing. |
| [electron-context-menu](https://github.com/sindresorhus/electron-context-menu) | MIT; not archived; pushed 1 September 2026. npm 5.0.0 requires Node >=24 and depends on electron-dl, electron-is-dev and cli-truncate. | Useful if richer spellcheck/image/link menus are needed. Current defaults include search via `shell.openExternal`, which would leave the profile. For this release, a small native Electron menu provides edit/navigation/zoom actions without extra dependencies or external navigation. |
| [proxy-chain](https://github.com/apify/proxy-chain) | Apache-2.0; not archived; pushed 16 September 2026. Already integrated. | Retain the existing authenticated bridge. Its tunnel failure event exposes upstream 429 and Retry-After, now used for accurate reporting and recovery. Agent pooling options exist, but CONNECT lifetime and concurrency need provider-specific measurement before tuning. |

Repository dates are GitHub `pushed_at` snapshots, not a security audit or guarantee of release quality.

## Do not merge wholesale

- [electron-browser-shell](https://github.com/samuelmaddock/electron-browser-shell): maintained tab/extension architecture, pushed 1 September 2026. The root package declares GPL-3.0; the extension package also describes separate proprietary-use licensing. Review the exact package license before reuse. Extension background traffic and permissions would expand the boundary we currently test.
- [Wexond browser-base](https://github.com/wexond/browser-base): archived June 2023. Its current README explicitly disallows use of its code/assets; not an import candidate.
- [BrowserOS](https://github.com/browseros-ai/BrowserOS): AGPL-3.0 Chromium fork. This is an engine/build-system migration, not a component that slots into our Electron app. Its AI-agent scope does not address this release's browser-control requirements.

## Integration order

1. Ship the current native controls, saved permission policy and bounded 429 recovery with the existing proxy checks intact.
2. For request reduction, add optional Ghostery core filtering through the existing gate, with per-site exceptions and observable blocked-request counts. Test that turning filtering on/off cannot disable connection locking. This may reduce page requests but does not establish that a provider will stop rate-limiting.
3. Add profile-scoped bookmarks/history using Min as a reference. Keep data local and clearing explicit; never import another browser's personal profile automatically.
4. Consider tab management or extensions only with tests for every new background context, permission path and outgoing connection.

The v0.1.4 implementation is native Electron code: zoom and right-click controls, moving the same WebContentsView between windows, a fullscreen exit path, explicit profile permissions, and Retry-After handling. No new runtime dependency is required.

Source details: [Min package](https://github.com/minbrowser/min/blob/master/package.json), [Ghostery Electron adapter](https://github.com/ghostery/adblocker/blob/master/packages/adblocker-electron/src/index.ts), [context-menu implementation](https://github.com/sindresorhus/electron-context-menu/blob/main/index.js), [browser-shell package](https://github.com/samuelmaddock/electron-browser-shell/blob/master/package.json).
