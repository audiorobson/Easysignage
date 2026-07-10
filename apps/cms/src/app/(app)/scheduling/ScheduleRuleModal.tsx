'use client';

import { FormEvent, useEffect, useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { api } from '@/lib/api';
import type { DeviceLayoutOption, ScheduleContentType, ScheduleRuleRow } from './types';
import { ISO_DAY_OPTIONS, parseTimeToMin, formatMinutes } from './schedule-utils';

type Opt = { id: string; name: string };

type Props = {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  mode: 'create' | 'edit';
  editing: ScheduleRuleRow | null;
  playlists: Opt[];
  devices: Opt[];
  groups: Opt[];
  videoWalls: Opt[];
};

const CONTENT_OPTIONS: { value: ScheduleContentType; label: string }[] = [
  { value: 'playlist', label: 'Playlist' },
  { value: 'layout', label: 'Layout multi-zona' },
  { value: 'video_wall', label: 'Video wall' },
];

export function ScheduleRuleModal({
  open,
  onClose,
  onSaved,
  mode,
  editing,
  playlists,
  devices,
  groups,
  videoWalls,
}: Props) {
  const [name, setName] = useState('');
  const [contentType, setContentType] = useState<ScheduleContentType>('playlist');
  const [playlistId, setPlaylistId] = useState('');
  const [layoutId, setLayoutId] = useState('');
  const [videoWallId, setVideoWallId] = useState('');
  const [deviceLayout, setDeviceLayout] = useState<DeviceLayoutOption | null>(null);
  const [scope, setScope] = useState<'device' | 'group'>('device');
  const [deviceId, setDeviceId] = useState('');
  const [groupId, setGroupId] = useState('');
  const [days, setDays] = useState<number[]>([1]);
  const [allDay, setAllDay] = useState(true);
  const [startT, setStartT] = useState('08:00');
  const [endT, setEndT] = useState('18:00');
  const [priority, setPriority] = useState(0);
  const [enabled, setEnabled] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    if (mode === 'edit' && editing) {
      setName(editing.name ?? '');
      setContentType(editing.contentType);
      setPlaylistId(editing.playlistId ?? '');
      setLayoutId(editing.layoutId ?? '');
      setVideoWallId(editing.videoWallId ?? '');
      setScope(editing.scope);
      setDeviceId(editing.deviceId ?? '');
      setGroupId(editing.groupId ?? '');
      setDays([editing.dayOfWeek]);
      const full = editing.startMin === 0 && editing.endMin === 1440;
      setAllDay(full);
      setStartT(formatMinutes(editing.startMin));
      setEndT(formatMinutes(editing.endMin));
      setPriority(editing.priority);
      setEnabled(editing.enabled);
    } else {
      setName('');
      setContentType('playlist');
      setPlaylistId(playlists[0]?.id ?? '');
      setLayoutId('');
      setVideoWallId(videoWalls[0]?.id ?? '');
      setScope('device');
      setDeviceId(devices[0]?.id ?? '');
      setGroupId(groups[0]?.id ?? '');
      setDays([1]);
      setAllDay(true);
      setStartT('08:00');
      setEndT('18:00');
      setPriority(0);
      setEnabled(true);
    }
  }, [open, mode, editing, playlists, devices, groups, videoWalls]);

  useEffect(() => {
    if (!open || contentType !== 'layout' || scope !== 'device' || !deviceId) {
      setDeviceLayout(null);
      setLayoutId('');
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const row = await api<DeviceLayoutOption | null>(`/devices/${deviceId}/layout`);
        if (cancelled) return;
        setDeviceLayout(row);
        setLayoutId(row?.id ?? '');
      } catch {
        if (!cancelled) {
          setDeviceLayout(null);
          setLayoutId('');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, contentType, scope, deviceId]);

  useEffect(() => {
    if (contentType === 'layout' && scope === 'group') {
      setScope('device');
    }
  }, [contentType, scope]);

  function toggleDay(v: number) {
    if (mode === 'edit') {
      setDays([v]);
      return;
    }
    setDays((prev) =>
      prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v].sort((a, b) => a - b)
    );
  }

  function buildPayload() {
    const base: Record<string, unknown> = {
      name: name.trim() || undefined,
      scope,
      deviceId: scope === 'device' ? deviceId : null,
      groupId: scope === 'group' ? groupId : null,
      priority,
      enabled,
    };
    if (contentType === 'playlist') {
      return { ...base, playlistId, layoutId: null, videoWallId: null };
    }
    if (contentType === 'layout') {
      return { ...base, playlistId: null, layoutId, videoWallId: null };
    }
    return { ...base, playlistId: null, layoutId: null, videoWallId };
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (contentType === 'playlist' && !playlistId) {
      setError('Escolha uma playlist');
      return;
    }
    if (contentType === 'layout') {
      if (scope !== 'device' || !deviceId) {
        setError('Layout exige alvo «Device»');
        return;
      }
      if (!layoutId) {
        setError('Este device não tem layout guardado — configure em Ecrã & Layout');
        return;
      }
    }
    if (contentType === 'video_wall' && !videoWallId) {
      setError('Escolha uma video wall');
      return;
    }
    if (scope === 'device' && !deviceId) {
      setError('Escolha um device');
      return;
    }
    if (scope === 'group' && !groupId) {
      setError('Escolha um grupo');
      return;
    }
    if (days.length === 0) {
      setError('Selecione pelo menos um dia da semana');
      return;
    }

    let startMin = 0;
    let endMin = 1440;
    if (!allDay) {
      const sm = parseTimeToMin(startT);
      const em = parseTimeToMin(endT);
      if (sm == null || em == null) {
        setError('Horário inválido (use HH:mm)');
        return;
      }
      if (sm >= em) {
        setError('Início deve ser antes do fim');
        return;
      }
      startMin = sm;
      endMin = em;
    }

    setSaving(true);
    setError(null);
    try {
      const payload = buildPayload();
      if (mode === 'edit' && editing) {
        await api(`/schedules/${editing.id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            ...payload,
            dayOfWeek: days[0],
            startMin,
            endMin,
          }),
        });
      } else {
        for (const dayOfWeek of days) {
          await api('/schedules', {
            method: 'POST',
            body: JSON.stringify({
              ...payload,
              dayOfWeek,
              startMin,
              endMin,
            }),
          });
        }
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
      title={mode === 'create' ? 'Novo agendamento' : 'Editar agendamento'}
      titleId="schedule-modal-title"
      onClose={onClose}
      maxWidth={520}
      scrollable
    >
      <form onSubmit={(e) => void onSubmit(e)}>
        {error && <p className="text-danger" style={{ marginTop: 0 }}>{error}</p>}

        <label className="field">
          <span>Nome (opcional)</span>
          <input
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex.: Manhã loja centro"
          />
        </label>

        <label className="field">
          <span>Tipo de conteúdo</span>
          <select
            className="select"
            value={contentType}
            onChange={(e) => setContentType(e.target.value as ScheduleContentType)}
          >
            {CONTENT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>

        {contentType === 'playlist' && (
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
        )}

        {contentType === 'layout' && (
          <div className="field">
            <span className="field-label">Layout do device</span>
            {deviceLayout ? (
              <p style={{ margin: '6px 0 0', fontSize: 14 }}>
                <strong>
                  {deviceLayout.name?.trim() ||
                    `${deviceLayout.template.name} (${deviceLayout.template.slug})`}
                </strong>
              </p>
            ) : (
              <p className="text-muted" style={{ margin: '6px 0 0', fontSize: 13 }}>
                {deviceId
                  ? 'Sem layout guardado — abra o editor em Ecrã & Layout'
                  : 'Escolha um device abaixo'}
              </p>
            )}
          </div>
        )}

        {contentType === 'video_wall' && (
          <label className="field">
            <span>Video wall</span>
            <select
              className="select"
              value={videoWallId}
              onChange={(e) => setVideoWallId(e.target.value)}
              required
            >
              <option value="">Escolher…</option>
              {videoWalls.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
            <p className="text-muted" style={{ fontSize: 12, marginTop: 6 }}>
              Em grupos, só devices que são tiles da parede recebem o conteúdo.
            </p>
          </label>
        )}

        <fieldset style={{ border: 'none', margin: 0, padding: 0 }}>
          <span className="field" style={{ display: 'block', marginBottom: 8 }}>
            Alvo
          </span>
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                type="radio"
                name="scope"
                checked={scope === 'device'}
                onChange={() => setScope('device')}
              />
              Device
            </label>
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                opacity: contentType === 'layout' ? 0.45 : 1,
              }}
            >
              <input
                type="radio"
                name="scope"
                checked={scope === 'group'}
                onChange={() => setScope('group')}
                disabled={contentType === 'layout'}
              />
              Grupo
            </label>
          </div>
        </fieldset>

        {scope === 'device' ? (
          <label className="field">
            <span>Device</span>
            <select
              className="select"
              value={deviceId}
              onChange={(e) => setDeviceId(e.target.value)}
              required
            >
              <option value="">Escolher…</option>
              {devices.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <label className="field">
            <span>Grupo</span>
            <select
              className="select"
              value={groupId}
              onChange={(e) => setGroupId(e.target.value)}
              required
            >
              <option value="">Escolher…</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </label>
        )}

        <div className="field">
          <span>Dias da semana</span>
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '0.35rem',
              marginTop: 6,
            }}
          >
            {ISO_DAY_OPTIONS.map((d) => (
              <button
                key={d.value}
                type="button"
                className={`btn ${days.includes(d.value) ? 'btn--primary' : 'btn--ghost'}`}
                style={{ padding: '0.25rem 0.5rem', fontSize: 12 }}
                onClick={() => toggleDay(d.value)}
              >
                {d.short}
              </button>
            ))}
          </div>
          {mode === 'create' && (
            <p className="text-muted" style={{ fontSize: 12, marginTop: 6 }}>
              Uma regra por dia selecionado — útil para rotinas semanais distintas.
            </p>
          )}
        </div>

        <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <input
            type="checkbox"
            checked={allDay}
            onChange={(e) => setAllDay(e.target.checked)}
          />
          Dia inteiro (00:00–24:00)
        </label>

        {!allDay && (
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            <label className="field" style={{ flex: '1 1 120px' }}>
              <span>Início</span>
              <input
                type="time"
                className="input"
                value={startT}
                onChange={(e) => setStartT(e.target.value)}
              />
            </label>
            <label className="field" style={{ flex: '1 1 120px' }}>
              <span>Fim</span>
              <input
                type="time"
                className="input"
                value={endT}
                onChange={(e) => setEndT(e.target.value)}
              />
            </label>
          </div>
        )}

        <label className="field">
          <span>Prioridade (maior = prevalece em sobreposição)</span>
          <input
            type="number"
            className="input"
            value={priority}
            onChange={(e) => setPriority(Number(e.target.value))}
          />
        </label>

        <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
          />
          Ativo
        </label>

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
