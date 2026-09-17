import { useEffect, useRef, useState } from 'react';
import { Globe2, LoaderCircle, Plus, X } from 'lucide-react';
import type { BrowsingState } from '../shared/types';

export default function TabStrip({ browsing, busy, run }: { browsing?: BrowsingState; busy: boolean; run: (fn: () => Promise<unknown>) => unknown }) {
  const tabs = browsing?.tabs || [];
  const [dragged, setDragged] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const list = useRef<HTMLDivElement>(null);
  useEffect(() => { list.current?.querySelector('[aria-selected=true]')?.scrollIntoView({ block: 'nearest', inline: 'nearest' }); }, [browsing?.activeTabId]);
  const reset = () => { setDragged(null); setOver(null); };
  return <div className="tab-strip"><div className="tab-list" role="tablist" aria-label="Browser tabs" ref={list}>
    {tabs.map((tab, index) => <div key={tab.id} data-tab-id={tab.id} className={`browser-tab ${tab.id === browsing?.activeTabId ? 'selected' : ''} ${dragged === tab.id ? 'dragging' : ''} ${over === tab.id && dragged !== tab.id ? 'drop-target' : ''}`}
      draggable onDragStart={event => { event.dataTransfer.setData('application/x-regiondesk-tab', tab.id); event.dataTransfer.effectAllowed = 'move'; setDragged(tab.id); }}
      onDragEnd={reset} onDragOver={event => { if (!event.dataTransfer.types.includes('application/x-regiondesk-tab')) return; event.preventDefault(); event.dataTransfer.dropEffect = 'move'; setOver(tab.id); const parent = list.current; if (parent) { const rect = parent.getBoundingClientRect(); if (event.clientX > rect.right - 35) parent.scrollLeft += 25; else if (event.clientX < rect.left + 35) parent.scrollLeft -= 25; } }}
      onDragLeave={() => setOver(null)} onDrop={event => { event.preventDefault(); const id = event.dataTransfer.getData('application/x-regiondesk-tab'); reset(); if (id !== tab.id && tabs.some(t => t.id === id)) void run(() => window.regiondesk!.reorderTab(id, tab.id)); }}>
      <button role="tab" aria-selected={tab.id === browsing?.activeTabId} title={`${tab.url || 'New tab'} — drag to reorder`} onClick={() => void run(() => window.regiondesk!.selectTab(tab.id))}
        onKeyDown={event => { if (!['ArrowRight', 'ArrowLeft'].includes(event.key)) return; event.preventDefault(); const direction = event.key === 'ArrowRight' ? 1 : -1; if (event.shiftKey) void run(() => window.regiondesk!.moveTab(tab.id, direction === 1 ? 'right' : 'left')); else { const next = tabs[(index + direction + tabs.length) % tabs.length]; void run(() => window.regiondesk!.selectTab(next.id)); list.current?.querySelector<HTMLButtonElement>(`[data-tab-id="${next.id}"] [role=tab]`)?.focus(); } }}>
        {tab.loading ? <LoaderCircle size={12} className="spin" /> : <Globe2 size={12} />}<span>{tab.title || 'New tab'}</span>{!tab.loaded && tab.url && <small>Saved</small>}
      </button><button className="tab-close" aria-label={`Close tab ${index + 1}`} title="Close tab (Ctrl W)" onClick={() => void run(() => window.regiondesk!.closeTab(tab.id))}><X size={12} /></button>
    </div>)}
  </div><button className="new-tab" aria-label="New tab" title="New tab (Ctrl T)" disabled={busy || tabs.length >= 32} onClick={() => void run(() => window.regiondesk!.newTab())}><Plus size={16} /></button></div>;
}
