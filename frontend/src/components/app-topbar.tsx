import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../auth/auth-context';
import { Avatar } from './avatar';
import { Logo } from './brand/logo';

/** The avatar alone opens the account actions. */
export function AccountMenu() {
  const { t } = useTranslation();
  const { profile, signOut } = useAuth();
  const name = profile?.name || profile?.email || '';

  return (
    <details className="account-menu">
      <summary aria-label={t('account.title')}>
        <Avatar alt="" imageUrl={profile?.avatarUrl} seed={name} size="small" />
      </summary>
      <div>
        <Link to="/settings/account">{name}</Link>
        <button type="button" onClick={() => void signOut()}>
          {t('auth.signOut')}
        </button>
      </div>
    </details>
  );
}

/** The same header on every screen: the logo leads to the campaign list. */
export function AppTopbar({ className }: { className?: string }) {
  const { t } = useTranslation();

  return (
    <header className={['app-topbar', className].filter(Boolean).join(' ')}>
      <Link className="brand-lock" to="/campaigns">
        <Logo label={t('appName')} />
      </Link>
      <AccountMenu />
    </header>
  );
}
