import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

interface Stats {
  testCases: number;
  approved: number;
  collections: number;
  runs: number;
  passed: number;
  failed: number;
  defects: number;
  tokens: number;
}

const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [tcRes, tokenRes] = await Promise.allSettled([
          api.get('/testcases/stats').catch(() => ({ data: {} })),
          api.get('/tokens/my'),
        ]);

        const tc = tcRes.status === 'fulfilled' ? (tcRes.value as any).data : {};
        const tok = tokenRes.status === 'fulfilled' ? (tokenRes.value as any).data : {};

        setStats({
          testCases:   tc.total      ?? 0,
          approved:    tc.approved   ?? 0,
          collections: tc.collections ?? 0,
          runs:        tc.runs       ?? 0,
          passed:      tc.passed     ?? 0,
          failed:      tc.failed     ?? 0,
          defects:     tc.defects    ?? 0,
          tokens:      tok.totalTokens ?? tok.total ?? 0,
        });
      } catch {
        setStats({ testCases: 0, approved: 0, collections: 0, runs: 0, passed: 0, failed: 0, defects: 0, tokens: 0 });
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  const statCards = [
    { label: 'Test Cases',    value: stats?.testCases ?? '—',   icon: '📋', color: 'purple', to: '/test-cases' },
    { label: 'Approved',      value: stats?.approved ?? '—',    icon: '✅', color: 'green',  to: '/test-cases' },
    { label: 'Collections',   value: stats?.collections ?? '—', icon: '📦', color: 'blue',   to: '/postman' },
    { label: 'Test Runs',     value: stats?.runs ?? '—',        icon: '▶️', color: 'teal',   to: '/runs' },
    { label: 'Passed',        value: stats?.passed ?? '—',      icon: '🟢', color: 'green',  to: '/runs' },
    { label: 'Failed',        value: stats?.failed ?? '—',      icon: '🔴', color: 'red',    to: '/runs' },
    { label: 'Defects',       value: stats?.defects ?? '—',     icon: '🐛', color: 'orange', to: '/defects' },
    { label: 'Tokens Used',   value: stats?.tokens  ?? '—',     icon: '🤖', color: 'purple', to: '/tokens' },
  ];

  const quickActions = [
    { label: 'Generate Test Cases', icon: '⚡', desc: 'Start from a Jira ticket', to: '/generate', color: '#6366f1' },
    { label: 'Review Test Cases',   icon: '📋', desc: 'Approve or reject drafts',  to: '/test-cases', color: '#10b981' },
    { label: 'Run Collections',     icon: '▶️', desc: 'Execute Newman test runs',  to: '/runs', color: '#f59e0b' },
    { label: 'View Defects',        icon: '🐛', desc: 'Track filed defects',       to: '/defects', color: '#ef4444' },
  ];

  return (
    <div className="page-container">
      {/* Welcome */}
      <div style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: '1.4em', fontWeight: 600, color: '#e2e8f0' }}>
          Welcome back, {user?.first_name} 👋
        </h2>
        <p style={{ color: '#64748b', marginTop: 4, fontSize: '0.9em' }}>
          Here's an overview of your test automation activity.
        </p>
      </div>

      {/* Stats grid */}
      <div className="grid-4" style={{ marginBottom: 32 }}>
        {statCards.map(s => (
          <div
            key={s.label}
            className={`stat-card ${s.color}`}
            style={{ cursor: 'pointer' }}
            onClick={() => navigate(s.to)}
          >
            <div className="stat-icon">{s.icon}</div>
            <div className="stat-value" style={{ color: '#e2e8f0' }}>
              {loading ? '—' : typeof s.value === 'number' ? s.value.toLocaleString() : s.value}
            </div>
            <div className="stat-label">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card-header">
          <div className="card-icon purple">🚀</div>
          <div>
            <div className="card-title">Quick Actions</div>
            <div className="card-subtitle">Jump straight to key workflows</div>
          </div>
        </div>
        <div className="grid-4">
          {quickActions.map(a => (
            <button
              key={a.label}
              onClick={() => navigate(a.to)}
              style={{
                background: '#0f172a',
                border: '1px solid #334155',
                borderRadius: 12,
                padding: '18px 16px',
                cursor: 'pointer',
                transition: 'all 0.2s',
                textAlign: 'left',
                fontFamily: 'Inter, sans-serif',
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.borderColor = a.color;
                (e.currentTarget as HTMLElement).style.background = `${a.color}11`;
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.borderColor = '#334155';
                (e.currentTarget as HTMLElement).style.background = '#0f172a';
              }}
            >
              <div style={{ fontSize: '1.8em', marginBottom: 8 }}>{a.icon}</div>
              <div style={{ fontSize: '0.88em', fontWeight: 600, color: '#e2e8f0', marginBottom: 4 }}>{a.label}</div>
              <div style={{ fontSize: '0.75em', color: '#64748b' }}>{a.desc}</div>
            </button>
          ))}
        </div>
      </div>

      {/* How it works */}
      <div className="card">
        <div className="card-header">
          <div className="card-icon blue">💡</div>
          <div>
            <div className="card-title">How It Works</div>
            <div className="card-subtitle">4-step AI-powered test generation workflow</div>
          </div>
        </div>
        <div className="grid-4">
          {[
            { step: 1, icon: '🎯', title: 'Fetch Jira Ticket',    desc: 'Enter a Jira ticket key to pull requirements automatically.' },
            { step: 2, icon: '🤖', title: 'AI Generates Tests',   desc: 'Choose Copilot, Gemini or Claude to generate BDD test cases.' },
            { step: 3, icon: '📋', title: 'Review & Approve',     desc: 'Review, edit, approve or reject generated test cases.' },
            { step: 4, icon: '🚀', title: 'Run & Report',         desc: 'Execute as Postman/Newman and get pass/fail reports.' },
          ].map(s => (
            <div key={s.step} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '12px 8px' }}>
              <div style={{
                width: 44, height: 44, borderRadius: '50%',
                background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '1.2em', marginBottom: 10,
                boxShadow: '0 0 16px rgba(99,102,241,0.3)',
              }}>
                {s.icon}
              </div>
              <div style={{ fontSize: '0.8em', fontWeight: 600, color: '#e2e8f0', marginBottom: 4 }}>{s.title}</div>
              <div style={{ fontSize: '0.75em', color: '#64748b', lineHeight: 1.4 }}>{s.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
