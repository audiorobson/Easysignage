import './easysignage-bridge';
import { maskStreamUrl } from '@easysignage/shared-types';
import type { RtspPlaybackStatus } from './easysignage-bridge';

type ConnectRtspOptions = {
  url: string;
  videoElement: HTMLVideoElement | null;
  onStatus?: (status: RtspPlaybackStatus) => void;
};

export function connectRtspStream({
  url,
  videoElement,
  onStatus,
}: ConnectRtspOptions): () => void {
  if (!videoElement) {
    onStatus?.('unsupported');
    return () => {};
  }

  const bridge = window.easysignage?.rtsp;
  let cancelled = false;

  onStatus?.('connecting');

  if (bridge?.play) {
    void bridge
      .play(url, videoElement)
      .then(() => {
        if (!cancelled) onStatus?.('playing');
      })
      .catch(() => {
        if (!cancelled) onStatus?.('error');
      });

    return () => {
      cancelled = true;
      bridge.stop?.(url);
      videoElement.removeAttribute('src');
      videoElement.load();
    };
  }

  videoElement.src = url;
  void videoElement
    .play()
    .then(() => {
      if (!cancelled) onStatus?.('playing');
    })
    .catch(() => {
      if (!cancelled) onStatus?.('unsupported');
    });

  return () => {
    cancelled = true;
    videoElement.removeAttribute('src');
    videoElement.load();
  };
}

export function rtspStatusLabelPt(status: RtspPlaybackStatus): string {
  switch (status) {
    case 'connecting':
      return 'A ligar ao stream RTSP…';
    case 'playing':
      return 'Stream RTSP ativo';
    case 'unsupported':
      return 'RTSP requer player nativo (Electron/Android). O browser não reproduz rtsp:// diretamente.';
    case 'error':
      return 'Falha ao reproduzir o stream RTSP';
    default:
      return status;
  }
}

export { maskStreamUrl };
