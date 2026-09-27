import { FormEvent, useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ApiError } from '../api/client';
import { useAuth } from './auth-context';
import { useTranslation } from 'react-i18next';
import lakeNight from '../assets/auth/lake-night.png';
import substationAutumn from '../assets/auth/substation-autumn.png';
import bridgeWinter from '../assets/auth/bridge-winter.png';
import radioField from '../assets/auth/radio-field.png';

export const brandVariantKeys = ['focus', 'threads', 'table', 'signals'] as const;
export const brandVariantStorageKey = 'loopkeeper.auth-brand-variant';
export const brandImageKeys = ['lake', 'substation', 'bridge', 'radio'] as const;
export const brandImageStorageKey = 'loopkeeper.auth-brand-image';

type BrandImageKey = (typeof brandImageKeys)[number];

const brandImages: Record<BrandImageKey, string> = {
  lake: lakeNight,
  substation: substationAutumn,
  bridge: bridgeWinter,
  radio: radioField,
};

// Storage access throws when the browser blocks it; the auth page must still
// render, so fall back to an unsaved random choice.
function selectSessionChoice<T extends string>(
  keys: readonly T[],
  storageKey: string,
): T {
  try {
    const stored = window.sessionStorage.getItem(storageKey);
    if (stored && keys.includes(stored as T)) {
      return stored as T;
    }
  } catch {
    // Ignore and pick a fresh variant below.
  }

  const choice = keys[Math.floor(Math.random() * keys.length)];
  try {
    window.sessionStorage.setItem(storageKey, choice);
  } catch {
    // The choice then stays stable only for this component instance.
  }
  return choice;
}

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
  const [brandVariant] = useState(() =>
    selectSessionChoice(brandVariantKeys, brandVariantStorageKey),
  );
  const [brandImage] = useState(() =>
    selectSessionChoice(brandImageKeys, brandImageStorageKey),
  );
  const isSignUp = mode === 'sign-up';
  const brandCopyPath = `auth.brandVariants.${brandVariant}.${
    isSignUp ? 'signUp' : 'signIn'
  }`;

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
      // On success PublicOnlyRoute redirects, keeping a pending invitation.
      if (isSignUp) await signUp(payload);
      else await signIn(payload);
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

    void navigate(`/invitations/${encodeURIComponent(token)}`);
  }

  // Keep a pending invitation when switching between sign-in and sign-up.
  const switchPath = `${isSignUp ? '/sign-in' : '/sign-up'}${
    searchParams.size ? `?${searchParams.toString()}` : ''
  }`;
  const errorId = 'auth-form-error';

  return (
    <main className="auth-page">
      <div className="auth-layout">
        <aside className="auth-brand" aria-label={t('appName')}>
          <img
            alt=""
            className="auth-brand-image"
            data-variant={brandImage}
            src={brandImages[brandImage]}
          />
          <div>
            <div className="brand-lock">
              <span className="brand-mark" aria-hidden="true" />
              {t('appName')}
            </div>
            <p className="auth-brand-title">{t(`${brandCopyPath}.title`)}</p>
            <p className="auth-brand-body">{t(`${brandCopyPath}.body`)}</p>
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
            <form
              className="auth-form"
              key={mode}
              onSubmit={(event) => void submit(event)}
            >
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
