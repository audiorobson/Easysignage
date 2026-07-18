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

/**
 * PR 5.11 — executor de comandos remotos. O web-player faz o polling de
 * `GET /device/commands/pending` e delega a execução a estas funções;
 * o resultado é confirmado depois via `POST /device/commands/:id/ack`.
 */
async function restartPlayer(): Promise<void> {
  await ipcRenderer.invoke('commands:restartPlayer');
}

async function clearCache(): Promise<void> {
  await ipcRenderer.invoke('commands:clearCache');
}

async function openUrl(url: string): Promise<void> {
  await ipcRenderer.invoke('commands:openUrl', url);
}

async function rebootOs(): Promise<void> {
  await ipcRenderer.invoke('commands:rebootOs');
}

async function takeScreenshot(): Promise<{ base64: string; mime: string }> {
  return ipcRenderer.invoke('commands:takeScreenshot');
}

/**
 * PR 5.13 — auto-update. O web-player consulta a API (tem o device token) e
 * avisa o main process quando há uma versão mais recente compatível.
 */
async function notifyUpdateAvailable(release: {
  version: string;
  channel: string;
  downloadUrl?: string | null;
}): Promise<void> {
  await ipcRenderer.invoke('updater:notifyAvailable', release);
}

contextBridge.exposeInMainWorld('easysignage', {
  platform: process.platform,
  rtsp: {
    play: rtspPlay,
    stop: rtspStop,
  },
  commands: {
    restartPlayer,
    clearCache,
    openUrl,
    rebootOs,
    takeScreenshot,
  },
  updater: {
    notifyUpdateAvailable,
  },
});
