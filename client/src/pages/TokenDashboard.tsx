import React, { useState, useEffect } from 'react';
import { useNavigate }                  from 'react-router-dom';
import { useAuth }                      from '../context/AuthContext';
import api                              from '../services/api';

interface MyUsageResponse {
  period:        string;
  lifetimeTotal: number;
  periodTotal:   number;
  byProvider:    { provider: string; total_tokens: string; total_calls: string }[];
  byModel:       { provider: string; model_family: string; model_version: string; total_tokens: string; total_calls: string }[];
  byAction:      { action: string; total_tokens: string; total_calls: string }[];
  dailyTrend:    { date: string; total_tokens: string; total_calls: string }[];
}

interface AllUsageResponse {
  period:     string;
  grandTotal: number;
  perUser:    { id: number; first_name: string; last_name: string; email: string; role: string; total_tokens: string; total_calls: string }[];
  byProvider: { provider: string; total_tokens: string; total_calls: string; unique_users: string }[];
  byModel:    { provider: string; model_family: string; model_version: string; total_tokens: string; total_calls: string; unique_users: string }[];
  byAction:   { action: string; total_tokens: string; total_calls: string; unique_users: string }[];
}

const PERIODS = [
  { value: '7',        label: 'Last 7 days' },
  { value: '30',       label: 'Last 30 days' },
  { value: '60',       label: 'Last 60 days' },
  { value: 'lifetime', label: 'Lifetime' }
];

const PROVIDER_ICONS: Record<string, string> = {
  copilot: '🐙',
  gemini:  '✨',
  claude:  '🤖'
};

const formatTokens = (n: number | string) => {
  const num = typeof n === 'string' ? parseInt(n) : n;
  return num.toLocaleString();
};

const TokenDashboard: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate          = useNavigate();
  const isAdmin            = user?.role === 'admin';

  const [view, setView]         = useState<'mine' | 'all'>('mine');
  const [period, setPeriod]     = useState('30');
  const [loading, setLoading]   = useState(true);
  const [myData, setMyData]     = useState<MyUsageResponse | null>(null);
  const [allData, setAllData]   = useState<AllUsageResponse | null>(null);

  useEffect(() => {
    fetchData();
  }, [view, period]);

  const fetchData = async () => {
    setLoading(true);
    try {
      if (view === 'mine') {
        const { data } = await api.get(`/tokens/my?period=${period}`);
        setMyData(data);
      } else {
        const { data } = await api.get(`/tokens/all?period=${period}`);
        setAllData(data);
      }
    } catch (err) {
      console.error('Failed to fetch token usage:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const maxDailyTokens = myData?.dailyTrend?.length
    ? Math.max(...myData.dailyTrend.map(d => parseInt(d.total_tokens)))
    : 0;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', display: 'flex', flexDirection: 'column' }}>

      {/* Header */}
      <header className="app-header">
        <div className="header-logo">
          <svg viewBox="0 0 48 48" width="22" height="22">
            <circle cx="24" cy="24" r="24" fill="#5514B4" />
            <path d="M14 14h8c3.3 0 6 2.7 6 6 0 2-1 3.7-2.5 4.8 2.3 1 3.5 3 3.5 5.2 0 3.3-2.7 6-6 6H14V14zm4 3.5v5h3.5c1.4 0 2.5-1.1 2.5-2.5s-1.1-2.5-2.5-2.5H18zm0 8.5v5.5h4.5c1.5 0 2.75-1.2 2.75-2.75S24 22 22.5 22H18z" fill="white" />
            <path d="M30 16h6v2.5h-6V16zm0 5h6v2.5h-6V21zm0 5h6v2.5h-6V26z" fill="white" opacity="0.7" />
          </svg>
        </div>
        <div className="header-title" style={{ flex: 1 }}>
          <h1>TestAutoGen</h1>
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
            📊 Token Usage
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9em' }}>
            Track AI token consumption across providers and actions.
          </p>
        </div>

        {/* Controls */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>

          {/* View Toggle — admin only */}
          {isAdmin ? (
            <div className="tabs">
              <button
                className={`tab ${view === 'mine' ? 'active' : ''}`}
                onClick={() => setView('mine')}
              >
                👤 My Usage
              </button>
              <button
                className={`tab ${view === 'all' ? 'active' : ''}`}
                onClick={() => setView('all')}
              >
                👥 All Users
              </button>
            </div>
          ) : <div />}

          {/* Period Selector */}
          <select
            className="form-select"
            value={period}
            onChange={e => setPeriod(e.target.value)}
            style={{ width: 'auto', minWidth: 160 }}
          >
            {PERIODS.map(p => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>
        </div>

        {loading ? (
          <div className="spinner-container">
            <span className="spinner spinner-lg" />
            <span>Loading token usage...</span>
          </div>
        ) : view === 'mine' && myData ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

            {/* Summary Cards */}
            <div className="grid-2">
              <div className="card">
                <div style={{ fontSize: '0.78em', color: 'var(--text-secondary)', marginBottom: 8 }}>
                  LIFETIME TOTAL
                </div>
                <div style={{ fontSize: '1.8em', fontWeight: 700, color: 'var(--text-primary)' }}>
                  {formatTokens(myData.lifetimeTotal)}
                </div>
                <div style={{ fontSize: '0.78em', color: 'var(--text-secondary)', marginTop: 4 }}>
                  tokens consumed all time
                </div>
              </div>
              <div className="card">
                <div style={{ fontSize: '0.78em', color: 'var(--text-secondary)', marginBottom: 8 }}>
                  {PERIODS.find(p => p.value === period)?.label.toUpperCase()}
                </div>
                <div style={{ fontSize: '1.8em', fontWeight: 700, color: '#6366f1' }}>
                  {formatTokens(myData.periodTotal)}
                </div>
                <div style={{ fontSize: '0.78em', color: 'var(--text-secondary)', marginTop: 4 }}>
                  tokens in selected period
                </div>
              </div>
            </div>

            {/* By Provider */}
            <div className="card">
              <div style={{ fontWeight: 600, fontSize: '0.95em', color: 'var(--text-primary)', marginBottom: 14 }}>
                By Provider
              </div>
              {myData.byProvider.length === 0 ? (
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.85em' }}>No usage in this period</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {myData.byProvider.map(p => (
                    <div key={p.provider} style={{
                      display:      'flex',
                      alignItems:   'center',
                      gap:          10,
                      background:   'var(--bg-primary)',
                      borderRadius: 8,
                      padding:      '10px 14px'
                    }}>
                      <span style={{ fontSize: '1.2em' }}>{PROVIDER_ICONS[p.provider] || '🤖'}</span>
                      <span style={{ fontWeight: 600, fontSize: '0.88em', color: 'var(--text-primary)', textTransform: 'capitalize' }}>
                        {p.provider}
                      </span>
                      <span style={{ fontSize: '0.78em', color: 'var(--text-secondary)' }}>
                        {p.total_calls} call{p.total_calls !== '1' ? 's' : ''}
                      </span>
                      <span style={{ marginLeft: 'auto', fontWeight: 700, fontSize: '0.9em', color: '#6366f1' }}>
                        {formatTokens(p.total_tokens)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* By Model */}
            <div className="card">
              <div style={{ fontWeight: 600, fontSize: '0.95em', color: 'var(--text-primary)', marginBottom: 14 }}>
                By Model
              </div>
              {myData.byModel.length === 0 ? (
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.85em' }}>No usage in this period</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {myData.byModel.map((m, i) => (
                    <div key={i} style={{
                      display:             'grid',
                      gridTemplateColumns: '1fr auto auto',
                      gap:                 10,
                      alignItems:          'center',
                      padding:             '8px 0',
                      borderBottom:        i < myData.byModel.length - 1 ? '1px solid var(--border)' : 'none'
                    }}>
                      <div>
                        <div style={{ fontSize: '0.85em', fontWeight: 600, color: 'var(--text-primary)' }}>
                          {m.model_version || m.model_family}
                        </div>
                        <div style={{ fontSize: '0.72em', color: 'var(--text-secondary)', textTransform: 'capitalize' }}>
                          {m.provider}
                        </div>
                      </div>
                      <span style={{ fontSize: '0.78em', color: 'var(--text-secondary)' }}>
                        {m.total_calls} calls
                      </span>
                      <span style={{ fontWeight: 700, fontSize: '0.85em', color: 'var(--text-primary)' }}>
                        {formatTokens(m.total_tokens)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* By Action */}
            <div className="card">
              <div style={{ fontWeight: 600, fontSize: '0.95em', color: 'var(--text-primary)', marginBottom: 14 }}>
                By Action
              </div>
              {myData.byAction.length === 0 ? (
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.85em' }}>No usage in this period</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {myData.byAction.map((a, i) => (
                    <div key={i} style={{
                      display:             'grid',
                      gridTemplateColumns: '1fr auto auto',
                      gap:                 10,
                      alignItems:          'center',
                      padding:             '8px 0',
                      borderBottom:        i < myData.byAction.length - 1 ? '1px solid var(--border)' : 'none'
                    }}>
                      <span style={{ fontSize: '0.85em', color: 'var(--text-primary)', textTransform: 'capitalize' }}>
                        {a.action?.replace(/_/g, ' ') || 'Unknown'}
                      </span>
                      <span style={{ fontSize: '0.78em', color: 'var(--text-secondary)' }}>
                        {a.total_calls} calls
                      </span>
                      <span style={{ fontWeight: 700, fontSize: '0.85em', color: 'var(--text-primary)' }}>
                        {formatTokens(a.total_tokens)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Daily Trend */}
            {myData.dailyTrend.length > 0 && (
              <div className="card">
                <div style={{ fontWeight: 600, fontSize: '0.95em', color: 'var(--text-primary)', marginBottom: 14 }}>
                  Daily Trend
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {myData.dailyTrend.map(d => {
                    const tokens = parseInt(d.total_tokens);
                    const widthPct = maxDailyTokens > 0 ? (tokens / maxDailyTokens) * 100 : 0;
                    return (
                      <div key={d.date} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ fontSize: '0.75em', color: 'var(--text-secondary)', minWidth: 90 }}>
                          {new Date(d.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                        </span>
                        <div style={{ flex: 1, background: 'var(--bg-primary)', borderRadius: 6, overflow: 'hidden', height: 18 }}>
                          <div style={{
                            width:        `${widthPct}%`,
                            background:   'linear-gradient(90deg, #6366f1, #8b5cf6)',
                            height:       '100%',
                            borderRadius: 6,
                            minWidth:     tokens > 0 ? 4 : 0
                          }} />
                        </div>
                        <span style={{ fontSize: '0.78em', fontWeight: 600, color: 'var(--text-primary)', minWidth: 60, textAlign: 'right' }}>
                          {formatTokens(tokens)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

          </div>
        ) : view === 'all' && allData ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

            {/* Grand Total */}
            <div className="card">
              <div style={{ fontSize: '0.78em', color: 'var(--text-secondary)', marginBottom: 8 }}>
                GRAND TOTAL — ALL USERS · {PERIODS.find(p => p.value === period)?.label.toUpperCase()}
              </div>
              <div style={{ fontSize: '1.8em', fontWeight: 700, color: 'var(--text-primary)' }}>
                {formatTokens(allData.grandTotal)}
              </div>
            </div>

            {/* Per User Breakdown */}
            <div className="card">
              <div style={{ fontWeight: 600, fontSize: '0.95em', color: 'var(--text-primary)', marginBottom: 14 }}>
                By User
              </div>
              {allData.perUser.length === 0 ? (
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.85em' }}>No users found</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {allData.perUser.map(u => (
                    <div key={u.id} style={{
                      display:             'grid',
                      gridTemplateColumns: '1fr auto auto',
                      gap:                 10,
                      alignItems:          'center',
                      padding:             '10px 0',
                      borderBottom:        '1px solid var(--border)'
                    }}>
                      <div>
                        <div style={{ fontSize: '0.85em', fontWeight: 600, color: 'var(--text-primary)' }}>
                          {u.first_name} {u.last_name}
                          {u.role === 'admin' && (
                            <span style={{
                              marginLeft:   6,
                              fontSize:     '0.7em',
                              padding:      '1px 6px',
                              borderRadius: 8,
                              background:   'rgba(99,102,241,0.1)',
                              color:        '#6366f1'
                            }}>
                              admin
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: '0.72em', color: 'var(--text-secondary)' }}>
                          {u.email}
                        </div>
                      </div>
                      <span style={{ fontSize: '0.78em', color: 'var(--text-secondary)' }}>
                        {u.total_calls} calls
                      </span>
                      <span style={{ fontWeight: 700, fontSize: '0.9em', color: '#6366f1' }}>
                        {formatTokens(u.total_tokens)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* By Provider (all users) */}
            <div className="card">
              <div style={{ fontWeight: 600, fontSize: '0.95em', color: 'var(--text-primary)', marginBottom: 14 }}>
                By Provider
              </div>
              {allData.byProvider.length === 0 ? (
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.85em' }}>No usage in this period</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {allData.byProvider.map(p => (
                    <div key={p.provider} style={{
                      display:      'flex',
                      alignItems:   'center',
                      gap:          10,
                      background:   'var(--bg-primary)',
                      borderRadius: 8,
                      padding:      '10px 14px'
                    }}>
                      <span style={{ fontSize: '1.2em' }}>{PROVIDER_ICONS[p.provider] || '🤖'}</span>
                      <span style={{ fontWeight: 600, fontSize: '0.88em', color: 'var(--text-primary)', textTransform: 'capitalize' }}>
                        {p.provider}
                      </span>
                      <span style={{ fontSize: '0.78em', color: 'var(--text-secondary)' }}>
                        {p.total_calls} calls · {p.unique_users} user{p.unique_users !== '1' ? 's' : ''}
                      </span>
                      <span style={{ marginLeft: 'auto', fontWeight: 700, fontSize: '0.9em', color: '#6366f1' }}>
                        {formatTokens(p.total_tokens)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* By Model (all users) */}
            <div className="card">
              <div style={{ fontWeight: 600, fontSize: '0.95em', color: 'var(--text-primary)', marginBottom: 14 }}>
                By Model
              </div>
              {allData.byModel.length === 0 ? (
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.85em' }}>No usage in this period</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {allData.byModel.map((m, i) => (
                    <div key={i} style={{
                      display:             'grid',
                      gridTemplateColumns: '1fr auto auto',
                      gap:                 10,
                      alignItems:          'center',
                      padding:             '8px 0',
                      borderBottom:        i < allData.byModel.length - 1 ? '1px solid var(--border)' : 'none'
                    }}>
                      <div>
                        <div style={{ fontSize: '0.85em', fontWeight: 600, color: 'var(--text-primary)' }}>
                          {m.model_version || m.model_family}
                        </div>
                        <div style={{ fontSize: '0.72em', color: 'var(--text-secondary)', textTransform: 'capitalize' }}>
                          {m.provider} · {m.unique_users} user{m.unique_users !== '1' ? 's' : ''}
                        </div>
                      </div>
                      <span style={{ fontSize: '0.78em', color: 'var(--text-secondary)' }}>
                        {m.total_calls} calls
                      </span>
                      <span style={{ fontWeight: 700, fontSize: '0.85em', color: 'var(--text-primary)' }}>
                        {formatTokens(m.total_tokens)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* By Action (all users) */}
            <div className="card">
              <div style={{ fontWeight: 600, fontSize: '0.95em', color: 'var(--text-primary)', marginBottom: 14 }}>
                By Action
              </div>
              {allData.byAction.length === 0 ? (
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.85em' }}>No usage in this period</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {allData.byAction.map((a, i) => (
                    <div key={i} style={{
                      display:             'grid',
                      gridTemplateColumns: '1fr auto auto',
                      gap:                 10,
                      alignItems:          'center',
                      padding:             '8px 0',
                      borderBottom:        i < allData.byAction.length - 1 ? '1px solid var(--border)' : 'none'
                    }}>
                      <span style={{ fontSize: '0.85em', color: 'var(--text-primary)', textTransform: 'capitalize' }}>
                        {a.action?.replace(/_/g, ' ') || 'Unknown'}
                      </span>
                      <span style={{ fontSize: '0.78em', color: 'var(--text-secondary)' }}>
                        {a.total_calls} calls · {a.unique_users} user{a.unique_users !== '1' ? 's' : ''}
                      </span>
                      <span style={{ fontWeight: 700, fontSize: '0.85em', color: 'var(--text-primary)' }}>
                        {formatTokens(a.total_tokens)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        ) : (
          <div className="empty-state">
            <div className="empty-state-icon">📊</div>
            <h3>No data</h3>
            <p>No token usage recorded yet</p>
          </div>
        )}

      </div>

      <footer className="app-footer">© TestAutoGen Platform</footer>
    </div>
  );
};

export default TokenDashboard;
