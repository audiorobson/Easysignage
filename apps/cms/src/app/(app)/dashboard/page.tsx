'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  MonitorPlay,
  Wifi,
  WifiOff,
  TriangleAlert,
  ArrowUpRight,
  ArrowDownRight,
  ListVideo,
  RefreshCw,
  HardDrive,
  Clock,
} from 'lucide-react';
import { StatusPill } from '@/components/ui/StatusPill';
import { PageHeader } from '@/components/ui/PageHeader';
import { api, getToken } from '@/lib/api';
import {
  buildDashboardFromOverview,
  type DashboardData,
  type OverviewRow,
} from '@/lib/dashboard-overview';
import type { BadgeTone } from '@/lib/device-labels';

const DEMO_UPTIME = [
  99.2, 99.4, 98.9, 99.6, 99.8, 99.1, 98.4, 97.9, 98.6, 99.2, 99.7, 99.9, 99.5,
  99.3, 98.8, 99.0, 99.4, 99.6, 99.2, 98.7, 99.1, 99.5, 99.8, 99.6,
];

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
  success: ['#ecfdf5', '#047857'],
  danger: ['#fef2f2', '#dc2626'],
  warning: ['#fffbeb', '#b45309'],
  info: ['#f0f9ff', '#0369a1'],
  brand: ['#f5f3ff', '#6d28d9'],
  neutral: ['#f1f5f9', '#64748b'],
};

function buildChart(pts: number[]) {
  const W = 560;
  const H = 180;
  const mn = 97;
  const mx = 100;
  const x = (i: number) => i * (W / (pts.length - 1));
  const y = (v: number) => H - ((v - mn) / (mx - mn)) * H + 8;
  let d = `M0 ${y(pts[0]).toFixed(1)}`;
  pts.forEach((v, i) => {
    if (i > 0) d += ` L${x(i).toFixed(1)} ${y(v).toFixed(1)}`;
  });
  return { line: d, area: `${d} L${W} ${H + 8} L0 ${H + 8} Z` };
}

function buildDonut(seg: { val: number }[]) {
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

export default function DashboardPage() {
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!getToken()) {
      router.replace('/login');
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const rows = await api<OverviewRow[]>('/monitoring/overview');
        if (!cancelled) setData(buildDashboardFromOverview(rows));
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Erro ao carregar dados');
          setData(buildDashboardFromOverview([]));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  const chart = buildChart(DEMO_UPTIME);
  const dash = data ?? buildDashboardFromOverview([]);
  const donutPaths = buildDonut(dash.donut);

  return (
    <>
      <PageHeader
        title="Visão geral da rede"
        lead="Estado dos players, disponibilidade e conteúdo em reprodução (dados em tempo quase real)."
        actions={
          <>
            <Link href="/monitoring" className="btn btn--secondary">
              Monitorização
            </Link>
            <Link href="/playlists" className="btn btn--primary">
              Publicar conteúdo
            </Link>
          </>
        }
      />

      {error && <p className="text-danger">{error}</p>}
      {loading && <p className="text-muted">A carregar métricas…</p>}

      <div className="dash-kpis">
        {dash.kpis.map((k) => {
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
                <span
                  className="kpi-card__icon"
                  style={{ background: bg, color }}
                >
                  {KPI_ICON[k.icon]}
                </span>
                <span className="kpi-card__trend" style={trendStyle}>
                  {up && <ArrowUpRight size={12} strokeWidth={3} />}
                  {k.dir === 'down' && (
                    <ArrowDownRight size={12} strokeWidth={3} />
                  )}
                  {k.trend}
                </span>
              </div>
              <div className="kpi-card__value">{k.value}</div>
              <div className="kpi-card__label">{k.label}</div>
            </div>
          );
        })}
      </div>

      <div
        className="dash-grid dash-grid--wide"
        style={{ marginBottom: 'var(--space-5)' }}
      >
        <div className="panel">
          <div className="panel__head">
            <div>
              <h3 className="panel__title">Disponibilidade da rede</h3>
              <p className="text-muted" style={{ margin: '4px 0 0' }}>
                Histórico ilustrativo — telemetria agregada em breve
              </p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div
                style={{
                  fontSize: 26,
                  fontWeight: 800,
                  color: 'var(--color-success)',
                  letterSpacing: '-.02em',
                }}
              >
                {dash.onlinePct}%
              </div>
              <div className="text-muted" style={{ fontSize: 12 }}>
                online agora
              </div>
            </div>
          </div>
          <svg
            viewBox="0 0 560 200"
            style={{ width: '100%', height: 200, display: 'block' }}
            preserveAspectRatio="none"
          >
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
            <path
              d={chart.line}
              fill="none"
              stroke="#2563eb"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray="900"
              style={{ animation: 'dashDraw 1.4s ease forwards' }}
            />
          </svg>
        </div>

        <div className="panel">
          <h3 className="panel__title">Estado dos dispositivos</h3>
          <p className="text-muted" style={{ margin: '4px 0 0' }}>
            {dash.total} {dash.total === 1 ? 'player' : 'players'} totais
          </p>
          <div className="donut-wrap">
            <svg
              viewBox="0 0 130 130"
              style={{ width: 150, height: 150, transform: 'rotate(-90deg)' }}
            >
              <circle
                cx="65"
                cy="65"
                r="54"
                fill="none"
                stroke="#f1f5f9"
                strokeWidth="16"
              />
              {dash.donut.map((s, i) => (
                <circle
                  key={s.label}
                  cx="65"
                  cy="65"
                  r="54"
                  fill="none"
                  stroke={s.color}
                  strokeWidth="16"
                  strokeLinecap="round"
                  strokeDasharray={donutPaths[i]?.dash}
                  strokeDashoffset={donutPaths[i]?.off}
                />
              ))}
            </svg>
            <div className="donut-center">
              <span
                style={{
                  fontSize: 30,
                  fontWeight: 800,
                  letterSpacing: '-.03em',
                  lineHeight: 1,
                }}
              >
                {dash.onlinePct}%
              </span>
              <span
                className="text-muted"
                style={{ fontSize: 11, fontWeight: 600, marginTop: 2 }}
              >
                ONLINE
              </span>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {dash.donut.map((s) => (
              <div
                key={s.label}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  fontSize: 13,
                }}
              >
                <span
                  style={{
                    width: 9,
                    height: 9,
                    borderRadius: 3,
                    background: s.color,
                  }}
                />
                <span
                  style={{
                    color: 'var(--color-text-soft)',
                    fontWeight: 500,
                    flex: 1,
                  }}
                >
                  {s.label}
                </span>
                <span style={{ fontWeight: 700 }}>{s.val}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div
        className="dash-grid dash-grid--2"
        style={{ marginBottom: 'var(--space-5)' }}
      >
        <div className="panel">
          <div className="panel__head">
            <h3 className="panel__title">Alertas ativos</h3>
            <Link href="/monitoring" className="panel__link">
              Ver tudo →
            </Link>
          </div>
          {dash.alerts.length === 0 ? (
            <p className="text-muted" style={{ margin: 0 }}>
              Nenhum dispositivo em estado de atenção.
            </p>
          ) : (
            dash.alerts.map((a) => {
              const [bg, color] = LIST_ICON_BG[a.tone];
              return (
                <div className="list-row" key={`${a.title}-${a.meta}`}>
                  <span
                    className="list-row__icon"
                    style={{ background: bg, color }}
                  >
                    {LIST_ICON[a.icon]}
                  </span>
                  <div className="list-row__body">
                    <div className="list-row__title">{a.title}</div>
                    <div className="list-row__meta">{a.meta}</div>
                  </div>
                  <StatusPill label={a.sev} tone={a.tone} dot={false} />
                </div>
              );
            })
          )}
        </div>

        <div className="panel">
          <div className="panel__head">
            <h3 className="panel__title">Conteúdo em reprodução</h3>
            <Link href="/playlists" className="panel__link">
              Ver playlists →
            </Link>
          </div>
          {dash.publications.length === 0 ? (
            <p className="text-muted" style={{ margin: 0 }}>
              Nenhuma playlist reportada pela telemetria dos players.
            </p>
          ) : (
            dash.publications.map((p) => (
              <div className="list-row" key={p.name}>
                <span
                  className="list-row__icon"
                  style={{ background: '#eef3ff', color: '#2563eb' }}
                >
                  <ListVideo size={17} strokeWidth={2} />
                </span>
                <div className="list-row__body">
                  <div className="list-row__title">{p.name}</div>
                  <div className="list-row__meta">{p.meta}</div>
                </div>
                <StatusPill label={p.label} tone={p.tone} dot={false} />
              </div>
            ))
          )}
        </div>
      </div>

      <div className="panel">
        <h3 className="panel__title" style={{ marginBottom: 'var(--space-5)' }}>
          Distribuição por site
        </h3>
        {dash.sites.length === 0 ? (
          <p className="text-muted" style={{ margin: 0 }}>
            Adicione sites e dispositivos para ver a distribuição.
          </p>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '14px 40px',
            }}
          >
            {dash.sites.map((s) => {
              const pct =
                s.total > 0 ? Math.round((s.online / s.total) * 100) : 0;
              const color =
                pct >= 90 ? '#10b981' : pct >= 75 ? '#f59e0b' : '#ef4444';
              return (
                <div
                  key={s.name}
                  style={{ display: 'flex', alignItems: 'center', gap: 16 }}
                >
                  <span
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      width: 150,
                      flexShrink: 0,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {s.name}
                  </span>
                  <div className="meter">
                    <span style={{ width: `${pct}%`, background: color }} />
                  </div>
                  <span
                    className="text-muted"
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      width: 64,
                      textAlign: 'right',
                      flexShrink: 0,
                    }}
                  >
                    {s.online}/{s.total} on
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
