export type Screen = 'browser' | 'profiles' | 'connections' | 'diagnostics' | 'history';
export type ProxyProtocol = 'http' | 'https' | 'socks5';
export interface ProxyConfig {
  protocol: ProxyProtocol; host: string; port: number; username: string;
  hasPassword: boolean; provider: string;
}
export interface Profile {
  id: string; name: string; country: string; city: string; locale: string;
  timezone: string; latitude: number; longitude: number;
  locationPermission: 'blocked' | 'configured'; proxy: ProxyConfig;
  permissions?: BrowserPermissions;
  blockTrackers?: boolean;
  createdAt: string; updatedAt: string;
}
export interface BrowserPermissions { camera: boolean; microphone: boolean; notifications: boolean; clipboard: boolean; fullscreen: boolean }
export const defaultPermissions: BrowserPermissions = { camera: false, microphone: false, notifications: false, clipboard: false, fullscreen: true };
export type BrowserAction = 'back' | 'forward' | 'reload' | 'stop' | 'zoom-in' | 'zoom-out' | 'zoom-reset' | 'detach' | 'dock' | 'fullscreen';
export interface BrowserTab { id: string; url: string; title: string }
export interface HistoryEntry { url: string; title: string; visitedAt: string; visits: number }
export interface Bookmark { url: string; title: string }
export interface BrowsingData { tabs: BrowserTab[]; activeTabId: string; history: HistoryEntry[]; bookmarks: Bookmark[]; closedTabs: BrowserTab[] }
export interface BrowsingState extends Omit<BrowsingData, 'tabs'> { tabs: (BrowserTab & { loaded: boolean; loading: boolean })[] }
export type ProfileInput = Omit<Profile, 'createdAt' | 'updatedAt'> & { password?: string; clearPassword?: boolean };
export interface NetworkEvidence {
  ip: string; country: string; city: string; timezone: string;
  provider: string; measuredAt: string; latency: number;
}
export interface BrowserEvidence {
  language: string; languages: string[]; timezone: string; userAgent: string;
  platform: string; width: number; height: number; hardwareConcurrency: number;
  webRTCPolicy: string; locale: string;
  webdriver?: boolean;
  clientHints?: { brands: { brand: string; version: string }[]; mobile: boolean; platform: string };
}
export interface RuntimeState {
  status: 'locked' | 'checking' | 'ready' | 'error';
  message: string; network?: NetworkEvidence; browser?: BrowserEvidence;
  url: string; title: string; loading: boolean; canGoBack: boolean; canGoForward: boolean;
  cookieCount: number | null;
  zoom?: number; detached?: boolean; fullscreen?: boolean; retryAt?: number;
  blockedTrackers?: number;
  find?: { active: number; matches: number };
}
export interface Activity { id: string; at: string; kind: 'info' | 'success' | 'warning'; message: string; profileId: string }
export interface AppState {
  profiles: Profile[]; activeId: string; runtime: RuntimeState; activity: Activity[];
  secureStorage: boolean; version: string;
  browsing?: BrowsingState;
}
export interface Bounds { x: number; y: number; width: number; height: number }
export interface RegionDeskAPI {
  getState(): Promise<AppState>;
  saveProfile(profile: ProfileInput): Promise<AppState>;
  createProfile(): Promise<AppState>;
  selectProfile(id: string): Promise<AppState>;
  deleteProfile(id: string): Promise<AppState>;
  verify(): Promise<AppState>;
  disconnect(): Promise<AppState>;
  navigate(url: string): Promise<AppState>;
  browserAction(action: BrowserAction): Promise<void>;
  newTab(url?: string): Promise<AppState>;
  selectTab(id: string): Promise<AppState>;
  closeTab(id: string): Promise<AppState>;
  reopenTab(): Promise<AppState>;
  toggleBookmark(url: string, title: string): Promise<AppState>;
  findInPage(text: string, forward?: boolean): Promise<void>;
  moveTab(id: string, direction: 'left' | 'right'): Promise<AppState>;
  reorderTab(id: string, targetId: string): Promise<AppState>;
  openWorkspace(screen: 'history' | 'permissions'): Promise<void>;
  clearHistory(): Promise<AppState>;
  removeHistory(url: string): Promise<AppState>;
  onBrowserCommand(callback: (command: 'address' | 'history' | 'permissions' | 'find') => void): () => void;
  setBrowserBounds(bounds: Bounds | null): Promise<void>;
  inspectBrowser(): Promise<AppState>;
  clearSession(): Promise<AppState>;
  confirmDiscard(): Promise<boolean>;
  exportReport(): Promise<string | null>;
  openProvider(provider: 'webshare-free' | 'webshare-isp' | 'iproyal'): Promise<void>;
  onState(callback: (state: AppState) => void): () => void;
}
export const regions = [
  { country: 'US', name: 'United States', city: 'New York', locale: 'en-US', timezone: 'America/New_York', latitude: 40.7128, longitude: -74.006 },
  { country: 'US', name: 'United States · West', city: 'Los Angeles', locale: 'en-US', timezone: 'America/Los_Angeles', latitude: 34.0522, longitude: -118.2437 },
  { country: 'GB', name: 'United Kingdom', city: 'London', locale: 'en-GB', timezone: 'Europe/London', latitude: 51.5074, longitude: -0.1278 },
  { country: 'CA', name: 'Canada', city: 'Toronto', locale: 'en-CA', timezone: 'America/Toronto', latitude: 43.6532, longitude: -79.3832 },
  { country: 'AU', name: 'Australia', city: 'Sydney', locale: 'en-AU', timezone: 'Australia/Sydney', latitude: -33.8688, longitude: 151.2093 },
  { country: 'DE', name: 'Germany', city: 'Berlin', locale: 'de-DE', timezone: 'Europe/Berlin', latitude: 52.52, longitude: 13.405 },
  { country: 'FR', name: 'France', city: 'Paris', locale: 'fr-FR', timezone: 'Europe/Paris', latitude: 48.8566, longitude: 2.3522 },
  { country: 'ES', name: 'Spain', city: 'Madrid', locale: 'es-ES', timezone: 'Europe/Madrid', latitude: 40.4168, longitude: -3.7038 },
  { country: 'PT', name: 'Portugal', city: 'Lisbon', locale: 'pt-PT', timezone: 'Europe/Lisbon', latitude: 38.7223, longitude: -9.1393 },
  { country: 'BR', name: 'Brazil', city: 'São Paulo', locale: 'pt-BR', timezone: 'America/Sao_Paulo', latitude: -23.5505, longitude: -46.6333 },
  { country: 'JP', name: 'Japan', city: 'Tokyo', locale: 'ja-JP', timezone: 'Asia/Tokyo', latitude: 35.6762, longitude: 139.6503 },
  { country: 'SG', name: 'Singapore', city: 'Singapore', locale: 'en-SG', timezone: 'Asia/Singapore', latitude: 1.3521, longitude: 103.8198 }
];
