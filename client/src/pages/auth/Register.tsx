import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const Register: React.FC = () => {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    first_name: '', last_name: '', email: '', password: '', confirm: '',
  });
  const [error, setError]     = useState('');
  const [loading, setLoading] = useState(false);

  const set = (k: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement>) => setForm(f => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (form.password !== form.confirm) { setError('Passwords do not match'); return; }
    if (form.password.length < 8)       { setError('Password must be at least 8 characters'); return; }
    setLoading(true);
    try {
      await register(form.first_name, form.last_name, form.email, form.password);
      navigate('/');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Registration failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: '#0f172a', display: 'flex', flexDirection: 'column' }}>
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

      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 20px' }}>
        <div style={{ width: '100%', maxWidth: 440 }}>
          <div className="card">
            <div className="card-header">
              <div className="card-icon green">✨</div>
              <div>
                <div className="card-title">Create Account</div>
                <div className="card-subtitle">Join the TestSage platform</div>
              </div>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="grid-2">
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">First Name</label>
                  <input className="form-input" placeholder="John" value={form.first_name} onChange={set('first_name')} required />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Last Name</label>
                  <input className="form-input" placeholder="Doe" value={form.last_name} onChange={set('last_name')} required />
                </div>
              </div>

              <div className="form-group" style={{ marginTop: 14 }}>
                <label className="form-label">Email</label>
                <input type="email" className="form-input" placeholder="you@company.com" value={form.email} onChange={set('email')} required />
              </div>

              <div className="form-group">
                <label className="form-label">Password</label>
                <input type="password" className="form-input" placeholder="Min 8 characters" value={form.password} onChange={set('password')} required />
              </div>

              <div className="form-group">
                <label className="form-label">Confirm Password</label>
                <input type="password" className="form-input" placeholder="Repeat password" value={form.confirm} onChange={set('confirm')} required />
              </div>

              {error && <div className="status-msg error">{error}</div>}

              <div className="status-msg info" style={{ marginTop: 12 }}>
                💡 The first registered user is automatically promoted to <strong>Admin</strong>.
              </div>

              <button type="submit" className="btn btn-primary btn-full btn-lg" style={{ marginTop: 20 }} disabled={loading}>
                {loading ? <span className="spinner" /> : '🚀'} Create Account
              </button>
            </form>

            <div className="divider" />

            <p style={{ fontSize: '0.82em', color: '#64748b', textAlign: 'center' }}>
              Already have an account?{' '}
              <Link to="/login" style={{ color: '#a5b4fc', textDecoration: 'none', fontWeight: 500 }}>Sign in</Link>
            </p>
          </div>
        </div>
      </div>

      <footer className="app-footer">© TestSage Platform</footer>
    </div>
  );
};

export default Register;
