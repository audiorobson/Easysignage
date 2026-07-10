import { useEffect, useRef, useState, type RefObject } from 'react';
import {
  connectRtspStream,
  maskStreamUrl,
  rtspStatusLabelPt,
} from './rtspPlayer';
import type { RtspPlaybackStatus } from './easysignage-bridge';

export function RtspStreamView({
  url,
  videoRef,
}: {
  url: string;
  videoRef?: RefObject<HTMLVideoElement | null>;
}) {
  const internalRef = useRef<HTMLVideoElement>(null);
  const resolvedRef = videoRef ?? internalRef;
  const [status, setStatus] = useState<RtspPlaybackStatus>('connecting');

  useEffect(() => {
    const el = resolvedRef.current;
    if (!el) return;
    return connectRtspStream({
      url,
      videoElement: el,
      onStatus: setStatus,
    });
  }, [url, resolvedRef]);

  const showOverlay = status === 'unsupported' || status === 'error';

  return (
    <div className="player-stage__rtsp">
      <video
        ref={resolvedRef}
        className="player-stage__media"
        autoPlay
        muted
        playsInline
        preload="auto"
      />
      {showOverlay && (
        <div className="player-stage__rtsp-overlay" role="status">
          <p className="player-stage__rtsp-title">Stream RTSP</p>
          <p className="player-stage__rtsp-msg">{rtspStatusLabelPt(status)}</p>
          <code className="player-stage__rtsp-url">{maskStreamUrl(url)}</code>
        </div>
      )}
      {status === 'connecting' && (
        <div className="player-stage__rtsp-overlay player-stage__rtsp-overlay--dim" role="status">
          <p className="player-stage__rtsp-msg">{rtspStatusLabelPt(status)}</p>
        </div>
      )}
    </div>
  );
}
