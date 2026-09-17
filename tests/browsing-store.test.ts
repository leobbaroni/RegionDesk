import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { BrowsingStore } from '../electron/browsing-store';

function fixture() { const root = mkdtempSync(path.join(tmpdir(), 'regiondesk-browsing-')); const store = new BrowsingStore(root); return { root, store, cleanup: () => { store.flush(); rmSync(root, { recursive: true }); } }; }

test('tabs, order, active tab and history survive restart without crossing profile boundaries', () => {
  const { root, store, cleanup } = fixture();
  try {
    const a = randomUUID(), b = randomUUID();
    const original = store.get(a).activeTabId;
    store.setPage(a, original, 'https://example.com/one', 'One', true);
    const second = store.newTab(a, 'https://example.com/two');
    store.move(a, second, 'left'); store.flush();
    const restored = new BrowsingStore(root);
    assert.deepEqual(restored.get(a), store.get(a));
    assert.equal(restored.get(a).activeTabId, second);
    assert.equal(restored.get(a).tabs[0].id, second);
    assert.deepEqual(restored.get(b).history, []);
    assert.equal(restored.get(b).tabs[0].url, '');
    assert.throws(() => restored.select(b, second), /not found/);
    restored.flush();
  } finally { cleanup(); }
});

test('history removal and clearing leave saved tabs and other profiles untouched', () => {
  const { store, cleanup } = fixture();
  try {
    const a = randomUUID(), b = randomUUID();
    for (const id of [a, b]) store.setPage(id, store.get(id).activeTabId, 'https://example.com/', 'Example', true);
    store.removeHistory(a, 'https://example.com/'); assert.equal(store.get(a).history.length, 0);
    store.setPage(a, store.get(a).activeTabId, 'https://example.com/', 'Example', true);
    store.clearHistory(a);
    assert.equal(store.get(a).tabs[0].url, 'https://example.com/');
    assert.equal(store.get(b).history.length, 1);
    const original = store.get(a).activeTabId, second = store.newTab(a, 'https://example.com/second'), third = store.newTab(a, 'https://example.com/third');
    store.reorder(a, original, third);
    assert.deepEqual(store.get(a).tabs.map(tab => tab.id), [second, third, original]);
    assert.equal(store.get(a).activeTabId, third);
    assert.throws(() => store.reorder(b, original, store.get(b).activeTabId), /not found/);
  } finally { cleanup(); }
});

test('closing the last tab creates a blank tab and unsafe restored destinations cannot be added', () => {
  const { store, cleanup } = fixture();
  try {
    const id = randomUUID(), first = store.get(id).activeTabId;
    store.close(id, first); assert.notEqual(store.get(id).activeTabId, first); assert.equal(store.get(id).tabs.length, 1);
    for (const url of ['file:///C:/secret', 'https://user:password@example.com/', 'https://127.0.0.1/']) assert.throws(() => store.newTab(id, url));
    assert.equal(store.get(id).tabs.length, 1);
    store.setPage(id, store.get(id).activeTabId, 'https://example.com/', 'First', true);
    store.setPage(id, store.get(id).activeTabId, 'https://example.com/', 'Updated');
    assert.equal(store.get(id).history.length, 1); assert.equal(store.get(id).history[0].visits, 1); assert.equal(store.get(id).history[0].title, 'Updated');
  } finally { cleanup(); }
});
