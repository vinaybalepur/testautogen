import React, { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const NAV = [
  { label: 'Main', items: [
    { to: '/',          icon: '🏠', label: 'Dashboard' },
    { to: '/generate',  icon: '⚡', label: 'Generate Tests' },
  ]},
  { label: 'Test Artifacts', items: [
    { to: '/test-cases',   icon: '📋', label: 'Test Cases' },
    { to: '/postman',      icon: '📦', label: 'Postman Collections' },
    { to: '/runs',         icon: '▶️', label: 'Test Runs' },
    { to: '/defects',      icon: '🐛', label: 'Defects' },
  ]},
  { label: 'Admin', items: [
    { to: '/admin',   icon: '🛡️', label: 'Admin Panel' },
    { to: '/tokens',  icon: '🤖', label: 'Token Usage' },
  ]},
];

const Layout: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [profileOpen, setProfileOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="app-layout">
      {/* Sidebar */}
      <aside className="sidebar">
        {/* Logo in sidebar */}
        <div style={{ padding: '0 20px 20px', borderBottom: '1px solid #1e293b', marginBottom: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div className="header-logo" style={{ width: 34, height: 34, borderRadius: 8 }}>
              <svg viewBox="0 0 48 48" width="18" height="18">
                <circle cx="24" cy="24" r="24" fill="#5514B4"/>
                <path d="M14 14h8c3.3 0 6 2.7 6 6 0 2-1 3.7-2.5 4.8 2.3 1 3.5 3 3.5 5.2 0 3.3-2.7 6-6 6H14V14zm4 3.5v5h3.5c1.4 0 2.5-1.1 2.5-2.5s-1.1-2.5-2.5-2.5H18zm0 8.5v5.5h4.5c1.5 0 2.75-1.2 2.75-2.75S24 22 22.5 22H18z" fill="white"/>
                <path d="M30 16h6v2.5h-6V16zm0 5h6v2.5h-6V21zm0 5h6v2.5h-6V26z" fill="white" opacity="0.7"/>
              </svg>
            </div>
            <div>
              <div style={{ fontSize: '0.85em', fontWeight: 600, color: '#e2e8f0' }}>TestAutoGen</div>
              <div style={{ fontSize: '0.68em', color: '#64748b' }}>AI Test Platform</div>
            </div>
          </div>
        </div>

        {/* Nav */}
        {NAV.map(section => {
          // Hide admin section for non-admins
          if (section.label === 'Admin' && user?.role !== 'admin') return null;
          return (
            <div key={section.label}>
              <div className="sidebar-section-label">{section.label}</div>
              {section.items.map(item => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/'}
                  className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
                >
                  <span className="nav-icon">{item.icon}</span>
                  {item.label}
                </NavLink>
              ))}
            </div>
          );
        })}

        {/* User profile at bottom */}
        <div className="sidebar-footer">
          <div
            style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', padding: '8px 0' }}
            onClick={() => setProfileOpen(p => !p)}
          >
            <div style={{
              width: 32, height: 32, borderRadius: '50%',
              background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '0.8em', fontWeight: 600, color: '#fff', flexShrink: 0
            }}>
              {user?.first_name?.[0]?.toUpperCase()}{user?.last_name?.[0]?.toUpperCase()}
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: '0.82em', fontWeight: 500, color: '#e2e8f0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {user?.first_name} {user?.last_name}
              </div>
              <div style={{ fontSize: '0.7em', color: '#64748b' }}>
                <span className={`badge badge-${user?.role === 'admin' ? 'purple' : 'gray'}`} style={{ padding: '1px 6px', fontSize: '0.85em' }}>
                  {user?.role}
                </span>
              </div>
            </div>
          </div>

          {profileOpen && (
            <div style={{ marginTop: 8, padding: '8px 0', borderTop: '1px solid #1e293b' }}>
              <NavLink to="/tokens" className="nav-item" style={{ padding: '7px 0', fontSize: '0.8em' }}>
                <span className="nav-icon">📊</span> My Token Usage
              </NavLink>
              <button className="nav-item" style={{ color: '#ef4444', padding: '7px 0', fontSize: '0.8em' }} onClick={handleLogout}>
                <span className="nav-icon">🚪</span> Logout
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* Main area */}
      <div className="main-content">
        {/* Top bar */}
        <header className="app-header" style={{ padding: '12px 32px' }}>
          <div style={{ flex: 1 }} />
          <div className="header-actions">
            <span style={{ fontSize: '0.78em', color: '#64748b' }}>
              {user?.email}
            </span>
            <button className="btn btn-outline btn-sm" onClick={handleLogout}>
              Logout
            </button>
          </div>
        </header>

        {/* Page content */}
        <main style={{ flex: 1, overflowY: 'auto' }}>
          <Outlet />
        </main>

        <footer className="app-footer">
          © TestAutoGen Platform
        </footer>
      </div>
    </div>
  );
};

export default Layout;
