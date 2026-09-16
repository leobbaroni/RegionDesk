import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultProfile, normalizeURL, proxyURL, validateProfile, connectionError, isPrivateHost } from '../electron/core';

test('profiles have separate immutable storage identifiers', () => {
  const a = defaultProfile(), b = defaultProfile(); assert.notEqual(a.id, b.id); assert.match(a.id, /^[a-f0-9-]{36}$/);
});
test('regional input accepts valid settings and rejects timezone and coordinate errors', () => {
  const p = defaultProfile(); assert.equal(validateProfile(p).country, 'US');
  assert.throws(() => validateProfile({ ...p, timezone: 'Madeup/Place' }), /timezone/);
  assert.throws(() => validateProfile({ ...p, latitude: 91 }), /coordinates/);
  assert.throws(() => validateProfile({ ...p, proxy: { ...p.proxy, host: 'https://user:pass@server/' } }), /hostname/);
  assert.throws(() => validateProfile({ ...p, proxy: { ...p.proxy, port: NaN } }), /port/);
});
test('proxy URL encodes secrets without interpreting credentials as URL syntax', () => {
  const proxy = { ...defaultProfile().proxy, host: '127.0.0.1', username: 'u@x:y', port: 1080 };
  const result = new URL(proxyURL(proxy, 'p@ss:/#?'));
  assert.equal(decodeURIComponent(result.username), 'u@x:y'); assert.equal(decodeURIComponent(result.password), 'p@ss:/#?'); assert.equal(result.hostname, '127.0.0.1');
});
test('website navigation rejects local files, insecure URLs, credentials and literal private destinations', () => {
  assert.equal(normalizeURL('www.tiktok.com'), 'https://www.tiktok.com/');
  for (const url of ['file:///C:/secrets', 'javascript:alert(1)', 'data:text/html,hello', 'http://example.com', 'https://user:pass@example.com', 'https://127.0.0.1', 'https://192.168.1.2', 'https://[::1]']) assert.throws(() => normalizeURL(url));
  assert.equal(normalizeURL('http://127.0.0.1:8989', true), 'http://127.0.0.1:8989/');
});
test('private IPv4 and IPv6 addresses are recognized', () => {
  for (const host of ['localhost', 'x.localhost', '192.168.1.1', '172.16.4.1', '10.1.1.1', '169.254.1.1', '::1', 'fc00::1', 'fe80::1']) assert.equal(isPrivateHost(host), true, host);
  assert.equal(isPrivateHost('8.8.8.8'), false);
});
test('connection errors never echo upstream credentials', () => {
  assert.doesNotMatch(connectionError('failed at http://super-secret:password@proxy:80'), /super-secret|password@/);
  assert.match(connectionError('407 auth failed'), /authentication/);
});
