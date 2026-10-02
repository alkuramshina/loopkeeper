import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './i18n';
import { AuthProvider } from './auth/auth-context';
import { SessionWorkspace } from './app/session-workspace';
import { AppErrorBoundary } from './app/error-boundary';
import './theme/fonts.css';
import './theme/tokens.css';
import './theme/base.css';
import './components/ui/ui.css';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <SessionWorkspace />
        </AuthProvider>
      </BrowserRouter>
    </AppErrorBoundary>
  </StrictMode>,
);
