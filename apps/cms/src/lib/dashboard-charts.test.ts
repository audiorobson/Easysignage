import { describe, expect, it } from 'vitest';
import { buildChart, buildDonut, uptimeSeriesFromHistory } from './dashboard-charts';

describe('uptimeSeriesFromHistory', () => {
  it('extrai apenas os valores onlinePct, preservando a ordem', () => {
    const history = [
      { date: '2026-07-16', onlinePct: 50 },
      { date: '2026-07-17', onlinePct: 75.5 },
      { date: '2026-07-18', onlinePct: 100 },
    ];
    expect(uptimeSeriesFromHistory(history)).toEqual([50, 75.5, 100]);
  });

  it('devolve array vazio para histórico vazio', () => {
    expect(uptimeSeriesFromHistory([])).toEqual([]);
  });
});

describe('buildChart', () => {
  it('gera um path plano no fundo do gráfico quando não há pontos', () => {
    expect(buildChart([])).toEqual({ line: 'M0 180', area: 'M0 180 L560 180 Z' });
  });

  it('gera uma linha horizontal reta com um único ponto', () => {
    const { line, area } = buildChart([100]);
    expect(line).toBe('M0 8.0 L560 8.0');
    expect(area).toBe('M0 8.0 L560 8.0 L560 188 L0 188 Z');
  });

  it('snapshot: série real de 5 dias produz o path SVG esperado', () => {
    const { line, area } = buildChart([0, 25, 50, 75, 100]);
    expect(line).toMatchInlineSnapshot(
      `"M0 188.0 L140.0 143.0 L280.0 98.0 L420.0 53.0 L560.0 8.0"`
    );
    expect(area).toMatchInlineSnapshot(
      `"M0 188.0 L140.0 143.0 L280.0 98.0 L420.0 53.0 L560.0 8.0 L560 188 L0 188 Z"`
    );
  });

  it('0% fica no fundo (y=188) e 100% no topo (y=8) — mn/mx fixos em 0/100', () => {
    const { line } = buildChart([0, 100]);
    expect(line).toBe('M0 188.0 L560.0 8.0');
  });
});

describe('buildDonut', () => {
  it('distribui segmentos proporcionalmente à circunferência', () => {
    const paths = buildDonut([{ val: 3 }, { val: 1 }]);
    expect(paths).toHaveLength(2);
    const circ = 2 * Math.PI * 54;
    // 3/4 do círculo para o primeiro segmento, começando no offset 0
    expect(paths[0]).toEqual({ dash: `${(0.75 * circ).toFixed(2)} ${circ.toFixed(2)}`, off: '0.00' });
    // segundo segmento (1/4) começa depois de 75% da circunferência já percorrida
    expect(paths[1]).toEqual({
      dash: `${(0.25 * circ).toFixed(2)} ${circ.toFixed(2)}`,
      off: (-0.75 * circ).toFixed(2),
    });
  });

  it('evita divisão por zero quando todos os valores são 0', () => {
    const paths = buildDonut([{ val: 0 }, { val: 0 }]);
    expect(paths[0].dash).toBe('0.00 339.29');
    expect(paths[1].dash).toBe('0.00 339.29');
  });
});
