'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ConnectionBadge } from '@/components/ui/StatusBadge';
import { EmptyState } from '@/components/ui/EmptyState';
import { api, getToken } from '@/lib/api';
import { formatDateTimePtBr } from '@/lib/format-date';

const ONLINE_MS = 5 * 60 * 1000;

type SiteOption = { id: string; name: string };

type DeviceRow = {
  id: string;
  name: string;
  siteId: string;
  siteName?: string;
  platform: string;
  status: string;
  lastSeenAt: string | null;
  runtimeVersion?: string | null;
};

function isOnline(lastSeenAt: string | null): boolean {
  if (!lastSeenAt) return false;
  return new Date(lastSeenAt).getTime() >= Date.now() - ONLINE_MS;
}

export default function DevicesPage() {
  const router = useRouter();
  const [items, setItems] = useState<DeviceRow[] | null>(null);
  const [sites, setSites] = useState<SiteOption[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [siteId, setSiteId] = useState('');
  const [platform, setPlatform] = useState('');
  const [status, setStatus] = useState('');
  const [online, setOnline] = useState('');

  const query = useMemo(() => {
    const p = new URLSearchParams();
    if (siteId) p.set('siteId', siteId);
    if (platform) p.set('platform', platform);
    if (status) p.set('status', status);
    if (online === 'true' || online === 'false') p.set('online', online);
    const s = p.toString();
    return s ? `?${s}` : '';
  }, [siteId, platform, status, online]);

  const loadDevices = useCallback(async () => {
    const data = await api<DeviceRow[]>(`/devices${query}`);
    setItems(data);
  }, [query]);

  useEffect(() => {
    if (!getToken()) {
      router.replace('/login');
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const list = await api<SiteOption[]>('/sites');
        if (!cancelled) setSites(list);
      } catch {
        if (!cancelled) setSites([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  useEffect(() => {
    if (!getToken()) return;
    let cancelled = false;
    (async () => {
      try {
        setError(null);
        await loadDevices();
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Erro');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router, loadDevices]);

  async function onDelete(d: DeviceRow) {
    const ok = window.confirm(
      `Eliminar o dispositivo «${d.name}»? Esta ação não pode ser desfeita.`
    );
    if (!ok) return;
    setError(null);
    setDeletingId(d.id);
    try {
      await api(`/devices/${d.id}`, { method: 'DELETE' });
      await loadDevices();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao eliminar');
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <>
      <header className="page-header">
        <div>
          <h1>Dispositivos</h1>
          <p className="page-header__lead">
            Inventário de players, estado de ligação e último heartbeat por site.
          </p>
        </div>
        <div className="page-header__actions">
          <Link href="/devices/new" className="btn btn--gradient">
            <i className="fa-solid fa-plus" aria-hidden />
            Novo dispositivo
          </Link>
        </div>
      </header>

      <div className="surface-filters surface-filters--grid">
        <label className="field" style={{ marginBottom: 0 }}>
          <span>Site</span>
          <select
            className="select"
            value={siteId}
            onChange={(e) => setSiteId(e.target.value)}
          >
            <option value="">Todos</option>
            {sites.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field" style={{ marginBottom: 0 }}>
          <span>Plataforma</span>
          <select
            className="select"
            value={platform}
            onChange={(e) => setPlatform(e.target.value)}
          >
            <option value="">Todas</option>
            <option value="electron">electron</option>
            <option value="web">web</option>
            <option value="android_browser">android_browser</option>
            <option value="tv_browser">tv_browser</option>
            <option value="unknown">unknown</option>
          </select>
        </label>
        <label className="field" style={{ marginBottom: 0 }}>
          <span>Status cadastral</span>
          <select
            className="select"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="">Todos</option>
            <option value="provisioned">provisioned</option>
            <option value="active">active</option>
            <option value="disabled">disabled</option>
          </select>
        </label>
        <label className="field" style={{ marginBottom: 0 }}>
          <span>Conexão (heartbeat)</span>
          <select
            className="select"
            value={online}
            onChange={(e) => setOnline(e.target.value)}
          >
            <option value="">Todas</option>
            <option value="true">Online</option>
            <option value="false">Offline</option>
          </select>
        </label>
      </div>

      {error && <p className="text-danger">{error}</p>}
      {items === null && !error && <p className="text-muted">Carregando…</p>}
      {items && items.length === 0 && (
        <EmptyState
          title="Nenhum dispositivo"
          description="Crie um dispositivo e use o código de pareamento no player."
          action={
            <Link href="/devices/new" className="btn btn--gradient">
              Novo dispositivo
            </Link>
          }
        />
      )}
      {items && items.length > 0 && (
        <div className="surface-table-card">
        <table className="data-table">
          <thead>
            <tr>
              <th>Nome</th>
              <th>Site</th>
              <th>Plataforma</th>
              <th>Status</th>
              <th>Conexão</th>
              <th>Último heartbeat</th>
              <th style={{ width: 200, textAlign: 'right' }}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {items.map((d) => (
              <tr key={d.id}>
                <td>
                  <Link href={`/devices/${d.id}`}>{d.name}</Link>
                </td>
                <td>{d.siteName ?? d.siteId}</td>
                <td>{d.platform}</td>
                <td>{d.status}</td>
                <td>
                  <ConnectionBadge online={isOnline(d.lastSeenAt)} />
                </td>
                <td>{formatDateTimePtBr(d.lastSeenAt)}</td>
                <td style={{ textAlign: 'right' }}>
                  <Link
                    href={`/devices/${d.id}`}
                    className="btn btn--ghost"
                    style={{ fontSize: '0.875rem', marginRight: 6 }}
                  >
                    Editar
                  </Link>
                  <button
                    type="button"
                    className="btn btn--ghost"
                    style={{ fontSize: '0.875rem', color: 'var(--color-danger-text)' }}
                    disabled={deletingId === d.id}
                    onClick={() => void onDelete(d)}
                  >
                    {deletingId === d.id ? 'A remover…' : 'Eliminar'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      )}
    </>
  );
}
