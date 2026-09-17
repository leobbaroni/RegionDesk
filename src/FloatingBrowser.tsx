import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, History, LockKeyhole, Maximize2, Minus, PanelBottomClose, Plus, RefreshCw, Settings2, X } from 'lucide-react';
import type { AppState, BrowserAction } from '../shared/types';
import TabStrip from './TabStrip';

export default function FloatingBrowser() {
  const [data, setData] = useState<AppState | null>(null);
  const [address, setAddress] = useState('');
  const [focused, setFocused] = useState(false);
  const [index, setIndex] = useState(-1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const guest = useRef<HTMLDivElement>(null), input = useRef<HTMLInputElement>(null);
  const api = window.regiondesk!;
  const runtime = data?.runtime, ready = runtime?.status === 'ready';
  const profile = data?.profiles.find(p => p.id === data.activeId);
  const suggestions = (data?.browsing?.history || []).filter(entry => `${entry.title} ${entry.url}`.toLowerCase().includes(address.trim().toLowerCase())).slice(0, 6);
  const showSuggestions = focused && ready && suggestions.length > 0;
  const run = useCallback(async (fn: () => Promise<unknown>) => {
    setBusy(true); setError('');
    try { const result = await fn(); if (result && typeof result === 'object' && 'profiles' in result) setData(result as AppState); }
    catch (e) { setError(e instanceof Error ? e.message.replace(/^Error invoking remote method '[^']+': Error: /, '') : 'The action failed. Try again.'); }
    finally { setBusy(false); }
  }, []);
  const action = (value: BrowserAction) => void run(() => api.browserAction(value));
  const focusAddress = () => { input.current?.focus(); input.current?.select(); };
  useEffect(() => { void run(() => api.getState()); return api.onState(setData); }, []);
  useEffect(() => { setAddress(runtime?.url || ''); setFocused(false); setIndex(-1); }, [runtime?.url, data?.browsing?.activeTabId]);
  useEffect(() => api.onBrowserCommand(command => { if (command === 'address') focusAddress(); }), []);
  useEffect(() => {
    if (!ready || !runtime?.url || showSuggestions) { void api.setBrowserBounds(null); return; }
    const update = () => { const rect = guest.current?.getBoundingClientRect(); if (rect) void api.setBrowserBounds({ x: rect.x, y: rect.y, width: rect.width, height: rect.height }); };
    const observer = new ResizeObserver(update); if (guest.current) observer.observe(guest.current);
    window.addEventListener('resize', update); update();
    return () => { observer.disconnect(); window.removeEventListener('resize', update); void api.setBrowserBounds(null); };
  }, [ready, runtime?.url, data?.browsing?.activeTabId, showSuggestions]);
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase(), ctrl = event.ctrlKey || event.metaKey;
      if (key === 'f11' || key === 'escape' && runtime?.fullscreen) { event.preventDefault(); action('fullscreen'); }
      if (key === 'escape') setFocused(false);
      if (!ctrl) return;
      if (['l', 't', 'w', 'tab', 'r', 'h', '+', '=', '-', '0'].includes(key)) event.preventDefault();
      if (key === 'l') focusAddress();
      if (key === 't') void run(() => api.newTab());
      if (key === 'w' && data?.browsing) void run(() => api.closeTab(data.browsing!.activeTabId));
      if (key === 'tab' && data?.browsing) { const { tabs, activeTabId } = data.browsing; const i = tabs.findIndex(t => t.id === activeTabId); void run(() => api.selectTab(tabs[(i + (event.shiftKey ? -1 : 1) + tabs.length) % tabs.length].id)); }
      if (key === 'r') action('reload');
      if (key === 'h') void run(() => api.openWorkspace('history'));
      if (['+', '=', '-', '0'].includes(key)) action(key === '0' ? 'zoom-reset' : key === '-' ? 'zoom-out' : 'zoom-in');
    };
    window.addEventListener('keydown', key); return () => window.removeEventListener('keydown', key);
  }, [data?.browsing, runtime?.fullscreen]);
  const navigate = (url: string) => { setFocused(false); input.current?.blur(); void run(() => api.navigate(url)); };
  if (!data) return <div className="floating-loading" role="status">{error || 'Opening browser…'}</div>;
  return <main className="floating-browser" aria-label="Profile browser">
    <TabStrip browsing={data.browsing} busy={busy} run={run} />
    <div className="browser-toolbar">
      <div className="browser-arrows">
        <button aria-label="Go back" disabled={!ready || !runtime?.canGoBack} onClick={() => action('back')}><ArrowLeft size={16} /></button>
        <button aria-label="Go forward" disabled={!ready || !runtime?.canGoForward} onClick={() => action('forward')}><ArrowRight size={16} /></button>
        <button aria-label={runtime?.loading ? 'Stop loading' : 'Reload'} disabled={!ready || !runtime?.url} onClick={() => action(runtime?.loading ? 'stop' : 'reload')}>{runtime?.loading ? <X size={16} /> : <RefreshCw size={16} />}</button>
      </div>
      <form className="address-bar" onSubmit={event => { event.preventDefault(); const url = showSuggestions && index >= 0 ? suggestions[index]?.url : address; if (url?.trim()) navigate(url); }}>
        <LockKeyhole size={13} /><input ref={input} aria-label="Website address" role="combobox" aria-autocomplete="list" aria-expanded={showSuggestions} aria-controls={showSuggestions ? 'floating-suggestions' : undefined} aria-activedescendant={showSuggestions && index >= 0 ? `floating-suggestion-${index}` : undefined} value={address} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} onChange={event => { setAddress(event.target.value); setFocused(true); setIndex(-1); }} onKeyDown={event => { if (showSuggestions && ['ArrowDown', 'ArrowUp'].includes(event.key)) { event.preventDefault(); setIndex(i => (i + (event.key === 'ArrowDown' ? 1 : -1) + suggestions.length) % suggestions.length); } }} disabled={!ready} autoComplete="off" spellCheck={false} placeholder="Enter an HTTPS website" /><kbd>Ctrl L</kbd>
      </form>
      <button className="toolbar-icon" aria-label="Return to workspace" title="Return to workspace" onClick={() => action('dock')}><PanelBottomClose size={17} /></button>
    </div>
    <div className="browser-controls">
      <span className="floating-profile" title={`${profile?.name} · ${profile?.timezone}`}>{profile?.country} · {profile?.name}</span>
      <div className="zoom-controls"><button aria-label="Zoom out" disabled={!ready} onClick={() => action('zoom-out')}><Minus size={14} /></button><button aria-label="Reset page zoom" disabled={!ready} onClick={() => action('zoom-reset')}>{Math.round((runtime?.zoom || 1) * 100)}%</button><button aria-label="Zoom in" disabled={!ready} onClick={() => action('zoom-in')}><Plus size={14} /></button></div>
      <button onClick={() => action('fullscreen')}><Maximize2 size={14} />{runtime?.fullscreen ? 'Exit full screen' : 'Full screen'}</button>
      <button onClick={() => void run(() => api.openWorkspace('history'))}><History size={14} />History</button>
      <button onClick={() => void run(() => api.openWorkspace('permissions'))}><Settings2 size={14} />Permissions</button>
    </div>
    {showSuggestions && <div className="address-suggestions" id="floating-suggestions" role="listbox" aria-label="Address suggestions">{suggestions.map((entry, i) => <button key={entry.url} id={`floating-suggestion-${i}`} role="option" aria-selected={i === index} tabIndex={-1} onMouseDown={event => event.preventDefault()} onClick={() => navigate(entry.url)}><History size={14} /><span><strong>{entry.title}</strong><small>{entry.url}</small></span></button>)}</div>}
    {error && <div className="floating-error" role="alert"><span>{error}</span><button aria-label="Dismiss error" onClick={() => setError('')}><X size={15} /></button></div>}
    <div className="floating-page" ref={guest}>{!runtime?.url && <div className="floating-new-tab"><h1>New tab</h1><p>Enter a website above to browse with {profile?.name}.</p><button className="button secondary" onClick={focusAddress}>Enter an address</button></div>}</div>
  </main>;
}
