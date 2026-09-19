import { FiltersEngine, Request } from '@ghostery/adblocker';

// Small, bundled starter rules authored for RegionDesk; no list downloads or
// cosmetic/script injection. This is intentionally not a full ad-blocking list.
const rules = [
  'doubleclick.net', 'google-analytics.com', 'googlesyndication.com',
  'googleadservices.com', 'googletagmanager.com', 'connect.facebook.net',
  'bat.bing.com', 'clarity.ms', 'hotjar.com', 'hotjar.io', 'segment.io',
  'mixpanel.com', 'amplitude.com', 'scorecardresearch.com', 'quantserve.com',
  'taboola.com', 'outbrain.com', 'criteo.com', 'adsrvr.org'
].map(host => `||${host}^$third-party`).join('\n');
let engine: FiltersEngine | undefined;
export function blocksTracker(url: string, sourceUrl: string, type: string): boolean {
  if (!sourceUrl || type === 'mainFrame' || !/^https?:/.test(url)) return false;
  const types: Record<string, string> = { subFrame: 'sub_frame', xhr: 'xmlhttprequest' };
  engine ??= FiltersEngine.parse(rules);
  return engine.match(Request.fromRawDetails({ url, sourceUrl, type: (types[type] || type) as Parameters<typeof Request.fromRawDetails>[0]['type'] })).match;
}
