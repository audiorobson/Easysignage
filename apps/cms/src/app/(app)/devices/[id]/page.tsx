'use client';

import Link from 'next/link';
import { useSearchParams, useParams } from 'next/navigation';
import { useCallback, useEffect, useState, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Copy, ExternalLink, LayoutGrid, Trash2 } from 'lucide-react';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { PageHeader } from '@/components/ui/PageHeader';
import { ConnectionPill, StatusPill } from '@/components/ui/StatusPill';
import { PublicationSyncBadge } from '@/components/ui/StatusBadge';
import { deviceState, displayOrientationLabel, platformLabel, PLATFORM_OPTIONS } from '@/lib/device-labels';
import { DISPLAY_ORIENTATIONS, VIEWPORT_PRESETS, CONTENT_FIT_MODES, contentFitLabelPt, DEFAULT_CONTENT_FIT, layoutZoneStyle, type LayoutTemplateZone, type ContentFitMode } from '@easysignage/shared-types';
import { buildDisplayBody, displayFromJson, sortZonesForCanvas, zoneColor } from '@/lib/layout-editor';
import { api, getToken } from '@/lib/api';
import { formatDateTimePtBr } from '@/lib/format-date';
import { webPlayerPairingUrl } from '@/lib/player-url';

type DeviceMask = {
  id: string;
  name: string;
  siteId: string;
  siteName?: string;
  platform: string;
  status: string;
  serialNumber?: string | null;
  runtimeVersion?: string | null;
  lastSeenAt: string | null;
  pairingExpiresAt: string | null;
  wakeMac?: string | null;
  viewportWidth?: number;
  viewportHeight?: number;
  displayOrientation?: string;
};

type AssetOption = { id: string; name: string };

type PlaylistOption = { id: string; name: string; itemCount?: number };

type DeviceLayoutRow = {
  id: string;
  templateId: string;
  name: string | null;
  revision: string;
  zonesJson: {
    zoneId: string;
    source: { type: string; playlistId?: string; assetId?: string } | null;
    display?: { fit?: string; targetWidth?: number; targetHeight?: number };
  }[];
  template: { id: string; slug: string; name: string; zonesJson: LayoutTemplateZone[] };
};

type PublicationRow = {
  id: string;
  version: number;
  label: string | null;
  payloadJson: unknown;
  createdAt: string;
};

type SiteOption = { id: string; name: string };

type AdminStatePayload = {
  device: DeviceMask;
  online: boolean;
  state: {
    lastSyncAt: string | null;
    storageFreeMb: number | null;
    cpuPercent: string | null;
    memoryPercent: string | null;
    networkStatus: string | null;
    currentPublicationId: string | null;
    expectedPublicationVersion: number | null;
    appliedPublicationVersion: number | null;
    appliedContentRevision: string | null;
    appliedAt: string | null;
    publicationSynced: boolean;
    currentItemJson: unknown;
    updatedAt: string;
    previewSnapshotAt: string | null;
    previewSnapshotKey: string | null;
  } | null;
  lastHeartbeat: {
    receivedAt: string;
    appVersion: string | null;
    isOnline: boolean;
  } | null;
};

type DeviceTab = 'resumo' | 'ecra' | 'conteudo' | 'cadastro';

const DEVICE_TABS: { id: DeviceTab; label: string; hint?: string }[] = [
  { id: 'resumo', label: 'Resumo' },
  { id: 'ecra', label: 'Ecrã & Layout', hint: 'Novo' },
  { id: 'conteudo', label: 'Conteúdo' },
  { id: 'cadastro', label: 'Cadastro' },
];

function DeviceDetailInner({ id }: { id: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabFromQuery = searchParams.get('tab');
  const initialTab: DeviceTab =
    tabFromQuery === 'resumo' ||
    tabFromQuery === 'ecra' ||
    tabFromQuery === 'conteudo' ||
    tabFromQuery === 'cadastro'
      ? tabFromQuery
      : 'ecra';
  const pairingFromQuery = searchParams.get('pairing');
  const pairingExp = searchParams.get('exp');

  const [payload, setPayload] = useState<AdminStatePayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pairing, setPairing] = useState<{
    code: string;
    expiresAt: string;
  } | null>(
    pairingFromQuery
      ? { code: pairingFromQuery, expiresAt: pairingExp ?? '' }
      : null
  );
  const [loadingPair, setLoadingPair] = useState(false);
  const [assets, setAssets] = useState<AssetOption[]>([]);
  const [playlists, setPlaylists] = useState<PlaylistOption[]>([]);
  const [contentMode, setContentMode] = useState<'asset' | 'playlist'>('asset');
  const [selectedAssetId, setSelectedAssetId] = useState('');
  const [selectedPlaylistId, setSelectedPlaylistId] = useState('');
  const [assigning, setAssigning] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [publishLabel, setPublishLabel] = useState('');
  const [publications, setPublications] = useState<PublicationRow[]>([]);
  const [sites, setSites] = useState<SiteOption[]>([]);
  const [editName, setEditName] = useState('');
  const [editSiteId, setEditSiteId] = useState('');
  const [editPlatform, setEditPlatform] = useState('electron');
  const [editStatus, setEditStatus] = useState('provisioned');
  const [editWakeMac, setEditWakeMac] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [pairSuccess, setPairSuccess] = useState(false);
  const [copyMsg, setCopyMsg] = useState<string | null>(null);
  const [vpWidth, setVpWidth] = useState(1920);
  const [vpHeight, setVpHeight] = useState(1080);
  const [vpOrientation, setVpOrientation] = useState('landscape');
  const [vpPreset, setVpPreset] = useState('custom');
  const [savingViewport, setSavingViewport] = useState(false);
  const [deviceLayout, setDeviceLayout] = useState<DeviceLayoutRow | null>(null);
  const [contentFit, setContentFit] = useState<ContentFitMode>(DEFAULT_CONTENT_FIT);
  const [contentTargetW, setContentTargetW] = useState('');
  const [contentTargetH, setContentTargetH] = useState('');
  const [deviceTab, setDeviceTab] = useState<DeviceTab>(initialTab);

  const load = useCallback(async () => {
    const [data, layout] = await Promise.all([
      api<AdminStatePayload>(`/devices/${id}/state`),
      api<DeviceLayoutRow | null>(`/devices/${id}/layout`).catch(() => null),
    ]);
    setPayload(data);
    setDeviceLayout(layout);
  }, [id]);

  const loadPublications = useCallback(async () => {
    try {
      const list = await api<PublicationRow[]>(`/devices/${id}/publications`);
      setPublications(list);
    } catch {
      setPublications([]);
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
    if (!getToken()) return;
    void loadPublications();
  }, [loadPublications]);

  useEffect(() => {
    if (!getToken()) return;
    let cancelled = false;
    (async () => {
      try {
        const list = await api<AssetOption[]>('/assets');
        if (!cancelled) setAssets(list);
      } catch {
        if (!cancelled) setAssets([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!getToken()) return;
    let cancelled = false;
    (async () => {
      try {
        const list = await api<PlaylistOption[]>('/playlists');
        if (!cancelled) setPlaylists(list);
      } catch {
        if (!cancelled) setPlaylists([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!getToken()) return;
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
  }, []);

  useEffect(() => {
    const raw = payload?.state?.currentItemJson;
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return;
    const obj = raw as {
      type?: string;
      assetId?: string;
      playlistId?: string;
      display?: unknown;
    };
    if (obj.display) {
      const d = displayFromJson(obj.display);
      setContentFit(d.fit);
      setContentTargetW(d.targetWidth);
      setContentTargetH(d.targetHeight);
    }
    if (obj.type === 'playlist' && typeof obj.playlistId === 'string') {
      setContentMode('playlist');
      setSelectedPlaylistId(obj.playlistId);
    } else if (
      (obj.type === 'asset' || obj.type === 'image') &&
      typeof obj.assetId === 'string'
    ) {
      setContentMode('asset');
      setSelectedAssetId(obj.assetId);
    }
  }, [payload?.state?.currentItemJson]);

  const device = payload?.device;

  /** Atualização em tempo real durante pareamento ou enquanto aguarda ligação. */
  useEffect(() => {
    if (!getToken() || !device) return;
    const awaitingPair = device.status === 'provisioned' || pairing !== null;
    const pollMs = awaitingPair ? 4000 : 15000;
    const id = window.setInterval(() => {
      void load().catch(() => undefined);
    }, pollMs);
    return () => window.clearInterval(id);
  }, [device?.status, device?.id, pairing, load]);

  useEffect(() => {
    if (device?.status === 'active' && pairing) {
      setPairing(null);
      setPairSuccess(true);
      const t = window.setTimeout(() => setPairSuccess(false), 12000);
      return () => window.clearTimeout(t);
    }
  }, [device?.status, pairing]);

  useEffect(() => {
    if (!device) return;
    setEditName(device.name);
    setEditSiteId(device.siteId);
    setEditPlatform(device.platform || 'unknown');
    setEditStatus(device.status);
    setEditWakeMac(device.wakeMac ?? '');
    setVpWidth(device.viewportWidth ?? 1920);
    setVpHeight(device.viewportHeight ?? 1080);
    setVpOrientation(device.displayOrientation ?? 'landscape');
    setVpPreset('custom');
  }, [
    device?.id,
    device?.name,
    device?.siteId,
    device?.platform,
    device?.status,
    device?.wakeMac,
    device?.viewportWidth,
    device?.viewportHeight,
    device?.displayOrientation,
  ]);

  async function saveViewport() {
    setSavingViewport(true);
    setError(null);
    try {
      await api(`/devices/${id}/viewport`, {
        method: 'PATCH',
        body: JSON.stringify({
          viewportWidth: vpWidth,
          viewportHeight: vpHeight,
          displayOrientation: vpOrientation,
        }),
      });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro');
    } finally {
      setSavingViewport(false);
    }
  }

  async function assignTestContent() {
    if (contentMode === 'asset' && !selectedAssetId) return;
    if (contentMode === 'playlist' && !selectedPlaylistId) return;
    setAssigning(true);
    setError(null);
    try {
      const display = buildDisplayBody({
        fit: contentFit,
        targetWidth: contentTargetW,
        targetHeight: contentTargetH,
      });
      const body =
        contentMode === 'asset'
          ? { assetId: selectedAssetId, display }
          : { playlistId: selectedPlaylistId, display };
      await api(`/devices/${id}/test-content`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      });
      await load();
      await loadPublications();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro');
    } finally {
      setAssigning(false);
    }
  }

  async function publishContent() {
    if (contentMode === 'asset' && !selectedAssetId) return;
    if (contentMode === 'playlist' && !selectedPlaylistId) return;
    setPublishing(true);
    setError(null);
    try {
      const display = buildDisplayBody({
        fit: contentFit,
        targetWidth: contentTargetW,
        targetHeight: contentTargetH,
      });
      const body: Record<string, unknown> =
        contentMode === 'asset'
          ? { assetId: selectedAssetId, display }
          : { playlistId: selectedPlaylistId, display };
      const label = publishLabel.trim();
      if (label) body.label = label;
      await api(`/devices/${id}/publish`, {
        method: 'POST',
        body: JSON.stringify(body),
      });
      await Promise.all([load(), loadPublications()]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro');
    } finally {
      setPublishing(false);
    }
  }

  async function copyPairingCode() {
    if (!pairing?.code) return;
    try {
      await navigator.clipboard.writeText(pairing.code);
      setCopyMsg('Código copiado.');
      window.setTimeout(() => setCopyMsg(null), 2500);
    } catch {
      setCopyMsg('Não foi possível copiar.');
    }
  }

  async function regenerate() {
    setLoadingPair(true);
    setError(null);
    try {
      const res = await api<{
        pairingCode: string;
        pairingExpiresAt: string;
      }>(`/devices/${id}/pairing-code`, { method: 'POST' });
      setPairing({
        code: res.pairingCode,
        expiresAt: res.pairingExpiresAt,
      });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro');
    } finally {
      setLoadingPair(false);
    }
  }

  async function saveCadastro() {
    const n = editName.trim();
    if (!n) {
      setError('Indique um nome para o dispositivo.');
      return;
    }
    if (!editSiteId) {
      setError('Selecione um site.');
      return;
    }
    setSavingEdit(true);
    setError(null);
    try {
      await api(`/devices/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: n,
          siteId: editSiteId,
          platform: editPlatform,
          status: editStatus,
          wakeMac: editWakeMac.trim(),
        }),
      });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro');
    } finally {
      setSavingEdit(false);
    }
  }

  async function removeDeviceConfirmed() {
    if (!device) return;
    setRemoving(true);
    setError(null);
    try {
      await api(`/devices/${id}`, { method: 'DELETE' });
      router.push('/devices');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao eliminar');
      setConfirmRemove(false);
    } finally {
      setRemoving(false);
    }
  }

  return (
    <>
      <PageHeader
        title={device?.name ?? 'Dispositivo'}
        lead="Viewport, layouts multi-zona, fit de conteúdo, pareamento e publicações."
        actions={
          <>
            {device && (
              <button
                type="button"
                className="btn btn--ghost"
                style={{ color: 'var(--color-danger-text)' }}
                disabled={removing}
                onClick={() => setConfirmRemove(true)}
              >
                <Trash2 size={17} strokeWidth={1.9} aria-hidden />
                {removing ? 'A remover…' : 'Eliminar dispositivo'}
              </button>
            )}
            <Link href="/devices" className="btn btn--ghost">
              <ArrowLeft size={17} strokeWidth={1.9} aria-hidden />
              Lista
            </Link>
          </>
        }
      />

      <section>
        {error && <p className="text-danger">{error}</p>}
        {!device && !error && <p className="text-muted">A carregar…</p>}
        {device && payload && (
          <>
            <nav
              className="filter-pills"
              style={{ marginBottom: 'var(--space-6)' }}
              aria-label="Secções do dispositivo"
            >
              {DEVICE_TABS.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  aria-pressed={deviceTab === tab.id}
                  className={deviceTab === tab.id ? 'is-active' : undefined}
                  onClick={() => setDeviceTab(tab.id)}
                >
                  {tab.label}
                  {tab.hint ? (
                    <span
                      style={{
                        marginLeft: 6,
                        fontSize: 10,
                        fontWeight: 700,
                        color: 'var(--color-primary-600, #2563eb)',
                      }}
                    >
                      {tab.hint}
                    </span>
                  ) : null}
                </button>
              ))}
            </nav>

            {deviceTab === 'resumo' && pairSuccess && (
              <p
                className="surface-card"
                style={{
                  padding: 'var(--space-4)',
                  marginBottom: 'var(--space-4)',
                  borderColor: 'var(--color-success-border, #86efac)',
                  color: 'var(--color-success-text)',
                }}
              >
                Player emparelhado com sucesso. Pode atribuir conteúdo abaixo.
              </p>
            )}

            {deviceTab === 'resumo' && (
              <>
            {(pairing || device.status === 'provisioned') && (
              <section
                className="surface-card"
                style={{ padding: 'var(--space-5)', marginBottom: 'var(--space-6)' }}
              >
                <h2 style={{ fontSize: 'var(--text-md)', fontWeight: 600, margin: '0 0 var(--space-2)' }}>
                  Ligar player
                </h2>
                <p className="text-muted" style={{ margin: '0 0 var(--space-4)' }}>
                  Abra o web player com o código ou copie-o para o terminal. O estado atualiza
                  automaticamente quando o player emparelhar.
                </p>
                {pairing ? (
                  <>
                    <div
                      style={{
                        fontSize: 28,
                        letterSpacing: 4,
                        fontWeight: 700,
                        fontFamily: 'ui-monospace, monospace',
                      }}
                    >
                      {pairing.code}
                    </div>
                    {pairing.expiresAt && (
                      <p className="text-muted" style={{ margin: 'var(--space-2) 0 var(--space-4)' }}>
                        Expira: {formatDateTimePtBr(pairing.expiresAt)}
                      </p>
                    )}
                    <div className="form-actions" style={{ marginTop: 0 }}>
                      <button type="button" className="btn btn--primary" onClick={() => void copyPairingCode()}>
                        <Copy size={17} strokeWidth={1.9} aria-hidden />
                        Copiar código
                      </button>
                      <a
                        href={webPlayerPairingUrl(pairing.code)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn--secondary"
                      >
                        <ExternalLink size={17} strokeWidth={1.9} aria-hidden />
                        Abrir player
                      </a>
                    </div>
                    {copyMsg && (
                      <p className="text-muted" style={{ margin: 'var(--space-3) 0 0', fontSize: 'var(--text-sm)' }}>
                        {copyMsg}
                      </p>
                    )}
                  </>
                ) : (
                  <p className="text-muted" style={{ margin: 0 }}>
                    Sem código ativo. Gere um novo código para emparelhar ou reconfigurar o terminal.
                  </p>
                )}
                <button
                  type="button"
                  onClick={regenerate}
                  disabled={loadingPair}
                  className="btn btn--ghost"
                  style={{ marginTop: 'var(--space-4)' }}
                >
                  {loadingPair ? 'A gerar…' : 'Gerar código de pareamento'}
                </button>
              </section>
            )}

            <p style={{ marginBottom: 'var(--space-4)' }}>
              <ConnectionPill state={payload.online ? 'on' : 'off'} />
              <span className="text-muted" style={{ marginLeft: 'var(--space-3)' }}>
                (último heartbeat nos últimos 5 min)
              </span>
            </p>

            <dl className="dl-grid">
              <dt>Nome</dt>
              <dd>{device.name}</dd>
              <dt>ID</dt>
              <dd>
                <code>{device.id}</code>
              </dd>
              <dt>Site</dt>
              <dd>{device.siteName ?? device.siteId}</dd>
              <dt>Plataforma</dt>
              <dd>{platformLabel(device.platform)}</dd>
              <dt>Estado cadastral</dt>
              <dd>
                <StatusPill
                  label={deviceState(device.status).label}
                  tone={deviceState(device.status).tone}
                />
              </dd>
              {device.serialNumber && (
                <>
                  <dt>Número de série</dt>
                  <dd>{device.serialNumber}</dd>
                </>
              )}
              {device.runtimeVersion != null && device.runtimeVersion !== '' && (
                <>
                  <dt>Versão runtime</dt>
                  <dd>{device.runtimeVersion}</dd>
                </>
              )}
              <dt>Último heartbeat</dt>
              <dd>
                {formatDateTimePtBr(device.lastSeenAt)}
              </dd>
            </dl>

            <section style={{ marginTop: 'var(--space-8)' }}>
              <h2 style={{ fontSize: 'var(--text-md)', fontWeight: 600, margin: '0 0 var(--space-3)' }}>
                Estado operacional
              </h2>
              {payload.lastHeartbeat && (
                <dl className="dl-grid" style={{ marginBottom: 'var(--space-4)' }}>
                  <dt>Último heartbeat (registro)</dt>
                  <dd>
                    {formatDateTimePtBr(payload.lastHeartbeat.receivedAt)}
                    {payload.lastHeartbeat.appVersion != null && (
                      <span className="text-muted"> — app {payload.lastHeartbeat.appVersion}</span>
                    )}
                  </dd>
                </dl>
              )}
              {payload.state && (
                <dl className="dl-grid">
                  {payload.state.expectedPublicationVersion != null && (
                    <>
                      <dt>Sincronização de publicação</dt>
                      <dd>
                        <PublicationSyncBadge
                          synced={payload.state.publicationSynced}
                          expectedVersion={payload.state.expectedPublicationVersion}
                          appliedVersion={payload.state.appliedPublicationVersion}
                        />
                      </dd>
                    </>
                  )}
                  {payload.state.appliedContentRevision && (
                    <>
                      <dt>Revisão de conteúdo (ack)</dt>
                      <dd>
                        <code style={{ fontSize: 12 }}>
                          {payload.state.appliedContentRevision}
                        </code>
                        {payload.state.appliedAt && (
                          <span className="text-muted">
                            {' '}
                            — {formatDateTimePtBr(payload.state.appliedAt)}
                          </span>
                        )}
                      </dd>
                    </>
                  )}
                  {payload.state.currentItemJson != null && (
                    <>
                      <dt>Conteúdo ativo</dt>
                      <dd>
                        <code style={{ fontSize: 12 }}>
                          {JSON.stringify(payload.state.currentItemJson)}
                        </code>
                      </dd>
                    </>
                  )}
                  {payload.state.lastSyncAt && (
                    <>
                      <dt>Última sincronização</dt>
                      <dd>{formatDateTimePtBr(payload.state.lastSyncAt)}</dd>
                    </>
                  )}
                  {payload.state.previewSnapshotAt && (
                    <>
                      <dt>Última pré-visualização (CMS)</dt>
                      <dd>{formatDateTimePtBr(payload.state.previewSnapshotAt)}</dd>
                    </>
                  )}
                  {payload.state.storageFreeMb != null && (
                    <>
                      <dt>Armazenamento livre</dt>
                      <dd>{payload.state.storageFreeMb} MB</dd>
                    </>
                  )}
                  {payload.state.cpuPercent != null && (
                    <>
                      <dt>CPU</dt>
                      <dd>{payload.state.cpuPercent}%</dd>
                    </>
                  )}
                  {payload.state.memoryPercent != null && (
                    <>
                      <dt>Memória</dt>
                      <dd>{payload.state.memoryPercent}%</dd>
                    </>
                  )}
                  {payload.state.networkStatus && (
                    <>
                      <dt>Rede</dt>
                      <dd>{payload.state.networkStatus}</dd>
                    </>
                  )}
                </dl>
              )}
              {!payload.lastHeartbeat &&
                (!payload.state ||
                  (!payload.state.lastSyncAt &&
                    payload.state.storageFreeMb == null &&
                    !payload.state.cpuPercent &&
                    !payload.state.memoryPercent &&
                    !payload.state.networkStatus)) && (
                <p className="text-muted">Sem telemetria detalhada ainda (após pairing e heartbeats).</p>
              )}
            </section>
              </>
            )}

            {deviceTab === 'ecra' && (
              <>
            <section
              className="surface-form-card"
              style={{ marginTop: 'var(--space-2)', maxWidth: 560 }}
            >
              <h2 style={{ fontSize: 'var(--text-md)', fontWeight: 600, margin: '0 0 var(--space-2)' }}>
                Ecrã (viewport)
              </h2>
              <p className="text-muted" style={{ marginTop: 0, marginBottom: 'var(--space-4)' }}>
                Resolução lógica e orientação aplicadas pelo player. Base para layouts multi-zona.
              </p>
              <label className="field">
                <span>Predefinição</span>
                <select
                  className="select"
                  value={vpPreset}
                  onChange={(e) => {
                    const id = e.target.value;
                    setVpPreset(id);
                    const preset = VIEWPORT_PRESETS.find((p) => p.id === id);
                    if (preset) {
                      setVpWidth(preset.width);
                      setVpHeight(preset.height);
                      setVpOrientation(preset.orientation);
                    }
                  }}
                >
                  <option value="custom">Personalizado</option>
                  {VIEWPORT_PRESETS.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </label>
              <div style={{ display: 'flex', gap: 'var(--space-4)', flexWrap: 'wrap' }}>
                <label className="field" style={{ flex: '1 1 140px' }}>
                  <span>Largura (px)</span>
                  <input
                    type="number"
                    className="input"
                    min={320}
                    max={7680}
                    value={vpWidth}
                    onChange={(e) => {
                      setVpPreset('custom');
                      setVpWidth(Number(e.target.value));
                    }}
                  />
                </label>
                <label className="field" style={{ flex: '1 1 140px' }}>
                  <span>Altura (px)</span>
                  <input
                    type="number"
                    className="input"
                    min={320}
                    max={7680}
                    value={vpHeight}
                    onChange={(e) => {
                      setVpPreset('custom');
                      setVpHeight(Number(e.target.value));
                    }}
                  />
                </label>
              </div>
              <label className="field">
                <span>Orientação</span>
                <select
                  className="select"
                  value={vpOrientation}
                  onChange={(e) => {
                    setVpPreset('custom');
                    setVpOrientation(e.target.value);
                  }}
                >
                  {DISPLAY_ORIENTATIONS.map((o) => (
                    <option key={o} value={o}>
                      {displayOrientationLabel(o)}
                    </option>
                  ))}
                </select>
              </label>
              <div
                className="surface-card"
                style={{
                  padding: 'var(--space-4)',
                  marginBottom: 'var(--space-4)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  minHeight: 120,
                  background: 'var(--color-surface-muted)',
                }}
              >
                <div
                  style={{
                    width: Math.min(160, (vpWidth / vpHeight) * 90),
                    height: Math.min(90, (vpHeight / vpWidth) * 160),
                    maxWidth: '100%',
                    border: '2px solid var(--color-primary-500, #2563eb)',
                    borderRadius: 4,
                    transform:
                      vpOrientation === 'portrait' || vpOrientation === 'portrait_flipped'
                        ? 'rotate(90deg)'
                        : undefined,
                  }}
                  title={`${vpWidth}×${vpHeight}`}
                />
              </div>
              <button
                type="button"
                className="btn btn--primary"
                disabled={savingViewport}
                onClick={() => void saveViewport()}
              >
                {savingViewport ? 'A guardar…' : 'Guardar ecrã'}
              </button>
            </section>

            <section
              className="surface-form-card"
              style={{ marginTop: 'var(--space-8)', maxWidth: 640 }}
            >
              <h2 style={{ fontSize: 'var(--text-md)', fontWeight: 600, margin: '0 0 var(--space-2)' }}>
                Layout multi-zona
              </h2>
              <p className="text-muted" style={{ marginTop: 0, marginBottom: 'var(--space-4)' }}>
                Configure templates, playlists por zona e modo de exibição no editor visual.
              </p>
              {deviceLayout?.template ? (
                <div
                  className="layout-editor__canvas-wrap"
                  style={{ aspectRatio: '16/9', maxWidth: 360, marginBottom: 'var(--space-4)' }}
                >
                  <div className="layout-editor__canvas">
                    {sortZonesForCanvas(deviceLayout.template.zonesJson).map((z, i) => (
                      <div
                        key={z.zoneId}
                        className="layout-editor__zone has-content"
                        style={{
                          ...layoutZoneStyle(z.frame),
                          ['--zone-color' as string]: zoneColor(i),
                          pointerEvents: 'none',
                        }}
                      >
                        <span className="layout-editor__zone-label">{z.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
              {deviceLayout ? (
                <p className="text-muted" style={{ marginTop: 0, marginBottom: 'var(--space-4)' }}>
                  Ativo: <code>{deviceLayout.template.slug}</code> (rev. {deviceLayout.revision})
                </p>
              ) : (
                <p className="text-muted" style={{ marginTop: 0, marginBottom: 'var(--space-4)' }}>
                  Nenhum layout guardado neste dispositivo.
                </p>
              )}
              <Link href={`/devices/${id}/layout`} className="btn btn--primary">
                <LayoutGrid strokeWidth={2} aria-hidden />
                Abrir editor visual de zonas
              </Link>
            </section>
              </>
            )}

            {deviceTab === 'cadastro' && (
            <section
              className="surface-form-card"
              style={{ marginTop: 'var(--space-2)', maxWidth: 520 }}
            >
              <h2 style={{ fontSize: 'var(--text-md)', fontWeight: 600, margin: '0 0 var(--space-4)' }}>
                Editar cadastro
              </h2>
              <p className="text-muted" style={{ marginTop: 0, marginBottom: 'var(--space-4)' }}>
                Nome, site, plataforma e estado cadastral. Para emparelhar o player, use a aba{' '}
                <strong>Resumo</strong>.
              </p>
              <label className="field">
                <span>Nome</span>
                <input
                  className="input"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  autoComplete="off"
                />
              </label>
              <label className="field">
                <span>Site</span>
                <select
                  className="select"
                  value={editSiteId}
                  onChange={(e) => setEditSiteId(e.target.value)}
                  disabled={sites.length === 0}
                >
                  {sites.length === 0 ? (
                    <option value={editSiteId}>{device.siteName ?? editSiteId}</option>
                  ) : (
                    sites.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))
                  )}
                </select>
              </label>
              <label className="field">
                <span>Plataforma</span>
                <select
                  className="select"
                  value={editPlatform}
                  onChange={(e) => setEditPlatform(e.target.value)}
                >
                  {PLATFORM_OPTIONS.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                  <option value="unknown">{platformLabel('unknown')}</option>
                </select>
              </label>
              <label className="field">
                <span>Estado cadastral</span>
                <select
                  className="select"
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value)}
                >
                  <option value="provisioned">
                    {deviceState('provisioned').label} (aguarda pareamento)
                  </option>
                  <option value="active">{deviceState('active').label}</option>
                  <option value="disabled">{deviceState('disabled').label}</option>
                </select>
              </label>
              <label className="field">
                <span>MAC (Wake-on-LAN)</span>
                <input
                  className="input"
                  value={editWakeMac}
                  onChange={(e) => setEditWakeMac(e.target.value)}
                  placeholder="aa:bb:cc:dd:ee:ff"
                  autoComplete="off"
                  spellCheck={false}
                />
                <span className="text-muted" style={{ fontSize: 12, marginTop: 4, display: 'block' }}>
                  Opcional. Comando <code>wol</code> na monitorização usa este MAC se o payload não
                  indicar outro. O servidor API deve estar na mesma LAN que o ecrã.
                </span>
              </label>
              <button
                type="button"
                className="btn btn--primary"
                disabled={savingEdit}
                onClick={() => void saveCadastro()}
              >
                {savingEdit ? 'A guardar…' : 'Guardar alterações'}
              </button>
            </section>
            )}

            {deviceTab === 'conteudo' && (
              <>
            <section style={{ marginTop: 'var(--space-2)' }}>
              <h2 style={{ fontSize: 'var(--text-md)', fontWeight: 600, margin: '0 0 var(--space-3)' }}>
                Conteúdo de teste (player)
              </h2>
              <p className="text-muted">
                Escolha asset ou playlist (em{' '}
                <Link href="/assets" className="text-muted" style={{ textDecoration: 'underline' }}>
                  Assets
                </Link>{' '}
                e{' '}
                <Link href="/playlists" className="text-muted" style={{ textDecoration: 'underline' }}>
                  Playlists
                </Link>
                ). <strong>Aplicar teste</strong> envia o conteúdo ao player sem gravar versão oficial (limpa a
                referência de publicação ativa). <strong>Publicar versão</strong> regista um snapshot
                versionado e define a publicação ativa — o player continua a usar o mesmo mecanismo de
                sincronização.
              </p>
              <div style={{ marginBottom: 'var(--space-4)' }} className="field">
                <span>Tipo de conteúdo</span>
                <div style={{ display: 'flex', gap: 'var(--space-4)', marginTop: 8 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                    <input
                      type="radio"
                      name="contentMode"
                      checked={contentMode === 'asset'}
                      onChange={() => setContentMode('asset')}
                    />
                    Imagem única (asset)
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                    <input
                      type="radio"
                      name="contentMode"
                      checked={contentMode === 'playlist'}
                      onChange={() => setContentMode('playlist')}
                    />
                    Playlist
                  </label>
                </div>
              </div>
              <div
                className="surface-form-card"
                style={{ marginBottom: 'var(--space-4)', maxWidth: 480, padding: 'var(--space-4)' }}
              >
                <label className="field">
                  <span>Modo de exibição (fit)</span>
                  <select
                    className="select"
                    value={contentFit}
                    onChange={(e) => setContentFit(e.target.value as ContentFitMode)}
                  >
                    {CONTENT_FIT_MODES.map((f) => (
                      <option key={f} value={f}>
                        {contentFitLabelPt(f)}
                      </option>
                    ))}
                  </select>
                </label>
                <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
                  <label className="field" style={{ flex: '1 1 140px' }}>
                    <span>Largura alvo (px)</span>
                    <input
                      type="number"
                      className="input"
                      min={1}
                      max={7680}
                      placeholder="Opcional"
                      value={contentTargetW}
                      onChange={(e) => setContentTargetW(e.target.value)}
                    />
                  </label>
                  <label className="field" style={{ flex: '1 1 140px' }}>
                    <span>Altura alvo (px)</span>
                    <input
                      type="number"
                      className="input"
                      min={1}
                      max={7680}
                      placeholder="Opcional"
                      value={contentTargetH}
                      onChange={(e) => setContentTargetH(e.target.value)}
                    />
                  </label>
                </div>
              </div>
              {contentMode === 'asset' && assets.length === 0 && (
                <p className="text-muted">
                  Nenhum asset. Crie conteúdos em Assets (imagem, vídeo, PDF, HTML ou URL).
                </p>
              )}
              {contentMode === 'asset' && assets.length > 0 && (
                <>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)', alignItems: 'center' }}>
                    <select
                      value={selectedAssetId}
                      onChange={(e) => setSelectedAssetId(e.target.value)}
                      style={{ minWidth: 220 }}
                    >
                      <option value="">Selecione um asset…</option>
                      {assets.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className="btn btn--ghost"
                      disabled={!selectedAssetId || assigning || publishing}
                      onClick={() => void assignTestContent()}
                    >
                      {assigning ? 'Aplicando…' : 'Aplicar teste'}
                    </button>
                    <button
                      type="button"
                      className="btn btn--ghost"
                      disabled={!selectedAssetId || assigning || publishing}
                      onClick={() => void publishContent()}
                    >
                      {publishing ? 'Publicando…' : 'Publicar versão'}
                    </button>
                  </div>
                  <div className="field" style={{ marginTop: 'var(--space-3)', maxWidth: 400 }}>
                    <label htmlFor="pub-label-asset">Rótulo opcional (publicação)</label>
                    <input
                      id="pub-label-asset"
                      type="text"
                      value={publishLabel}
                      onChange={(e) => setPublishLabel(e.target.value)}
                      placeholder="Ex.: Campanha verão"
                      autoComplete="off"
                    />
                  </div>
                </>
              )}
              {contentMode === 'playlist' && playlists.length === 0 && (
                <p className="text-muted">Nenhuma playlist. Crie uma em Playlists primeiro.</p>
              )}
              {contentMode === 'playlist' && playlists.length > 0 && (
                <>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)', alignItems: 'center' }}>
                    <select
                      value={selectedPlaylistId}
                      onChange={(e) => setSelectedPlaylistId(e.target.value)}
                      style={{ minWidth: 220 }}
                    >
                      <option value="">Selecione uma playlist…</option>
                      {playlists.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                          {p.itemCount != null
                            ? ` (${p.itemCount} ${p.itemCount === 1 ? 'item' : 'itens'})`
                            : ''}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className="btn btn--ghost"
                      disabled={!selectedPlaylistId || assigning || publishing}
                      onClick={() => void assignTestContent()}
                    >
                      {assigning ? 'Aplicando…' : 'Aplicar teste'}
                    </button>
                    <button
                      type="button"
                      className="btn btn--ghost"
                      disabled={!selectedPlaylistId || assigning || publishing}
                      onClick={() => void publishContent()}
                    >
                      {publishing ? 'Publicando…' : 'Publicar versão'}
                    </button>
                  </div>
                  <div className="field" style={{ marginTop: 'var(--space-3)', maxWidth: 400 }}>
                    <label htmlFor="pub-label-pl">Rótulo opcional (publicação)</label>
                    <input
                      id="pub-label-pl"
                      type="text"
                      value={publishLabel}
                      onChange={(e) => setPublishLabel(e.target.value)}
                      placeholder="Ex.: Loop matriz"
                      autoComplete="off"
                    />
                  </div>
                </>
              )}
            </section>

            <section style={{ marginTop: 'var(--space-8)' }}>
              <h2 style={{ fontSize: 'var(--text-md)', fontWeight: 600, margin: '0 0 var(--space-3)' }}>
                Publicações (histórico)
              </h2>
              <p className="text-muted">
                Versões gravadas neste dispositivo. A linha com o mesmo ID que &quot;Conteúdo (teste)&quot; em
                estado operacional (quando existir) é a publicação ativa.
              </p>
              {publications.length === 0 ? (
                <p className="text-muted">Ainda não há publicações. Use &quot;Publicar versão&quot; acima.</p>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Versão</th>
                        <th>Data</th>
                        <th>Rótulo</th>
                        <th>Payload</th>
                      </tr>
                    </thead>
                    <tbody>
                      {publications.map((p) => (
                        <tr key={p.id}>
                          <td>
                            <code>{p.version}</code>
                            {payload.state?.currentPublicationId === p.id ? (
                              <span className="text-muted" style={{ marginLeft: 8 }}>
                                (ativa)
                              </span>
                            ) : null}
                          </td>
                          <td>{formatDateTimePtBr(p.createdAt)}</td>
                          <td>{p.label ?? '—'}</td>
                          <td>
                            <code style={{ fontSize: 11 }}>
                              {JSON.stringify(p.payloadJson)}
                            </code>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
              </>
            )}

          </>
        )}
      </section>

      <ConfirmDialog
        open={confirmRemove}
        title="Eliminar dispositivo"
        message={
          device
            ? `Eliminar «${device.name}»? Esta ação não pode ser desfeita.`
            : ''
        }
        confirmLabel="Eliminar"
        loading={removing}
        onConfirm={() => void removeDeviceConfirmed()}
        onCancel={() => setConfirmRemove(false)}
      />
    </>
  );
}

export default function DeviceDetailPage() {
  const params = useParams();
  const id = params.id as string;

  return (
    <Suspense fallback={<p className="text-muted">A carregar…</p>}>
      <DeviceDetailInner id={id} />
    </Suspense>
  );
}
