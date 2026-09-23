import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { TFunction } from 'i18next';
import { ApiError } from '../../api/client';
import { useAuth } from '../../auth/auth-context';

function apiErrorMessage(cause: unknown, t: TFunction) {
  return cause instanceof ApiError
    ? t(`errors.${cause.code}`, { defaultValue: t('errors.unexpected') })
    : t('errors.unexpected');
}

export function AccountSettingsPage() {
  const { api, profile, signOut, updateProfile } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [profileError, setProfileError] = useState<string>();
  const [passwordError, setPasswordError] = useState<string>();
  const [profileSaved, setProfileSaved] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setProfileError(undefined);
    setProfileSaved(false);
    setSavingProfile(true);
    try {
      const form = new FormData(event.currentTarget);
      await updateProfile({ name: String(form.get('name') ?? '').trim() });
      setProfileSaved(true);
    } catch (cause) {
      setProfileError(apiErrorMessage(cause, t));
    } finally {
      setSavingProfile(false);
    }
  }

  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPasswordError(undefined);
    const form = new FormData(event.currentTarget);
    const newPassword = String(form.get('newPassword') ?? '');
    const confirmation = String(form.get('confirmation') ?? '');
    if (newPassword !== confirmation) {
      setPasswordError(t('account.passwordMismatch'));
      return;
    }

    setChangingPassword(true);
    try {
      await api.request<void>('/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({
          currentPassword: form.get('currentPassword'),
          newPassword,
        }),
      });
      await signOut();
      navigate('/sign-in', { replace: true });
    } catch (cause) {
      setPasswordError(apiErrorMessage(cause, t));
      setChangingPassword(false);
    }
  }

  return (
    <main className="settings-page">
      <header className="settings-topbar">
        <button className="button-ghost" onClick={() => navigate('/campaigns')}>
          ← {t('workspace.backToCampaigns')}
        </button>
      </header>
      <section className="page-header">
        <p className="kicker">{t('account.kicker')}</p>
        <h1>{t('account.title')}</h1>
      </section>
      <div className="settings-grid">
        <form className="panel" onSubmit={saveProfile}>
          <div className="section-heading">
            <h2>{t('account.profile')}</h2>
            {profileSaved && <small className="success-message">{t('account.saved')}</small>}
          </div>
          <label>
            {t('auth.email')}
            <input disabled type="email" value={profile?.email ?? ''} />
          </label>
          <label>
            {t('auth.name')}
            <input defaultValue={profile?.name ?? ''} maxLength={100} name="name" required />
          </label>
          {profileError && <p className="form-error" role="alert">{profileError}</p>}
          <button disabled={savingProfile}>{t('common.save')}</button>
        </form>
        <form className="panel" onSubmit={changePassword}>
          <div className="section-heading">
            <h2>{t('account.password')}</h2>
          </div>
          <p className="muted">{t('account.passwordNotice')}</p>
          <label>
            {t('account.currentPassword')}
            <input autoComplete="current-password" name="currentPassword" required type="password" />
          </label>
          <label>
            {t('account.newPassword')}
            <input autoComplete="new-password" minLength={8} name="newPassword" required type="password" />
          </label>
          <label>
            {t('account.confirmPassword')}
            <input autoComplete="new-password" minLength={8} name="confirmation" required type="password" />
          </label>
          {passwordError && <p className="form-error" role="alert">{passwordError}</p>}
          <button disabled={changingPassword}>{t('account.changePassword')}</button>
        </form>
      </div>
    </main>
  );
}
