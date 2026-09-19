import { contextBridge, ipcRenderer } from 'electron';
import type { AppState, Bounds, ProfileInput, RegionDeskAPI } from '../shared/types';
const api: RegionDeskAPI = {
  reopenTab: () => ipcRenderer.invoke('tabs:reopen'),
  toggleBookmark: (url, title) => ipcRenderer.invoke('bookmarks:toggle', url, title),
  findInPage: (text, forward) => ipcRenderer.invoke('browser:find', text, forward),
  getState: () => ipcRenderer.invoke('state:get'),
  saveProfile: (profile: ProfileInput) => ipcRenderer.invoke('profile:save', profile),
  createProfile: () => ipcRenderer.invoke('profile:create'),
  selectProfile: (id: string) => ipcRenderer.invoke('profile:select', id),
  deleteProfile: (id: string) => ipcRenderer.invoke('profile:delete', id),
  verify: () => ipcRenderer.invoke('connection:verify'),
  disconnect: () => ipcRenderer.invoke('connection:disconnect'),
  navigate: (url: string) => ipcRenderer.invoke('browser:navigate', url),
  browserAction: action => ipcRenderer.invoke('browser:action', action),
  newTab: url => ipcRenderer.invoke('tabs:new', url),
  selectTab: id => ipcRenderer.invoke('tabs:select', id),
  closeTab: id => ipcRenderer.invoke('tabs:close', id),
  moveTab: (id, direction) => ipcRenderer.invoke('tabs:move', id, direction),
  reorderTab: (id, targetId) => ipcRenderer.invoke('tabs:reorder', id, targetId),
  openWorkspace: screen => ipcRenderer.invoke('workspace:open', screen),
  clearHistory: () => ipcRenderer.invoke('history:clear'),
  removeHistory: url => ipcRenderer.invoke('history:remove', url),
  onBrowserCommand: callback => { const handler = (_event: Electron.IpcRendererEvent, command: 'address' | 'history' | 'permissions') => callback(command); ipcRenderer.on('browser:command', handler); return () => ipcRenderer.removeListener('browser:command', handler); },
  setBrowserBounds: (bounds: Bounds | null) => ipcRenderer.invoke('browser:bounds', bounds),
  inspectBrowser: () => ipcRenderer.invoke('browser:inspect'),
  clearSession: () => ipcRenderer.invoke('session:clear'),
  confirmDiscard: () => ipcRenderer.invoke('draft:confirm-discard'),
  exportReport: () => ipcRenderer.invoke('report:export'),
  openProvider: provider => ipcRenderer.invoke('provider:open', provider),
  onState: callback => { const handler = (_event: Electron.IpcRendererEvent, state: AppState) => callback(state); ipcRenderer.on('state:update', handler); return () => ipcRenderer.removeListener('state:update', handler); }
};
contextBridge.exposeInMainWorld('regiondesk', api);
