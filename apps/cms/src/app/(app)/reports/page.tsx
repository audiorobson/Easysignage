'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Download, FileBarChart } from 'lucide-react';
import {
  PLAYBACK_EVENT_TYPES,
  playbackEventTypeLabelPt,
  playbackItemTypeLabelPt,
  type PlaybackEventType,
  type PlaybackLogPage,
} from '@easysignage/shared-types';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { API_BASE, api, fetchApi, getToken } from '@/lib/api';
import { formatDateTimePtBr } from '@/lib/format-date';

type DeviceOption = { id: string; name: string };

const PAGE_SIZE = 50;

export default function ReportsPage() {
  const router = useRouter();
  const [devices, setDevices] = useState<DeviceOption[]>([]);
  const [deviceId, setDeviceId] = useState('');
  const [eventType, setEventType] = useState<PlaybackEventType | ''>('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<PlaybackLogPage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const query = useMemo(() => {
    const p = new URLSearchParams();
    if (deviceId) p.set('deviceId', deviceId);
    if (eventType) p.set('eventType', eventType);
    if (from) p.set('from', new Date(from).toISOString());
    if (to) p.set('to', new Date(to).toISOString());
    return p;
  }, [deviceId, eventType, from, to]);

  const load = useCallback(async () => {
    const p = new URLSearchParams(query);
    p.set('page', String(page));
    p.set('pageSize', String(PAGE_SIZE));
    const data = await api<PlaybackLogPage>(`/monitoring/playback-logs?${p.toString()}`);
    setResult(data);
  }, [query, page]);

  useEffect(() => {
    if (!getToken()) {
      router.replace('/login');
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const list = await api<DeviceOption[]>('/devices');
        if (!cancelled) setDevices(list);
      } catch {
        if (!cancelled) setDevices([]);
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
        await load();
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Erro');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [deviceId, eventType, from, to]);

  async function onExport() {
    setError(null);
    setExporting(true);
    try {
      const token = getToken();
      const res = await fetchApi(`${API_BASE}/monitoring/playback-logs/export.csv?${query.toString()}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (!res.ok) throw new Error(`Erro HTTP ${res.status} ao exportar CSV`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'playback-logs.csv';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao exportar CSV');
    } finally {
      setExporting(false);
    }
  }

  const rows = result?.rows ?? null;
  const total = result?.total ?? 0;
  const totalPages = total > 0 ? Math.max(1, Math.ceil(total / PAGE_SIZE)) : 1;

  return (
    <>
      <PageHeader
        title="Relatórios"
        lead="Proof-of-play: histórico de exibições reportadas pelos players, com filtros e export CSV."
        actions={
          <button
            type="button"
            className="btn btn--primary"
            disabled={exporting || total === 0}
            onClick={() => void onExport()}
          >
            <Download strokeWidth={2.1} aria-hidden />
            {exporting ? 'A exportar…' : 'Exportar CSV'}
          </button>
        }
      />

      <div className="surface-filters">
        <select
          className="select"
          value={deviceId}
          onChange={(e) => setDeviceId(e.target.value)}
          aria-label="Dispositivo"
        >
          <option value="">Todos os dispositivos</option>
          {devices.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
        <select
          className="select"
          value={eventType}
          onChange={(e) => setEventType(e.target.value as PlaybackEventType | '')}
          aria-label="Tipo de evento"
        >
          <option value="">Todos os eventos</option>
          {PLAYBACK_EVENT_TYPES.map((t) => (
            <option key={t} value={t}>
              {playbackEventTypeLabelPt(t)}
            </option>
          ))}
        </select>
        <input
          type="datetime-local"
          className="select"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          aria-label="A partir de"
        />
        <input
          type="datetime-local"
          className="select"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          aria-label="Até"
        />
      </div>

      {error && <p className="text-danger">{error}</p>}
      {rows === null && !error && <p className="text-muted">A carregar…</p>}
      {rows && rows.length === 0 && (
        <EmptyState
          title="Sem eventos de reprodução"
          description="Nenhum registo de proof-of-play encontrado para os filtros selecionados."
        />
      )}

      {rows && rows.length > 0 && (
        <div className="surface-table-card">
          <table className="data-table">
            <thead>
              <tr>
                <th>Dispositivo</th>
                <th>Tipo</th>
                <th>Conteúdo</th>
                <th>Evento</th>
                <th>Início</th>
                <th>Duração</th>
                <th>Erro</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>{r.deviceName}</td>
                  <td>{playbackItemTypeLabelPt(r.itemType)}</td>
                  <td>{r.assetName ?? r.playlistName ?? '—'}</td>
                  <td>
                    <span
                      className={`badge ${
                        r.eventType === 'error'
                          ? 'badge--danger'
                          : r.eventType === 'completed'
                            ? 'badge--neutral'
                            : 'badge--warning'
                      }`}
                    >
                      <FileBarChart size={13} style={{ verticalAlign: -2, marginRight: 4 }} aria-hidden />
                      {playbackEventTypeLabelPt(r.eventType)}
                    </span>
                  </td>
                  <td className="cell-sub">{formatDateTimePtBr(r.startedAt)}</td>
                  <td className="cell-sub">
                    {r.durationMs != null ? `${(r.durationMs / 1000).toFixed(1)}s` : '—'}
                  </td>
                  <td className="cell-sub">{r.errorMessage ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {rows && rows.length > 0 && (
        <div className="table-footer">
          <span>
            A mostrar {rows.length} de {total} eventos — página {page} de {totalPages}
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              className="btn btn--ghost"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Anterior
            </button>
            <button
              type="button"
              className="btn btn--ghost"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Seguinte
            </button>
          </div>
        </div>
      )}
    </>
  );
}
