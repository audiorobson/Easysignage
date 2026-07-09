'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

const NAV_MAIN: { href: string; label: string; icon: string }[] = [
  { href: '/dashboard', label: 'Dashboard', icon: 'fa-gauge-high' },
  { href: '/devices', label: 'Devices', icon: 'fa-network-wired' },
  { href: '/sites', label: 'Sites', icon: 'fa-location-dot' },
  { href: '/assets', label: 'Assets', icon: 'fa-folder-open' },
  { href: '/playlists', label: 'Playlists', icon: 'fa-list' },
  { href: '/groups', label: 'Grupos', icon: 'fa-users' },
  { href: '/scheduling', label: 'Agendamento', icon: 'fa-calendar-days' },
  { href: '/monitoring', label: 'Monitorização', icon: 'fa-chart-line' },
];

const NAV_SOON: { href: string; label: string; icon: string }[] = [
  { href: '/campaigns', label: 'Campaigns', icon: 'fa-bullhorn' },
  { href: '/alerts', label: 'Alerts', icon: 'fa-triangle-exclamation' },
  { href: '/settings', label: 'Settings', icon: 'fa-gear' },
];

function navIsActive(href: string, pathname: string): boolean {
  if (href === '/dashboard') return pathname === '/dashboard';
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
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
            <i className="fa-solid fa-table-cells-large" />
          </span>
          <div className="app-sidebar__brand-text">
            <span className="app-sidebar__brand-title">EasySignage</span>
            <span className="app-sidebar__brand-sub">Operador de rede</span>
          </div>
        </div>
        <nav className="app-sidebar__nav" aria-label="Principal">
          {NAV_MAIN.map(({ href, label, icon }) => {
            const active = navIsActive(href, pathname);
            return (
              <Link
                key={href}
                href={href}
                className="app-nav-link"
                aria-current={active ? 'page' : undefined}
              >
                <i
                  className={`fa-solid ${icon} app-nav-link__icon`}
                  aria-hidden
                />
                {label}
              </Link>
            );
          })}
          <div className="app-sidebar__divider" aria-hidden />
          {NAV_SOON.map(({ href, label, icon }) => {
            const active = navIsActive(href, pathname);
            return (
              <Link
                key={href}
                href={href}
                className="app-nav-soon"
                aria-current={active ? 'page' : undefined}
                title="Em desenvolvimento"
              >
                <i className={`fa-solid ${icon}`} aria-hidden />
                {label}
              </Link>
            );
          })}
        </nav>
      </aside>
      <div className="app-main">
        <header className="app-topbar">
          <div className="app-topbar__search-wrap">
            <i className="fa-solid fa-magnifying-glass" aria-hidden />
            <input
              type="search"
              className="app-topbar__search-input"
              placeholder="Pesquisar no CMS…"
              aria-label="Pesquisar no CMS"
            />
          </div>
          <div className="app-topbar__actions">
            <button
              type="button"
              className="app-topbar__icon-btn"
              aria-label="Notificações"
              title="Em breve"
              onClick={() => undefined}
            >
              <i className="fa-solid fa-bell" aria-hidden />
            </button>
            <button
              type="button"
              className="app-topbar__icon-btn"
              aria-label="Ajuda"
              title="Em breve"
              onClick={() => undefined}
            >
              <i className="fa-solid fa-circle-question" aria-hidden />
            </button>
            <div className="app-topbar__divider" aria-hidden />
            <div className="app-topbar__user">
              <div className="app-topbar__user-text">
                <span className="app-topbar__user-name">Sessão CMS</span>
                <span className="app-topbar__user-role">Administrador</span>
              </div>
              <span className="app-topbar__avatar" aria-hidden>
                ES
              </span>
              <button type="button" className="app-topbar__logout" onClick={logout}>
                Sair
              </button>
            </div>
          </div>
        </header>
        <div className="app-content">{children}</div>
      </div>
    </div>
  );
}
