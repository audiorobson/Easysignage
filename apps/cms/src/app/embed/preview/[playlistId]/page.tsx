'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { PlaylistEmbedPlayer } from '@/components/PlaylistEmbedPlayer';

const MSG_TOKEN = 'easysignage:cms-preview-token';
const MSG_READY = 'easysignage:cms-preview-ready';

export default function PlaylistEmbedPreviewPage() {
  const params = useParams();
  const playlistId = typeof params.playlistId === 'string' ? params.playlistId : '';
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (e.origin !== window.location.origin) return;
      if (e.data?.type === MSG_TOKEN && typeof e.data.token === 'string') {
        setToken(e.data.token);
      }
    }
    window.addEventListener('message', onMessage);
    if (window.parent !== window) {
      window.parent.postMessage({ type: MSG_READY }, window.location.origin);
    }
    return () => window.removeEventListener('message', onMessage);
  }, []);

  if (!playlistId) {
    return (
      <p style={{ color: '#94a3b8', padding: '1rem', margin: 0 }}>
        Playlist inválida.
      </p>
    );
  }

  if (!token) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#94a3b8',
          fontSize: '0.9375rem',
        }}
      >
        A aguardar sessão do CMS…
      </div>
    );
  }

  return <PlaylistEmbedPlayer playlistId={playlistId} accessToken={token} />;
}
