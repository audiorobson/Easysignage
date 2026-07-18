import { contextBridge, ipcRenderer } from 'electron';

/**
 * Ponte para o web-player (Fase 5.C, PR 5.10 — RTSP nativo via ffmpeg).
 *
 * `play()` pede ao processo main para abrir um URL HTTP local (fMP4 gerado por
 * ffmpeg a partir do RTSP de origem) e aponta o `<video>` do renderer para
 * esse URL — o elemento `<video>` é passado como referência through o
 * contextBridge (mesmo processo/renderer, apenas mundos isolados), por isso
 * dá para atribuir `.src` diretamente sem serializar o nó DOM por IPC.
 */
async function rtspPlay(url: string, videoElement: HTMLVideoElement): Promise<void> {
  const { streamUrl } = await ipcRenderer.invoke('rtsp:start', url);
  videoElement.src = streamUrl;
  await videoElement.play();
}

function rtspStop(url: string): void {
  ipcRenderer.send('rtsp:stop', url);
}

contextBridge.exposeInMainWorld('easysignage', {
  platform: process.platform,
  rtsp: {
    play: rtspPlay,
    stop: rtspStop,
  },
});
