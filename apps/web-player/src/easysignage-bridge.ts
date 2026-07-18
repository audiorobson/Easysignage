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

/** PR 5.13 — auto-update: o web-player deteta a nova versão, o Electron aciona o download/instalação. */
export type UpdaterBridge = {
  notifyUpdateAvailable(release: {
    version: string;
    channel: string;
    downloadUrl?: string | null;
  }): Promise<void>;
};

export type EasySignageBridge = {
  platform?: string;
  rtsp?: RtspBridge;
  commands?: RemoteCommandsBridge;
  updater?: UpdaterBridge;
};

declare global {
  interface Window {
    easysignage?: EasySignageBridge;
  }
}

export {};
