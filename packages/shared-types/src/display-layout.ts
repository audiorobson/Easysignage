/** Layouts multi-zona (Fase L2 — layouts & video wall). */

import type { ContentDisplay } from './content-fit.js';
import type { DeviceViewport } from './display-viewport.js';

export type LayoutFrameUnit = 'percent';

export type LayoutZoneFrame = {
  x: number;
  y: number;
  w: number;
  h: number;
  unit: LayoutFrameUnit;
};

export type LayoutTemplateZone = {
  zoneId: string;
  label: string;
  frame: LayoutZoneFrame;
};

export type LayoutSource =
  | { type: 'playlist'; playlistId: string }
  | { type: 'asset'; assetId: string; kind?: string };

export type LayoutZoneBinding = {
  zoneId: string;
  source: LayoutSource | null;
  display?: ContentDisplay;
  /** Override de geometria (L5 — edição fina com snap). */
  frame?: LayoutZoneFrame;
};

export type LayoutZoneDisplay = ContentDisplay;

export type LayoutCurrentZone = {
  zoneId: string;
  frame: LayoutZoneFrame;
  source: LayoutSource;
  display?: LayoutZoneDisplay;
};

/** Payload em `current_item_json` quando `type === "layout"`. */
export type LayoutCurrentItem = {
  type: 'layout';
  layoutId: string;
  templateSlug: string;
  revision: string;
  viewport: DeviceViewport;
  zones: LayoutCurrentZone[];
};

export const SYSTEM_LAYOUT_TEMPLATES: ReadonlyArray<{
  slug: string;
  name: string;
  description: string;
  sortOrder: number;
  zones: LayoutTemplateZone[];
}> = [
  {
    slug: 'fullscreen',
    name: 'Ecrã completo',
    description: 'Uma zona a 100% — equivalente ao modo legado.',
    sortOrder: 0,
    zones: [
      { zoneId: 'main', label: 'Principal', frame: { x: 0, y: 0, w: 100, h: 100, unit: 'percent' } },
    ],
  },
  {
    slug: 'split_h_2',
    name: 'Dividido horizontal',
    description: 'Duas zonas lado a lado (50% + 50%).',
    sortOrder: 10,
    zones: [
      { zoneId: 'left', label: 'Esquerda', frame: { x: 0, y: 0, w: 50, h: 100, unit: 'percent' } },
      { zoneId: 'right', label: 'Direita', frame: { x: 50, y: 0, w: 50, h: 100, unit: 'percent' } },
    ],
  },
  {
    slug: 'split_v_2',
    name: 'Dividido vertical',
    description: 'Duas zonas empilhadas (50% + 50%).',
    sortOrder: 20,
    zones: [
      { zoneId: 'top', label: 'Topo', frame: { x: 0, y: 0, w: 100, h: 50, unit: 'percent' } },
      { zoneId: 'bottom', label: 'Base', frame: { x: 0, y: 50, w: 100, h: 50, unit: 'percent' } },
    ],
  },
  {
    slug: 'l_shape',
    name: 'Forma L',
    description: 'Zona principal 70% + faixa lateral 30%.',
    sortOrder: 30,
    zones: [
      { zoneId: 'main', label: 'Principal', frame: { x: 0, y: 0, w: 70, h: 100, unit: 'percent' } },
      { zoneId: 'side', label: 'Lateral', frame: { x: 70, y: 0, w: 30, h: 100, unit: 'percent' } },
    ],
  },
  {
    slug: 'grid_2x2',
    name: 'Grelha 2×2',
    description: 'Quatro zonas iguais.',
    sortOrder: 40,
    zones: [
      { zoneId: 'tl', label: 'Sup. esq.', frame: { x: 0, y: 0, w: 50, h: 50, unit: 'percent' } },
      { zoneId: 'tr', label: 'Sup. dir.', frame: { x: 50, y: 0, w: 50, h: 50, unit: 'percent' } },
      { zoneId: 'bl', label: 'Inf. esq.', frame: { x: 0, y: 50, w: 50, h: 50, unit: 'percent' } },
      { zoneId: 'br', label: 'Inf. dir.', frame: { x: 50, y: 50, w: 50, h: 50, unit: 'percent' } },
    ],
  },
  {
    slug: 'pip_br',
    name: 'Picture-in-picture',
    description: 'Principal 85% + inset no canto inferior direito.',
    sortOrder: 50,
    zones: [
      { zoneId: 'main', label: 'Principal', frame: { x: 0, y: 0, w: 100, h: 100, unit: 'percent' } },
      { zoneId: 'inset', label: 'Inset', frame: { x: 72, y: 72, w: 26, h: 26, unit: 'percent' } },
    ],
  },
  {
    slug: 'header_body',
    name: 'Cabeçalho + corpo',
    description: 'Faixa superior 15% + conteúdo 85%.',
    sortOrder: 60,
    zones: [
      { zoneId: 'header', label: 'Cabeçalho', frame: { x: 0, y: 0, w: 100, h: 15, unit: 'percent' } },
      { zoneId: 'body', label: 'Corpo', frame: { x: 0, y: 15, w: 100, h: 85, unit: 'percent' } },
    ],
  },
];

export function isLayoutCurrentItem(v: unknown): v is LayoutCurrentItem {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return false;
  const o = v as Record<string, unknown>;
  return o.type === 'layout' && typeof o.layoutId === 'string' && Array.isArray(o.zones);
}

export function layoutZoneStyle(frame: LayoutZoneFrame): Record<string, string> {
  return {
    left: `${frame.x}%`,
    top: `${frame.y}%`,
    width: `${frame.w}%`,
    height: `${frame.h}%`,
  };
}
