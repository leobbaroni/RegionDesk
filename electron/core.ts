import { randomUUID } from 'node:crypto';
import { isIP } from 'node:net';
import { regions, type Profile, type ProfileInput, type ProxyConfig } from '../shared/types';

export function defaultProfile(name = 'United States'): Profile {
  const { name: _, ...region } = regions[0];
  return { ...region, id: randomUUID(), name, locationPermission: 'blocked',
    proxy: { protocol: 'http', host: '', port: 8080, username: '', hasPassword: false, provider: '', monthlyCost: 0 },
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
}
function cleanString(value: unknown, max: number, label: string): string {
  if (typeof value !== 'string' || value.length > max || /[\u0000-\u001f\u007f]/.test(value)) throw new Error(`Enter a valid ${label}.`);
  return value.trim();
}
export function validateProfile(raw: ProfileInput, previous?: Profile): Profile {
  if (!raw || typeof raw !== 'object' || !/^[a-f0-9-]{36}$/.test(raw.id)) throw new Error('Invalid profile.');
  const name = cleanString(raw.name, 80, 'profile name'); if (!name) throw new Error('Give the profile a name.');
  const country = cleanString(raw.country, 2, 'country code').toUpperCase();
  if (!/^[A-Z]{2}$/.test(country)) throw new Error('Use a two-letter country code, such as US.');
  const locale = cleanString(raw.locale, 40, 'language');
  try { new Intl.Locale(locale); } catch { throw new Error('Use a valid language code, such as en-US.'); }
  const timezone = cleanString(raw.timezone, 80, 'timezone');
  try { new Intl.DateTimeFormat('en', { timeZone: timezone }).format(); } catch { throw new Error('Use a valid timezone, such as America/New_York.'); }
  if (!Number.isFinite(raw.latitude) || Math.abs(raw.latitude) > 90 || !Number.isFinite(raw.longitude) || Math.abs(raw.longitude) > 180) throw new Error('Enter valid latitude and longitude coordinates.');
  if (!['blocked', 'configured'].includes(raw.locationPermission)) throw new Error('Choose a location permission.');
  const p = raw.proxy;
  if (!p || !['http', 'https', 'socks5'].includes(p.protocol)) throw new Error('Choose a supported proxy protocol.');
  const host = cleanString(p.host, 253, 'proxy host');
  if (host && !isIP(host) && (!/^[a-zA-Z0-9.-]+$/.test(host) || host.startsWith('.') || host.endsWith('.') || host.includes('..'))) throw new Error('Enter only the proxy hostname or IP, without a URL or credentials.');
  if (!Number.isInteger(p.port) || p.port < 1 || p.port > 65535) throw new Error('Proxy port must be between 1 and 65535.');
  if (!Number.isFinite(p.monthlyCost) || p.monthlyCost < 0 || p.monthlyCost > 30) throw new Error('Monthly connection cost must be between $0 and $30.');
  if (raw.password !== undefined && (typeof raw.password !== 'string' || raw.password.length > 1024 || /[\r\n\0]/.test(raw.password))) throw new Error('Invalid proxy password.');
  return { id: raw.id, name, country, city: cleanString(raw.city, 80, 'city'), locale, timezone,
    latitude: raw.latitude, longitude: raw.longitude, locationPermission: raw.locationPermission,
    proxy: { protocol: p.protocol, host, port: p.port, username: cleanString(p.username, 256, 'proxy username'),
      provider: cleanString(p.provider, 80, 'provider name'), monthlyCost: p.monthlyCost, hasPassword: previous?.proxy.hasPassword ?? false },
    createdAt: previous?.createdAt ?? new Date().toISOString(), updatedAt: new Date().toISOString() };
}
export function proxyURL(proxy: ProxyConfig, password: string): string {
  if (!proxy.host) throw new Error('Add a proxy before connecting.');
  const url = new URL(`${proxy.protocol}://${isIP(proxy.host) === 6 ? `[${proxy.host}]` : proxy.host}:${proxy.port}`);
  if (proxy.username) url.username = proxy.username;
  if (password) url.password = password;
  return url.toString();
}
export function normalizeURL(input: string, testMode = false): string {
  if (typeof input !== 'string' || input.length > 4096) throw new Error('Enter a valid website address.');
  const value = input.trim();
  const url = new URL(/^[a-z][a-z0-9+.-]*:/i.test(value) ? value : `https://${value}`);
  const localTest = testMode && url.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(url.hostname);
  if (url.protocol !== 'https:' && !localTest) throw new Error('Only HTTPS websites can be opened.');
  if (url.username || url.password) throw new Error('Website addresses cannot include credentials.');
  if (!url.hostname || (!testMode && (url.hostname === 'localhost' || isPrivateHost(url.hostname)))) throw new Error('Local network addresses are not allowed in the account browser.');
  return url.toString();
}
export function isPrivateHost(host: string): boolean {
  const h = host.replace(/^\[|\]$/g, '').toLowerCase();
  if (h === 'localhost' || h.endsWith('.localhost') || h.endsWith('.local')) return true;
  if (isIP(h) === 4) { const [a, b] = h.split('.').map(Number); return a === 0 || a === 10 || a === 127 || a === 169 && b === 254 || a === 172 && b >= 16 && b <= 31 || a === 192 && b === 168; }
  return isIP(h) === 6 && (h === '::1' || h === '::' || h.startsWith('fc') || h.startsWith('fd') || /^fe[89ab]/.test(h) || h.startsWith('::ffff:'));
}
export function connectionError(code: unknown): string {
  const message = String(code);
  if (/407|auth|credentials/i.test(message)) return 'Proxy authentication failed. Check the username and password.';
  if (/timeout|timed|abort/i.test(message)) return 'The proxy check timed out. Check the endpoint and try again.';
  return 'Could not verify the proxy connection. Check its address, credentials and remaining bandwidth.';
}
