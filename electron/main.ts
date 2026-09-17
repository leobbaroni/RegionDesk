import { app, BrowserWindow, dialog, ipcMain, safeStorage, shell } from 'electron';
import path from 'node:path';
import { writeFile } from 'node:fs/promises';
import { ProfileStore } from './store';
import { AccountBrowser } from './browser';
import type { AppState } from '../shared/types';

if (!app.isPackaged && process.env.REGIONDESK_TEST === '1' && process.env.REGIONDESK_TEST_DATA) app.setPath('userData', process.env.REGIONDESK_TEST_DATA);
app.setName('RegionDesk');
app.commandLine.appendSwitch('disable-quic');
// Destination hostnames go through the loopback proxy, never Chromium's local DNS.
// The Node bridge resolves only the upstream proxy endpoint.
app.commandLine.appendSwitch('host-resolver-rules', 'MAP * ~NOTFOUND, EXCLUDE 127.0.0.1, EXCLUDE localhost');
app.commandLine.appendSwitch('dns-prefetch-disable');
app.commandLine.appendSwitch('force-webrtc-ip-handling-policy', 'disable_non_proxied_udp');
let win: BrowserWindow | null = null;
let manager: AccountBrowser;
let store: ProfileStore;
let quitting = false;
let queue = Promise.resolve<unknown>(undefined);
const providers: Record<string, string> = { 'webshare-free': 'https://www.webshare.io/free-proxy', 'webshare-isp': 'https://www.webshare.io/static-residential-proxy', iproyal: 'https://iproyal.com/pricing/static-residential-proxies/' };

function state(): AppState { return { profiles: store.profiles, activeId: store.activeId, runtime: manager.state, activity: manager.activity, secureStorage: safeStorage.isEncryptionAvailable(), version: app.getVersion() }; }
function emit() { if (win && !win.isDestroyed()) win.webContents.send('state:update', state()); }
function handle(name: string, fn: (...args: any[]) => unknown, serial = true) {
  ipcMain.handle(name, (event, ...args) => {
    if (!win || event.sender !== win.webContents || event.senderFrame !== win.webContents.mainFrame) throw new Error('Untrusted IPC caller.');
    const run = async () => { try { return await fn(...args); } catch (error) { throw new Error(error instanceof Error ? error.message : 'The action could not be completed.'); } };
    if (!serial) return run();
    const result = queue.then(run, run); queue = result.catch(() => {}); return result;
  });
}
async function createWindow() {
  store = new ProfileStore();
  win = new BrowserWindow({ width: 1440, height: 960, minWidth: 1060, minHeight: 740, backgroundColor: '#101113', title: 'RegionDesk', autoHideMenuBar: true,
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, sandbox: true, nodeIntegration: false, webSecurity: true } });
  win.removeMenu();
  manager = new AccountBrowser(win, store, emit);
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', event => event.preventDefault());
  handle('state:get', state, false);
  handle('profile:save', async raw => { store.save(raw); await manager.reset(); emit(); return state(); });
  handle('profile:create', async () => { await manager.reset(); store.create(); emit(); return state(); });
  handle('profile:select', async id => { await manager.reset(); store.select(id); emit(); return state(); });
  handle('profile:delete', async id => {
    if (!store.profiles.some(p => p.id === id)) throw new Error('Profile not found.');
    if (store.profiles.length === 1) throw new Error('Keep at least one profile.');
    const result = await dialog.showMessageBox(win!, { type: 'warning', title: 'Delete profile', message: 'Delete this profile and its saved website sessions?', detail: 'This removes local cookies, credentials and settings. It does not delete the TikTok account.', buttons: ['Cancel', 'Delete profile'], defaultId: 0, cancelId: 0 });
    if (result.response === 1) { await manager.clearSession(id); store.delete(id); await manager.reset(); emit(); }
    return state();
  });
  handle('connection:verify', async () => { await manager.verify(); return state(); });
  handle('connection:disconnect', async () => { await manager.lock(); return state(); }, false);
  handle('browser:navigate', async url => { await manager.navigate(url); return state(); });
  handle('browser:action', action => manager.action(action), false);
  handle('browser:bounds', bounds => manager.setBounds(bounds), false);
  handle('browser:inspect', async () => { await manager.inspect(); return state(); });
  handle('draft:confirm-discard', async () => {
    const result = await dialog.showMessageBox(win!, { type: 'question', title: 'Unsaved changes', message: 'Discard your unsaved changes?', detail: 'Keep editing to save the changes before leaving this screen.', buttons: ['Keep editing', 'Discard changes'], defaultId: 0, cancelId: 0 });
    return result.response === 1;
  });
  handle('session:clear', async () => {
    const result = await dialog.showMessageBox(win!, { type: 'warning', title: 'Clear this session', message: 'Sign out and clear website data for this profile?', detail: 'Other profiles are not affected. This cannot be undone.', buttons: ['Cancel', 'Clear session'], defaultId: 0, cancelId: 0 });
    if (result.response === 1) await manager.clearSession(); return state();
  });
  handle('report:export', async () => {
    const result = await dialog.showSaveDialog(win!, { title: 'Export connection report', defaultPath: 'regiondesk-diagnostics.json', filters: [{ name: 'JSON report', extensions: ['json'] }] });
    if (result.canceled || !result.filePath) return null;
    const p = store.active;
    const report = { generatedAt: new Date().toISOString(), version: app.getVersion(), profile: { name: p.name, country: p.country, city: p.city, locale: p.locale, timezone: p.timezone, locationPermission: p.locationPermission }, status: manager.state.status, network: manager.state.network, browser: manager.state.browser, note: 'Contains measured public IP. No passwords, proxy credentials, cookie values or browsing URLs. Network geolocation is an estimate, not audience evidence.' };
    await writeFile(result.filePath, JSON.stringify(report, null, 2)); return result.filePath;
  });
  handle('provider:open', async id => { if (!Object.hasOwn(providers, id)) throw new Error('Unknown provider.'); await shell.openExternal(providers[id]); });
  win.on('close', () => { void manager.lock(); });
  win.on('closed', () => { win = null; });
  if (process.env.REGIONDESK_DEV_URL && !app.isPackaged) await win.loadURL(process.env.REGIONDESK_DEV_URL);
  else await win.loadFile(path.join(__dirname, '../dist/index.html'));
}
app.whenReady().then(createWindow).catch(async error => { dialog.showErrorBox('RegionDesk could not start', error instanceof Error ? error.message : 'Unknown startup error.'); app.exit(1); });
app.on('before-quit', event => {
  if (!quitting && manager) { event.preventDefault(); quitting = true; void manager.dispose().finally(() => app.quit()); }
});
app.on('window-all-closed', () => app.quit());
