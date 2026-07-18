/**
 * PR 5.11 — executor de comandos remotos no web-player.
 *
 * Faz polling de `GET /device/commands/pending`, delega a execução ao bridge
 * nativo (`window.easysignage.commands`, ver `easysignage-bridge.ts`) quando
 * disponível — com fallback razoável em browser puro para os canais que não
 * exigem privilégios de SO — e confirma o resultado via
 * `POST /device/commands/:id/ack`.
 */
import './easysignage-bridge';
import type {
  DeviceCommandAckPayload,
  PendingDeviceCommand,
} from '@easysignage/device-protocol';

export type RemoteCommandResult = {
  status: 'acked' | 'failed';
  result?: Record<string, unknown>;
};

export type RemoteCommandDeps = {
  apiBase: string;
  getToken: () => string | null;
  /** Fallback de captura de tela para quando não há bridge nativo (Electron). */
  captureFallback?: () => Promise<Blob | null>;
  onExecuted?: (cmd: PendingDeviceCommand, result: RemoteCommandResult) => void;
};

function authHeaders(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}` };
}

export async function fetchPendingCommands(
  apiBase: string,
  token: string
): Promise<PendingDeviceCommand[]> {
  try {
    const res = await fetch(`${apiBase}/device/commands/pending`, {
      headers: authHeaders(token),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { commands?: PendingDeviceCommand[] };
    return data.commands ?? [];
  } catch {
    return [];
  }
}

export async function ackCommand(
  apiBase: string,
  token: string,
  commandId: string,
  payload: DeviceCommandAckPayload
): Promise<void> {
  try {
    await fetch(`${apiBase}/device/commands/${commandId}/ack`, {
      method: 'POST',
      headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch {
    /* melhor esforço — o comando fica pendente e será reprocessado no próximo poll do CMS */
  }
}

async function uploadPreviewBlob(
  apiBase: string,
  token: string,
  blob: Blob
): Promise<void> {
  const fd = new FormData();
  fd.append('file', blob, 'preview.jpg');
  await fetch(`${apiBase}/device/preview`, {
    method: 'POST',
    headers: authHeaders(token),
    body: fd,
  });
}

function base64ToBlob(base64: string, mime: string): Blob {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

async function clearBrowserCaches(): Promise<void> {
  try {
    localStorage.removeItem('device_asset_cache');
  } catch {
    /* ignore */
  }
  if (typeof caches !== 'undefined') {
    try {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    } catch {
      /* ignore */
    }
  }
}

export async function executeRemoteCommand(
  cmd: PendingDeviceCommand,
  deps: RemoteCommandDeps
): Promise<RemoteCommandResult> {
  const bridge = window.easysignage?.commands;
  const payload = cmd.payloadJson ?? {};

  try {
    switch (cmd.channel) {
      case 'restart_player': {
        if (bridge?.restartPlayer) {
          await bridge.restartPlayer();
        } else {
          window.setTimeout(() => window.location.reload(), 250);
        }
        return { status: 'acked' };
      }

      case 'clear_cache': {
        if (bridge?.clearCache) {
          await bridge.clearCache();
        } else {
          await clearBrowserCaches();
          window.setTimeout(() => window.location.reload(), 250);
        }
        return { status: 'acked' };
      }

      case 'open_url': {
        const url = typeof payload['url'] === 'string' ? payload['url'] : '';
        if (!url) {
          return { status: 'failed', result: { error: 'payload.url ausente' } };
        }
        if (bridge?.openUrl) {
          await bridge.openUrl(url);
        } else {
          window.open(url, '_blank', 'noopener,noreferrer');
        }
        return { status: 'acked' };
      }

      case 'reboot_os': {
        if (bridge?.rebootOs) {
          await bridge.rebootOs();
          return { status: 'acked' };
        }
        return {
          status: 'failed',
          result: { error: 'reboot_os requer o player nativo (Electron)' },
        };
      }

      case 'take_screenshot': {
        let blob: Blob | null = null;
        if (bridge?.takeScreenshot) {
          const shot = await bridge.takeScreenshot();
          blob = base64ToBlob(shot.base64, shot.mime);
        } else if (deps.captureFallback) {
          blob = await deps.captureFallback();
        }
        if (!blob) {
          return {
            status: 'failed',
            result: { error: 'Sem conteúdo disponível para captura' },
          };
        }
        const token = deps.getToken();
        if (!token) return { status: 'failed', result: { error: 'Sem token' } };
        await uploadPreviewBlob(deps.apiBase, token, blob);
        return { status: 'acked', result: { previewUploaded: true } };
      }

      default:
        return {
          status: 'failed',
          result: { error: `Canal desconhecido: ${cmd.channel}` },
        };
    }
  } catch (e) {
    return {
      status: 'failed',
      result: { error: e instanceof Error ? e.message : 'Falha desconhecida' },
    };
  }
}

/** Faz um ciclo de poll + execução + ack; devolve quantos comandos foram processados. */
export async function pollAndExecuteCommands(
  deps: RemoteCommandDeps
): Promise<number> {
  const token = deps.getToken();
  if (!token) return 0;

  const commands = await fetchPendingCommands(deps.apiBase, token);
  for (const cmd of commands) {
    const result = await executeRemoteCommand(cmd, deps);
    deps.onExecuted?.(cmd, result);
    await ackCommand(deps.apiBase, token, cmd.id, result);
  }
  return commands.length;
}

/** Inicia o loop de polling periódico; devolve função de cleanup. */
export function startRemoteCommandsLoop(
  deps: RemoteCommandDeps,
  intervalMs = 5_000
): () => void {
  let stopped = false;
  let running = false;
  const tick = () => {
    if (stopped || running) return;
    running = true;
    void pollAndExecuteCommands(deps)
      .catch(() => {})
      .finally(() => {
        running = false;
      });
  };
  const id = window.setInterval(tick, intervalMs);
  tick();
  return () => {
    stopped = true;
    window.clearInterval(id);
  };
}
