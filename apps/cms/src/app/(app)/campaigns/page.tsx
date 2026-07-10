'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Megaphone, Pencil, Pause, Play, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { PageHeader } from '@/components/ui/PageHeader';
import { api, getToken } from '@/lib/api';
import { formatDateTimePtBr } from '@/lib/format-date';
import { formatMinutes } from '../scheduling/schedule-utils';
import { CampaignModal } from './CampaignModal';
import type { CampaignRow } from './types';

type Opt = { id: string; name: string };

function statusTone(status: string): string {
  switch (status) {
    case 'active':
      return 'badge--success';
    case 'paused':
      return 'badge--warning';
    case 'ended':
      return 'badge--neutral';
    default:
      return 'badge--neutral';
  }
}

export default function CampaignsPage() {
  const router = useRouter();
  const [items, setItems] = useState<CampaignRow[] | null>(null);
  const [playlists, setPlaylists] = useState<Opt[]>([]);
  const [devices, setDevices] = useState<Opt[]>([]);
  const [groups, setGroups] = useState<Opt[]>([]);
  const [sites, setSites] = useState<Opt[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [editing, setEditing] = useState<CampaignRow | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [reapplying, setReapplying] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; name: string } | null>(null);

  const load = useCallback(async () => {
    const data = await api<CampaignRow[]>('/campaigns');
    setItems(data);
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
        const [c, p, d, g, s] = await Promise.all([
          api<CampaignRow[]>('/campaigns'),
          api<Opt[]>('/playlists'),
          api<Opt[]>('/devices').catch(() => []),
          api<Opt[]>('/groups').catch(() => []),
          api<Opt[]>('/sites').catch(() => []),
        ]);
        if (cancelled) return;
        setItems(c);
        setPlaylists(p);
        setDevices(d);
        setGroups(g);
        setSites(s);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Erro');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  async function setStatus(id: string, action: 'activate' | 'pause' | 'end') {
    setBusyId(id);
    setError(null);
    try {
      await api(`/campaigns/${id}/${action}`, { method: 'POST' });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro');
    } finally {
      setBusyId(null);
    }
  }

  async function deleteConfirmed() {
    if (!confirmDelete) return;
    setBusyId(confirmDelete.id);
    try {
      await api(`/campaigns/${confirmDelete.id}`, { method: 'DELETE' });
      setConfirmDelete(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro');
    } finally {
      setBusyId(null);
    }
  }

  async function reapplyAll() {
    setReapplying(true);
    setError(null);
    try {
      await api('/campaigns/reapply', { method: 'POST' });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro');
    } finally {
      setReapplying(false);
    }
  }

  function periodLabel(c: CampaignRow): string {
    const parts: string[] = [];
    if (c.startAt) parts.push(`desde ${formatDateTimePtBr(c.startAt)}`);
    if (c.endAt) parts.push(`até ${formatDateTimePtBr(c.endAt)}`);
    if (c.startMin != null && c.endMin != null) {
      parts.push(
        `${formatMinutes(c.startMin)}–${formatMinutes(c.endMin)}` +
          (c.dayOfWeek ? ` (dia ${c.dayOfWeek})` : '')
      );
    }
    return parts.length ? parts.join(' · ') : 'Sem limite de calendário';
  }

  return (
    <>
      <PageHeader
        title="Campanhas"
        lead="Promoções com playlist e prioridade sobre a agenda recorrente — por site, grupo ou device."
        actions={
          <>
            <button
              type="button"
              className="btn btn--ghost"
              disabled={reapplying}
              onClick={() => void reapplyAll()}
            >
              <RefreshCw size={17} strokeWidth={1.9} aria-hidden />
              {reapplying ? 'A reaplicar…' : 'Reaplicar'}
            </button>
            <button
              type="button"
              className="btn btn--primary"
              onClick={() => {
                setModalMode('create');
                setEditing(null);
                setModalOpen(true);
              }}
            >
              <Plus strokeWidth={2.1} aria-hidden />
              Nova campanha
            </button>
          </>
        }
      />

      {error && <p className="text-danger">{error}</p>}
      {!items && !error && <p className="text-muted">A carregar…</p>}

      {items && items.length === 0 && (
        <p className="text-muted">
          <Megaphone size={16} style={{ verticalAlign: -3, marginRight: 6 }} />
          Nenhuma campanha. Crie uma, ative-a e os devices do alvo passam a exibir a playlist
          promocional (prioridade sobre regras de agenda).
        </p>
      )}

      {items && items.length > 0 && (
        <div className="surface-table-card">
          <table className="data-table">
            <thead>
              <tr>
                <th>Nome</th>
                <th>Playlist</th>
                <th>Alvo</th>
                <th>Período</th>
                <th>Prio</th>
                <th>Estado</th>
                <th style={{ width: 1 }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {items.map((c) => (
                <tr key={c.id}>
                  <td>{c.name}</td>
                  <td>
                    <Link href={`/playlists/${c.playlistId}`}>{c.playlist.name}</Link>
                  </td>
                  <td>
                    <span className="badge badge--neutral" style={{ marginRight: 6 }}>
                      {c.scopeLabel}
                    </span>
                    {c.targetLabel}
                  </td>
                  <td className="text-muted" style={{ fontSize: 13 }}>
                    {periodLabel(c)}
                  </td>
                  <td>{c.priority}</td>
                  <td>
                    <span className={`badge ${statusTone(c.status)}`}>{c.statusLabel}</span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      {c.status !== 'active' && c.status !== 'ended' && (
                        <button
                          type="button"
                          className="btn btn--ghost"
                          title="Ativar"
                          disabled={busyId === c.id}
                          onClick={() => void setStatus(c.id, 'activate')}
                        >
                          <Play size={16} aria-hidden />
                        </button>
                      )}
                      {c.status === 'active' && (
                        <button
                          type="button"
                          className="btn btn--ghost"
                          title="Pausar"
                          disabled={busyId === c.id}
                          onClick={() => void setStatus(c.id, 'pause')}
                        >
                          <Pause size={16} aria-hidden />
                        </button>
                      )}
                      <button
                        type="button"
                        className="btn btn--ghost"
                        title="Editar"
                        onClick={() => {
                          setModalMode('edit');
                          setEditing(c);
                          setModalOpen(true);
                        }}
                      >
                        <Pencil size={16} aria-hidden />
                      </button>
                      <button
                        type="button"
                        className="btn btn--ghost"
                        title="Eliminar"
                        disabled={busyId === c.id}
                        onClick={() => setConfirmDelete({ id: c.id, name: c.name })}
                      >
                        <Trash2 size={16} aria-hidden />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <CampaignModal
        open={modalOpen}
        mode={modalMode}
        editing={editing}
        playlists={playlists}
        devices={devices}
        groups={groups}
        sites={sites}
        onClose={() => setModalOpen(false)}
        onSaved={() => void load()}
      />

      <ConfirmDialog
        open={confirmDelete !== null}
        title="Eliminar campanha"
        message={
          confirmDelete ? `Eliminar «${confirmDelete.name}»? Esta ação não pode ser desfeita.` : ''
        }
        confirmLabel="Eliminar"
        onConfirm={() => void deleteConfirmed()}
        onCancel={() => setConfirmDelete(null)}
      />
    </>
  );
}
