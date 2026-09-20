# Browser controls

Use the same saved profile for the same account. A profile has independent cookies, storage, proxy settings, tabs, history and bookmarks. Verify its connection after opening the app or switching profiles.

- **Save and connect** saves proxy credentials and runs the route/country/timezone check.
- **Star** adds/removes the current page from this profile's bookmarks. Click a saved bookmark to open a new tab; the small X removes it.
- **Ctrl+F** or **Find in page** searches the active page. Enter/arrow buttons move through matches; Esc closes the search.
- **Ctrl+Shift+T** or **Reopen closed tab** restores the latest closed URL. This restores the address, not unsaved form contents. Up to 20 are retained; clearing history clears this list too.
- **Ctrl+T**, **Ctrl+W**, **Ctrl+Tab** and the tab strip manage tabs. Drag tabs to reorder or use Shift+Left/Right on a focused tab.
- **+** sits immediately after the tabs. Bookmarks, shortcuts and history entries open in new tabs. **Ctrl+R** reloads the current page, including a failed page.
- **Pop out** moves the same live view into a native window with tabs, bookmarks, find, address/history navigation, zoom and a Browser menu. Closing it docks the view. It does not create a second independent profile.
- **F11** enters/leaves full screen; **Esc** leaves fullscreen. Zoom uses the toolbar or Ctrl plus/minus/0.
- **Profiles → Advanced regional settings and permissions** contains location, language, timezone and media permission controls. Saving requires a new check.
- **Block common third-party trackers** is optional per profile. It uses a small bundled Ghostery-compatible list and does not hide hardware fingerprints. Disable it and save if site functionality breaks.

HTTP 429 displays a cooldown. A still-valid session survives transient rate limits, but the verification lease does not extend; an expired lease locks browsing. A failed website, popup or tab shows its own error with Reload and Back controls. Confirmed route/authentication failures during connection checks still lock the browser. No direct network fallback is enabled.

RegionDesk's loopback bridge needs no incoming LAN firewall access. It does not edit Windows Firewall. Account pages stay in the managed browser; provider comparison links open in the ordinary system browser. Downloads, arbitrary browser extensions and concurrent independent profile windows are not implemented.
