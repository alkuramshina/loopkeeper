import { Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { useAuth } from '../auth/auth-context';
import { CampaignListPage, CampaignWorkspacePage } from '../features/campaigns/pages';
import { AuthPage } from '../auth/auth-page';

function ProtectedRoute() {
  const { profile, loading } = useAuth();
  if (loading) return <main className="page-state">Загрузка…</main>;
  return profile ? <Outlet /> : <Navigate to="/sign-in" replace />;
}

function PublicOnlyRoute() {
  const { profile, loading } = useAuth();
  if (loading) return <main className="page-state">Загрузка…</main>;
  return profile ? <Navigate to="/campaigns" replace /> : <Outlet />;
}

export function AppRouter() {
  return <Routes>
    <Route element={<PublicOnlyRoute />}>
      <Route path="/sign-in" element={<AuthPage mode="sign-in" />} />
      <Route path="/sign-up" element={<AuthPage mode="sign-up" />} />
    </Route>
    <Route element={<ProtectedRoute />}>
      <Route path="/campaigns" element={<CampaignListPage />} />
      <Route path="/campaigns/:campaignId" element={<CampaignWorkspacePage />} />
    </Route>
    <Route path="*" element={<Navigate to="/campaigns" replace />} />
  </Routes>;
}
