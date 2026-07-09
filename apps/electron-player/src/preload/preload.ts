import { contextBridge } from 'electron';

contextBridge.exposeInMainWorld('easysignage', {
  platform: process.platform,
});
