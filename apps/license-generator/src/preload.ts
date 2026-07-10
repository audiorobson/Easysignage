import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('licenseGen', {
  generate: (input: {
    hwid: string;
    tier: string;
    customer?: string;
    expiresAt?: string | null;
  }) => ipcRenderer.invoke('generate-license', input),
});
