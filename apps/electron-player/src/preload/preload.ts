import { contextBridge } from 'electron';

/**
 * Ponte para o web-player. RTSP: implementar `rtsp.play` com decoder nativo
 * (ex.: ffmpeg → canvas ou elemento video) quando o electron-player estiver pronto.
 */
contextBridge.exposeInMainWorld('easysignage', {
  platform: process.platform,
});
