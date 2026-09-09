import { contextBridge, ipcRenderer, webUtils } from 'electron';

export interface PrepressApi {
  getSidecarState: () => Promise<any>;
  onSidecarState: (cb: (state: any) => void) => () => void;
  openPdf: () => Promise<Array<{ path: string; name: string; bytes: ArrayBuffer; size: number }>>;
  getPathForFile: (file: File) => string;
  savePdf: (defaultName?: string) => Promise<string | null>;
  readPdf: (path: string) => Promise<{ path: string; name: string; bytes: ArrayBuffer; size: number }>;
  tempPdfPath: () => Promise<string>;
  overwriteFile: (from: string, to: string) => Promise<void>;
  readImposeProfiles: () => Promise<{ last: any; profiles: any[] }>;
  writeImposeProfiles: (data: { last?: any; profiles: any[] }) => Promise<void>;
  exportImposeProfiles: (profiles: any[]) => Promise<boolean>;
  importImposeProfiles: () => Promise<any[] | null>;
  openTextFile: () => Promise<{ path: string; name: string; text: string } | null>;
  readBonPresets: () => Promise<{ presets: any[] }>;
  writeBonPresets: (data: { presets: any[] }) => Promise<void>;
  saveBonFile: (srcPath: string) => Promise<string>;
  engineRequest: (endpoint: string, body?: any) => Promise<any>;
  engineBlob: (endpoint: string, body?: any) => Promise<ArrayBuffer>;
  onMenuAction: (cb: (action: string) => void) => () => void;
  recentGet: () => Promise<any[]>;
  recentAdd: (path: string) => Promise<any[]>;
  recentClear: () => Promise<void>;
  onOpenRecent: (cb: (path: string) => void) => () => void;
  notifyReady: () => void;
}

const api: PrepressApi = {
  getSidecarState: () => ipcRenderer.invoke('sidecar:getState'),
  onSidecarState: (cb) => {
    const listener = (_e: any, state: any) => cb(state);
    ipcRenderer.on('sidecar:stateChanged', listener);
    return () => ipcRenderer.removeListener('sidecar:stateChanged', listener);
  },
  openPdf: () => ipcRenderer.invoke('dialog:openPdf'),
  // Electron 32+ removed the non-standard File.path property. webUtils is the
  // supported way to recover a native path for files dropped into a renderer.
  getPathForFile: (file) => webUtils.getPathForFile(file),
  savePdf: (defaultName) => ipcRenderer.invoke('dialog:savePdf', defaultName),
  readPdf: (path) => ipcRenderer.invoke('file:readPdf', path),
  tempPdfPath: () => ipcRenderer.invoke('file:tempPdfPath'),
  overwriteFile: (from, to) => ipcRenderer.invoke('file:overwrite', from, to),
  readImposeProfiles: () => ipcRenderer.invoke('impose:readProfiles'),
  writeImposeProfiles: (data) => ipcRenderer.invoke('impose:writeProfiles', data),
  exportImposeProfiles: (profiles) => ipcRenderer.invoke('impose:exportProfiles', profiles),
  importImposeProfiles: () => ipcRenderer.invoke('impose:importProfiles'),
  openTextFile: () => ipcRenderer.invoke('dialog:openTextFile'),
  readBonPresets: () => ipcRenderer.invoke('bon:readPresets'),
  writeBonPresets: (data) => ipcRenderer.invoke('bon:writePresets', data),
  saveBonFile: (src) => ipcRenderer.invoke('bon:saveFile', src),
  engineRequest: (endpoint, body) => ipcRenderer.invoke('engine:request', endpoint, body),
  engineBlob: (endpoint, body) => ipcRenderer.invoke('engine:blob', endpoint, body),
  onMenuAction: (cb) => {
    const listener = (_e: any, action: string) => cb(action);
    ipcRenderer.on('menu:action', listener);
    return () => ipcRenderer.removeListener('menu:action', listener);
  },
  recentGet: () => ipcRenderer.invoke('recent:get'),
  recentAdd: (path) => ipcRenderer.invoke('recent:add', path),
  recentClear: () => ipcRenderer.invoke('recent:clear'),
  onOpenRecent: (cb) => {
    const listener = (_e: any, path: string) => cb(path);
    ipcRenderer.on('menu:openRecent', listener);
    return () => ipcRenderer.removeListener('menu:openRecent', listener);
  },
  notifyReady: () => ipcRenderer.send('app:rendererReady')
};

contextBridge.exposeInMainWorld('api', api);
