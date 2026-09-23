import { Component, ErrorInfo, ReactNode } from 'react';
import { WithTranslation, withTranslation } from 'react-i18next';

type Props = WithTranslation & { children: ReactNode };

class AppErrorBoundaryBase extends Component<Props, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Unhandled frontend error', error, info);
  }

  render() {
    if (this.state.failed) {
      return (
        <main className="page-state" role="alert">
          {this.props.t('errors.unexpected')} {this.props.t('common.reload')}
        </main>
      );
    }
    return this.props.children;
  }
}

export const AppErrorBoundary = withTranslation()(AppErrorBoundaryBase);
