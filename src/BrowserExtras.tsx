import { useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, Search, Star, Undo2, X } from 'lucide-react';
import type { AppState } from '../shared/types';

export default function BrowserExtras({ data, busy, run }: { data: AppState; busy: boolean; run: (fn: () => Promise<unknown>) => void }) {
  const api = window.regiondesk;
  const [finding, setFinding] = useState(false);
  const [text, setText] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const ready = data.runtime.status === 'ready';
  const bookmarks = data.browsing?.bookmarks || [];
  const saved = bookmarks.some(entry => entry.url === data.runtime.url);
  const showFind = () => { setFinding(true); setTimeout(() => input.current?.focus(), 0); };
  const closeFind = () => { setFinding(false); setText(''); void api?.findInPage(''); };
  useEffect(() => api?.onBrowserCommand(command => { if (command === 'find') showFind(); }), [api]);
  useEffect(() => { setFinding(false); setText(''); }, [data.activeId, data.browsing?.activeTabId]);
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'f' && ready) { event.preventDefault(); showFind(); }
      if (event.key === 'Escape' && finding) closeFind();
    };
    window.addEventListener('keydown', key); return () => window.removeEventListener('keydown', key);
  }, [ready, finding, api]);
  return <>
    <div className="bookmark-bar" aria-label="Bookmarks and page tools">
      <button title={saved ? 'Remove bookmark' : 'Bookmark this page'} aria-label={saved ? 'Remove bookmark' : 'Bookmark this page'} disabled={!ready || !data.runtime.url || busy} onClick={() => run(() => api!.toggleBookmark(data.runtime.url, data.runtime.title))}><Star size={15} fill={saved ? 'currentColor' : 'none'} /></button>
      <div className="bookmark-items"><button disabled={!ready || busy} onClick={() => run(() => api!.newTab('https://www.tiktok.com/'))}>TikTok</button><button disabled={!ready || busy} onClick={() => run(() => api!.newTab('https://www.tiktok.com/tiktokstudio/upload'))}>Upload</button>{bookmarks.length ? bookmarks.map(entry => <span className="bookmark-item" key={entry.url}><button disabled={!ready || busy} title={entry.url} onClick={() => run(() => api!.newTab(entry.url))} onAuxClick={event => { if (event.button === 1 && ready) run(() => api!.newTab(entry.url)); }}>{entry.title}</button><button aria-label={`Remove bookmark ${entry.title}`} disabled={busy} onClick={() => run(() => api!.toggleBookmark(entry.url, entry.title))}><X size={11} /></button></span>) : <span className="bookmark-hint">Save your pages with the star.</span>}</div>
      <button aria-label="Reopen closed tab" title="Reopen closed tab (Ctrl Shift T)" disabled={!data.browsing?.closedTabs?.length || busy} onClick={() => run(() => api!.reopenTab())}><Undo2 size={15} /></button>
      <button aria-label="Find in page" title="Find in page (Ctrl F)" disabled={!ready || !data.runtime.url} onClick={showFind}><Search size={15} /></button>
    </div>
    {finding && <form className="find-bar" onSubmit={event => { event.preventDefault(); run(() => api!.findInPage(text)); }}><input ref={input} aria-label="Find text" value={text} placeholder="Find in page" maxLength={500} onChange={event => { setText(event.target.value); run(() => api!.findInPage(event.target.value)); }} /><span aria-live="polite">{data.runtime.find ? `${data.runtime.find.active} of ${data.runtime.find.matches}` : 'Type to search'}</span><button type="button" aria-label="Previous match" disabled={!text} onClick={() => run(() => api!.findInPage(text, false))}><ArrowUp size={14} /></button><button type="submit" aria-label="Next match" disabled={!text}><ArrowDown size={14} /></button><button type="button" aria-label="Close find" onClick={closeFind}><X size={14} /></button></form>}
  </>;
}
