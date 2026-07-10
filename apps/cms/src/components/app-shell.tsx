'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  MonitorPlay,
  Activity,
  MapPin,
  FolderOpen,
  ListVideo,
  Grid2x2,
  LayoutGrid,
  CalendarDays,
  Users,
  Megaphone,
  TriangleAlert,
  Settings,
  Search,
  Bell,
  CircleHelp,
  type LucideIcon,
} from 'lucide-react';

type NavItem = { href: string; label: string; Icon: LucideIcon; soon?: boolean };

const NAV_OPERACAO: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', Icon: LayoutDashboard },
  { href: '/devices', label: 'Dispositivos', Icon: MonitorPlay },
  { href: '/video-walls', label: 'Video walls', Icon: Grid2x2 },
  { href: '/monitoring', label: 'Monitorização', Icon: Activity },
  { href: '/alerts', label: 'Alertas', Icon: TriangleAlert },
  { href: '/sites', label: 'Sites', Icon: MapPin },
];

const NAV_CONTEUDO: NavItem[] = [
  { href: '/assets', label: 'Biblioteca', Icon: FolderOpen },
  { href: '/playlists', label: 'Playlists', Icon: ListVideo },
  { href: '/layout-templates', label: 'Templates layout', Icon: LayoutGrid },
  { href: '/campaigns', label: 'Campanhas', Icon: Megaphone },
  { href: '/scheduling', label: 'Agendamento', Icon: CalendarDays },
  { href: '/groups', label: 'Grupos', Icon: Users },
];

const NAV_SISTEMA: NavItem[] = [
  { href: '/settings', label: 'Configurações', Icon: Settings, soon: true },
];

function isActive(href: string, pathname: string): boolean {
  if (href === '/dashboard') return pathname === '/dashboard';
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavLink({ href, label, Icon, soon }: NavItem) {
  const pathname = usePathname();
  const active = isActive(href, pathname);
  return (
    <Link
      href={href}
      className={soon ? 'app-nav-link app-nav-soon' : 'app-nav-link'}
      aria-current={active ? 'page' : undefined}
      title={soon ? 'Em desenvolvimento' : undefined}
    >
      <Icon strokeWidth={1.9} aria-hidden />
      {label}
    </Link>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  function logout() {
    sessionStorage.removeItem('access_token');
    router.push('/login');
  }

  return (
    <div className="app-shell">
      <aside className="app-sidebar">
        <div className="app-sidebar__brand">
          <span className="app-sidebar__brand-mark" aria-hidden>
            <MonitorPlay size={20} strokeWidth={2} />
          </span>
          <div>
            <div className="app-sidebar__brand-title">EasySignage</div>
            <div className="app-sidebar__brand-sub">Operador de rede</div>
          </div>
        </div>

        <nav className="app-sidebar__nav" aria-label="Principal">
          <span className="app-sidebar__section">Operação</span>
          {NAV_OPERACAO.map((n) => (
            <NavLink key={n.href} {...n} />
          ))}
          <span className="app-sidebar__section">Conteúdo</span>
          {NAV_CONTEUDO.map((n) => (
            <NavLink key={n.href} {...n} />
          ))}
          <span className="app-sidebar__section">Sistema</span>
          {NAV_SISTEMA.map((n) => (
            <NavLink key={n.href} {...n} />
          ))}
        </nav>

        <div style={{ flex: 1 }} />
        <div className="app-sidebar__user">
          <span className="app-sidebar__avatar" aria-hidden>
            ES
          </span>
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                fontSize: 13,
                fontWeight: 700,
                color: '#e8edf5',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              Sessão CMS
            </div>
            <div style={{ fontSize: 11, color: '#5b6b85' }}>Administrador</div>
          </div>
        </div>
      </aside>

      <div className="app-main">
        <header className="app-topbar">
          <div className="app-topbar__search-wrap">
            <Search size={17} strokeWidth={2} aria-hidden />
            <input
              type="search"
              className="app-topbar__search-input"
              placeholder="Pesquisar dispositivos, sites, playlists…"
              aria-label="Pesquisar no CMS"
            />
          </div>
          <div style={{ flex: 1 }} />
          <span className="app-topbar__status">
            <span className="dot" />
            Rede operacional
          </span>
          <button
            type="button"
            className="app-topbar__icon-btn"
            aria-label="Notificações"
            title="Em breve"
          >
            <Bell size={18} strokeWidth={1.9} aria-hidden />
            <span className="badge-dot" />
          </button>
          <button
            type="button"
            className="app-topbar__icon-btn"
            aria-label="Ajuda"
            title="Em breve"
          >
            <CircleHelp size={18} strokeWidth={1.9} aria-hidden />
          </button>
          <button
            type="button"
            className="btn btn--ghost"
            onClick={logout}
            style={{ marginLeft: 4 }}
          >
            Sair
          </button>
        </header>

        <div className="app-content">{children}</div>
      </div>
    </div>
  );
}
