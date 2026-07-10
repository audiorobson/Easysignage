import {
  type FormEvent,
  type KeyboardEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { isPlayableInPlayer } from '@easysignage/shared-types';
import {
  clearDeviceAssetCache,
  evictDeviceAssetCacheExcept,
} from './deviceAssetCache';
import {
  clearMediaCache,
  getCachedMedia,
  loadMedia,
  playlistFileUrls,
  preloadSlides,
  revokeMediaCache,
  type LoadedMedia,
  type MediaKind,
} from './mediaLoader';
import { SlideLayer } from './SlideLayer';

const API =
  import.meta.env.VITE_API_URL?.replace(/\/$/, '') ?? 'http://localhost:3001/api/v1';

const HEARTBEAT_INTERVAL_SEC = 60;
/** JPEG para pré-visualização no CMS (sem WebRTC). */
const PREVIEW_INTERVAL_SEC = 1;
const STATE_POLL_SEC = 3;
const APP_VERSION = '0.0.1';
const CONFIG_HIDE_MS = 10_000;

type TransitionKind = 'none' | 'fade' | 'slide-left' | 'slide-right' | 'zoom';

const TRANSITION_OPTIONS: { value: TransitionKind; label: string }[] = [
  { value: 'none', label: 'Instantânea (pré-carregada)' },
  { value: 'fade', label: 'Fade (dissolver)' },
  { value: 'slide-left', label: 'Deslizar ←' },
  { value: 'slide-right', label: 'Deslizar →' },
  { value: 'zoom', label: 'Zoom suave' },
];

function readTransition(): TransitionKind {
  const v = localStorage.getItem('player_transition');
  if (v && TRANSITION_OPTIONS.some((o) => o.value === v)) return v as TransitionKind;
  return 'fade';
}

function readTransitionMs(): number {
  const n = Number(localStorage.getItem('player_transition_ms'));
  return n >= 150 && n <= 1200 ? n : 450;
}

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
  return kind === 'url' || isPlayableInPlayer(kind);
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
    case 'audio':
      return 60;
    case 'pdf':
      return 45;
    case 'html':
      return 60;
    case 'text':
      return 20;
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

  const [transitionKind, setTransitionKind] = useState<TransitionKind>(readTransition);
  const [transitionMs, setTransitionMs] = useState(readTransitionMs);
  const [displayMedia, setDisplayMedia] = useState<LoadedMedia | null>(null);
  const [leaveMedia, setLeaveMedia] = useState<LoadedMedia | null>(null);
  const [enterMedia, setEnterMedia] = useState<LoadedMedia | null>(null);
  const displayMediaRef = useRef<LoadedMedia | null>(null);
  const enterMediaRef = useRef<LoadedMedia | null>(null);
  const transitioningRef = useRef(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  const [configOpen, setConfigOpen] = useState(() => !localStorage.getItem('device_token'));
  const topUiRef = useRef<HTMLDivElement>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoPairAttemptedRef = useRef(false);

  const clearStage = useCallback(() => {
    setDisplayMedia(null);
    setLeaveMedia(null);
    setEnterMedia(null);
    displayMediaRef.current = null;
    enterMediaRef.current = null;
    transitioningRef.current = false;
  }, []);

  const clearHideTimer = useCallback(() => {
    if (hideTimerRef.current != null) {
      window.clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  }, []);

  const invalidateSession = useCallback((message?: string) => {
    void clearDeviceAssetCache();
    clearMediaCache();
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
    clearStage();
    setConfigOpen(true);
    clearHideTimer();
    if (message) setErr(message);
  }, [clearStage, clearHideTimer]);

  const handleAuthFailure = useCallback(() => {
    invalidateSession('Sessão expirada ou inválida. Introduza um novo código do CMS.');
  }, [invalidateSession]);

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
    return () => clearMediaCache();
  }, []);

  const markContentApplied = useCallback(() => {
    const rev = lastContentRevisionRef.current;
    if (!rev) return;
    appliedAckRef.current = {
      publicationVersion: serverPublicationVersion,
      contentRevision: rev,
    };
  }, [serverPublicationVersion]);

  useEffect(() => {
    displayMediaRef.current = displayMedia;
  }, [displayMedia]);

  useEffect(() => {
    enterMediaRef.current = enterMedia;
  }, [enterMedia]);

  const finishTransition = useCallback(() => {
    const media = enterMediaRef.current;
    if (!media) return;
    setDisplayMedia(media);
    displayMediaRef.current = media;
    setLeaveMedia(null);
    setEnterMedia(null);
    enterMediaRef.current = null;
    transitioningRef.current = false;
    markContentApplied();
  }, [markContentApplied]);

  const applyMedia = useCallback(
    async (assetId: string, kindHint?: string) => {
      const token = deviceToken ?? localStorage.getItem('device_token');
      if (!token) return;
      try {
        let media = getCachedMedia(assetId);
        if (!media) {
          media = await loadMedia(token, { assetId, kind: kindHint ?? 'image' });
        }
        const current = displayMediaRef.current;
        if (!current) {
          setDisplayMedia(media);
          displayMediaRef.current = media;
          setContentHint(null);
          markContentApplied();
          return;
        }
        if (current.assetId === media.assetId) return;
        if (transitionKind === 'none') {
          setDisplayMedia(media);
          displayMediaRef.current = media;
          markContentApplied();
          return;
        }
        if (transitioningRef.current) finishTransition();
        transitioningRef.current = true;
        setLeaveMedia(current);
        setEnterMedia(media);
        window.setTimeout(() => {
          if (transitioningRef.current && enterMediaRef.current) {
            finishTransition();
          }
        }, transitionMs + 80);
      } catch {
        setContentHint('Falha ao carregar mídia');
      }
    },
    [deviceToken, transitionKind, transitionMs, markContentApplied, finishTransition]
  );

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
    if (res.status === 401 || res.status === 403) {
      handleAuthFailure();
      throw new Error('Não autorizado');
    }
    const data = await res.json();
    if (!res.ok) throw new Error(data.message ?? `HTTP ${res.status}`);
    return data.serverTime as string;
  }, [deviceToken, handleAuthFailure]);

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
        if (res.status === 401 || res.status === 403) {
          handleAuthFailure();
          return;
        }
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
  }, [deviceToken, handleAuthFailure]);

  const playlistId =
    currentItem?.type === 'playlist' && currentItem.playlistId ? currentItem.playlistId : null;

  useEffect(() => {
    setSlideIndex(0);
    clearStage();
  }, [playlistId, contentRevision, clearStage]);

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
        if (res.status === 401 || res.status === 403) {
          handleAuthFailure();
          return;
        }
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
  }, [playlistId, deviceToken, contentRevision, handleAuthFailure]);

  const performPair = useCallback(
    async (code: string) => {
      const res = await fetch(`${API}/public/devices/pair`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pairingCode: code.trim().toUpperCase(),
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
      setMsg('Pareado. A sincronizar conteúdo…');
      setConfigOpen(true);
      scheduleHideConfig();
      void sendHeartbeat().catch(() => undefined);
    },
    [platform, name, scheduleHideConfig, sendHeartbeat]
  );

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('pair')?.trim().toUpperCase();
    if (code) setPairingCode(code);
  }, []);

  useEffect(() => {
    if (autoPairAttemptedRef.current || deviceToken) return;
    const code = new URLSearchParams(window.location.search)
      .get('pair')
      ?.trim()
      .toUpperCase();
    if (!code || code.length < 6) return;
    autoPairAttemptedRef.current = true;
    setLoading(true);
    setErr(null);
    void performPair(code)
      .catch((e) => {
        setErr(e instanceof Error ? e.message : 'Falha no pareamento automático');
      })
      .finally(() => setLoading(false));
  }, [deviceToken, performPair]);

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

  const singleAssetKind = currentItem?.kind ?? 'image';

  useEffect(() => {
    const token = deviceToken ?? localStorage.getItem('device_token');
    if (!token) return;
    const keepIds = new Set<string>();
    if (singleAssetId) keepIds.add(singleAssetId);
    for (const s of playableSlides) keepIds.add(s.assetId);
    revokeMediaCache(keepIds);
    void evictDeviceAssetCacheExcept([
      ...playlistFileUrls(playableSlides),
      ...(singleAssetId ? [deviceAssetFileUrl(singleAssetId)] : []),
    ]);
  }, [contentRevision, singleAssetId, playableSlides, deviceToken]);

  useEffect(() => {
    const token = deviceToken ?? localStorage.getItem('device_token');
    if (!token || !playableSlides.length) return;
    preloadSlides(token, playableSlides);
  }, [playableSlides, deviceToken, contentRevision]);

  useEffect(() => {
    if (!playlistId || !playableSlides.length) return;
    const idx = slideIndex % playableSlides.length;
    const slide = playableSlides[idx]!;
    setContentHint(
      `${playlistManifest?.name ?? ''} — ${idx + 1}/${playableSlides.length}`
    );
    void applyMedia(slide.assetId, slide.kind);
  }, [slideIndex, playlistId, playableSlides, playlistManifest?.name, applyMedia]);

  useEffect(() => {
    if (playlistId || !singleAssetId) {
      if (!playlistId && !singleAssetId) clearStage();
      return;
    }
    void applyMedia(singleAssetId, singleAssetKind);
  }, [singleAssetId, singleAssetKind, playlistId, contentRevision, applyMedia, clearStage]);

  useEffect(() => {
    if (playlistId) {
      if (!playableSlides.length && playlistManifest) {
        setContentHint(
          playlistManifest.items.length === 0
            ? 'Playlist vazia — adicione itens no CMS (Playlists).'
            : 'Nenhum item reproduzível (imagem, vídeo, áudio, PDF, HTML, texto ou URL).'
        );
        clearStage();
      }
      return;
    }
    if (!singleAssetId && deviceToken) {
      setContentHint('Sem conteúdo atribuído (CMS → dispositivo).');
      clearStage();
    }
  }, [
    playlistId,
    playableSlides,
    playlistManifest,
    singleAssetId,
    deviceToken,
    clearStage,
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
    const token = deviceToken ?? localStorage.getItem('device_token');
    const kind = displayMedia?.kind ?? null;
    if (!token || (kind !== 'image' && kind !== 'video')) return;
    const tick = () => {
      void (async () => {
        const blob = await drawStageToJpegBlob(
          kind,
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
          /* ignore */
        }
      })();
    };
    tick();
    const id = window.setInterval(tick, PREVIEW_INTERVAL_SEC * 1000);
    return () => window.clearInterval(id);
  }, [deviceToken, displayMedia?.kind, displayMedia?.assetId]);

  async function onPair(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    setMsg(null);
    setLoading(true);
    try {
      await performPair(pairingCode);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Falha');
    } finally {
      setLoading(false);
    }
  }

  function clearToken() {
    invalidateSession('Token removido.');
    setMsg('Token removido.');
  }

  function onTransitionChange(kind: TransitionKind) {
    setTransitionKind(kind);
    localStorage.setItem('player_transition', kind);
  }

  function onTransitionMsChange(ms: number) {
    setTransitionMs(ms);
    localStorage.setItem('player_transition_ms', String(ms));
  }

  const hasMedia = Boolean(displayMedia || leaveMedia || enterMedia);
  const showSlideCaption = Boolean(
    playlistId && hasMedia && contentHint && !configOpen
  );
  const showFooterPulse = Boolean(deviceToken && !configOpen);
  const loopVideo = !playlistId;

  return (
    <div className="player-root">
      <div className="player-stage">
        <div className="player-stage__layers">
          {leaveMedia && enterMedia && (
            <SlideLayer
              media={leaveMedia}
              phase="leave"
              transition={transitionKind}
              transitionMs={transitionMs}
              loopVideo={loopVideo}
            />
          )}
          {enterMedia ? (
            <SlideLayer
              media={enterMedia}
              phase={transitionKind === 'none' ? 'static' : 'enter'}
              transition={transitionKind}
              transitionMs={transitionMs}
              loopVideo={loopVideo}
              imageRef={imageRef}
              videoRef={videoRef}
              audioRef={audioRef}
              onAnimationEnd={finishTransition}
            />
          ) : (
            displayMedia && (
              <SlideLayer
                media={displayMedia}
                phase="static"
                transition={transitionKind}
                transitionMs={transitionMs}
                loopVideo={loopVideo}
                imageRef={imageRef}
                videoRef={videoRef}
                audioRef={audioRef}
              />
            )
          )}
        </div>
        {!hasMedia && (
          <div className="player-stage__empty">
            <div className="player-stage__empty-inner">
              {deviceToken && contentHint && <p>{contentHint}</p>}
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
                <>
                  <div className="player-form" style={{ marginTop: '0.75rem' }}>
                    <label>
                      <span>Transição entre itens</span>
                      <select
                        className="player-select"
                        value={transitionKind}
                        onChange={(e) =>
                          onTransitionChange(e.target.value as TransitionKind)
                        }
                      >
                        {TRANSITION_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    {transitionKind !== 'none' && (
                      <label>
                        <span>Duração ({transitionMs} ms)</span>
                        <input
                          className="player-input"
                          type="range"
                          min={150}
                          max={1200}
                          step={50}
                          value={transitionMs}
                          onChange={(e) =>
                            onTransitionMsChange(Number(e.target.value))
                          }
                        />
                      </label>
                    )}
                  </div>
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
                </>
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
