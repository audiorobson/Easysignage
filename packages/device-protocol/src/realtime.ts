/** Mensagens WebSocket do realtime-gateway (L5). */

export type RealtimeAuthDevice = {
  type: 'auth';
  role: 'device';
  token: string;
};

export type RealtimeAuthCms = {
  type: 'auth';
  role: 'cms';
  token: string;
};

export type RealtimeSubscribeWall = {
  type: 'subscribe';
  channel: 'wall';
  wallId: string;
};

export type RealtimeUnsubscribeWall = {
  type: 'unsubscribe';
  channel: 'wall';
  wallId: string;
};

export type RealtimePing = { type: 'ping' };

export type RealtimeClientMessage =
  | RealtimeAuthDevice
  | RealtimeAuthCms
  | RealtimeSubscribeWall
  | RealtimeUnsubscribeWall
  | RealtimePing;

export type RealtimeHello = {
  type: 'hello';
  service: string;
  serverTime: string;
};

export type RealtimeAuthOk = {
  type: 'auth_ok';
  role: 'device' | 'cms';
  deviceId?: string;
  tenantId?: string;
};

export type RealtimeAuthError = {
  type: 'auth_error';
  message: string;
};

export type RealtimeSubscribed = {
  type: 'subscribed';
  channel: 'wall';
  wallId: string;
};

export type RealtimeWallSync = {
  type: 'wall.sync';
  wallId: string;
  syncEpochMs: number;
  wallRevision: string;
  toleranceMs: number;
};

export type RealtimeWallTick = {
  type: 'wall.tick';
  wallId: string;
  serverTimeMs: number;
  syncEpochMs: number;
  toleranceMs: number;
};

export type RealtimePong = {
  type: 'pong';
  serverTime: string;
};

export type RealtimeServerMessage =
  | RealtimeHello
  | RealtimeAuthOk
  | RealtimeAuthError
  | RealtimeSubscribed
  | RealtimeWallSync
  | RealtimeWallTick
  | RealtimePong;

/** Corpo de `POST /internal/broadcast` (API → gateway). */
export type RealtimeInternalBroadcast =
  | {
      event: 'wall.sync';
      wallId: string;
      syncEpochMs: number;
      wallRevision: string;
      toleranceMs: number;
    }
  | {
      event: 'wall.tick';
      wallId: string;
      serverTimeMs: number;
      syncEpochMs: number;
      toleranceMs: number;
    };

export function parseRealtimeClientMessage(raw: string): RealtimeClientMessage | null {
  try {
    const data = JSON.parse(raw) as RealtimeClientMessage;
    if (!data || typeof data !== 'object' || !('type' in data)) return null;
    return data;
  } catch {
    return null;
  }
}

export function isRealtimeServerMessage(v: unknown): v is RealtimeServerMessage {
  return Boolean(v && typeof v === 'object' && 'type' in (v as object));
}
