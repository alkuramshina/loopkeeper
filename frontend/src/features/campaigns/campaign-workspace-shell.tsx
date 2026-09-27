import { ReactNode, useEffect, useRef, useState } from 'react';
import { NavLink, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import {
  FileCheck2,
  FolderOpen,
  PencilLine,
  LayoutDashboard,
  Settings2,
  Users,
  UserRound,
  ChevronDown,
  Menu,
  Search,
} from 'lucide-react';
import { Campaign, GameSystem } from '../../api/client';
import { useAuth } from '../../auth/auth-context';
import { OfflineNotice } from '../../components/offline-notice';
import { mediaQueries, useMediaQuery } from '../../theme/breakpoints';
import { AccountMenu, AppTopbar } from '../../components/app-topbar';
import { useCampaignVisit } from './use-campaign-visit';
import { CampaignSearch } from './campaign-search';
import './new-since-visit.css';

type CampaignWorkspaceShellProps = {
  campaign?: Campaign;
  children: ReactNode;
};

export function CampaignWorkspaceShell({
  campaign,
  children,
}: CampaignWorkspaceShellProps) {
  const { api } = useAuth();
  useCampaignVisit(campaign);
  const { t } = useTranslation();
  const [searchOpen, setSearchOpen] = useState(false);
  // Between the phone and the laptop the sidebar slides out from a menu.
  const tablet = useMediaQuery(mediaQueries.tablet);
  const [menuOpen, setMenuOpen] = useState(false);
  // Leaving the range closes the menu, so it never comes back open.
  if (menuOpen && !tablet) setMenuOpen(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  const sidebar = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!menuOpen) return;
    sidebar.current?.querySelector<HTMLElement>('a, button')?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setMenuOpen(false);
      menuButton.current?.focus();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [menuOpen]);
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);
  const campaignTitle = campaign?.title;
  useEffect(() => {
    if (!campaignTitle) return;
    const appName = t('appName');
    document.title = `${campaignTitle} — ${appName}`;
    return () => {
      document.title = appName;
    };
  }, [campaignTitle, t]);
  const gameSystems = useQuery({
    queryKey: ['game-systems'],
    queryFn: () => api.request<GameSystem[]>('/game-systems'),
  });
  if (!campaign)
    return <main className="page-state">{t('common.loading')}</main>;

  const basePath = `/campaigns/${campaign.campaignId}`;
  const isOwner = campaign.currentUserRole === 'OWNER';
  const systemName =
    gameSystems.data?.find((system) => system.slug === campaign.system)?.name ||
    campaign.system ||
    t('campaigns.systemFallback');
  const primary = [
    {
      to: `${basePath}/board`,
      label: t('workspace.board'),
      icon: LayoutDashboard,
    },
    isOwner
      ? {
          to: `${basePath}/elements`,
          label: t('workspace.materials'),
          icon: FolderOpen,
        }
      : {
          to: `${basePath}/case`,
          label: t('workspace.case'),
          icon: FileCheck2,
        },
    // Only a player writes notes of their own.
    ...(campaign.currentUserRole === 'PLAYER'
      ? [
          {
            to: `${basePath}/notes`,
            label: t('workspace.notes'),
            shortLabel: t('workspace.notesShort'),
            icon: PencilLine,
          },
        ]
      : []),
    {
      to: `${basePath}/characters`,
      label: t('workspace.characters'),
      icon: UserRound,
    },
  ];
  const management = isOwner
    ? [
        {
          to: `${basePath}/members`,
          label: t('workspace.members'),
          icon: Users,
        },
        {
          to: `${basePath}/settings`,
          label: t('workspace.campaignSettings'),
          icon: Settings2,
        },
      ]
    : [];
  type NavItem = {
    to: string;
    label: string;
    /** A shorter word for the phone's bottom navigation. */
    shortLabel?: string;
    icon: typeof LayoutDashboard;
  };
  const hasNew = !isOwner && (campaign.newVisibleMaterialCount ?? 0) > 0;
  const navLinks = (items: NavItem[], mobile = false) =>
    items.map(({ to, label, shortLabel, icon: Icon }) => (
      <NavLink
        aria-label={mobile && shortLabel ? label : undefined}
        key={to}
        to={to}
        className={({ isActive }) => (isActive ? 'active' : undefined)}
      >
        <Icon aria-hidden="true" size={mobile ? 18 : 17} strokeWidth={1.8} />
        <span className={mobile ? undefined : 'rail-label'}>
          {mobile ? (shortLabel ?? label) : label}
        </span>
        {hasNew && to.endsWith('/case') && (
          <span
            className="campaign-nav-new"
            role="img"
            aria-label={t('ui.newMark')}
          />
        )}
      </NavLink>
    ));

  return (
    <div className="campaign-workspace-shell">
      <AppTopbar className="campaign-workspace-shell-topbar" />
      <aside
        className={`campaign-workspace-shell-sidebar${menuOpen ? ' campaign-workspace-shell-sidebar-open' : ''}`}
        id="campaign-sidebar"
        ref={sidebar}
        // Any link in the slide-out menu leads away, so the menu closes.
        onClick={(event) => {
          if ((event.target as Element).closest('a')) setMenuOpen(false);
        }}
      >
        <Link
          className="campaign-switcher"
          to="/campaigns"
          aria-label={t('workspace.switchCampaign')}
        >
          <span className="campaign-switcher-initial" aria-hidden="true">
            {campaign.title.trim().charAt(0).toUpperCase()}
          </span>
          <span className="campaign-switcher-title rail-label">
            {campaign.title}
          </span>
          <span className="campaign-switcher-meta">
            {systemName} · {t(`workspace.roles.${campaign.currentUserRole}`)}
          </span>
          <ChevronDown aria-hidden="true" size={16} />
        </Link>
        <button
          className="campaign-search-trigger"
          type="button"
          onClick={() => setSearchOpen(true)}
        >
          <Search aria-hidden="true" size={17} />
          <span className="rail-label">{t('search.trigger')}</span>
          <kbd>Ctrl K</kbd>
        </button>
        <nav
          className="campaign-workspace-shell-navigation"
          aria-label={t('workspace.navigation')}
        >
          {navLinks(primary)}
          {management.length > 0 && (
            <>
              <span className="campaign-nav-group">
                {t('workspace.campaignGroup')}
              </span>
              {navLinks(management)}
            </>
          )}
        </nav>
      </aside>
      {menuOpen && (
        <div
          aria-hidden="true"
          className="campaign-menu-backdrop"
          onClick={() => setMenuOpen(false)}
        />
      )}
      <header className="campaign-workspace-shell-mobile-header">
        <button
          aria-controls="campaign-sidebar"
          aria-expanded={menuOpen}
          aria-label={t('workspace.menu')}
          className="campaign-menu-button"
          ref={menuButton}
          type="button"
          onClick={() => setMenuOpen((open) => !open)}
        >
          <Menu aria-hidden="true" size={21} />
          {/* The case's dot stays in sight while the menu is closed. */}
          {hasNew && <span className="campaign-nav-new" aria-hidden="true" />}
        </button>
        <Link className="campaign-mobile-switcher" to="/campaigns">
          <strong>{campaign.title}</strong>
          <span>
            {t(`workspace.roles.${campaign.currentUserRole}`)} · {systemName}
          </span>
        </Link>
        <button
          className="campaign-mobile-search"
          type="button"
          aria-label={t('search.trigger')}
          onClick={() => setSearchOpen(true)}
        >
          <Search aria-hidden="true" size={21} />
        </button>
        <AccountMenu />
      </header>
      <main className="campaign-workspace-shell-content">
        <OfflineNotice />
        {children}
      </main>
      <nav
        className="campaign-workspace-shell-mobile-navigation"
        aria-label={t('workspace.navigation')}
      >
        {navLinks(primary, true)}
        {isOwner && (
          <>
            <NavLink
              to={`${basePath}/members`}
              className={({ isActive }) => (isActive ? 'active' : undefined)}
            >
              <Users aria-hidden="true" size={18} />
              <span>{t('workspace.members')}</span>
            </NavLink>
            <NavLink
              to={`${basePath}/settings`}
              className={({ isActive }) => (isActive ? 'active' : undefined)}
            >
              <Settings2 aria-hidden="true" size={18} />
              <span>{t('workspace.campaignSettings')}</span>
            </NavLink>
          </>
        )}
      </nav>
      {searchOpen && (
        <CampaignSearch
          campaign={campaign}
          onClose={() => setSearchOpen(false)}
        />
      )}
    </div>
  );
}
