import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { normalizeURL } from './core';
import type { BrowserTab, BrowsingData } from '../shared/types';

const blankTab = (): BrowserTab => ({ id: randomUUID(), url: '', title: 'New tab' });
const empty = (): BrowsingData => { const tab = blankTab(); return { tabs: [tab], activeTabId: tab.id, history: [] }; };
const label = (value: unknown) => typeof value === 'string' ? value.replace(/[\u0000-\u001f\u007f]/g, '').slice(0, 200) : '';

export class BrowsingStore {
  private data: Record<string, BrowsingData> = Object.create(null);
  private file: string;
  private pending?: NodeJS.Timeout;
  constructor(root: string, private testMode = false) {
    mkdirSync(root, { recursive: true }); this.file = path.join(root, 'browsing.json');
    if (!existsSync(this.file)) return;
    const saved = JSON.parse(readFileSync(this.file, 'utf8'));
    if (saved.version !== 1 || !saved.profiles || typeof saved.profiles !== 'object') throw new Error('Unsupported browsing data. Keep a backup before changing it.');
    for (const [id, raw] of Object.entries(saved.profiles) as [string, BrowsingData][]) {
      if (!/^[a-f0-9-]{36}$/.test(id)) continue;
      const seen = new Set<string>();
      const tabs = (Array.isArray(raw.tabs) ? raw.tabs : []).slice(0, 32).flatMap(tab => {
        try { const tabId = /^[a-f0-9-]{36}$/.test(tab.id) && !seen.has(tab.id) ? tab.id : randomUUID(); seen.add(tabId); return [{ id: tabId, url: tab.url ? normalizeURL(tab.url, testMode) : '', title: label(tab.title) || 'New tab', oldId: tab.id }]; } catch { return []; }
      });
      const selected = tabs.find(tab => tab.oldId === raw.activeTabId)?.id;
      const state = empty();
      if (tabs.length) { state.tabs = tabs.map(({ oldId: _, ...tab }) => tab); state.activeTabId = selected || tabs[0].id; }
      state.history = (Array.isArray(raw.history) ? raw.history : []).slice(0, 500).flatMap(entry => {
        try { const url = normalizeURL(entry.url, testMode); if (!Number.isFinite(Date.parse(entry.visitedAt))) return []; return [{ url, title: label(entry.title) || url, visitedAt: entry.visitedAt, visits: Math.max(1, Math.min(1_000_000, Number(entry.visits) || 1)) }]; } catch { return []; }
      });
      this.data[id] = state;
    }
  }
  get(id: string): BrowsingData {
    if (!Object.hasOwn(this.data, id)) { this.data[id] = empty(); this.schedule(); }
    return structuredClone(this.data[id]);
  }
  private update(id: string, fn: (data: BrowsingData) => void) { this.get(id); fn(this.data[id]); this.schedule(); }
  newTab(id: string, input = '') {
    const url = input ? normalizeURL(input, this.testMode) : '';
    const tab = { ...blankTab(), url, title: url || 'New tab' };
    this.update(id, data => { if (data.tabs.length >= 32) throw new Error('This profile has 32 tabs. Close a tab before opening another.'); data.tabs.push(tab); data.activeTabId = tab.id; });
    return tab.id;
  }
  select(id: string, tabId: string) { this.update(id, data => { if (!data.tabs.some(tab => tab.id === tabId)) throw new Error('Tab not found in this profile.'); data.activeTabId = tabId; }); }
  close(id: string, tabId: string) {
    this.update(id, data => {
      const index = data.tabs.findIndex(tab => tab.id === tabId); if (index < 0) throw new Error('Tab not found in this profile.');
      data.tabs.splice(index, 1); if (!data.tabs.length) data.tabs.push(blankTab());
      if (data.activeTabId === tabId) data.activeTabId = data.tabs[Math.min(index, data.tabs.length - 1)].id;
    });
  }
  move(id: string, tabId: string, direction: 'left' | 'right') {
    if (!['left', 'right'].includes(direction)) throw new Error('Invalid tab direction.');
    this.update(id, data => { const from = data.tabs.findIndex(t => t.id === tabId); if (from < 0) throw new Error('Tab not found in this profile.'); const to = from + (direction === 'left' ? -1 : 1); if (to >= 0 && to < data.tabs.length) [data.tabs[from], data.tabs[to]] = [data.tabs[to], data.tabs[from]]; });
  }
  setPage(id: string, tabId: string, input: string, title: string, visit = false) {
    const url = normalizeURL(input, this.testMode);
    this.update(id, data => {
      const tab = data.tabs.find(tab => tab.id === tabId); if (!tab) return;
      tab.url = url; tab.title = label(title) || url;
      const existing = data.history.find(entry => entry.url === url);
      if (visit) {
        data.history = [{ url, title: tab.title, visitedAt: new Date().toISOString(), visits: (existing?.visits || 0) + 1 }, ...data.history.filter(entry => entry.url !== url)].slice(0, 500);
      } else if (existing) existing.title = tab.title;
    });
  }
  clearHistory(id: string) { this.update(id, data => { data.history = []; }); this.flush(); }
  removeHistory(id: string, url: string) { this.update(id, data => { data.history = data.history.filter(entry => entry.url !== url); }); }
  delete(id: string) { delete this.data[id]; this.schedule(); }
  private schedule() { if (!this.pending) { this.pending = setTimeout(() => this.flush(), 250); this.pending.unref(); } }
  flush() {
    if (this.pending) clearTimeout(this.pending); this.pending = undefined;
    const temp = `${this.file}.tmp`;
    writeFileSync(temp, JSON.stringify({ version: 1, profiles: this.data }), { mode: 0o600 }); renameSync(temp, this.file);
  }
}
