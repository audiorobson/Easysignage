'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
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
      <header className="page-header">
        <div>
          <h1>Novo dispositivo</h1>
          <p className="page-header__lead">
            Registe o player no site e obtenha um código de emparelhamento para o terminal.
          </p>
        </div>
        <div className="page-header__actions">
          <Link href="/devices" className="btn btn--ghost">
            <i className="fa-solid fa-arrow-left" aria-hidden />
            Voltar
          </Link>
        </div>
      </header>

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
            <option value="electron">electron</option>
            <option value="web">web</option>
            <option value="android_browser">android_browser</option>
            <option value="tv_browser">tv_browser</option>
          </select>
        </label>
        {error && <p className="text-danger">{error}</p>}
        <button type="submit" disabled={loading || !siteId} className="btn btn--gradient">
          {loading ? 'Criando…' : 'Criar e obter código'}
        </button>
      </form>
    </>
  );
}
