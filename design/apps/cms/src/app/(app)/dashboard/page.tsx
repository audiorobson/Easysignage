'use client';

/**
 * EasySignage — Dashboard operacional (Enterprise)
 * Substitui apps/cms/src/app/(app)/dashboard/page.tsx
 *
 * A "visão geral imediata" que faltava (§15.1): KPIs, disponibilidade,
 * estado dos players, alertas e publicações recentes.
 *
 * DADOS: hoje usa valores de demonstração. Para ligar à API real,
 * substitua o bloco `DEMO` por chamadas a:
 *   api('/monitoring/overview')  -> KPIs + donut
 *   api('/monitoring/alerts')    -> alertas
 *   api('/publications?recent')  -> publicações
 * (ver README §Monitorização). A UI já está pronta para receber os dados.
 */

import Link from 'next/link';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { MonitorPlay, Wifi, WifiOff, TriangleAlert, ArrowUpRight, ArrowDownRight, ListVideo, RefreshCw, HardDrive, Clock } from 'lucide-react';
import { StatusPill } from '@/components/ui/StatusPill';
import { getToken } from '@/lib/api';
import type { BadgeTone } from '@/lib/device-labels';

/* ---------------- DEMO (substituir por API) ---------------- */
const DEMO = {
  kpis: [
    { key: 'total', value: '128', label: 'Telas totais', icon: 'monitor', tone: 'neutral', trend: '+4 no mês', dir: 'flat' },
    { key: 'online', value: '119', label: 'Online agora', icon: 'wifi', tone: 'success', trend: '93%', dir: 'up' },
    { key: 'offline', value: '9', label: 'Offline', icon: 'wifioff', tone: 'neutral', trend: '7%', dir: 'down' },
    { key: 'alerts', value: '3', label: 'Alertas críticos', icon: 'alert', tone: 'danger', trend: '2 novos', dir: 'down' },
  ] as const,
  donut: [
    { label: 'Online', val: 112, color: '#10b981' },
    { label: 'Sincronizando', val: 9, color: '#2563eb' },
    { label: 'Atenção', val: 4, color: '#f59e0b' },
    { label: 'Offline', val: 3, color: '#94a3b8' },
  ],
  uptime: [99.2, 99.4, 98.9, 99.6, 99.8, 99.1, 98.4, 97.9, 98.6, 99.2, 99.7, 99.9, 99.5, 99.3, 98.8, 99.0, 99.4, 99.6, 99.2, 98.7, 99.1, 99.5, 99.8, 99.6],
  alerts: [
    { title: 'Player sem resposta', meta: 'Loja Centro · Vitrine 2 · há 4 min', tone: 'danger' as BadgeTone, sev: 'Crítico', icon: 'alert' },
    { title: 'Falha ao sincronizar', meta: 'Aeroporto T1 · Portão 12 · há 18 min', tone: 'danger' as BadgeTone, sev: 'Crítico', icon: 'sync' },
    { title: 'Armazenamento em 88%', meta: 'Shopping Norte · Praça · há 1 h', tone: 'warning' as BadgeTone, sev: 'Atenção', icon: 'disk' },
    { title: 'Runtime desatualizado', meta: 'Sede · Recepção · há 3 h', tone: 'info' as BadgeTone, sev: 'Info', icon: 'clock' },
  ],
  publications: [
    { name: 'Campanha Verão 2026', meta: '42 telas · há 8 min', label: 'Ativa', tone: 'success' as BadgeTone },
    { name: 'Menu Digital · Cafeteria', meta: 'Grupo Food Court · há 26 min', label: 'Publicando', tone: 'info' as BadgeTone },
    { name: 'Institucional Q3', meta: '12 telas · há 2 h', label: 'Agendada', tone: 'brand' as BadgeTone },
    { name: 'Promoção Relâmpago', meta: '8 telas · há 5 h', label: 'Falhou', tone: 'danger' as BadgeTone },
  ],
  sites: [
    { name: 'Shopping Norte', online: 38, total: 40 },
    { name: 'Aeroporto T1', online: 22, total: 24 },
    { name: 'Loja Centro', online: 14, total: 18 },
    { name: 'Sede Corporativa', online: 16, total: 16 },
    { name: 'Filial Sul', online: 19, total: 20 },
    { name: 'Outlet Premium', online: 10, total: 10 },
  ],
};

const KPI_ICON: Record<string, React.ReactNode> = {
  monitor: <MonitorPlay size={20} strokeWidth={1.9} />,
  wifi: <Wifi size={20} strokeWidth={1.9} />,
  wifioff: <WifiOff size={20} strokeWidth={1.9} />,
  alert: <TriangleAlert size={20} strokeWidth={1.9} />,
};
const KPI_ICON_BG: Record<string, [string, string]> = {
  neutral: ['#eef3ff', '#2563eb'],
  success: ['#ecfdf5', '#059669'],
  danger: ['#fef2f2', '#dc2626'],
};
const LIST_ICON: Record<string, React.ReactNode> = {
  alert: <TriangleAlert size={17} strokeWidth={2} />,
  sync: <RefreshCw size={17} strokeWidth={2} />,
  disk: <HardDrive size={17} strokeWidth={2} />,
  clock: <Clock size={17} strokeWidth={2} />,
};
const LIST_ICON_BG: Record<BadgeTone, [string, string]> = {
  success: ['#ecfdf5', '#047857'], danger: ['#fef2f2', '#dc2626'], warning: ['#fffbeb', '#b45309'],
  info: ['#f0f9ff', '#0369a1'], brand: ['#f5f3ff', '#6d28d9'], neutral: ['#f1f5f9', '#64748b'],
};

function buildChart(pts: number[]) {
  const W = 560, H = 180, mn = 97, mx = 100;
  const x = (i: number) => i * (W / (pts.length - 1));
  const y = (v: number) => H - ((v - mn) / (mx - mn)) * H + 8;
  let d = `M0 ${y(pts[0]).toFixed(1)}`;
  pts.forEach((v, i) => { if (i > 0) d += ` L${x(i).toFixed(1)} ${y(v).toFixed(1)}`; });
  return { line: d, area: `${d} L${W} ${H + 8} L0 ${H + 8} Z` };
}

function buildDonut(seg: { val: number }[]) {
  const total = seg.reduce((a, b) => a + b.val, 0);
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

export default function DashboardPage() {
  const router = useRouter();
  useEffect(() => { if (!getToken()) router.replace('/login'); }, [router]);

  const chart = buildChart(DEMO.uptime);
  const donut = buildDonut(DEMO.donut);

  return (
    <>
      <header className="page-header">
        <div>
          <h1>Visão geral da rede</h1>
          <p className="page-header__lead">
            Estado dos players, disponibilidade e publicações em tempo quase real.
          </p>
        </div>
        <div className="page-header__actions">
          <div className="filter-pills">
            <button className="is-active">24h</button>
            <button>7d</button>
            <button>30d</button>
          </div>
          <Link href="/playlists" className="btn btn--primary">Publicar conteúdo</Link>
        </div>
      </header>

      {/* KPIs */}
      <div className="dash-kpis">
        {DEMO.kpis.map((k) => {
          const [bg, color] = KPI_ICON_BG[k.tone] ?? KPI_ICON_BG.neutral;
          const up = k.dir === 'up';
          const trendStyle = up
            ? { color: '#047857', background: '#ecfdf5' }
            : k.dir === 'down'
            ? { color: '#b45309', background: '#fffbeb' }
            : { color: '#64748b', background: '#f1f5f9' };
          return (
            <div className="kpi-card" key={k.key}>
              <div className="kpi-card__top">
                <span className="kpi-card__icon" style={{ background: bg, color }}>{KPI_ICON[k.icon]}</span>
                <span className="kpi-card__trend" style={trendStyle}>
                  {up && <ArrowUpRight size={12} strokeWidth={3} />}
                  {k.dir === 'down' && <ArrowDownRight size={12} strokeWidth={3} />}
                  {k.trend}
                </span>
              </div>
              <div className="kpi-card__value">{k.value}</div>
              <div className="kpi-card__label">{k.label}</div>
            </div>
          );
        })}
      </div>

      {/* Uptime + Donut */}
      <div className="dash-grid dash-grid--wide" style={{ marginBottom: 'var(--space-5)' }}>
        <div className="panel">
          <div className="panel__head">
            <div>
              <h3 className="panel__title">Disponibilidade da rede</h3>
              <p className="text-muted" style={{ margin: '4px 0 0' }}>Média das últimas 24 horas</p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--color-success)', letterSpacing: '-.02em' }}>99,3%</div>
              <div className="text-muted" style={{ fontSize: 12 }}>SLA alvo 99,0%</div>
            </div>
          </div>
          <svg viewBox="0 0 560 200" style={{ width: '100%', height: 200, display: 'block' }} preserveAspectRatio="none">
            <defs>
              <linearGradient id="up" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#2563eb" stopOpacity="0.16" />
                <stop offset="1" stopColor="#2563eb" stopOpacity="0" />
              </linearGradient>
            </defs>
            <line x1="0" y1="60" x2="560" y2="60" stroke="#eef2f7" />
            <line x1="0" y1="120" x2="560" y2="120" stroke="#eef2f7" />
            <line x1="0" y1="180" x2="560" y2="180" stroke="#eef2f7" />
            <path d={chart.area} fill="url(#up)" />
            <path d={chart.line} fill="none" stroke="#2563eb" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
              strokeDasharray="900" style={{ animation: 'dashDraw 1.4s ease forwards' }} />
          </svg>
        </div>

        <div className="panel">
          <h3 className="panel__title">Estado dos dispositivos</h3>
          <p className="text-muted" style={{ margin: '4px 0 0' }}>128 players totais</p>
          <div className="donut-wrap">
            <svg viewBox="0 0 130 130" style={{ width: 150, height: 150, transform: 'rotate(-90deg)' }}>
              <circle cx="65" cy="65" r="54" fill="none" stroke="#f1f5f9" strokeWidth="16" />
              {DEMO.donut.map((s, i) => (
                <circle key={s.label} cx="65" cy="65" r="54" fill="none" stroke={s.color} strokeWidth="16"
                  strokeLinecap="round" strokeDasharray={donut[i].dash} strokeDashoffset={donut[i].off} />
              ))}
            </svg>
            <div className="donut-center">
              <span style={{ fontSize: 30, fontWeight: 800, letterSpacing: '-.03em', lineHeight: 1 }}>93%</span>
              <span className="text-muted" style={{ fontSize: 11, fontWeight: 600, marginTop: 2 }}>ONLINE</span>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {DEMO.donut.map((s) => (
              <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13 }}>
                <span style={{ width: 9, height: 9, borderRadius: 3, background: s.color }} />
                <span style={{ color: 'var(--color-text-soft)', fontWeight: 500, flex: 1 }}>{s.label}</span>
                <span style={{ fontWeight: 700 }}>{s.val}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Alertas + Publicações */}
      <div className="dash-grid dash-grid--2" style={{ marginBottom: 'var(--space-5)' }}>
        <div className="panel">
          <div className="panel__head">
            <h3 className="panel__title">Alertas ativos</h3>
            <Link href="/monitoring" className="panel__link">Ver tudo →</Link>
          </div>
          {DEMO.alerts.map((a) => {
            const [bg, color] = LIST_ICON_BG[a.tone];
            return (
              <div className="list-row" key={a.title}>
                <span className="list-row__icon" style={{ background: bg, color }}>{LIST_ICON[a.icon]}</span>
                <div className="list-row__body">
                  <div className="list-row__title">{a.title}</div>
                  <div className="list-row__meta">{a.meta}</div>
                </div>
                <StatusPill label={a.sev} tone={a.tone} dot={false} />
              </div>
            );
          })}
        </div>

        <div className="panel">
          <div className="panel__head">
            <h3 className="panel__title">Publicações recentes</h3>
            <Link href="/playlists" className="panel__link">Ver tudo →</Link>
          </div>
          {DEMO.publications.map((p) => (
            <div className="list-row" key={p.name}>
              <span className="list-row__icon" style={{ background: '#eef3ff', color: '#2563eb' }}>
                <ListVideo size={17} strokeWidth={2} />
              </span>
              <div className="list-row__body">
                <div className="list-row__title">{p.name}</div>
                <div className="list-row__meta">{p.meta}</div>
              </div>
              <StatusPill label={p.label} tone={p.tone} dot={false} />
            </div>
          ))}
        </div>
      </div>

      {/* Distribuição por site */}
      <div className="panel">
        <h3 className="panel__title" style={{ marginBottom: 'var(--space-5)' }}>Distribuição por site</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px 40px' }}>
          {DEMO.sites.map((s) => {
            const pct = Math.round((s.online / s.total) * 100);
            const color = pct >= 90 ? '#10b981' : pct >= 75 ? '#f59e0b' : '#ef4444';
            return (
              <div key={s.name} style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <span style={{ fontSize: 13, fontWeight: 600, width: 150, flexShrink: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.name}</span>
                <div className="meter"><span style={{ width: `${pct}%`, background: color }} /></div>
                <span className="text-muted" style={{ fontSize: 12, fontWeight: 600, width: 64, textAlign: 'right', flexShrink: 0 }}>{s.online}/{s.total} on</span>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
