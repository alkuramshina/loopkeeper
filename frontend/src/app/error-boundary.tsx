import { Component, ErrorInfo, ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { WithTranslation, withTranslation } from 'react-i18next';
import { useTranslation } from 'react-i18next';
import { Logo } from '../components/brand/logo';
import { ErrorPage } from '../components/error-screen';

type BoundaryProps = {
  children: ReactNode;
  fallback: ReactNode;
  /** A new key (the next page) clears the failure. */
  resetKey?: string;
};

class ErrorBoundary extends Component<BoundaryProps, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Unhandled frontend error', error, info);
  }

  componentDidUpdate(previous: BoundaryProps) {
    if (this.state.failed && previous.resetKey !== this.props.resetKey)
      this.setState({ failed: false });
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

function reload() {
  window.location.reload();
}

/**
 * Last resort around the whole app, outside the router and the session: a
 * standalone screen that still looks like the product.
 */
function AppErrorBoundaryBase({
  children,
  t,
}: WithTranslation & { children: ReactNode }) {
  return (
    <ErrorBoundary
      fallback={
        <main className="error-standalone">
          <Logo className="error-standalone-logo" label={t('appName')} />
          <section className="error-standalone-card">
            <h1>{t('errorScreen.titles.unexpected')}</h1>
            <p role="alert">{t('errors.unexpected')}</p>
            <button
              className="ui-button ui-button-primary ui-button-md"
              onClick={reload}
              type="button"
            >
              {t('errorScreen.reload')}
            </button>
          </section>
        </main>
      }
    >
      {children}
    </ErrorBoundary>
  );
}

export const AppErrorBoundary = withTranslation()(AppErrorBoundaryBase);

/**
 * Around the routes: a failed screen keeps the app frame of a signed-in
 * person (or the sign-in frame of a guest) and clears on the next page.
 */
export function RouteErrorBoundary({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const location = useLocation();
  return (
    <ErrorBoundary
      fallback={
        <ErrorPage
          kind="unexpected"
          message={t('errors.unexpected')}
          onRetry={reload}
          retryLabel={t('errorScreen.reload')}
        />
      }
      resetKey={location.pathname}
    >
      {children}
    </ErrorBoundary>
  );
}
