/**
 * Datas formatadas de forma idêntica no SSR e no browser (evita erro React #418).
 */
export function formatDateTimePtBr(iso: string | number | Date | null | undefined): string {
  if (iso == null || iso === '') return '—';
  const d = iso instanceof Date ? iso : new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}
