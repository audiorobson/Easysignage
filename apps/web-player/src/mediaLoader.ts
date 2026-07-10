import {
  isPlayableInPlayer,
  resolvePlayerKind,
  type PlayerMediaKind,
} from '@easysignage/shared-types';
import { fetchDeviceAssetCached } from './deviceAssetCache';

const API =
  import.meta.env.VITE_API_URL?.replace(/\/$/, '') ?? 'http://localhost:3001/api/v1';

export type MediaKind = PlayerMediaKind | 'url';

export type LoadedMedia = {
  assetId: string;
  kind: MediaKind;
  mimeType: string;
  blobUrl: string | null;
  frameUrl: string | null;
};

type SlideMeta = {
  assetId: string;
  kind: string;
};

const cache = new Map<string, LoadedMedia>();
const inflight = new Map<string, Promise<LoadedMedia>>();

function fileUrl(assetId: string): string {
  return `${API}/device/assets/${assetId}/file`;
}

function canonicalBlobType(kind: MediaKind, mimeType: string): string {
  if (kind === 'pdf') return 'application/pdf';
  if (kind === 'html') return 'text/html';
  if (kind === 'text') return 'text/plain';
  return mimeType || 'application/octet-stream';
}

/** Pré-decodifica mídia para evitar flash preto no primeiro frame. */
async function warmMedia(media: LoadedMedia): Promise<void> {
  if (media.kind === 'image' && media.blobUrl) {
    const img = new Image();
    img.src = media.blobUrl;
    try {
      await img.decode();
    } catch {
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject();
      });
    }
    return;
  }
  if ((media.kind === 'video' || media.kind === 'audio') && media.blobUrl) {
    await new Promise<void>((resolve, reject) => {
      const el =
        media.kind === 'audio'
          ? document.createElement('audio')
          : document.createElement('video');
      el.preload = 'auto';
      if (media.kind === 'video') {
        (el as HTMLVideoElement).muted = true;
        (el as HTMLVideoElement).playsInline = true;
      }
      el.onloadeddata = () => resolve();
      el.onerror = () => reject();
      el.src = media.blobUrl!;
    });
  }
}

export async function loadMedia(
  token: string,
  slide: SlideMeta
): Promise<LoadedMedia> {
  const cached = cache.get(slide.assetId);
  if (cached) return cached;

  const pending = inflight.get(slide.assetId);
  if (pending) return pending;

  const promise = (async () => {
    const metaRes = await fetch(`${API}/device/assets/${slide.assetId}/meta`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!metaRes.ok) {
      throw new Error(`Meta HTTP ${metaRes.status}`);
    }
    const meta = (await metaRes.json()) as {
      kind: string;
      mimeType?: string;
      remoteUrl?: string | null;
    };
    const kind = resolvePlayerKind(meta.kind, meta.mimeType);
    const mimeType = meta.mimeType ?? '';

    if (meta.kind === 'url' && meta.remoteUrl) {
      const loaded: LoadedMedia = {
        assetId: slide.assetId,
        kind: 'url' as MediaKind,
        mimeType: 'application/x-easysignage-url',
        blobUrl: null,
        frameUrl: meta.remoteUrl,
      };
      cache.set(slide.assetId, loaded);
      return loaded;
    }

    const fr = await fetchDeviceAssetCached(fileUrl(slide.assetId), {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!fr.ok) throw new Error(`Ficheiro HTTP ${fr.status}`);

    let blob = await fr.blob();
    const headerType = fr.headers.get('content-type')?.split(';')[0]?.trim() ?? '';
    const effectiveType =
      canonicalBlobType(kind, mimeType) ||
      blob.type ||
      headerType ||
      mimeType ||
      'application/octet-stream';
    if (
      !blob.type ||
      blob.type === 'application/octet-stream' ||
      blob.type !== effectiveType
    ) {
      blob = new Blob([await blob.arrayBuffer()], { type: effectiveType });
    }

    const blobUrl = URL.createObjectURL(blob);
    const loaded: LoadedMedia = {
      assetId: slide.assetId,
      kind,
      mimeType: effectiveType,
      blobUrl,
      frameUrl: null,
    };
    await warmMedia(loaded).catch(() => {
      /* formatos exóticos (HEIC, MKV…) podem falhar no warm — tenta reproduzir na mesma */
    });
    cache.set(slide.assetId, loaded);
    return loaded;
  })();

  inflight.set(slide.assetId, promise);
  try {
    return await promise;
  } finally {
    inflight.delete(slide.assetId);
  }
}

export function preloadSlides(token: string, slides: SlideMeta[]): void {
  for (const slide of slides) {
    if (slide.kind !== 'url' && !isPlayableInPlayer(slide.kind)) continue;
    void loadMedia(token, slide).catch(() => {});
  }
}

export function getCachedMedia(assetId: string): LoadedMedia | undefined {
  return cache.get(assetId);
}

export function revokeMediaCache(keepAssetIds: Iterable<string>): void {
  const keep = new Set(keepAssetIds);
  for (const [id, media] of cache) {
    if (!keep.has(id)) {
      if (media.blobUrl) URL.revokeObjectURL(media.blobUrl);
      cache.delete(id);
    }
  }
}

export function clearMediaCache(): void {
  for (const media of cache.values()) {
    if (media.blobUrl) URL.revokeObjectURL(media.blobUrl);
  }
  cache.clear();
  inflight.clear();
}

export function playlistFileUrls(slides: SlideMeta[]): string[] {
  return slides
    .filter((s) => s.kind !== 'url')
    .map((s) => fileUrl(s.assetId));
}
