/** Proof-of-play: contrato compartilhado entre player, device-api e relatórios do CMS (Fase 5.B). */

export const PLAYBACK_EVENT_TYPES = ['started', 'completed', 'skipped', 'error'] as const;
export type PlaybackEventType = (typeof PLAYBACK_EVENT_TYPES)[number];

export const PLAYBACK_ITEM_TYPES = ['asset', 'playlist', 'layout', 'wall_tile', 'widget'] as const;
export type PlaybackItemType = (typeof PLAYBACK_ITEM_TYPES)[number];

export function isPlaybackEventType(v: unknown): v is PlaybackEventType {
  return typeof v === 'string' && (PLAYBACK_EVENT_TYPES as readonly string[]).includes(v);
}

export function isPlaybackItemType(v: unknown): v is PlaybackItemType {
  return typeof v === 'string' && (PLAYBACK_ITEM_TYPES as readonly string[]).includes(v);
}

/** Um evento de exibição gerado pelo player (antes de chegar ao servidor). */
export interface PlaybackEventInput {
  itemType: PlaybackItemType;
  assetId?: string | null;
  playlistId?: string | null;
  eventType: PlaybackEventType;
  /** ISO 8601 — instante em que o item começou a ser exibido. */
  startedAt: string;
  /** Duração efetiva de exibição, em ms (omitido para `started`). */
  durationMs?: number | null;
  errorMessage?: string | null;
  meta?: Record<string, unknown> | null;
}

/** Payload de `POST /device/playback-events` — lote para reduzir chamadas de rede. */
export interface PlaybackEventBatchInput {
  events: PlaybackEventInput[];
}

export function isPlaybackEventInput(v: unknown): v is PlaybackEventInput {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return false;
  const o = v as Record<string, unknown>;
  return (
    isPlaybackItemType(o.itemType) &&
    isPlaybackEventType(o.eventType) &&
    typeof o.startedAt === 'string'
  );
}

/** Linha retornada por `GET /monitoring/playback-logs` (relatório de proof-of-play no CMS). */
export interface PlaybackLogRow {
  id: string;
  deviceId: string;
  deviceName: string;
  itemType: PlaybackItemType;
  assetId: string | null;
  assetName: string | null;
  playlistId: string | null;
  playlistName: string | null;
  eventType: PlaybackEventType;
  startedAt: string;
  durationMs: number | null;
  errorMessage: string | null;
  createdAt: string;
}

export interface PlaybackLogFilters {
  deviceId?: string;
  assetId?: string;
  playlistId?: string;
  eventType?: PlaybackEventType;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
}

export interface PlaybackLogPage {
  rows: PlaybackLogRow[];
  total: number;
  page: number;
  pageSize: number;
}

export function playbackEventTypeLabelPt(t: PlaybackEventType): string {
  switch (t) {
    case 'started':
      return 'Iniciado';
    case 'completed':
      return 'Concluído';
    case 'skipped':
      return 'Ignorado';
    case 'error':
      return 'Erro';
  }
}

export function playbackItemTypeLabelPt(t: PlaybackItemType): string {
  switch (t) {
    case 'asset':
      return 'Mídia';
    case 'playlist':
      return 'Playlist';
    case 'layout':
      return 'Layout';
    case 'wall_tile':
      return 'Video wall';
    case 'widget':
      return 'Widget';
  }
}
