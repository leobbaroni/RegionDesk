import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { AppUpdates, allowedUpdateURL, newerVersion, releaseAsset } from '../electron/updates';

const content = Buffer.from('fixture installer - never execute');
const release = { tag_name: 'v0.4.0', draft: false, prerelease: false, assets: [{ name: 'RegionDesk-Setup.exe', browser_download_url: 'https://github.com/leobbaroni/RegionDesk/releases/download/v0.4.0/RegionDesk-Setup.exe', digest: `sha256:${createHash('sha256').update(content).digest('hex')}`, size: content.length }] };
test('updates reject unexpected assets, unverified files, unsafe hosts and downgrades', () => {
  assert.equal(newerVersion('0.10.0', '0.9.9'), true);
  assert.equal(newerVersion('0.3.1', '0.3.2'), false);
  assert.equal(releaseAsset(release, '0.4.0'), null);
  assert.throws(() => releaseAsset({...release, assets:[{...release.assets[0], digest:null}]}, '0.3.2'));
  assert.throws(() => releaseAsset({...release, assets:[{...release.assets[0], browser_download_url:'https://example.com/setup.exe'}]}, '0.3.2'));
  assert.equal(allowedUpdateURL('https://release-assets.githubusercontent.com/file'), true);
  for(const url of ['http://github.com/file', 'https://github.com.evil.test/file', 'https://user:pass@github.com/file', 'https://github.com:444/file']) assert.equal(allowedUpdateURL(url), false);
});
test('verified update downloads install only after an explicit action and a second hash check', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'regiondesk-update-'));
  try {
    const updater = new AppUpdates('0.3.2', root, true, () => {}, async url => new Response(url.includes('api.github.com') ? JSON.stringify(release) : content));
    await updater.check(); assert.equal(updater.state.status, 'available');
    await Promise.all([updater.download(), updater.download()]); assert.equal(updater.state.status, 'downloaded');
    let calls = 0;
    await updater.install(async file => { assert.deepEqual(await readFile(file), content); calls++; });
    assert.equal(calls, 1);
    await updater.install(async () => { calls++; }); assert.equal(calls, 1);
    const tampered = new AppUpdates('0.3.2', root, true, () => {}, async url => new Response(url.includes('api.github.com') ? JSON.stringify(release) : content));
    await tampered.check(); await tampered.download();
    await writeFile(path.join(root, 'RegionDesk-0.4.0-Setup.exe'), 'modified');
    await tampered.install(async () => { calls++; });
    assert.equal(tampered.state.status, 'error'); assert.equal(calls, 1);
  } finally { await rm(root, {recursive:true,force:true}); }
});
test('failed checks and truncated downloads recover without executing a file', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'regiondesk-update-'));
  try {
    const updater = new AppUpdates('0.3.2', root, true, () => {}, async url => new Response(url.includes('api.github.com') ? JSON.stringify(release) : 'short'));
    await updater.check(); await updater.download(); assert.equal(updater.state.status, 'error');
    await updater.install(async () => { assert.fail('Unverified installer must not run'); });
    await updater.check(); assert.equal(updater.state.status, 'available');
    const offline = new AppUpdates('0.3.2', root, true, () => {}, async () => { throw new Error('offline'); });
    await offline.check(); assert.equal(offline.state.status, 'error');
  } finally { await rm(root, {recursive:true,force:true}); }
});
