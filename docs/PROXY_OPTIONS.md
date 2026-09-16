# Connection options

Vendor documentation checked September 16, 2026. Advertised prices are not checkout quotes. Region availability, sharing level, taxes, bandwidth and website acceptance must be checked before purchase. There are no affiliate links and RegionDesk does not purchase services.

| Option | Published price | Implications |
| --- | --- | --- |
| Webshare Free | $0; 10 shared datacenter proxies; 1 GB/month | Useful for testing. The desired region may not be in the assigned list. Shared endpoints can be blocked. |
| Webshare static ISP | $6/month entry package (20 addresses) | Check the exact sharing and bandwidth tier. ISP registration does not establish a physical phone or residential household. |
| IPRoyal static residential | Starting from $2.70 per proxy / 30 days | Vendor advertises dedicated IPs and unlimited bandwidth. Verify current US inventory and final price. |

Sources:

- https://help.webshare.io/en/articles/8375287-do-you-offer-proxies-for-free
- https://www.webshare.io/static-residential-proxy
- https://iproyal.com/pricing/static-residential-proxies/

For one account, a consistent saved endpoint is simpler to reason about than rotating addresses. The free and paid routes use the same checks. Neither is certified here for TikTok. 1 GB can be consumed quickly by video browsing/uploads; provider billing is managed directly with the provider.

HTTP proxy support means HTTPS destinations use CONNECT tunnels. TLS verification is retained. An HTTPS upstream also encrypts the connection to the proxy itself. SOCKS5 is supported through the local bridge, including upstream credentials; no direct-network fallback is configured.

Provider subscription and account recovery stay under the user's control. Enter credentials in the app, not in project files, source code, reports or chat.
