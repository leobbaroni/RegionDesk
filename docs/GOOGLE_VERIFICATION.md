# Google verification — 17 September 2026

The reported unusual-traffic screen was investigated with one Google search per condition, followed by one search in the final v0.1.3 ZIP-extracted build. No CAPTCHA was solved or bypassed during these checks.

| Condition | Observed result |
| --- | --- |
| RegionDesk v0.1.2, saved LA proxy | Search results; no challenge on this attempt |
| Installed Google Chrome, same proxy and confirmed outgoing IP | Redirect to `/sorry/index`; unusual-traffic challenge |
| Installed Google Chrome, direct connection | Search results; no challenge |
| RegionDesk v0.1.3, same saved LA proxy | Search results; no challenge |

Chrome controls used separate new signed-out profiles, with their native language and timezone. RegionDesk retained its existing profile and configured en-US / America/Los_Angeles settings. Each browser was launched natively with a fixed debugging port for observation, without automation-enable or sandbox-disable flags; `navigator.webdriver` was false. The direct Chrome control was separate from RegionDesk's account browser, which retains its proxy-only routing.

This small comparison supports a proxy/network contribution, but does not isolate Google's private scoring or establish permanent acceptance. RegionDesk also succeeded before the fix, so its final successful search cannot be attributed solely to the change.

## Corrected compatibility defect

The regional user-agent/language override omitted `userAgentMetadata`, clearing JavaScript Client Hints brands and platform. v0.1.3 reads genuine metadata from the trusted native app renderer and preserves it in the main browser, workers and cross-site frames. The final live reading reported Chromium 152, Windows, en-US, America/Los_Angeles and an unset automation flag. Diagnostics now display the latter two browser observations: automation flag and Client Hints platform.

The regression reproduced empty metadata before the fix. Seventeen desktop test groups and six unit tests passed, along with the production build and both packaged-app launch checks. Unmodified Electron also omitted the tested Client Hints HTTP headers; this change does not claim Chrome-equivalent HTTP headers or inject invented ones.

## If the challenge returns

[Google's unusual-traffic guidance](https://support.google.com/websearch/answer/86640?hl=en) explains that other users on shared networks or VPNs can cause this message. Complete Google's verification yourself if offered, or contact the proxy provider about the endpoint. Ask the provider to demonstrate Google access before buying a replacement. Preserve genuine profile cookies; repeatedly clearing the session removes useful continuity.

Local evidence is retained in `.impeccable/review/google-comparison.json`, `google-postfix.json` and the corresponding PNG screenshots. Those artifacts are excluded from Git. These checks do not verify TikTok acceptance, posting, account eligibility or audience location.
