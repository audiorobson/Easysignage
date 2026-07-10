import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  computeWallDriftMs,
  computeWallPlaybackAt,
  isPlayableInPlayer,
  isRemoteStreamKind,
  normalizeContentDisplay,
  wallTileMediaTransform,
  type WallPlaybackSync,
  type WallTileCurrentItem,
} from '@easysignage/shared-types';
import type { RealtimeWallSync, RealtimeWallTick } from '@easysignage/device-protocol';
import { connectWallRealtime } from './wallRealtime';
import {
  getCachedMedia,
  loadMedia,
  preloadSlides,
  type LoadedMedia,
} from './mediaLoader';
import { SlideLayer } from './SlideLayer';

const API =
  import.meta.env.VITE_API_URL?.replace(/\/$/, '') ?? 'http://localhost:3001/api/v1';

type TransitionKind = 'none' | 'fade' | 'slide-left' | 'slide-right' | 'zoom';

type ManifestItem = {
  itemId: string;
  position: number;
  durationSec: number | null;
  assetId: string;
  mimeType: string;
  kind: string;
  remoteUrl?: string | null;
};

type PlaylistManifest = {
  playlistId: string;
  name: string;
  manifestRevision?: string;
  items: ManifestItem[];
};

function defaultDurationSec(kind: string): number {
  if (kind === 'rtsp' || kind === 'url') return 3600;
  if (kind === 'video') return 30;
  if (kind === 'audio') return 30;
  if (kind === 'pdf' || kind === 'html') return 20;
  return 10;
}

function isPlayableKind(kind: string): boolean {
  return isRemoteStreamKind(kind) || isPlayableInPlayer(kind);
}

function slideDurationMs(sl: ManifestItem): number {
  const sec = sl.durationSec ?? defaultDurationSec(sl.kind);
  return Math.max(1, sec) * 1000;
}

/** Índice de slide alinhado ao relógio da parede desde `epochMs`. */
function syncedSlideIndex(slides: ManifestItem[], elapsedMs: number): number {
  if (!slides.length) return 0;
  const total = slides.reduce((sum, s) => sum + slideDurationMs(s), 0);
  if (total <= 0) return 0;
  let remain = elapsedMs % total;
  for (let i = 0; i < slides.length; i++) {
    const d = slideDurationMs(slides[i]!);
    if (remain < d) return i;
    remain -= d;
  }
  return 0;
}

export function WallTileStage({
  tile,
  deviceToken,
  contentRevision,
  transitionKind,
  transitionMs,
  onReady,
  onSyncReport,
}: {
  tile: WallTileCurrentItem;
  deviceToken: string;
  contentRevision: string | null;
  transitionKind: TransitionKind;
  transitionMs: number;
  onReady?: () => void;
  onSyncReport?: (sync: WallPlaybackSync) => void;
}) {
  const playlistId =
    tile.source.type === 'playlist' ? tile.source.playlistId : null;
  const singleAssetId = tile.source.type === 'asset' ? tile.source.assetId : null;
  const singleAssetKind =
    tile.source.type === 'asset' ? (tile.source.kind ?? 'image') : 'image';

  const [syncReady, setSyncReady] = useState(false);
  const [liveEpochMs, setLiveEpochMs] = useState(tile.sync.epochMs);
  const [wsConnected, setWsConnected] = useState(false);
  const [playlistManifest, setPlaylistManifest] = useState<PlaylistManifest | null>(null);
  const [slideIndex, setSlideIndex] = useState(0);
  const [displayMedia, setDisplayMedia] = useState<LoadedMedia | null>(null);
  const [leaveMedia, setLeaveMedia] = useState<LoadedMedia | null>(null);
  const [enterMedia, setEnterMedia] = useState<LoadedMedia | null>(null);
  const displayMediaRef = useRef<LoadedMedia | null>(null);
  const enterMediaRef = useRef<LoadedMedia | null>(null);
  const transitioningRef = useRef(false);
  const readySentRef = useRef(false);
  const epochRef = useRef(tile.sync.epochMs);
  const slideStartRef = useRef(Date.now());

  useEffect(() => {
    setLiveEpochMs(tile.sync.epochMs);
    epochRef.current = tile.sync.epochMs;
  }, [tile.sync.epochMs]);

  useEffect(() => {
    epochRef.current = liveEpochMs;
  }, [liveEpochMs]);

  const transform = useMemo(
    () => wallTileMediaTransform(tile.crop, tile.virtualCanvas, tile.viewport),
    [tile.crop, tile.virtualCanvas, tile.viewport]
  );

  const contentDisplay = useMemo(
    () => normalizeContentDisplay(tile.display),
    [tile.display]
  );

  const finishTransition = useCallback(() => {
    const media = enterMediaRef.current;
    if (!media) return;
    setDisplayMedia(media);
    displayMediaRef.current = media;
    setLeaveMedia(null);
    setEnterMedia(null);
    enterMediaRef.current = null;
    transitioningRef.current = false;
    if (!readySentRef.current) {
      readySentRef.current = true;
      onReady?.();
    }
  }, [onReady]);

  const applyMedia = useCallback(
    async (assetId: string, kindHint?: string) => {
      try {
        let media = getCachedMedia(assetId);
        if (!media) {
          media = await loadMedia(deviceToken, { assetId, kind: kindHint ?? 'image' });
        }
        const current = displayMediaRef.current;
        if (!current) {
          setDisplayMedia(media);
          displayMediaRef.current = media;
          if (!readySentRef.current) {
            readySentRef.current = true;
            onReady?.();
          }
          return;
        }
        if (current.assetId === media.assetId) return;
        if (transitionKind === 'none') {
          setDisplayMedia(media);
          displayMediaRef.current = media;
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
        /* ignore */
      }
    },
    [deviceToken, transitionKind, transitionMs, finishTransition, onReady]
  );

  useEffect(() => {
    epochRef.current = liveEpochMs;
    setSyncReady(false);
    setSlideIndex(0);
    setDisplayMedia(null);
    setLeaveMedia(null);
    setEnterMedia(null);
    displayMediaRef.current = null;
    enterMediaRef.current = null;
    transitioningRef.current = false;
    readySentRef.current = false;
  }, [tile.wallId, tile.wallRevision, liveEpochMs, contentRevision]);

  useEffect(() => {
    const target = liveEpochMs;
    const tick = () => {
      if (Date.now() >= target - tile.sync.toleranceMs) {
        setSyncReady(true);
        return true;
      }
      return false;
    };
    if (tick()) return;
    const id = window.setInterval(() => {
      if (tick()) window.clearInterval(id);
    }, 50);
    return () => window.clearInterval(id);
  }, [liveEpochMs, tile.sync.toleranceMs]);

  useEffect(() => {
    if (!playlistId) {
      setPlaylistManifest(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API}/device/playlists/${playlistId}/manifest`, {
          headers: { Authorization: `Bearer ${deviceToken}` },
        });
        const data = (await res.json()) as PlaylistManifest & { message?: string };
        if (cancelled) return;
        if (!res.ok) {
          setPlaylistManifest(null);
          return;
        }
        setPlaylistManifest(data);
      } catch {
        if (!cancelled) setPlaylistManifest(null);
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

  const slideTimings = useMemo(
    () => playableSlides.map((s) => ({ durationMs: slideDurationMs(s) })),
    [playableSlides]
  );

  const syncReadyRef = useRef(syncReady);
  const slideIndexRef = useRef(slideIndex);
  const slideTimingsRef = useRef(slideTimings);
  useEffect(() => {
    syncReadyRef.current = syncReady;
  }, [syncReady]);
  useEffect(() => {
    slideIndexRef.current = slideIndex;
  }, [slideIndex]);
  useEffect(() => {
    slideTimingsRef.current = slideTimings;
  }, [slideTimings]);

  useEffect(() => {
    return connectWallRealtime({
      deviceToken,
      wallId: tile.wallId,
      handlers: {
        onConnected: () => setWsConnected(true),
        onDisconnected: () => setWsConnected(false),
        onSync: (msg: RealtimeWallSync) => {
          setLiveEpochMs(msg.syncEpochMs);
        },
        onTick: (msg: RealtimeWallTick) => {
          if (!syncReadyRef.current || !slideTimingsRef.current.length) return;
          const pos = computeWallPlaybackAt(
            slideTimingsRef.current,
            msg.syncEpochMs,
            msg.serverTimeMs
          );
          if (pos.itemIndex !== slideIndexRef.current) {
            setSlideIndex(pos.itemIndex);
            slideStartRef.current = msg.serverTimeMs - pos.positionMs;
          }
        },
      },
    });
  }, [deviceToken, tile.wallId]);

  useEffect(() => {
    slideStartRef.current = Date.now();
  }, [slideIndex, liveEpochMs]);

  useEffect(() => {
    if (!syncReady || !onSyncReport) return;
    const report = () => {
      const positionMs = Math.max(0, Date.now() - slideStartRef.current);
      const driftMs =
        slideTimings.length > 0
          ? computeWallDriftMs(slideTimings, epochRef.current, Date.now(), {
              itemIndex: slideIndex,
              positionMs,
            })
          : 0;
      onSyncReport({
        wallId: tile.wallId,
        itemIndex: slideIndex,
        positionMs,
        driftMs,
        syncEpochMs: epochRef.current,
      });
    };
    report();
    const id = window.setInterval(report, 2000);
    return () => window.clearInterval(id);
  }, [
    syncReady,
    onSyncReport,
    slideIndex,
    slideTimings,
    tile.wallId,
    tile.sync.epochMs,
  ]);

  useEffect(() => {
    if (!syncReady || !playlistId || !playableSlides.length) return;
    const elapsed = Math.max(0, Date.now() - epochRef.current);
    setSlideIndex(syncedSlideIndex(playableSlides, elapsed));
  }, [syncReady, playlistId, playableSlides, liveEpochMs]);

  useEffect(() => {
    if (!syncReady || !playableSlides.length) return;
    const elapsed = Math.max(0, Date.now() - epochRef.current);
    const idx = syncedSlideIndex(playableSlides, elapsed);
    if (idx !== slideIndex) setSlideIndex(idx);
    const sl = playableSlides[idx]!;
    const slideStart = (() => {
      const total = playableSlides.reduce((s, x) => s + slideDurationMs(x), 0);
      let remain = elapsed % total;
      for (let i = 0; i < playableSlides.length; i++) {
        const d = slideDurationMs(playableSlides[i]!);
        if (i === idx) return remain;
        remain -= d;
      }
      return 0;
    })();
    const untilNext = slideDurationMs(sl) - slideStart;
    const t = window.setTimeout(() => {
      const e = Math.max(0, Date.now() - epochRef.current);
      setSlideIndex(syncedSlideIndex(playableSlides, e));
    }, Math.max(50, untilNext));
    return () => clearTimeout(t);
  }, [syncReady, playableSlides, slideIndex, liveEpochMs]);

  useEffect(() => {
    if (!syncReady) return;
    if (playlistId && playableSlides.length) {
      const sl = playableSlides[slideIndex % playableSlides.length]!;
      void applyMedia(sl.assetId, sl.kind);
      return;
    }
    if (!playlistId && singleAssetId) {
      void applyMedia(singleAssetId, singleAssetKind);
    }
  }, [
    syncReady,
    playlistId,
    playableSlides,
    slideIndex,
    singleAssetId,
    singleAssetKind,
    applyMedia,
  ]);

  useEffect(() => {
    if (!syncReady || !playableSlides.length) return;
    preloadSlides(deviceToken, playableSlides);
  }, [syncReady, playableSlides, deviceToken, contentRevision]);

  const innerStyle = {
    width: tile.virtualCanvas.width,
    height: tile.virtualCanvas.height,
    transform: `translate(${transform.offsetX}px, ${transform.offsetY}px) scale(${transform.scale})`,
    transformOrigin: '0 0',
  } as const;

  return (
    <div
      className="player-wall-tile-stage"
      data-wall={tile.wallId}
      data-tile={`${tile.tile.row},${tile.tile.col}`}
    >
      <div
        className="player-wall-tile-viewport"
        style={{ width: tile.viewport.width, height: tile.viewport.height }}
      >
        {!syncReady ? (
          <div className="player-wall-tile-sync-wait">
            A aguardar sync…{wsConnected ? ' (WS)' : ''}
          </div>
        ) : (
          <div className="player-wall-tile-canvas" style={innerStyle}>
            <div className="player-stage__layers">
              {leaveMedia && enterMedia && (
                <SlideLayer
                  media={leaveMedia}
                  phase="leave"
                  transition={transitionKind}
                  transitionMs={transitionMs}
                  loopVideo={!playlistId}
                  display={contentDisplay}
                />
              )}
              {enterMedia ? (
                <SlideLayer
                  media={enterMedia}
                  phase={transitionKind === 'none' ? 'static' : 'enter'}
                  transition={transitionKind}
                  transitionMs={transitionMs}
                  loopVideo={!playlistId}
                  display={contentDisplay}
                  onAnimationEnd={finishTransition}
                />
              ) : (
                displayMedia && (
                  <SlideLayer
                    media={displayMedia}
                    phase="static"
                    transition={transitionKind}
                    transitionMs={transitionMs}
                    loopVideo={!playlistId}
                    display={contentDisplay}
                  />
                )
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
