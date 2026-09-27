import { ReactNode, useEffect, useRef, useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import { LogOut, Menu } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../auth/auth-context';
import type { Campaign } from '../api/client';
import { Avatar } from './avatar';
import { Logo, LogoMark } from './brand/logo';
import { OfflineNotice } from './offline-notice';

/** How wide the page content may grow; it always starts at the sidebar. */
export type ContentWidth = 'narrow' | 'default' | 'full';

/** The page content column, left-aligned after the sidebar. */
export function PageFrame({
  width = 'default',
  children,
}: {
  width?: ContentWidth;
  children: ReactNode;
}) {
  return <div className={`page-frame page-frame-${width}`}>{children}</div>;
}

/**
 * The frame outside a campaign. CampaignWorkspaceShell uses the same sidebar
 * links and opens the same menu on narrow screens.
 */
export function AppShell({
  sidebar,
  sidebarLabel,
  width,
  children,
}: {
  sidebar?: ReactNode;
  sidebarLabel: string;
  width?: ContentWidth;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  const sidebarElement = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!menuOpen) return;
    sidebarElement.current?.querySelector<HTMLElement>('a, button')?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMenuOpen(false);
        menuButton.current?.focus();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [menuOpen]);
  useEffect(() => {
    const wide = window.matchMedia?.('(min-width: 1024px)');
    if (!wide) return;
    const closeMenu = () => setMenuOpen(false);
    wide.addEventListener('change', closeMenu);
    return () => wide.removeEventListener('change', closeMenu);
  }, []);
  return (
    <div className="campaign-workspace-shell app-shell">
      <button
        aria-controls="app-sidebar"
        aria-expanded={menuOpen}
        aria-label={t('workspace.menu')}
        className="sidebar-menu-button"
        onClick={() => setMenuOpen((open) => !open)}
        ref={menuButton}
        type="button"
      >
        <Menu aria-hidden="true" size={21} />
      </button>
      <aside
        className={`campaign-workspace-shell-sidebar${menuOpen ? ' campaign-workspace-shell-sidebar-open' : ''}`}
        id="app-sidebar"
        ref={sidebarElement}
        onClick={(event) => {
          if ((event.target as Element).closest('a')) setMenuOpen(false);
        }}
      >
        <SidebarLogo />
        <nav
          aria-label={sidebarLabel}
          className="campaign-workspace-shell-navigation"
        >
          <SidebarCampaignLinks />
          {sidebar}
          <SidebarProfileLink />
        </nav>
      </aside>
      {menuOpen && (
        <div
          aria-hidden="true"
          className="campaign-menu-backdrop"
          onClick={() => setMenuOpen(false)}
        />
      )}
      <main className="campaign-workspace-shell-content">
        <OfflineNotice />
        <PageFrame width={width}>{children}</PageFrame>
      </main>
    </div>
  );
}

export function SidebarLogo() {
  const { t } = useTranslation();
  return (
    <Link
      aria-label={t('workspace.backToCampaigns')}
      className="sidebar-logo-link"
      to="/campaigns"
    >
      <Logo className="sidebar-logo-full" />
      <LogoMark className="sidebar-logo-compact" />
    </Link>
  );
}

export function SidebarCampaignLinks() {
  const { t } = useTranslation();
  const { api } = useAuth();
  const campaigns = useQuery({
    queryKey: ['campaigns'],
    queryFn: () => api.request<Campaign[]>('/campaigns'),
  });
  const recent = [...(campaigns.data ?? [])]
    .filter((campaign) => campaign.lastVisitAt)
    .sort((a, b) => b.lastVisitAt!.localeCompare(a.lastVisitAt!))
    .slice(0, 5);
  return (
    <>
      {recent.length > 0 && (
        <>
          <SidebarGroup>{t('campaigns.recent')}</SidebarGroup>
          {recent.map((campaign) => (
            <SidebarLink
              key={campaign.campaignId}
              label={campaign.title}
              mark={campaign.title.trim().charAt(0).toUpperCase()}
              to={`/campaigns/${campaign.campaignId}`}
            />
          ))}
        </>
      )}
    </>
  );
}

export function SidebarProfileLink() {
  const { t } = useTranslation();
  const { profile, signOut } = useAuth();
  const accountName = profile?.name?.trim();
  const roleNames = ['OWNER', 'PLAYER', 'VIEWER'].map((role) =>
    t(`workspace.roles.${role}`),
  );
  const name = accountName && roleNames.includes(accountName)
    ? t('account.profile')
    : accountName || profile?.email || t('account.profile');
  return (
    <div className="sidebar-bottom">
      <NavLink
        className={({ isActive }) => isActive ? 'sidebar-profile active' : 'sidebar-profile'}
        to="/settings/account"
      >
        <Avatar alt="" imageUrl={profile?.avatarUrl} seed={name} size="small" />
        <span className="rail-label">{name}</span>
      </NavLink>
      <button
        aria-label={t('auth.signOut')}
        className="sidebar-signout"
        onClick={() => void signOut()}
        title={t('auth.signOut')}
        type="button"
      >
        <LogOut aria-hidden="true" size={17} />
      </button>
    </div>
  );
}

/** One sidebar entry; the same look in every variant of the sidebar. */
export function SidebarLink({
  to,
  label,
  icon: Icon,
  mark,
  end,
}: {
  to: string;
  label: string;
  icon?: LucideIcon;
  /** Shown instead of an icon, e.g. a campaign's initial. */
  mark?: string;
  end?: boolean;
}) {
  return (
    <NavLink
      className={({ isActive }) => (isActive ? 'active' : undefined)}
      end={end}
      to={to}
    >
      {Icon ? (
        <Icon aria-hidden="true" size={17} strokeWidth={1.8} />
      ) : (
        <span aria-hidden="true" className="sidebar-link-mark">
          {mark}
        </span>
      )}
      <span className="rail-label">{label}</span>
    </NavLink>
  );
}

/** A quiet group caption inside the sidebar. */
export function SidebarGroup({ children }: { children: ReactNode }) {
  return <span className="campaign-nav-group">{children}</span>;
}
