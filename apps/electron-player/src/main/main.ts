import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'node:path';
import { RtspBridgeMain } from './rtsp-bridge';

/** Mesma UI do web-player (Vite). Ex.: `WEB_PLAYER_URL=http://localhost:5173 pnpm exec electron .` */
function playerUrl(): string {
  return process.env.WEB_PLAYER_URL?.trim() || 'http://localhost:3010';
}

const rtspBridge = new RtspBridgeMain();

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 720,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  });
  win.loadURL(playerUrl());
}

/** PR 5.10 — bridge RTSP nativo (ffmpeg → fMP4 servido por HTTP local). */
ipcMain.handle('rtsp:start', async (_event, rtspUrl: string) => {
  return rtspBridge.start(rtspUrl);
});

ipcMain.on('rtsp:stop', (_event, rtspUrl: string) => {
  rtspBridge.stopByUrl(rtspUrl);
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
