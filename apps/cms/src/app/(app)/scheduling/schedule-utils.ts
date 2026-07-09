/** 1 = segunda … 7 = domingo (ISO) */
export const ISO_DAY_OPTIONS = [
  { value: 1, short: 'Seg', label: 'Segunda' },
  { value: 2, short: 'Ter', label: 'Terça' },
  { value: 3, short: 'Qua', label: 'Quarta' },
  { value: 4, short: 'Qui', label: 'Quinta' },
  { value: 5, short: 'Sex', label: 'Sexta' },
  { value: 6, short: 'Sáb', label: 'Sábado' },
  { value: 7, short: 'Dom', label: 'Domingo' },
] as const;

export function isoDayLabel(day: number): string {
  return ISO_DAY_OPTIONS.find((d) => d.value === day)?.label ?? String(day);
}

export function isoDayShort(day: number): string {
  return ISO_DAY_OPTIONS.find((d) => d.value === day)?.short ?? '?';
}

/** Formata minutos desde meia-noite como HH:mm (fim exclusivo 1440 → 24:00). */
export function formatMinutes(m: number): string {
  if (m >= 1440) return '24:00';
  if (m <= 0) return '00:00';
  const h = Math.floor(m / 60);
  const mi = m % 60;
  return `${String(h).padStart(2, '0')}:${String(mi).padStart(2, '0')}`;
}

export function parseTimeToMin(s: string): number | null {
  const t = s.trim();
  const m = /^(\d{1,2}):(\d{2})$/.exec(t);
  if (!m) return null;
  const h = Number(m[1]);
  const mi = Number(m[2]);
  if (h < 0 || h > 23 || mi < 0 || mi > 59) return null;
  return h * 60 + mi;
}

/** Cor estável por id (playlist) */
export function colorForId(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h + id.charCodeAt(i) * 17) % 360;
  return `hsl(${h} 65% 42%)`;
}
