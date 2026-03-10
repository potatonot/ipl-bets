import React, { useEffect } from 'react';
import { HashRouter as BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './hooks/useAuth';
import Navbar from './components/Navbar';
import AuthPage from './pages/AuthPage';
import MatchesPage from './pages/MatchesPage';
import MatchDetailPage from './pages/MatchDetailPage';
import ProfilePage from './pages/ProfilePage';
import LeaderboardPage from './pages/LeaderboardPage';
import AdminPage from './pages/AdminPage';
import { startKeepAlive, stopKeepAlive } from './lib/supabase';

const SessionLoader = () => (
  <div style={{
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'var(--bg)',
    flexDirection: 'column',
    gap: '16px',
  }}>
    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '15px', color: 'var(--accent)', letterSpacing: '0.1em' }}>
      IPL·BETS
    </div>
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--text-3)', fontSize: '13px' }}>
      <div className="spinner" />
      Loading...
    </div>
  </div>
);

const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return <SessionLoader />;
  if (!user) return <Navigate to="/auth" replace />;
  return children;
};

const PublicRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return <SessionLoader />;
  if (user) return <Navigate to="/matches" replace />;
  return children;
};

const AppInner = () => {
  const { user, loading } = useAuth();

  // Start keepalive when logged in, stop when logged out
  useEffect(() => {
    if (user) {
      startKeepAlive();
    } else {
      stopKeepAlive();
    }
  }, [user]);

  if (loading) return <SessionLoader />;

  return (
    <div className="app-layout">
      {user && <Navbar />}
      <Routes>
        <Route path="/auth" element={<PublicRoute><AuthPage /></PublicRoute>} />
        <Route path="/matches" element={<ProtectedRoute><MatchesPage /></ProtectedRoute>} />
        <Route path="/matches/:id" element={<ProtectedRoute><MatchDetailPage /></ProtectedRoute>} />
        <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
        <Route path="/leaderboard" element={<ProtectedRoute><LeaderboardPage /></ProtectedRoute>} />
        <Route path="/admin" element={<ProtectedRoute><AdminPage /></ProtectedRoute>} />
        <Route path="*" element={<Navigate to={user ? "/matches" : "/auth"} replace />} />
      </Routes>
    </div>
  );
};

const App = () => (
  <BrowserRouter>
    <AuthProvider>
      <AppInner />
    </AuthProvider>
  </BrowserRouter>
);

export default App;
