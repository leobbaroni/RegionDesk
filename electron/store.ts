import { app, safeStorage } from 'electron';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { defaultProfile, validateProfile } from './core';
import type { Profile, ProfileInput } from '../shared/types';

interface Saved { profile: Profile; password: string }
export class ProfileStore {
  private records: Saved[] = [];
  activeId = '';
  private file: string;
  constructor() {
    const root = app.getPath('userData'); mkdirSync(root, { recursive: true });
    this.file = path.join(root, 'profiles.json');
    if (existsSync(this.file)) {
      const data = JSON.parse(readFileSync(this.file, 'utf8'));
      if (data.version !== 1 || !Array.isArray(data.records)) throw new Error('Unsupported profile file. Keep a backup before changing it.');
      this.records = data.records.map((r: Saved) => ({ profile: { ...validateProfile(r.profile, r.profile), proxy: { ...r.profile.proxy, hasPassword: !!r.password } }, password: r.password || '' }));
      this.activeId = data.activeId;
    }
    if (!this.records.length) { const profile = defaultProfile(); this.records = [{ profile, password: '' }]; this.activeId = profile.id; }
    if (!this.records.some(r => r.profile.id === this.activeId)) this.activeId = this.records[0].profile.id;
    this.persist();
  }
  get profiles() { return this.records.map(r => structuredClone(r.profile)); }
  get active() { return this.profiles.find(p => p.id === this.activeId)!; }
  password(id: string) {
    const stored = this.records.find(r => r.profile.id === id)?.password;
    if (!stored) return '';
    if (!safeStorage.isEncryptionAvailable()) throw new Error('Windows credential encryption is unavailable.');
    try { return safeStorage.decryptString(Buffer.from(stored, 'base64')); }
    catch { throw new Error('This password cannot be decrypted on this Windows account. Re-enter it in Connections.'); }
  }
  save(raw: ProfileInput) {
    const record = this.records.find(r => r.profile.id === raw.id);
    if (!record) throw new Error('Profile not found.');
    const profile = validateProfile(raw, record.profile);
    const sum = this.records.filter(r => r.profile.id !== profile.id).reduce((s, r) => s + r.profile.proxy.monthlyCost, 0) + profile.proxy.monthlyCost;
    if (sum > 30.001) throw new Error('Your saved monthly connection estimates exceed the $30 total budget. Adjust the estimates before saving.');
    let password = record.password;
    if (raw.clearPassword) password = '';
    if (raw.password) {
      if (!safeStorage.isEncryptionAvailable()) throw new Error('Windows credential encryption is unavailable. Password was not saved.');
      password = safeStorage.encryptString(raw.password).toString('base64');
    }
    record.password = password; profile.proxy.hasPassword = !!password; record.profile = profile; this.persist();
  }
  create() { const profile = defaultProfile(`Profile ${this.records.length + 1}`); this.records.push({ profile, password: '' }); this.activeId = profile.id; this.persist(); }
  select(id: string) { if (!this.records.some(r => r.profile.id === id)) throw new Error('Profile not found.'); this.activeId = id; this.persist(); }
  delete(id: string) {
    if (this.records.length === 1) throw new Error('Keep at least one profile.');
    this.records = this.records.filter(r => r.profile.id !== id);
    if (id === this.activeId) this.activeId = this.records[0].profile.id; this.persist();
  }
  private persist() {
    const temp = `${this.file}.tmp`;
    writeFileSync(temp, JSON.stringify({ version: 1, activeId: this.activeId, records: this.records }, null, 2), { mode: 0o600 });
    renameSync(temp, this.file);
  }
}
