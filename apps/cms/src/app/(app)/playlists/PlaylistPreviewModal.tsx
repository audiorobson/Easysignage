'use client';

import { useCallback, useEffect, useRef } from 'react';
import { X } from 'lucide-react';
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
      className="modal-overlay"
      role="presentation"
      tabIndex={-1}
      onClick={onClose}
      onKeyDown={(e) => {
        if (e.key === 'Escape') onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="playlist-preview-title"
        className="modal-dialog modal-dialog--preview"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-preview-toolbar">
          <div>
            <h2 id="playlist-preview-title">Pré-visualização (player)</h2>
            <p className="text-muted">
              Mesmo fluxo que o web player: manifest + ficheiros da API.
            </p>
          </div>
          <button
            type="button"
            className="btn btn--ghost"
            onClick={onClose}
            aria-label="Fechar"
          >
            <X size={18} strokeWidth={2} aria-hidden />
          </button>
        </div>
        <iframe
          ref={iframeRef}
          title="Pré-visualização da playlist"
          src={`/embed/preview/${playlistId}`}
          onLoad={sendTokenToIframe}
          className="modal-preview-frame"
        />
      </div>
    </div>
  );
}
