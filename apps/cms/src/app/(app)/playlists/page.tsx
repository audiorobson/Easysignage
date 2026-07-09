'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, getToken } from '@/lib/api';
import { formatDateTimePtBr } from '@/lib/format-date';
import { PlaylistPreviewModal } from './PlaylistPreviewModal';

type PlaylistRow = {
  id: string;
  name: string;
  description: string | null;
  status: string;
  itemCount: number;
  createdAt: string;
  updatedAt: string;
};

export default function PlaylistsPage() {
  const router = useRouter();
  const [items, setItems] = useState<PlaylistRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const refreshList = useCallback(async () => {
    try {
      setError(null);
      const data = await api<PlaylistRow[]>('/playlists');
      setItems(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro');
    }
  }, []);

  useEffect(() => {
    if (!getToken()) {
      router.replace('/login');
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        setError(null);
        const data = await api<PlaylistRow[]>('/playlists');
        if (!cancelled) setItems(data);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Erro');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  async function deletePlaylist(id: string, name: string) {
    if (
      !confirm(
        `Eliminar a playlist «${name}»? Os itens desta sequência serão removidos.`
      )
    ) {
      return;
    }
    setDeletingId(id);
    setError(null);
    try {
      await api(`/playlists/${id}`, { method: 'DELETE' });
      setItems((prev) => (prev ? prev.filter((p) => p.id !== id) : prev));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro');
      await refreshList();
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <>
      <header className="page-header">
        <div>
          <h1>Playlists</h1>
          <p className="page-header__lead">
            Sequências de conteúdo (imagens, vídeo, HTML) para atribuir a dispositivos ou grupos.
          </p>
        </div>
        <div className="page-header__actions">
          <Link href="/playlists/new" className="btn btn--gradient">
            <i className="fa-solid fa-plus" aria-hidden />
            Nova playlist
          </Link>
        </div>
      </header>

      <section>
        {error && <p className="text-danger">{error}</p>}
        {!items && !error && <p className="text-muted">Carregando…</p>}
        {items && items.length === 0 && (
          <p className="text-muted">Nenhuma playlist. Crie uma para agrupar assets em sequência.</p>
        )}
        {items && items.length > 0 && (
          <div className="surface-table-card">
          <table className="data-table">
            <thead>
              <tr>
                <th>Nome</th>
                <th>Estado</th>
                <th>Itens</th>
                <th>Atualizado</th>
                <th style={{ width: 1, whiteSpace: 'nowrap' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {items.map((p) => (
                <tr key={p.id}>
                  <td>
                    <Link href={`/playlists/${p.id}`}>{p.name}</Link>
                  </td>
                  <td>{p.status}</td>
                  <td>{p.itemCount}</td>
                  <td>{formatDateTimePtBr(p.updatedAt)}</td>
                  <td>
                    <div
                      style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: '0.35rem',
                        alignItems: 'center',
                      }}
                    >
                      <button
                        type="button"
                        className="btn btn--ghost"
                        title="Modo teste — pré-visualizar"
                        onClick={() => setPreviewId(p.id)}
                      >
                        <i className="fa-solid fa-eye" aria-hidden />
                        <span className="sr-only">Pré-visualizar</span>
                      </button>
                      <Link
                        href={`/playlists/${p.id}`}
                        className="btn btn--ghost"
                        title="Editar playlist"
                      >
                        <i className="fa-solid fa-pen" aria-hidden />
                        <span className="sr-only">Editar</span>
                      </Link>
                      <button
                        type="button"
                        className="btn btn--ghost"
                        title="Eliminar playlist"
                        disabled={deletingId === p.id}
                        onClick={() => void deletePlaylist(p.id, p.name)}
                      >
                        {deletingId === p.id ? (
                          '…'
                        ) : (
                          <i className="fa-solid fa-trash" aria-hidden />
                        )}
                        <span className="sr-only">Eliminar</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </section>

      <PlaylistPreviewModal
        playlistId={previewId}
        onClose={() => setPreviewId(null)}
      />
    </>
  );
}
