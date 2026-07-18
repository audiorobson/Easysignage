import { describe, expect, it } from 'vitest';
import { buildDashboardFromOverview, type OverviewRow } from './dashboard-overview';

function row(overrides: Partial<OverviewRow>): OverviewRow {
  return {
    deviceId: 'd1',
    name: 'Device 1',
    platform: 'web',
    status: 'active',
    lastSeenAt: null,
    site: { id: 's1', name: 'Site 1' },
    borderStatus: 'online',
    playback: { playlistId: null, playlistName: null, assetId: null, assetName: null },
    ...overrides,
  };
}

describe('buildDashboardFromOverview', () => {
  it('devolve estrutura vazia coerente quando não há devices', () => {
    const dash = buildDashboardFromOverview([]);
    expect(dash.total).toBe(0);
    expect(dash.onlinePct).toBe(0);
    expect(dash.donut).toEqual([
      { label: 'Online', val: 0, color: '#10b981' },
      { label: 'Atenção', val: 0, color: '#f59e0b' },
      { label: 'Offline', val: 0, color: '#94a3b8' },
      { label: 'Sem dados', val: 1, color: '#e2e8f0' },
    ]);
    expect(dash.alerts).toEqual([]);
    expect(dash.sites).toEqual([]);
  });

  it('agrega KPIs e onlinePct a partir do borderStatus de cada device', () => {
    const rows = [
      row({ deviceId: 'd1', borderStatus: 'online' }),
      row({ deviceId: 'd2', borderStatus: 'online' }),
      row({ deviceId: 'd3', borderStatus: 'fault' }),
      row({ deviceId: 'd4', borderStatus: 'offline_long' }),
    ];
    const dash = buildDashboardFromOverview(rows);

    expect(dash.total).toBe(4);
    expect(dash.onlinePct).toBe(50);
    expect(dash.kpis.find((k) => k.key === 'online')?.value).toBe('2');
    expect(dash.kpis.find((k) => k.key === 'offline')?.value).toBe('1');
    expect(dash.kpis.find((k) => k.key === 'alerts')?.value).toBe('1');
    expect(dash.donut).toEqual([
      { label: 'Online', val: 2, color: '#10b981' },
      { label: 'Atenção', val: 1, color: '#f59e0b' },
      { label: 'Offline', val: 1, color: '#94a3b8' },
    ]);
  });

  it('lista devices em fault como alertas (máximo 6)', () => {
    const rows = Array.from({ length: 8 }, (_, i) =>
      row({ deviceId: `d${i}`, name: `Device ${i}`, borderStatus: 'fault' })
    );
    const dash = buildDashboardFromOverview(rows);
    expect(dash.alerts).toHaveLength(6);
    expect(dash.alerts[0]).toMatchObject({ title: 'Device 0', tone: 'danger', sev: 'Atenção' });
  });

  it('agrupa publicações por nome de playlist, ordenado por contagem desc', () => {
    const rows = [
      row({ deviceId: 'd1', playback: { playlistId: 'p1', playlistName: 'Promoções', assetId: null, assetName: null } }),
      row({ deviceId: 'd2', playback: { playlistId: 'p1', playlistName: 'Promoções', assetId: null, assetName: null } }),
      row({ deviceId: 'd3', playback: { playlistId: 'p2', playlistName: 'Institucional', assetId: null, assetName: null } }),
    ];
    const dash = buildDashboardFromOverview(rows);
    expect(dash.publications[0]).toMatchObject({ name: 'Promoções', meta: '2 ecrãs em reprodução' });
    expect(dash.publications[1]).toMatchObject({ name: 'Institucional', meta: '1 ecrã em reprodução' });
  });

  it('agrega distribuição por site com contagem online/total', () => {
    const rows = [
      row({ deviceId: 'd1', site: { id: 's1', name: 'Loja A' }, borderStatus: 'online' }),
      row({ deviceId: 'd2', site: { id: 's1', name: 'Loja A' }, borderStatus: 'offline_long' }),
      row({ deviceId: 'd3', site: { id: 's2', name: 'Loja B' }, borderStatus: 'online' }),
    ];
    const dash = buildDashboardFromOverview(rows);
    const lojaA = dash.sites.find((s) => s.name === 'Loja A');
    const lojaB = dash.sites.find((s) => s.name === 'Loja B');
    expect(lojaA).toEqual({ name: 'Loja A', online: 1, total: 2 });
    expect(lojaB).toEqual({ name: 'Loja B', online: 1, total: 1 });
  });
});
