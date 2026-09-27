import { ReactNode } from 'react';
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
} from 'lucide-react';
import { Campaign, GameSystem } from '../../api/client';
import { useAuth } from '../../auth/auth-context';
import { OfflineNotice } from '../../components/offline-notice';
import { Logo } from '../../components/brand/logo';
import { Avatar } from '../../components/avatar';

type CampaignWorkspaceShellProps = {
  campaign?: Campaign;
  children: ReactNode;
};

export function CampaignWorkspaceShell({
  campaign,
  children,
}: CampaignWorkspaceShellProps) {
  const { api, profile, signOut } = useAuth();
  const { t } = useTranslation();
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
  const navLinks = (items: NavItem[], mobile = false) =>
    items.map(({ to, label, shortLabel, icon: Icon }) => (
      <NavLink
        aria-label={mobile && shortLabel ? label : undefined}
        key={to}
        to={to}
        className={({ isActive }) => (isActive ? 'active' : undefined)}
      >
        <Icon aria-hidden="true" size={mobile ? 18 : 17} strokeWidth={1.8} />
        <span>{mobile ? (shortLabel ?? label) : label}</span>
      </NavLink>
    ));

  return (
    <div className="campaign-workspace-shell">
      <aside className="campaign-workspace-shell-sidebar">
        <Link className="brand-lock" to="/campaigns">
          <Logo label={t('appName')} />
        </Link>
        <Link
          className="campaign-switcher"
          to="/campaigns"
          aria-label={t('workspace.switchCampaign')}
        >
          <span className="campaign-switcher-title">{campaign.title}</span>
          <span className="campaign-switcher-meta">
            {systemName} · {t(`workspace.roles.${campaign.currentUserRole}`)}
          </span>
          <ChevronDown aria-hidden="true" size={16} />
        </Link>
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
        <details className="campaign-profile-menu">
          <summary>
            <Avatar
              alt=""
              seed={profile?.name || profile?.email || ''}
              size="small"
            />
            <span>{profile?.name || profile?.email}</span>
            <ChevronDown aria-hidden="true" size={16} />
          </summary>
          <div className="campaign-profile-menu-actions">
            <Link to="/settings/account">{t('account.title')}</Link>
            <button type="button" onClick={() => void signOut()}>
              {t('auth.signOut')}
            </button>
          </div>
        </details>
      </aside>
      <header className="campaign-workspace-shell-mobile-header">
        <Link className="campaign-mobile-switcher" to="/campaigns">
          <strong>{campaign.title}</strong>
          <span>
            {t(`workspace.roles.${campaign.currentUserRole}`)} · {systemName}
          </span>
        </Link>
        <Link to="/settings/account" aria-label={t('account.title')}>
          <Avatar
            alt=""
            seed={profile?.name || profile?.email || ''}
            size="small"
          />
        </Link>
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
    </div>
  );
}
