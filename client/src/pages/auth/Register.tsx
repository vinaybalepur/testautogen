import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const Register: React.FC = () => {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({ first_name: '', last_name: '', email: '', password: '', confirm: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (form.password !== form.confirm) { setError('Passwords do not match'); return; }
    if (form.password.length < 8) { setError('Password must be at least 8 characters'); return; }
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

      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 20px' }}>
        <div style={{ width: '100%', maxWidth: 440 }}>
          <div className="card">
            <div className="card-header">
              <div className="card-icon green">✨</div>
              <div>
                <div className="card-title">Create Account</div>
                <div className="card-subtitle">Join the TestAutoGen platform</div>
              </div>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="grid-2" style={{ gap: 14 }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">First Name</label>
                  <input className="form-input" placeholder="Mainak" value={form.first_name} onChange={set('first_name')} required />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Last Name</label>
                  <input className="form-input" placeholder="Sengupta" value={form.last_name} onChange={set('last_name')} required />
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

      <footer className="app-footer">© TestAutoGen Platform</footer>
    </div>
  );
};

export default Register;
