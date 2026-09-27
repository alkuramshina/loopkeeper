import { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { KeyRound, UserRound } from 'lucide-react';
import { AppTopbar } from '../../components/app-topbar';
import { OfflineNotice } from '../../components/offline-notice';

/** The account pages share the campaign workspace layout and its sidebar. */
export function AccountShell({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const items = [
    {
      to: '/settings/account',
      label: t('account.navSettings'),
      icon: UserRound,
    },
    { to: '/settings/password', label: t('account.password'), icon: KeyRound },
  ];

  return (
    <div className="campaign-workspace-shell account-shell">
      <AppTopbar className="campaign-workspace-shell-topbar" />
      <aside className="campaign-workspace-shell-sidebar">
        <nav
          aria-label={t('account.navigation')}
          className="campaign-workspace-shell-navigation"
        >
          {items.map(({ to, label, icon: Icon }) => (
            <NavLink
              className={({ isActive }) => (isActive ? 'active' : undefined)}
              key={to}
              to={to}
            >
              <Icon aria-hidden="true" size={17} strokeWidth={1.8} />
              <span className="rail-label">{label}</span>
            </NavLink>
          ))}
        </nav>
      </aside>
      <main className="campaign-workspace-shell-content">
        <OfflineNotice />
        {children}
      </main>
    </div>
  );
}
