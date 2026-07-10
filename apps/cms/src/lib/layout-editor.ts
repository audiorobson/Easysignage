import {
  CONTENT_FIT_MODES,
  DEFAULT_CONTENT_FIT,
  type ContentFitMode,
  type LayoutTemplateZone,
  type LayoutZoneFrame,
} from '@easysignage/shared-types';

export type ZoneDisplayEditor = {
  fit: ContentFitMode;
  targetWidth: string;
  targetHeight: string;
};

export function defaultZoneDisplay(): ZoneDisplayEditor {
  return { fit: DEFAULT_CONTENT_FIT, targetWidth: '', targetHeight: '' };
}

export function buildDisplayBody(editor: ZoneDisplayEditor) {
  const body: Record<string, unknown> = { fit: editor.fit };
  const w = Number(editor.targetWidth);
  const h = Number(editor.targetHeight);
  if (w >= 1 && w <= 7680) body.targetWidth = Math.floor(w);
  if (h >= 1 && h <= 7680) body.targetHeight = Math.floor(h);
  return body;
}

export function displayFromJson(raw: unknown): ZoneDisplayEditor {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return defaultZoneDisplay();
  const o = raw as Record<string, unknown>;
  const fit =
    typeof o.fit === 'string' && CONTENT_FIT_MODES.includes(o.fit as ContentFitMode)
      ? (o.fit as ContentFitMode)
      : DEFAULT_CONTENT_FIT;
  return {
    fit,
    targetWidth: typeof o.targetWidth === 'number' ? String(o.targetWidth) : '',
    targetHeight: typeof o.targetHeight === 'number' ? String(o.targetHeight) : '',
  };
}

/** Paleta para distinguir zonas no canvas. */
export const LAYOUT_ZONE_COLORS = [
  '#2563eb',
  '#7c3aed',
  '#059669',
  '#d97706',
  '#db2777',
  '#0891b2',
] as const;

export function zoneColor(index: number): string {
  return LAYOUT_ZONE_COLORS[index % LAYOUT_ZONE_COLORS.length]!;
}

/** Zonas maiores primeiro (fundo); menores por cima (ex. PiP). */
export function sortZonesForCanvas(zones: LayoutTemplateZone[]): LayoutTemplateZone[] {
  return [...zones].sort((a, b) => b.frame.w * b.frame.h - a.frame.w * a.frame.h);
}

export const LAYOUT_GRID_STEP = 5;
export const LAYOUT_SNAP_THRESHOLD = 2;

export function snapPercent(value: number, step = LAYOUT_GRID_STEP): number {
  return Math.round(value / step) * step;
}

export function clampFrame(frame: LayoutZoneFrame): LayoutZoneFrame {
  let w = Math.max(1, Math.min(100, snapPercent(frame.w)));
  let h = Math.max(1, Math.min(100, snapPercent(frame.h)));
  let x = snapPercent(Math.max(0, Math.min(100 - w, frame.x)));
  let y = snapPercent(Math.max(0, Math.min(100 - h, frame.y)));
  return { x, y, w, h, unit: 'percent' };
}

/** Linhas de alinhamento (%) a partir de outras zonas + bordas do canvas. */
export function collectGuideLines(
  zones: { zoneId: string; frame: LayoutZoneFrame }[],
  excludeZoneId?: string
): number[] {
  const lines = new Set<number>([0, 25, 50, 75, 100]);
  for (const z of zones) {
    if (z.zoneId === excludeZoneId) continue;
    const f = z.frame;
    lines.add(f.x);
    lines.add(f.y);
    lines.add(f.x + f.w);
    lines.add(f.y + f.h);
  }
  return [...lines].sort((a, b) => a - b);
}

export function snapScalar(
  value: number,
  guides: number[],
  step = LAYOUT_GRID_STEP,
  threshold = LAYOUT_SNAP_THRESHOLD
): number {
  let best = snapPercent(value, step);
  let bestDist = threshold + 1;
  for (const g of guides) {
    const d = Math.abs(value - g);
    if (d <= threshold && d < bestDist) {
      bestDist = d;
      best = g;
    }
  }
  return Math.max(0, Math.min(100, best));
}

export function snapFrame(
  frame: LayoutZoneFrame,
  guides: number[]
): LayoutZoneFrame {
  const x2 = frame.x + frame.w;
  const y2 = frame.y + frame.h;
  let x = snapScalar(frame.x, guides);
  let y = snapScalar(frame.y, guides);
  let xEnd = snapScalar(x2, guides);
  let yEnd = snapScalar(y2, guides);
  let w = Math.max(1, xEnd - x);
  let h = Math.max(1, yEnd - y);
  if (x + w > 100) w = 100 - x;
  if (y + h > 100) h = 100 - y;
  return clampFrame({ x, y, w, h, unit: 'percent' });
}

export function framesEqual(a: LayoutZoneFrame, b: LayoutZoneFrame): boolean {
  return a.x === b.x && a.y === b.y && a.w === b.w && a.h === b.h;
}

export function canvasAspectRatio(width: number, height: number, orientation: string): number {
  if (orientation === 'portrait' || orientation === 'portrait_flipped') {
    return Math.min(width, height) / Math.max(width, height);
  }
  return Math.max(width, height) / Math.min(width, height);
}
