/**
 * PR 5.13 — auto-update do Electron player (parte nativa).
 *
 * O web-player deteta a nova versão consultando a API (device token só existe
 * lá) e delega aqui via IPC (`updater:notifyAvailable`) quando encontra algo
 * mais recente. `electron-updater` continua sem "feed" configurado enquanto
 * não existir uma pipeline real de releases assinadas (ver Fase 10, PR 10.4 —
 * GHCR); por isso a integração é defensiva: nunca deve derrubar o player se o
 * feed não estiver disponível.
 */
import type { AppUpdater } from 'electron-updater';

export interface UpdateAvailableInfo {
  version: string;
  channel: string;
  downloadUrl?: string | null;
}

export interface AutoUpdaterDeps {
  isPackaged: boolean;
  log?: (message: string) => void;
}

/**
 * Configura o feed do `electron-updater` a partir de `downloadUrl` (URL do
 * instalador/artefacto publicado) e pede a verificação. Fora de uma build
 * empacotada (`app.isPackaged === false`), não faz nada — `electron-updater`
 * lança erro em dev por não haver `app-update.yml`.
 */
export async function handleUpdateAvailable(
  info: UpdateAvailableInfo,
  updater: AppUpdater,
  deps: AutoUpdaterDeps
): Promise<{ attempted: boolean }> {
  deps.log?.(
    `[auto-updater] update disponível: v${info.version} (canal ${info.channel})`
  );

  if (!deps.isPackaged) {
    deps.log?.('[auto-updater] a correr fora de build empacotada — a ignorar');
    return { attempted: false };
  }

  const feedUrl = info.downloadUrl?.trim();
  if (!feedUrl) {
    deps.log?.('[auto-updater] release sem downloadUrl — nada para verificar');
    return { attempted: false };
  }

  try {
    updater.setFeedURL({ provider: 'generic', url: feedUrl });
    await updater.checkForUpdates();
    return { attempted: true };
  } catch (e) {
    deps.log?.(
      `[auto-updater] falha ao verificar/aplicar update: ${
        e instanceof Error ? e.message : String(e)
      }`
    );
    return { attempted: false };
  }
}
