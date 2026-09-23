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
  const [submitting, setSubmitting] = useState(false);
  const isSignUp = mode === 'sign-up';

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

  return (
    <main className="auth-page">
      <section className="auth-card">
        <p className="kicker">{t('appName')}</p>
        <h1>{t(isSignUp ? 'auth.signUpTitle' : 'auth.signInTitle')}</h1>
        <p>{t('appTagline')}</p>
        <form key={mode} onSubmit={submit}>
          {isSignUp && (
            <label>
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
          <label>
            {t('auth.email')}
            <input
              autoComplete="email"
              name="email"
              onChange={(event) => setEmail(event.target.value)}
              required
              type="email"
              value={email}
            />
          </label>
          <label>
            {t('auth.password')}
            <input
              autoComplete={isSignUp ? 'new-password' : 'current-password'}
              minLength={8}
              name="password"
              onChange={(event) => setPassword(event.target.value)}
              required
              type="password"
              value={password}
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
          <Link
            onClick={() => {
              setError(undefined);
              setPassword('');
            }}
            to={isSignUp ? '/sign-in' : '/sign-up'}
          >
            {t(isSignUp ? 'auth.signIn' : 'auth.signUp')}
          </Link>
        </p>
      </section>
    </main>
  );
}
