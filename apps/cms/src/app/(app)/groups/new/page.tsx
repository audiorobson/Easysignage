'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, getToken } from '@/lib/api';

export default function NewGroupPage() {
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
      const res = await api<{ id: string }>('/groups', {
        method: 'POST',
        body: JSON.stringify({
          name: name.trim(),
          ...(description.trim() ? { description: description.trim() } : {}),
        }),
      });
      router.push(`/groups/${res.id}`);
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
          <h1>Novo grupo</h1>
          <p className="page-header__lead">
            Crie um conjunto de dispositivos para publicações e testes em bloco.
          </p>
        </div>
        <div className="page-header__actions">
          <Link href="/groups" className="btn btn--ghost">
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
            autoComplete="off"
          />
        </label>
        <label className="field">
          <span>Descrição (opcional)</span>
          <textarea
            className="input"
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </label>
        {error && <p className="text-danger">{error}</p>}
        <div className="page-header__actions" style={{ marginTop: 'var(--space-4)' }}>
          <button type="submit" className="btn btn--gradient" disabled={loading}>
            {loading ? 'A criar…' : 'Criar grupo'}
          </button>
        </div>
      </form>
    </>
  );
}
