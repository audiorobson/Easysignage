/** Sync de playback em video wall — heartbeat e painel de drift (L4.4 / L5). */

export type WallPlaybackSync = {
  wallId: string;
  itemIndex: number;
  positionMs: number;
  driftMs: number;
  syncEpochMs?: number;
};

export type WallSlideTiming = {
  durationMs: number;
};

export type WallPlaybackPosition = {
  itemIndex: number;
  positionMs: number;
  elapsedMs: number;
};

export type WallTileSyncStatus = 'ok' | 'warn' | 'critical' | 'offline' | 'no_data';

const DEFAULT_SLIDE_MS = 10_000;

/** Posição ideal de playback no relógio da parede. */
export function computeWallPlaybackAt(
  slides: WallSlideTiming[],
  epochMs: number,
  nowMs: number
): WallPlaybackPosition {
  const elapsedMs = Math.max(0, nowMs - epochMs);
  if (!slides.length) {
    return { itemIndex: 0, positionMs: 0, elapsedMs };
  }
  const total = slides.reduce((s, x) => s + Math.max(1, x.durationMs), 0);
  if (total <= 0) {
    return { itemIndex: 0, positionMs: 0, elapsedMs };
  }
  let remain = elapsedMs % total;
  for (let i = 0; i < slides.length; i++) {
    const d = Math.max(1, slides[i]!.durationMs);
    if (remain < d) {
      return { itemIndex: i, positionMs: remain, elapsedMs };
    }
    remain -= d;
  }
  return { itemIndex: 0, positionMs: 0, elapsedMs };
}

/** Drift entre posição reportada pelo player e relógio da parede. */
export function computeWallDriftMs(
  slides: WallSlideTiming[],
  epochMs: number,
  nowMs: number,
  actual: { itemIndex: number; positionMs: number }
): number {
  const expected = computeWallPlaybackAt(slides, epochMs, nowMs);
  if (actual.itemIndex !== expected.itemIndex) {
    const avg =
      slides.length > 0
        ? slides.reduce((s, x) => s + Math.max(1, x.durationMs), 0) / slides.length
        : DEFAULT_SLIDE_MS;
    return (actual.itemIndex - expected.itemIndex) * avg + actual.positionMs - expected.positionMs;
  }
  return actual.positionMs - expected.positionMs;
}

export function classifyWallDrift(
  driftMs: number,
  toleranceMs: number,
  itemIndexMatch: boolean
): WallTileSyncStatus {
  if (!itemIndexMatch) return 'critical';
  const abs = Math.abs(driftMs);
  if (abs <= toleranceMs) return 'ok';
  if (abs <= toleranceMs * 4) return 'warn';
  return 'critical';
}

export function wallSyncStatusLabelPt(status: WallTileSyncStatus): string {
  switch (status) {
    case 'ok':
      return 'Sincronizado';
    case 'warn':
      return 'Deriva leve';
    case 'critical':
      return 'Fora de sync';
    case 'offline':
      return 'Offline';
    case 'no_data':
      return 'Sem dados';
  }
}

export function isWallPlaybackSync(v: unknown): v is WallPlaybackSync {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.wallId === 'string' &&
    typeof o.itemIndex === 'number' &&
    typeof o.positionMs === 'number' &&
    typeof o.driftMs === 'number'
  );
}

/** Extrai `wallSync` do snapshot de telemetria do device. */
export function parseWallSyncFromSnapshot(
  snapshot: Record<string, unknown> | null | undefined
): WallPlaybackSync | null {
  if (!snapshot) return null;
  const raw = snapshot.wallSync ?? snapshot.playbackSync;
  if (!isWallPlaybackSync(raw)) return null;
  return raw;
}
