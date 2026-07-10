'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { PLATFORM_OPTIONS } from '@/lib/device-labels';
import { api, getToken } from '@/lib/api';

type Site = { id: string; name: string };

export default function NewDevicePage() {
  const router = useRouter();
  const [sites, setSites] = useState<Site[]>([]);
  const [siteId, setSiteId] = useState('');
  const [name, setName] = useState('');
  const [platform, setPlatform] = useState('electron');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!getToken()) {
      router.replace('/login');
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const data = await api<Site[]>('/sites');
        if (!cancelled && data.length) {
          setSites(data);
          setSiteId(data[0]!.id);
        }
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await api<{
        pairingCode: string;
        pairingExpiresAt: string;
        device: { id: string };
      }>('/devices', {
        method: 'POST',
        body: JSON.stringify({ siteId, name, platform }),
      });
      const q = new URLSearchParams({
        pairing: res.pairingCode,
        exp: res.pairingExpiresAt,
      });
      router.push(`/devices/${res.device.id}?${q.toString()}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Novo dispositivo"
        lead="Registe o player no site e obtenha um código de emparelhamento para o terminal."
        actions={
          <Link href="/devices" className="btn btn--ghost">
            <ArrowLeft size={17} strokeWidth={1.9} aria-hidden />
            Voltar
          </Link>
        }
      />

      <form onSubmit={onSubmit} className="surface-form-card">
        <label className="field">
          <span>Site</span>
          <select
            className="select"
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
        <label className="field">
          <span>Nome</span>
          <input
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            placeholder="Player recepção"
          />
        </label>
        <label className="field">
          <span>Plataforma esperada</span>
          <select
            className="select"
            value={platform}
            onChange={(e) => setPlatform(e.target.value)}
          >
            {PLATFORM_OPTIONS.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        {error && <p className="text-danger">{error}</p>}
        <button type="submit" disabled={loading || !siteId} className="btn btn--primary">
          {loading ? 'A criar…' : 'Criar e obter código'}
        </button>
      </form>
    </>
  );
}
