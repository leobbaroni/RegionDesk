import test from 'node:test';
import assert from 'node:assert/strict';
import { blocksTracker } from '../electron/privacy';

test('starter tracker rules block third-party requests without blocking first-party pages or lookalike domains', () => {
  assert.equal(blocksTracker('https://www.google-analytics.com/collect', 'https://example.com/', 'xhr'), true);
  assert.equal(blocksTracker('https://www.google-analytics.com/collect', 'https://google-analytics.com/', 'xhr'), false);
  assert.equal(blocksTracker('https://google-analytics.com/', 'https://example.com/', 'mainFrame'), false);
  assert.equal(blocksTracker('https://google-analytics.com.example.com/collect', 'https://example.org/', 'xhr'), false);
  assert.equal(blocksTracker('https://cdn.example.com/app.js', 'https://example.com/', 'script'), false);
});
