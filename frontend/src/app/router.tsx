import { Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../auth/auth-context';
import {
  CampaignListPage,
  CampaignWorkspacePage,
} from '../features/campaigns/pages';
import { InvitationPage } from '../features/campaigns/invitation-page';
import { CharactersPage } from '../features/campaigns/characters-page';
import { NotesPage } from '../features/campaigns/notes-page';
import { AuthPage } from '../auth/auth-page';

function ProtectedRoute() {
  const { profile, loading } = useAuth();
  const { t } = useTranslation();
  if (loading) return <main className="page-state">{t('common.loading')}</main>;
  return profile ? <Outlet /> : <Navigate to="/sign-in" replace />;
}

function PublicOnlyRoute() {
  const { profile, loading } = useAuth();
  const { t } = useTranslation();
  if (loading) return <main className="page-state">{t('common.loading')}</main>;
  return profile ? <Navigate to="/campaigns" replace /> : <Outlet />;
}

function InvitationEntry() {
  const { profile, loading } = useAuth();
  const { t } = useTranslation();
  const token = window.location.pathname.split('/').pop();
  if (loading) return <main className="page-state">{t('common.loading')}</main>;
  return profile ? (
    <InvitationPage />
  ) : (
    <Navigate
      to={`/sign-in?invitation=${encodeURIComponent(token ?? '')}`}
      replace
    />
  );
}

export function AppRouter() {
  return (
    <Routes>
      <Route element={<PublicOnlyRoute />}>
        <Route path="/sign-in" element={<AuthPage mode="sign-in" />} />
        <Route path="/sign-up" element={<AuthPage mode="sign-up" />} />
      </Route>
      <Route element={<ProtectedRoute />}>
        <Route path="/campaigns" element={<CampaignListPage />} />
        <Route
          path="/campaigns/:campaignId"
          element={<CampaignWorkspacePage section="overview" />}
        />
        <Route
          path="/campaigns/:campaignId/board"
          element={<CampaignWorkspacePage section="board" />}
        />
        <Route
          path="/campaigns/:campaignId/characters"
          element={<CharactersPage />}
        />
        <Route path="/campaigns/:campaignId/notes" element={<NotesPage />} />
      </Route>
      <Route path="/invitations/:token" element={<InvitationEntry />} />
      <Route path="*" element={<Navigate to="/campaigns" replace />} />
    </Routes>
  );
}
