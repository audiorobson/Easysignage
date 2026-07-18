export type RtspPlaybackStatus = 'connecting' | 'playing' | 'unsupported' | 'error';

export type RtspBridge = {
  play(url: string, videoElement: HTMLVideoElement): Promise<void>;
  stop?(url: string): void;
};

/** PR 5.11 — executor de comandos remotos delegado ao processo nativo (Electron). */
export type RemoteCommandsBridge = {
  restartPlayer(): Promise<void>;
  clearCache(): Promise<void>;
  openUrl(url: string): Promise<void>;
  rebootOs(): Promise<void>;
  takeScreenshot(): Promise<{ base64: string; mime: string }>;
};

export type EasySignageBridge = {
  platform?: string;
  rtsp?: RtspBridge;
  commands?: RemoteCommandsBridge;
};

declare global {
  interface Window {
    easysignage?: EasySignageBridge;
  }
}

export {};
