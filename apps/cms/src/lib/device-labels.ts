/**
 * Rótulos humanos — enums da API → texto legível (§24).
 */

export type BadgeTone =
  | 'success'
  | 'danger'
  | 'warning'
  | 'info'
  | 'brand'
  | 'neutral';

export const PLATFORM_LABELS: Record<string, string> = {
  electron: 'Player Desktop',
  web: 'Navegador Web',
  android_browser: 'Android TV',
  tv_browser: 'Smart TV',
  unknown: 'Desconhecida',
};

export function platformLabel(v: string): string {
  return PLATFORM_LABELS[v] ?? v;
}

export const DEVICE_STATE: Record<string, { label: string; tone: BadgeTone }> = {
  active: { label: 'Ativo', tone: 'success' },
  provisioned: { label: 'Provisionado', tone: 'brand' },
  disabled: { label: 'Desativado', tone: 'neutral' },
};

export function deviceState(v: string): { label: string; tone: BadgeTone } {
  return DEVICE_STATE[v] ?? { label: v, tone: 'neutral' };
}

export const PUBLICATION_STATE: Record<string, { label: string; tone: BadgeTone }> = {
  draft: { label: 'Rascunho', tone: 'neutral' },
  scheduled: { label: 'Agendada', tone: 'brand' },
  publishing: { label: 'Publicando', tone: 'info' },
  active: { label: 'Ativa', tone: 'success' },
  paused: { label: 'Pausada', tone: 'warning' },
  failed: { label: 'Falhou', tone: 'danger' },
  archived: { label: 'Arquivada', tone: 'neutral' },
};

export function publicationState(v: string): { label: string; tone: BadgeTone } {
  return PUBLICATION_STATE[v] ?? { label: v, tone: 'neutral' };
}

export const PLAYLIST_STATUS: Record<string, string> = {
  draft: 'Rascunho',
  published: 'Publicada',
};

export function playlistStatus(v: string): string {
  return PLAYLIST_STATUS[v] ?? v;
}

export const PLATFORM_OPTIONS = Object.entries(PLATFORM_LABELS).filter(
  ([key]) => key !== 'unknown'
);

export const DISPLAY_ORIENTATION_LABELS: Record<string, string> = {
  landscape: 'Paisagem (0°)',
  portrait: 'Retrato (90°)',
  landscape_flipped: 'Paisagem invertida (180°)',
  portrait_flipped: 'Retrato invertido (270°)',
};

export function displayOrientationLabel(v: string): string {
  return DISPLAY_ORIENTATION_LABELS[v] ?? v;
}
