'use client';

import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api, getToken } from '@/lib/api';
import { formatDateTimePtBr } from '@/lib/format-date';

type GroupDevice = {
  id: string;
  name: string;
  siteName?: string;
  platform: string;
  status: string;
  lastSeenAt: string | null;
};

type GroupDetail = {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
  devices: GroupDevice[];
};

type DeviceOption = { id: string; name: string; siteName?: string };

type AssetOption = { id: string; name: string; kind: string };
type PlaylistOption = { id: string; name: string };

type BulkResult = {
  ok: boolean;
  targetCount: number;
  applied: number;
  errors: { deviceId: string; message: string }[];
  publications?: { deviceId: string; publicationId: string; version: number }[];
};

export default function GroupDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = typeof params.id === 'string' ? params.id : '';

  const [group, setGroup] = useState<GroupDetail | null>(null);
  const [allDevices, setAllDevices] = useState<DeviceOption[]>([]);
  const [assets, setAssets] = useState<AssetOption[]>([]);
  const [playlists, setPlaylists] = useState<PlaylistOption[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);

  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [savingMeta, setSavingMeta] = useState(false);

  const [selectedToAdd, setSelectedToAdd] = useState<string[]>([]);
  const [adding, setAdding] = useState(false);

  const [contentMode, setContentMode] = useState<'asset' | 'playlist'>('asset');
  const [selectedAssetId, setSelectedAssetId] = useState('');
  const [selectedPlaylistId, setSelectedPlaylistId] = useState('');
  const [publishLabel, setPublishLabel] = useState('');
  const [assigning, setAssigning] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [bulkResult, setBulkResult] = useState<BulkResult | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setLoadErr(null);
    try {
      const g = await api<GroupDetail>(`/groups/${id}`);
      setGroup(g);
      setEditName(g.name);
      setEditDescription(g.description ?? '');
    } catch (e) {
      setLoadErr(e instanceof Error ? e.message : 'Erro');
      setGroup(null);
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
        const [devs, ast, pls] = await Promise.all([
          api<DeviceOption[]>('/devices'),
          api<AssetOption[]>('/assets'),
          api<PlaylistOption[]>('/playlists'),
        ]);
        if (!cancelled) {
          setAllDevices(
            devs.map((d) => ({
              id: d.id,
              name: d.name,
              siteName: d.siteName,
            }))
          );
          setAssets(ast);
          setPlaylists(pls);
        }
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  useEffect(() => {
    void load();
  }, [load]);

  const memberIds = useMemo(
    () => new Set(group?.devices.map((d) => d.id) ?? []),
    [group?.devices]
  );

  const availableDevices = useMemo(
    () => allDevices.filter((d) => !memberIds.has(d.id)),
    [allDevices, memberIds]
  );

  async function saveMeta(e: FormEvent) {
    e.preventDefault();
    if (!id) return;
    setSavingMeta(true);
    setError(null);
    try {
      await api(`/groups/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: editName.trim(),
          description: editDescription.trim(),
        }),
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro');
    } finally {
      setSavingMeta(false);
    }
  }

  async function addMembers() {
    if (!id || selectedToAdd.length === 0) return;
    setAdding(true);
    setError(null);
    try {
      await api(`/groups/${id}/members`, {
        method: 'POST',
        body: JSON.stringify({ deviceIds: selectedToAdd }),
      });
      setSelectedToAdd([]);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro');
    } finally {
      setAdding(false);
    }
  }

  async function removeMember(deviceId: string) {
    if (!id) return;
    setError(null);
    try {
      await api(`/groups/${id}/members/${deviceId}`, { method: 'DELETE' });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro');
    }
  }

  async function assignTestContent() {
    if (!id) return;
    const body =
      contentMode === 'asset'
        ? { assetId: selectedAssetId }
        : { playlistId: selectedPlaylistId };
    setAssigning(true);
    setBulkResult(null);
    setError(null);
    try {
      const res = await api<BulkResult>(`/groups/${id}/test-content`, {
        method: 'POST',
        body: JSON.stringify(body),
      });
      setBulkResult(res);
      if (!res.ok) {
        setError(
          `Aplicado em ${res.applied}/${res.targetCount}. Ver detalhes abaixo.`
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro');
    } finally {
      setAssigning(false);
    }
  }

  async function publishContent() {
    if (!id) return;
    const body =
      contentMode === 'asset'
        ? { assetId: selectedAssetId, ...(publishLabel.trim() ? { label: publishLabel.trim() } : {}) }
        : {
            playlistId: selectedPlaylistId,
            ...(publishLabel.trim() ? { label: publishLabel.trim() } : {}),
          };
    setPublishing(true);
    setBulkResult(null);
    setError(null);
    try {
      const res = await api<BulkResult>(`/groups/${id}/publish`, {
        method: 'POST',
        body: JSON.stringify(body),
      });
      setBulkResult(res);
      if (!res.ok) {
        setError(
          `Publicado em ${res.applied}/${res.targetCount}. Ver detalhes abaixo.`
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro');
    } finally {
      setPublishing(false);
    }
  }

  async function deleteGroup() {
    if (!id || !group) return;
    if (!window.confirm(`Eliminar o grupo «${group.name}»? Os dispositivos não são eliminados.`)) {
      return;
    }
    setError(null);
    try {
      await api(`/groups/${id}`, { method: 'DELETE' });
      router.push('/groups');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro');
    }
  }

  function toggleDeviceSelect(deviceId: string) {
    setSelectedToAdd((prev) =>
      prev.includes(deviceId)
        ? prev.filter((x) => x !== deviceId)
        : [...prev, deviceId]
    );
  }

  if (!id) {
    return <p className="text-muted">ID inválido.</p>;
  }

  return (
    <>
      <header className="page-header">
        <div>
          <h1>{group?.name ?? 'Grupo'}</h1>
          <p className="page-header__lead">
            Membros, conteúdo de teste e publicação conjunta para este conjunto de dispositivos.
          </p>
        </div>
        <div className="page-header__actions">
          <Link href="/groups" className="btn btn--ghost">
            <i className="fa-solid fa-arrow-left" aria-hidden />
            Lista
          </Link>
          <button type="button" className="btn btn--ghost" onClick={() => void deleteGroup()}>
            <i className="fa-solid fa-trash" aria-hidden />
            Eliminar grupo
          </button>
        </div>
      </header>

      {loadErr && <p className="text-danger">{loadErr}</p>}
      {error && <p className="text-danger">{error}</p>}

      {group && (
        <>
          <section className="surface-card" style={{ padding: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
            <h2 style={{ fontSize: 'var(--text-sm)', fontWeight: 600, margin: '0 0 var(--space-3)' }}>
              Dados do grupo
            </h2>
            <form onSubmit={saveMeta}>
              <label className="field">
                <span>Nome</span>
                <input
                  className="input"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  required
                />
              </label>
              <label className="field">
                <span>Descrição</span>
                <textarea
                  className="input"
                  rows={2}
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                />
              </label>
              <button type="submit" className="btn btn--primary" disabled={savingMeta}>
                {savingMeta ? 'A guardar…' : 'Guardar'}
              </button>
            </form>
          </section>

          <section style={{ marginBottom: 'var(--space-8)' }}>
            <h2 style={{ fontSize: 'var(--text-md)', fontWeight: 600, margin: '0 0 var(--space-3)' }}>
              Dispositivos no grupo ({group.devices.length})
            </h2>
            <p className="text-muted">
              Apenas dispositivos já registados podem ser adicionados.{' '}
              <Link href="/devices/new">Novo dispositivo</Link>
            </p>

            {availableDevices.length > 0 && (
              <div style={{ marginBottom: 'var(--space-4)' }}>
                <div className="text-muted" style={{ fontSize: 13, marginBottom: 8 }}>
                  Selecione um ou mais dispositivos para adicionar:
                </div>
                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: 'var(--space-2)',
                    maxHeight: 160,
                    overflowY: 'auto',
                    border: '1px solid var(--color-border, #e2e8f0)',
                    borderRadius: 8,
                    padding: 'var(--space-2)',
                  }}
                >
                  {availableDevices.map((d) => (
                    <label
                      key={d.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        cursor: 'pointer',
                        fontSize: 14,
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={selectedToAdd.includes(d.id)}
                        onChange={() => toggleDeviceSelect(d.id)}
                      />
                      <span>
                        {d.name}
                        {d.siteName ? (
                          <span className="text-muted"> — {d.siteName}</span>
                        ) : null}
                      </span>
                    </label>
                  ))}
                </div>
                <button
                  type="button"
                  className="btn btn--primary"
                  style={{ marginTop: 8 }}
                  disabled={adding || selectedToAdd.length === 0}
                  onClick={() => void addMembers()}
                >
                  {adding ? 'A adicionar…' : 'Adicionar ao grupo'}
                </button>
              </div>
            )}

            {group.devices.length === 0 ? (
              <p className="text-muted">Nenhum dispositivo. Adicione pelo menos um para enviar conteúdo.</p>
            ) : (
              <div className="surface-table-card" style={{ overflowX: 'auto' }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Nome</th>
                      <th>Site</th>
                      <th>Estado</th>
                      <th>Último contacto</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {group.devices.map((d) => (
                      <tr key={d.id}>
                        <td>
                          <Link href={`/devices/${d.id}`}>{d.name}</Link>
                        </td>
                        <td>{d.siteName ?? '—'}</td>
                        <td>{d.status}</td>
                        <td>
                          {d.lastSeenAt ? formatDateTimePtBr(d.lastSeenAt) : '—'}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <button
                            type="button"
                            className="btn btn--ghost"
                            onClick={() => void removeMember(d.id)}
                          >
                            Remover
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section style={{ marginBottom: 'var(--space-8)' }}>
            <h2 style={{ fontSize: 'var(--text-md)', fontWeight: 600, margin: '0 0 var(--space-3)' }}>
              Conteúdo para todo o grupo
            </h2>
            <p className="text-muted">
              O mesmo envio é aplicado a <strong>todos</strong> os dispositivos listados acima.{' '}
              <Link href="/assets">Assets</Link> e <Link href="/playlists">Playlists</Link>.
            </p>

            <div style={{ marginBottom: 'var(--space-4)' }} className="field">
              <span>Tipo</span>
              <div style={{ display: 'flex', gap: 'var(--space-4)', marginTop: 8 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="gContentMode"
                    checked={contentMode === 'asset'}
                    onChange={() => setContentMode('asset')}
                  />
                  Asset único
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="gContentMode"
                    checked={contentMode === 'playlist'}
                    onChange={() => setContentMode('playlist')}
                  />
                  Playlist
                </label>
              </div>
            </div>

            {contentMode === 'asset' && assets.length === 0 && (
              <p className="text-muted">Nenhum asset.</p>
            )}
            {contentMode === 'asset' && assets.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)', alignItems: 'end' }}>
                <label className="field" style={{ flex: '1 1 220px', margin: 0 }}>
                  <span>Asset</span>
                  <select
                    className="select"
                    value={selectedAssetId}
                    onChange={(e) => setSelectedAssetId(e.target.value)}
                  >
                    <option value="">Escolher…</option>
                    {assets.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name} ({a.kind})
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  className="btn btn--ghost"
                  disabled={!selectedAssetId || assigning || publishing || group.devices.length === 0}
                  onClick={() => void assignTestContent()}
                >
                  {assigning ? 'A aplicar…' : 'Aplicar teste a todos'}
                </button>
                <button
                  type="button"
                  className="btn btn--ghost"
                  disabled={!selectedAssetId || assigning || publishing || group.devices.length === 0}
                  onClick={() => void publishContent()}
                >
                  {publishing ? 'A publicar…' : 'Publicar versão em todos'}
                </button>
              </div>
            )}

            {contentMode === 'playlist' && playlists.length === 0 && (
              <p className="text-muted">Nenhuma playlist.</p>
            )}
            {contentMode === 'playlist' && playlists.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)', alignItems: 'end' }}>
                <label className="field" style={{ flex: '1 1 220px', margin: 0 }}>
                  <span>Playlist</span>
                  <select
                    className="select"
                    value={selectedPlaylistId}
                    onChange={(e) => setSelectedPlaylistId(e.target.value)}
                  >
                    <option value="">Escolher…</option>
                    {playlists.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  className="btn btn--ghost"
                  disabled={!selectedPlaylistId || assigning || publishing || group.devices.length === 0}
                  onClick={() => void assignTestContent()}
                >
                  {assigning ? 'A aplicar…' : 'Aplicar teste a todos'}
                </button>
                <button
                  type="button"
                  className="btn btn--ghost"
                  disabled={!selectedPlaylistId || assigning || publishing || group.devices.length === 0}
                  onClick={() => void publishContent()}
                >
                  {publishing ? 'A publicar…' : 'Publicar versão em todos'}
                </button>
              </div>
            )}

            <div className="field" style={{ marginTop: 'var(--space-3)', maxWidth: 400 }}>
              <label htmlFor="g-pub-label">Rótulo opcional (publicação)</label>
              <input
                id="g-pub-label"
                className="input"
                value={publishLabel}
                onChange={(e) => setPublishLabel(e.target.value)}
                placeholder="Ex.: Loja norte — campanha"
                autoComplete="off"
              />
            </div>
          </section>

          {bulkResult && (
            <section className="surface-card" style={{ padding: 'var(--space-4)' }}>
              <h3 style={{ fontSize: 'var(--text-sm)', fontWeight: 600, margin: '0 0 var(--space-2)' }}>
                Resultado ({bulkResult.applied}/{bulkResult.targetCount} OK)
              </h3>
              {bulkResult.errors.length > 0 && (
                <ul className="text-danger" style={{ margin: '0 0 var(--space-2)', paddingLeft: 20 }}>
                  {bulkResult.errors.map((e) => (
                    <li key={e.deviceId}>
                      <code>{e.deviceId}</code>: {e.message}
                    </li>
                  ))}
                </ul>
              )}
              {bulkResult.publications && bulkResult.publications.length > 0 && (
                <ul className="text-muted" style={{ margin: 0, paddingLeft: 20, fontSize: 13 }}>
                  {bulkResult.publications.map((p) => (
                    <li key={p.deviceId}>
                      {p.deviceId.slice(0, 8)}… → v{p.version}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}
        </>
      )}

      {!group && !loadErr && <p className="text-muted">Carregando…</p>}
    </>
  );
}
