'use client';

import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, RefreshCw, Send } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { api, getToken } from '@/lib/api';
import { connectCmsWallRealtime } from '@/lib/wall-realtime';
import { formatDateTimePtBr } from '@/lib/format-date';
import type { VideoWallDetail, WallSyncHealth, WallTileSyncStatus } from '../video-wall-types';

const HEALTH_POLL_MS = 5000;

function syncStatusBadge(status: WallTileSyncStatus): { className: string; label: string } {
  switch (status) {
    case 'ok':
      return { className: 'badge badge--success', label: 'Sincronizado' };
    case 'warn':
      return { className: 'badge badge--warning', label: 'Deriva leve' };
    case 'critical':
      return { className: 'badge badge--danger', label: 'Fora de sync' };
    case 'offline':
      return { className: 'badge badge--neutral', label: 'Offline' };
    case 'no_data':
      return { className: 'badge badge--neutral', label: 'Sem dados' };
  }
}

type DeviceOption = { id: string; name: string; siteId: string; siteName?: string };
type PlaylistOption = { id: string; name: string };

type CellAssignment = {
  row: number;
  col: number;
  deviceId: string;
};

export default function VideoWallDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = typeof params.id === 'string' ? params.id : '';

  const [wall, setWall] = useState<VideoWallDetail | null>(null);
  const [devices, setDevices] = useState<DeviceOption[]>([]);
  const [playlists, setPlaylists] = useState<PlaylistOption[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);

  const [editName, setEditName] = useState('');
  const [playlistId, setPlaylistId] = useState('');
  const [savingMeta, setSavingMeta] = useState(false);

  const [cells, setCells] = useState<CellAssignment[]>([]);
  const [savingTiles, setSavingTiles] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const [health, setHealth] = useState<WallSyncHealth | null>(null);

  const siteDevices = useMemo(() => {
    if (!wall) return [];
    return devices.filter((d) => d.siteId === wall.siteId);
  }, [devices, wall]);

  const load = useCallback(async () => {
    if (!id) return;
    setLoadErr(null);
    try {
      const w = await api<VideoWallDetail>(`/video-walls/${id}`);
      setWall(w);
      setEditName(w.name);
      setPlaylistId(w.playlistId ?? '');
      setCells(
        w.tiles.map((t) => ({
          row: t.row,
          col: t.col,
          deviceId: t.deviceId,
        }))
      );
    } catch (e) {
      setLoadErr(e instanceof Error ? e.message : 'Erro');
    }
  }, [id]);

  const loadHealth = useCallback(async () => {
    if (!id) return;
    try {
      const h = await api<WallSyncHealth>(`/video-walls/${id}/health`);
      setHealth(h);
    } catch {
      setHealth(null);
    }
  }, [id]);

  useEffect(() => {
    if (!getToken()) {
      router.replace('/login');
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const [d, p] = await Promise.all([
          api<DeviceOption[]>('/devices'),
          api<PlaylistOption[]>('/playlists'),
        ]);
        if (cancelled) return;
        setDevices(d);
        setPlaylists(p);
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
    if (!id || !getToken()) return;
    void loadHealth();
    const timer = window.setInterval(() => void loadHealth(), HEALTH_POLL_MS);
    const token = sessionStorage.getItem('access_token');
    const stopWs =
      token && id
        ? connectCmsWallRealtime({
            accessToken: token,
            wallId: id,
            onEvent: () => void loadHealth(),
          })
        : () => undefined;
    return () => {
      window.clearInterval(timer);
      stopWs();
    };
  }, [id, loadHealth]);

  function deviceAt(row: number, col: number): string {
    return cells.find((c) => c.row === row && c.col === col)?.deviceId ?? '';
  }

  function setDeviceAt(row: number, col: number, deviceId: string) {
    setCells((prev) => {
      const next = prev.filter((c) => !(c.row === row && c.col === col));
      if (deviceId) {
        const withoutDup = next.filter(
          (c) => c.deviceId !== deviceId && !(c.row === row && c.col === col)
        );
        withoutDup.push({ row, col, deviceId });
        return withoutDup;
      }
      return next.filter((c) => !(c.row === row && c.col === col));
    });
  }

  async function onSaveMeta(e: FormEvent) {
    e.preventDefault();
    if (!wall) return;
    setSavingMeta(true);
    setError(null);
    try {
      await api(`/video-walls/${wall.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editName.trim(),
          playlistId: playlistId || null,
        }),
      });
      await load();
      setActionMsg('Metadados guardados.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao guardar');
    } finally {
      setSavingMeta(false);
    }
  }

  async function onSaveTiles() {
    if (!wall) return;
    setSavingTiles(true);
    setError(null);
    try {
      await api(`/video-walls/${wall.id}/tiles`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tiles: cells }),
      });
      await load();
      setActionMsg('Mapeamento de tiles guardado.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao guardar tiles');
    } finally {
      setSavingTiles(false);
    }
  }

  async function onPublish() {
    if (!wall) return;
    setPublishing(true);
    setError(null);
    setActionMsg(null);
    try {
      const res = await api<{ ok: boolean; syncEpochMs: string; tileCount: number }>(
        `/video-walls/${wall.id}/publish`,
        { method: 'POST' }
      );
      await load();
      setActionMsg(
        `Publicado em ${res.tileCount} tile(s). Sync epoch: ${res.syncEpochMs}`
      );
      await loadHealth();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao publicar');
    } finally {
      setPublishing(false);
    }
  }

  async function onSync() {
    if (!wall) return;
    setSyncing(true);
    setError(null);
    setActionMsg(null);
    try {
      const res = await api<{ ok: boolean; syncEpochMs: string }>(
        `/video-walls/${wall.id}/sync`,
        { method: 'POST' }
      );
      await load();
      setActionMsg(`Re-sync disparado. Novo epoch: ${res.syncEpochMs}`);
      await loadHealth();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro no sync');
    } finally {
      setSyncing(false);
    }
  }

  if (loadErr) {
    return (
      <>
        <PageHeader title="Video wall" lead="Detalhe da parede" />
        <p className="text-danger">{loadErr}</p>
        <Link href="/video-walls" className="btn btn--ghost">
          Voltar
        </Link>
      </>
    );
  }

  if (!wall) {
    return <p className="text-muted">A carregar…</p>;
  }

  return (
    <>
      <PageHeader
        title={wall.name}
        lead={`${wall.site.name} — grelha ${wall.gridRows}×${wall.gridCols}, canvas ${wall.virtualWidth}×${wall.virtualHeight}px`}
        actions={
          <Link href="/video-walls" className="btn btn--ghost">
            <ArrowLeft strokeWidth={2} aria-hidden />
            Lista
          </Link>
        }
      />

      {error && <p className="text-danger">{error}</p>}
      {actionMsg && <p className="text-muted">{actionMsg}</p>}

      <div className="detail-grid">
        <section className="panel">
          <h2 className="panel__title">Configuração</h2>
          <form onSubmit={onSaveMeta} className="form-stack">
            <label>
              <span>Nome</span>
              <input
                className="input"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                required
              />
            </label>
            <label>
              <span>Playlist</span>
              <select
                className="input"
                value={playlistId}
                onChange={(e) => setPlaylistId(e.target.value)}
              >
                <option value="">— Nenhuma —</option>
                {playlists.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
            <p className="text-muted" style={{ margin: 0 }}>
              Estado: <strong>{wall.status}</strong>
              {wall.syncEpochMs && (
                <>
                  {' '}
                  · Último sync: {formatDateTimePtBr(new Date(Number(wall.syncEpochMs)).toISOString())}
                </>
              )}
            </p>
            <button type="submit" className="btn btn--primary" disabled={savingMeta}>
              {savingMeta ? 'A guardar…' : 'Guardar'}
            </button>
          </form>

          <div className="btn-row" style={{ marginTop: '1rem' }}>
            <button
              type="button"
              className="btn btn--primary"
              onClick={() => void onPublish()}
              disabled={publishing}
            >
              <Send strokeWidth={2} aria-hidden />
              {publishing ? 'A publicar…' : 'Publicar parede'}
            </button>
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => void onSync()}
              disabled={syncing}
            >
              <RefreshCw strokeWidth={2} aria-hidden />
              {syncing ? 'A sincronizar…' : 'Re-sync'}
            </button>
          </div>
        </section>

        <section className="panel noc">
          <h2 className="panel__title">Saúde de sync</h2>
          {!health && <p className="text-muted">A recolher telemetria dos tiles…</p>}
          {health && (
            <>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 16 }}>
                <span className={syncStatusBadge(health.groupStatus).className}>
                  {syncStatusBadge(health.groupStatus).label}
                </span>
                {health.maxDriftMs != null && (
                  <span className="text-muted" style={{ fontSize: 13 }}>
                    Deriva máxima: {Math.round(health.maxDriftMs)} ms (tol. {health.syncToleranceMs} ms)
                  </span>
                )}
                {health.expectedItemIndex != null && (
                  <span className="text-muted" style={{ fontSize: 13 }}>
                    Item esperado: {health.expectedItemIndex + 1}
                    {health.expectedPositionMs != null &&
                      ` @ ${Math.round(health.expectedPositionMs)} ms`}
                  </span>
                )}
              </div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: `repeat(${wall.gridCols}, 1fr)`,
                  gap: 8,
                }}
              >
                {Array.from({ length: wall.gridRows * wall.gridCols }, (_, i) => {
                  const row = Math.floor(i / wall.gridCols);
                  const col = i % wall.gridCols;
                  const tile = health.tiles.find((t) => t.row === row && t.col === col);
                  const badge = syncStatusBadge(tile?.status ?? 'no_data');
                  return (
                    <div
                      key={`health-${row}-${col}`}
                      className="wall-grid-cell"
                      style={{
                        padding: 12,
                        border: '1px solid var(--color-border)',
                        borderRadius: 8,
                        background: 'var(--color-surface-muted)',
                      }}
                    >
                      <div style={{ fontSize: 12, marginBottom: 6 }} className="text-muted">
                        Tile ({row},{col})
                      </div>
                      <div style={{ fontWeight: 600, marginBottom: 6 }}>
                        {tile?.deviceName ?? '—'}
                      </div>
                      <span className={badge.className}>{badge.label}</span>
                      {tile?.driftMs != null && tile.status !== 'offline' && (
                        <div className="text-muted" style={{ fontSize: 12, marginTop: 8 }}>
                          Deriva: {Math.round(tile.driftMs)} ms
                          {tile.itemIndex != null && ` · item ${tile.itemIndex + 1}`}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              <p className="text-muted" style={{ fontSize: 12, marginTop: 12, marginBottom: 0 }}>
                Atualizado {formatDateTimePtBr(health.checkedAt)} — poll {HEALTH_POLL_MS / 1000}s + live WS
              </p>
            </>
          )}
        </section>

        <section className="panel">
          <h2 className="panel__title">Mapeamento de tiles</h2>
          <p className="text-muted">
            Atribua um device do site a cada célula. Só devices deste site aparecem na lista.
          </p>

          <div
            className="wall-grid-preview"
            style={{
              display: 'grid',
              gridTemplateColumns: `repeat(${wall.gridCols}, 1fr)`,
              gap: 8,
              marginBottom: 16,
            }}
          >
            {Array.from({ length: wall.gridRows * wall.gridCols }, (_, i) => {
              const row = Math.floor(i / wall.gridCols);
              const col = i % wall.gridCols;
              const assigned = deviceAt(row, col);
              const usedElsewhere = new Set(
                cells.filter((c) => !(c.row === row && c.col === col)).map((c) => c.deviceId)
              );
              return (
                <div key={`${row}-${col}`} className="wall-grid-cell panel" style={{ padding: 12 }}>
                  <div className="text-muted" style={{ fontSize: 12, marginBottom: 6 }}>
                    ({row},{col})
                  </div>
                  <select
                    className="input"
                    value={assigned}
                    onChange={(e) => setDeviceAt(row, col, e.target.value)}
                  >
                    <option value="">— vazio —</option>
                    {siteDevices.map((d) => (
                      <option
                        key={d.id}
                        value={d.id}
                        disabled={usedElsewhere.has(d.id)}
                      >
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>
              );
            })}
          </div>

          <button
            type="button"
            className="btn btn--primary"
            onClick={() => void onSaveTiles()}
            disabled={savingTiles}
          >
            {savingTiles ? 'A guardar…' : 'Guardar mapeamento'}
          </button>

          {wall.tiles.length > 0 && (
            <ul className="text-muted" style={{ marginTop: 16 }}>
              {wall.tiles.map((t) => (
                <li key={t.id}>
                  ({t.row},{t.col}) → {t.device.name} ({t.device.platform})
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
