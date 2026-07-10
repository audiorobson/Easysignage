'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Pencil, Trash2, MonitorPlay, Globe, Tv } from 'lucide-react';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatusPill, ConnectionPill } from '@/components/ui/StatusPill';
import { EmptyState } from '@/components/ui/EmptyState';
import { platformLabel, deviceState } from '@/lib/device-labels';
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

function PlatformIcon({ platform }: { platform: string }) {
  const Icon =
    platform === 'web'
      ? Globe
      : platform === 'tv_browser' || platform === 'android_browser'
        ? Tv
        : MonitorPlay;
  return (
    <span
      style={{
        width: 36,
        height: 36,
        borderRadius: 10,
        background: 'var(--color-surface-muted)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--color-text-muted)',
        flexShrink: 0,
      }}
    >
      <Icon size={18} strokeWidth={1.8} aria-hidden />
    </span>
  );
}

export default function DevicesPage() {
  const router = useRouter();
  const [items, setItems] = useState<DeviceRow[] | null>(null);
  const [sites, setSites] = useState<SiteOption[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<DeviceRow | null>(null);
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

  async function onDeleteConfirmed() {
    const d = confirmDelete;
    if (!d) return;
    setError(null);
    setDeletingId(d.id);
    try {
      await api(`/devices/${d.id}`, { method: 'DELETE' });
      setConfirmDelete(null);
      await loadDevices();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao eliminar');
    } finally {
      setDeletingId(null);
    }
  }

  const total = items?.length ?? 0;
  const onlineCount = items?.filter((d) => isOnline(d.lastSeenAt)).length ?? 0;

  return (
    <>
      <PageHeader
        title="Dispositivos"
        lead="Inventário de players, estado de ligação e último heartbeat por site."
        actions={
          <Link href="/devices/new" className="btn btn--primary">
            <Plus strokeWidth={2.1} aria-hidden />
            Novo dispositivo
          </Link>
        }
      />

      <div className="surface-filters">
        <div className="filter-pills" role="group" aria-label="Conexão">
          <button
            type="button"
            className={online === '' ? 'is-active' : ''}
            onClick={() => setOnline('')}
          >
            Todos {total}
          </button>
          <button
            type="button"
            className={online === 'true' ? 'is-active' : ''}
            onClick={() => setOnline('true')}
          >
            Online {onlineCount}
          </button>
          <button
            type="button"
            className={online === 'false' ? 'is-active' : ''}
            onClick={() => setOnline('false')}
          >
            Offline {total - onlineCount}
          </button>
        </div>
        <div style={{ flex: 1 }} />
        <select
          className="select"
          value={siteId}
          onChange={(e) => setSiteId(e.target.value)}
          aria-label="Site"
        >
          <option value="">Todos os sites</option>
          {sites.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <select
          className="select"
          value={platform}
          onChange={(e) => setPlatform(e.target.value)}
          aria-label="Plataforma"
        >
          <option value="">Todas as plataformas</option>
          <option value="electron">Player Desktop</option>
          <option value="web">Navegador Web</option>
          <option value="android_browser">Android TV</option>
          <option value="tv_browser">Smart TV</option>
        </select>
        <select
          className="select"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          aria-label="Estado cadastral"
        >
          <option value="">Todos os estados</option>
          <option value="active">Ativo</option>
          <option value="provisioned">Provisionado</option>
          <option value="disabled">Desativado</option>
        </select>
      </div>

      {error && <p className="text-danger">{error}</p>}
      {items === null && !error && <p className="text-muted">A carregar…</p>}
      {items && items.length === 0 && (
        <EmptyState
          title="Nenhum dispositivo"
          description="Crie um dispositivo e use o código de pareamento no player."
          action={
            <Link href="/devices/new" className="btn btn--primary">
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
                <th>Dispositivo</th>
                <th>Site</th>
                <th>Plataforma</th>
                <th>Estado</th>
                <th>Conexão</th>
                <th>Último heartbeat</th>
                <th style={{ textAlign: 'right' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {items.map((d) => {
                const st = deviceState(d.status);
                return (
                  <tr key={d.id}>
                    <td>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 12,
                        }}
                      >
                        <PlatformIcon platform={d.platform} />
                        <div>
                          <div className="cell-primary">
                            <Link href={`/devices/${d.id}?tab=ecra`}>{d.name}</Link>
                          </div>
                          <div className="cell-sub">{d.id.slice(0, 8)}</div>
                        </div>
                      </div>
                    </td>
                    <td>{d.siteName ?? d.siteId}</td>
                    <td>{platformLabel(d.platform)}</td>
                    <td>
                      <StatusPill label={st.label} tone={st.tone} />
                    </td>
                    <td>
                      <ConnectionPill
                        state={isOnline(d.lastSeenAt) ? 'on' : 'off'}
                      />
                    </td>
                    <td className="cell-sub">
                      {formatDateTimePtBr(d.lastSeenAt)}
                    </td>
                    <td>
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'flex-end',
                          gap: 6,
                        }}
                      >
                        <Link
                          href={`/devices/${d.id}?tab=ecra`}
                          className="btn btn--icon"
                          aria-label="Ecrã e layout"
                          title="Ecrã e layout"
                        >
                          <Pencil aria-hidden />
                        </Link>
                        <button
                          type="button"
                          className="btn btn--icon"
                          aria-label="Eliminar"
                          title="Eliminar"
                          disabled={deletingId === d.id}
                          onClick={() => setConfirmDelete(d)}
                          style={{ color: 'var(--color-danger-text)' }}
                        >
                          <Trash2 aria-hidden />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {items && items.length > 0 && (
        <div className="table-footer">
          <span>
            A mostrar {items.length} de {items.length} dispositivos
          </span>
        </div>
      )}

      <ConfirmDialog
        open={confirmDelete !== null}
        title="Eliminar dispositivo"
        message={
          confirmDelete
            ? `Eliminar «${confirmDelete.name}»? Esta ação não pode ser desfeita.`
            : ''
        }
        confirmLabel="Eliminar"
        cancelLabel="Cancelar"
        loading={deletingId !== null}
        onConfirm={() => void onDeleteConfirmed()}
        onCancel={() => setConfirmDelete(null)}
      />
    </>
  );
}
