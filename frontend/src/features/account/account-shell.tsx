import { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { LockKeyhole, UserRound } from 'lucide-react';
import { AppShell, SidebarLink } from '../../components/app-shell';
import { PageHeader } from '../../components/page-header';
import './account.css';

type AccountShellProps = {
  title: string;
  lead: string;
  children: ReactNode;
};

/**
 * Account settings in the shared frame and its left navigation.
 */
export function AccountShell({ title, lead, children }: AccountShellProps) {
  const { t } = useTranslation();
  const sections = [
    { to: '/settings/account', label: t('account.profile'), icon: UserRound },
    {
      to: '/settings/password',
      label: t('account.login'),
      icon: LockKeyhole,
    },
  ];

  return (
    <AppShell
      sidebar={
        <>
          <span className="campaign-nav-group">{t('account.settings')}</span>
          <div className="campaign-submenu">
            {sections.map(({ to, label, icon }) => (
              <SidebarLink icon={icon} key={to} label={label} to={to} />
            ))}
          </div>
        </>
      }
      sidebarLabel={t('account.navigation')}
      width="narrow"
    >
      <div className="account-page">
        <PageHeader lead={lead} title={title} />
        {children}
      </div>
    </AppShell>
  );
}
