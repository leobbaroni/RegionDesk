export interface AndroidPairing {
  instance: string;
  port: number;
  installDirectory: string;
}
export interface AndroidEvidence {
  measuredAt: string;
  version: string;
  model: string;
  locale: string;
  timezone: string;
  tunnel: boolean;
  alwaysOn: string;
  lockdown: boolean;
}
export interface AndroidState { pairing: AndroidPairing | null; evidence?: AndroidEvidence }
export type AndroidAction = 'launch' | 'manager' | 'tunnel' | 'vpn-settings' | 'date-settings' | 'language-settings' | 'ip-check' | 'tiktok';
