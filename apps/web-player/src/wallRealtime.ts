import {
  isRealtimeServerMessage,
  type RealtimeWallSync,
  type RealtimeWallTick,
} from '@easysignage/device-protocol';

const RT_URL =
  import.meta.env.VITE_RT_URL?.replace(/\/$/, '') ?? 'ws://localhost:3020';

export type WallRealtimeHandlers = {
  onSync?: (msg: RealtimeWallSync) => void;
  onTick?: (msg: RealtimeWallTick) => void;
  onConnected?: () => void;
  onDisconnected?: () => void;
};

/**
 * Liga o player à parede via WebSocket (fallback: heartbeat + state poll).
 * Reconecta automaticamente com backoff simples.
 */
export function connectWallRealtime(opts: {
  deviceToken: string;
  wallId: string;
  handlers: WallRealtimeHandlers;
}): () => void {
  let ws: WebSocket | null = null;
  let stopped = false;
  let retryMs = 1500;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;
  let authed = false;

  const clearRetry = () => {
    if (retryTimer != null) {
      clearTimeout(retryTimer);
      retryTimer = null;
    }
  };

  const scheduleReconnect = () => {
    if (stopped) return;
    clearRetry();
    retryTimer = setTimeout(() => {
      retryTimer = null;
      connect();
    }, retryMs);
    retryMs = Math.min(retryMs * 1.5, 15_000);
  };

  const connect = () => {
    if (stopped) return;
    try {
      ws = new WebSocket(RT_URL);
    } catch {
      scheduleReconnect();
      return;
    }

    ws.onopen = () => {
      retryMs = 1500;
      authed = false;
      ws?.send(
        JSON.stringify({ type: 'auth', role: 'device', token: opts.deviceToken })
      );
    };

    ws.onmessage = (ev) => {
      let data: unknown;
      try {
        data = JSON.parse(String(ev.data));
      } catch {
        return;
      }
      if (!isRealtimeServerMessage(data)) return;

      if (data.type === 'auth_ok' && data.role === 'device') {
        authed = true;
        ws?.send(
          JSON.stringify({
            type: 'subscribe',
            channel: 'wall',
            wallId: opts.wallId,
          })
        );
        opts.handlers.onConnected?.();
        return;
      }

      if (!authed) return;

      if (data.type === 'wall.sync' && data.wallId === opts.wallId) {
        opts.handlers.onSync?.(data);
        return;
      }
      if (data.type === 'wall.tick' && data.wallId === opts.wallId) {
        opts.handlers.onTick?.(data);
      }
    };

    ws.onclose = () => {
      authed = false;
      opts.handlers.onDisconnected?.();
      ws = null;
      scheduleReconnect();
    };

    ws.onerror = () => {
      ws?.close();
    };
  };

  connect();

  return () => {
    stopped = true;
    clearRetry();
    ws?.close();
    ws = null;
  };
}

/** CMS — subscrição live a eventos da parede. */
export function connectCmsWallRealtime(opts: {
  accessToken: string;
  wallId: string;
  onEvent: () => void;
}): () => void {
  let ws: WebSocket | null = null;
  let stopped = false;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;

  const connect = () => {
    if (stopped) return;
    ws = new WebSocket(RT_URL);
    ws.onopen = () => {
      ws?.send(
        JSON.stringify({ type: 'auth', role: 'cms', token: opts.accessToken })
      );
    };
    ws.onmessage = (ev) => {
      let data: unknown;
      try {
        data = JSON.parse(String(ev.data));
      } catch {
        return;
      }
      if (!isRealtimeServerMessage(data)) return;
      if (data.type === 'auth_ok') {
        ws?.send(
          JSON.stringify({
            type: 'subscribe',
            channel: 'wall',
            wallId: opts.wallId,
          })
        );
        return;
      }
      if (
        (data.type === 'wall.sync' || data.type === 'wall.tick') &&
        data.wallId === opts.wallId
      ) {
        opts.onEvent();
      }
    };
    ws.onclose = () => {
      if (!stopped) {
        retryTimer = setTimeout(connect, 3000);
      }
    };
  };

  connect();

  return () => {
    stopped = true;
    if (retryTimer) clearTimeout(retryTimer);
    ws?.close();
  };
}
