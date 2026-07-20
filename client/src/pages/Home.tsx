import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const Home: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
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
        <div className="header-title" style={{ flex: 1 }}>
          <h1>TestAutoGen</h1>
          <p>AI-powered Test Automation Platform</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: '0.8em', color: '#64748b' }}>
            👤 {user?.first_name} {user?.last_name}
          </span>
          <button
            onClick={handleLogout}
            style={{
              padding: '7px 14px', borderRadius: 8, border: '1px solid #334155',
              background: 'transparent', color: '#e2e8f0', cursor: 'pointer',
              fontFamily: 'Inter', fontSize: '0.82em', transition: 'all 0.2s',
            }}
          >
            Logout
          </button>
        </div>
      </header>

      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40 }}>
        <div style={{ textAlign: 'center', maxWidth: 500 }}>
          {/* Welcome card */}
          <div style={{
            width: 72, height: 72, borderRadius: '50%',
            background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '2em', margin: '0 auto 20px',
            boxShadow: '0 0 30px rgba(99,102,241,0.4)',
          }}>
            🚀
          </div>

          <h2 style={{ fontSize: '1.5em', fontWeight: 600, color: '#e2e8f0', marginBottom: 8 }}>
            Welcome, {user?.first_name}! 👋
          </h2>
          <p style={{ color: '#64748b', fontSize: '0.9em', marginBottom: 32 }}>
            You're successfully logged in as{' '}
            <span style={{
              display: 'inline-block', padding: '2px 10px', borderRadius: 12,
              background: user?.role === 'admin' ? 'rgba(99,102,241,0.15)' : 'rgba(100,116,139,0.15)',
              color: user?.role === 'admin' ? '#a5b4fc' : '#94a3b8',
              fontSize: '0.88em', fontWeight: 500,
            }}>
              {user?.role}
            </span>
          </p>

          <div style={{
            background: '#1e293b', border: '1px solid #334155', borderRadius: 12,
            padding: 20, textAlign: 'left',
          }}>
            <div style={{ fontSize: '0.78em', color: '#64748b', marginBottom: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Session Info
            </div>
            {[
              { label: 'Name',  value: `${user?.first_name} ${user?.last_name}` },
              { label: 'Email', value: user?.email },
              { label: 'Role',  value: user?.role },
              { label: 'ID',    value: `#${user?.id}` },
            ].map(row => (
              <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid #0f172a' }}>
                <span style={{ fontSize: '0.83em', color: '#64748b' }}>{row.label}</span>
                <span style={{ fontSize: '0.83em', color: '#e2e8f0', fontWeight: 500 }}>{row.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <footer className="app-footer">© TestAutoGen Platform</footer>
    </div>
  );
};

export default Home;
