import { lazy, Suspense } from 'react';
import { Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../auth/auth-context';
import { AuthPage } from '../auth/auth-page';

const CampaignListPage = lazy(async () => ({
  default: (await import('../features/campaigns/pages')).CampaignListPage,
}));

const InvitationPage = lazy(async () => ({
  default: (await import('../features/campaigns/invitation-page'))
    .InvitationPage,
}));
const CharactersPage = lazy(async () => ({
  default: (await import('../features/campaigns/characters-page'))
    .CharactersPage,
}));
const NotesPage = lazy(async () => ({
  default: (await import('../features/campaigns/notes-page')).NotesPage,
}));
const MembersPage = lazy(async () => ({
  default: (await import('../features/campaigns/members-page')).MembersPage,
}));
const BoardPage = lazy(async () => ({
  default: (await import('../features/campaigns/board-page')).BoardPage,
}));
const BackgroundSettingsPage = lazy(async () => ({
  default: (await import('../features/campaigns/background-settings-page'))
    .BackgroundSettingsPage,
}));
const LocationsPage = lazy(async () => ({
  default: (await import('../features/campaigns/locations-page')).LocationsPage,
}));
const LocationViewerPage = lazy(async () => ({
  default: (await import('../features/campaigns/location-viewer-page'))
    .LocationViewerPage,
}));
const CampaignSettingsPage = lazy(async () => ({
  default: (await import('../features/campaigns/campaign-settings-page'))
    .CampaignSettingsPage,
}));
const AccountSettingsPage = lazy(async () => ({
  default: (await import('../features/account/account-settings-page'))
    .AccountSettingsPage,
}));

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
  const { t } = useTranslation();
  return (
    <Suspense
      fallback={<main className="page-state">{t('common.loading')}</main>}
    >
      <Routes>
        <Route element={<PublicOnlyRoute />}>
          <Route path="/sign-in" element={<AuthPage mode="sign-in" />} />
          <Route path="/sign-up" element={<AuthPage mode="sign-up" />} />
        </Route>
        <Route element={<ProtectedRoute />}>
          <Route path="/campaigns" element={<CampaignListPage />} />
          <Route path="/settings/account" element={<AccountSettingsPage />} />
          <Route
            path="/campaigns/:campaignId"
            element={<Navigate to="characters" replace />}
          />
          <Route path="/campaigns/:campaignId/board" element={<BoardPage />} />
          <Route
            path="/campaigns/:campaignId/locations"
            element={<LocationsPage />}
          />
          <Route
            path="/campaigns/:campaignId/locations/:locationId"
            element={<LocationViewerPage />}
          />
          <Route
            path="/campaigns/:campaignId/settings"
            element={<CampaignSettingsPage />}
          />
          <Route
            path="/campaigns/:campaignId/settings/backgrounds"
            element={<BackgroundSettingsPage />}
          />
          <Route
            path="/campaigns/:campaignId/characters"
            element={<CharactersPage />}
          />
          <Route path="/campaigns/:campaignId/notes" element={<NotesPage />} />
          <Route
            path="/campaigns/:campaignId/members"
            element={<MembersPage />}
          />
        </Route>
        <Route path="/invitations/:token" element={<InvitationEntry />} />
        <Route path="*" element={<Navigate to="/campaigns" replace />} />
      </Routes>
    </Suspense>
  );
}
