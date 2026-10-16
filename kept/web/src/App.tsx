import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useStore } from './store';
import { AuthPage } from './pages/Auth';
import { Discover } from './pages/Discover';
import { Today } from './pages/Today';
import { CommunityLayout } from './pages/CommunityLayout';
import { MockCheckout } from './pages/MockCheckout';
import { CreateCommunity } from './pages/CreateCommunity';
import { Profile } from './pages/Profile';
import { InvitePage } from './pages/Invite';
import { AppShell } from './pages/AppShell';

export default function App() {
  const { user, loading } = useStore();
  const loc = useLocation();
  if (loading) return <div className="auth"><div className="muted">Loading…</div></div>;
  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <AuthPage mode="login" />} />
      <Route path="/register" element={user ? <Navigate to="/" replace /> : <AuthPage mode="register" />} />
      <Route path="/discover" element={<Discover />} />
      <Route path="/invite/:code" element={<InvitePage />} />
      <Route path="/checkout/mock/:id" element={user ? <MockCheckout /> : <Navigate to={`/login?next=${encodeURIComponent(loc.pathname)}`} replace />} />
      <Route path="/c/:slug/*" element={<CommunityLayout />} />
      <Route element={user ? <AppShell /> : <Navigate to="/discover" replace />}>
        <Route path="/" element={<Today />} />
        <Route path="/new" element={<CreateCommunity />} />
        <Route path="/me" element={<Profile />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
