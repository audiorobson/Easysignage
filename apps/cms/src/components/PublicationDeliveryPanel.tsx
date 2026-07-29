'use client';

import { DataTable, DataTableBody, DataTableCard, DataTableCell, DataTableHead, DataTableHeaderCell, DataTableRow } from '@/components/ui/DataTable';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, Clock, HelpCircle, RefreshCw } from 'lucide-react';
import { StatusPill } from '@/components/ui/StatusPill';
import { api } from '@/lib/api';
import { formatDateTimePtBr } from '@/lib/format-date';
import type { BadgeTone } from '@/lib/device-labels';

export type PublicationDeliveryDevice = {
  deviceId: string;
  deviceName: string;
  status: 'synced' | 'pending' | 'no_publication';
  expectedPublicationVersion: number | null;
  appliedPublicationVersion: number | null;
  expectedContentRevision: string | null;
  appliedContentRevision: string | null;
  appliedAt: string | null;
  lastSeenAt: string | null;
};

export type PublicationDeliverySummary = {
  total: number;
  synced: number;
  pending: number;
  noPublication: number;
  syncedPct: number;
  devices: PublicationDeliveryDevice[];
};

const STATUS_META: Record<
  PublicationDeliveryDevice['status'],
  { label: string; tone: BadgeTone; hint: string }
> = {
  synced: {
    label: 'Sincronizado',
    tone: 'success',
    hint: 'Versão de publicação e revisão de conteúdo confirmadas pelo player.',
  },
  pending: {
    label: 'Pendente',
    tone: 'warning',
    hint: 'Publicação atribuída mas ainda não confirmada pelo player.',
  },
  no_publication: {
    label: 'Sem publicação',
    tone: 'neutral',
    hint: 'Nenhuma publicação activa atribuída ao dispositivo.',
  },
};

type Props = {
  /** Mostrar tabela detalhada de devices pendentes */
  showDeviceTable?: boolean;
  /** Intervalo de actualização automática (ms); 0 = desactivado */
  pollMs?: number;
  compact?: boolean;
};

export function PublicationDeliveryPanel({
  showDeviceTable = true,
  pollMs = 0,
  compact = false,
}: Props) {
  const [data, setData] = useState<PublicationDeliverySummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const summary = await api<PublicationDeliverySummary>('/monitoring/publication-delivery');
    setData(summary);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setError(null);
        setLoading(true);
        await load();
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Erro');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [load]);

  useEffect(() => {
    if (!pollMs) return;
    const id = window.setInterval(() => {
      void load().catch(() => undefined);
    }, pollMs);
    return () => window.clearInterval(id);
  }, [load, pollMs]);

  const pendingDevices =
    data?.devices.filter((d) => d.status === 'pending') ?? [];

  return (
    <section className="panel publication-delivery" aria-labelledby="pub-delivery-title">
      <div className="panel__head">
        <div>
          <h3 className="panel__title" id="pub-delivery-title">
            Entrega de publicação
          </h3>
          <p className="text-muted" style={{ margin: '4px 0 0' }}>
            Confirmação de versão e revisão de conteúdo reportada pelos players.
          </p>
        </div>
        <button
          type="button"
          className="btn btn--ghost"
          onClick={() => void load()}
          aria-label="Actualizar métricas de entrega"
        >
          <RefreshCw size={16} aria-hidden />
          Actualizar
        </button>
      </div>

      {error && (
        <p className="text-danger" role="alert">
          {error}
        </p>
      )}
      {loading && !data && <p className="text-muted">A carregar métricas…</p>}

      {data && (
        <>
          <div
            className={compact ? 'publication-delivery__kpis publication-delivery__kpis--compact' : 'publication-delivery__kpis'}
            role="list"
            aria-label="Resumo de entrega"
          >
            <div className="publication-delivery__kpi" role="listitem">
              <span className="publication-delivery__kpi-icon publication-delivery__kpi-icon--success" aria-hidden>
                <CheckCircle2 size={18} />
              </span>
              <div>
                <div className="publication-delivery__kpi-value">{data.syncedPct}%</div>
                <div className="publication-delivery__kpi-label">
                  Sincronizados ({data.synced}/{data.total})
                </div>
              </div>
            </div>
            <div className="publication-delivery__kpi" role="listitem">
              <span className="publication-delivery__kpi-icon publication-delivery__kpi-icon--warning" aria-hidden>
                <Clock size={18} />
              </span>
              <div>
                <div className="publication-delivery__kpi-value">{data.pending}</div>
                <div className="publication-delivery__kpi-label">Pendentes</div>
              </div>
            </div>
            <div className="publication-delivery__kpi" role="listitem">
              <span className="publication-delivery__kpi-icon publication-delivery__kpi-icon--neutral" aria-hidden>
                <HelpCircle size={18} />
              </span>
              <div>
                <div className="publication-delivery__kpi-value">{data.noPublication}</div>
                <div className="publication-delivery__kpi-label">Sem publicação</div>
              </div>
            </div>
          </div>

          <div
            className="meter"
            style={{ marginTop: compact ? 12 : 16 }}
            role="progressbar"
            aria-valuenow={data.syncedPct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`${data.syncedPct}% dos dispositivos sincronizados`}
          >
            <span
              style={{
                width: `${data.syncedPct}%`,
                background:
                  data.syncedPct >= 90
                    ? 'var(--color-success)'
                    : data.syncedPct >= 70
                      ? 'var(--color-warning)'
                      : 'var(--color-danger)',
              }}
            />
          </div>

          {showDeviceTable && pendingDevices.length > 0 && (
            <div style={{ marginTop: compact ? 16 : 20 }}>
              <h4 style={{ margin: '0 0 8px', fontSize: 14, fontWeight: 700 }}>
                Dispositivos com entrega pendente ({pendingDevices.length})
              </h4>
              <DataTableCard ariaLabel="Dispositivos com publicação pendente">
                <DataTable caption="Dispositivos com entrega de publicação pendente">
                  <DataTableHead>
                    <DataTableRow>
                      <DataTableHeaderCell>Dispositivo</DataTableHeaderCell>
                      <DataTableHeaderCell>Versão</DataTableHeaderCell>
                      <DataTableHeaderCell>Revisão</DataTableHeaderCell>
                      <DataTableHeaderCell>Último ack</DataTableHeaderCell>
                    </DataTableRow>
                  </DataTableHead>
                  <DataTableBody>
                    {pendingDevices.slice(0, compact ? 5 : 20).map((d) => (
                      <DataTableRow key={d.deviceId}>
                        <DataTableCell>
                          <Link href={`/devices/${d.deviceId}`}>{d.deviceName}</Link>
                        </DataTableCell>
                        <DataTableCell className="cell-sub">
                          {d.appliedPublicationVersion ?? '—'} / {d.expectedPublicationVersion ?? '—'}
                        </DataTableCell>
                        <DataTableCell className="cell-sub">
                          {d.appliedContentRevision?.slice(0, 8) ?? '—'} /{' '}
                          {d.expectedContentRevision?.slice(0, 8) ?? '—'}
                        </DataTableCell>
                        <DataTableCell className="cell-sub">
                          {d.appliedAt ? formatDateTimePtBr(d.appliedAt) : '—'}
                        </DataTableCell>
                      </DataTableRow>
                    ))}
                  </DataTableBody>
                </DataTable>
              </DataTableCard>
            </div>
          )}

          {showDeviceTable && pendingDevices.length === 0 && data.total > 0 && (
            <p className="text-muted" style={{ margin: '12px 0 0' }} role="status">
              Todos os dispositivos com publicação atribuída confirmaram a entrega.
            </p>
          )}
        </>
      )}
    </section>
  );
}

export function publicationDeliveryStatusPill(status: PublicationDeliveryDevice['status']) {
  const meta = STATUS_META[status];
  return <StatusPill label={meta.label} tone={meta.tone} title={meta.hint} />;
}
