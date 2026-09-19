import type { AndroidEvidence, AndroidPairing } from '../shared/android';

export function validateAndroidPairing(raw: unknown): AndroidPairing {
  if (!raw || typeof raw !== 'object') throw new Error('Invalid Android pairing.');
  const p = raw as AndroidPairing;
  if (typeof p.instance !== 'string' || !/^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(p.instance)) throw new Error('Use the BlueStacks instance ID, such as Pie64.');
  if (!Number.isInteger(p.port) || p.port < 1024 || p.port > 65535) throw new Error('ADB port must be between 1024 and 65535.');
  if (typeof p.installDirectory !== 'string' || !/^[A-Za-z]:[\\/]/.test(p.installDirectory) || /[\r\n\x00]/.test(p.installDirectory) || p.installDirectory.length > 240) throw new Error('Choose an absolute local BlueStacks installation directory.');
  return { instance: p.instance, port: p.port, installDirectory: p.installDirectory };
}

export function parseAndroidEvidence(output: string): AndroidEvidence {
  const fields = output.replaceAll('\r', '').split('\n');
  const value = (key: string) => { const i = fields.indexOf(`__RD_${key}__`); if (i < 0 || i + 1 >= fields.length) throw new Error('Incomplete Android inspection.'); return fields[i + 1].trim(); };
  return { measuredAt: new Date().toISOString(), version: value('VERSION'), model: value('MODEL'), locale: value('LOCALE'), timezone: value('TIMEZONE'), alwaysOn: value('VPN'), lockdown: value('LOCKDOWN') === '1', tunnel: value('TUNNEL') === 'present' };
}

export function androidBlockReason(e: AndroidEvidence, region?: { timezone: string; locale: string }): string | null {
  if (!e.tunnel) return 'Start SocksTun inside Android first.';
  if (e.alwaysOn !== 'hev.sockstun' || !e.lockdown) return 'Enable SocksTun always-on VPN and Block connections without VPN in Android settings.';
  if (region && e.timezone !== region.timezone) return `Android timezone must match this profile (${region.timezone}).`;
  if (region && e.locale.replace('_', '-').toLowerCase() !== region.locale.toLowerCase()) return `Android language must match this profile (${region.locale}).`;
  return null;
}
