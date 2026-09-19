import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { existsSync, readFileSync, writeFileSync, renameSync } from 'node:fs';
import { stat } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { AndroidAction, AndroidPairing, AndroidState } from '../shared/android';
import { androidBlockReason, parseAndroidEvidence, validateAndroidPairing } from './android-core';

const execute = promisify(execFile);
const inspection = 'echo __RD_VERSION__; getprop ro.build.version.release; echo __RD_MODEL__; getprop ro.product.model; echo __RD_LOCALE__; getprop persist.sys.locale; echo __RD_TIMEZONE__; getprop persist.sys.timezone; echo __RD_VPN__; settings get secure always_on_vpn_app; echo __RD_LOCKDOWN__; settings get secure always_on_vpn_lockdown; echo __RD_TUNNEL__; if ip link show tun0 >/dev/null 2>&1; then echo present; else echo absent; fi';

export class AndroidManager {
  private records: Record<string, AndroidPairing> = {};
  private file: string;
  constructor(root: string) {
    this.file = path.join(root, 'android.json');
    if (existsSync(this.file)) {
      const saved = JSON.parse(readFileSync(this.file, 'utf8'));
      if (saved.version !== 1 || !saved.records || typeof saved.records !== 'object') throw new Error('Unsupported Android pairing file.');
      for (const [id, raw] of Object.entries(saved.records)) this.records[id] = validateAndroidPairing(raw);
    }
  }
  get(id: string): AndroidState { return { pairing: this.records[id] ? { ...this.records[id] } : null }; }
  save(id: string, raw: unknown): AndroidState {
    const pairing = validateAndroidPairing(raw);
    if (Object.entries(this.records).some(([other, p]) => other !== id && (p.port === pairing.port || p.instance === pairing.instance && p.installDirectory.toLowerCase() === pairing.installDirectory.toLowerCase()))) throw new Error('This Android instance or ADB port is already paired with another profile.');
    this.binary(pairing, 'HD-Adb.exe'); this.binary(pairing, 'HD-Player.exe');
    this.records[id] = pairing; this.persist(); return this.get(id);
  }
  remove(id: string) { delete this.records[id]; this.persist(); }
  private persist() { writeFileSync(`${this.file}.tmp`, JSON.stringify({ version: 1, records: this.records }, null, 2)); renameSync(`${this.file}.tmp`, this.file); }
  private pairing(id: string) { const p = this.records[id]; if (!p) throw new Error('Pair a local Android instance first.'); return p; }
  private binary(p: AndroidPairing, name: string) { const file = path.join(p.installDirectory, name); if (!existsSync(file)) throw new Error(`${name} was not found in the selected directory.`); return file; }
  private async adb(p: AndroidPairing, args: string[], timeout = 15000) {
    try { const { stdout } = await execute(this.binary(p, 'HD-Adb.exe'), args, { windowsHide: true, timeout, maxBuffer: 1024 * 1024 }); return stdout.trim(); }
    catch { throw new Error('Android command failed. Start the paired instance and enable local ADB in BlueStacks Settings → Advanced.'); }
  }
  private async connect(p: AndroidPairing) {
    const serial = `127.0.0.1:${p.port}`;
    const connected = await this.adb(p, ['connect', serial]);
    if (!/connected to/.test(connected)) throw new Error('Could not connect to the paired local ADB port.');
    return serial;
  }
  async inspect(id: string): Promise<AndroidState> {
    const p = this.pairing(id), serial = await this.connect(p);
    return { pairing: { ...p }, evidence: parseAndroidEvidence(await this.adb(p, ['-s', serial, 'shell', inspection])) };
  }
  async action(id: string, action: AndroidAction, region: { timezone: string; locale: string }): Promise<AndroidState> {
    const p = this.pairing(id);
    if (action === 'launch' || action === 'manager') {
      const file = this.binary(p, action === 'launch' ? 'HD-Player.exe' : 'HD-MultiInstanceManager.exe');
      await new Promise<void>((resolve, reject) => { const child = spawn(file, action === 'launch' ? ['--instance', p.instance] : [], { windowsHide: true, stdio: 'ignore' }); child.once('error', () => reject(new Error('BlueStacks could not start.'))); child.once('spawn', () => { child.unref(); resolve(); }); });
      return this.get(id);
    }
    const current = await this.inspect(id), serial = `127.0.0.1:${p.port}`;
    const intents: Record<string, string[]> = {
      tunnel: ['-n', 'hev.sockstun/.MainActivity'],
      'vpn-settings': ['-a', 'android.settings.VPN_SETTINGS'],
      'date-settings': ['-a', 'android.settings.DATE_SETTINGS'],
      'language-settings': ['-a', 'android.settings.LOCALE_SETTINGS'],
      'ip-check': ['-a', 'android.intent.action.VIEW', '-d', 'https://api.ipify.org?format=json', 'com.android.chrome'],
      tiktok: ['-a', 'android.intent.action.VIEW', '-d', 'https://www.tiktok.com/', 'com.android.chrome']
    };
    if (!Object.hasOwn(intents, action)) throw new Error('Unknown Android action.');
    if (action === 'ip-check' || action === 'tiktok') {
      const reason = androidBlockReason(current.evidence!, action === 'tiktok' ? region : undefined);
      if (reason) throw new Error(reason);
    }
    const output = await this.adb(p, ['-s', serial, 'shell', 'am', 'start', ...intents[action]]);
    if (/Error:|Exception|does not exist/.test(output)) throw new Error('Android could not open this screen. Check that Chrome and SocksTun are installed.');
    return current;
  }
  async transfer(id: string, file: string): Promise<string> {
    const p = this.pairing(id);
    const ext = path.extname(file).toLowerCase();
    if (!['.mp4', '.mov', '.webm', '.m4v'].includes(ext) || !(await stat(file)).isFile()) throw new Error('Select a video file.');
    const serial = await this.connect(p), destination = `/sdcard/Movies/RegionDesk/${randomUUID()}${ext}`;
    await this.adb(p, ['-s', serial, 'shell', 'mkdir', '-p', '/sdcard/Movies/RegionDesk']);
    await this.adb(p, ['-s', serial, 'push', file, destination], 180000);
    await this.adb(p, ['-s', serial, 'shell', 'am', 'broadcast', '-a', 'android.intent.action.MEDIA_SCANNER_SCAN_FILE', '-d', `file://${destination}`]);
    return destination;
  }
}
