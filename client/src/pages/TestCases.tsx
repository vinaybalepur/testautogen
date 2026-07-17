import React, { useState, useEffect } from 'react';
import api from '../services/api';
import type { TestCase, TestCaseStatus } from '../types';

const STATUS_COLORS: Record<TestCaseStatus, string> = {
  draft:    'badge-orange',
  approved: 'badge-green',
  rejected: 'badge-red',
  modified: 'badge-blue',
};

const TestCases: React.FC = () => {
  const [ticketKey, setTicketKey] = useState('');
  const [searchKey, setSearchKey] = useState('');
  const [cases, setCases] = useState<TestCase[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [status, setStatus] = useState<{ type: 'success'|'error'|'info'; msg: string } | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editText, setEditText] = useState('');

  // Check URL params on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get('ticket');
    if (t) { setTicketKey(t); setSearchKey(t); fetchCases(t); }
  }, []);

  const fetchCases = async (key?: string) => {
    const k = (key || searchKey).trim();
    if (!k) { setStatus({ type: 'error', msg: 'Enter a Jira ticket key' }); return; }
    setLoading(true); setStatus(null); setCases([]);
    try {
      const { data } = await api.get(`/testcases/${k}`);
      setCases(data.testCases || data || []);
      setTicketKey(k);
      if ((data.testCases || data || []).length === 0) setStatus({ type: 'info', msg: 'No test cases found for this ticket' });
    } catch (err: any) {
      setStatus({ type: 'error', msg: err.response?.data?.error || 'Failed to load test cases' });
    } finally { setLoading(false); }
  };

  const approveAll = async () => {
    setActionLoading(-1);
    try {
      await api.put(`/testcases/${ticketKey}/approve-all`);
      setCases(c => c.map(tc => ({ ...tc, status: 'approved' as TestCaseStatus })));
      setStatus({ type: 'success', msg: `✅ All test cases approved` });
    } catch (err: any) {
      setStatus({ type: 'error', msg: err.response?.data?.error || 'Failed to approve all' });
    } finally { setActionLoading(null); }
  };

  const approve = async (id: number) => {
    setActionLoading(id);
    try {
      await api.put(`/testcases/${id}/approve`);
      setCases(c => c.map(tc => tc.id === id ? { ...tc, status: 'approved' } : tc));
    } catch (err: any) {
      setStatus({ type: 'error', msg: err.response?.data?.error || 'Failed' });
    } finally { setActionLoading(null); }
  };

  const reject = async (id: number) => {
    setActionLoading(id);
    try {
      await api.put(`/testcases/${id}/reject`);
      setCases(c => c.map(tc => tc.id === id ? { ...tc, status: 'rejected' } : tc));
    } catch (err: any) {
      setStatus({ type: 'error', msg: err.response?.data?.error || 'Failed' });
    } finally { setActionLoading(null); }
  };

  const deleteCase = async (id: number) => {
    if (!window.confirm('Delete this test case?')) return;
    setActionLoading(id);
    try {
      await api.delete(`/testcases/${id}`);
      setCases(c => c.filter(tc => tc.id !== id));
    } catch (err: any) {
      setStatus({ type: 'error', msg: err.response?.data?.error || 'Failed' });
    } finally { setActionLoading(null); }
  };

  const startEdit = (tc: TestCase) => { setEditingId(tc.id); setEditText(tc.test_case); };

  const saveEdit = async (id: number) => {
    setActionLoading(id);
    try {
      const { data } = await api.put(`/testcases/${id}`, { test_case: editText });
      setCases(c => c.map(tc => tc.id === id ? { ...tc, ...data.testCase } : tc));
      setEditingId(null);
    } catch (err: any) {
      setStatus({ type: 'error', msg: err.response?.data?.error || 'Failed to update' });
    } finally { setActionLoading(null); }
  };

  const downloadCSV = async () => {
    if (!ticketKey) return;
    try {
      const res = await api.get(`/testcases/${ticketKey}/download`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a'); a.href = url; a.download = `${ticketKey}_test_cases.csv`; a.click();
    } catch { setStatus({ type: 'error', msg: 'Download failed' }); }
  };

  const stats = {
    total:    cases.length,
    approved: cases.filter(tc => tc.status === 'approved').length,
    rejected: cases.filter(tc => tc.status === 'rejected').length,
    draft:    cases.filter(tc => tc.status === 'draft').length,
  };

  return (
    <div className="page-container">
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: '1.3em', fontWeight: 600, color: '#e2e8f0' }}>📋 Test Cases</h2>
        <p style={{ color: '#64748b', marginTop: 4, fontSize: '0.88em' }}>Review, approve, reject and manage generated test cases</p>
      </div>

      {/* Search */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', gap: 12 }}>
          <input
            className="form-input"
            placeholder="Enter Jira ticket key (e.g. PROJ-1234)"
            value={searchKey}
            onChange={e => setSearchKey(e.target.value.toUpperCase())}
            onKeyDown={e => e.key === 'Enter' && fetchCases()}
            style={{ flex: 1 }}
          />
          <button className="btn btn-primary" onClick={() => fetchCases()} disabled={loading}>
            {loading ? <span className="spinner" /> : '🔍'} Search
          </button>
        </div>
        {status && <div className={`status-msg ${status.type}`}>{status.msg}</div>}
      </div>

      {/* Stats + Actions */}
      {cases.length > 0 && (
        <>
          <div className="grid-4" style={{ marginBottom: 20 }}>
            {[
              { label: 'Total',    val: stats.total,    color: 'purple' },
              { label: 'Draft',    val: stats.draft,    color: 'orange' },
              { label: 'Approved', val: stats.approved, color: 'green' },
              { label: 'Rejected', val: stats.rejected, color: 'red' },
            ].map(s => (
              <div key={s.label} className={`stat-card ${s.color}`}>
                <div className="stat-value" style={{ fontSize: '1.8em', color: '#e2e8f0' }}>{s.val}</div>
                <div className="stat-label">{s.label}</div>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
            <button className="btn btn-success btn-sm" onClick={approveAll} disabled={actionLoading === -1}>
              {actionLoading === -1 ? <span className="spinner" /> : '✅'} Approve All
            </button>
            <button className="btn btn-outline btn-sm" onClick={downloadCSV}>⬇️ Download CSV</button>
            <span style={{ marginLeft: 'auto', fontSize: '0.8em', color: '#64748b', alignSelf: 'center' }}>
              Ticket: <strong style={{ color: '#a5b4fc' }}>{ticketKey}</strong>
            </span>
          </div>

          {/* Table */}
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th style={{ width: 40 }}>#</th>
                    <th>Test Case</th>
                    <th style={{ width: 100 }}>Status</th>
                    <th style={{ width: 160 }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {cases.map((tc, i) => (
                    <tr key={tc.id}>
                      <td style={{ color: '#64748b', paddingLeft: 16 }}>{i + 1}</td>
                      <td style={{ paddingRight: 16 }}>
                        {editingId === tc.id ? (
                          <textarea
                            className="form-textarea"
                            value={editText}
                            onChange={e => setEditText(e.target.value)}
                            style={{ minHeight: 120, fontSize: '0.8em', fontFamily: 'monospace' }}
                          />
                        ) : (
                          <pre style={{
                            fontSize: '0.78em', color: '#e2e8f0', lineHeight: 1.6,
                            whiteSpace: 'pre-wrap', wordBreak: 'break-word', margin: 0,
                            fontFamily: 'monospace',
                          }}>
                            {tc.test_case}
                          </pre>
                        )}
                        {tc.jira_subtask_key && (
                          <div style={{ marginTop: 4 }}>
                            <span className="badge badge-blue" style={{ fontSize: '0.7em' }}>
                              Jira: {tc.jira_subtask_key}
                            </span>
                          </div>
                        )}
                      </td>
                      <td>
                        <span className={`badge ${STATUS_COLORS[tc.status]}`}>{tc.status}</span>
                      </td>
                      <td>
                        {editingId === tc.id ? (
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button className="btn btn-success btn-sm" onClick={() => saveEdit(tc.id)} disabled={actionLoading === tc.id}>
                              {actionLoading === tc.id ? <span className="spinner" /> : '💾'}
                            </button>
                            <button className="btn btn-outline btn-sm" onClick={() => setEditingId(null)}>✕</button>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                            {tc.status !== 'approved' && (
                              <button className="btn btn-success btn-sm" onClick={() => approve(tc.id)} disabled={actionLoading === tc.id} title="Approve">✓</button>
                            )}
                            {tc.status !== 'rejected' && (
                              <button className="btn btn-danger btn-sm" onClick={() => reject(tc.id)} disabled={actionLoading === tc.id} title="Reject">✗</button>
                            )}
                            <button className="btn btn-outline btn-sm" onClick={() => startEdit(tc)} title="Edit">✏️</button>
                            <button className="btn btn-ghost btn-sm" onClick={() => deleteCase(tc.id)} disabled={actionLoading === tc.id} title="Delete" style={{ color: '#ef4444' }}>🗑</button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default TestCases;
