'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { API_BASE, api, fetchApi, getToken } from '@/lib/api';
import { formatDateTimePtBr } from '@/lib/format-date';

type BorderStatus = 'online' | 'fault' | 'offline_long';

type PlaybackInfo = {
  playlistId: string | null;
  playlistName: string | null;
  assetId: string | null;
  assetName: string | null;
  itemIndex: number | null;
};

type OverviewRow = {
  deviceId: string;
  name: string;
  platform: string;
  status: string;
  lastSeenAt: string | null;
  site: { id: string; name: string };
  telemetryUpdatedAt: string | null;
  telemetrySnapshot: Record<string, unknown> | null;
  networkStatus: string | null;
  currentItem: unknown;
  borderStatus: BorderStatus;
  playback: PlaybackInfo;
  previewSnapshotAt: string | null;
  hasPreview: boolean;
};

/** Intervalo para voltar a pedir o JPEG (independente do overview a cada 30 s). */
const PREVIEW_POLL_MS = 3500;

const BORDER: Record<
  BorderStatus,
  { color: string; label: string; hint: string }
> = {
  online: {
    color: '#22c55e',
    label: 'Online',
    hint: 'Contacto recente (≤ 5 min) e sem falhas reportadas na telemetria.',
  },
  fault: {
    color: '#ef4444',
    label: 'Falha / degradado',
    hint:
      'Sem contacto há mais de 5 min (e menos de 24 h), ou telemetria indica erro de rede/playback.',
  },
  offline_long: {
    color: '#94a3b8',
    label: 'Desligado > 24 h',
    hint: 'Sem heartbeat há mais de 24 horas (ou nunca contactou).',
  },
};

function MonitoringPreviewImage({
  deviceId,
  enabled,
}: {
  deviceId: string;
  enabled: boolean;
}) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) {
      setSrc((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
      return;
    }

    let cancelled = false;

    async function fetchPreviewFrame() {
      const token = getToken();
      if (!token || cancelled) return;
      try {
        const res = await fetchApi(
          `${API_BASE}/monitoring/devices/${deviceId}/preview?t=${Date.now()}`,
          {
            headers: { Authorization: `Bearer ${token}` },
            cache: 'no-store',
          }
        );
        if (!res.ok || cancelled) return;
        const blob = await res.blob();
        if (cancelled) return;
        const url = URL.createObjectURL(blob);
        setSrc((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return url;
        });
      } catch {
        /* falhas transitórias: manter último frame se existir */
      }
    }

    void fetchPreviewFrame();
    const id = window.setInterval(() => void fetchPreviewFrame(), PREVIEW_POLL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(id);
      setSrc((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
    };
  }, [deviceId, enabled]);

  if (!src) {
    return (
      <span
        style={{
          fontSize: 11,
          color: 'rgba(248, 250, 252, 0.55)',
          textAlign: 'center',
          padding: '0 0.5rem',
        }}
      >
        A carregar pré-visualização…
      </span>
    );
  }

  return (
    <img
      src={src}
      alt=""
      style={{
        width: '100%',
        height: '100%',
        objectFit: 'contain',
        display: 'block',
        background: '#020617',
      }}
    />
  );
}

function MonitoringScreen({
  borderStatus,
  deviceName,
  previewSnapshotAt,
  hasPreview,
  deviceId,
}: {
  borderStatus: BorderStatus;
  deviceName: string;
  previewSnapshotAt: string | null;
  hasPreview: boolean;
  deviceId: string;
}) {
  const b = BORDER[borderStatus];
  const showThumb = Boolean(hasPreview && previewSnapshotAt);
  return (
    <div
      style={{
        width: '100%',
        maxWidth: 340,
        borderRadius: 12,
        border: `4px solid ${b.color}`,
        boxShadow: '0 8px 24px rgba(15, 23, 42, 0.12)',
        overflow: 'hidden',
        background: 'linear-gradient(180deg, #0f172a 0%, #020617 100%)',
        flexShrink: 0,
      }}
      aria-label={`Ecrã de monitorização — ${b.label}`}
    >
      <div
        style={{
          aspectRatio: '16 / 9',
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          padding: showThumb ? 0 : '1rem',
        }}
      >
        {showThumb ? (
          <MonitoringPreviewImage deviceId={deviceId} enabled />
        ) : (
          <>
            <i
              className="fa-solid fa-tv"
              style={{ fontSize: 'clamp(2rem, 6vw, 3rem)', color: 'rgba(248, 250, 252, 0.35)' }}
              aria-hidden
            />
            <span
              style={{
                fontSize: 11,
                color: 'rgba(248, 250, 252, 0.55)',
                textAlign: 'center',
                lineHeight: 1.4,
                maxWidth: 260,
              }}
            >
              Sem pré-visualização ainda (player web envia ~1 JPEG/s quando mostra imagem ou vídeo).
              <br />
              <span style={{ opacity: 0.85 }}>{deviceName}</span>
            </span>
          </>
        )}
        <span
          style={{
            position: 'absolute',
            top: 8,
            right: 8,
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            color: '#fff',
            background: b.color,
            padding: '3px 8px',
            borderRadius: 6,
          }}
        >
          {b.label}
        </span>
      </div>
    </div>
  );
}

function PlaybackFields({ playback }: { playback: PlaybackInfo }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
        gap: '0.65rem',
        marginTop: '0.5rem',
      }}
    >
      <div
        style={{
          padding: '0.5rem 0.65rem',
          borderRadius: 8,
          border: '1px solid var(--color-border, #e2e8f0)',
          background: 'var(--color-surface-muted, #f8fafc)',
        }}
      >
        <div className="text-muted" style={{ fontSize: 11, marginBottom: 4 }}>
          Playlist em reprodução
        </div>
        <div style={{ fontSize: 13, fontWeight: 600, wordBreak: 'break-word' }}>
          {playback.playlistName ?? (playback.playlistId ? `ID: ${playback.playlistId}` : '—')}
        </div>
        {playback.playlistId && (
          <Link
            href={`/playlists/${playback.playlistId}`}
            style={{ fontSize: 12, marginTop: 4, display: 'inline-block' }}
          >
            Abrir playlist
          </Link>
        )}
      </div>
      <div
        style={{
          padding: '0.5rem 0.65rem',
          borderRadius: 8,
          border: '1px solid var(--color-border, #e2e8f0)',
          background: 'var(--color-surface-muted, #f8fafc)',
        }}
      >
        <div className="text-muted" style={{ fontSize: 11, marginBottom: 4 }}>
          Asset / slide atual
        </div>
        <div style={{ fontSize: 13, fontWeight: 600, wordBreak: 'break-word' }}>
          {playback.assetName ?? (playback.assetId ? `ID: ${playback.assetId}` : '—')}
        </div>
        {playback.itemIndex != null && (
          <div className="text-muted" style={{ fontSize: 12, marginTop: 4 }}>
            Índice do item: {playback.itemIndex + 1}
          </div>
        )}
        {playback.assetId && (
          <Link href="/assets" style={{ fontSize: 12, marginTop: 4, display: 'inline-block' }}>
            Abrir biblioteca de assets
          </Link>
        )}
      </div>
    </div>
  );
}

export default function MonitoringPage() {
  const router = useRouter();
  const [rows, setRows] = useState<OverviewRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const data = await api<OverviewRow[]>('/monitoring/overview');
    setRows(data);
  }, []);

  useEffect(() => {
    if (!getToken()) {
      router.replace('/login');
      return;
    }
    let cancelled = false;
    async function run() {
      try {
        setError(null);
        await load();
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Erro');
      }
    }
    void run();
    const id = window.setInterval(() => void run(), 30_000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [router, load]);

  return (
    <>
      <header className="page-header">
        <div>
          <h1>Monitorização</h1>
          <p className="page-header__lead">
            Pré-visualização JPEG do player atualiza a cada ~{Math.round(PREVIEW_POLL_MS / 1000)} s; dados
            de telemetria na grelha a cada 30 s.
          </p>
        </div>
      </header>

      <section
        className="surface-card"
        style={{
          padding: '0.85rem 1.1rem',
          marginBottom: 'var(--space-6)',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '1rem',
          alignItems: 'center',
        }}
      >
        <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>Legenda:</span>
        {(Object.keys(BORDER) as BorderStatus[]).map((k) => (
          <span
            key={k}
            title={BORDER[k].hint}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              fontSize: '0.8125rem',
            }}
          >
            <span
              aria-hidden
              style={{
                width: 14,
                height: 14,
                borderRadius: 4,
                background: BORDER[k].color,
              }}
            />
            {BORDER[k].label}
          </span>
        ))}
      </section>

      {error && <p className="text-danger">{error}</p>}
      {!rows && !error && <p className="text-muted">Carregando…</p>}
      {rows && rows.length === 0 && (
        <p className="text-muted">Sem devices. Adicione devices e pareamento para ver telemetria.</p>
      )}
      {rows && rows.length > 0 && (
        <div
          className="monitoring-theme-dark"
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-6)',
          }}
        >
          {rows.map((r) => (
            <article
              key={r.deviceId}
              className="surface-card"
              style={{
                padding: '1.15rem 1.25rem',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '1.25rem',
                  alignItems: 'flex-start',
                }}
              >
                <MonitoringScreen
                  borderStatus={r.borderStatus}
                  deviceName={r.name}
                  deviceId={r.deviceId}
                  hasPreview={r.hasPreview}
                  previewSnapshotAt={r.previewSnapshotAt}
                />
                <div style={{ flex: '1 1 280px', minWidth: 0 }}>
                  <div
                    style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      alignItems: 'baseline',
                      justifyContent: 'space-between',
                      gap: '0.5rem',
                    }}
                  >
                    <h2 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 700 }}>
                      {r.name}
                    </h2>
                    <Link
                      href={`/devices/${r.deviceId}`}
                      className="btn btn--ghost"
                      style={{ fontSize: '0.8125rem' }}
                    >
                      Ficheiro do device
                    </Link>
                  </div>
                  <p className="text-muted" style={{ margin: '0.35rem 0 0', fontSize: '0.8125rem' }}>
                    {r.site?.name ?? '—'} · {r.platform} · estado CMS: <code>{r.status}</code>
                  </p>
                  <dl
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'auto 1fr',
                      gap: '0.25rem 1rem',
                      fontSize: '0.8125rem',
                      marginTop: '0.65rem',
                    }}
                  >
                    <dt className="text-muted">Última vista</dt>
                    <dd style={{ margin: 0 }}>
                      {r.lastSeenAt ? formatDateTimePtBr(r.lastSeenAt) : '—'}
                    </dd>
                    <dt className="text-muted">Telemetria</dt>
                    <dd style={{ margin: 0 }}>
                      {r.telemetryUpdatedAt
                        ? formatDateTimePtBr(r.telemetryUpdatedAt)
                        : '—'}
                    </dd>
                    <dt className="text-muted">Rede (estado)</dt>
                    <dd style={{ margin: 0 }}>{r.networkStatus ?? '—'}</dd>
                    <dt className="text-muted">Última pré-visualização</dt>
                    <dd style={{ margin: 0 }}>
                      {r.previewSnapshotAt
                        ? formatDateTimePtBr(r.previewSnapshotAt)
                        : '—'}
                    </dd>
                  </dl>
                  <h3
                    style={{
                      fontSize: '0.8125rem',
                      fontWeight: 600,
                      margin: '1rem 0 0.35rem',
                      color: 'var(--color-text-muted, #64748b)',
                    }}
                  >
                    Conteúdo em reprodução (CMS + telemetria)
                  </h3>
                  <PlaybackFields playback={r.playback} />
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </>
  );
}
