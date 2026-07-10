'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  isPlayableInPlayer,
  isRemoteStreamKind,
  maskStreamUrl,
  resolvePlayerKind,
  type PlayerMediaKind,
} from '@easysignage/shared-types';
import { API_BASE, fetchApi } from '@/lib/api';

type ManifestItem = {
  itemId: string;
  position: number;
  durationSec: number | null;
  assetId: string;
  mimeType: string;
  kind: string;
  remoteUrl?: string | null;
};

type PlaylistManifest = {
  playlistId: string;
  name: string;
  manifestRevision?: string;
  items: ManifestItem[];
};

type MediaKind = PlayerMediaKind | 'url' | 'rtsp';

function isPlayableKind(kind: string): boolean {
  return isRemoteStreamKind(kind) || isPlayableInPlayer(kind);
}

function defaultDurationSec(kind: string): number {
  switch (kind) {
    case 'image':
      return 10;
    case 'video':
      return 30;
    case 'audio':
      return 60;
    case 'pdf':
      return 45;
    case 'html':
      return 60;
    case 'text':
      return 20;
    case 'url':
      return 30;
    case 'rtsp':
      return 3600;
    default:
      return 15;
  }
}

type Props = {
  playlistId: string;
  accessToken: string;
};

export function PlaylistEmbedPlayer({ playlistId, accessToken }: Props) {
  const [manifest, setManifest] = useState<PlaylistManifest | null>(null);
  const [hint, setHint] = useState<string | null>('A carregar playlist…');
  const [slideIndex, setSlideIndex] = useState(0);
  const [mediaKind, setMediaKind] = useState<MediaKind | null>(null);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [frameUrl, setFrameUrl] = useState<string | null>(null);
  const blobUrlRef = useRef<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  const revokeBlob = useCallback(() => {
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }
    setBlobUrl(null);
    setFrameUrl(null);
    setMediaKind(null);
  }, []);

  useEffect(() => {
    return () => revokeBlob();
  }, [revokeBlob]);

  const authHeaders = useMemo(
    () => ({
      Authorization: `Bearer ${accessToken}`,
    }),
    [accessToken]
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetchApi(`${API_BASE}/playlists/${playlistId}/manifest`, {
          headers: authHeaders,
        });
        const data = (await res.json()) as PlaylistManifest & { message?: string };
        if (cancelled) return;
        if (!res.ok) {
          setHint(data?.message ?? `Playlist HTTP ${res.status}`);
          setManifest(null);
          return;
        }
        setManifest(data);
        setSlideIndex(0);
        setHint(null);
      } catch {
        if (!cancelled) {
          setHint('Falha ao carregar playlist');
          setManifest(null);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [playlistId, authHeaders]);

  const playableSlides = useMemo(() => {
    if (!manifest?.items.length) return [];
    return manifest.items.filter((i) => isPlayableKind(i.kind));
  }, [manifest]);

  const activeAssetId = useMemo(() => {
    if (!playableSlides.length) return null;
    const idx = slideIndex % playableSlides.length;
    return playableSlides[idx]?.assetId ?? null;
  }, [playableSlides, slideIndex]);

  useEffect(() => {
    if (!activeAssetId) {
      revokeBlob();
      if (manifest && playableSlides.length === 0) {
        setHint('Nenhum item reproduzível (imagem, vídeo, áudio, PDF, HTML, texto, URL ou RTSP).');
      }
      return;
    }

    let cancelled = false;
    const caption = `${manifest?.name ?? ''} — ${(slideIndex % playableSlides.length) + 1}/${playableSlides.length}`;

    (async () => {
      try {
        setHint(`A carregar… ${caption}`);
        const metaRes = await fetchApi(`${API_BASE}/assets/${activeAssetId}/meta`, {
          headers: authHeaders,
        });
        if (cancelled) return;
        if (!metaRes.ok) {
          setHint(`Meta HTTP ${metaRes.status}`);
          revokeBlob();
          return;
        }
        const meta = (await metaRes.json()) as {
          kind: string;
          mimeType?: string;
          remoteUrl?: string | null;
        };

        if (isRemoteStreamKind(meta.kind) && meta.remoteUrl) {
          revokeBlob();
          if (cancelled) return;
          blobUrlRef.current = null;
          setBlobUrl(null);
          setFrameUrl(meta.remoteUrl);
          setMediaKind(meta.kind as MediaKind);
          setHint(caption);
          return;
        }

        const fr = await fetchApi(`${API_BASE}/assets/${activeAssetId}/file`, {
          headers: authHeaders,
        });
        if (cancelled) return;
        if (!fr.ok) {
          setHint(`Ficheiro HTTP ${fr.status}`);
          revokeBlob();
          return;
        }
        let blob = await fr.blob();
        if (cancelled) return;

        const headerType =
          fr.headers.get('content-type')?.split(';')[0]?.trim() ?? '';
        const canonical =
          meta.kind === 'pdf'
            ? 'application/pdf'
            : meta.kind === 'html'
              ? 'text/html'
              : meta.kind === 'text'
                ? 'text/plain'
                : '';
        const effectiveType =
          canonical ||
          blob.type ||
          headerType ||
          meta.mimeType ||
          'application/octet-stream';
        const needsRetype =
          !blob.type ||
          blob.type === 'application/octet-stream' ||
          (Boolean(canonical) && blob.type !== canonical);
        if (needsRetype) {
          blob = new Blob([await blob.arrayBuffer()], { type: effectiveType });
        }
        if (cancelled) return;
        revokeBlob();
        const url = URL.createObjectURL(blob);
        blobUrlRef.current = url;
        setBlobUrl(url);
        setFrameUrl(null);
        const k: MediaKind =
          meta.kind === 'url' ? 'url' : resolvePlayerKind(meta.kind, meta.mimeType);
        setMediaKind(k);
        setHint(caption);
      } catch {
        if (!cancelled) {
          setHint('Falha ao carregar mídia');
          revokeBlob();
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    activeAssetId,
    authHeaders,
    manifest?.name,
    playableSlides.length,
    revokeBlob,
    slideIndex,
  ]);

  useEffect(() => {
    if (!playableSlides.length) return;
    const idx = slideIndex % playableSlides.length;
    const sl = playableSlides[idx]!;
    const sec = sl.durationSec ?? defaultDurationSec(sl.kind);
    const t = window.setTimeout(
      () => setSlideIndex((s) => s + 1),
      Math.max(1, sec) * 1000
    );
    return () => clearTimeout(t);
  }, [playableSlides, slideIndex]);

  useEffect(() => {
    if (mediaKind === 'video' && blobUrl && videoRef.current) {
      void videoRef.current.play().catch(() => {
        /* autoplay policy */
      });
    }
    if (mediaKind === 'audio' && blobUrl && audioRef.current) {
      void audioRef.current.play().catch(() => {
        /* autoplay policy */
      });
    }
  }, [mediaKind, blobUrl]);

  const hasMedia = Boolean(blobUrl || frameUrl);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: '#020617',
        color: '#f8fafc',
        fontFamily: 'var(--font-inter), system-ui, sans-serif',
      }}
    >
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 0,
          background: '#020617',
        }}
      >
        {hasMedia ? (
          <>
            {mediaKind === 'image' && blobUrl && (
              <img
                alt=""
                src={blobUrl}
                style={{
                  position: 'absolute',
                  inset: 0,
                  width: '100%',
                  height: '100%',
                  objectFit: 'contain',
                  background: '#000',
                }}
              />
            )}
            {mediaKind === 'video' && blobUrl && (
              <video
                ref={videoRef}
                key={blobUrl}
                style={{
                  position: 'absolute',
                  inset: 0,
                  width: '100%',
                  height: '100%',
                  objectFit: 'contain',
                  background: '#000',
                }}
                src={blobUrl}
                autoPlay
                muted
                playsInline
                loop={false}
              />
            )}
            {mediaKind === 'audio' && blobUrl && (
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'radial-gradient(ellipse at center, #1e293b 0%, #020617 70%)',
                }}
              >
                <audio
                  ref={audioRef}
                  key={blobUrl}
                  src={blobUrl}
                  autoPlay
                  controls
                  style={{ width: 'min(90%, 640px)' }}
                />
              </div>
            )}
            {mediaKind === 'text' && blobUrl && (
              <iframe
                key={blobUrl}
                title="Texto"
                src={blobUrl}
                style={{
                  position: 'absolute',
                  inset: 0,
                  width: '100%',
                  height: '100%',
                  border: 'none',
                  background: '#0f172a',
                }}
              />
            )}
            {mediaKind === 'pdf' && blobUrl && (
              <iframe
                key={blobUrl}
                title="Documento PDF"
                src={blobUrl}
                style={{
                  position: 'absolute',
                  inset: 0,
                  width: '100%',
                  height: '100%',
                  border: 'none',
                }}
              />
            )}
            {mediaKind === 'html' && blobUrl && (
              <iframe
                key={blobUrl}
                title=""
                src={blobUrl}
                sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
                style={{
                  position: 'absolute',
                  inset: 0,
                  width: '100%',
                  height: '100%',
                  border: 'none',
                }}
              />
            )}
            {mediaKind === 'rtsp' && frameUrl && (
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.75rem',
                  padding: '2rem',
                  textAlign: 'center',
                  background: 'radial-gradient(ellipse at center, #14532d 0%, #020617 70%)',
                  color: '#cbd5e1',
                }}
              >
                <strong style={{ color: '#86efac', letterSpacing: '0.06em' }}>
                  STREAM RTSP
                </strong>
                <span style={{ fontSize: '0.875rem', maxWidth: '28rem' }}>
                  Pré-visualização CMS — o player em campo liga-se directamente à rede.
                </span>
                <code
                  style={{
                    fontSize: '0.75rem',
                    wordBreak: 'break-all',
                    padding: '0.35rem 0.6rem',
                    background: 'rgba(15,23,42,0.85)',
                    borderRadius: 6,
                  }}
                >
                  {maskStreamUrl(frameUrl)}
                </code>
              </div>
            )}
            {mediaKind === 'url' && frameUrl && (
              <iframe
                key={frameUrl}
                title=""
                src={frameUrl}
                sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
                referrerPolicy="no-referrer-when-downgrade"
                style={{
                  position: 'absolute',
                  inset: 0,
                  width: '100%',
                  height: '100%',
                  border: 'none',
                }}
              />
            )}
          </>
        ) : (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '2rem',
              textAlign: 'center',
            }}
          >
            <div
              style={{
                maxWidth: '28rem',
                padding: '1.5rem 1.75rem',
                background: 'rgba(15, 23, 42, 0.92)',
                border: '1px solid #1e293b',
                borderRadius: 10,
              }}
            >
              <p style={{ margin: 0, fontSize: '0.9375rem', color: '#94a3b8' }}>
                {hint ?? 'Sem conteúdo'}
              </p>
            </div>
          </div>
        )}
      </div>

      {hasMedia && hint && (
        <div
          aria-live="polite"
          style={{
            position: 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            zIndex: 10,
            padding: '0.5rem 1rem',
            background: 'linear-gradient(transparent, rgba(0,0,0,0.65))',
            fontSize: '0.8125rem',
            color: '#e2e8f0',
            textAlign: 'center',
            pointerEvents: 'none',
          }}
        >
          {hint}
        </div>
      )}
    </div>
  );
}
