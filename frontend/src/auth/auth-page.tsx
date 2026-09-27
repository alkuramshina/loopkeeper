import { FormEvent, useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { ApiError, InvitationPreview } from '../api/client';
import { useAuth } from './auth-context';
import { Logo } from '../components/brand/logo';
import { useTranslation } from 'react-i18next';
import lakeNight from '../assets/auth/lake-night.png';
import substationAutumn from '../assets/auth/substation-autumn.png';
import bridgeWinter from '../assets/auth/bridge-winter.png';
import radioField from '../assets/auth/radio-field.png';

export const brandVariantKeys = [
  'focus',
  'threads',
  'table',
  'signals',
] as const;
export const brandImageKeys = [
  'lake',
  'substation',
  'bridge',
  'radio',
] as const;

type BrandImageKey = (typeof brandImageKeys)[number];

const brandImages: Record<BrandImageKey, string> = {
  lake: lakeNight,
  substation: substationAutumn,
  bridge: bridgeWinter,
  radio: radioField,
};

// A fresh pick on every page load. The brand panel stays the same when
// switching between the forms because the page component stays mounted.
function pickRandom<T>(keys: readonly T[]): T {
  return keys[Math.floor(Math.random() * keys.length)];
}

export function AuthPage({ mode }: { mode: 'sign-in' | 'sign-up' }) {
  const { t } = useTranslation();
  const { api, signIn, signUp } = useAuth();
  const [searchParams] = useSearchParams();
  const invitation = searchParams.get('invitation');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<string>();
  const [submitting, setSubmitting] = useState(false);
  const [brandVariant] = useState(() => pickRandom(brandVariantKeys));
  const [brandImage] = useState(() => pickRandom(brandImageKeys));
  const invitationPreview = useQuery({
    queryKey: ['invitation-preview', invitation],
    queryFn: () =>
      api.request<InvitationPreview>(
        `/invitations/${encodeURIComponent(invitation ?? '')}`,
      ),
    enabled: Boolean(invitation),
    retry: false,
  });
  const isSignUp = mode === 'sign-up';
  const brandCopyPath = `auth.brandVariants.${brandVariant}`;

  useEffect(() => {
    setError(undefined);
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

  // Keep a pending invitation when switching between sign-in and sign-up.
  const switchPath = `${isSignUp ? '/sign-in' : '/sign-up'}${
    searchParams.size ? `?${searchParams.toString()}` : ''
  }`;
  const errorId = 'auth-form-error';

  return (
    <main className="auth-page">
      <div className="auth-layout">
        <section className="auth-main" aria-labelledby="auth-page-title">
          <Logo className="auth-logo" label={t('appName')} />
          <div className="auth-card">
            <h1 id="auth-page-title">
              {t(isSignUp ? 'auth.signUpTitle' : 'auth.signInTitle')}
            </h1>
            {invitation ? (
              <InvitationBanner
                failed={invitationPreview.isError}
                preview={invitationPreview.data}
              />
            ) : (
              <p className="auth-intro">
                {t(isSignUp ? 'auth.signUpIntro' : 'auth.signInIntro')}
              </p>
            )}
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
        <aside className="auth-brand" aria-label={t('appName')}>
          <img
            alt=""
            className="auth-brand-image"
            data-variant={brandImage}
            src={brandImages[brandImage]}
          />
          <p className="auth-brand-title">{t(`${brandCopyPath}.title`)}</p>
          <p className="auth-brand-body">{t(`${brandCopyPath}.body`)}</p>
        </aside>
      </div>
    </main>
  );
}

function InvitationBanner({
  failed,
  preview,
}: {
  failed: boolean;
  preview?: InvitationPreview;
}) {
  const { t } = useTranslation();
  if (failed) {
    return (
      <p className="auth-invitation is-unavailable" role="status">
        {t('auth.invitationUnavailable')}
      </p>
    );
  }
  // Keep the space while loading so the form does not jump.
  if (!preview) return <p aria-hidden="true" className="auth-invitation" />;
  return (
    <p className="auth-invitation" role="status">
      {preview.masterName
        ? t('auth.invitationFrom', {
            master: preview.masterName,
            title: preview.campaignTitle,
          })
        : t('auth.invitation', { title: preview.campaignTitle })}{' '}
      <span>{t('auth.invitationNext')}</span>
    </p>
  );
}
