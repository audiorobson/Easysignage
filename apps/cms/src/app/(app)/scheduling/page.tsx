'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  GanttChart,
  List,
  Pencil,
  Plus,
  Trash2,
} from 'lucide-react';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { PageHeader } from '@/components/ui/PageHeader';
import { api, getToken } from '@/lib/api';
import { formatDateTimePtBr } from '@/lib/format-date';
import { ScheduleRuleModal } from './ScheduleRuleModal';
import { ScheduleTimeline } from './ScheduleTimeline';
import type { ScheduleRuleRow } from './types';
import {
  formatMinutes,
  isoDayLabel,
} from './schedule-utils';

type Opt = { id: string; name: string };

export default function SchedulingPage() {
  const router = useRouter();
  const [rules, setRules] = useState<ScheduleRuleRow[] | null>(null);
  const [playlists, setPlaylists] = useState<Opt[]>([]);
  const [devices, setDevices] = useState<Opt[]>([]);
  const [groups, setGroups] = useState<Opt[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [view, setView] = useState<'lista' | 'linha'>('linha');
  const [timelineKind, setTimelineKind] = useState<'device' | 'group'>('device');
  const [timelineTargetId, setTimelineTargetId] = useState<string>('');

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [editing, setEditing] = useState<ScheduleRuleRow | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteRuleId, setConfirmDeleteRuleId] = useState<string | null>(null);
  const [reapplying, setReapplying] = useState(false);

  const load = useCallback(async () => {
    const [r, p, d, g] = await Promise.all([
      api<ScheduleRuleRow[]>('/schedules'),
      api<Opt[]>('/playlists'),
      api<{ id: string; name: string }[]>('/devices').catch(() => []),
      api<Opt[]>('/groups').catch(() => []),
    ]);
    setRules(r);
    setPlaylists(p.map((x) => ({ id: x.id, name: x.name })));
    setDevices(d.map((x) => ({ id: x.id, name: x.name })));
    setGroups(g);
  }, []);

  useEffect(() => {
    if (!getToken()) {
      router.replace('/login');
      return;
    }
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
  }, [router, load]);

  useEffect(() => {
    if (devices.length && !timelineTargetId && timelineKind === 'device') {
      setTimelineTargetId(devices[0].id);
    }
    if (groups.length && !timelineTargetId && timelineKind === 'group') {
      setTimelineTargetId(groups[0].id);
    }
  }, [devices, groups, timelineKind, timelineTargetId]);

  const filteredTimelineRules = useMemo(() => {
    if (!rules || !timelineTargetId) return [];
    return rules.filter((r) => {
      if (timelineKind === 'device') {
        return r.scope === 'device' && r.deviceId === timelineTargetId;
      }
      return r.scope === 'group' && r.groupId === timelineTargetId;
    });
  }, [rules, timelineKind, timelineTargetId]);

  const stats = useMemo(() => {
    if (!rules) return null;
    const active = rules.filter((r) => r.enabled).length;
    return { total: rules.length, active };
  }, [rules]);

  async function removeRule(id: string) {
    setDeletingId(id);
    setError(null);
    try {
      await api(`/schedules/${id}`, { method: 'DELETE' });
      setConfirmDeleteRuleId(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro');
    } finally {
      setDeletingId(null);
    }
  }

  function openCreate() {
    setEditing(null);
    setModalMode('create');
    setModalOpen(true);
  }

  function openEdit(r: ScheduleRuleRow) {
    setEditing(r);
    setModalMode('edit');
    setModalOpen(true);
  }

  return (
    <>
      <PageHeader
        title="Agendamento"
        lead="Associe playlists a devices ou grupos por dia da semana e horário — rotinas tipo «segundas playlist A, terças playlist B». O player aplica a playlist ativa em cada poll de estado (~3 s)."
        actions={
          <>
            <button
              type="button"
              className="btn btn--ghost"
              disabled={reapplying}
              onClick={() => {
                void (async () => {
                  setReapplying(true);
                  setError(null);
                  try {
                    await api('/schedules/reapply', { method: 'POST' });
                    await load();
                  } catch (e) {
                    setError(e instanceof Error ? e.message : 'Erro');
                  } finally {
                    setReapplying(false);
                  }
                })();
              }}
            >
              {reapplying ? 'A aplicar…' : 'Reaplicar agenda'}
            </button>
            <button type="button" className="btn btn--primary" onClick={openCreate}>
              <Plus strokeWidth={2.1} aria-hidden />
              Novo agendamento
            </button>
          </>
        }
      />

      {stats && (
        <section
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '1rem',
            marginBottom: 'var(--space-6)',
          }}
        >
          <div className="surface-card" style={{ padding: '1rem 1.25rem', minWidth: 160 }}>
            <div className="text-muted" style={{ fontSize: '0.75rem' }}>
              Regras totais
            </div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{stats.total}</div>
          </div>
          <div className="surface-card" style={{ padding: '1rem 1.25rem', minWidth: 160 }}>
            <div className="text-muted" style={{ fontSize: '0.75rem' }}>
              Ativas
            </div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--color-success-text, #047857)' }}>
              {stats.active}
            </div>
          </div>
        </section>
      )}

      <section style={{ marginBottom: 'var(--space-6)' }}>
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '0.5rem',
            alignItems: 'center',
            marginBottom: '1rem',
          }}
        >
          <span className="text-muted" style={{ fontSize: '0.875rem', marginRight: 8 }}>
            Vista:
          </span>
          <button
            type="button"
            className={`btn ${view === 'linha' ? 'btn--primary' : 'btn--ghost'}`}
            onClick={() => setView('linha')}
          >
            <GanttChart size={17} strokeWidth={1.9} aria-hidden />
            Linha do tempo semanal
          </button>
          <button
            type="button"
            className={`btn ${view === 'lista' ? 'btn--primary' : 'btn--ghost'}`}
            onClick={() => setView('lista')}
          >
            <List size={17} strokeWidth={1.9} aria-hidden />
            Lista e edição
          </button>
        </div>

        {error && <p className="text-danger">{error}</p>}
        {!rules && !error && <p className="text-muted">A carregar…</p>}

        {view === 'linha' && rules && (
          <div>
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '1rem',
                alignItems: 'flex-end',
                marginBottom: '1rem',
              }}
            >
              <label className="field" style={{ margin: 0, minWidth: 200 }}>
                <span>Alvo da linha do tempo</span>
                <select
                  className="select"
                  value={timelineKind}
                  onChange={(e) => {
                    const k = e.target.value as 'device' | 'group';
                    setTimelineKind(k);
                    setTimelineTargetId('');
                  }}
                >
                  <option value="device">Device</option>
                  <option value="group">Grupo</option>
                </select>
              </label>
              <label className="field" style={{ margin: 0, flex: '1 1 220px', maxWidth: 360 }}>
                <span>{timelineKind === 'device' ? 'Device' : 'Grupo'}</span>
                <select
                  className="select"
                  value={timelineTargetId}
                  onChange={(e) => setTimelineTargetId(e.target.value)}
                >
                  <option value="">Escolher…</option>
                  {(timelineKind === 'device' ? devices : groups).map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {timelineTargetId ? (
              <ScheduleTimeline
                rules={filteredTimelineRules}
                title={
                  timelineKind === 'device'
                    ? `Semana — ${devices.find((d) => d.id === timelineTargetId)?.name ?? ''}`
                    : `Semana — ${groups.find((g) => g.id === timelineTargetId)?.name ?? ''}`
                }
              />
            ) : (
              <p className="text-muted">
                Escolha um device ou grupo para ver a grelha semanal.
              </p>
            )}
          </div>
        )}

        {view === 'lista' && rules && (
          <div className="surface-table-card">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Playlist</th>
                  <th>Alvo</th>
                  <th>Dia</th>
                  <th>Horário</th>
                  <th>Prio</th>
                  <th>Estado</th>
                  <th>Atualizado</th>
                  <th style={{ width: 1 }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {rules.length === 0 && (
                  <tr>
                    <td colSpan={9} className="text-muted">
                      Sem regras. Crie uma para associar playlists a devices ou grupos.
                    </td>
                  </tr>
                )}
                {rules.map((r) => (
                  <tr key={r.id}>
                    <td>{r.name || '—'}</td>
                    <td>
                      <Link href={`/playlists/${r.playlistId}`}>{r.playlist.name}</Link>
                    </td>
                    <td>{r.targetLabel}</td>
                    <td>{isoDayLabel(r.dayOfWeek)}</td>
                    <td>
                      {r.startMin === 0 && r.endMin === 1440
                        ? 'Dia inteiro'
                        : `${formatMinutes(r.startMin)} – ${formatMinutes(r.endMin)}`}
                    </td>
                    <td>{r.priority}</td>
                    <td>{r.enabled ? 'Ativo' : 'Inativo'}</td>
                    <td>{formatDateTimePtBr(r.updatedAt)}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          className="btn btn--ghost"
                          title="Editar"
                          onClick={() => openEdit(r)}
                        >
                          <Pencil size={17} strokeWidth={1.9} aria-hidden />
                        </button>
                        <button
                          type="button"
                          className="btn btn--ghost"
                          title="Eliminar"
                          disabled={deletingId === r.id}
                          onClick={() => setConfirmDeleteRuleId(r.id)}
                        >
                          {deletingId === r.id ? '…' : <Trash2 size={17} strokeWidth={1.9} aria-hidden />}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <ScheduleRuleModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSaved={() => void load()}
        mode={modalMode}
        editing={editing}
        playlists={playlists}
        devices={devices}
        groups={groups}
      />

      <ConfirmDialog
        open={confirmDeleteRuleId !== null}
        title="Eliminar agendamento"
        message="Eliminar esta regra de agendamento?"
        confirmLabel="Eliminar"
        loading={deletingId !== null}
        onConfirm={() => {
          if (confirmDeleteRuleId) void removeRule(confirmDeleteRuleId);
        }}
        onCancel={() => setConfirmDeleteRuleId(null)}
      />
    </>
  );
}
