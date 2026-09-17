import { app, BaseWindow, BrowserWindow, Menu, WebContentsView, session, type Session, type WebContents } from 'electron';
import { Server as ProxyServer } from 'proxy-chain';
import { isIP } from 'node:net';
import { randomUUID, X509Certificate } from 'node:crypto';
import { connectionError, isPrivateHost, normalizeURL, proxyURL } from './core';
import type { ProfileStore } from './store';
import type { Activity, Bounds, BrowserEvidence, NetworkEvidence, RuntimeState } from '../shared/types';
import { defaultPermissions, type BrowsingState } from '../shared/types';
import { BrowsingStore } from './browsing-store';

export const lockedState = (): RuntimeState => ({ status: 'locked', message: 'Add a connection and verify its region to unlock browsing.', url: '', title: '', loading: false, canGoBack: false, canGoForward: false, cookieCount: null });
const productionCheck = 'https://ipwho.is/';
const testMode = !app.isPackaged && process.env.REGIONDESK_TEST === '1';
const checkURL = testMode && process.env.REGIONDESK_CHECK_URL || productionCheck;
const lifetime = 90_000;
const trace = (step: string) => { if (testMode) console.log(`[browser-test] ${step}`); };
class CheckRateLimit extends Error {
  constructor(public delay: number) { super('The region-check service is rate-limiting requests (HTTP 429).'); }
}
const retryDelay = (value?: string | null) => {
  const seconds = value && /^\d+$/.test(value) ? Number(value) * 1000 : value ? Date.parse(value) - Date.now() : 30_000;
  return Math.max(5_000, Number.isFinite(seconds) ? seconds : 30_000);
};

export class AccountBrowser {
  state = lockedState();
  activity: Activity[] = [];
  view: WebContentsView | null = null;
  private sessions = new Map<string, Session>();
  private views = new Map<string, WebContentsView>();
  private viewEpoch = 0;
  private tabQueue = Promise.resolve();
  private bridge: ProxyServer | null = null;
  private upstreamStatus: number | undefined;
  private validUntil = 0;
  private checking = false;
  private generation = 0;
  private bounds: Bounds | null = null;
  private abort: AbortController | null = null;
  private timer: NodeJS.Timeout;
  private floating: BaseWindow | null = null;
  private nextCheck = 0;
  private retryAt = 0;
  private retryCount = 0;
  private upstreamRetryDelay = 30_000;

  constructor(private win: BrowserWindow, private store: ProfileStore, private browsing: BrowsingStore, private emit: () => void) {
    this.timer = setInterval(() => {
      if (this.state.status === 'ready' && Date.now() >= this.validUntil) {
        const retry = this.retryAt;
        void this.lock('Region verification expired. Browsing is locked until the next successful check.', 'error').then(() => { this.retryAt = retry; this.state.retryAt = retry || undefined; this.emit(); });
      } else if (!this.checking && (this.state.status === 'ready' && Date.now() >= this.nextCheck || this.retryAt > 0 && Date.now() >= this.retryAt && this.retryCount <= 2)) void this.verify(true);
    }, 1000);
    this.timer.unref();
  }
  get browsingState(): BrowsingState {
    const data = this.browsing.get(this.store.activeId);
    return { ...data, tabs: data.tabs.map(tab => ({ ...tab, loaded: this.views.has(tab.id), loading: this.views.get(tab.id)?.webContents.isLoading() || false })) };
  }
  private tabTask(task: () => Promise<void>) {
    const result = this.tabQueue.then(task, task); this.tabQueue = result.catch(() => {}); return result;
  }
  private reportTabError(error: unknown) { this.log(error instanceof Error ? error.message : 'The tab action failed.', 'warning'); }
  private focusShell(command: 'address' | 'history' | 'permissions') {
    this.win.show(); this.win.focus(); this.win.webContents.focus(); this.win.webContents.send('browser:command', command);
  }
  private activateView(view: WebContentsView | null) {
    if (this.view === view) return;
    const previous = this.view;
    if (previous) { previous.setVisible(false); if (this.floating) { this.floating.contentView.removeChildView(previous); this.win.contentView.addChildView(previous); } }
    this.view = view;
    if (view && this.floating) { this.win.contentView.removeChildView(view); this.floating.contentView.addChildView(view); }
  }
  private syncActiveView() {
    const wc = this.view?.webContents;
    const saved = this.browsing.get(this.store.activeId);
    const tab = saved.tabs.find(t => t.id === saved.activeTabId)!;
    this.state.url = wc?.getURL().startsWith('http') ? wc.getURL() : tab.url;
    this.state.title = tab.title; this.state.loading = wc?.isLoading() || false;
    this.state.canGoBack = wc?.navigationHistory.canGoBack() || false; this.state.canGoForward = wc?.navigationHistory.canGoForward() || false;
    this.state.zoom = wc?.getZoomFactor() || 1;
    this.floating?.setTitle(`${this.store.active.name} · ${tab.title} — RegionDesk`);
    this.applyBounds(); this.updateFloatingMenu(); this.emit();
  }
  private async showActiveTab() {
    if (!this.allowed()) { this.syncActiveView(); return; }
    const data = this.browsing.get(this.store.activeId);
    const tab = data.tabs.find(t => t.id === data.activeTabId)!;
    const existed = this.views.has(tab.id);
    await this.createView();
    if (!this.allowed()) return;
    if (!existed && tab.url && this.view) void this.view.webContents.loadURL(tab.url).catch(() => {});
    this.syncActiveView();
  }
  newTab(url = '') { return this.tabTask(async () => { this.browsing.newTab(this.store.activeId, url); await this.showActiveTab(); this.emit(); if (!url) this.focusShell('address'); }); }
  selectTab(id: string) { return this.tabTask(async () => { this.browsing.select(this.store.activeId, id); await this.showActiveTab(); this.emit(); }); }
  closeTab(id: string) { return this.tabTask(async () => {
    this.browsing.close(this.store.activeId, id);
    const old = this.views.get(id); this.views.delete(id);
    if (old) { if (old === this.view) this.activateView(null); this.win.contentView.removeChildView(old); if (!old.webContents.isDestroyed()) old.webContents.close(); }
    await this.showActiveTab(); this.emit();
  }); }
  moveTab(id: string, direction: 'left' | 'right') { this.browsing.move(this.store.activeId, id, direction); this.updateFloatingMenu(); this.emit(); }
  private cycleTab(direction: number) {
    const data = this.browsing.get(this.store.activeId), index = data.tabs.findIndex(t => t.id === data.activeTabId);
    void this.selectTab(data.tabs[(index + direction + data.tabs.length) % data.tabs.length].id).catch(error => this.reportTabError(error));
  }
  log(message: string, kind: Activity['kind'] = 'info') {
    this.activity.unshift({ id: randomUUID(), at: new Date().toISOString(), profileId: this.store.activeId, kind, message });
    this.activity = this.activity.slice(0, 60); this.emit();
  }
  private allowed() { return this.state.status === 'ready' && Date.now() < this.validUntil; }
  private permission(id: string, wc: WebContents | null, permission: string, origin: string, media: string[] = []) {
    if (id !== this.store.activeId || !this.allowed()) return false;
    const owned = [...this.views.values()].find(view => wc ? view.webContents === wc : view.webContents.getURL().startsWith(origin));
    if (!owned) return false;
    try { if (new URL(origin).origin !== new URL(owned.webContents.getURL()).origin) return false; } catch { return false; }
    const p = { ...defaultPermissions, ...this.store.active.permissions };
    // No permission can enable local-network, loopback, devices or host geolocation.
    if (permission === 'geolocation') return this.store.active.locationPermission === 'configured';
    if (permission === 'media') return media.length > 0 && media.every(type => type === 'video' ? p.camera : type === 'audio' ? p.microphone : false);
    if (permission === 'notifications') return p.notifications;
    if (permission === 'fullscreen') return p.fullscreen;
    if (permission === 'clipboard-read' || permission === 'clipboard-sanitized-write') return p.clipboard;
    return false;
  }
  getSession(id = this.store.activeId) {
    const cached = this.sessions.get(id); if (cached) return cached;
    const ses = session.fromPartition(`persist:regiondesk-${id}`);
    // Development fixtures can trust one exact local certificate. Packaged builds
    // always retain Chromium's certificate verification, regardless of environment.
    if (testMode && process.env.REGIONDESK_TEST_CERT_SHA256) {
      ses.setCertificateVerifyProc((request, callback) => {
        const expected = process.env.REGIONDESK_TEST_CERT_SHA256!.replaceAll(':', '').toLowerCase();
        const actual = new X509Certificate(request.certificate.data).fingerprint256.replaceAll(':', '').toLowerCase();
        callback(['127.0.0.1', 'regiondesk.test', 'regiondesk-frame.test'].includes(request.hostname) && actual === expected ? 0 : -3);
      });
    }
    ses.setPermissionCheckHandler((wc, permission, origin, details) => this.permission(id, wc, permission, origin, details.mediaType ? [details.mediaType] : []));
    ses.setPermissionRequestHandler((wc, permission, callback, details) => callback(this.permission(id, wc, permission, details.requestingUrl, 'mediaTypes' in details ? details.mediaTypes : [])));
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
    bridge.on('tunnelConnectFailed', ({ response }: { response: { statusCode?: number; headers?: Record<string, string | string[] | undefined> } }) => {
      if (this.bridge !== bridge) return;
      // Chromium collapses upstream 407 into ERR_TUNNEL_CONNECTION_FAILED.
      // Keep only the status code, never response bodies or credential headers.
      this.upstreamStatus = response.statusCode;
      if (response.statusCode === 429) {
        this.upstreamRetryDelay = retryDelay(String(response.headers?.['retry-after'] || ''));
        if (!this.checking && this.allowed()) {
          this.state.message = 'A proxy request was rate-limited (HTTP 429). Your verified session is preserved. Wait before reloading the page.';
          if (Date.now() >= this.retryAt) this.log(this.state.message, 'warning');
          this.retryAt = Math.max(this.retryAt, Date.now() + this.upstreamRetryDelay);
          this.nextCheck = this.retryAt; this.state.retryAt = this.retryAt; this.emit();
        }
        return;
      }
      if (this.state.status === 'ready' && !this.checking) void this.lock(connectionError(null, this.upstreamStatus), 'error');
    });
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
    const tabId = this.browsing.get(this.store.activeId).activeTabId;
    const existing = this.views.get(tabId);
    if (existing && !existing.webContents.isDestroyed()) { this.activateView(existing); return; }
    const epoch = this.viewEpoch;
    const profile = this.store.active;
    const ses = this.getSession();
    // Read genuine engine/device metadata from our trusted, secure app renderer.
    // Omitting metadata from CDP's language/UA override clears Client Hints.
    const userAgentMetadata = await this.win.webContents.executeJavaScript(`(async () => {
      const ua = navigator.userAgentData;
      if (!ua) throw new Error('Native browser metadata is unavailable.');
      const native = await ua.getHighEntropyValues(['architecture', 'bitness', 'model', 'platformVersion', 'uaFullVersion', 'fullVersionList', 'wow64', 'formFactors']);
      return { brands: native.brands, fullVersionList: native.fullVersionList, fullVersion: native.uaFullVersion,
        platform: native.platform, platformVersion: native.platformVersion, architecture: native.architecture,
        model: native.model, mobile: native.mobile, bitness: native.bitness, wow64: native.wow64, formFactors: native.formFactors };
    })()`);
    if (epoch !== this.viewEpoch || profile.id !== this.store.activeId || tabId !== this.browsing.get(profile.id).activeTabId) return;
    const userAgent = ses.getUserAgent().replace(/\sElectron\/[^\s]+/g, '').replace(/\sRegionDesk\/[^\s]+/gi, '').replace(/\sregiondesk\/[^\s]+/gi, '');
    ses.setUserAgent(userAgent, profile.locale);
    const view = new WebContentsView({ webPreferences: { session: ses, sandbox: true, contextIsolation: true, nodeIntegration: false, webSecurity: true, allowRunningInsecureContent: false, disableHtmlFullscreenWindowResize: true, devTools: testMode } });
    this.views.set(tabId, view); view.setBackgroundColor('#101113'); view.setVisible(false); this.win.contentView.addChildView(view); this.activateView(view);
    const alive = () => epoch === this.viewEpoch && this.views.get(tabId) === view && profile.id === this.store.activeId && !view.webContents.isDestroyed();
    const wc = view.webContents;
    wc.setUserAgent(userAgent);
    wc.setWebRTCIPHandlingPolicy('disable_non_proxied_udp');
    wc.on('before-input-event', (event, input) => {
      if (input.type !== 'keyDown') return;
      const ctrl = input.control || input.meta;
      if (ctrl && ['t', 'w', 'l', 'h', 'Tab'].includes(input.key)) {
        event.preventDefault();
        if (input.key === 't') void this.newTab().catch(error => this.reportTabError(error));
        else if (input.key === 'w') void this.closeTab(tabId).catch(error => this.reportTabError(error));
        else if (input.key === 'Tab') this.cycleTab(input.shift ? -1 : 1);
        else this.focusShell(input.key === 'h' ? 'history' : 'address');
        return;
      }
      const action = input.key === 'F11' ? 'fullscreen' : ctrl && ['+', '='].includes(input.key) ? 'zoom-in' : ctrl && input.key === '-' ? 'zoom-out' : ctrl && input.key === '0' ? 'zoom-reset' : '';
      if (action) { event.preventDefault(); this.action(action); }
      if (input.key === 'Escape' && this.floating?.isFullScreen()) { this.floating.setFullScreen(false); }
    });
    wc.on('zoom-changed', (_event, direction) => this.action(direction === 'in' ? 'zoom-in' : 'zoom-out'));
    wc.on('context-menu', (_event, details) => {
      if (!this.allowed()) return;
      Menu.buildFromTemplate([
        { label: 'Open link in new tab', visible: !!details.linkURL, click: () => { void this.newTab(details.linkURL).catch(error => this.reportTabError(error)); } },
        { label: 'New tab', click: () => { void this.newTab().catch(error => this.reportTabError(error)); } },
        { label: 'Back', enabled: wc.navigationHistory.canGoBack(), click: () => this.action('back') },
        { label: 'Reload', click: () => this.action('reload') },
        { type: 'separator' },
        { label: 'Cut', visible: details.isEditable, enabled: details.editFlags.canCut, click: () => wc.cut() },
        { label: 'Copy', enabled: details.editFlags.canCopy, click: () => wc.copy() },
        { label: 'Paste', visible: details.isEditable, enabled: details.editFlags.canPaste, click: () => wc.paste() },
        { label: 'Select all', click: () => wc.selectAll() },
        { type: 'separator' },
        { label: 'Zoom in', click: () => this.action('zoom-in') }, { label: 'Zoom out', click: () => this.action('zoom-out') },
        { label: 'Reset zoom', click: () => this.action('zoom-reset') },
        { label: this.floating ? 'Return to workspace' : 'Open in floating window', click: () => this.action(this.floating ? 'dock' : 'detach') }
      ]).popup({ window: this.floating || this.win });
    });
    wc.on('enter-html-full-screen', () => { if (!this.floating) this.detach(); this.floating?.setFullScreen(true); });
    wc.on('leave-html-full-screen', () => this.floating?.setFullScreen(false));
    // Create the renderer's initial context before sending emulation commands.
    // This is a local blank document; no account website has been requested yet.
    await wc.loadURL('about:blank');
    wc.debugger.attach('1.3');
    // Configure child contexts before they execute site code. Page overrides
    // alone leave navigator.language in workers at the machine's language.
    wc.debugger.on('message', (_event, method, params) => {
      if (method !== 'Target.attachedToTarget') return;
      const child = params.sessionId as string;
      void (async () => {
        await wc.debugger.sendCommand('Emulation.setUserAgentOverride', { userAgent, acceptLanguage: profile.locale, userAgentMetadata }, child);
        if (params.targetInfo.type === 'iframe' || params.targetInfo.type === 'page') {
          await wc.debugger.sendCommand('Emulation.setTimezoneOverride', { timezoneId: profile.timezone }, child);
          await wc.debugger.sendCommand('Emulation.setLocaleOverride', { locale: profile.locale }, child);
          await wc.debugger.sendCommand('Emulation.setGeolocationOverride', { latitude: profile.latitude, longitude: profile.longitude, accuracy: 5000 }, child);
        }
        await wc.debugger.sendCommand('Target.setAutoAttach', { autoAttach: true, waitForDebuggerOnStart: true, flatten: true }, child);
        await wc.debugger.sendCommand('Runtime.runIfWaitingForDebugger', {}, child);
      })().catch(() => { if (alive()) void this.lock('A browser context could not apply the regional settings. Browsing was locked.', 'error'); });
    });
    await wc.debugger.sendCommand('Target.setAutoAttach', { autoAttach: true, waitForDebuggerOnStart: true, flatten: true });
    await wc.debugger.sendCommand('Emulation.setTimezoneOverride', { timezoneId: profile.timezone });
    await wc.debugger.sendCommand('Emulation.setLocaleOverride', { locale: profile.locale });
    await wc.debugger.sendCommand('Emulation.setUserAgentOverride', { userAgent, acceptLanguage: profile.locale, userAgentMetadata });
    await wc.debugger.sendCommand('Emulation.setGeolocationOverride', { latitude: profile.latitude, longitude: profile.longitude, accuracy: 5000 });
    wc.debugger.on('detach', () => { if (alive() && this.state.status === 'ready') void this.lock('Browser regional settings were detached. Verify again before browsing.', 'error'); });
    const navigationAllowed = (url: string) => { try { normalizeURL(url, testMode); return this.allowed(); } catch { return false; } };
    wc.on('will-navigate', (event, url) => { if (!navigationAllowed(url)) event.preventDefault(); });
    wc.on('will-redirect', (event, url) => { if (!navigationAllowed(url)) event.preventDefault(); });
    wc.setWindowOpenHandler(({ url }) => {
      if (navigationAllowed(url)) setImmediate(() => { if (alive()) void this.newTab(url).catch(error => this.reportTabError(error)); });
      else this.log('A popup was blocked. Only HTTPS pages in the verified profile can open.', 'warning');
      return { action: 'deny' };
    });
    wc.on('will-attach-webview', event => event.preventDefault());
    const record = (visit = false) => {
      if (!alive()) return;
      const url = wc.getURL();
      if (url.startsWith('https:') || testMode && url.startsWith('http:')) {
        try { this.browsing.setPage(profile.id, tabId, url, wc.getTitle(), visit); } catch { /* invalid destinations are never persisted */ }
      }
    };
    const sync = () => { if (!alive()) return; if (this.view === view) this.syncActiveView(); else this.emit(); };
    wc.on('did-start-loading', sync); wc.on('did-stop-loading', sync);
    wc.on('did-navigate', (_event, _url, code) => { if (code < 400) record(true); sync(); });
    wc.on('did-navigate-in-page', (_event, _url, main) => { if (main) { record(true); sync(); } });
    wc.on('page-title-updated', () => { record(); sync(); });
    wc.on('did-finish-load', () => { record(); sync(); if (this.view === view && this.allowed()) void this.inspect().catch(() => {}); });
    wc.on('did-fail-load', (_e, code, _desc, _url, isMainFrame) => {
      if (!isMainFrame || code === -3 || !alive()) return;
      if (code === -111 && this.upstreamStatus === 429 && this.allowed()) { this.state.message = 'The proxy rate-limited this page. Wait before reloading; your session is preserved.'; this.emit(); }
      else if ([-130, -111, -102, -105, -118].includes(code)) void this.lock('The page lost its connection. Check the proxy and verify again.', 'error');
      else { this.state.message = `The page could not load (network code ${code}). Try another HTTPS address or verify again.`; this.log(this.state.message, 'warning'); }
    });
    wc.on('render-process-gone', () => { if (alive()) void this.lock('The browser stopped unexpectedly. Verify to restart it.', 'error'); });
    this.applyBounds();
  }
  async verify(background = false) {
    if (this.checking) return;
    if (Date.now() < this.retryAt) { this.state.retryAt = this.retryAt; this.emit(); return; }
    const wasReady = this.allowed();
    const token = ++this.generation;
    if (!this.store.active.proxy.host) { this.state.message = 'Add a proxy host and port in Connections first.'; this.emit(); return; }
    this.checking = true;
    this.upstreamStatus = undefined;
    if (!background && !wasReady) { this.state.status = 'checking'; this.state.message = 'Checking your proxy route and apparent country…'; this.emit(); }
    try {
      trace('verification started'); if (!this.bridge) await this.configure();
      if (token !== this.generation) return;
      this.abort = new AbortController();
      const timeout = setTimeout(() => this.abort?.abort(), 18_000);
      const start = Date.now();
      let data: Record<string, unknown>;
      try {
        trace('fetching network evidence'); const response = await this.getSession().fetch(checkURL, { signal: this.abort.signal, redirect: 'error', cache: 'no-store', credentials: 'omit' });
        if (response.status === 429) throw new CheckRateLimit(retryDelay(response.headers.get('retry-after')));
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
      if (network.timezone && new Intl.DateTimeFormat('en', { timeZone: network.timezone }).resolvedOptions().timeZone !== new Intl.DateTimeFormat('en', { timeZone: this.store.active.timezone }).resolvedOptions().timeZone) {
        await this.lock(`Timezone mismatch: the proxy reports ${network.timezone}; this profile uses ${this.store.active.timezone}. Update the profile or choose a matching endpoint.`, 'error'); return;
      }
      if (token !== this.generation) return;
      this.validUntil = Date.now() + lifetime;
      this.nextCheck = Date.now() + 45_000; this.retryAt = 0; this.retryCount = 0; this.state.retryAt = undefined;
      this.state.status = 'ready'; this.state.message = 'Proxy country verified. Browser settings are applied; audience region is not measured.';
      await this.tabTask(() => this.showActiveTab());
      if (token !== this.generation) return;
      this.state.cookieCount = (await this.getSession().cookies.get({})).length;
      trace('reading browser evidence'); await this.inspect(); trace('evidence complete'); this.applyBounds();
      if (!background) this.log(`Connection verified in ${network.country}. Managed browsing unlocked.`, 'success');
      this.emit();
    } catch (error) {
      if (token === this.generation) {
        if (error instanceof CheckRateLimit || this.upstreamStatus === 429) {
          const delay = Math.max(error instanceof CheckRateLimit ? error.delay : this.upstreamRetryDelay, this.retryCount > 0 ? 30_000 * 2 ** Math.min(this.retryCount, 5) : 0);
          const message = error instanceof CheckRateLimit ? error.message : connectionError(null, 429);
          const count = ++this.retryCount;
          if (!wasReady || Date.now() >= this.validUntil) await this.lock(message, 'error');
          else this.state.message = `${message} Existing verification remains valid briefly; retry scheduled.`;
          this.retryCount = count; this.retryAt = Date.now() + delay; this.nextCheck = this.retryAt;
          if (count > 2) this.state.message = `${message} Automatic retries paused. Verify manually after the cooldown.`;
          this.state.retryAt = this.retryAt; this.checking = false; this.emit();
        } else await this.lock(connectionError(error, this.upstreamStatus), 'error');
      }
    } finally { if (token === this.generation) this.checking = false; }
  }
  async lock(message = 'Browser locked. Saved cookies and login sessions are preserved.', status: 'locked' | 'error' = 'locked') {
    this.retryAt = 0; this.nextCheck = 0;
    this.dock();
    ++this.generation; this.checking = false; this.abort?.abort(); this.abort = null; this.validUntil = 0;
    ++this.viewEpoch;
    const oldViews = [...this.views.values()]; this.views.clear(); this.view = null;
    for (const old of oldViews) { if (!this.win.isDestroyed()) this.win.contentView.removeChildView(old); if (!old.webContents.isDestroyed()) old.webContents.close(); }
    this.browsing.flush();
    this.state = { ...lockedState(), status, message, network: this.state.network, browser: this.state.browser, cookieCount: this.state.cookieCount };
    this.emit();
    const ses = this.sessions.get(this.store.activeId);
    if (ses) { await ses.setProxy({ mode: 'fixed_servers', proxyRules: 'http://127.0.0.1:9', proxyBypassRules: '<-loopback>' }); await ses.closeAllConnections(); }
    const bridge = this.bridge; this.bridge = null;
    if (bridge) await bridge.close(true);
    this.log(message, status === 'error' ? 'warning' : 'info');
  }
  async reset() { await this.lock(); this.retryCount = 0; this.state = lockedState(); this.emit(); }
  navigate(input: string) { return this.tabTask(async () => {
    if (!this.allowed()) throw new Error('Verify the connection before opening a website.');
    const url = normalizeURL(input, testMode);
    const id = this.browsing.get(this.store.activeId).activeTabId;
    this.browsing.setPage(this.store.activeId, id, url, url);
    await this.createView();
    if (!this.allowed() || !this.view) return;
    void this.view.webContents.loadURL(url).catch(() => {}); this.syncActiveView();
  }); }
  action(action: string) {
    const wc = this.view?.webContents; if (!wc || !this.allowed()) return;
    if (action === 'back' && wc.navigationHistory.canGoBack()) wc.navigationHistory.goBack();
    else if (action === 'forward' && wc.navigationHistory.canGoForward()) wc.navigationHistory.goForward();
    else if (action === 'reload') wc.reload(); else if (action === 'stop') wc.stop();
    else if (action.startsWith('zoom-')) {
      const steps = [0.5, 0.67, 0.8, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2, 2.5, 3];
      const current = wc.getZoomFactor();
      const next = action === 'zoom-reset' ? 1 : action === 'zoom-in' ? steps.find(n => n > current + 0.01) ?? 3 : [...steps].reverse().find(n => n < current - 0.01) ?? 0.5;
      wc.setZoomFactor(next); this.state.zoom = next; this.emit();
    } else if (action === 'detach') this.detach();
    else if (action === 'dock') this.dock();
    else if (action === 'fullscreen') { if (!this.floating) this.detach(); this.floating?.setFullScreen(!this.floating.isFullScreen()); }
  }
  private detach() {
    if (!this.view || this.floating) { this.floating?.focus(); return; }
    const floating = new BaseWindow({ width: 1200, height: 850, minWidth: 600, minHeight: 400, backgroundColor: '#101113', title: `${this.store.active.name} — RegionDesk` });
    this.win.contentView.removeChildView(this.view); floating.contentView.addChildView(this.view);
    this.floating = floating; this.state.detached = true; this.updateFloatingMenu();
    floating.on('resize', () => this.applyBounds());
    const sync = (fullscreen: boolean) => { this.state.fullscreen = fullscreen; this.applyBounds(); this.emit(); };
    floating.on('enter-full-screen', () => sync(true)); floating.on('leave-full-screen', () => sync(false));
    floating.on('close', () => this.dock(false));
    this.applyBounds(); this.emit(); this.view.webContents.focus();
  }
  private updateFloatingMenu() {
    if (!this.floating) return;
    const data = this.browsing.get(this.store.activeId);
    this.floating.setMenu(Menu.buildFromTemplate([{ label: 'Browser', submenu: [
      { label: 'Address…', click: () => this.focusShell('address') },
      { label: 'New tab', click: () => { void this.newTab().catch(error => this.reportTabError(error)); } },
      { label: 'Close tab', click: () => { void this.closeTab(data.activeTabId).catch(error => this.reportTabError(error)); } },
      { label: 'Back', click: () => this.action('back') }, { label: 'Forward', click: () => this.action('forward') },
      { label: 'Reload', accelerator: 'Ctrl+R', click: () => this.action('reload') },
      { label: 'Zoom in', click: () => this.action('zoom-in') }, { label: 'Zoom out', click: () => this.action('zoom-out') }, { label: 'Reset zoom', click: () => this.action('zoom-reset') },
      { label: 'Full screen (F11 / Esc)', click: () => this.action('fullscreen') },
      { label: 'History', click: () => this.focusShell('history') }, { label: 'Permissions', click: () => this.focusShell('permissions') },
      { label: 'Return to workspace', click: () => this.dock() }, { label: 'Lock browser', click: () => { void this.lock(); } }
    ] }, { label: 'Tabs', submenu: data.tabs.map(tab => ({ label: tab.title.replaceAll('&', '&&').slice(0, 80), type: 'radio' as const, checked: tab.id === data.activeTabId, click: () => { void this.selectTab(tab.id).catch(error => this.reportTabError(error)); } })) }]));
  }
  private dock(close = true) {
    const floating = this.floating; if (!floating) return;
    this.floating = null;
    if (this.view) { floating.contentView.removeChildView(this.view); if (!this.win.isDestroyed()) this.win.contentView.addChildView(this.view); }
    this.state.detached = false; this.state.fullscreen = false;
    if (close && !floating.isDestroyed()) floating.close();
    this.applyBounds(); this.emit();
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
    for (const view of this.views.values()) if (view !== this.view) view.setVisible(false);
    if (!this.view) return;
    if (this.floating) { const { width, height } = this.floating.getContentBounds(); this.view.setBounds({ x: 0, y: 0, width, height }); this.view.setVisible(this.allowed()); return; }
    this.view.setVisible(!!this.bounds && this.allowed() && !!this.state.url);
    if (this.bounds) this.view.setBounds(this.bounds);
  }
  async inspect() {
    const wc = this.view?.webContents;
    if (!wc || wc.isDestroyed()) return;
    const result = await wc.debugger.sendCommand('Runtime.evaluate', { expression: `JSON.stringify({language:navigator.language,languages:[...navigator.languages],timezone:Intl.DateTimeFormat().resolvedOptions().timeZone,locale:Intl.DateTimeFormat().resolvedOptions().locale,userAgent:navigator.userAgent,platform:navigator.platform,width:screen.width,height:screen.height,hardwareConcurrency:navigator.hardwareConcurrency,webdriver:navigator.webdriver,clientHints:navigator.userAgentData?.toJSON()})`, returnByValue: true });
    if (typeof result.result?.value === 'string') this.state.browser = { ...JSON.parse(result.result.value), webRTCPolicy: wc.getWebRTCIPHandlingPolicy() } as BrowserEvidence;
    this.state.cookieCount = (await this.getSession().cookies.get({})).length; this.emit();
  }
  async clearSession(id = this.store.activeId) {
    await this.lock(); const ses = this.getSession(id); await ses.clearStorageData(); await ses.clearCache(); await ses.clearAuthCache();
    this.state.cookieCount = 0; this.log('Cookies, site storage, cache and HTTP authentication cleared for this profile.');
  }
  async dispose() { clearInterval(this.timer); await this.lock(); this.browsing.flush(); }
}
