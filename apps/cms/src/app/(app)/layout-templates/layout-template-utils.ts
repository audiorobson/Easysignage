import {
  validateLayoutTemplateZones,
  type LayoutTemplateZone,
} from '@easysignage/shared-types';

export type LayoutTemplateRow = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  zonesJson: LayoutTemplateZone[];
  sortOrder: number;
  tenantId: string | null;
  isSystem: boolean;
  createdAt: string;
  updatedAt: string;
};

export const EXAMPLE_ZONES_JSON = `[
  {
    "zoneId": "main",
    "label": "Principal",
    "frame": { "x": 0, "y": 0, "w": 70, "h": 100, "unit": "percent" }
  },
  {
    "zoneId": "side",
    "label": "Lateral",
    "frame": { "x": 70, "y": 0, "w": 30, "h": 100, "unit": "percent" }
  }
]`;

export function parseZonesJsonText(text: string): {
  ok: true;
  zones: LayoutTemplateZone[];
} | {
  ok: false;
  message: string;
} {
  const trimmed = text.trim();
  if (!trimmed) {
    return { ok: false, message: 'JSON de zonas vazio' };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed) as unknown;
  } catch {
    return { ok: false, message: 'JSON inválido — verifique vírgulas e aspas' };
  }
  const result = validateLayoutTemplateZones(parsed);
  if (!result.ok) return result;
  return { ok: true, zones: result.zones };
}

export function slugifyTemplateName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40) || 'template_custom';
}
