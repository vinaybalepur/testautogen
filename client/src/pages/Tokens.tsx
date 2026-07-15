import React, { useEffect, useState } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import type { TokenUsage } from '../types';

interface TokenSummary {
  totalTokens: number;
  totalRequests: number;
  byProvider: Record<string, number>;
  byAction: Record<string, number>;
  recent: TokenUsage[];
}

const Tokens: React.FC = () => {
  const { user } = useAuth();
  const [myData, setMyData]   = useState<TokenSummary | null>(null);
  const [allData, setAllData] = useState<any[]>([]);
  const [tab, setTab]         = useState<'my' | 'all'>('my');
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');

  useEffect(() => {
    fetchMyTokens();
    if (user?.role === 'admin') fetchAllTokens();
  }, [user]);

  const fetchMyTokens = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/tokens/my');
      setMyData(data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load token usage');
    } finally { setLoading(false); }
  };

  const fetchAllTokens = async () => {
    try {
      const { data } = await api.get('/tokens/all');
      setAllData(Array.isArray(data) ? data : data.users ?? []);
    } catch {}
  };

  const PROVIDER_COLORS: Record<string, string> = {
    copilot: '#6366f1',
    gemini:  '#10b981',
    claude:  '#f59e0b',
  };

  return (
    <div className="page-container">
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: '1.3em', fontWeight: 600, color: '#e2e8f0' }}>🤖 Token Usage</h2>
        <p style={{ color: '#64748b', marginTop: 4, fontSize: '0.88em' }}>Track AI token consumption by provider and action</p>
      </div>

      {user?.role === 'admin' && (
        <div className="tabs" style={{ marginBottom: 24 }}>
          <button className={`tab-btn ${tab === 'my' ? 'active' : ''}`} onClick={() => setTab('my')}>👤 My Usage</button>
          <button className={`tab-btn ${tab === 'all' ? 'active' : ''}`} onClick={() => setTab('all')}>🛡️ All Users</button>
        </div>
      )}

      {error && <div className="status-msg error" style={{ marginBottom: 16 }}>{error}</div>}

      {/* My Usage */}
      {tab === 'my' && (
        loading ? (
          <div className="spinner-container"><span className="spinner spinner-lg" /><span>Loading…</span></div>
        ) : myData ? (
          <>
            {/* Summary stats */}
            <div className="grid-4" style={{ marginBottom: 24 }}>
              {[
                { label: 'Total Tokens',   val: myData.totalTokens?.toLocaleString()   ?? '0', color: 'purple', icon: '🤖' },
                { label: 'Total Requests', val: myData.totalRequests?.toString()        ?? '0', color: 'blue',   icon: '📡' },
                { label: 'Providers Used', val: Object.keys(myData.byProvider ?? {}).length, color: 'teal',   icon: '⚡' },
                { label: 'Actions Logged', val: Object.keys(myData.byAction ?? {}).length,   color: 'orange', icon: '📋' },
              ].map(s => (
                <div key={s.label} className={`stat-card ${s.color}`}>
                  <div className="stat-icon">{s.icon}</div>
                  <div className="stat-value" style={{ fontSize: '1.6em', color: '#e2e8f0' }}>{s.val}</div>
                  <div className="stat-label">{s.label}</div>
                </div>
              ))}
            </div>

            <div className="grid-2" style={{ gap: 16, marginBottom: 24 }}>
              {/* By Provider */}
              <div className="card">
                <div className="card-header">
                  <div className="card-icon purple">⚡</div>
                  <div>
                    <div className="card-title">By Provider</div>
                    <div className="card-subtitle">Token consumption per AI provider</div>
                  </div>
                </div>
                {Object.entries(myData.byProvider ?? {}).length === 0 ? (
                  <div style={{ color: '#64748b', fontSize: '0.85em' }}>No data yet</div>
                ) : Object.entries(myData.byProvider ?? {}).map(([provider, tokens]) => {
                  const total = myData.totalTokens || 1;
                  const pct = Math.round((tokens as number / total) * 100);
                  return (
                    <div key={provider} style={{ marginBottom: 14 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.83em', marginBottom: 5 }}>
                        <span style={{ color: '#e2e8f0', fontWeight: 500, textTransform: 'capitalize' }}>{provider}</span>
                        <span style={{ color: '#94a3b8' }}>{(tokens as number).toLocaleString()} tokens ({pct}%)</span>
                      </div>
                      <div className="progress-bar">
                        <div
                          className="progress-fill purple"
                          style={{ width: `${pct}%`, background: PROVIDER_COLORS[provider] || '#6366f1' }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* By Action */}
              <div className="card">
                <div className="card-header">
                  <div className="card-icon blue">📋</div>
                  <div>
                    <div className="card-title">By Action</div>
                    <div className="card-subtitle">Tokens used per operation type</div>
                  </div>
                </div>
                {Object.entries(myData.byAction ?? {}).length === 0 ? (
                  <div style={{ color: '#64748b', fontSize: '0.85em' }}>No data yet</div>
                ) : Object.entries(myData.byAction ?? {}).map(([action, tokens]) => {
                  const total = myData.totalTokens || 1;
                  const pct = Math.round((tokens as number / total) * 100);
                  return (
                    <div key={action} style={{ marginBottom: 14 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.83em', marginBottom: 5 }}>
                        <span style={{ color: '#e2e8f0', fontWeight: 500 }}>{action}</span>
                        <span style={{ color: '#94a3b8' }}>{(tokens as number).toLocaleString()}</span>
                      </div>
                      <div className="progress-bar">
                        <div className="progress-fill purple" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Recent usage */}
            {myData.recent && myData.recent.length > 0 && (
              <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <div style={{ padding: '14px 20px', borderBottom: '1px solid #1e293b' }}>
                  <span style={{ fontWeight: 600, fontSize: '0.88em', color: '#e2e8f0' }}>Recent Activity</span>
                </div>
                <div className="table-wrapper">
                  <table>
                    <thead>
                      <tr>
                        <th>Provider</th>
                        <th>Model</th>
                        <th>Action</th>
                        <th>Tokens</th>
                        <th>Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {myData.recent.map(r => (
                        <tr key={r.id}>
                          <td>
                            <span className={`badge badge-${r.provider === 'gemini' ? 'green' : r.provider === 'claude' ? 'orange' : 'purple'}`}>
                              {r.provider}
                            </span>
                          </td>
                          <td style={{ fontSize: '0.82em', color: '#94a3b8' }}>{r.model_version}</td>
                          <td style={{ fontSize: '0.82em', color: '#e2e8f0' }}>{r.action}</td>
                          <td>
                            <span style={{ fontWeight: 600, color: '#a5b4fc' }}>{r.tokens_consumed.toLocaleString()}</span>
                          </td>
                          <td style={{ fontSize: '0.8em', color: '#64748b', whiteSpace: 'nowrap' }}>
                            {new Date(r.created_at).toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        ) : null
      )}

      {/* All Users (admin) */}
      {tab === 'all' && user?.role === 'admin' && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid #1e293b' }}>
            <span style={{ fontWeight: 600, fontSize: '0.88em', color: '#e2e8f0' }}>All Users Token Usage</span>
          </div>
          {allData.length === 0 ? (
            <div className="empty-state"><div className="empty-state-icon">🤖</div><div className="empty-state-title">No usage data</div></div>
          ) : (
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Provider</th>
                    <th>Model</th>
                    <th>Action</th>
                    <th>Tokens</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {allData.map((r: any) => (
                    <tr key={r.id}>
                      <td style={{ fontSize: '0.83em', color: '#94a3b8' }}>User #{r.user_id}</td>
                      <td>
                        <span className={`badge badge-${r.provider === 'gemini' ? 'green' : r.provider === 'claude' ? 'orange' : 'purple'}`}>
                          {r.provider}
                        </span>
                      </td>
                      <td style={{ fontSize: '0.82em', color: '#94a3b8' }}>{r.model_version}</td>
                      <td style={{ fontSize: '0.82em', color: '#e2e8f0' }}>{r.action}</td>
                      <td><span style={{ fontWeight: 600, color: '#a5b4fc' }}>{r.tokens_consumed.toLocaleString()}</span></td>
                      <td style={{ fontSize: '0.8em', color: '#64748b', whiteSpace: 'nowrap' }}>
                        {new Date(r.created_at).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Tokens;
