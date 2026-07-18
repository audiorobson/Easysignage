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
import { isKioskModeEnabled, RendererWatchdog } from './watchdog';

/** Mesma UI do web-player (Vite). Ex.: `WEB_PLAYER_URL=http://localhost:5173 pnpm exec electron .` */
function playerUrl(): string {
  return process.env.WEB_PLAYER_URL?.trim() || 'http://localhost:3010';
}

const rtspBridge = new RtspBridgeMain();
const kioskMode = isKioskModeEnabled();
let mainWindow: BrowserWindow | null = null;

/**
 * PR 5.12 — watchdog do renderer. Um mini PC de sinalização normalmente não tem
 * alguém a olhar para o ecrã; se o renderer travar, o player deve recuperar-se
 * sozinho (recriar a janela) em vez de ficar preto indefinidamente.
 */
const watchdog = new RendererWatchdog({
  reload: () => mainWindow?.reload(),
  recreateWindow: () => {
    mainWindow?.destroy();
    createWindow();
  },
  log: (message) => console.error(message),
});

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 720,
    fullscreen: kioskMode,
    kiosk: kioskMode,
    autoHideMenuBar: kioskMode,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  });
  win.loadURL(playerUrl());
  mainWindow = win;

  win.webContents.on('render-process-gone', (_event, details) => {
    watchdog.handleRendererGone(details.reason);
  });
  win.webContents.on('unresponsive', () => {
    watchdog.handleUnresponsive();
  });
  win.webContents.on('did-fail-load', (_event, errorCode, errorDescription) => {
    if (errorCode === -3) return; // ERR_ABORTED — navegação cancelada (ex.: open_url seguido de outro loadURL)
    watchdog.handleLoadFailed(errorDescription, () => win.loadURL(playerUrl()));
  });

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
