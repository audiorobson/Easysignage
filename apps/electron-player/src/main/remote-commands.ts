/**
 * PR 5.11 — executor de comandos remotos no Electron player.
 *
 * A fila já existe no backend (`GET /device/commands/pending`,
 * `POST /device/commands/:id/ack`); o web-player faz o polling e delega a
 * execução aqui via `window.easysignage.commands` (ver `preload.ts`). Cada
 * handler recebe as dependências do Electron por injeção para poder ser
 * testado com duplos de `child_process`/`electron`.
 */
import { spawn, type ChildProcess } from 'node:child_process';

export type SpawnFn = typeof spawn;

export interface RestartPlayerDeps {
  relaunch: () => void;
  exit: (code?: number) => void;
}

/** Relança o processo do player (não o SO) — usado para aplicar atualizações/limpar estado. */
export function restartPlayer(deps: RestartPlayerDeps): void {
  deps.relaunch();
  deps.exit(0);
}

export interface ClearCacheDeps {
  clearCache: () => Promise<void>;
  clearStorageData: () => Promise<void>;
  reload: () => void;
}

export async function clearPlayerCache(deps: ClearCacheDeps): Promise<void> {
  await deps.clearCache();
  await deps.clearStorageData();
  deps.reload();
}

export interface OpenUrlDeps {
  loadURL: (url: string) => Promise<void>;
}

export async function openUrlInPlayer(
  deps: OpenUrlDeps,
  url: string
): Promise<void> {
  const trimmed = url?.trim() ?? '';
  if (!/^https?:\/\/\S+$/i.test(trimmed)) {
    throw new Error('URL inválido (use http:// ou https://)');
  }
  await deps.loadURL(trimmed);
}

/** `reboot_os`: reinicia o sistema operativo — não apenas o player. Usar com cautela. */
export function buildRebootCommand(
  platform: NodeJS.Platform
): { command: string; args: string[] } {
  if (platform === 'win32') return { command: 'shutdown', args: ['/r', '/t', '0'] };
  if (platform === 'darwin') return { command: 'shutdown', args: ['-r', 'now'] };
  return { command: 'reboot', args: [] };
}

export function rebootOs(
  spawnFn: SpawnFn = spawn,
  platform: NodeJS.Platform = process.platform
): ChildProcess {
  const { command, args } = buildRebootCommand(platform);
  return spawnFn(command, args, { stdio: 'ignore', detached: true });
}

export interface CapturePageResult {
  toJPEG: (quality: number) => Buffer;
}

export interface CapturePageDeps {
  capturePage: () => Promise<CapturePageResult>;
}

const SCREENSHOT_JPEG_QUALITY = 70;

/** Captura toda a janela (independentemente do tipo de conteúdo) via `webContents.capturePage`. */
export async function captureScreenshotJpegBase64(
  deps: CapturePageDeps,
  quality = SCREENSHOT_JPEG_QUALITY
): Promise<string> {
  const image = await deps.capturePage();
  return image.toJPEG(quality).toString('base64');
}
