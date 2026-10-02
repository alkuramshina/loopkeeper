import { CampaignWorkspaceRoute } from '../features/campaigns/campaign-workspace-route';
import { lazy, Suspense } from 'react';
import {
  Navigate,
  Outlet,
  Route,
  Routes,
  useParams,
  useSearchParams,
} from 'react-router-dom';
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
const ElementsPage = lazy(async () => ({
  default: (await import('../features/campaigns/elements-page')).ElementsPage,
}));
const CasePage = lazy(async () => ({
  default: (await import('../features/campaigns/case-page')).CasePage,
}));
const NotesPage = lazy(async () => ({
  default: (await import('../features/campaigns/notes-page')).NotesPage,
}));
const InvitationsPage = lazy(async () => ({
  default: (await import('../features/campaigns/invitations-page'))
    .InvitationsPage,
}));
const MembersPage = lazy(async () => ({
  default: (await import('../features/campaigns/members-page')).MembersPage,
}));
const BoardPage = lazy(async () => ({
  default: (await import('../features/campaigns/board-page')).BoardPage,
}));

// Development only: `import.meta.env.DEV` is false in a production build, so
// the gallery and its styles are dropped from the bundle.
const UiGalleryPage = import.meta.env.DEV
  ? lazy(async () => ({
      default: (await import('../dev/ui-gallery-page')).UiGalleryPage,
    }))
  : null;

const CampaignSettingsPage = lazy(async () => ({
  default: (await import('../features/campaigns/campaign-settings-page'))
    .CampaignSettingsPage,
}));
const CampaignCoverPage = lazy(async () => ({
  default: (await import('../features/campaigns/campaign-settings-page'))
    .CampaignCoverPage,
}));
const CampaignDeletePage = lazy(async () => ({
  default: (await import('../features/campaigns/campaign-settings-page'))
    .CampaignDeletePage,
}));
const AccountSettingsPage = lazy(async () => ({
  default: (await import('../features/account/account-settings-page'))
    .AccountSettingsPage,
}));
const PasswordSettingsPage = lazy(async () => ({
  default: (await import('../features/account/account-settings-page'))
    .PasswordSettingsPage,
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
  const [searchParams] = useSearchParams();
  if (loading) return <main className="page-state">{t('common.loading')}</main>;
  if (!profile) return <Outlet />;
  // Signing in from an invitation link continues to that invitation.
  const invitation = searchParams.get('invitation');
  return (
    <Navigate
      to={
        invitation
          ? `/invitations/${encodeURIComponent(invitation)}`
          : '/campaigns'
      }
      replace
    />
  );
}

function InvitationEntry() {
  const { profile, loading } = useAuth();
  const { t } = useTranslation();
  const { token } = useParams();
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
          <Route path="/settings/password" element={<PasswordSettingsPage />} />
          <Route
            path="/campaigns/:campaignId"
            element={<CampaignWorkspaceRoute />}
          >
            <Route index element={<Navigate to="board" replace />} />
            <Route path="board" element={<BoardPage />} />
            <Route path="elements" element={<ElementsPage />} />
            <Route path="elements/:elementId" element={<ElementsPage />} />
            <Route path="case" element={<CasePage />} />
            <Route path="case/:elementId" element={<CasePage />} />
            <Route path="notes" element={<NotesPage />} />
            <Route path="notes/:elementId" element={<NotesPage />} />

            <Route path="settings" element={<CampaignSettingsPage />} />
            <Route path="settings/cover" element={<CampaignCoverPage />} />
            <Route path="settings/delete" element={<CampaignDeletePage />} />
            <Route path="characters" element={<CharactersPage />} />
            <Route
              path="characters/:characterId"
              element={<CharactersPage />}
            />

            <Route path="members" element={<MembersPage />} />
            <Route path="invitations" element={<InvitationsPage />} />
          </Route>
        </Route>
        <Route path="/invitations/:token" element={<InvitationEntry />} />
        {UiGalleryPage && <Route path="/dev/ui" element={<UiGalleryPage />} />}
        <Route path="*" element={<Navigate to="/campaigns" replace />} />
      </Routes>
    </Suspense>
  );
}
