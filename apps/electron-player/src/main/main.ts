import { app, BrowserWindow, ipcMain, session } from 'electron';
import path from 'node:path';
import { RtspBridgeMain } from './rtsp-bridge';
import {
  captureScreenshotJpegBase64,
  clearPlayerCache,
  openUrlInPlayer,
  rebootOs,
  restartPlayer,
} from './remote-commands';

/** Mesma UI do web-player (Vite). Ex.: `WEB_PLAYER_URL=http://localhost:5173 pnpm exec electron .` */
function playerUrl(): string {
  return process.env.WEB_PLAYER_URL?.trim() || 'http://localhost:3010';
}

const rtspBridge = new RtspBridgeMain();
let mainWindow: BrowserWindow | null = null;

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 720,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  });
  win.loadURL(playerUrl());
  mainWindow = win;
  win.on('closed', () => {
    if (mainWindow === win) mainWindow = null;
  });
}

/** PR 5.10 — bridge RTSP nativo (ffmpeg → fMP4 servido por HTTP local). */
ipcMain.handle('rtsp:start', async (_event, rtspUrl: string) => {
  return rtspBridge.start(rtspUrl);
});

ipcMain.on('rtsp:stop', (_event, rtspUrl: string) => {
  rtspBridge.stopByUrl(rtspUrl);
});

/**
 * PR 5.11 — executor de comandos remotos (fila em `GET /device/commands/pending`).
 * O web-player faz o polling e delega a execução via `window.easysignage.commands`.
 */
ipcMain.handle('commands:restartPlayer', async () => {
  restartPlayer({ relaunch: () => app.relaunch(), exit: (code) => app.exit(code) });
});

ipcMain.handle('commands:clearCache', async () => {
  await clearPlayerCache({
    clearCache: () => session.defaultSession.clearCache(),
    clearStorageData: () => session.defaultSession.clearStorageData(),
    reload: () => mainWindow?.reload(),
  });
});

ipcMain.handle('commands:openUrl', async (_event, url: string) => {
  await openUrlInPlayer(
    { loadURL: (u) => mainWindow?.loadURL(u) ?? Promise.resolve() },
    url
  );
});

ipcMain.handle('commands:rebootOs', async () => {
  rebootOs();
});

ipcMain.handle('commands:takeScreenshot', async () => {
  if (!mainWindow) throw new Error('Sem janela ativa para capturar');
  const base64 = await captureScreenshotJpegBase64({
    capturePage: () => mainWindow!.webContents.capturePage(),
  });
  return { base64, mime: 'image/jpeg' };
});

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  void rtspBridge.close();
});
