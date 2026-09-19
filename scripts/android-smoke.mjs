// Explicit opt-in: reads a real local Android instance and opens an IP-check page.
import { _electron as electron } from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
if (!process.argv.includes('--live')) throw new Error('Run with --live only when the paired BlueStacks instance is available.');
const root = process.cwd();
const dataDir = path.join(root, '.test-data', `android-smoke-${randomUUID()}`);
await fs.mkdir(dataDir, { recursive: true });
let app;
async function launch() {
  const env = { ...process.env, REGIONDESK_TEST: '1', REGIONDESK_TEST_DATA: dataDir };
  delete env.ELECTRON_RUN_AS_NODE;
  app = await electron.launch({ args: ['.'], cwd: root, env });
  return app.firstWindow();
}
try {
  let page = await launch();
  const api = (name, ...args) => page.evaluate(({ name, args }) => window.regiondesk[name](...args), { name, args });
  await page.getByRole('button', { name: 'Android', exact: true }).click();
  await page.getByRole('button', { name: 'Save pairing', exact: true }).click();
  await page.getByText('Pairing saved. Android app data was not changed.', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Inspect Android', exact: true }).click();
  await page.getByText('Present (not an IP check)', { exact: true }).waitFor({ timeout: 30000 });
  await page.getByText('Configured', { exact: true }).waitFor();
  const observed = await api('androidInspect');
  assert.equal(observed.evidence.alwaysOn, 'hev.sockstun');
  assert.equal(observed.evidence.lockdown, true);
  assert.equal(observed.evidence.tunnel, true);
  const original = (await api('getState')).profiles[0];
  await assert.rejects(api('androidAction', 'tiktok'), /timezone/);
  await api('saveProfile', { ...original, timezone: observed.evidence.timezone, locale: observed.evidence.locale, city: 'Los Angeles' });
  await api('androidAction', 'ip-check');
  await assert.rejects(api('androidAction', 'arbitrary-shell-command'), /Unknown Android action/);
  const other = await api('createProfile');
  await assert.rejects(api('androidSave', observed.pairing), /already paired/);
  await api('selectProfile', original.id);
  await page.getByRole('button', { name: 'Android', exact: true }).click();
  await page.getByRole('button', { name: 'Inspect Android', exact: true }).click();
  await page.getByText('Present (not an IP check)', { exact: true }).waitFor();
  await page.screenshot({ path: path.join(dataDir, 'android-panel.png'), fullPage: true });
  await app.close(); app = null;
  page = await launch();
  assert.deepEqual((await api('androidGet')).pairing, observed.pairing);
  assert.equal((await api('androidGet')).evidence, undefined, 'Old evidence must not survive app restart');
  console.log(JSON.stringify({ passed: ['pair via UI', 'live inspection', 'regional launch guard', 'IP check launch', 'action allowlist', 'duplicate pairing guard', 'restart persistence'], screenshot: path.join(dataDir, 'android-panel.png'), device: observed.evidence }, null, 2));
} finally { if (app) await app.close(); }
