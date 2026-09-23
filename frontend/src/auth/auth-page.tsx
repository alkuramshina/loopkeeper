import { FormEvent, useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ApiError } from '../api/client';
import { useAuth } from './auth-context';
import { useTranslation } from 'react-i18next';

export function AuthPage({ mode }: { mode: 'sign-in' | 'sign-up' }) {
  const { t } = useTranslation();
  const { signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<string>();
  const [invitationValue, setInvitationValue] = useState('');
  const [invitationError, setInvitationError] = useState<string>();
  const [isInvitationEntryOpen, setInvitationEntryOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const isSignUp = mode === 'sign-up';

  useEffect(() => {
    setError(undefined);
    setInvitationError(undefined);
    setInvitationEntryOpen(false);
    setPassword('');
    setSubmitting(false);
  }, [mode]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(undefined);
    try {
      const payload = {
        email,
        password,
        name: isSignUp ? name : undefined,
      };
      if (isSignUp) await signUp(payload);
      else await signIn(payload);
      const invitation = searchParams.get('invitation');
      navigate(
        invitation
          ? `/invitations/${encodeURIComponent(invitation)}`
          : '/campaigns',
      );
    } catch (cause) {
      console.warn(cause);
      setError(
        cause instanceof ApiError
          ? t(`errors.${cause.code}`, { defaultValue: t('errors.unexpected') })
          : t('errors.unexpected'),
      );
    } finally {
      setSubmitting(false);
    }
  }

  function continueWithInvitation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = invitationValue.trim();
    const pathPrefix = '/invitations/';
    let token = value;

    try {
      const url = new URL(value, window.location.origin);
      if (url.pathname.startsWith(pathPrefix)) {
        token = url.pathname.slice(pathPrefix.length);
      }
    } catch {
      setInvitationError(t('auth.invitationInvalid'));
      return;
    }

    if (!token || token.includes('/')) {
      setInvitationError(t('auth.invitationInvalid'));
      return;
    }

    navigate(`/invitations/${encodeURIComponent(token)}`);
  }

  const switchPath = isSignUp ? '/sign-in' : '/sign-up';
  const errorId = 'auth-form-error';

  return (
    <main className="auth-page">
      <div className="auth-layout">
        <aside className="auth-brand" aria-label={t('appName')}>
          <div>
            <div className="brand-lock">
              <span className="brand-mark" aria-hidden="true" />
              {t('appName')}
            </div>
            <h1>
              {t(isSignUp ? 'auth.signUpBrandTitle' : 'auth.signInBrandTitle')}
            </h1>
            <p>
              {t(isSignUp ? 'auth.signUpBrandBody' : 'auth.signInBrandBody')}
            </p>
          </div>
          <p className="auth-note">
            {t(isSignUp ? 'auth.signUpPrivacyNote' : 'auth.signInPrivacyNote')}
          </p>
        </aside>
        <section className="auth-main" aria-labelledby="auth-page-title">
          <div className="auth-card">
            <div className="auth-mobile-brand">
              <span className="brand-mark" aria-hidden="true" />
              {t('appName')}
            </div>
            <p className="kicker">
              {t(isSignUp ? 'auth.signUpKicker' : 'auth.signInKicker')}
            </p>
            <h1 id="auth-page-title">
              {t(isSignUp ? 'auth.signUpTitle' : 'auth.signInTitle')}
            </h1>
            <p className="auth-intro">
              {t(isSignUp ? 'auth.signUpIntro' : 'auth.signInIntro')}
            </p>
            <form className="auth-form" key={mode} onSubmit={submit}>
              {isSignUp && (
                <label className="auth-field">
                  {t('auth.name')}
                  <input
                    autoComplete="name"
                    name="name"
                    onChange={(event) => setName(event.target.value)}
                    required
                    value={name}
                  />
                </label>
              )}
              <label className="auth-field">
                {t('auth.email')}
                <input
                  aria-describedby={error ? errorId : undefined}
                  autoComplete="email"
                  name="email"
                  onChange={(event) => setEmail(event.target.value)}
                  required
                  type="email"
                  value={email}
                />
              </label>
              <label className="auth-field">
                {t('auth.password')}
                <input
                  aria-describedby={error ? errorId : undefined}
                  autoComplete={isSignUp ? 'new-password' : 'current-password'}
                  minLength={8}
                  name="password"
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  type="password"
                  value={password}
                />
                {isSignUp && (
                  <span className="field-helper">{t('auth.passwordHint')}</span>
                )}
              </label>
              {error && (
                <p className="auth-error" id={errorId} role="alert">
                  {error}
                </p>
              )}
              <button className="auth-submit" disabled={submitting}>
                {t(isSignUp ? 'auth.signUp' : 'auth.signIn')}
              </button>
            </form>
            <div className="auth-separator" aria-hidden="true">
              <span>{t('auth.separator')}</span>
            </div>
            {!isInvitationEntryOpen ? (
              <button
                className="auth-invitation-button"
                onClick={() => {
                  setInvitationEntryOpen(true);
                  setInvitationError(undefined);
                }}
                type="button"
              >
                {t('auth.useInvitation')}
              </button>
            ) : (
              <form
                className="auth-invitation-entry"
                onSubmit={continueWithInvitation}
              >
                <label className="auth-field">
                  {t('auth.invitationLink')}
                  <input
                    autoComplete="off"
                    onChange={(event) => setInvitationValue(event.target.value)}
                    placeholder={t('auth.invitationPlaceholder')}
                    required
                    value={invitationValue}
                  />
                </label>
                {invitationError && (
                  <p className="auth-error" role="alert">
                    {invitationError}
                  </p>
                )}
                <div className="auth-invitation-actions">
                  <button
                    className="button-ghost"
                    onClick={() => setInvitationEntryOpen(false)}
                    type="button"
                  >
                    {t('common.cancel')}
                  </button>
                  <button type="submit">
                    {t('auth.continueWithInvitation')}
                  </button>
                </div>
              </form>
            )}
            <p className="auth-switch">
              {t(isSignUp ? 'auth.haveAccount' : 'auth.newHere')}{' '}
              <Link
                onClick={() => {
                  setError(undefined);
                  setPassword('');
                }}
                to={switchPath}
              >
                {t(isSignUp ? 'auth.signIn' : 'auth.signUp')}
              </Link>
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
