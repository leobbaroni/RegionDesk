import { _electron as electron } from '@playwright/test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { mkdir } from 'node:fs/promises';

const executablePath = path.resolve(process.argv[2] || 'release/win-unpacked/RegionDesk.exe');
const app = await electron.launch({ executablePath, args: [], timeout: 30000 });
try {
  const page = await app.firstWindow(); await page.waitForSelector('h1');
  await page.getByRole('button', {name:'Updates',exact:true}).click();
  await page.getByRole('button', {name:'Check for updates',exact:true}).click();
  let state;
  for (let attempt = 0; attempt < 100; attempt++) {
    state = await page.evaluate(() => window.regiondesk.getState());
    if (['current','available','error'].includes(state.updates.status)) break;
    await page.waitForTimeout(250);
  }
  assert.ok(['current','available'].includes(state.updates.status), state.updates.message);
  assert.equal(state.runtime.status, 'locked');
  await mkdir('.impeccable/review', {recursive:true});
  await page.locator('.updates-panel').screenshot({path:'.impeccable/review/updates.png'});
  await page.getByRole('button', {name:/^Updates/}).click();
  assert.equal(await page.locator('.updates-panel').count(), 0);
  console.log('PASS packaged update controls reach GitHub independently while account browsing stays locked');
} finally { await app.close(); }
