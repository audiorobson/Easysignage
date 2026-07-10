'use client';

import Link from 'next/link';
import { type FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { api, getToken, uploadAssetMultipart } from '@/lib/api';
import type { SiteDetail } from '../site-types';

const TIMEZONES = [
  'America/Sao_Paulo',
  'America/Fortaleza',
  'America/Manaus',
  'Europe/Lisbon',
  'UTC',
  'America/New_York',
  'Europe/London',
];

export default function NewSitePage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [timezone, setTimezone] = useState('America/Sao_Paulo');
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!getToken()) router.replace('/login');
  }, [router]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const n = name.trim();
    if (!n) {
      setError('Indique o nome do espaço');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      let coverAssetId: string | undefined;
      if (coverFile) {
        const uploaded = (await uploadAssetMultipart(
          coverFile,
          `Capa ${n}`
        )) as { id: string };
        coverAssetId = uploaded.id;
      }
      const created = await api<SiteDetail>('/sites', {
        method: 'POST',
        body: JSON.stringify({
          name: n,
          ...(code.trim() ? { code: code.trim() } : {}),
          timezone,
          ...(coverAssetId ? { coverAssetId } : {}),
        }),
      });
      router.push(`/sites/${created.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Novo espaço"
        lead="Crie um local (loja, filial) para agrupar dispositivos. Opcionalmente adicione uma imagem de referência."
        actions={
          <Link href="/sites" className="btn btn--ghost">
            <ArrowLeft size={17} strokeWidth={1.9} aria-hidden />
            Voltar
          </Link>
        }
      />

      <form onSubmit={(e) => void onSubmit(e)} className="surface-form-card">
        <label className="field">
          <span>Nome</span>
          <input
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            placeholder="Loja Centro"
            autoComplete="off"
          />
        </label>
        <label className="field">
          <span>Código (opcional)</span>
          <input
            className="input"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="BR-SP-01"
            autoComplete="off"
          />
        </label>
        <label className="field">
          <span>Fuso horário</span>
          <select
            className="select"
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
          >
            {TIMEZONES.map((tz) => (
              <option key={tz} value={tz}>
                {tz}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Imagem do espaço (opcional)</span>
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            className="input"
            style={{ padding: 'var(--space-2)' }}
            onChange={(e) => setCoverFile(e.target.files?.[0] ?? null)}
          />
          <span className="text-muted" style={{ fontSize: 'var(--text-xs)' }}>
            É criado um asset de imagem no repositório e associado como capa.
          </span>
        </label>
        {error && <p className="text-danger">{error}</p>}
        <div className="form-actions">
          <button type="submit" className="btn btn--primary" disabled={loading}>
            {loading ? 'A criar…' : 'Criar espaço'}
          </button>
        </div>
      </form>
    </>
  );
}
