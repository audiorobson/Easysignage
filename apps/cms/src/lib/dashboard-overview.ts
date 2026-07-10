import type { BadgeTone } from '@/lib/device-labels';

export type BorderStatus = 'online' | 'fault' | 'offline_long';

export type OverviewRow = {
  deviceId: string;
  name: string;
  platform: string;
  status: string;
  lastSeenAt: string | null;
  site: { id: string; name: string };
  borderStatus: BorderStatus;
  playback: {
    playlistId: string | null;
    playlistName: string | null;
    assetId: string | null;
    assetName: string | null;
  };
};

export type DashboardKpi = {
  key: string;
  value: string;
  label: string;
  icon: 'monitor' | 'wifi' | 'wifioff' | 'alert';
  tone: 'neutral' | 'success' | 'danger';
  trend: string;
  dir: 'up' | 'down' | 'flat';
};

export type DonutSegment = { label: string; val: number; color: string };

export type DashboardAlert = {
  title: string;
  meta: string;
  tone: BadgeTone;
  sev: string;
  icon: 'alert' | 'sync' | 'disk' | 'clock';
};

export type DashboardPublication = {
  name: string;
  meta: string;
  label: string;
  tone: BadgeTone;
};

export type SiteDistribution = {
  name: string;
  online: number;
  total: number;
};

export type DashboardData = {
  kpis: DashboardKpi[];
  donut: DonutSegment[];
  onlinePct: number;
  alerts: DashboardAlert[];
  publications: DashboardPublication[];
  sites: SiteDistribution[];
  total: number;
};

function pct(part: number, total: number): string {
  if (total <= 0) return '0%';
  return `${Math.round((part / total) * 100)}%`;
}

export function buildDashboardFromOverview(rows: OverviewRow[]): DashboardData {
  const total = rows.length;
  const online = rows.filter((r) => r.borderStatus === 'online').length;
  const fault = rows.filter((r) => r.borderStatus === 'fault').length;
  const offline = rows.filter((r) => r.borderStatus === 'offline_long').length;
  const onlinePct = total > 0 ? Math.round((online / total) * 100) : 0;

  const kpis: DashboardKpi[] = [
    {
      key: 'total',
      value: String(total),
      label: 'Telas totais',
      icon: 'monitor',
      tone: 'neutral',
      trend: total > 0 ? 'Inventário ativo' : 'Sem dispositivos',
      dir: 'flat',
    },
    {
      key: 'online',
      value: String(online),
      label: 'Online agora',
      icon: 'wifi',
      tone: 'success',
      trend: pct(online, total),
      dir: 'up',
    },
    {
      key: 'offline',
      value: String(offline),
      label: 'Offline prolongado',
      icon: 'wifioff',
      tone: 'neutral',
      trend: pct(offline, total),
      dir: offline > 0 ? 'down' : 'flat',
    },
    {
      key: 'alerts',
      value: String(fault),
      label: 'Em atenção / falha',
      icon: 'alert',
      tone: fault > 0 ? 'danger' : 'neutral',
      trend: fault > 0 ? 'Requer ação' : 'Sem alertas',
      dir: fault > 0 ? 'down' : 'flat',
    },
  ];

  const donut: DonutSegment[] = [
    { label: 'Online', val: online, color: '#10b981' },
    { label: 'Atenção', val: fault, color: '#f59e0b' },
    { label: 'Offline', val: offline, color: '#94a3b8' },
  ].filter((s) => s.val > 0 || total === 0);

  if (total === 0) {
    donut.push({ label: 'Sem dados', val: 1, color: '#e2e8f0' });
  }

  const alerts: DashboardAlert[] = rows
    .filter((r) => r.borderStatus === 'fault')
    .slice(0, 6)
    .map((r) => ({
      title: r.name,
      meta: `${r.site.name} · estado degradado`,
      tone: 'danger' as BadgeTone,
      sev: 'Atenção',
      icon: 'alert' as const,
    }));

  const playlistMap = new Map<string, { name: string; count: number }>();
  for (const r of rows) {
    const name = r.playback.playlistName;
    if (!name) continue;
    const cur = playlistMap.get(name) ?? { name, count: 0 };
    cur.count += 1;
    playlistMap.set(name, cur);
  }
  const publications: DashboardPublication[] = [...playlistMap.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)
    .map((p) => ({
      name: p.name,
      meta: `${p.count} ${p.count === 1 ? 'ecrã' : 'ecrãs'} em reprodução`,
      label: 'Em reprodução',
      tone: 'success' as BadgeTone,
    }));

  const siteMap = new Map<string, { name: string; online: number; total: number }>();
  for (const r of rows) {
    const key = r.site.id;
    const cur = siteMap.get(key) ?? {
      name: r.site.name,
      online: 0,
      total: 0,
    };
    cur.total += 1;
    if (r.borderStatus === 'online') cur.online += 1;
    siteMap.set(key, cur);
  }
  const sites = [...siteMap.values()].sort((a, b) => b.total - a.total);

  return {
    kpis,
    donut,
    onlinePct,
    alerts,
    publications,
    sites,
    total,
  };
}
