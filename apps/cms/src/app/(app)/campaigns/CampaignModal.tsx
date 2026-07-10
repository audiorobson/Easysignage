'use client';

import { FormEvent, useEffect, useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { api } from '@/lib/api';
import { ISO_DAY_OPTIONS, formatMinutes } from '../scheduling/schedule-utils';
import type { CampaignRow } from './types';

type Opt = { id: string; name: string };

type Props = {
  open: boolean;
  mode: 'create' | 'edit';
  editing: CampaignRow | null;
  playlists: Opt[];
  devices: Opt[];
  groups: Opt[];
  sites: Opt[];
  onClose: () => void;
  onSaved: () => void;
};

const SCOPES = [
  { value: 'device', label: 'Device' },
  { value: 'group', label: 'Grupo' },
  { value: 'site', label: 'Site' },
  { value: 'all', label: 'Todos os devices' },
] as const;

function toDatetimeLocal(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromDatetimeLocal(v: string): string | undefined {
  if (!v.trim()) return undefined;
  return new Date(v).toISOString();
}

export function CampaignModal({
  open,
  mode,
  editing,
  playlists,
  devices,
  groups,
  sites,
  onClose,
  onSaved,
}: Props) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [playlistId, setPlaylistId] = useState('');
  const [priority, setPriority] = useState(10);
  const [scope, setScope] = useState<CampaignRow['scope']>('site');
  const [deviceId, setDeviceId] = useState('');
  const [groupId, setGroupId] = useState('');
  const [siteId, setSiteId] = useState('');
  const [startAt, setStartAt] = useState('');
  const [endAt, setEndAt] = useState('');
  const [useTimeWindow, setUseTimeWindow] = useState(false);
  const [dayOfWeek, setDayOfWeek] = useState(1);
  const [startT, setStartT] = useState('09:00');
  const [endT, setEndT] = useState('18:00');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    if (mode === 'edit' && editing) {
      setName(editing.name);
      setDescription(editing.description ?? '');
      setPlaylistId(editing.playlistId);
      setPriority(editing.priority);
      setScope(editing.scope);
      setDeviceId(editing.deviceId ?? '');
      setGroupId(editing.groupId ?? '');
      setSiteId(editing.siteId ?? '');
      setStartAt(toDatetimeLocal(editing.startAt));
      setEndAt(toDatetimeLocal(editing.endAt));
      const tw = editing.startMin != null && editing.endMin != null;
      setUseTimeWindow(tw);
      if (tw) {
        setDayOfWeek(editing.dayOfWeek ?? 1);
        setStartT(formatMinutes(editing.startMin!));
        setEndT(formatMinutes(editing.endMin!));
      }
    } else {
      setName('');
      setDescription('');
      setPlaylistId(playlists[0]?.id ?? '');
      setPriority(10);
      setScope('site');
      setDeviceId(devices[0]?.id ?? '');
      setGroupId(groups[0]?.id ?? '');
      setSiteId(sites[0]?.id ?? '');
      setStartAt('');
      setEndAt('');
      setUseTimeWindow(false);
      setDayOfWeek(1);
      setStartT('09:00');
      setEndT('18:00');
    }
  }, [open, mode, editing, playlists, devices, groups, sites]);

  function parseTimeToMin(t: string): number | null {
    const m = /^(\d{1,2}):(\d{2})$/.exec(t.trim());
    if (!m) return null;
    const h = Number(m[1]);
    const min = Number(m[2]);
    if (h < 0 || h > 23 || min < 0 || min > 59) return null;
    return h * 60 + min;
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim() || !playlistId) {
      setError('Nome e playlist são obrigatórios');
      return;
    }

    let startMin: number | null = null;
    let endMin: number | null = null;
    let day: number | null = null;
    if (useTimeWindow) {
      const sm = parseTimeToMin(startT);
      const em = parseTimeToMin(endT);
      if (sm == null || em == null || sm >= em) {
        setError('Janela horária inválida');
        return;
      }
      startMin = sm;
      endMin = em;
      day = dayOfWeek;
    }

    const payload: Record<string, unknown> = {
      name: name.trim(),
      description: description.trim() || undefined,
      playlistId,
      priority,
      scope,
      deviceId: scope === 'device' ? deviceId : undefined,
      groupId: scope === 'group' ? groupId : undefined,
      siteId: scope === 'site' ? siteId : undefined,
      startAt: fromDatetimeLocal(startAt),
      endAt: fromDatetimeLocal(endAt),
      dayOfWeek: day,
      startMin,
      endMin,
    };

    setSaving(true);
    setError(null);
    try {
      if (mode === 'create') {
        await api('/campaigns', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      } else if (editing) {
        await api(`/campaigns/${editing.id}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      title={mode === 'create' ? 'Nova campanha' : 'Editar campanha'}
      titleId="campaign-modal-title"
      onClose={onClose}
      maxWidth={520}
      scrollable
    >
      <form onSubmit={(e) => void onSubmit(e)}>
        {error && <p className="text-danger" style={{ marginTop: 0 }}>{error}</p>}

        <label className="field">
          <span>Nome</span>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} required />
        </label>

        <label className="field">
          <span>Descrição (opcional)</span>
          <textarea
            className="input"
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </label>

        <label className="field">
          <span>Playlist</span>
          <select
            className="select"
            value={playlistId}
            onChange={(e) => setPlaylistId(e.target.value)}
            required
          >
            <option value="">Escolher…</option>
            {playlists.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>Prioridade (maior prevalece sobre agenda)</span>
          <input
            type="number"
            className="input"
            value={priority}
            onChange={(e) => setPriority(Number(e.target.value))}
          />
        </label>

        <label className="field">
          <span>Alvo</span>
          <select
            className="select"
            value={scope}
            onChange={(e) => setScope(e.target.value as CampaignRow['scope'])}
          >
            {SCOPES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </label>

        {scope === 'device' && (
          <label className="field">
            <span>Device</span>
            <select className="select" value={deviceId} onChange={(e) => setDeviceId(e.target.value)}>
              {devices.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </label>
        )}
        {scope === 'group' && (
          <label className="field">
            <span>Grupo</span>
            <select className="select" value={groupId} onChange={(e) => setGroupId(e.target.value)}>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </label>
        )}
        {scope === 'site' && (
          <label className="field">
            <span>Site</span>
            <select className="select" value={siteId} onChange={(e) => setSiteId(e.target.value)}>
              {sites.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
        )}

        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          <label className="field" style={{ flex: '1 1 200px' }}>
            <span>Início (calendário)</span>
            <input
              type="datetime-local"
              className="input"
              value={startAt}
              onChange={(e) => setStartAt(e.target.value)}
            />
          </label>
          <label className="field" style={{ flex: '1 1 200px' }}>
            <span>Fim (calendário)</span>
            <input
              type="datetime-local"
              className="input"
              value={endAt}
              onChange={(e) => setEndAt(e.target.value)}
            />
          </label>
        </div>

        <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <input
            type="checkbox"
            checked={useTimeWindow}
            onChange={(e) => setUseTimeWindow(e.target.checked)}
          />
          Janela horária recorrente (dentro do período)
        </label>

        {useTimeWindow && (
          <>
            <label className="field">
              <span>Dia da semana</span>
              <select
                className="select"
                value={dayOfWeek}
                onChange={(e) => setDayOfWeek(Number(e.target.value))}
              >
                {ISO_DAY_OPTIONS.map((d) => (
                  <option key={d.value} value={d.value}>
                    {d.label}
                  </option>
                ))}
              </select>
            </label>
            <div style={{ display: 'flex', gap: '1rem' }}>
              <label className="field" style={{ flex: 1 }}>
                <span>Início</span>
                <input type="time" className="input" value={startT} onChange={(e) => setStartT(e.target.value)} />
              </label>
              <label className="field" style={{ flex: 1 }}>
                <span>Fim</span>
                <input type="time" className="input" value={endT} onChange={(e) => setEndT(e.target.value)} />
              </label>
            </div>
          </>
        )}

        <div className="modal-dialog__footer">
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" className="btn btn--primary" disabled={saving}>
            {saving ? 'A guardar…' : 'Guardar'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
