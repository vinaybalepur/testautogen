import React, { useState } from 'react';
import { useNavigate }      from 'react-router-dom';
import { useAuth }          from '../context/AuthContext';
import api                  from '../services/api';

interface JiraTicket {
  key:       string;
  summary:   string;
  status:    string;
  priority:  string;
  issueType: string;
  reporter:  string;
  assignee:  string | null;
}

const Dashboard: React.FC = () => {
  const { user, logout }              = useAuth();
  const navigate                       = useNavigate();
  const [ticketKey, setTicketKey]      = useState('');
  const [ticket, setTicket]            = useState<JiraTicket | null>(null);
  const [loading, setLoading]          = useState(false);
  const [error, setError]              = useState('');

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticketKey.trim()) return;
    setError('');
    setTicket(null);
    setLoading(true);
    try {
      const { data } = await api.get(`/jira/${ticketKey.trim().toUpperCase()}`);
      setTicket(data.ticket);
    } catch (err: any) {
      if (err.response?.status === 404) {
        setError(`Ticket ${ticketKey.toUpperCase()} not found in Jira`);
      } else {
        setError(err.response?.data?.error || 'Failed to fetch ticket');
      }
    } finally {
      setLoading(false);
    }
  };

  // ← moved inside component
  const handleViewExisting = async () => {
    if (!ticket) return;
    setError('');
    setLoading(true);
    try {
      const { data } = await api.get(`/testcases/${ticket.key}`);
      if (data.count === 0) {
        setError('No test cases found for this ticket. Please generate test cases first.');
        return;
      }
      navigate(`/tickets/${ticket.key}?action=view`);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to check test cases');
    } finally {
      setLoading(false);
    }
  };

  const priorityColor: Record<string, string> = {
    High:    '#ef4444',
    Medium:  '#f59e0b',
    Low:     '#10b981',
    Highest: '#dc2626',
    Lowest:  '#6366f1'
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', display: 'flex', flexDirection: 'column' }}>

      {/* Header */}
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: '0.8em', color: 'var(--text-secondary)' }}>
            👤 {user?.first_name} {user?.last_name}
          </span>
          <button onClick={() => navigate('/settings')} className="btn btn-secondary btn-sm">
            ⚙️ Settings
          </button>
          <button onClick={() => navigate('/tokens')} className="btn btn-secondary btn-sm">
            📊 Tokens
          </button>
          {user?.role === 'admin' && (
            <button onClick={() => navigate('/admin')} className="btn btn-secondary btn-sm">
              👥 Admin
            </button>
          )}
          <button onClick={handleLogout} className="btn btn-secondary btn-sm">
            Logout
          </button>
        </div>
      </header>

      {/* Main Content */}
      <div style={{ flex: 1, padding: '48px 24px', maxWidth: 700, margin: '0 auto', width: '100%' }}>

        {/* Welcome */}
        <div style={{ marginBottom: 36, textAlign: 'center' }}>
          <div style={{
            width: 64, height: 64, borderRadius: '50%',
            background:     'linear-gradient(135deg, #6366f1, #8b5cf6)',
            display:        'flex',
            alignItems:     'center',
            justifyContent: 'center',
            fontSize:       '1.8em',
            margin:         '0 auto 16px',
            boxShadow:      '0 0 24px rgba(99,102,241,0.2)'
          }}>
            🚀
          </div>
          <h2 style={{ fontSize: '1.6em', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>
            Welcome back, {user?.first_name}!
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95em' }}>
            Enter a Jira ticket ID to fetch requirements and manage test cases
          </p>
        </div>

        {/* Search Box */}
        <div className="card" style={{ marginBottom: 24 }}>
          <div className="card-header">
            <div className="card-icon purple">🔍</div>
            <div>
              <div className="card-title">Fetch Jira Ticket</div>
              <div className="card-subtitle">Enter a Jira ticket ID to get started</div>
            </div>
          </div>

          <form onSubmit={handleSearch}>
            <div style={{ display: 'flex', gap: 10 }}>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. SCRUM-7"
                value={ticketKey}
                onChange={e => setTicketKey(e.target.value.toUpperCase())}
                disabled={loading}
              />
              <button
                type="submit"
                className="btn btn-primary"
                disabled={loading || !ticketKey.trim()}
              >
                {loading ? <span className="spinner" /> : '🔍'} Fetch
              </button>
            </div>
          </form>

          {error && <div className="status-msg error" style={{ marginTop: 12 }}>{error}</div>}
        </div>

        {/* Ticket Details */}
        {ticket && (
          <div className="card">
            <div className="card-header">
              <div className="card-icon blue">📋</div>
              <div>
                <div className="card-title">{ticket.key}</div>
                <div className="card-subtitle">{ticket.issueType}</div>
              </div>
              <span style={{
                marginLeft:   'auto',
                fontSize:     '0.78em',
                padding:      '3px 10px',
                borderRadius: 20,
                background:   'rgba(99,102,241,0.1)',
                color:        '#6366f1',
                fontWeight:   500
              }}>
                {ticket.status}
              </span>
            </div>

            {/* Summary */}
            <div style={{
              background:    'var(--bg-primary)',
              borderRadius:  10,
              padding:       14,
              marginBottom:  20,
              fontSize:      '0.95em',
              color:         'var(--text-primary)',
              fontWeight:    500
            }}>
              {ticket.summary}
            </div>

            {/* Details Grid */}
            <div className="grid-2" style={{ marginBottom: 24 }}>
              {[
                { label: 'Priority', value: ticket.priority, color: priorityColor[ticket.priority] },
                { label: 'Reporter', value: ticket.reporter,  color: undefined },
                { label: 'Assignee', value: ticket.assignee || 'Unassigned', color: undefined },
                { label: 'Type',     value: ticket.issueType, color: undefined }
              ].map(item => (
                <div key={item.label} style={{
                  background:   'var(--bg-primary)',
                  borderRadius: 8,
                  padding:      '10px 14px'
                }}>
                  <div style={{ fontSize: '0.72em', color: 'var(--text-secondary)', marginBottom: 4 }}>
                    {item.label}
                  </div>
                  <div style={{
                    fontSize:   '0.85em',
                    fontWeight: 600,
                    color:      item.color || 'var(--text-primary)'
                  }}>
                    {item.value}
                  </div>
                </div>
              ))}
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => navigate(`/tickets/${ticket.key}?action=generate`)}
                className="btn btn-primary"
                style={{ flex: 1 }}
              >
                🤖 Generate Test Cases
              </button>
              <button
                onClick={handleViewExisting}
                className="btn btn-secondary"
                style={{ flex: 1 }}
                disabled={loading}
              >
                {loading ? <span className="spinner" /> : '📋'} View Existing
              </button>
            </div>
          </div>
        )}
      </div>

      <footer className="app-footer">© TestAutoGen Platform</footer>
    </div>
  );
};

export default Dashboard;