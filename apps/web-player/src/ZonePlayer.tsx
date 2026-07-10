import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { isPlayableInPlayer } from '@easysignage/shared-types';
import type { LayoutCurrentZone } from '@easysignage/shared-types';
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
  if (kind === 'video') return 30;
  if (kind === 'audio') return 30;
  if (kind === 'pdf' || kind === 'html') return 20;
  return 10;
}

function isPlayableKind(kind: string): boolean {
  return kind === 'url' || isPlayableInPlayer(kind);
}

export function ZonePlayer({
  zone,
  deviceToken,
  contentRevision,
  transitionKind,
  transitionMs,
  onReady,
}: {
  zone: LayoutCurrentZone;
  deviceToken: string;
  contentRevision: string | null;
  transitionKind: TransitionKind;
  transitionMs: number;
  onReady?: () => void;
}) {
  const source = zone.source;
  const playlistId = source.type === 'playlist' ? source.playlistId : null;
  const singleAssetId = source.type === 'asset' ? source.assetId : null;
  const singleAssetKind = source.type === 'asset' ? (source.kind ?? 'image') : 'image';

  const [playlistManifest, setPlaylistManifest] = useState<PlaylistManifest | null>(null);
  const [slideIndex, setSlideIndex] = useState(0);
  const [displayMedia, setDisplayMedia] = useState<LoadedMedia | null>(null);
  const [leaveMedia, setLeaveMedia] = useState<LoadedMedia | null>(null);
  const [enterMedia, setEnterMedia] = useState<LoadedMedia | null>(null);
  const displayMediaRef = useRef<LoadedMedia | null>(null);
  const enterMediaRef = useRef<LoadedMedia | null>(null);
  const transitioningRef = useRef(false);
  const readySentRef = useRef(false);

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
        /* ignore zone load errors */
      }
    },
    [deviceToken, transitionKind, transitionMs, finishTransition, onReady]
  );

  useEffect(() => {
    setSlideIndex(0);
    setDisplayMedia(null);
    setLeaveMedia(null);
    setEnterMedia(null);
    displayMediaRef.current = null;
    enterMediaRef.current = null;
    transitioningRef.current = false;
    readySentRef.current = false;
  }, [playlistId, singleAssetId, contentRevision]);

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

  useEffect(() => {
    if (!playableSlides.length) return;
    preloadSlides(deviceToken, playableSlides);
  }, [playableSlides, deviceToken, contentRevision]);

  useEffect(() => {
    if (!playlistId || !playableSlides.length) return;
    const idx = slideIndex % playableSlides.length;
    const slide = playableSlides[idx]!;
    void applyMedia(slide.assetId, slide.kind);
  }, [slideIndex, playlistId, playableSlides, applyMedia]);

  useEffect(() => {
    if (playlistId || !singleAssetId) return;
    void applyMedia(singleAssetId, singleAssetKind);
  }, [singleAssetId, singleAssetKind, playlistId, contentRevision, applyMedia]);

  useEffect(() => {
    if (!playlistId || !playableSlides.length) return;
    const idx = slideIndex % playableSlides.length;
    const sl = playableSlides[idx]!;
    const sec = sl.durationSec ?? defaultDurationSec(sl.kind);
    const t = window.setTimeout(() => setSlideIndex((s) => s + 1), Math.max(1, sec) * 1000);
    return () => clearTimeout(t);
  }, [playlistId, playableSlides, slideIndex]);

  const loopVideo = !playlistId;
  const bg = zone.display?.background ?? '#000';

  return (
    <div className="player-zone" style={{ background: bg }}>
      <div className="player-zone__layers">
        {leaveMedia && enterMedia && (
          <SlideLayer
            media={leaveMedia}
            phase="leave"
            transition={transitionKind}
            transitionMs={transitionMs}
            loopVideo={loopVideo}
            display={zone.display}
          />
        )}
        {enterMedia ? (
            <SlideLayer
              media={enterMedia}
              phase={transitionKind === 'none' ? 'static' : 'enter'}
              transition={transitionKind}
              transitionMs={transitionMs}
              loopVideo={loopVideo}
              display={zone.display}
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
                display={zone.display}
              />
          )
        )}
      </div>
    </div>
  );
}
