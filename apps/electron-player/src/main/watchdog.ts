/**
 * PR 5.12 — watchdog do renderer + kiosk mode.
 *
 * Um mini PC de sinalização fica muitas vezes sem monitor humano por perto —
 * se o renderer travar (crash da GPU, aba sem resposta, falha a carregar o
 * `web-player` porque a API ainda não arrancou) o player deve recuperar-se
 * sozinho em vez de ficar com uma tela preta indefinidamente.
 */

export interface WatchdogDeps {
  /** Recarrega a página atual na mesma janela (sem recriar `BrowserWindow`). */
  reload: () => void;
  /** Destrói a janela atual (se ainda existir) e cria uma nova do zero. */
  recreateWindow: () => void;
  now?: () => number;
  log?: (message: string) => void;
}

export interface WatchdogOptions {
  /** Nº de crashes acima do qual consideramos "crash loop" (só afeta o log/aviso). */
  crashLoopThreshold?: number;
  /** Janela deslizante (ms) usada para contar crashes recentes. */
  crashWindowMs?: number;
}

const DEFAULT_CRASH_LOOP_THRESHOLD = 5;
const DEFAULT_CRASH_WINDOW_MS = 60_000;

/**
 * Estado de recuperação do renderer. Não decide "desistir" — mesmo em crash loop
 * continua a tentar recriar a janela (é sempre melhor que ficar preto), mas emite
 * um aviso para o log/telemetria poder alertar um operador.
 */
export class RendererWatchdog {
  private crashTimestamps: number[] = [];

  constructor(
    private readonly deps: WatchdogDeps,
    private readonly opts: WatchdogOptions = {}
  ) {}

  /** `render-process-gone` — o processo do renderer morreu (crash/oom/kill). */
  handleRendererGone(reason: string): void {
    const now = this.deps.now?.() ?? Date.now();
    const windowMs = this.opts.crashWindowMs ?? DEFAULT_CRASH_WINDOW_MS;
    this.crashTimestamps = [...this.crashTimestamps, now].filter(
      (t) => now - t <= windowMs
    );

    const threshold = this.opts.crashLoopThreshold ?? DEFAULT_CRASH_LOOP_THRESHOLD;
    if (this.crashTimestamps.length >= threshold) {
      this.deps.log?.(
        `[watchdog] possível crash loop: ${this.crashTimestamps.length} crashes em ${windowMs}ms (motivo mais recente: ${reason})`
      );
    } else {
      this.deps.log?.(`[watchdog] renderer terminou (${reason}) — a recriar janela`);
    }

    this.deps.recreateWindow();
  }

  /** `unresponsive` — o renderer está vivo mas não responde a eventos (loop bloqueante). */
  handleUnresponsive(): void {
    this.deps.log?.('[watchdog] renderer sem resposta — a recarregar');
    this.deps.reload();
  }

  /** `did-fail-load` — falhou a carregar o URL (ex.: web-player ainda não arrancou). */
  handleLoadFailed(errorDescription: string, retry: () => void, delayMs = 3000): void {
    this.deps.log?.(
      `[watchdog] falha ao carregar o player (${errorDescription}) — nova tentativa em ${delayMs}ms`
    );
    setTimeout(retry, delayMs);
  }

  crashesInWindow(): number {
    return this.crashTimestamps.length;
  }
}

/** Lê `EASYSIGNAGE_KIOSK` (default: ativo) — permitir desativar em DEV. */
export function isKioskModeEnabled(
  env: Record<string, string | undefined> = process.env
): boolean {
  const raw = env.EASYSIGNAGE_KIOSK?.trim().toLowerCase();
  return raw !== '0' && raw !== 'false' && raw !== 'off';
}
