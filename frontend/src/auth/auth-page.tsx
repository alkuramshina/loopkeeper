import { FormEvent, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ApiError } from '../api/client';
import { useAuth } from './auth-context';
import { useTranslation } from 'react-i18next';

export function AuthPage({ mode }: { mode: 'sign-in' | 'sign-up' }) {
  const { t } = useTranslation();
  const { signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [error, setError] = useState<string>();
  const [submitting, setSubmitting] = useState(false);
  const isSignUp = mode === 'sign-up';

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(undefined);
    const form = new FormData(event.currentTarget);
    try {
      const payload = {
        email: String(form.get('email')),
        password: String(form.get('password')),
        name: isSignUp ? String(form.get('name') || '') : undefined,
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
      setError(
        cause instanceof ApiError
          ? t(`errors.${cause.code}`, { defaultValue: t('errors.unexpected') })
          : t('errors.unexpected'),
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-card">
        <p className="kicker">{t('appName')}</p>
        <h1>{t(isSignUp ? 'auth.signUpTitle' : 'auth.signInTitle')}</h1>
        <p>{t('appTagline')}</p>
        <form onSubmit={submit}>
          {isSignUp && (
            <label>
              {t('auth.name')}
              <input name="name" autoComplete="name" />
            </label>
          )}
          <label>
            {t('auth.email')}
            <input name="email" type="email" autoComplete="email" required />
          </label>
          <label>
            {t('auth.password')}
            <input
              name="password"
              type="password"
              autoComplete={isSignUp ? 'new-password' : 'current-password'}
              required
            />
          </label>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <button disabled={submitting}>
            {t(isSignUp ? 'auth.signUp' : 'auth.signIn')}
          </button>
        </form>
        <p>
          <Link to={isSignUp ? '/sign-in' : '/sign-up'}>
            {t(isSignUp ? 'auth.signIn' : 'auth.signUp')}
          </Link>
        </p>
      </section>
    </main>
  );
}
