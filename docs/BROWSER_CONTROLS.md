# Browser controls and connection recovery

## Page controls

- Zoom from 50% to 300% using the toolbar, Ctrl +/-, Ctrl 0, or the page's right-click menu.
- **Pop out** moves the existing page into a separate resizable window. It retains the same WebContents, proxy route, regional settings and cookies. Closing that window returns the page to the workspace.
- **Full screen** or F11 uses the floating browser. Esc or F11 leaves full screen. The floating window's Browser menu includes zoom, navigation, return-to-workspace and lock actions.
- **Permissions** opens profile settings. Camera, microphone, notifications and programmatic clipboard access default to Block. Website fullscreen defaults to Allow. These apply to the current top-level origin and its same-origin frames. Native user-initiated copy/paste remains available.
- Location is either blocked or supplied from configured coordinates. It does not grant host geolocation. Local-network/loopback access, screen capture and device permissions remain blocked.

Saving permissions locks browsing until verified again. Moving between windows does not create a new browser identity; switching profiles closes the active browser and floating window.

## HTTP 429

Previously, any failed upstream CONNECT tunnel immediately destroyed the browser. A transient 429 now fails that request without discarding the still-verified page. Verification waits for Retry-After (30 seconds if absent; at least five seconds), backs off on repeated failures and allows at most two automatic verification retries after the first failure. Manual verification also respects the cooldown. Page loads are not automatically replayed.

The region service's own HTTP 429 is reported separately from an upstream proxy tunnel 429. Successful verification renews the existing 90-second lease; a rate limit never extends it. Expiry locks and closes browsing, even while a retry is pending. Authentication errors, region mismatches and other route failures still lock immediately. There is no direct fallback.

## Windows Firewall prompt

The proxy bridge binds only to `127.0.0.1`, and does not require incoming access from other computers. Cancel Windows' incoming-network permission prompt; do not enable public/private inbound access just to browse. Windows firewall prompts and rules refer to the executable path, so extracting every version to a different directory can trigger another prompt. Keep the extracted app at the stable `release/RegionDesk-Windows` path for subsequent updates, closing it before replacing files.

The 17 September inspection found separate existing inbound rules for old versioned executable paths, including block rules. This release does not modify Windows Firewall, the system proxy or the Windows timezone. Loopback binding and proxy routing are app protections, not a claim of an OS-wide firewall.

## Verification boundary

The controlled fixture checks startup/service/upstream 429 behavior, cooldown enforcement, recovery, expired-lease locking, zoom, full-screen movement/close, permission denial/grants and profile isolation. The DNS/WebRTC probes and stopped-proxy check still require zero direct fixture requests and zero direct UDP STUN packets. Live provider availability and every possible network protocol are not certified by these checks.

## Tabs, history and address suggestions

Each profile saves its own tab URLs, titles, order, selected tab and up to 500 recent unique history URLs. There are up to 32 tabs per profile. Switching live tabs retains their pages; locking, changing profiles or quitting closes live pages but preserves saved tabs. After verification, only the selected saved tab loads. Other tabs load when selected.

Use + or Ctrl+T to create a tab, its close button or Ctrl+W to close it, and Ctrl+Tab / Ctrl+Shift+Tab to cycle. With a tab focused, Shift+Left/Right changes its order. Popups open managed tabs. Drag a tab onto another tab to change its position in either window. The floating browser has a visible tab strip, address/history suggestions, back/forward/reload, zoom, fullscreen and a return-to-workspace button. The native title bar moves/resizes the window. Tab changes stay synchronized with the workspace and preserve loaded pages.

Ctrl+L focuses the address bar in the window containing the page. Matching history suggestions support Up/Down and Enter. History or Ctrl+H opens searchable history with reopen, open-in-new-tab, remove and clear actions. Clearing history requires confirmation and keeps open tabs and cookies. History is stored locally without encryption; this is address/history autocomplete, not form or password autofill.
