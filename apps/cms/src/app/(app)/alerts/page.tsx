'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, RefreshCw, TriangleAlert } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { api, getToken } from '@/lib/api';
import { formatDateTimePtBr } from '@/lib/format-date';
import {
  alertSeverityLabelPt,
  alertStatusLabelPt,
  alertTypeLabelPt,
} from '@easysignage/shared-types';

type AlertRow = {
  id: string;
  deviceId: string;
  deviceName: string;
  siteName: string;
  alertType: string;
  severity: string;
  status: string;
  title: string;
  message: string | null;
  firstSeenAt: string;
  lastSeenAt: string;
  acknowledgedAt: string | null;
};

type Summary = { open: number; acknowledged: number; critical: number; active: number };

function severityClass(sev: string): string {
  switch (sev) {
    case 'critical':
      return 'badge--danger';
    case 'warning':
      return 'badge--warning';
    default:
      return 'badge--neutral';
  }
}

function statusClass(status: string): string {
  switch (status) {
    case 'open':
      return 'badge--danger';
    case 'acknowledged':
      return 'badge--warning';
    default:
      return 'badge--neutral';
  }
}

export default function AlertsPage() {
  const router = useRouter();
  const [items, setItems] = useState<AlertRow[] | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [filter, setFilter] = useState<'active' | 'open' | 'acknowledged' | 'all'>('active');
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [evaluating, setEvaluating] = useState(false);

  const load = useCallback(async () => {
    const statusParam = filter === 'active' ? undefined : filter;
    const [list, sum] = await Promise.all([
      api<AlertRow[]>(`/alerts${statusParam ? `?status=${statusParam}` : ''}`),
      api<Summary>('/alerts/summary'),
    ]);
    setItems(list);
    setSummary(sum);
  }, [filter]);

  useEffect(() => {
    if (!getToken()) {
      router.replace('/login');
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        setError(null);
        setEvaluating(true);
        await api('/alerts/evaluate', { method: 'POST' });
        if (cancelled) return;
        await load();
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Erro');
      } finally {
        if (!cancelled) setEvaluating(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- avaliação inicial apenas no mount
  }, [router]);

  useEffect(() => {
    if (!getToken()) return;
    void load().catch((e) =>
      setError(e instanceof Error ? e.message : 'Erro')
    );
  }, [load]);

  async function refresh() {
    setEvaluating(true);
    setError(null);
    try {
      await api('/alerts/evaluate', { method: 'POST' });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro');
    } finally {
      setEvaluating(false);
    }
  }

  async function ack(id: string) {
    setBusyId(id);
    try {
      await api(`/alerts/${id}/ack`, { method: 'PATCH' });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      <PageHeader
        title="Alertas"
        lead="Deteção automática de offline, falhas de reprodução e publicação não confirmada."
        actions={
          <button
            type="button"
            className="btn btn--ghost"
            disabled={evaluating}
            onClick={() => void refresh()}
          >
            <RefreshCw size={17} strokeWidth={1.9} aria-hidden />
            {evaluating ? 'A avaliar…' : 'Atualizar'}
          </button>
        }
      />

      {summary && (
        <div
          style={{
            display: 'flex',
            gap: 'var(--space-4)',
            flexWrap: 'wrap',
            marginBottom: 'var(--space-5)',
          }}
        >
          <span className="badge badge--danger">{summary.open} abertos</span>
          <span className="badge badge--warning">{summary.acknowledged} reconhecidos</span>
          <span className="badge badge--neutral">{summary.critical} críticos ativos</span>
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 'var(--space-4)' }}>
        {(
          [
            ['active', 'Ativos'],
            ['open', 'Abertos'],
            ['acknowledged', 'Reconhecidos'],
            ['all', 'Todos ativos'],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            className={`btn ${filter === value ? 'btn--primary' : 'btn--ghost'}`}
            style={{ fontSize: 13 }}
            onClick={() => setFilter(value)}
          >
            {label}
          </button>
        ))}
      </div>

      {error && <p className="text-danger">{error}</p>}
      {!items && !error && <p className="text-muted">A carregar…</p>}

      {items && items.length === 0 && (
        <p className="text-muted">
          <TriangleAlert size={16} style={{ verticalAlign: -3, marginRight: 6 }} />
          Nenhum alerta ativo. Os devices são avaliados a cada heartbeat e ao atualizar esta página.
        </p>
      )}

      {items && items.length > 0 && (
        <div className="surface-table-card">
          <table className="data-table">
            <thead>
              <tr>
                <th>Severidade</th>
                <th>Alerta</th>
                <th>Device</th>
                <th>Tipo</th>
                <th>Estado</th>
                <th>Última vez</th>
                <th style={{ width: 1 }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {items.map((a) => (
                <tr key={a.id}>
                  <td>
                    <span className={`badge ${severityClass(a.severity)}`}>
                      {alertSeverityLabelPt(a.severity)}
                    </span>
                  </td>
                  <td>
                    <strong>{a.title}</strong>
                    {a.message && (
                      <p className="text-muted" style={{ margin: '4px 0 0', fontSize: 12 }}>
                        {a.message}
                      </p>
                    )}
                  </td>
                  <td>
                    <Link href={`/devices/${a.deviceId}`}>{a.deviceName}</Link>
                    <span className="text-muted" style={{ fontSize: 12, display: 'block' }}>
                      {a.siteName}
                    </span>
                  </td>
                  <td>{alertTypeLabelPt(a.alertType)}</td>
                  <td>
                    <span className={`badge ${statusClass(a.status)}`}>
                      {alertStatusLabelPt(a.status)}
                    </span>
                  </td>
                  <td className="text-muted" style={{ fontSize: 13 }}>
                    {formatDateTimePtBr(a.lastSeenAt)}
                  </td>
                  <td>
                    {a.status === 'open' && (
                      <button
                        type="button"
                        className="btn btn--ghost"
                        title="Reconhecer"
                        disabled={busyId === a.id}
                        onClick={() => void ack(a.id)}
                      >
                        <Check size={16} aria-hidden />
                        {busyId === a.id ? '…' : 'Ack'}
                      </button>
                    )}
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
