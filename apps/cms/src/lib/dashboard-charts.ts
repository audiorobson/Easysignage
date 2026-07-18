/**
 * PR 5.17 — funções puras de construção de gráficos do dashboard, extraídas
 * de `dashboard/page.tsx` para serem testáveis sem montar componentes React.
 */

export type UptimeHistoryPoint = {
  date: string;
  onlinePct: number;
};

/** Converte a resposta de `GET /monitoring/uptime-history` na série de pontos usada pelo gráfico. */
export function uptimeSeriesFromHistory(history: UptimeHistoryPoint[]): number[] {
  return history.map((p) => p.onlinePct);
}

export type ChartPaths = { line: string; area: string };

/** Constrói o `path` SVG (linha + área) do gráfico de disponibilidade. Espelha o layout fixo `560x180` usado no dashboard. */
export function buildChart(pts: number[]): ChartPaths {
  const W = 560;
  const H = 180;
  const mn = 0;
  const mx = 100;
  if (pts.length === 0) {
    return { line: `M0 ${H}`, area: `M0 ${H} L${W} ${H} Z` };
  }
  if (pts.length === 1) {
    const y = H - ((pts[0] - mn) / (mx - mn)) * H + 8;
    const d = `M0 ${y.toFixed(1)} L${W} ${y.toFixed(1)}`;
    return { line: d, area: `${d} L${W} ${H + 8} L0 ${H + 8} Z` };
  }
  const x = (i: number) => i * (W / (pts.length - 1));
  const y = (v: number) => H - ((v - mn) / (mx - mn)) * H + 8;
  let d = `M0 ${y(pts[0]).toFixed(1)}`;
  pts.forEach((v, i) => {
    if (i > 0) d += ` L${x(i).toFixed(1)} ${y(v).toFixed(1)}`;
  });
  return { line: d, area: `${d} L${W} ${H + 8} L0 ${H + 8} Z` };
}

export type DonutPath = { dash: string; off: string };

/** Distribui segmentos (`{ val }`) num anel SVG via `strokeDasharray`/`strokeDashoffset`. */
export function buildDonut(seg: { val: number }[]): DonutPath[] {
  const total = seg.reduce((a, b) => a + b.val, 0) || 1;
  const circ = 2 * Math.PI * 54;
  let acc = 0;
  return seg.map((s) => {
    const frac = s.val / total;
    const dash = `${(frac * circ).toFixed(2)} ${circ.toFixed(2)}`;
    const off = (-acc * circ).toFixed(2);
    acc += frac;
    return { dash, off };
  });
}
