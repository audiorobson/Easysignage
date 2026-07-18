/**
 * Proof-of-play (Fase 5.B): fila local offline-safe (IndexedDB) de eventos de reprodução,
 * com retry/flush periódico e ao voltar a ficar online. Espelha o padrão de cache
 * offline-first já usado em `deviceAssetCache.ts`.
 */
import type { PlaybackEventInput } from '@easysignage/shared-types';

const DB_NAME = 'easysignage-playback-queue';
const DB_VERSION = 1;
const STORE_NAME = 'events';
const MAX_QUEUE_SIZE = 2000;
const FLUSH_BATCH_SIZE = 100;

type QueuedEvent = PlaybackEventInput & { id: string; enqueuedAt: number };

let memoryFallback: QueuedEvent[] | null = null;
let dbPromise: Promise<IDBDatabase | null> | null = null;

function openDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve) => {
    try {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
  return dbPromise;
}

function randomId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export async function enqueuePlaybackEvent(event: PlaybackEventInput): Promise<void> {
  const queued: QueuedEvent = { ...event, id: randomId(), enqueuedAt: Date.now() };
  const db = await openDb();
  if (!db) {
    memoryFallback = memoryFallback ?? [];
    memoryFallback.push(queued);
    if (memoryFallback.length > MAX_QUEUE_SIZE) memoryFallback.shift();
    return;
  }
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put(queued);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    await trimQueue(db);
  } catch {
    /* ignore — evento é best-effort, não deve travar o player */
  }
}

async function trimQueue(db: IDBDatabase): Promise<void> {
  try {
    const all = await readAll(db);
    if (all.length <= MAX_QUEUE_SIZE) return;
    const excess = all
      .sort((a, b) => a.enqueuedAt - b.enqueuedAt)
      .slice(0, all.length - MAX_QUEUE_SIZE);
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    for (const e of excess) store.delete(e.id);
  } catch {
    /* ignore */
  }
}

function readAll(db: IDBDatabase): Promise<QueuedEvent[]> {
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).getAll();
      req.onsuccess = () => resolve((req.result as QueuedEvent[]) ?? []);
      req.onerror = () => resolve([]);
    } catch {
      resolve([]);
    }
  });
}

async function removeMany(db: IDBDatabase, ids: string[]): Promise<void> {
  if (!ids.length) return;
  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      for (const id of ids) store.delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

let flushing = false;

/** Tenta enviar um lote pendente; devolve quantos eventos foram confirmados pelo servidor. */
export async function flushPlaybackQueue(
  apiUrl: string,
  token: string
): Promise<{ sent: number; remaining: number }> {
  if (flushing) return { sent: 0, remaining: 0 };
  flushing = true;
  try {
    const db = await openDb();
    let queued: QueuedEvent[];
    if (db) {
      queued = await readAll(db);
    } else {
      queued = memoryFallback ?? [];
    }
    if (!queued.length) return { sent: 0, remaining: 0 };

    const batch = queued
      .sort((a, b) => a.enqueuedAt - b.enqueuedAt)
      .slice(0, FLUSH_BATCH_SIZE);

    const events: PlaybackEventInput[] = batch.map(({ id, enqueuedAt, ...rest }) => {
      void id;
      void enqueuedAt;
      return rest;
    });

    const res = await fetch(`${apiUrl}/device/playback-events`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ events }),
    });

    if (!res.ok) {
      return { sent: 0, remaining: queued.length };
    }

    const ids = batch.map((e) => e.id);
    if (db) {
      await removeMany(db, ids);
    } else if (memoryFallback) {
      const idSet = new Set(ids);
      memoryFallback = memoryFallback.filter((e) => !idSet.has(e.id));
    }
    return { sent: ids.length, remaining: queued.length - ids.length };
  } catch {
    return { sent: 0, remaining: 0 };
  } finally {
    flushing = false;
  }
}

/** Utilitário exclusivo de testes: limpa a fila persistida e o estado em memória. */
export async function __clearPlaybackQueueForTests(): Promise<void> {
  flushing = false;
  memoryFallback = null;
  const db = await openDb();
  if (!db) return;
  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

/** Inicia o loop de flush periódico + on-online; devolve função de cleanup. */
export function startPlaybackFlushLoop(
  apiUrl: string,
  getToken: () => string | null,
  intervalMs = 15_000
): () => void {
  const tick = () => {
    const token = getToken();
    if (token) void flushPlaybackQueue(apiUrl, token);
  };
  const id = window.setInterval(tick, intervalMs);
  const onOnline = () => tick();
  window.addEventListener('online', onOnline);
  tick();
  return () => {
    window.clearInterval(id);
    window.removeEventListener('online', onOnline);
  };
}
