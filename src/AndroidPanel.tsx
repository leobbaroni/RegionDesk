import { useEffect, useState } from 'react';
import type { Profile } from '../shared/types';
import type { AndroidAction, AndroidPairing, AndroidState } from '../shared/android';

const defaults: AndroidPairing = { instance: 'Pie64', port: 5555, installDirectory: 'C:\\Program Files\\BlueStacks_nxt' };
export default function AndroidPanel({ profile }: { profile: Profile }) {
  const [state, setState] = useState<AndroidState>({ pairing: null });
  const [draft, setDraft] = useState(defaults);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState(false);
  useEffect(() => {
    let active = true;
    setState({ pairing: null }); setDraft(defaults); setMessage('');
    window.regiondesk?.androidGet().then(s => { if (active) { setState(s); setDraft(s.pairing || defaults); } }).catch(e => { if (active) { setMessage(e.message); setError(true); } });
    return () => { active = false; };
  }, [profile.id]);
  const run = async (fn: () => Promise<AndroidState | string | null>, success = '') => {
    setBusy(true); setMessage(''); setError(false);
    try { const result = await fn(); if (result && typeof result === 'object') setState(result); setMessage(typeof result === 'string' ? `Copied to Android: ${result}` : success); }
    catch (e) { setState(s => ({ pairing: s.pairing })); setMessage(e instanceof Error ? e.message : 'Android action failed.'); setError(true); }
    finally { setBusy(false); }
  };
  const action = (a: AndroidAction) => void run(() => window.regiondesk!.androidAction(a), a === 'ip-check' ? 'Check the IP shown in Android Chrome against your provider. This does not verify account region.' : 'Opened in BlueStacks.');
  const e = state.evidence;
  const changed = JSON.stringify(draft) !== JSON.stringify(state.pairing);
  const disabled = busy || !state.pairing || !window.regiondesk || changed;
  return <div className="android-panel">
    <section className="diagnostic-section">
      <div className="section-heading"><div><h2>Local Android · experimental</h2><p>Keep apps and sessions in a persistent BlueStacks instance on this computer.</p></div></div>
      <p>Android has its own tunnel and app storage. The browser connection button does not connect or lock Android. Match this workspace to one instance; create additional instances in BlueStacks Manager.</p>
      <form onSubmit={event => { event.preventDefault(); void run(() => window.regiondesk!.androidSave(draft), 'Pairing saved. Android app data was not changed.'); }}>
        <div className="android-fields">
          <label className="field">BlueStacks installation directory<input value={draft.installDirectory} onChange={event => setDraft({ ...draft, installDirectory: event.target.value })} disabled={busy} /></label>
          <label className="field">Instance ID<input value={draft.instance} onChange={event => setDraft({ ...draft, instance: event.target.value })} disabled={busy} /><small>For example Pie64, not the display name.</small></label>
          <label className="field">Local ADB port<input type="number" min="1024" max="65535" value={draft.port} onChange={event => setDraft({ ...draft, port: Number(event.target.value) })} disabled={busy} /></label>
        </div>
        <button className="button primary" disabled={busy || !window.regiondesk || !changed}>Save pairing</button>
      </form>
      <div className="android-actions">
        <button className="button secondary" disabled={disabled} onClick={() => action('launch')}>Launch Android</button>
        <button className="button secondary" disabled={disabled} onClick={() => action('manager')}>BlueStacks Manager</button>
        <button className="button primary" disabled={disabled} onClick={() => void run(() => window.regiondesk!.androidInspect())}>{busy ? 'Working…' : 'Inspect Android'}</button>
      </div>
    </section>
    {message && <div role={error ? 'alert' : 'status'} className={`inline-notice ${error ? 'android-error' : ''}`}>{message}</div>}
    <section className="diagnostic-section">
      <div className="section-heading"><div><h2>Route and regional settings</h2><p>Fresh checks run before opening websites. These controls do not prove physical-device authenticity.</p></div></div>
      <div className="fact"><span>Device</span><strong>{e ? `${e.model} · Android ${e.version}` : 'Not inspected'}</strong></div>
      <div className="fact"><span>Language · expected {profile.locale}</span><strong>{e?.locale || 'Not inspected'}</strong></div>
      <div className="fact"><span>Timezone · expected {profile.timezone}</span><strong>{e?.timezone || 'Not inspected'}</strong></div>
      <div className="fact"><span>Tunnel interface</span><strong>{e ? e.tunnel ? 'Present (not an IP check)' : 'Absent' : 'Not inspected'}</strong></div>
      <div className="fact"><span>Always-on SocksTun / block without VPN</span><strong>{e ? e.alwaysOn === 'hev.sockstun' && e.lockdown ? 'Configured' : 'Needs setup' : 'Not inspected'}</strong></div>
      <div className="fact"><span>Last inspection</span><strong>{e ? new Date(e.measuredAt).toLocaleTimeString() : 'Not inspected'}</strong></div>
      <div className="android-actions">
        <button className="button secondary" disabled={disabled} onClick={() => action('tunnel')}>Open SocksTun</button>
        <button className="button secondary" disabled={disabled} onClick={() => action('vpn-settings')}>VPN protection</button>
        <button className="button secondary" disabled={disabled} onClick={() => action('date-settings')}>Timezone</button>
        <button className="button secondary" disabled={disabled} onClick={() => action('language-settings')}>Language</button>
      </div>
      <p>In SocksTun, use your proxy credentials, Global mode and Remote DNS. In Android VPN settings, enable Always-on VPN and Block connections without VPN. Keep local ADB enabled and remote ADB disabled. Proxy credentials are configured inside Android, separately from Connections.</p>
    </section>
    <section className="diagnostic-section">
      <div className="section-heading"><div><h2>Browse and transfer</h2><p>Check the exit IP first. TikTok web opens only when protection and regional settings match.</p></div></div>
      <div className="android-actions">
        <button className="button secondary" disabled={disabled} onClick={() => action('ip-check')}>Check IP in Android Chrome</button>
        <button className="button primary" disabled={disabled} onClick={() => action('tiktok')}>Open TikTok web</button>
        <button className="button secondary" disabled={disabled} onClick={() => void run(() => window.regiondesk!.androidTransfer())}>Copy video to Android</button>
      </div>
      <p>Videos are copied locally to Movies/RegionDesk. Publishing stays manual. Web connectivity has been tested; native TikTok, account region, uploads and reliable video playback remain unverified. Deleting a RegionDesk profile removes its pairing, not the Android instance or its app data.</p>
    </section>
  </div>;
}
