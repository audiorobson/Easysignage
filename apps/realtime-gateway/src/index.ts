import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { WebSocketServer, type WebSocket } from 'ws';
import {
  type RealtimeClientMessage,
  type RealtimeInternalBroadcast,
  type RealtimeServerMessage,
  parseRealtimeClientMessage,
} from '@easysignage/device-protocol';

const port = Number(process.env.RT_PORT) || 3020;
const apiBase =
  process.env.API_URL?.replace(/\/$/, '') ?? 'http://localhost:3001/api/v1';
const internalSecret = process.env.RT_INTERNAL_SECRET?.trim() || 'dev-rt-secret';
const tickIntervalMs = Number(process.env.RT_WALL_TICK_MS) || 1000;

type ClientRole = 'device' | 'cms';

type Client = {
  ws: WebSocket;
  role?: ClientRole;
  deviceId?: string;
  tenantId?: string;
  walls: Set<string>;
  authed: boolean;
};

const clients = new Set<Client>();
const wallRooms = new Map<string, Set<Client>>();
const wallTickTimers = new Map<string, ReturnType<typeof setInterval>>();
const wallSyncMeta = new Map<
  string,
  { syncEpochMs: number; toleranceMs: number; wallRevision: string }
>();

function send(ws: WebSocket, msg: RealtimeServerMessage) {
  if (ws.readyState === ws.OPEN) {
    ws.send(JSON.stringify(msg));
  }
}

function addToWall(client: Client, wallId: string) {
  if (client.walls.has(wallId)) return;
  client.walls.add(wallId);
  let room = wallRooms.get(wallId);
  if (!room) {
    room = new Set();
    wallRooms.set(wallId, room);
  }
  room.add(client);
  ensureWallTick(wallId);
  send(client.ws, { type: 'subscribed', channel: 'wall', wallId });
}

function removeFromWall(client: Client, wallId: string) {
  if (!client.walls.has(wallId)) return;
  client.walls.delete(wallId);
  const room = wallRooms.get(wallId);
  room?.delete(client);
  if (room && room.size === 0) {
    wallRooms.delete(wallId);
    stopWallTick(wallId);
  }
}

function cleanupClient(client: Client) {
  for (const wallId of [...client.walls]) {
    removeFromWall(client, wallId);
  }
  clients.delete(client);
}

function broadcastToWall(wallId: string, msg: RealtimeServerMessage) {
  const room = wallRooms.get(wallId);
  if (!room) return;
  for (const c of room) {
    send(c.ws, msg);
  }
}

function ensureWallTick(wallId: string) {
  if (wallTickTimers.has(wallId)) return;
  const timer = setInterval(() => {
    const meta = wallSyncMeta.get(wallId);
    if (!meta) return;
    const room = wallRooms.get(wallId);
    if (!room?.size) return;
    broadcastToWall(wallId, {
      type: 'wall.tick',
      wallId,
      serverTimeMs: Date.now(),
      syncEpochMs: meta.syncEpochMs,
      toleranceMs: meta.toleranceMs,
    });
  }, tickIntervalMs);
  wallTickTimers.set(wallId, timer);
}

function stopWallTick(wallId: string) {
  const t = wallTickTimers.get(wallId);
  if (t) {
    clearInterval(t);
    wallTickTimers.delete(wallId);
  }
}

async function validateDevice(
  token: string
): Promise<{ deviceId: string; tenantId: string } | null> {
  try {
    const res = await fetch(`${apiBase}/device/state`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { deviceId?: string };
    if (!data.deviceId) return null;
    return { deviceId: data.deviceId, tenantId: '' };
  } catch {
    return null;
  }
}

async function validateCms(
  token: string
): Promise<{ tenantId: string } | null> {
  try {
    const res = await fetch(`${apiBase}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { tenant?: { id?: string } };
    return { tenantId: data.tenant?.id ?? '' };
  } catch {
    return null;
  }
}

async function handleClientMessage(client: Client, msg: RealtimeClientMessage) {
  if (msg.type === 'ping') {
    send(client.ws, { type: 'pong', serverTime: new Date().toISOString() });
    return;
  }

  if (msg.type === 'auth') {
    if (msg.role === 'device') {
      const token = msg.token?.trim();
      if (!token) {
        send(client.ws, { type: 'auth_error', message: 'Token obrigatório' });
        return;
      }
      const info = await validateDevice(token);
      if (!info) {
        send(client.ws, { type: 'auth_error', message: 'Device inválido' });
        return;
      }
      client.role = 'device';
      client.deviceId = info.deviceId;
      client.tenantId = info.tenantId;
      client.authed = true;
      send(client.ws, {
        type: 'auth_ok',
        role: 'device',
        deviceId: info.deviceId,
      });
      return;
    }
    if (msg.role === 'cms') {
      const token = msg.token?.trim();
      if (!token) {
        send(client.ws, { type: 'auth_error', message: 'Token obrigatório' });
        return;
      }
      const info = await validateCms(token);
      if (!info) {
        send(client.ws, { type: 'auth_error', message: 'Sessão CMS inválida' });
        return;
      }
      client.role = 'cms';
      client.tenantId = info.tenantId;
      client.authed = true;
      send(client.ws, { type: 'auth_ok', role: 'cms', tenantId: info.tenantId });
      return;
    }
    send(client.ws, { type: 'auth_error', message: 'Role inválido' });
    return;
  }

  if (msg.type === 'subscribe' && msg.channel === 'wall') {
    if (!client.authed) {
      send(client.ws, { type: 'auth_error', message: 'Autentique primeiro' });
      return;
    }
    const wallId = msg.wallId?.trim();
    if (!wallId) return;
    addToWall(client, wallId);
    return;
  }

  if (msg.type === 'unsubscribe' && msg.channel === 'wall') {
    const wallId = msg.wallId?.trim();
    if (!wallId) return;
    removeFromWall(client, wallId);
  }
}

function handleInternalBroadcast(body: RealtimeInternalBroadcast) {
  if (body.event === 'wall.sync') {
    wallSyncMeta.set(body.wallId, {
      syncEpochMs: body.syncEpochMs,
      toleranceMs: body.toleranceMs,
      wallRevision: body.wallRevision,
    });
    broadcastToWall(body.wallId, {
      type: 'wall.sync',
      wallId: body.wallId,
      syncEpochMs: body.syncEpochMs,
      wallRevision: body.wallRevision,
      toleranceMs: body.toleranceMs,
    });
    ensureWallTick(body.wallId);
    return;
  }
  if (body.event === 'wall.tick') {
    broadcastToWall(body.wallId, {
      type: 'wall.tick',
      wallId: body.wallId,
      serverTimeMs: body.serverTimeMs,
      syncEpochMs: body.syncEpochMs,
      toleranceMs: body.toleranceMs,
    });
  }
}

async function readJsonBody<T>(req: IncomingMessage): Promise<T | null> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8')) as T;
  } catch {
    return null;
  }
}

function handleHttp(req: IncomingMessage, res: ServerResponse) {
  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        ok: true,
        clients: clients.size,
        walls: wallRooms.size,
        serverTime: new Date().toISOString(),
      })
    );
    return;
  }

  if (req.method === 'POST' && req.url === '/internal/broadcast') {
    const secret = req.headers['x-rt-secret'];
    if (secret !== internalSecret) {
      res.writeHead(401);
      res.end('Unauthorized');
      return;
    }
    void (async () => {
      const body = await readJsonBody<RealtimeInternalBroadcast>(req);
      if (!body?.event || !('wallId' in body)) {
        res.writeHead(400);
        res.end('Invalid body');
        return;
      }
      handleInternalBroadcast(body);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
    })();
    return;
  }

  res.writeHead(404);
  res.end('Not found');
}

const httpServer = createServer(handleHttp);
const wss = new WebSocketServer({ server: httpServer });

wss.on('connection', (ws) => {
  const client: Client = { ws, walls: new Set(), authed: false };
  clients.add(client);

  send(ws, {
    type: 'hello',
    service: 'easysignage-realtime-gateway',
    serverTime: new Date().toISOString(),
  });

  ws.on('message', (data) => {
    const msg = parseRealtimeClientMessage(data.toString());
    if (!msg) return;
    void handleClientMessage(client, msg);
  });

  ws.on('close', () => cleanupClient(client));
  ws.on('error', () => cleanupClient(client));
});

httpServer.listen(port, () => {
  console.log(
    `Realtime gateway on ws://0.0.0.0:${port} (API ${apiBase}, tick ${tickIntervalMs}ms)`
  );
});
