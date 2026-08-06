import React, { useState, useEffect } from 'react';
import { useNavigate }                  from 'react-router-dom';
import { useAuth }                      from '../context/AuthContext';
import api                              from '../services/api';

interface UserRow {
  id:            number;
  first_name:    string;
  last_name:     string;
  email:         string;
  role:          'admin' | 'user';
  is_active:     boolean;
  last_login_at: string | null;
  created_at:    string;
}

const AdminPanel: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate           = useNavigate();

  const [users, setUsers]           = useState<UserRow[]>([]);
  const [loading, setLoading]       = useState(true);
  const [actionLoading, setActionLoading] = useState<Record<number, boolean>>({});
  const [msg, setMsg]               = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [confirmModal, setConfirmModal] = useState<{
    type:    'promote' | 'demote' | 'toggle';
    userId:  number;
    userName: string;
    currentlyActive?: boolean;
  } | null>(null);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/admin/users');
      setUsers(data.users);
    } catch (err) {
      console.error('Failed to fetch users:', err);
    } finally {
      setLoading(false);
    }
  };

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMsg({ type, text });
    setTimeout(() => setMsg(null), 4000);
  };

  const runAction = async () => {
    if (!confirmModal) return;
    const { type, userId } = confirmModal;

    setActionLoading(prev => ({ ...prev, [userId]: true }));
    try {
      if (type === 'promote') {
        await api.put(`/admin/users/${userId}/promote`);
        showMessage('success', 'User promoted to admin');
      } else if (type === 'demote') {
        await api.put(`/admin/users/${userId}/demote`);
        showMessage('success', 'User demoted to regular user');
      } else if (type === 'toggle') {
        await api.put(`/admin/users/${userId}/toggle`);
        showMessage('success', confirmModal.currentlyActive ? 'User deactivated' : 'User activated');
      }
      fetchUsers();
    } catch (err: any) {
      showMessage('error', err.response?.data?.error || 'Action failed');
    } finally {
      setActionLoading(prev => ({ ...prev, [userId]: false }));
      setConfirmModal(null);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const isSelf = (id: number) => user?.id === id;

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
        <div className="header-title" style={{ flex: 1 }}>
          <h1>TestSage</h1>
          <p>AI-powered Test Automation Platform</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button onClick={() => navigate('/')} className="btn btn-secondary btn-sm">
            ← Dashboard
          </button>
          <span style={{ fontSize: '0.8em', color: 'var(--text-secondary)' }}>
            👤 {user?.first_name}
          </span>
          <button onClick={handleLogout} className="btn btn-secondary btn-sm">
            Logout
          </button>
        </div>
      </header>

      {/* Main Content */}
      <div style={{ flex: 1, padding: '40px 24px', maxWidth: 900, margin: '0 auto', width: '100%' }}>

        {/* Page Header */}
        <div style={{ marginBottom: 24 }}>
          <h2 style={{ fontSize: '1.4em', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>
            👥 Admin Panel
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9em' }}>
            Manage user roles and account status.
          </p>
        </div>

        {msg && (
          <div className={`status-msg ${msg.type}`} style={{ marginBottom: 16 }}>
            {msg.text}
          </div>
        )}

        {loading ? (
          <div className="spinner-container">
            <span className="spinner spinner-lg" />
            <span>Loading users...</span>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {users.map(u => (
              <div key={u.id} className="card" style={{ padding: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>

                  {/* Avatar */}
                  <div style={{
                    width:          40,
                    height:         40,
                    borderRadius:   '50%',
                    background:     'linear-gradient(135deg, #6366f1, #8b5cf6)',
                    display:        'flex',
                    alignItems:     'center',
                    justifyContent: 'center',
                    color:          'white',
                    fontWeight:     700,
                    fontSize:       '0.95em',
                    flexShrink:     0
                  }}>
                    {u.first_name?.[0]?.toUpperCase()}{u.last_name?.[0]?.toUpperCase()}
                  </div>

                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 180 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontWeight: 600, fontSize: '0.92em', color: 'var(--text-primary)' }}>
                        {u.first_name} {u.last_name}
                      </span>
                      {isSelf(u.id) && (
                        <span style={{
                          fontSize:     '0.68em',
                          padding:      '1px 6px',
                          borderRadius: 8,
                          background:   'var(--bg-primary)',
                          color:        'var(--text-secondary)'
                        }}>
                          you
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: '0.78em', color: 'var(--text-secondary)' }}>
                      {u.email}
                    </div>
                  </div>

                  {/* Role badge */}
                  <span style={{
                    fontSize:     '0.75em',
                    padding:      '3px 10px',
                    borderRadius: 20,
                    background:   u.role === 'admin' ? 'rgba(99,102,241,0.1)' : 'var(--bg-primary)',
                    color:        u.role === 'admin' ? '#6366f1' : 'var(--text-secondary)',
                    fontWeight:   500,
                    textTransform: 'capitalize'
                  }}>
                    {u.role === 'admin' ? '👑 Admin' : 'User'}
                  </span>

                  {/* Status badge */}
                  <span className={`badge ${u.is_active ? 'badge-approved' : 'badge-draft'}`}>
                    {u.is_active ? '✅ Active' : '⚪ Inactive'}
                  </span>

                  {/* Last login */}
                  <span style={{ fontSize: '0.75em', color: 'var(--text-secondary)', minWidth: 130 }}>
                    {u.last_login_at
                      ? `Last login ${new Date(u.last_login_at).toLocaleDateString()}`
                      : 'Never logged in'}
                  </span>

                  {/* Actions */}
                  <div style={{ display: 'flex', gap: 8 }}>
                    {u.role === 'user' ? (
                      <button
                        onClick={() => setConfirmModal({ type: 'promote', userId: u.id, userName: `${u.first_name} ${u.last_name}` })}
                        className="btn btn-secondary btn-sm"
                        disabled={isSelf(u.id) || actionLoading[u.id]}
                        title={isSelf(u.id) ? "You can't change your own role" : 'Promote to admin'}
                      >
                        ⬆️ Promote
                      </button>
                    ) : (
                      <button
                        onClick={() => setConfirmModal({ type: 'demote', userId: u.id, userName: `${u.first_name} ${u.last_name}` })}
                        className="btn btn-secondary btn-sm"
                        disabled={isSelf(u.id) || actionLoading[u.id]}
                        title={isSelf(u.id) ? "You can't change your own role" : 'Demote to user'}
                      >
                        ⬇️ Demote
                      </button>
                    )}

                    <button
                      onClick={() => setConfirmModal({
                        type: 'toggle',
                        userId: u.id,
                        userName: `${u.first_name} ${u.last_name}`,
                        currentlyActive: u.is_active
                      })}
                      className={`btn btn-sm ${u.is_active ? 'btn-danger' : 'btn-success'}`}
                      disabled={isSelf(u.id) || actionLoading[u.id]}
                      title={isSelf(u.id) ? "You can't deactivate your own account" : (u.is_active ? 'Deactivate' : 'Activate')}
                    >
                      {actionLoading[u.id]
                        ? <span className="spinner" />
                        : u.is_active ? '🚫 Deactivate' : '✅ Activate'}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

      </div>

      <footer className="app-footer">© TestSage Platform</footer>

      {/* Confirm Modal */}
      {confirmModal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-title">
              {confirmModal.type === 'promote' && '⬆️ Promote to Admin?'}
              {confirmModal.type === 'demote'  && '⬇️ Demote to User?'}
              {confirmModal.type === 'toggle'  && (confirmModal.currentlyActive ? '🚫 Deactivate User?' : '✅ Activate User?')}
            </div>
            <p style={{ fontSize: '0.9em', color: 'var(--text-secondary)' }}>
              {confirmModal.type === 'promote' && (
                <>Give <strong>{confirmModal.userName}</strong> admin privileges? They will be able to manage APIs, discovery, and other admin-only features.</>
              )}
              {confirmModal.type === 'demote' && (
                <>Remove admin privileges from <strong>{confirmModal.userName}</strong>?</>
              )}
              {confirmModal.type === 'toggle' && confirmModal.currentlyActive && (
                <><strong>{confirmModal.userName}</strong> will no longer be able to log in.</>
              )}
              {confirmModal.type === 'toggle' && !confirmModal.currentlyActive && (
                <><strong>{confirmModal.userName}</strong> will be able to log in again.</>
              )}
            </p>
            <div className="modal-actions">
              <button onClick={() => setConfirmModal(null)} className="btn btn-secondary">
                Cancel
              </button>
              <button
                onClick={runAction}
                className={confirmModal.type === 'toggle' && confirmModal.currentlyActive ? 'btn btn-danger' : 'btn btn-primary'}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default AdminPanel;
