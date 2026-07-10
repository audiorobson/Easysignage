/**
 * EasySignage — Rótulos humanos (§24: linguagem clara, sem jargão)
 * Novo ficheiro: apps/cms/src/lib/device-labels.ts
 *
 * Converte os enums crus da API (electron, android_browser, provisioned…)
 * em texto legível e num "tom" de badge semântico.
 */

export type BadgeTone = 'success' | 'danger' | 'warning' | 'info' | 'brand' | 'neutral';

/* Plataforma */
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

/* Estado cadastral do dispositivo */
export const DEVICE_STATE: Record<string, { label: string; tone: BadgeTone }> = {
  active: { label: 'Ativo', tone: 'success' },
  provisioned: { label: 'Provisionado', tone: 'brand' },
  disabled: { label: 'Desativado', tone: 'neutral' },
};

export function deviceState(v: string): { label: string; tone: BadgeTone } {
  return DEVICE_STATE[v] ?? { label: v, tone: 'neutral' };
}

/* Estado de publicação */
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
