import { contextBridge, ipcRenderer } from 'electron';
import type { AppState, Bounds, ProfileInput, RegionDeskAPI } from '../shared/types';
const api: RegionDeskAPI = {
  getState: () => ipcRenderer.invoke('state:get'),
  saveProfile: (profile: ProfileInput) => ipcRenderer.invoke('profile:save', profile),
  createProfile: () => ipcRenderer.invoke('profile:create'),
  selectProfile: (id: string) => ipcRenderer.invoke('profile:select', id),
  deleteProfile: (id: string) => ipcRenderer.invoke('profile:delete', id),
  verify: () => ipcRenderer.invoke('connection:verify'),
  disconnect: () => ipcRenderer.invoke('connection:disconnect'),
  navigate: (url: string) => ipcRenderer.invoke('browser:navigate', url),
  browserAction: action => ipcRenderer.invoke('browser:action', action),
  setBrowserBounds: (bounds: Bounds | null) => ipcRenderer.invoke('browser:bounds', bounds),
  inspectBrowser: () => ipcRenderer.invoke('browser:inspect'),
  clearSession: () => ipcRenderer.invoke('session:clear'),
  confirmDiscard: () => ipcRenderer.invoke('draft:confirm-discard'),
  exportReport: () => ipcRenderer.invoke('report:export'),
  openProvider: provider => ipcRenderer.invoke('provider:open', provider),
  onState: callback => { const handler = (_event: Electron.IpcRendererEvent, state: AppState) => callback(state); ipcRenderer.on('state:update', handler); return () => ipcRenderer.removeListener('state:update', handler); }
};
contextBridge.exposeInMainWorld('regiondesk', api);
