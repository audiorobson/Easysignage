import {
  type FormEvent,
  type KeyboardEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import {
  clearDeviceAssetCache,
  evictDeviceAssetCacheExcept,
  fetchDeviceAssetCached,
} from './deviceAssetCache';

const API =
  import.meta.env.VITE_API_URL?.replace(/\/$/, '') ?? 'http://localhost:3001/api/v1';

const HEARTBEAT_INTERVAL_SEC = 60;
/** JPEG para pré-visualização no CMS (sem WebRTC). */
const PREVIEW_INTERVAL_SEC = 1;
const STATE_POLL_SEC = 3;
const APP_VERSION = '0.0.1';
const CONFIG_HIDE_MS = 10_000;

type CurrentItem = {
  type?: string;
  assetId?: string;
  playlistId?: string;
  kind?: string;
} | null;

type ManifestItem = {
  itemId: string;
  position: number;
  durationSec: number | null;
  assetId: string;
  mimeType: string;
  kind: string;
  remoteUrl?: string | null;
  /** Tamanho do ficheiro em bytes (string decimal). */
  fileSize?: string;
};

type PlaylistManifest = {
  playlistId: string;
  name: string;
  /** Revisão do manifesto (playlist + itens); muda quando a playlist é editada. */
  manifestRevision?: string;
  items: ManifestItem[];
};

type MediaKind = 'image' | 'video' | 'pdf' | 'html' | 'url';

function buildMetrics(): Record<string, unknown> | undefined {
  try {
    const m = (performance as { memory?: { usedJSHeapSize: number } }).memory;
    if (m) return { memoryUsedJs: m.usedJSHeapSize };
  } catch {
    /* ignore */
  }
  return undefined;
}

function isPlayableKind(kind: string): boolean {
  return ['image', 'video', 'pdf', 'html', 'url'].includes(kind);
}

function drawStageToJpegBlob(
  mediaKind: MediaKind | null,
  img: HTMLImageElement | null,
  video: HTMLVideoElement | null,
  quality: number
): Promise<Blob | null> {
  return new Promise((resolve) => {
    if (mediaKind !== 'image' && mediaKind !== 'video') {
      resolve(null);
      return;
    }
    const maxW = 1280;
    const maxH = 720;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      resolve(null);
      return;
    }
    if (mediaKind === 'image' && img?.naturalWidth) {
      let w = img.naturalWidth;
      let h = img.naturalHeight;
      const scale = Math.min(maxW / w, maxH / h, 1);
      w = Math.floor(w * scale);
      h = Math.floor(h * scale);
      canvas.width = w;
      canvas.height = h;
      ctx.drawImage(img, 0, 0, w, h);
    } else if (mediaKind === 'video' && video?.videoWidth) {
      let w = video.videoWidth;
      let h = video.videoHeight;
      const scale = Math.min(maxW / w, maxH / h, 1);
      w = Math.floor(w * scale);
      h = Math.floor(h * scale);
      canvas.width = w;
      canvas.height = h;
      ctx.drawImage(video, 0, 0, w, h);
    } else {
      resolve(null);
      return;
    }
    canvas.toBlob((b) => resolve(b), 'image/jpeg', quality);
  });
}

function defaultDurationSec(kind: string): number {
  switch (kind) {
    case 'image':
      return 10;
    case 'video':
      return 30;
    case 'pdf':
      return 45;
    case 'html':
      return 60;
    case 'url':
      return 30;
    default:
      return 15;
  }
}

function deviceAssetFileUrl(assetId: string): string {
  return `${API}/device/assets/${assetId}/file`;
}

export function App() {
  const [pairingCode, setPairingCode] = useState('');
  const [platform, setPlatform] = useState('web');
  const [name, setName] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [deviceToken, setDeviceToken] = useState<string | null>(() =>
    localStorage.getItem('device_token')
  );
  const [heartbeatStatus, setHeartbeatStatus] = useState<string | null>(null);
  const [contentHint, setContentHint] = useState<string | null>(null);
  const blobUrlRef = useRef<string | null>(null);

  const [currentItem, setCurrentItem] = useState<CurrentItem>(null);
  /** Quando o estado no servidor muda (sync, playlist, publicação), força novo fetch do manifest. */
  const [contentRevision, setContentRevision] = useState<string | null>(null);
  const [serverPublicationVersion, setServerPublicationVersion] = useState<
    number | null
  >(null);
  const lastContentRevisionRef = useRef<string | null>(null);
  /** Ack enviado no heartbeat após carregar o conteúdo atual. */
  const appliedAckRef = useRef<{
    publicationVersion: number | null;
    contentRevision: string | null;
  }>({ publicationVersion: null, contentRevision: null });
  const [playlistManifest, setPlaylistManifest] = useState<PlaylistManifest | null>(null);
  const [slideIndex, setSlideIndex] = useState(0);

  const [mediaKind, setMediaKind] = useState<MediaKind | null>(null);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [frameUrl, setFrameUrl] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  const [configOpen, setConfigOpen] = useState(() => !localStorage.getItem('device_token'));
  const topUiRef = useRef<HTMLDivElement>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const revokeBlob = useCallback(() => {
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }
    setBlobUrl(null);
    setFrameUrl(null);
    setMediaKind(null);
  }, []);

  const clearHideTimer = useCallback(() => {
    if (hideTimerRef.current != null) {
      window.clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  }, []);

  const scheduleHideConfig = useCallback(() => {
    clearHideTimer();
    const hasToken = deviceToken ?? localStorage.getItem('device_token');
    if (!hasToken) return;
    hideTimerRef.current = window.setTimeout(() => {
      setConfigOpen(false);
      hideTimerRef.current = null;
    }, CONFIG_HIDE_MS);
  }, [deviceToken, clearHideTimer]);

  const openConfigPanel = useCallback(() => {
    setConfigOpen(true);
    scheduleHideConfig();
  }, [scheduleHideConfig]);

  const onTopUiMouseMove = useCallback(() => {
    if (deviceToken && configOpen) scheduleHideConfig();
  }, [deviceToken, configOpen, scheduleHideConfig]);

  const onTopUiMouseLeave = useCallback(() => {
    if (deviceToken && configOpen) scheduleHideConfig();
  }, [deviceToken, configOpen, scheduleHideConfig]);

  const onTopUiKeyDown = useCallback(
    (_e: KeyboardEvent) => {
      if (deviceToken && configOpen) scheduleHideConfig();
    },
    [deviceToken, configOpen, scheduleHideConfig]
  );

  useEffect(() => {
    if (!deviceToken) {
      setConfigOpen(true);
      clearHideTimer();
    }
  }, [deviceToken, clearHideTimer]);

  /**
   * Reagendar auto-ocultar quando o painel está visível com token.
   * Em Strict Mode o primeiro mount desmonta e o cleanup apagava o timeout sem o repor —
   * o painel ficava aberto indefinidamente. `scheduleHideConfig` nos eventos continua a
   * repor o temporizador quando o utilizador interage.
   */
  useEffect(() => {
    if (!deviceToken || !configOpen) {
      clearHideTimer();
      return;
    }
    scheduleHideConfig();
    return () => {
      clearHideTimer();
    };
  }, [deviceToken, configOpen, scheduleHideConfig, clearHideTimer]);

  useEffect(() => {
    return () => revokeBlob();
  }, [revokeBlob]);

  const sendHeartbeat = useCallback(async () => {
    const token = deviceToken ?? localStorage.getItem('device_token');
    if (!token) return;
    const ack = appliedAckRef.current;
    const res = await fetch(`${API}/device/heartbeat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        appVersion: APP_VERSION,
        ...(ack.publicationVersion != null
          ? { appliedPublicationVersion: ack.publicationVersion }
          : {}),
        ...(ack.contentRevision
          ? { appliedContentRevision: ack.contentRevision }
          : {}),
        metrics: buildMetrics(),
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message ?? `HTTP ${res.status}`);
    return data.serverTime as string;
  }, [deviceToken]);

  useEffect(() => {
    if (!deviceToken) {
      setHeartbeatStatus(null);
      return;
    }
    let cancelled = false;
    const tick = async () => {
      try {
        const serverTime = await sendHeartbeat();
        if (!cancelled && serverTime) {
          setHeartbeatStatus(
            `Heartbeat OK — ${new Date(serverTime).toLocaleString()}`
          );
          setErr(null);
        }
      } catch (e) {
        if (!cancelled) {
          setHeartbeatStatus(null);
          setErr(e instanceof Error ? e.message : 'Falha no heartbeat');
        }
      }
    };
    void tick();
    const id = window.setInterval(() => void tick(), HEARTBEAT_INTERVAL_SEC * 1000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [deviceToken, sendHeartbeat]);

  useEffect(() => {
    const token = deviceToken ?? localStorage.getItem('device_token');
    if (!token) {
      setCurrentItem(null);
      setContentHint(null);
      return;
    }
    let cancelled = false;
    async function pollState() {
      try {
        const res = await fetch(`${API}/device/state`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = (await res.json()) as {
          currentItem?: CurrentItem;
          contentRevision?: string;
          publicationVersion?: number | null;
          message?: string;
        };
        if (cancelled) return;
        if (!res.ok) {
          setContentHint(data?.message ?? `Estado HTTP ${res.status}`);
          setCurrentItem(null);
          return;
        }
        const rev =
          typeof data.contentRevision === 'string' ? data.contentRevision : null;
        const pubVer =
          typeof data.publicationVersion === 'number'
            ? data.publicationVersion
            : null;
        if (rev != null) {
          if (
            lastContentRevisionRef.current != null &&
            lastContentRevisionRef.current !== rev
          ) {
            appliedAckRef.current = {
              publicationVersion: null,
              contentRevision: null,
            };
          }
          lastContentRevisionRef.current = rev;
          setContentRevision(rev);
        }
        setServerPublicationVersion(pubVer);
        setCurrentItem((data.currentItem as CurrentItem) ?? null);
        setErr(null);
      } catch {
        if (!cancelled) {
          setContentHint('Falha ao obter estado');
          setCurrentItem(null);
        }
      }
    }
    void pollState();
    const id = window.setInterval(() => void pollState(), STATE_POLL_SEC * 1000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [deviceToken]);

  const playlistId =
    currentItem?.type === 'playlist' && currentItem.playlistId ? currentItem.playlistId : null;

  useEffect(() => {
    setSlideIndex(0);
  }, [playlistId]);

  useEffect(() => {
    const token = deviceToken ?? localStorage.getItem('device_token');
    if (!token || !playlistId) {
      setPlaylistManifest(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API}/device/playlists/${playlistId}/manifest`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = (await res.json()) as PlaylistManifest & { message?: string };
        if (cancelled) return;
        if (!res.ok) {
          setContentHint(data?.message ?? `Playlist HTTP ${res.status}`);
          setPlaylistManifest(null);
          return;
        }
        setPlaylistManifest(data);
        setContentHint(null);
      } catch {
        if (!cancelled) {
          setContentHint('Falha ao carregar playlist');
          setPlaylistManifest(null);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [playlistId, deviceToken, contentRevision]);

  const playableSlides = useMemo(() => {
    if (!playlistManifest?.items.length) return [];
    return playlistManifest.items.filter((i) => isPlayableKind(i.kind));
  }, [playlistManifest]);

  /**
   * IDs estáveis (primitivos) — o poll de estado recria o objeto `currentItem` a cada poucos
   * segundos; não podemos depender dele nos efeitos de slide/timer, senão o vídeo reinicia
   * e o temporizador nunca cumpre a duração configurada.
   */
  const singleAssetId = useMemo(() => {
    const t = currentItem?.type;
    const id = currentItem?.assetId;
    if ((t === 'asset' || t === 'image') && id) return id;
    return null;
  }, [currentItem?.type, currentItem?.assetId]);

  /** Mantém no cache só os ficheiros do manifesto/conteúdo atual. */
  useEffect(() => {
    const keep = new Set<string>();
    if (singleAssetId) {
      keep.add(deviceAssetFileUrl(singleAssetId));
    }
    for (const slide of playableSlides) {
      if (slide.kind !== 'url') {
        keep.add(deviceAssetFileUrl(slide.assetId));
      }
    }
    void evictDeviceAssetCacheExcept([...keep]);
  }, [contentRevision, singleAssetId, playableSlides]);

  const markContentApplied = useCallback(() => {
    const rev = lastContentRevisionRef.current;
    if (!rev) return;
    appliedAckRef.current = {
      publicationVersion: serverPublicationVersion,
      contentRevision: rev,
    };
  }, [serverPublicationVersion]);

  const activeAssetId = useMemo(() => {
    if (playlistId && playableSlides.length) {
      const idx = slideIndex % playableSlides.length;
      return playableSlides[idx]?.assetId ?? null;
    }
    return singleAssetId;
  }, [playlistId, playableSlides, slideIndex, singleAssetId]);

  /** Carrega meta + ficheiro ou URL externa para o asset atual (item único ou slide). */
  useEffect(() => {
    const token = deviceToken ?? localStorage.getItem('device_token');
    if (!token) {
      revokeBlob();
      return;
    }

    if (playlistId) {
      if (!playableSlides.length) {
        if (playlistManifest) {
          setContentHint(
            'Nenhum item reproduzível (imagens, vídeo, PDF, HTML ou URL).'
          );
        }
        revokeBlob();
        return;
      }
    } else if (!singleAssetId) {
      revokeBlob();
      setContentHint('Sem conteúdo atribuído (CMS → dispositivo).');
      return;
    }

    const assetId = activeAssetId;
    if (!assetId) {
      revokeBlob();
      return;
    }

    let caption = '';
    if (playlistId && playableSlides.length) {
      const idx = slideIndex % playableSlides.length;
      caption = `${playlistManifest?.name ?? ''} — ${idx + 1}/${playableSlides.length}`;
    }

    let cancelled = false;

    (async () => {
      try {
        setContentHint(caption ? `A carregar… ${caption}` : 'A carregar…');
        const metaRes = await fetch(`${API}/device/assets/${assetId}/meta`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (cancelled) return;
        if (!metaRes.ok) {
          setContentHint(`Meta HTTP ${metaRes.status}`);
          revokeBlob();
          return;
        }
        const meta = (await metaRes.json()) as {
          kind: string;
          mimeType?: string;
          remoteUrl?: string | null;
        };

        if (meta.kind === 'url' && meta.remoteUrl) {
          revokeBlob();
          if (cancelled) return;
          blobUrlRef.current = null;
          setBlobUrl(null);
          setFrameUrl(meta.remoteUrl);
          setMediaKind('url');
          setContentHint(caption || 'URL externo');
          markContentApplied();
          return;
        }

        const fr = await fetchDeviceAssetCached(
          `${API}/device/assets/${assetId}/file`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );
        if (cancelled) return;
        if (!fr.ok) {
          setContentHint(`Ficheiro HTTP ${fr.status}`);
          revokeBlob();
          return;
        }
        let blob = await fr.blob();
        if (cancelled) return;
        /** MIME explícito: respostas em stream por vezes deixam blob.type vazio; o Chrome não abre PDF no iframe sem tipo. */
        const headerType =
          fr.headers.get('content-type')?.split(';')[0]?.trim() ?? '';
        const canonical =
          meta.kind === 'pdf'
            ? 'application/pdf'
            : meta.kind === 'html'
              ? 'text/html'
              : '';
        const effectiveType =
          canonical ||
          blob.type ||
          headerType ||
          meta.mimeType ||
          'application/octet-stream';
        const needsRetype =
          !blob.type ||
          blob.type === 'application/octet-stream' ||
          (Boolean(canonical) && blob.type !== canonical);
        if (needsRetype) {
          blob = new Blob([await blob.arrayBuffer()], { type: effectiveType });
        }
        if (cancelled) return;
        revokeBlob();
        const url = URL.createObjectURL(blob);
        blobUrlRef.current = url;
        setBlobUrl(url);
        setFrameUrl(null);
        const k = meta.kind as MediaKind;
        setMediaKind(
          ['image', 'video', 'pdf', 'html'].includes(k) ? k : 'image'
        );
        setContentHint(caption || null);
        markContentApplied();
      } catch {
        if (!cancelled) {
          setContentHint('Falha ao carregar mídia');
          revokeBlob();
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    activeAssetId,
    playlistId,
    singleAssetId,
    playlistManifest,
    playableSlides,
    slideIndex,
    deviceToken,
    revokeBlob,
    markContentApplied,
  ]);

  /** Avança slide pela duração do item — não depender de `currentItem` (poll recria o objeto). */
  useEffect(() => {
    if (!playlistId || !playableSlides.length) {
      return;
    }
    const idx = slideIndex % playableSlides.length;
    const sl = playableSlides[idx]!;
    const sec = sl.durationSec ?? defaultDurationSec(sl.kind);
    const t = window.setTimeout(() => setSlideIndex((s) => s + 1), Math.max(1, sec) * 1000);
    return () => clearTimeout(t);
  }, [playlistId, playableSlides, slideIndex]);

  useEffect(() => {
    if (mediaKind === 'video' && blobUrl && videoRef.current) {
      void videoRef.current.play().catch(() => {
        /* autoplay policy */
      });
    }
  }, [mediaKind, blobUrl]);

  useEffect(() => {
    const token = deviceToken ?? localStorage.getItem('device_token');
    if (!token || (mediaKind !== 'image' && mediaKind !== 'video')) {
      return;
    }
    const tick = () => {
      void (async () => {
        const blob = await drawStageToJpegBlob(
          mediaKind,
          imageRef.current,
          videoRef.current,
          0.72
        );
        if (!blob) return;
        const fd = new FormData();
        fd.append('file', blob, 'preview.jpg');
        try {
          await fetch(`${API}/device/preview`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
            body: fd,
          });
        } catch {
          /* rede indisponível — não inundar UI */
        }
      })();
    };
    tick();
    const id = window.setInterval(tick, PREVIEW_INTERVAL_SEC * 1000);
    return () => window.clearInterval(id);
  }, [deviceToken, mediaKind, blobUrl]);

  async function onPair(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    setMsg(null);
    setLoading(true);
    try {
      const res = await fetch(`${API}/public/devices/pair`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pairingCode: pairingCode.trim().toUpperCase(),
          platform,
          ...(name.trim() ? { name: name.trim() } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message ?? `HTTP ${res.status}`);
      }
      localStorage.setItem('device_token', data.accessToken);
      setDeviceToken(data.accessToken);
      setMsg('Pareado. Painel oculta em 10s — passe o rato no topo para reabrir.');
      setConfigOpen(true);
      scheduleHideConfig();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Falha');
    } finally {
      setLoading(false);
    }
  }

  function clearToken() {
    void clearDeviceAssetCache();
    localStorage.removeItem('device_token');
    setDeviceToken(null);
    lastContentRevisionRef.current = null;
    appliedAckRef.current = { publicationVersion: null, contentRevision: null };
    setContentRevision(null);
    setServerPublicationVersion(null);
    setHeartbeatStatus(null);
    setCurrentItem(null);
    setPlaylistManifest(null);
    setSlideIndex(0);
    revokeBlob();
    setMsg('Token removido.');
    setConfigOpen(true);
    clearHideTimer();
  }

  const hasMedia = Boolean(blobUrl || frameUrl);
  const showSlideCaption = Boolean(
    playlistId && hasMedia && contentHint && !configOpen
  );
  const showFooterPulse = Boolean(deviceToken && !configOpen);

  return (
    <div className="player-root">
      <div className="player-stage">
        {hasMedia ? (
          <>
            {mediaKind === 'image' && blobUrl && (
              <img
                ref={imageRef}
                className="player-stage__media"
                src={blobUrl}
                alt=""
              />
            )}
            {mediaKind === 'video' && blobUrl && (
              <video
                ref={videoRef}
                key={blobUrl}
                className="player-stage__media"
                src={blobUrl}
                autoPlay
                muted
                playsInline
                loop={!playlistId}
              />
            )}
            {mediaKind === 'pdf' && blobUrl && (
              <iframe
                key={blobUrl}
                className="player-stage__media player-stage__frame"
                src={blobUrl}
                title="Documento PDF"
              />
            )}
            {mediaKind === 'html' && blobUrl && (
              <iframe
                key={blobUrl}
                className="player-stage__media player-stage__frame"
                src={blobUrl}
                title=""
                sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
              />
            )}
            {mediaKind === 'url' && frameUrl && (
              <iframe
                key={frameUrl}
                className="player-stage__media player-stage__frame"
                src={frameUrl}
                title=""
                sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
                referrerPolicy="no-referrer-when-downgrade"
              />
            )}
          </>
        ) : (
          <div className="player-stage__empty">
            <div className="player-stage__empty-inner">
              {deviceToken && contentHint && (
                <p>{contentHint}</p>
              )}
              {!deviceToken && (
                <p>
                  Sem pareamento. Abra o painel no topo da página e introduza o código do CMS.
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {showSlideCaption && (
        <div className="player-caption" aria-live="polite">
          {contentHint}
        </div>
      )}

      {showFooterPulse && (
        <div
          className={`player-footer-status ${heartbeatStatus ? '' : 'is-offline'}`}
          title={heartbeatStatus ?? 'Sem heartbeat'}
        >
          <span className="player-footer-status__dot" aria-hidden />
          <span>{heartbeatStatus ? 'Sincronizado' : 'Aguardando heartbeat'}</span>
        </div>
      )}

      <div
        ref={topUiRef}
        className={`player-top-ui${configOpen ? ' player-top-ui--open' : ''}`}
        onMouseMove={onTopUiMouseMove}
        onMouseLeave={onTopUiMouseLeave}
        onKeyDown={onTopUiKeyDown}
        onInput={onTopUiMouseMove}
        tabIndex={-1}
      >
        <button
          type="button"
          className="player-hotzone"
          aria-label="Mostrar configuração do player"
          onMouseEnter={openConfigPanel}
          onFocus={openConfigPanel}
          onTouchStart={(e) => {
            e.preventDefault();
            openConfigPanel();
          }}
        >
          <span className="player-hotzone__hint">Configuração</span>
        </button>

        <div className={`player-chrome ${configOpen ? 'is-open' : ''}`}>
          <div className="player-config">
            <div className="player-config__inner">
              <h1 className="player-config__title">EasySignage Player</h1>
              <p className="player-config__subtitle">
                Pareamento e reprodução. API: <code>{API}</code>
              </p>

              {deviceToken && contentHint && !hasMedia && (
                <p className="player-msg player-msg--hint" style={{ marginTop: 0 }}>
                  {contentHint}
                </p>
              )}

              <form className="player-form" onSubmit={onPair}>
                <label>
                  <span>Código</span>
                  <input
                    className="player-input"
                    value={pairingCode}
                    onChange={(e) => setPairingCode(e.target.value)}
                    placeholder="XXXXXXXX"
                    autoComplete="off"
                  />
                </label>
                <label>
                  <span>Plataforma</span>
                  <select
                    className="player-select"
                    value={platform}
                    onChange={(e) => setPlatform(e.target.value)}
                  >
                    <option value="web">web</option>
                    <option value="tv_browser">tv_browser</option>
                    <option value="android_browser">android_browser</option>
                  </select>
                </label>
                <label>
                  <span>Nome (opcional)</span>
                  <input
                    className="player-input"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    autoComplete="off"
                  />
                </label>
                <div className="player-actions">
                  <button
                    className="player-btn player-btn--primary"
                    type="submit"
                    disabled={loading}
                  >
                    {loading ? 'A parear…' : 'Parear'}
                  </button>
                </div>
              </form>

              {deviceToken && (
                <div className="player-actions" style={{ marginTop: '0.75rem' }}>
                  <button
                    type="button"
                    className="player-btn player-btn--ghost"
                    onClick={() =>
                      void sendHeartbeat()
                        .then((t) => setMsg(`Manual OK: ${t}`))
                        .catch((e) => setErr(String(e)))
                    }
                  >
                    Heartbeat agora
                  </button>
                  <button type="button" className="player-btn player-btn--ghost" onClick={clearToken}>
                    Esquecer token
                  </button>
                </div>
              )}

              {heartbeatStatus && (
                <div className="player-heartbeat">{heartbeatStatus}</div>
              )}

              {msg && (
                <p className="player-msg player-msg--ok">{msg}</p>
              )}
              {err && <p className="player-msg player-msg--err">{err}</p>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
