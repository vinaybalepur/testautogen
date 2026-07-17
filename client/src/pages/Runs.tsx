import React, { useState } from 'react';
import api from '../services/api';
import type { TestRun, RunStatus } from '../types';

const STATUS_COLOR: Record<RunStatus, string> = {
  pending: 'badge-gray',
  running: 'badge-blue',
  passed:  'badge-green',
  failed:  'badge-red',
  error:   'badge-red',
  timeout: 'badge-orange',
};

const Runs: React.FC = () => {
  const [_ticketKey, setTicketKey] = useState('');
  const [searchKey, setSearchKey] = useState('');
  const [runs, setRuns]           = useState<TestRun[]>([]);
  const [loading, setLoading]     = useState(false);
  const [selected, setSelected]   = useState<TestRun | null>(null);
  const [status, setStatus]       = useState<{ type: 'success'|'error'|'info'; msg: string } | null>(null);

  const fetchRuns = async () => {
    const k = searchKey.trim();
    if (!k) { setStatus({ type: 'error', msg: 'Enter a ticket key' }); return; }
    setLoading(true); setStatus(null); setRuns([]); setSelected(null);
    try {
      const { data } = await api.get(`/newman/tickets/${k}/runs`);
      setRuns(Array.isArray(data) ? data : []);
      setTicketKey(k);
      if ((Array.isArray(data) ? data : []).length === 0)
        setStatus({ type: 'info', msg: 'No test runs found. Run a Newman test from the Generate workflow.' });
    } catch (err: any) {
      setStatus({ type: 'error', msg: err.response?.data?.error || 'Failed to load runs' });
    } finally { setLoading(false); }
  };

  const viewRun = async (runId: number) => {
    try {
      const { data } = await api.get(`/newman/runs/${runId}`);
      setSelected(data);
    } catch { setStatus({ type: 'error', msg: 'Failed to load run details' }); }
  };

  const viewReport = (runId: number) => {
    window.open(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/newman/runs/${runId}/report`, '_blank');
  };

  const passRate = (run: TestRun) => {
    const total = run.total_tests;
    if (!total) return 0;
    return Math.round((run.passed / total) * 100);
  };

  return (
    <div className="page-container">
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: '1.3em', fontWeight: 600, color: '#e2e8f0' }}>▶️ Test Runs</h2>
        <p style={{ color: '#64748b', marginTop: 4, fontSize: '0.88em' }}>Newman execution history and reports</p>
      </div>

      {/* Search */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', gap: 12 }}>
          <input
            className="form-input"
            placeholder="Enter Jira ticket key (e.g. PROJ-1234)"
            value={searchKey}
            onChange={e => setSearchKey(e.target.value.toUpperCase())}
            onKeyDown={e => e.key === 'Enter' && fetchRuns()}
            style={{ flex: 1 }}
          />
          <button className="btn btn-primary" onClick={fetchRuns} disabled={loading}>
            {loading ? <span className="spinner" /> : '🔍'} Search
          </button>
        </div>
        {status && <div className={`status-msg ${status.type}`}>{status.msg}</div>}
      </div>

      {runs.length > 0 && (
        <div className="grid-2" style={{ gap: 16, alignItems: 'flex-start' }}>
          {/* Run list */}
          <div>
            {runs.map(run => {
              const pct = passRate(run);
              return (
                <div
                  key={run.id}
                  className="card"
                  style={{
                    marginBottom: 12, cursor: 'pointer', padding: '18px 20px',
                    borderColor: selected?.id === run.id ? '#6366f1' : '#334155',
                    background: selected?.id === run.id ? 'rgba(99,102,241,0.06)' : undefined,
                  }}
                  onClick={() => viewRun(run.id)}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                    <div>
                      <div style={{ fontSize: '0.82em', fontWeight: 600, color: '#e2e8f0', marginBottom: 3 }}>
                        Run #{run.id} — {run.ticket_key}
                      </div>
                      <div style={{ fontSize: '0.75em', color: '#64748b' }}>
                        {new Date(run.run_at).toLocaleString()}
                      </div>
                    </div>
                    <span className={`badge ${STATUS_COLOR[run.status]}`}>{run.status.toUpperCase()}</span>
                  </div>

                  <div style={{ display: 'flex', gap: 16, fontSize: '0.78em', marginBottom: 8 }}>
                    <span style={{ color: '#e2e8f0' }}>Total: <strong>{run.total_tests}</strong></span>
                    <span style={{ color: '#10b981' }}>✓ {run.passed}</span>
                    <span style={{ color: '#ef4444' }}>✗ {run.failed}</span>
                    <span style={{ color: '#64748b' }}>{((run.duration_ms || 0) / 1000).toFixed(1)}s</span>
                  </div>

                  <div className="progress-bar" style={{ height: 5 }}>
                    <div
                      className={`progress-fill ${pct >= 70 ? 'green' : pct >= 40 ? 'orange' : 'red'}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div style={{ fontSize: '0.72em', color: '#64748b', marginTop: 4 }}>{pct}% pass rate</div>
                </div>
              );
            })}
          </div>

          {/* Run detail */}
          <div>
            {selected ? (
              <div className="card">
                <div className="card-header">
                  <div className="card-icon teal">📊</div>
                  <div>
                    <div className="card-title">Run #{selected.id} Details</div>
                    <div className="card-subtitle">{selected.ticket_key} · {new Date(selected.run_at).toLocaleString()}</div>
                  </div>
                </div>

                <div className="grid-4" style={{ marginBottom: 16 }}>
                  {[
                    { label: 'Total',   val: selected.total_tests, color: '#e2e8f0' },
                    { label: 'Passed',  val: selected.passed,  color: '#10b981' },
                    { label: 'Failed',  val: selected.failed,  color: '#ef4444' },
                    { label: 'Skipped', val: selected.skipped, color: '#f59e0b' },
                  ].map(s => (
                    <div key={s.label} style={{ textAlign: 'center', background: '#0f172a', borderRadius: 10, padding: '12px 8px' }}>
                      <div style={{ fontSize: '1.5em', fontWeight: 700, color: s.color }}>{s.val}</div>
                      <div style={{ fontSize: '0.72em', color: '#64748b' }}>{s.label}</div>
                    </div>
                  ))}
                </div>

                <div style={{ marginBottom: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78em', color: '#64748b', marginBottom: 6 }}>
                    <span>Pass Rate</span>
                    <span style={{ fontWeight: 600, color: passRate(selected) >= 70 ? '#10b981' : '#ef4444' }}>
                      {passRate(selected)}%
                    </span>
                  </div>
                  <div className="progress-bar">
                    <div
                      className={`progress-fill ${passRate(selected) >= 70 ? 'green' : passRate(selected) >= 40 ? 'orange' : 'red'}`}
                      style={{ width: `${passRate(selected)}%` }}
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <span className={`badge ${STATUS_COLOR[selected.status]}`} style={{ fontSize: '0.82em' }}>
                    {selected.status.toUpperCase()}
                  </span>
                  <span className="badge badge-gray">
                    ⏱ {((selected.duration_ms || 0) / 1000).toFixed(2)}s
                  </span>
                  {selected.report_html && (
                    <button className="btn btn-outline btn-sm" onClick={() => viewReport(selected.id)}>
                      📊 View Report
                    </button>
                  )}
                </div>

                {selected.report_json && (
                  <div style={{ marginTop: 16 }}>
                    <div style={{ fontSize: '0.82em', fontWeight: 600, color: '#94a3b8', marginBottom: 8 }}>Run Summary JSON</div>
                    <div style={{
                      background: '#0f172a', borderRadius: 8, padding: 12,
                      maxHeight: 300, overflowY: 'auto',
                      fontSize: '0.7em', fontFamily: 'monospace', color: '#64748b',
                      border: '1px solid #1e293b',
                    }}>
                      <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
                        {JSON.stringify(selected.report_json, null, 2)}
                      </pre>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="card">
                <div className="empty-state">
                  <div className="empty-state-icon">▶️</div>
                  <div className="empty-state-title">Select a run</div>
                  <div className="empty-state-desc">Click a test run on the left to see detailed results</div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {!loading && runs.length === 0 && !status && (
        <div className="card">
          <div className="empty-state">
            <div className="empty-state-icon">▶️</div>
            <div className="empty-state-title">No runs loaded</div>
            <div className="empty-state-desc">Search by Jira ticket key to find Newman test runs</div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Runs;
