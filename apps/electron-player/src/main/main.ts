import { app, BrowserWindow } from 'electron';
import path from 'node:path';

/** Mesma UI do web-player (Vite). Ex.: `WEB_PLAYER_URL=http://localhost:5173 pnpm exec electron .` */
function playerUrl(): string {
  return process.env.WEB_PLAYER_URL?.trim() || 'http://localhost:5173';
}

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

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
