'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { api, getToken } from '@/lib/api';
import { PlaylistItemsTable } from './PlaylistItemsTable';

type ItemRow = {
  id: string;
  position: number;
  durationSec: number | null;
  asset: { id: string; name: string; kind: string; mimeType: string };
};

type PlaylistDetail = {
  id: string;
  name: string;
  description: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
  items: ItemRow[];
};

type AssetOption = { id: string; name: string };

export default function PlaylistDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [data, setData] = useState<PlaylistDetail | null>(null);
  const [assets, setAssets] = useState<AssetOption[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState('draft');
  const [saving, setSaving] = useState(false);
  const [selectedAssetId, setSelectedAssetId] = useState('');
  const [addDuration, setAddDuration] = useState('');
  const [adding, setAdding] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    const p = await api<PlaylistDetail>(`/playlists/${id}`);
    setData(p);
    setName(p.name);
    setDescription(p.description ?? '');
    setStatus(p.status);
  }, [id]);

  useEffect(() => {
    if (!getToken()) {
      router.replace('/login');
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        setError(null);
        await load();
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Erro');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router, load]);

  useEffect(() => {
    if (!getToken()) return;
    let cancelled = false;
    (async () => {
      try {
        const list = await api<AssetOption[]>('/assets');
        if (!cancelled) setAssets(list);
      } catch {
        if (!cancelled) setAssets([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function saveMeta(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await api(`/playlists/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          status: status.trim() || 'draft',
        }),
      });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro');
    } finally {
      setSaving(false);
    }
  }

  async function addItem() {
    if (!selectedAssetId) return;
    setAdding(true);
    setError(null);
    try {
      const body: { assetId: string; durationSec?: number } = {
        assetId: selectedAssetId,
      };
      const d = addDuration.trim();
      if (d) {
        const n = Number(d);
        if (n > 0) body.durationSec = Math.floor(n);
      }
      await api(`/playlists/${id}/items`, {
        method: 'POST',
        body: JSON.stringify(body),
      });
      setSelectedAssetId('');
      setAddDuration('');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro');
    } finally {
      setAdding(false);
    }
  }

  async function removePlaylist() {
    if (!confirm('Eliminar esta playlist? Os itens serão removidos.')) return;
    setDeleting(true);
    setError(null);
    try {
      await api(`/playlists/${id}`, { method: 'DELETE' });
      router.push('/playlists');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <header className="page-header">
        <div>
          <h1>Playlist</h1>
          <p className="page-header__lead">
            Editar metadados e ordenar itens (assets) na sequência de reprodução.
          </p>
        </div>
        <div className="page-header__actions">
          <Link href="/playlists" className="btn btn--ghost">
            <i className="fa-solid fa-arrow-left" aria-hidden />
            Lista
          </Link>
        </div>
      </header>

      <section>
        {error && <p className="text-danger">{error}</p>}
        {!data && !error && <p className="text-muted">Carregando…</p>}
        {data && (
          <>
            <form onSubmit={saveMeta} className="surface-form-card" style={{ marginBottom: 'var(--space-8)' }}>
              <label className="field">
                <span>Nome</span>
                <input
                  className="input"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </label>
              <label className="field">
                <span>Descrição</span>
                <textarea
                  className="input"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                />
              </label>
              <label className="field">
                <span>Estado</span>
                <select
                  className="select"
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                >
                  <option value="draft">draft</option>
                  <option value="published">published</option>
                </select>
              </label>
              <button type="submit" className="btn btn--primary" disabled={saving}>
                {saving ? 'A guardar…' : 'Guardar alterações'}
              </button>
            </form>

            <h2 style={{ fontSize: 'var(--text-md)', fontWeight: 600, margin: '0 0 var(--space-3)' }}>
              Itens (ordem de reprodução)
            </h2>

            <PlaylistItemsTable
              playlistId={id}
              items={data.items}
              onError={(msg) => setError(msg || null)}
              load={load}
            />

            <div
              className="surface-card"
              style={{ padding: 'var(--space-4)', maxWidth: 560 }}
            >
              <h3 style={{ fontSize: 'var(--text-sm)', fontWeight: 600, margin: '0 0 var(--space-3)' }}>
                Adicionar asset
              </h3>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)', alignItems: 'end' }}>
                <label className="field" style={{ flex: '1 1 200px', margin: 0 }}>
                  <span>Asset</span>
                  <select
                    className="select"
                    value={selectedAssetId}
                    onChange={(e) => setSelectedAssetId(e.target.value)}
                  >
                    <option value="">Escolher…</option>
                    {assets.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field" style={{ width: 120, margin: 0 }}>
                  <span>Duração s (opc.)</span>
                  <input
                    className="input"
                    type="number"
                    min={1}
                    value={addDuration}
                    onChange={(e) => setAddDuration(e.target.value)}
                    placeholder="10"
                  />
                </label>
                <button
                  type="button"
                  className="btn btn--primary"
                  disabled={!selectedAssetId || adding}
                  onClick={() => void addItem()}
                >
                  {adding ? 'A adicionar…' : 'Adicionar'}
                </button>
              </div>
              {assets.length === 0 && (
                <p className="text-muted" style={{ marginTop: 'var(--space-3)' }}>
                  Sem assets.{' '}
                  <Link href="/assets" style={{ textDecoration: 'underline' }}>
                    Enviar imagens em Assets
                  </Link>
                  .
                </p>
              )}
            </div>

            <p style={{ marginTop: 'var(--space-8)' }}>
              <button
                type="button"
                className="btn btn--ghost"
                disabled={deleting}
                onClick={() => void removePlaylist()}
              >
                {deleting ? 'A eliminar…' : 'Eliminar playlist'}
              </button>
            </p>
          </>
        )}
      </section>
    </>
  );
}
