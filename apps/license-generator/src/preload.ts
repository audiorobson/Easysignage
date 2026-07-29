import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('licenseGen', {
  getKeyStatus: () => ipcRenderer.invoke('get-key-status'),
  loadPrivateKeyFile: () => ipcRenderer.invoke('load-private-key-file'),
  clearSessionKey: () => ipcRenderer.invoke('clear-session-key'),
  generate: (input: {
    hwid: string;
    tier: string;
    customer?: string;
    notes?: string;
    expiresAt?: string | null;
  }) => ipcRenderer.invoke('generate-license', input),
});
