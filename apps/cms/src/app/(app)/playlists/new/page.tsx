'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, getToken } from '@/lib/api';

export default function NewPlaylistPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!getToken()) router.replace('/login');
  }, [router]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await api<{ id: string }>('/playlists', {
        method: 'POST',
        body: JSON.stringify({
          name: name.trim(),
          ...(description.trim() ? { description: description.trim() } : {}),
        }),
      });
      router.push(`/playlists/${res.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <header className="page-header">
        <div>
          <h1>Nova playlist</h1>
          <p className="page-header__lead">
            Defina um nome e, opcionalmente, uma descrição interna para a sequência de conteúdos.
          </p>
        </div>
        <div className="page-header__actions">
          <Link href="/playlists" className="btn btn--ghost">
            <i className="fa-solid fa-arrow-left" aria-hidden />
            Voltar
          </Link>
        </div>
      </header>

      <form onSubmit={onSubmit} className="surface-form-card">
        <label className="field">
          <span>Nome</span>
          <input
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            placeholder="Loop receção"
          />
        </label>
        <label className="field">
          <span>Descrição (opcional)</span>
          <textarea
            className="input"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder="Notas internas"
          />
        </label>
        {error && <p className="text-danger">{error}</p>}
        <button type="submit" disabled={loading || !name.trim()} className="btn btn--gradient">
          {loading ? 'Criando…' : 'Criar playlist'}
        </button>
      </form>
    </>
  );
}
