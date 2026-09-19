import { _electron as electron } from '@playwright/test';
import assert from 'node:assert/strict';
import path from 'node:path';

const ignoredDataPath = path.resolve('.test-data', 'packaged-override-must-be-ignored');
const app = await electron.launch({
  executablePath: path.resolve(process.argv[2] || 'release/win-unpacked/RegionDesk.exe'),
  args: [],
  env: { ...process.env, REGIONDESK_TEST: '1', REGIONDESK_TEST_DATA: ignoredDataPath },
  timeout: 30000,
});
try {
  const page = await app.firstWindow();
  await page.waitForSelector('h1');
  const runtime = await app.evaluate(({ app, safeStorage }) => ({
    packaged: app.isPackaged,
    userData: app.getPath('userData'),
    encryption: safeStorage.isEncryptionAvailable(),
  }));
  assert.equal(runtime.packaged, true);
  assert.notEqual(path.resolve(runtime.userData), ignoredDataPath);
  assert.equal(runtime.encryption, true);
  const state = await page.evaluate(() => window.regiondesk.getState());
  assert.equal(state.runtime.status, 'locked');
  assert.ok(state.profiles.length >= 1);
  console.log('PASS packaged Windows app starts, ignores test data override, supports encrypted storage, and starts locked');
} finally {
  await app.close();
}
