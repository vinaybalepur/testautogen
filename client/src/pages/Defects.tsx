import React, { useState } from 'react';
import api from '../services/api';
import type { Defect } from '../types';

const Defects: React.FC = () => {
  const [ticketKey, setTicketKey] = useState('');
  const [defects, setDefects]     = useState<Defect[]>([]);
  const [loading, setLoading]     = useState(false);
  const [status, setStatus]       = useState<{ type: 'success'|'error'|'info'; msg: string } | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  // Create defect form
  const [form, setForm] = useState({
    test_case_id: '',
    run_id: '',
    ticket_key: '',
    summary: '',
    expected: '',
    actual: '',
  });
  const [creating, setCreating] = useState(false);

  const fetchDefects = async () => {
    const k = ticketKey.trim();
    if (!k) { setStatus({ type: 'error', msg: 'Enter a ticket key' }); return; }
    setLoading(true); setStatus(null); setDefects([]);
    try {
      const { data } = await api.get(`/defects/ticket/${k}`);
      setDefects(Array.isArray(data) ? data : data.defects ?? []);
      if ((Array.isArray(data) ? data : data.defects ?? []).length === 0)
        setStatus({ type: 'info', msg: 'No defects found for this ticket' });
    } catch (err: any) {
      setStatus({ type: 'error', msg: err.response?.data?.error || 'Failed to load defects' });
    } finally { setLoading(false); }
  };

  const createDefect = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      const payload = {
        ...form,
        test_case_id: form.test_case_id ? Number(form.test_case_id) : null,
        run_id:       form.run_id       ? Number(form.run_id)       : null,
      };
      const { data } = await api.post('/defects', payload);
      setDefects(d => [data.defect ?? data, ...d]);
      setStatus({ type: 'success', msg: '✅ Defect created' });
      setShowCreate(false);
      setForm({ test_case_id: '', run_id: '', ticket_key: '', summary: '', expected: '', actual: '' });
    } catch (err: any) {
      setStatus({ type: 'error', msg: err.response?.data?.error || 'Failed to create defect' });
    } finally { setCreating(false); }
  };

  return (
    <div className="page-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h2 style={{ fontSize: '1.3em', fontWeight: 600, color: '#e2e8f0' }}>🐛 Defects</h2>
          <p style={{ color: '#64748b', marginTop: 4, fontSize: '0.88em' }}>Track defects filed from failed test runs</p>
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => setShowCreate(s => !s)}>
          {showCreate ? '✕ Cancel' : '+ File Defect'}
        </button>
      </div>

      {/* Create Defect Form */}
      {showCreate && (
        <div className="card" style={{ marginBottom: 24 }}>
          <div className="card-header">
            <div className="card-icon red">🐛</div>
            <div>
              <div className="card-title">File a Defect</div>
              <div className="card-subtitle">Manually create a defect record</div>
            </div>
          </div>
          <form onSubmit={createDefect}>
            <div className="grid-2" style={{ gap: 14 }}>
              <div className="form-group">
                <label className="form-label">Test Case ID</label>
                <input className="form-input" type="number" placeholder="Optional" value={form.test_case_id} onChange={e => setForm(f => ({ ...f, test_case_id: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Run ID</label>
                <input className="form-input" type="number" placeholder="Optional" value={form.run_id} onChange={e => setForm(f => ({ ...f, run_id: e.target.value }))} />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Ticket Key</label>
              <input className="form-input" placeholder="PROJ-1234" value={form.ticket_key} onChange={e => setForm(f => ({ ...f, ticket_key: e.target.value.toUpperCase() }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Summary <span className="required">*</span></label>
              <input className="form-input" placeholder="Brief description of the defect" value={form.summary} onChange={e => setForm(f => ({ ...f, summary: e.target.value }))} required />
            </div>
            <div className="form-group">
              <label className="form-label">Expected Behaviour</label>
              <textarea className="form-textarea" placeholder="What was expected?" value={form.expected} onChange={e => setForm(f => ({ ...f, expected: e.target.value }))} style={{ minHeight: 70 }} />
            </div>
            <div className="form-group">
              <label className="form-label">Actual Behaviour</label>
              <textarea className="form-textarea" placeholder="What actually happened?" value={form.actual} onChange={e => setForm(f => ({ ...f, actual: e.target.value }))} style={{ minHeight: 70 }} />
            </div>
            {status && <div className={`status-msg ${status.type}`}>{status.msg}</div>}
            <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
              <button type="submit" className="btn btn-danger" disabled={creating}>
                {creating ? <span className="spinner" /> : '🐛'} File Defect
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => setShowCreate(false)}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      {/* Search */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', gap: 12 }}>
          <input
            className="form-input"
            placeholder="Search defects by ticket key (e.g. PROJ-1234)"
            value={ticketKey}
            onChange={e => setTicketKey(e.target.value.toUpperCase())}
            onKeyDown={e => e.key === 'Enter' && fetchDefects()}
            style={{ flex: 1 }}
          />
          <button className="btn btn-primary" onClick={fetchDefects} disabled={loading}>
            {loading ? <span className="spinner" /> : '🔍'} Search
          </button>
        </div>
        {!showCreate && status && <div className={`status-msg ${status.type}`}>{status.msg}</div>}
      </div>

      {/* Defects table */}
      {defects.length > 0 && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #1e293b', display: 'flex', alignItems: 'center', gap: 10 }}>
            <span className="badge badge-red">🐛 {defects.length} defect{defects.length !== 1 ? 's' : ''}</span>
          </div>
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Ticket</th>
                  <th>Summary</th>
                  <th>Jira Defect</th>
                  <th>Run</th>
                  <th>Filed</th>
                </tr>
              </thead>
              <tbody>
                {defects.map(d => (
                  <tr key={d.id}>
                    <td style={{ color: '#64748b' }}>#{d.id}</td>
                    <td>
                      {d.ticket_key
                        ? <span className="badge badge-blue">{d.ticket_key}</span>
                        : <span style={{ color: '#475569' }}>—</span>
                      }
                    </td>
                    <td>
                      <div style={{ fontWeight: 500, color: '#e2e8f0', marginBottom: 4, fontSize: '0.88em' }}>
                        {d.summary || '—'}
                      </div>
                      {d.expected && (
                        <div style={{ fontSize: '0.75em', color: '#64748b' }}>
                          <strong>Expected:</strong> {d.expected.slice(0, 100)}{d.expected.length > 100 ? '...' : ''}
                        </div>
                      )}
                      {d.actual && (
                        <div style={{ fontSize: '0.75em', color: '#ef4444' }}>
                          <strong>Actual:</strong> {d.actual.slice(0, 100)}{d.actual.length > 100 ? '...' : ''}
                        </div>
                      )}
                    </td>
                    <td>
                      {d.defect_jira_key
                        ? <span className="badge badge-purple">{d.defect_jira_key}</span>
                        : <span style={{ color: '#475569', fontSize: '0.82em' }}>Not filed</span>
                      }
                    </td>
                    <td>
                      {d.run_id
                        ? <span className="badge badge-gray">Run #{d.run_id}</span>
                        : <span style={{ color: '#475569' }}>—</span>
                      }
                    </td>
                    <td style={{ color: '#64748b', fontSize: '0.8em', whiteSpace: 'nowrap' }}>
                      {new Date(d.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!loading && defects.length === 0 && !showCreate && !status && (
        <div className="card">
          <div className="empty-state">
            <div className="empty-state-icon">🐛</div>
            <div className="empty-state-title">No defects loaded</div>
            <div className="empty-state-desc">Search by Jira ticket key or file a new defect manually</div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Defects;
