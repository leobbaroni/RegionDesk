import { useState } from 'react';
import type { UpdateState } from '../shared/types';

export default function Updates({ state, onOpenChange }: { state?: UpdateState; onOpenChange: (open: boolean) => void }) {
  const [open, setOpen] = useState(false);
  const api = window.regiondesk;
  if (!api || !state) return null;
  const waiting = ['checking', 'downloading', 'installing'].includes(state.status);
  const label = state.status === 'available' ? 'Download update' : state.status === 'downloaded' ? 'Install and restart' : 'Check for updates';
  return <div className="updates-control">
    <button className="update-toggle" onClick={() => { setOpen(!open); onOpenChange(!open); }} aria-expanded={open}>Updates{state.status === 'downloaded' || state.status === 'available' ? ' available' : ''}</button>
    {open && <section className="updates-panel" aria-label="App updates">
      <strong>RegionDesk updates</strong>
      <p role="status">{state.message}</p>
      {state.status === 'downloading' && <progress aria-label="Update download" value={state.progress || 0} max={100} />}
      <button className="button secondary" disabled={waiting || state.status === 'unsupported'} onClick={() => {
        const action = state.status === 'available' ? api.downloadUpdate : state.status === 'downloaded' ? api.installUpdate : api.checkForUpdates;
        void action().catch(() => {});
      }}>{waiting ? state.status === 'downloading' ? `Downloading ${state.progress || 0}%` : 'Please wait…' : label}</button>
      <small>Downloads from the official GitHub repository use your normal internet connection, separately from profile browsing.</small>
    </section>}
  </div>;
}
