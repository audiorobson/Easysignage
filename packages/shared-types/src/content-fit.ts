/** Modos de exibição de conteúdo (Fase L3 — fit por zona e full-screen). */

export const CONTENT_FIT_MODES = [
  'native',
  'contain',
  'cover',
  'stretch',
  'center',
] as const;

export type ContentFitMode = (typeof CONTENT_FIT_MODES)[number];

export const DEFAULT_CONTENT_FIT: ContentFitMode = 'contain';

export type ContentDisplay = {
  fit: ContentFitMode;
  targetWidth?: number;
  targetHeight?: number;
  background?: string;
};

export function isContentFitMode(v: string): v is ContentFitMode {
  return (CONTENT_FIT_MODES as readonly string[]).includes(v);
}

export function normalizeContentDisplay(
  input?: {
    fit?: string;
    targetWidth?: number;
    targetHeight?: number;
    background?: string;
  } | null
): ContentDisplay {
  const fit =
    input?.fit && isContentFitMode(input.fit) ? input.fit : DEFAULT_CONTENT_FIT;
  const targetWidth =
    typeof input?.targetWidth === 'number' &&
    input.targetWidth >= 1 &&
    input.targetWidth <= 7680
      ? Math.floor(input.targetWidth)
      : undefined;
  const targetHeight =
    typeof input?.targetHeight === 'number' &&
    input.targetHeight >= 1 &&
    input.targetHeight <= 7680
      ? Math.floor(input.targetHeight)
      : undefined;
  const background =
    typeof input?.background === 'string' && input.background.trim()
      ? input.background.trim().slice(0, 32)
      : undefined;
  return {
    fit,
    ...(targetWidth != null ? { targetWidth } : {}),
    ...(targetHeight != null ? { targetHeight } : {}),
    ...(background ? { background } : {}),
  };
}

export function contentFitLabelPt(fit: ContentFitMode): string {
  const labels: Record<ContentFitMode, string> = {
    native: 'Nativo (1:1 px)',
    contain: 'Conter (letterbox)',
    cover: 'Cobrir (crop)',
    stretch: 'Esticar',
    center: 'Centrar (sem upscale)',
  };
  return labels[fit];
}

/** Classe CSS no player: `player-stage__layer--fit-cover`, etc. */
export function contentFitCssClass(fit: ContentFitMode): string {
  return `player-stage__layer--fit-${fit}`;
}

export function contentDisplayLayerStyle(
  display?: ContentDisplay | null
): Record<string, string> {
  if (!display) return {};
  const style: Record<string, string> = {};
  if (display.background) style.background = display.background;
  if (display.targetWidth != null) {
    style['--es-target-w'] = `${display.targetWidth}px`;
  }
  if (display.targetHeight != null) {
    style['--es-target-h'] = `${display.targetHeight}px`;
  }
  return style;
}

export function contentDisplayHasTargetBox(display?: ContentDisplay | null): boolean {
  return display?.targetWidth != null || display?.targetHeight != null;
}
