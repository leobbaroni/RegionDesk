import { app, BrowserWindow, WebContentsView, session, type Session } from 'electron';
import { Server as ProxyServer } from 'proxy-chain';
import { isIP } from 'node:net';
import { randomUUID, X509Certificate } from 'node:crypto';
import { connectionError, isPrivateHost, normalizeURL, proxyURL } from './core';
import type { ProfileStore } from './store';
import type { Activity, Bounds, BrowserEvidence, NetworkEvidence, RuntimeState } from '../shared/types';

export const lockedState = (): RuntimeState => ({ status: 'locked', message: 'Add a connection and verify its region to unlock browsing.', url: '', title: '', loading: false, canGoBack: false, canGoForward: false, cookieCount: null });
const productionCheck = 'https://ipwho.is/';
const testMode = !app.isPackaged && process.env.REGIONDESK_TEST === '1';
const checkURL = testMode && process.env.REGIONDESK_CHECK_URL || productionCheck;
const lifetime = 90_000;
const trace = (step: string) => { if (testMode) console.log(`[browser-test] ${step}`); };

export class AccountBrowser {
  state = lockedState();
  activity: Activity[] = [];
  view: WebContentsView | null = null;
  private sessions = new Map<string, Session>();
  private bridge: ProxyServer | null = null;
  private validUntil = 0;
  private checking = false;
  private generation = 0;
  private bounds: Bounds | null = null;
  private abort: AbortController | null = null;
  private timer: NodeJS.Timeout;

  constructor(private win: BrowserWindow, private store: ProfileStore, private emit: () => void) {
    this.timer = setInterval(() => {
      if (this.state.status === 'ready' && !this.checking) void this.verify(true);
    }, 45_000);
    this.timer.unref();
  }
  log(message: string, kind: Activity['kind'] = 'info') {
    this.activity.unshift({ id: randomUUID(), at: new Date().toISOString(), profileId: this.store.activeId, kind, message });
    this.activity = this.activity.slice(0, 60); this.emit();
  }
  private allowed() { return this.state.status === 'ready' && Date.now() < this.validUntil; }
  getSession(id = this.store.activeId) {
    const cached = this.sessions.get(id); if (cached) return cached;
    const ses = session.fromPartition(`persist:regiondesk-${id}`);
    // Development fixtures can trust one exact local certificate. Packaged builds
    // always retain Chromium's certificate verification, regardless of environment.
    if (testMode && process.env.REGIONDESK_TEST_CERT_SHA256) {
      ses.setCertificateVerifyProc((request, callback) => {
        const expected = process.env.REGIONDESK_TEST_CERT_SHA256!.replaceAll(':', '').toLowerCase();
        const actual = new X509Certificate(request.certificate.data).fingerprint256.replaceAll(':', '').toLowerCase();
        callback(request.hostname === '127.0.0.1' && actual === expected ? 0 : -3);
      });
    }
    ses.setPermissionCheckHandler((_wc, permission) => id === this.store.activeId && this.allowed() && this.store.active.locationPermission === 'configured' && permission === 'geolocation');
    ses.setPermissionRequestHandler((_wc, permission, callback) => callback(id === this.store.activeId && this.allowed() && this.store.active.locationPermission === 'configured' && permission === 'geolocation'));
    ses.setDevicePermissionHandler(() => false);
    ses.setDisplayMediaRequestHandler((_request, callback) => callback({}));
    ses.on('will-download', event => { event.preventDefault(); this.log('Download blocked in the account browser. Use your regular browser for downloads.', 'warning'); });
    ses.webRequest.onBeforeRequest((details, callback) => {
      let allowed = false;
      try {
        const url = new URL(details.url);
        const diagnostic = this.checking && details.url === checkURL;
        const localTest = testMode && url.hostname === '127.0.0.1';
        const network = ['https:', 'wss:'].includes(url.protocol) || localTest && ['http:', 'ws:'].includes(url.protocol);
        allowed = id === this.store.activeId && (diagnostic || this.allowed()) && network && (localTest || !isPrivateHost(url.hostname));
      } catch { /* malformed URLs stay blocked */ }
      callback({ cancel: !allowed });
    });
    ses.webRequest.onBeforeSendHeaders((details, callback) => {
      const headers = { ...details.requestHeaders };
      if (id === this.store.activeId) headers['Accept-Language'] = this.store.active.locale;
      callback({ requestHeaders: headers });
    });
    this.sessions.set(id, ses); return ses;
  }
  private async configure() {
    const profile = this.store.active;
    const upstreamProxyUrl = proxyURL(profile.proxy, this.store.password(profile.id));
    const bridge = new ProxyServer({ host: '127.0.0.1', port: 0, verbose: false,
      prepareRequestFunction: ({ hostname }) => {
        if (!testMode && isPrivateHost(hostname)) throw new Error('Private destinations are blocked.');
        return { upstreamProxyUrl };
      } });
    // Never forward upstream errors or credentials to the renderer or activity log.
    bridge.on('requestFailed', () => {});
    bridge.on('error', () => { if (this.bridge === bridge) void this.lock('The proxy route stopped. Verify the connection again.', 'error'); });
    trace('starting bridge'); await bridge.listen(); this.bridge = bridge;
    const ses = this.getSession();
    trace('closing prior connections'); await ses.closeAllConnections();
    await ses.setProxy({ mode: 'fixed_servers', proxyRules: `http://127.0.0.1:${bridge.port}`, proxyBypassRules: '<-loopback>' });
    trace('applying proxy'); await ses.forceReloadProxyConfig();
    const resolved = await ses.resolveProxy(checkURL);
    trace('proxy resolved');
    if (resolved.includes('DIRECT') || !resolved.includes(`127.0.0.1:${bridge.port}`)) throw new Error('Proxy route was not applied.');
  }
  private async createView() {
    if (this.view && !this.view.webContents.isDestroyed()) return;
    const profile = this.store.active;
    const ses = this.getSession();
    const userAgent = ses.getUserAgent().replace(/\sElectron\/[^\s]+/g, '').replace(/\sRegionDesk\/[^\s]+/gi, '').replace(/\sregiondesk\/[^\s]+/gi, '');
    ses.setUserAgent(userAgent, profile.locale);
    const view = new WebContentsView({ webPreferences: { session: ses, sandbox: true, contextIsolation: true, nodeIntegration: false, webSecurity: true, allowRunningInsecureContent: false, devTools: testMode } });
    this.view = view; view.setBackgroundColor('#101113'); view.setVisible(false); this.win.contentView.addChildView(view);
    const wc = view.webContents;
    wc.setUserAgent(userAgent);
    wc.setWebRTCIPHandlingPolicy('disable_non_proxied_udp');
    // Create the renderer's initial context before sending emulation commands.
    // This is a local blank document; no account website has been requested yet.
    await wc.loadURL('about:blank');
    wc.debugger.attach('1.3');
    await wc.debugger.sendCommand('Emulation.setTimezoneOverride', { timezoneId: profile.timezone });
    await wc.debugger.sendCommand('Emulation.setLocaleOverride', { locale: profile.locale });
    await wc.debugger.sendCommand('Emulation.setUserAgentOverride', { userAgent, acceptLanguage: profile.locale });
    await wc.debugger.sendCommand('Emulation.setGeolocationOverride', { latitude: profile.latitude, longitude: profile.longitude, accuracy: 5000 });
    wc.debugger.on('detach', () => { if (this.view === view && !wc.isDestroyed() && this.state.status === 'ready') void this.lock('Browser regional settings were detached. Verify again before browsing.', 'error'); });
    const navigationAllowed = (url: string) => { try { normalizeURL(url, testMode); return this.allowed(); } catch { return false; } };
    wc.on('will-navigate', (event, url) => { if (!navigationAllowed(url)) event.preventDefault(); });
    wc.on('will-redirect', (event, url) => { if (!navigationAllowed(url)) event.preventDefault(); });
    wc.setWindowOpenHandler(({ url }) => {
      if (navigationAllowed(url)) setImmediate(() => { void this.navigate(url).catch(() => {}); });
      else this.log('A popup was blocked. Only HTTPS pages in the verified profile can open.', 'warning');
      return { action: 'deny' };
    });
    wc.on('will-attach-webview', event => event.preventDefault());
    const sync = () => {
      if (this.view !== view || wc.isDestroyed()) return;
      this.state.url = wc.getURL().startsWith('http') ? wc.getURL() : '';
      this.state.title = wc.getTitle(); this.state.loading = wc.isLoading();
      this.state.canGoBack = wc.navigationHistory.canGoBack(); this.state.canGoForward = wc.navigationHistory.canGoForward(); this.emit();
    };
    wc.on('did-start-loading', sync); wc.on('did-stop-loading', sync); wc.on('did-navigate', sync); wc.on('did-navigate-in-page', sync); wc.on('page-title-updated', sync);
    wc.on('did-fail-load', (_e, code, _desc, _url, isMainFrame) => {
      if (!isMainFrame || code === -3 || this.view !== view) return;
      if ([-130, -111, -102, -105, -118].includes(code)) void this.lock('The page lost its connection. Check the proxy and verify again.', 'error');
      else { this.state.message = `The page could not load (network code ${code}). Try another HTTPS address or verify again.`; this.log(this.state.message, 'warning'); }
    });
    wc.on('render-process-gone', () => { if (this.view === view) void this.lock('The browser stopped unexpectedly. Verify to restart it.', 'error'); });
    this.applyBounds();
  }
  async verify(background = false) {
    if (this.checking) return;
    const token = ++this.generation;
    if (!this.store.active.proxy.host) { this.state.message = 'Add a proxy host and port in Connections first.'; this.emit(); return; }
    this.checking = true;
    if (!background) { this.state.status = 'checking'; this.state.message = 'Checking your proxy route and apparent country…'; this.emit(); }
    try {
      trace('verification started'); if (!this.bridge) await this.configure();
      if (token !== this.generation) return;
      this.abort = new AbortController();
      const timeout = setTimeout(() => this.abort?.abort(), 18_000);
      const start = Date.now();
      let data: Record<string, unknown>;
      try {
        trace('fetching network evidence'); const response = await this.getSession().fetch(checkURL, { signal: this.abort.signal, redirect: 'error', cache: 'no-store', credentials: 'omit' });
        if (!response.ok) throw new Error(`Check failed: ${response.status}`);
        const content = await response.text();
        if (content.length > 40_000) throw new Error('Invalid location response');
        data = JSON.parse(content);
      } finally { clearTimeout(timeout); this.abort = null; }
      if (token !== this.generation) return;
      if (data.success === false || typeof data.ip !== 'string' || !isIP(data.ip) || typeof data.country_code !== 'string' || !/^[A-Z]{2}$/.test(data.country_code)) throw new Error('Invalid location response');
      const info = (value: unknown) => typeof value === 'string' ? value.slice(0, 120) : '';
      const network: NetworkEvidence = { ip: data.ip, country: data.country_code, city: info(data.city), timezone: info((data.timezone as Record<string, unknown>)?.id), provider: info((data.connection as Record<string, unknown>)?.isp), measuredAt: new Date().toISOString(), latency: Date.now() - start };
      this.state.network = network;
      if (network.country !== this.store.active.country) {
        await this.lock(`Region mismatch: the proxy reports ${network.country}; this profile requires ${this.store.active.country}. Choose a matching endpoint.`, 'error'); return;
      }
      trace('creating browser view'); await this.createView(); trace('browser view configured');
      if (token !== this.generation) return;
      this.validUntil = Date.now() + lifetime;
      this.state.status = 'ready'; this.state.message = 'Proxy country verified. Browser settings are applied; audience region is not measured.';
      this.state.cookieCount = (await this.getSession().cookies.get({})).length;
      trace('reading browser evidence'); await this.inspect(); trace('evidence complete'); this.applyBounds();
      if (!background) this.log(`Connection verified in ${network.country}. Managed browsing unlocked.`, 'success');
      this.emit();
    } catch (error) {
      if (token === this.generation) await this.lock(connectionError(error), 'error');
    } finally { if (token === this.generation) this.checking = false; }
  }
  async lock(message = 'Browser locked. Saved cookies and login sessions are preserved.', status: 'locked' | 'error' = 'locked') {
    ++this.generation; this.checking = false; this.abort?.abort(); this.abort = null; this.validUntil = 0;
    const old = this.view; this.view = null;
    if (old) { if (!this.win.isDestroyed()) this.win.contentView.removeChildView(old); if (!old.webContents.isDestroyed()) old.webContents.close(); }
    this.state = { ...lockedState(), status, message, network: this.state.network, browser: this.state.browser, cookieCount: this.state.cookieCount };
    this.emit();
    const ses = this.sessions.get(this.store.activeId);
    if (ses) { await ses.setProxy({ mode: 'fixed_servers', proxyRules: 'http://127.0.0.1:9', proxyBypassRules: '<-loopback>' }); await ses.closeAllConnections(); }
    const bridge = this.bridge; this.bridge = null;
    if (bridge) await bridge.close(true);
    this.log(message, status === 'error' ? 'warning' : 'info');
  }
  async reset() { await this.lock(); this.state = lockedState(); this.emit(); }
  async navigate(input: string) {
    if (!this.allowed()) throw new Error('Verify the connection before opening a website.');
    const url = normalizeURL(input, testMode);
    await this.createView();
    // Do not hold the IPC queue for a slow or streaming website load.
    void this.view!.webContents.loadURL(url).catch(() => {}); this.applyBounds();
  }
  action(action: string) {
    const wc = this.view?.webContents; if (!wc || !this.allowed()) return;
    if (action === 'back' && wc.navigationHistory.canGoBack()) wc.navigationHistory.goBack();
    else if (action === 'forward' && wc.navigationHistory.canGoForward()) wc.navigationHistory.goForward();
    else if (action === 'reload') wc.reload(); else if (action === 'stop') wc.stop();
  }
  setBounds(bounds: Bounds | null) {
    if (bounds) {
      const area = this.win.getContentBounds();
      if (!Object.values(bounds).every(Number.isFinite) || bounds.x < 0 || bounds.y < 0 || bounds.width < 0 || bounds.height < 0 || bounds.x + bounds.width > area.width + 2 || bounds.y + bounds.height > area.height + 2) return;
      this.bounds = { x: Math.round(bounds.x), y: Math.round(bounds.y), width: Math.round(bounds.width), height: Math.round(bounds.height) };
    } else this.bounds = null;
    this.applyBounds();
  }
  private applyBounds() {
    if (!this.view) return;
    this.view.setVisible(!!this.bounds && this.allowed() && !!this.state.url);
    if (this.bounds) this.view.setBounds(this.bounds);
  }
  async inspect() {
    const wc = this.view?.webContents;
    if (!wc || wc.isDestroyed()) return;
    const result = await wc.debugger.sendCommand('Runtime.evaluate', { expression: `JSON.stringify({language:navigator.language,languages:[...navigator.languages],timezone:Intl.DateTimeFormat().resolvedOptions().timeZone,locale:Intl.DateTimeFormat().resolvedOptions().locale,userAgent:navigator.userAgent,platform:navigator.platform,width:screen.width,height:screen.height,hardwareConcurrency:navigator.hardwareConcurrency})`, returnByValue: true });
    if (typeof result.result?.value === 'string') this.state.browser = { ...JSON.parse(result.result.value), webRTCPolicy: wc.getWebRTCIPHandlingPolicy() } as BrowserEvidence;
    this.state.cookieCount = (await this.getSession().cookies.get({})).length; this.emit();
  }
  async clearSession(id = this.store.activeId) {
    await this.lock(); const ses = this.getSession(id); await ses.clearStorageData(); await ses.clearCache(); await ses.clearAuthCache();
    this.state.cookieCount = 0; this.log('Cookies, site storage, cache and HTTP authentication cleared for this profile.');
  }
  async dispose() { clearInterval(this.timer); await this.lock(); }
}
