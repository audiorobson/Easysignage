/** Viewport lógico do dispositivo (Fase L1 — layouts & video wall). */

export const DISPLAY_ORIENTATIONS = [
  'landscape',
  'portrait',
  'landscape_flipped',
  'portrait_flipped',
] as const;

export type DisplayOrientation = (typeof DISPLAY_ORIENTATIONS)[number];

export type DeviceViewport = {
  width: number;
  height: number;
  orientation: DisplayOrientation;
};

export const DEFAULT_DEVICE_VIEWPORT: DeviceViewport = {
  width: 1920,
  height: 1080,
  orientation: 'landscape',
};

export const VIEWPORT_PRESETS: ReadonlyArray<{
  id: string;
  label: string;
  width: number;
  height: number;
  orientation: DisplayOrientation;
}> = [
  { id: 'fhd_landscape', label: '1920×1080 — Paisagem', width: 1920, height: 1080, orientation: 'landscape' },
  { id: 'fhd_portrait', label: '1080×1920 — Retrato', width: 1080, height: 1920, orientation: 'portrait' },
  { id: '4k_landscape', label: '3840×2160 — 4K paisagem', width: 3840, height: 2160, orientation: 'landscape' },
  { id: '4k_portrait', label: '2160×3840 — 4K retrato', width: 2160, height: 3840, orientation: 'portrait' },
  { id: 'hd_landscape', label: '1280×720 — HD', width: 1280, height: 720, orientation: 'landscape' },
];

const ORIENTATION_ROTATE_DEG: Record<DisplayOrientation, number> = {
  landscape: 0,
  portrait: 90,
  landscape_flipped: 180,
  portrait_flipped: 270,
};

export function isDisplayOrientation(v: string): v is DisplayOrientation {
  return (DISPLAY_ORIENTATIONS as readonly string[]).includes(v);
}

export function orientationRotateDeg(orientation: DisplayOrientation): number {
  return ORIENTATION_ROTATE_DEG[orientation];
}

export function normalizeDeviceViewport(input: {
  viewportWidth?: number | null;
  viewportHeight?: number | null;
  displayOrientation?: string | null;
}): DeviceViewport {
  const width =
    typeof input.viewportWidth === 'number' && input.viewportWidth >= 320
      ? Math.min(7680, Math.floor(input.viewportWidth))
      : DEFAULT_DEVICE_VIEWPORT.width;
  const height =
    typeof input.viewportHeight === 'number' && input.viewportHeight >= 320
      ? Math.min(7680, Math.floor(input.viewportHeight))
      : DEFAULT_DEVICE_VIEWPORT.height;
  const rawOrientation = input.displayOrientation ?? '';
  const orientation: DisplayOrientation = isDisplayOrientation(rawOrientation)
    ? rawOrientation
    : DEFAULT_DEVICE_VIEWPORT.orientation;
  return { width, height, orientation };
}

/** Escala para caber no ecrã físico mantendo o canvas lógico. */
export function computeViewportFitScale(
  viewport: DeviceViewport,
  screenW: number,
  screenH: number
): number {
  const deg = orientationRotateDeg(viewport.orientation);
  const sideways = deg === 90 || deg === 270;
  const boundW = sideways ? viewport.height : viewport.width;
  const boundH = sideways ? viewport.width : viewport.height;
  if (boundW <= 0 || boundH <= 0 || screenW <= 0 || screenH <= 0) return 1;
  return Math.min(screenW / boundW, screenH / boundH, 1);
}
