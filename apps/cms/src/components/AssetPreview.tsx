'use client';

import { useEffect, useRef, useState } from 'react';
import { API_BASE, fetchApi, getToken } from '@/lib/api';

/** Dados mínimos para pré-visualização na grelha CMS */
export type AssetPreviewModel = {
  id: string;
  kind: string;
  mimeType: string;
  thumbnailKey?: string | null;
  remoteUrl?: string | null;
  /** Tamanho em bytes (string da API); usado para limitar fetch inline */
  fileSize?: string;
};

type Props = {
  asset: AssetPreviewModel;
  /** Lado do quadrado em px */
  size?: number;
};

const MAX_INLINE_IMAGE_BYTES = 2.5 * 1024 * 1024;

function kindIconClass(kind: string): string {
  switch (kind) {
    case 'image':
      return 'fa-image';
    case 'video':
      return 'fa-film';
    case 'pdf':
      return 'fa-file-pdf';
    case 'html':
      return 'fa-file-code';
    case 'url':
      return 'fa-link';
    default:
      return 'fa-file';
  }
}

function kindAccent(kind: string): string {
  switch (kind) {
    case 'video':
      return 'linear-gradient(145deg, #312e81 0%, #4c1d95 100%)';
    case 'pdf':
      return 'linear-gradient(145deg, #7f1d1d 0%, #b91c1c 100%)';
    case 'html':
      return 'linear-gradient(145deg, #78350f 0%, #b45309 100%)';
    case 'url':
      return 'linear-gradient(145deg, #1e3a5f 0%, #2563eb 100%)';
    case 'image':
      return 'linear-gradient(145deg, #334155 0%, #475569 100%)';
    default:
      return 'var(--color-surface-muted, #e2e8f0)';
  }
}

function PlaceholderIcon({
  kind,
  size,
}: {
  kind: string;
  size: number;
}) {
  const icon = kindIconClass(kind);
  const isLightIcon = ['pdf', 'video', 'html', 'url', 'image'].includes(kind);
  return (
    <span
      role="img"
      aria-label={kind}
      style={{
        display: 'inline-flex',
        width: size,
        height: size,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: size >= 64 ? 12 : 8,
        border: '1px solid var(--color-border, #e2e8f0)',
        background: kindAccent(kind),
        color: isLightIcon ? 'rgba(255,255,255,0.92)' : 'var(--color-text-muted, #64748b)',
        fontSize: Math.max(14, Math.round(size * 0.38)),
        flexShrink: 0,
      }}
    >
      <i className={`fa-solid ${icon}`} aria-hidden />
    </span>
  );
}

export function AssetPreview({ asset, size = 48 }: Props) {
  const [thumbSrc, setThumbSrc] = useState<string | null>(null);
  const [thumbFailed, setThumbFailed] = useState(false);
  const [inlineSrc, setInlineSrc] = useState<string | null>(null);
  const thumbBlobRef = useRef<string | null>(null);
  const inlineBlobRef = useRef<string | null>(null);

  const hasApiThumbnail = Boolean(asset.thumbnailKey);

  const fileSizeNum = asset.fileSize ? Number(asset.fileSize) : NaN;
  const canTryInlineImage =
    asset.kind === 'image' &&
    !asset.remoteUrl &&
    (asset.mimeType === 'image/svg+xml' ||
      (!Number.isNaN(fileSizeNum) && fileSizeNum > 0 && fileSizeNum <= MAX_INLINE_IMAGE_BYTES));

  useEffect(() => {
    setThumbFailed(false);
  }, [asset.id, asset.thumbnailKey]);

  useEffect(() => {
    if (!hasApiThumbnail) return;
    let cancelled = false;
    const token = getToken();
    if (!token) return;

    (async () => {
      try {
        const res = await fetchApi(`${API_BASE}/assets/${asset.id}/thumbnail`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (cancelled) return;
        if (!res.ok) {
          setThumbFailed(true);
          return;
        }
        const blob = await res.blob();
        if (cancelled) return;
        if (thumbBlobRef.current) {
          URL.revokeObjectURL(thumbBlobRef.current);
          thumbBlobRef.current = null;
        }
        const u = URL.createObjectURL(blob);
        thumbBlobRef.current = u;
        setThumbSrc(u);
      } catch {
        if (!cancelled) setThumbFailed(true);
      }
    })();

    return () => {
      cancelled = true;
      if (thumbBlobRef.current) {
        URL.revokeObjectURL(thumbBlobRef.current);
        thumbBlobRef.current = null;
      }
      setThumbSrc(null);
    };
  }, [asset.id, hasApiThumbnail]);

  useEffect(() => {
    const allowInline =
      canTryInlineImage && (!hasApiThumbnail || thumbFailed);
    if (!allowInline) return;
    let cancelled = false;
    const token = getToken();
    if (!token) return;

    (async () => {
      try {
        const res = await fetchApi(`${API_BASE}/assets/${asset.id}/file`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok || cancelled) return;
        const blob = await res.blob();
        if (cancelled) return;
        if (!blob.type.startsWith('image/')) return;
        if (inlineBlobRef.current) {
          URL.revokeObjectURL(inlineBlobRef.current);
          inlineBlobRef.current = null;
        }
        const u = URL.createObjectURL(blob);
        inlineBlobRef.current = u;
        setInlineSrc(u);
      } catch {
        /* ignore */
      }
    })();

    return () => {
      cancelled = true;
      if (inlineBlobRef.current) {
        URL.revokeObjectURL(inlineBlobRef.current);
        inlineBlobRef.current = null;
      }
      setInlineSrc(null);
    };
  }, [asset.id, hasApiThumbnail, canTryInlineImage, thumbFailed]);

  const showImg = thumbSrc ?? inlineSrc;

  if (showImg) {
    return (
      <img
        src={showImg}
        alt=""
        width={size}
        height={size}
        style={{
          width: size,
          height: size,
          objectFit: 'cover',
          borderRadius: size >= 64 ? 12 : 8,
          verticalAlign: 'middle',
          border: '1px solid var(--color-border, #e2e8f0)',
          background: '#0f172a',
        }}
      />
    );
  }

  if (hasApiThumbnail && !thumbSrc && !thumbFailed) {
    return (
      <span
        className="text-muted"
        style={{
          display: 'inline-flex',
          width: size,
          height: size,
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 11,
        }}
      >
        …
      </span>
    );
  }

  return <PlaceholderIcon kind={asset.kind} size={size} />;
}
