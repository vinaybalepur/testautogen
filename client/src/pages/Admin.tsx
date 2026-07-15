import React, { useEffect, useState } from 'react';
import api from '../services/api';
import type { User } from '../types';

const Admin: React.FC = () => {
  const [users, setUsers]   = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<number | null>(null);
  const [status, setStatus] = useState<{ type: 'success'|'error'; msg: string } | null>(null);

  useEffect(() => { fetchUsers(); }, []);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/admin/users');
      setUsers(data.users || data || []);
    } catch (err: any) {
      setStatus({ type: 'error', msg: err.response?.data?.error || 'Failed to load users' });
    } finally { setLoading(false); }
  };

  const promote = async (id: number) => {
    setActionId(id);
    try {
      await api.put(`/admin/users/${id}/promote`);
      setUsers(u => u.map(x => x.id === id ? { ...x, role: 'admin' } : x));
      setStatus({ type: 'success', msg: 'User promoted to admin' });
    } catch (err: any) {
      setStatus({ type: 'error', msg: err.response?.data?.error || 'Failed' });
    } finally { setActionId(null); }
  };

  const demote = async (id: number) => {
    setActionId(id);
    try {
      await api.put(`/admin/users/${id}/demote`);
      setUsers(u => u.map(x => x.id === id ? { ...x, role: 'user' } : x));
      setStatus({ type: 'success', msg: 'User demoted to user role' });
    } catch (err: any) {
      setStatus({ type: 'error', msg: err.response?.data?.error || 'Failed' });
    } finally { setActionId(null); }
  };

  const toggle = async (id: number, current: boolean) => {
    if (!window.confirm(`${current ? 'Deactivate' : 'Activate'} this user?`)) return;
    setActionId(id);
    try {
      await api.put(`/admin/users/${id}/toggle`);
      setUsers(u => u.map(x => x.id === id ? { ...x, is_active: !current } : x));
      setStatus({ type: 'success', msg: `User ${current ? 'deactivated' : 'activated'}` });
    } catch (err: any) {
      setStatus({ type: 'error', msg: err.response?.data?.error || 'Failed' });
    } finally { setActionId(null); }
  };

  const stats = {
    total:   users.length,
    admin:   users.filter(u => u.role === 'admin').length,
    active:  users.filter(u => u.is_active).length,
    inactive: users.filter(u => !u.is_active).length,
  };

  return (
    <div className="page-container">
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: '1.3em', fontWeight: 600, color: '#e2e8f0' }}>🛡️ Admin Panel</h2>
        <p style={{ color: '#64748b', marginTop: 4, fontSize: '0.88em' }}>Manage users, roles and access</p>
      </div>

      {/* Stats */}
      <div className="grid-4" style={{ marginBottom: 24 }}>
        {[
          { label: 'Total Users',   val: stats.total,    color: 'purple' },
          { label: 'Admins',        val: stats.admin,    color: 'blue' },
          { label: 'Active',        val: stats.active,   color: 'green' },
          { label: 'Inactive',      val: stats.inactive, color: 'red' },
        ].map(s => (
          <div key={s.label} className={`stat-card ${s.color}`}>
            <div className="stat-value" style={{ fontSize: '1.8em', color: '#e2e8f0' }}>{s.val}</div>
            <div className="stat-label">{s.label}</div>
          </div>
        ))}
      </div>

      {status && <div className={`status-msg ${status.type}`} style={{ marginBottom: 16 }}>{status.msg}</div>}

      {loading ? (
        <div className="spinner-container">
          <span className="spinner spinner-lg" />
          <span>Loading users…</span>
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #1e293b', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: 600, fontSize: '0.9em', color: '#e2e8f0' }}>All Users</span>
            <button className="btn btn-outline btn-sm" onClick={fetchUsers}>↻ Refresh</button>
          </div>
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>User</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Last Login</th>
                  <th>Joined</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{
                          width: 30, height: 30, borderRadius: '50%',
                          background: u.role === 'admin'
                            ? 'linear-gradient(135deg, #6366f1, #8b5cf6)'
                            : 'linear-gradient(135deg, #334155, #475569)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: '0.72em', fontWeight: 600, color: '#fff', flexShrink: 0,
                        }}>
                          {u.first_name?.[0]}{u.last_name?.[0]}
                        </div>
                        <div>
                          <div style={{ fontWeight: 500, fontSize: '0.88em', color: '#e2e8f0' }}>
                            {u.first_name} {u.last_name}
                          </div>
                          <div style={{ fontSize: '0.72em', color: '#64748b' }}>ID: {u.id}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ fontSize: '0.85em', color: '#94a3b8' }}>{u.email}</td>
                    <td>
                      <span className={`badge badge-${u.role === 'admin' ? 'purple' : 'gray'}`}>
                        {u.role}
                      </span>
                    </td>
                    <td>
                      <span className={`badge badge-${u.is_active ? 'green' : 'red'}`}>
                        {u.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td style={{ fontSize: '0.8em', color: '#64748b' }}>
                      {u.last_login_at ? new Date(u.last_login_at).toLocaleDateString() : 'Never'}
                    </td>
                    <td style={{ fontSize: '0.8em', color: '#64748b', whiteSpace: 'nowrap' }}>
                      {new Date(u.created_at).toLocaleDateString()}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                        {u.role !== 'admin' ? (
                          <button className="btn btn-outline btn-sm" onClick={() => promote(u.id)} disabled={actionId === u.id} title="Promote to Admin">
                            {actionId === u.id ? <span className="spinner" /> : '⬆️'}
                          </button>
                        ) : (
                          <button className="btn btn-outline btn-sm" onClick={() => demote(u.id)} disabled={actionId === u.id} title="Demote to User">
                            {actionId === u.id ? <span className="spinner" /> : '⬇️'}
                          </button>
                        )}
                        <button
                          className={`btn btn-sm ${u.is_active ? 'btn-danger' : 'btn-success'}`}
                          onClick={() => toggle(u.id, u.is_active)}
                          disabled={actionId === u.id}
                          title={u.is_active ? 'Deactivate' : 'Activate'}
                          style={{ opacity: 0.85 }}
                        >
                          {u.is_active ? '🚫' : '✅'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default Admin;
