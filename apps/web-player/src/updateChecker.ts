/**
 * PR 5.13 — auto-update do Electron player.
 *
 * A comparação de versão/canal vive em `@easysignage/shared-types` (partilhada
 * com a API, que escolhe a release mais recente compatível — ver
 * `apps/api/src/releases`). Este módulo faz o polling (o device token só
 * existe aqui, no web-player) e, quando há update disponível, delega ao
 * bridge nativo (`window.easysignage.updater`, ver `easysignage-bridge.ts`)
 * para o Electron acionar o `electron-updater`. Em browser puro (sem bridge)
 * fica só o log — não há como instalar uma atualização de SO.
 */
import './easysignage-bridge';
import {
  shouldUpdateTo,
  type SoftwareReleaseChannel,
  type SoftwareReleaseSummary,
} from '@easysignage/shared-types';

export interface UpdateCheckDeps {
  apiBase: string;
  getToken: () => string | null;
  product?: string;
  channel?: SoftwareReleaseChannel;
  onUpdateAvailable?: (release: SoftwareReleaseSummary) => void;
}

export async function fetchLatestRelease(
  deps: UpdateCheckDeps
): Promise<SoftwareReleaseSummary | null> {
  const token = deps.getToken();
  if (!token) return null;
  const product = deps.product ?? 'electron-player';

  try {
    const res = await fetch(
      `${deps.apiBase}/device/releases/latest?product=${encodeURIComponent(product)}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!res.ok) return null;
    const data = (await res.json()) as { release?: SoftwareReleaseSummary | null };
    return data.release ?? null;
  } catch {
    return null;
  }
}

export interface UpdateCheckResult {
  shouldUpdate: boolean;
  release: SoftwareReleaseSummary | null;
}

export async function checkForUpdate(
  currentVersion: string,
  channel: SoftwareReleaseChannel,
  deps: UpdateCheckDeps
): Promise<UpdateCheckResult> {
  const release = await fetchLatestRelease(deps);
  return { shouldUpdate: shouldUpdateTo(currentVersion, channel, release), release };
}

const DEFAULT_CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;

/** Inicia o loop de verificação periódica; devolve função de cleanup. */
export function startUpdateCheckLoop(
  currentVersion: string,
  deps: UpdateCheckDeps,
  intervalMs = DEFAULT_CHECK_INTERVAL_MS
): () => void {
  let stopped = false;
  const channel = deps.channel ?? 'stable';

  const tick = () => {
    if (stopped) return;
    void checkForUpdate(currentVersion, channel, deps)
      .then(({ shouldUpdate, release }) => {
        if (!shouldUpdate || !release) return;
        deps.onUpdateAvailable?.(release);
        void window.easysignage?.updater?.notifyUpdateAvailable(release);
      })
      .catch(() => {});
  };

  tick();
  const id = window.setInterval(tick, intervalMs);
  return () => {
    stopped = true;
    window.clearInterval(id);
  };
}
