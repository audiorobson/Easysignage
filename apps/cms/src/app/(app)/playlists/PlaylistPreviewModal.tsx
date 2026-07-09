'use client';

import { useCallback, useEffect, useRef } from 'react';
import { getToken } from '@/lib/api';

const MSG_TOKEN = 'easysignage:cms-preview-token';
const MSG_READY = 'easysignage:cms-preview-ready';

type Props = {
  playlistId: string | null;
  onClose: () => void;
};

export function PlaylistPreviewModal({ playlistId, onClose }: Props) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const sendTokenToIframe = useCallback(() => {
    const t = getToken();
    const w = iframeRef.current?.contentWindow;
    if (!t || !w) return;
    w.postMessage({ type: MSG_TOKEN, token: t }, window.location.origin);
  }, []);

  useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (e.origin !== window.location.origin) return;
      if (e.data?.type === MSG_READY) {
        sendTokenToIframe();
      }
    }
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [sendTokenToIframe]);

  useEffect(() => {
    if (!playlistId) return;
    const t = window.setTimeout(sendTokenToIframe, 150);
    return () => window.clearTimeout(t);
  }, [playlistId, sendTokenToIframe]);

  useEffect(() => {
    if (!playlistId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [playlistId, onClose]);

  if (!playlistId) return null;

  return (
    <div
      role="presentation"
      tabIndex={-1}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        background: 'rgba(15, 23, 42, 0.55)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
      }}
      onClick={onClose}
      onKeyDown={(e) => {
        if (e.key === 'Escape') onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="playlist-preview-title"
        style={{
          width: '100%',
          maxWidth: 'min(1100px, 96vw)',
          height: 'min(78vh, 720px)',
          background: '#020617',
          borderRadius: 'var(--radius-md, 14px)',
          border: '1px solid var(--color-border, #e2e8f0)',
          boxShadow: 'var(--shadow-lg, 0 16px 40px rgba(15,23,42,0.2))',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '1rem',
            padding: '0.65rem 1rem',
            background: 'var(--color-surface, #fff)',
            borderBottom: '1px solid var(--color-border, #e2e8f0)',
          }}
        >
          <div>
            <h2
              id="playlist-preview-title"
              style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}
            >
              Pré-visualização (player)
            </h2>
            <p className="text-muted" style={{ margin: '0.2rem 0 0', fontSize: '0.8125rem' }}>
              Mesmo fluxo que o web player: manifest + ficheiros da API.
            </p>
          </div>
          <button
            type="button"
            className="btn btn--ghost"
            onClick={onClose}
            aria-label="Fechar"
          >
            <i className="fa-solid fa-xmark" aria-hidden />
          </button>
        </div>
        <iframe
          ref={iframeRef}
          title="Pré-visualização da playlist"
          src={`/embed/preview/${playlistId}`}
          onLoad={sendTokenToIframe}
          style={{
            flex: 1,
            width: '100%',
            border: 'none',
            minHeight: 0,
            background: '#020617',
          }}
        />
      </div>
    </div>
  );
}
