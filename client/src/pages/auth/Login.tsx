import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const Login: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      navigate('/');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Login failed. Check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: '#0f172a', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <header className="app-header">
        <div className="header-logo">
          <svg viewBox="0 0 48 48" width="22" height="22">
            <circle cx="24" cy="24" r="24" fill="#5514B4"/>
            <path d="M14 14h8c3.3 0 6 2.7 6 6 0 2-1 3.7-2.5 4.8 2.3 1 3.5 3 3.5 5.2 0 3.3-2.7 6-6 6H14V14zm4 3.5v5h3.5c1.4 0 2.5-1.1 2.5-2.5s-1.1-2.5-2.5-2.5H18zm0 8.5v5.5h4.5c1.5 0 2.75-1.2 2.75-2.75S24 22 22.5 22H18z" fill="white"/>
            <path d="M30 16h6v2.5h-6V16zm0 5h6v2.5h-6V21zm0 5h6v2.5h-6V26z" fill="white" opacity="0.7"/>
          </svg>
        </div>
        <div className="header-title">
          <h1>TestAutoGen</h1>
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

      <footer className="app-footer">© TestAutoGen Platform</footer>
    </div>
  );
};

export default Login;
