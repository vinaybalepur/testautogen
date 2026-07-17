import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import Login from './pages/auth/Login';
import Register from './pages/auth/Register';
import Dashboard from './pages/Dashboard';
import Generate from './pages/Generate';
import TestCases from './pages/TestCases';
import Postman from './pages/Postman';
import Runs from './pages/Runs';
import Defects from './pages/Defects';
import Admin from './pages/Admin';
import Tokens from './pages/Tokens';
import './styles/globals.css';

// ── Guard: redirect to /login if not authenticated ──
const PrivateRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="spinner-container" style={{ minHeight: '100vh' }}>
        <span className="spinner spinner-lg" />
        <span>Loading…</span>
      </div>
    );
  }
  return user ? <>{children}</> : <Navigate to="/login" replace />;
};

// ── Guard: redirect admins-only pages ──
const AdminRoute = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuth();
  if (user?.role !== 'admin') return <Navigate to="/" replace />;
  return <>{children}</>;
};

// ── Guard: redirect authenticated users away from auth pages ──
const PublicRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  if (loading) return null;
  return user ? <Navigate to="/" replace /> : <>{children}</>;
};

const AppRoutes: React.FC = () => (
  <Routes>
    {/* Public */}
    <Route path="/login"    element={<PublicRoute><Login /></PublicRoute>} />
    <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />

    {/* Protected — inside Layout */}
    <Route element={<PrivateRoute><Layout /></PrivateRoute>}>
      <Route index                element={<Dashboard />} />
      <Route path="generate"      element={<Generate />} />
      <Route path="test-cases"    element={<TestCases />} />
      <Route path="postman"       element={<Postman />} />
      <Route path="runs"          element={<Runs />} />
      <Route path="defects"       element={<Defects />} />
      <Route path="tokens"        element={<Tokens />} />
      <Route path="admin"         element={<AdminRoute><Admin /></AdminRoute>} />
    </Route>

    {/* Catch-all */}
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes>
);

const App: React.FC = () => (
  <BrowserRouter>
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  </BrowserRouter>
);

export default App;
