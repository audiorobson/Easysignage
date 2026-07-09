/**
 * Cache API para binários de device (offline-first leve).
 * Chave = URL + headers relevantes (Authorization).
 */

const CACHE_NAME = 'easysignage-device-assets-v1';

export async function fetchDeviceAssetCached(
  url: string,
  init: RequestInit
): Promise<Response> {
  if (typeof caches === 'undefined') {
    return fetch(url, init);
  }
  try {
    const cache = await caches.open(CACHE_NAME);
    const req = new Request(url, {
      method: 'GET',
      headers: init.headers,
    });
    const hit = await cache.match(req);
    if (hit) return hit;
    const res = await fetch(url, init);
    if (res.ok && res.status === 200) {
      await cache.put(req, res.clone());
    }
    return res;
  } catch {
    return fetch(url, init);
  }
}

/** Remove entradas que não pertencem ao manifesto/conteúdo atual. */
export async function evictDeviceAssetCacheExcept(
  keepUrls: string[]
): Promise<void> {
  if (typeof caches === 'undefined') return;
  try {
    const cache = await caches.open(CACHE_NAME);
    const keys = await cache.keys();
    const keep = new Set(keepUrls);
    await Promise.all(
      keys.map((req) => (keep.has(req.url) ? undefined : cache.delete(req)))
    );
  } catch {
    /* ignore */
  }
}

export async function clearDeviceAssetCache(): Promise<void> {
  if (typeof caches === 'undefined') return;
  try {
    await caches.delete(CACHE_NAME);
  } catch {
    /* ignore */
  }
}
