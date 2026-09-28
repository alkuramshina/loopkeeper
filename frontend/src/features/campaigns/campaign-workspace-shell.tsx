import { ReactNode, useEffect, useRef, useState } from 'react';
import { NavLink } from 'react-router-dom';
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
  Menu,
  Search,
  Image,
} from 'lucide-react';
import { Campaign, GameSystem } from '../../api/client';
import { useAuth } from '../../auth/auth-context';
import { OfflineNotice } from '../../components/offline-notice';
import {
  ContentWidth,
  PageFrame,
  SidebarLogo,
  SidebarProfileLink,
} from '../../components/app-shell';
import { useCampaignVisit } from './use-campaign-visit';
import { CampaignSearch } from './campaign-search';
import './new-since-visit.css';

type CampaignWorkspaceShellProps = {
  campaign?: Campaign;
  /** The board takes the full width; other pages keep the default. */
  width?: ContentWidth;
  children: ReactNode;
};

export function CampaignWorkspaceShell({
  campaign,
  width,
  children,
}: CampaignWorkspaceShellProps) {
  const { api } = useAuth();
  useCampaignVisit(campaign);
  const { t } = useTranslation();
  const [searchOpen, setSearchOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
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
    const wide = window.matchMedia?.('(min-width: 1024px)');
    if (!wide) return;
    const closeMenu = () => setMenuOpen(false);
    wide.addEventListener('change', closeMenu);
    return () => wide.removeEventListener('change', closeMenu);
  }, []);
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      // `code` is the physical key: with a Russian layout `key` is "л", the
      // handler missed it and the browser ran its own Ctrl+K web search.
      const ctrlK =
        (event.ctrlKey || event.metaKey) &&
        !event.altKey &&
        (event.code === 'KeyK' || event.key.toLowerCase() === 'k');
      const target = event.target as HTMLElement | null;
      const typing =
        !!target?.isContentEditable ||
        ['INPUT', 'TEXTAREA', 'SELECT'].includes(target?.tagName ?? '');
      const slash =
        event.key === '/' &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.altKey &&
        !typing;
      if (!ctrlK && !slash) return;
      event.preventDefault();
      setSearchOpen(true);
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
      displayLabel: t('workspace.boardShort'),
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
          displayLabel: t('account.settings'),
          icon: Settings2,
        },
      ]
    : [];
  type NavItem = {
    to: string;
    label: string;
    /** A shorter word for the phone's bottom navigation. */
    shortLabel?: string;
    displayLabel?: string;
    icon: typeof LayoutDashboard;
  };
  const hasNew = !isOwner && (campaign.newVisibleMaterialCount ?? 0) > 0;
  const navLinks = (items: NavItem[], mobile = false) =>
    items.map(({ to, label, shortLabel, displayLabel, icon: Icon }) => (
      <NavLink
        aria-label={displayLabel || (mobile && shortLabel) ? label : undefined}
        key={to}
        to={to}
        end={to.endsWith('/settings')}
        className={({ isActive }) => (isActive ? 'active' : undefined)}
      >
        <Icon aria-hidden="true" size={mobile ? 18 : 17} strokeWidth={1.8} />
        <span className={mobile ? undefined : 'rail-label'}>
          {mobile ? (shortLabel ?? label) : (displayLabel ?? label)}
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
      <button
        aria-controls="campaign-sidebar"
        aria-expanded={menuOpen}
        aria-label={t('workspace.menu')}
        className="sidebar-menu-button"
        onClick={() => setMenuOpen((open) => !open)}
        ref={menuButton}
        type="button"
      >
        <Menu aria-hidden="true" size={21} />
        {hasNew && <span className="campaign-nav-new" aria-hidden="true" />}
      </button>
      <aside
        className={`campaign-workspace-shell-sidebar${menuOpen ? ' campaign-workspace-shell-sidebar-open' : ''}`}
        id="campaign-sidebar"
        ref={sidebar}
        // Any link in the slide-out menu leads away, so the menu closes.
        onClick={(event) => {
          if ((event.target as Element).closest('a')) setMenuOpen(false);
        }}
      >
        <SidebarLogo />
        {/* Where you are and as whom: plain text, not a control. The logo
            above leads back to the campaign list. */}
        <div className="campaign-identity" title={campaign.title}>
          <span className="campaign-identity-initial" aria-hidden="true">
            {campaign.title.trim().charAt(0).toUpperCase()}
          </span>
          <p className="campaign-identity-title">{campaign.title}</p>
          <p className="campaign-identity-meta">
            {systemName} · {t(`workspace.roles.${campaign.currentUserRole}`)}
          </p>
        </div>
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
          <div className="campaign-submenu">
            {navLinks(primary)}
            {management.length > 0 && (
              <>
                <span className="campaign-nav-group">
                  {t('workspace.campaignGroup')}
                </span>
                {navLinks(management)}
                <NavLink
                  className={({ isActive }) =>
                    isActive ? 'active' : undefined
                  }
                  to={`${basePath}/settings/backgrounds`}
                >
                  <Image aria-hidden="true" size={17} strokeWidth={1.8} />
                  <span className="rail-label">
                    {t('workspace.backgroundSettings')}
                  </span>
                </NavLink>
              </>
            )}
          </div>
        </nav>
        <SidebarProfileLink />
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
      {searchOpen && (
        <CampaignSearch
          campaign={campaign}
          onClose={() => setSearchOpen(false)}
        />
      )}
    </div>
  );
}
