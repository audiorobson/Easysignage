import { isRealtimeServerMessage } from '@easysignage/device-protocol';

const RT_URL =
  process.env.NEXT_PUBLIC_RT_URL?.replace(/\/$/, '') ?? 'ws://localhost:3020';

/** CMS — atualiza painel de saúde quando a parede emite sync/tick. */
export function connectCmsWallRealtime(opts: {
  accessToken: string;
  wallId: string;
  onEvent: () => void;
}): () => void {
  if (typeof window === 'undefined') return () => undefined;

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
