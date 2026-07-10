import { useEffect, useRef, type CSSProperties, type RefObject } from 'react';
import {
  contentDisplayHasTargetBox,
  contentDisplayLayerStyle,
  contentFitCssClass,
  DEFAULT_CONTENT_FIT,
  normalizeContentDisplay,
  type ContentDisplay,
} from '@easysignage/shared-types';
import type { LoadedMedia, MediaKind } from './mediaLoader';

type TransitionKind = 'none' | 'fade' | 'slide-left' | 'slide-right' | 'zoom';

export function SlideLayer({
  media,
  phase,
  transition,
  transitionMs,
  loopVideo,
  display,
  imageRef,
  videoRef,
  audioRef,
  onAnimationEnd,
}: {
  media: LoadedMedia;
  phase: 'enter' | 'leave' | 'static';
  transition: TransitionKind;
  transitionMs: number;
  loopVideo: boolean;
  display?: ContentDisplay | null;
  imageRef?: RefObject<HTMLImageElement | null>;
  videoRef?: RefObject<HTMLVideoElement | null>;
  audioRef?: RefObject<HTMLAudioElement | null>;
  onAnimationEnd?: () => void;
}) {
  const layerRef = useRef<HTMLDivElement>(null);
  const normalized = normalizeContentDisplay(display ?? undefined);
  const fit = normalized.fit ?? DEFAULT_CONTENT_FIT;
  const hasTarget = contentDisplayHasTargetBox(normalized);

  useEffect(() => {
    const el = layerRef.current;
    if (!el || phase === 'static' || transition === 'none') return;
    const handler = (e: AnimationEvent) => {
      if (e.target !== el) return;
      onAnimationEnd?.();
    };
    el.addEventListener('animationend', handler);
    return () => el.removeEventListener('animationend', handler);
  }, [phase, transition, onAnimationEnd]);

  const animClass =
    transition === 'none' || phase === 'static'
      ? ''
      : `player-stage__layer--${phase}-${transition}`;

  const style: CSSProperties = {
    ...contentDisplayLayerStyle(normalized),
    ...(transition !== 'none' && phase !== 'static'
      ? { ['--es-slide-transition' as string]: `${transitionMs}ms` }
      : {}),
  };

  const layerClass = [
    'player-stage__layer',
    animClass,
    contentFitCssClass(fit),
    hasTarget ? 'player-stage__layer--has-target' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      ref={layerRef}
      className={layerClass}
      style={style}
      aria-hidden={phase === 'leave'}
    >
      <div
        className={`player-stage__media-box${hasTarget ? ' player-stage__media-box--target' : ''}`}
      >
        <MediaContent
          kind={media.kind}
          blobUrl={media.blobUrl}
          frameUrl={media.frameUrl}
          loopVideo={loopVideo}
          imageRef={imageRef}
          videoRef={videoRef}
          audioRef={audioRef}
        />
      </div>
    </div>
  );
}

function MediaContent({
  kind,
  blobUrl,
  frameUrl,
  loopVideo,
  imageRef,
  videoRef,
  audioRef,
}: {
  kind: MediaKind;
  blobUrl: string | null;
  frameUrl: string | null;
  loopVideo: boolean;
  imageRef?: RefObject<HTMLImageElement | null>;
  videoRef?: RefObject<HTMLVideoElement | null>;
  audioRef?: RefObject<HTMLAudioElement | null>;
}) {
  useEffect(() => {
    if (kind === 'video' && blobUrl && videoRef?.current) {
      void videoRef.current.play().catch(() => {
        /* autoplay policy */
      });
    }
    if (kind === 'audio' && blobUrl && audioRef?.current) {
      void audioRef.current.play().catch(() => {
        /* autoplay policy */
      });
    }
  }, [kind, blobUrl, videoRef, audioRef]);

  if (kind === 'image' && blobUrl) {
    return (
      <img
        ref={imageRef}
        className="player-stage__media"
        src={blobUrl}
        alt=""
        decoding="async"
      />
    );
  }
  if (kind === 'video' && blobUrl) {
    return (
      <video
        ref={videoRef}
        className="player-stage__media"
        src={blobUrl}
        autoPlay
        muted
        playsInline
        loop={loopVideo}
        preload="auto"
      />
    );
  }
  if (kind === 'audio' && blobUrl) {
    return (
      <div className="player-stage__audio-wrap">
        <audio
          ref={audioRef}
          className="player-stage__audio"
          src={blobUrl}
          autoPlay
          loop={loopVideo}
          preload="auto"
          controls
        />
      </div>
    );
  }
  if (kind === 'text' && blobUrl) {
    return (
      <iframe
        className="player-stage__media player-stage__frame player-stage__frame--text"
        src={blobUrl}
        title="Texto"
      />
    );
  }
  if (kind === 'pdf' && blobUrl) {
    return (
      <iframe
        className="player-stage__media player-stage__frame"
        src={blobUrl}
        title="Documento PDF"
      />
    );
  }
  if (kind === 'html' && blobUrl) {
    return (
      <iframe
        className="player-stage__media player-stage__frame"
        src={blobUrl}
        title=""
        sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
      />
    );
  }
  if (kind === 'url' && frameUrl) {
    return (
      <iframe
        className="player-stage__media player-stage__frame"
        src={frameUrl}
        title=""
        sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
        referrerPolicy="no-referrer-when-downgrade"
      />
    );
  }
  return null;
}
