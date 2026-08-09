import React, { useState, useEffect } from 'react';
import { Link, useNavigate }           from 'react-router-dom';
import { useAuth }                     from '../../context/AuthContext';

const Login: React.FC = () => {
  const { login, user } = useAuth();
  const navigate         = useNavigate();

  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);

  // Already logged in → redirect
  useEffect(() => {
    if (user) navigate('/dashboard');
  }, [user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Client side validation
    if (!email.trim()) {
      setError('Email is required');
      return;
    }
    if (!password) {
      setError('Password is required');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    setLoading(true);
    try {
      await login(email, password);
      navigate('/dashboard');
    } catch (err: any) {
      const code    = err.response?.data?.code;
      const message = err.response?.data?.error;

      if (code === 'TOKEN_EXPIRED') {
        setError('Session expired. Please login again.');
      } else if (err.response?.status === 401) {
        setError('Invalid email or password.');
      } else if (!err.response) {
        setError('Cannot connect to server. Please try again.');
      } else {
        setError(message || 'Login failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <header className="app-header">
        <div className="header-logo">
          <svg viewBox="0 0 48 48" width="60" height="60">
            <circle cx="24" cy="24" r="24" fill="#3ea829" />
            <g opacity="0.35" transform="translate(24,24) rotate(45)">
              <path d="M0 -13.8 Q3.9 -7.8 3.9 1.7 L-3.9 1.7 Q-3.9 -7.8 0 -13.8 Z" fill="#1a1a1a" />
              <path d="M-3.9 -1.7 L-8.2 3.5 L-3.9 3.5 Z" fill="#1a1a1a" />
              <path d="M3.9 -1.7 L8.2 3.5 L3.9 3.5 Z" fill="#1a1a1a" />
              <circle cx="0" cy="-6" r="1.7" fill="#1E3A8A" />
              <path d="M-2.6 1.7 L-3.9 8.6 L-1.3 5.2 Z" fill="#1a1a1a" />
              <path d="M2.6 1.7 L3.9 8.6 L1.3 5.2 Z" fill="#1a1a1a" />
            </g>
            <text x="20.5" y="31" textAnchor="end" fontFamily="sans-serif" fontWeight="700" fontSize="20" fill="#1a1a1a">T</text>
            <text x="20.5" y="32" textAnchor="start" fontFamily="sans-serif" fontWeight="700" fontSize="18" fill="#1a1a1a">s</text>
          </svg>
        </div>
        <div className="header-title">
          <h1>TestSage</h1>
          <p>AI-powered Test Automation Platform</p>
        </div>
      </header>

      {/* Form */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 20px' }}>
        <div style={{ width: '100%', maxWidth: 420 }}>
          <div className="card">
            <div className="card-header">
              <div className="card-icon purple">🔐</div>
              <div>
                <div className="card-title">Sign In</div>
                <div className="card-subtitle">Welcome back — enter your credentials</div>
              </div>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">Email</label>
                <input
                  type="email"
                  className="form-input"
                  placeholder="you@company.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  autoFocus
                  disabled={loading}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Password</label>
                <input
                  type="password"
                  className="form-input"
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>

              {error && <div className="status-msg error">{error}</div>}

              <button
                type="submit"
                className="btn btn-primary btn-full btn-lg"
                style={{ marginTop: 20 }}
                disabled={loading}
              >
                {loading ? <span className="spinner" /> : '🔓'} Sign In
              </button>
            </form>

            <div className="divider" />

            <p style={{ fontSize: '0.82em', color: '#64748b', textAlign: 'center' }}>
              Don't have an account?{' '}
              <Link to="/register" style={{ color: '#a5b4fc', textDecoration: 'none', fontWeight: 500 }}>
                Create account
              </Link>
            </p>
          </div>
        </div>
      </div>

      <footer className="app-footer">© TestSage Platform</footer>
    </div>
  );
};

export default Login;