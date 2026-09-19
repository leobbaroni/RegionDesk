import test from 'node:test';
import assert from 'node:assert/strict';
import { androidBlockReason, parseAndroidEvidence, validateAndroidPairing } from '../electron/android-core';
const pairing = { instance: 'Pie64', port: 5555, installDirectory: 'C:\\Program Files\\BlueStacks_nxt' };
test('Android pairing restricts commands to local validated instances', () => {
  assert.deepEqual(validateAndroidPairing(pairing), pairing);
  for (const instance of ['--help', '../Pie64', 'Pie64;whoami', 'Pie64\n']) assert.throws(() => validateAndroidPairing({ ...pairing, instance }));
  for (const port of [22, 65536, 5555.2, '5555']) assert.throws(() => validateAndroidPairing({ ...pairing, port }));
  assert.throws(() => validateAndroidPairing({ ...pairing, installDirectory: '\\\\remote\\share' }));
});
const fixture = '__RD_VERSION__\n9\n__RD_MODEL__\nSM-S908E\n__RD_LOCALE__\nen-US\n__RD_TIMEZONE__\nAmerica/Los_Angeles\n__RD_VPN__\nhev.sockstun\n__RD_LOCKDOWN__\n1\n__RD_TUNNEL__\npresent\n';
test('Android inspection fails on incomplete output and distinguishes protection from interface presence', () => {
  assert.throws(() => parseAndroidEvidence('device offline'));
  const e = parseAndroidEvidence(fixture);
  assert.equal(androidBlockReason(e, { locale: 'en-US', timezone: 'America/Los_Angeles' }), null);
  assert.match(androidBlockReason({ ...e, tunnel: false })!, /Start SocksTun/);
  assert.match(androidBlockReason({ ...e, lockdown: false })!, /Block connections/);
  assert.match(androidBlockReason({ ...e, alwaysOn: 'another.app' })!, /SocksTun/);
  assert.match(androidBlockReason(e, { locale: 'en-US', timezone: 'Europe/Lisbon' })!, /timezone/);
  assert.match(androidBlockReason(e, { locale: 'pt-PT', timezone: e.timezone })!, /language/);
});
