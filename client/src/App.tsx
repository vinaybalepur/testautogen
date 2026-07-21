import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './pages/auth/Login';
import Register from './pages/auth/Register';
import Home from './pages/Home';
import './styles/globals.css';

// Redirect to /login if not authenticated
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

// Redirect authenticated users away from login/register
const PublicRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  if (loading) return null;
  return user ? <Navigate to="/" replace /> : <>{children}</>;
};

const AppRoutes: React.FC = () => (
  <Routes>
    <Route path="/login"    element={<PublicRoute><Login /></PublicRoute>} />
    <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />
    <Route path="/"         element={<PrivateRoute><Home /></PrivateRoute>} />
    <Route path="*"         element={<Navigate to="/" replace />} />
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
