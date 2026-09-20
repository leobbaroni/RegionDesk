import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, open, rename, rm } from 'node:fs/promises';
import path from 'node:path';
import type { UpdateState } from '../shared/types';

const repository = 'https://github.com/leobbaroni/RegionDesk';
const latest = 'https://api.github.com/repos/leobbaroni/RegionDesk/releases/latest';
type Asset = { url: string; version: string; digest: string; size: number };
const versionParts = (value: string) => /^\d+\.\d+\.\d+$/.test(value) ? value.split('.').map(Number) : null;
export function newerVersion(candidate: string, current: string) {
  const a = versionParts(candidate), b = versionParts(current);
  if (!a || !b) return false;
  for (let i = 0; i < 3; i++) { if (a[i] !== b[i]) return a[i] > b[i]; }
  return false;
}
export function releaseAsset(release: any, current: string): Asset | null {
  if (!release || release.draft || release.prerelease || typeof release.tag_name !== 'string') throw new Error('Invalid release');
  const version = release.tag_name.replace(/^v/, '');
  if (!versionParts(version)) throw new Error('Invalid release version');
  if (!newerVersion(version, current)) return null;
  const asset = release.assets?.find((item: any) => item.name === 'RegionDesk-Setup.exe');
  const expectedURL = `${repository}/releases/download/${release.tag_name}/RegionDesk-Setup.exe`;
  if (!asset || asset.browser_download_url !== expectedURL || !/^sha256:[a-f0-9]{64}$/.test(asset.digest) || !Number.isSafeInteger(asset.size) || asset.size < 1 || asset.size > 1024 ** 3) throw new Error('Installer unavailable or unverified');
  return { url: expectedURL, version, digest: asset.digest.slice(7), size: asset.size };
}
export function allowedUpdateURL(value: string) {
  const url = new URL(value);
  return url.protocol === 'https:' && !url.username && !url.password && (!url.port || url.port === '443') && ['api.github.com', 'github.com', 'release-assets.githubusercontent.com', 'objects.githubusercontent.com', 'releases.githubusercontent.com'].includes(url.hostname);
}
async function request(url: string, signal: AbortSignal): Promise<Response> {
  for (let redirects = 0; redirects < 6; redirects++) {
    if (!allowedUpdateURL(url)) throw new Error('Unexpected update host');
    // Node networking is independent of account-browser sessions and their DNS/proxy restrictions.
    const response = await fetch(url, { redirect: 'manual', signal, headers: { 'User-Agent': 'RegionDesk-Updater', Accept: 'application/octet-stream, application/json' } });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get('location'); await response.body?.cancel();
      if (!location) throw new Error('Missing update location');
      url = new URL(location, url).href; continue;
    }
    if (!response.ok) { await response.body?.cancel(); throw new Error(`Update server HTTP ${response.status}`); }
    return response;
  }
  throw new Error('Too many redirects');
}
async function digestFile(file: string) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return hash.digest('hex');
}

export class AppUpdates {
  state: UpdateState;
  private asset?: Asset;
  private installer?: string;
  constructor(private version: string, private directory: string, private supported: boolean, private changed: () => void, private get = request) {
    this.state = { status: supported ? 'idle' : 'unsupported', message: supported ? 'Check GitHub for a newer version.' : 'Updates are available in the installed Windows app.' };
  }
  private set(state: UpdateState) { this.state = state; this.changed(); }
  async check() {
    if (!this.supported || ['checking', 'downloading', 'downloaded', 'installing'].includes(this.state.status)) return;
    this.asset = undefined;
    this.set({ status: 'checking', message: 'Checking GitHub Releases…' });
    try {
      const response = await this.get(latest, AbortSignal.timeout(20_000));
      const reader = response.body?.getReader(); if (!reader) throw new Error('Empty release response');
      const chunks: Uint8Array[] = []; let size = 0;
      try { while (true) { const item = await reader.read(); if (item.done) break; size += item.value.length; if (size > 1024 ** 2) throw new Error('Release response too large'); chunks.push(item.value); } }
      finally { await reader.cancel(); }
      this.asset = releaseAsset(JSON.parse(Buffer.concat(chunks).toString('utf8')), this.version) || undefined;
      this.set(this.asset ? { status: 'available', version: this.asset.version, message: `Version ${this.asset.version} is available.` } : { status: 'current', message: 'You’re up to date.' });
    } catch { this.set({ status: 'error', message: 'Could not check for updates. Check your internet connection and try again.' }); }
  }
  async download() {
    if (this.state.status !== 'available' || !this.asset) return;
    const asset = this.asset;
    const file = path.join(this.directory, `RegionDesk-${asset.version}-Setup.exe`), partial = `${file}.part`;
    this.set({ status: 'downloading', version: asset.version, progress: 0, message: 'Downloading the update…' });
    try {
      await mkdir(this.directory, { recursive: true });
      const response = await this.get(asset.url, AbortSignal.timeout(10 * 60_000));
      const reader = response.body?.getReader(); if (!reader) throw new Error('Empty installer');
      const handle = await open(partial, 'w', 0o600);
      const hash = createHash('sha256'); let size = 0;
      try {
        while (true) {
          const item = await reader.read(); if (item.done) break;
          size += item.value.length; if (size > asset.size) throw new Error('Installer size mismatch');
          hash.update(item.value); await handle.writeFile(item.value);
          const progress = Math.floor(size / asset.size * 100);
          if (progress !== this.state.progress) this.set({ status: 'downloading', version: asset.version, progress, message: 'Downloading the update…' });
        }
      } finally { await handle.close(); await reader.cancel(); }
      if (size !== asset.size || hash.digest('hex') !== asset.digest) throw new Error('Installer checksum mismatch');
      await rename(partial, file); this.installer = file;
      this.set({ status: 'downloaded', version: asset.version, message: 'Update ready. Save your work before restarting.' });
    } catch { this.set({ status: 'error', message: 'The update could not be downloaded and verified. Check for updates to retry.' }); }
    finally { await rm(partial, { force: true }).catch(() => {}); }
  }
  async install(launch: (installer: string) => Promise<void>) {
    if (this.state.status !== 'downloaded' || !this.installer || !this.asset) return;
    this.set({ status: 'installing', version: this.asset.version, message: 'Closing RegionDesk to install the update…' });
    try {
      if (await digestFile(this.installer) !== this.asset.digest) throw new Error('Installer changed');
      await launch(this.installer);
    } catch { this.set({ status: 'error', message: 'The installer could not start safely. Check for updates to retry.' }); }
  }
}
