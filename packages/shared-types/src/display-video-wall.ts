/** Video wall — tile crop e sync (Fase L4). */

import type { DeviceViewport } from './display-viewport.js';
import type { ContentDisplay } from './content-fit.js';

export type WallTilePosition = {
  row: number;
  col: number;
  rows: number;
  cols: number;
};

export type VirtualCanvas = {
  width: number;
  height: number;
};

export type WallTileCrop = {
  x: number;
  y: number;
  w: number;
  h: number;
};

export type WallSync = {
  groupId: string;
  epochMs: number;
  toleranceMs: number;
};

export type WallTileSource =
  | { type: 'playlist'; playlistId: string }
  | { type: 'asset'; assetId: string; kind?: string };

/** Payload em `current_item_json` quando `type === "wall_tile"`. */
export type WallTileCurrentItem = {
  type: 'wall_tile';
  wallId: string;
  wallRevision: string;
  tile: WallTilePosition;
  viewport: DeviceViewport;
  virtualCanvas: VirtualCanvas;
  crop: WallTileCrop;
  source: WallTileSource;
  sync: WallSync;
  display?: ContentDisplay;
};

export function computeTileCrop(
  virtual: VirtualCanvas,
  rows: number,
  cols: number,
  row: number,
  col: number
): WallTileCrop {
  const tileW = Math.floor(virtual.width / cols);
  const tileH = Math.floor(virtual.height / rows);
  return {
    x: col * tileW,
    y: row * tileH,
    w: tileW,
    h: tileH,
  };
}

export function isWallTileCurrentItem(v: unknown): v is WallTileCurrentItem {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return false;
  const o = v as Record<string, unknown>;
  return o.type === 'wall_tile' && typeof o.wallId === 'string';
}

export function wallTileMediaTransform(
  crop: WallTileCrop,
  virtual: VirtualCanvas,
  viewport: DeviceViewport
): { scale: number; offsetX: number; offsetY: number } {
  const scale = Math.min(viewport.width / crop.w, viewport.height / crop.h);
  return {
    scale,
    offsetX: -crop.x * scale,
    offsetY: -crop.y * scale,
  };
}
