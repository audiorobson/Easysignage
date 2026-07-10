export type RtspPlaybackStatus = 'connecting' | 'playing' | 'unsupported' | 'error';

export type RtspBridge = {
  play(url: string, videoElement: HTMLVideoElement): Promise<void>;
  stop?(url: string): void;
};

export type EasySignageBridge = {
  platform?: string;
  rtsp?: RtspBridge;
};

declare global {
  interface Window {
    easysignage?: EasySignageBridge;
  }
}

export {};
