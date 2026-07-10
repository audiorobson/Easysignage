'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { api, getToken } from '@/lib/api';

type SiteOption = { id: string; name: string };
type PlaylistOption = { id: string; name: string };

export default function NewVideoWallPage() {
  const router = useRouter();
  const [sites, setSites] = useState<SiteOption[]>([]);
  const [playlists, setPlaylists] = useState<PlaylistOption[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState('');
  const [siteId, setSiteId] = useState('');
  const [gridRows, setGridRows] = useState(1);
  const [gridCols, setGridCols] = useState(2);
  const [playlistId, setPlaylistId] = useState('');

  useEffect(() => {
    if (!getToken()) {
      router.replace('/login');
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const [s, p] = await Promise.all([
          api<SiteOption[]>('/sites'),
          api<PlaylistOption[]>('/playlists'),
        ]);
        if (cancelled) return;
        setSites(s);
        setPlaylists(p);
        if (s[0]) setSiteId(s[0].id);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Erro');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const created = await api<{ id: string }>('/video-walls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          siteId,
          gridRows,
          gridCols,
          ...(playlistId ? { playlistId } : {}),
        }),
      });
      router.push(`/video-walls/${created.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao criar');
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Nova video wall"
        lead="Defina o site e a grelha. Depois mapeie cada device a uma célula."
        actions={
          <Link href="/video-walls" className="btn btn--ghost">
            <ArrowLeft strokeWidth={2} aria-hidden />
            Voltar
          </Link>
        }
      />

      <section className="panel" style={{ maxWidth: 520 }}>
        {error && <p className="text-danger">{error}</p>}
        <form onSubmit={onSubmit} className="form-stack">
          <label>
            <span>Nome</span>
            <input
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              maxLength={120}
            />
          </label>
          <label>
            <span>Site</span>
            <select
              className="input"
              value={siteId}
              onChange={(e) => setSiteId(e.target.value)}
              required
            >
              {sites.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <label>
              <span>Linhas</span>
              <input
                className="input"
                type="number"
                min={1}
                max={8}
                value={gridRows}
                onChange={(e) => setGridRows(Number(e.target.value))}
                required
              />
            </label>
            <label>
              <span>Colunas</span>
              <input
                className="input"
                type="number"
                min={1}
                max={8}
                value={gridCols}
                onChange={(e) => setGridCols(Number(e.target.value))}
                required
              />
            </label>
          </div>
          <label>
            <span>Playlist (opcional)</span>
            <select
              className="input"
              value={playlistId}
              onChange={(e) => setPlaylistId(e.target.value)}
            >
              <option value="">— Definir depois —</option>
              {playlists.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" className="btn btn--primary" disabled={saving || !name.trim()}>
            {saving ? 'A criar…' : 'Criar parede'}
          </button>
        </form>
      </section>
    </>
  );
}
