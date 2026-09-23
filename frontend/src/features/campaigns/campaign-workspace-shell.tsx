import { ReactNode } from 'react';
import { NavLink, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Campaign } from '../../api/client';
import { useAuth } from '../../auth/auth-context';

type CampaignWorkspaceShellProps = {
  campaign?: Campaign;
  children: ReactNode;
};

type NavigationItem = {
  to: string;
  label: string;
  end?: boolean;
};

export function CampaignWorkspaceShell({
  campaign,
  children,
}: CampaignWorkspaceShellProps) {
  const { profile, signOut } = useAuth();
  const { t } = useTranslation();
  if (!campaign) {
    return <main className="page-state">{t('common.loading')}</main>;
  }

  const basePath = `/campaigns/${campaign.campaignId}`;
  const navigationItems: NavigationItem[] = [
    { to: basePath, label: t('workspace.overview'), end: true },
    ...(campaign.currentUserRole !== 'VIEWER'
      ? [{ to: `${basePath}/board`, label: t('workspace.board') }]
      : []),
    { to: `${basePath}/characters`, label: t('workspace.characters') },
    { to: `${basePath}/notes`, label: t('workspace.notes') },
    ...(campaign.currentUserRole === 'OWNER' ||
    campaign.currentUserRole === 'PLAYER'
      ? [{ to: `${basePath}/locations`, label: t('workspace.locations') }]
      : []),
    ...(campaign.currentUserRole === 'OWNER'
      ? [
          { to: `${basePath}/members`, label: t('workspace.members') },
          {
            to: `${basePath}/settings`,
            label: t('workspace.campaignSettings'),
          },
          {
            to: `${basePath}/settings/backgrounds`,
            label: t('workspace.backgroundSettings'),
          },
        ]
      : []),
  ];

  const navigation = (className: string) => (
    <nav className={className} aria-label={t('campaigns.title')}>
      {navigationItems.map((item) => (
        <NavLink end={item.end} key={item.to} to={item.to}>
          {item.label}
        </NavLink>
      ))}
    </nav>
  );

  return (
    <div className="campaign-workspace-shell">
      <header className="campaign-workspace-shell-topbar">
        <Link className="brand-lock" to="/campaigns">
          <span className="brand-mark" aria-hidden="true" />
          {t('appName')}
        </Link>
        <p className="campaign-workspace-shell-title">{campaign.title}</p>
      </header>
      <header className="campaign-workspace-shell-mobile-header">
        <Link className="brand-lock" to="/campaigns">
          <span className="brand-mark" aria-hidden="true" />
          {t('appName')}
        </Link>
        <p>{campaign.title}</p>
      </header>
      <div className="campaign-workspace-shell-body">
        <aside className="campaign-workspace-shell-sidebar">
          <div>
            <p className="campaign-workspace-shell-role">
              {t(`workspace.roles.${campaign.currentUserRole}`)}
            </p>
            <h1>{campaign.title}</h1>
          </div>
          {navigation('campaign-workspace-shell-navigation')}
          <footer className="campaign-workspace-shell-profile">
            <Link to="/settings/account">
              {profile?.name ?? profile?.email}
            </Link>
            <button
              className="button-ghost"
              onClick={() => void signOut()}
              type="button"
            >
              {t('auth.signOut')}
            </button>
          </footer>
        </aside>
        <main className="campaign-workspace-shell-content">{children}</main>
      </div>
      {navigation('campaign-workspace-shell-mobile-navigation')}
    </div>
  );
}
