import React, { useState, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import type { TestCase } from '../types';

const STEPS = ['Configure', 'Generate', 'Review', 'Execute & Report'];

type Provider = 'copilot' | 'gemini' | 'claude';

const PROVIDERS: { value: Provider; label: string; models: string[] }[] = [
  { value: 'copilot', label: '🤖 GitHub Copilot', models: ['gpt-4o', 'gpt-4o-mini', 'o1-mini'] },
  { value: 'gemini',  label: '✨ Google Gemini',  models: ['gemini-2.5-flash', 'gemini-1.5-pro', 'gemini-1.5-flash'] },
  { value: 'claude',  label: '🧠 Anthropic Claude', models: ['claude-opus-4-5', 'claude-sonnet-4-5', 'claude-haiku-3-5'] },
];

interface DynamicParam { key: string; value: string; required: boolean; }

const Generate: React.FC = () => {
  const { user: _user } = useAuth();

  // Step state
  const [step, setStep] = useState(0);

  // Step 1 — Configure
  const [ticketKey, setTicketKey] = useState('');
  const [provider, setProvider] = useState<Provider>('gemini');
  const [model, setModel] = useState('gemini-2.5-flash');

  // Step 2 — Generate
  const [generating, setGenerating] = useState(false);
  const [testCases, setTestCases] = useState<TestCase[]>([]);
  const [genStatus, setGenStatus] = useState<{ type: 'success'|'error'|'info'; msg: string } | null>(null);

  // Step 3 — Review
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [reviewStatus, setReviewStatus] = useState<{ type: 'success'|'error'|'info'; msg: string } | null>(null);

  // Step 4 — Execute
  const [baseUrl, setBaseUrl] = useState('');
  const [dynamicParams, setDynamicParams] = useState<DynamicParam[]>([]);
  const [executing, setExecuting] = useState(false);
  const [genColl, setGenColl] = useState(false);
  const [execResult, setExecResult] = useState<any>(null);
  const [execStatus, setExecStatus] = useState<{ type: 'success'|'error'|'info'; msg: string } | null>(null);

  const progressPct = (step / (STEPS.length - 1)) * 100;

  // Provider change resets model to first option
  const handleProviderChange = (p: Provider) => {
    setProvider(p);
    setModel(PROVIDERS.find(x => x.value === p)!.models[0]);
  };

  // ── Step 2: Generate ──
  const handleGenerate = async () => {
    if (!ticketKey.trim()) { setGenStatus({ type: 'error', msg: 'Enter a Jira ticket key first' }); return; }
    setGenerating(true);
    setGenStatus({ type: 'info', msg: `🤖 Generating test cases with ${provider}...` });
    try {
      const { data } = await api.post('/ai/generate', {
        ticketKey: ticketKey.trim(),
        provider,
        model,
        modelFamily: model,
      });
      setTestCases(data.testCases || []);
      setGenStatus({ type: 'success', msg: `✅ Generated ${data.count} BDD test cases for ${data.ticketKey}` });
    } catch (err: any) {
      setGenStatus({ type: 'error', msg: err.response?.data?.error || 'Generation failed' });
    } finally {
      setGenerating(false);
    }
  };

  // ── Step 3: CSV download ──
  const downloadCSV = async () => {
    try {
      const res = await api.get(`/testcases/${ticketKey}/download`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a'); a.href = url; a.download = `${ticketKey}_test_cases.csv`; a.click();
    } catch { setReviewStatus({ type: 'error', msg: 'Download failed' }); }
  };

  const uploadCSV = async () => {
    const file = fileRef.current?.files?.[0];
    if (!file) return;
    const fd = new FormData(); fd.append('file', file);
    setUploading(true);
    try {
      const { data } = await api.post(`/testcases/${ticketKey}/upload`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      setReviewStatus({ type: 'success', msg: `⬆️ ${data.count} test cases uploaded successfully` });
    } catch (err: any) {
      setReviewStatus({ type: 'error', msg: err.response?.data?.error || 'Upload failed' });
    } finally { setUploading(false); }
  };

  // ── Step 4: Execute ──
  const addParam = () => setDynamicParams(p => [...p, { key: '', value: '', required: false }]);
  const removeParam = (i: number) => setDynamicParams(p => p.filter((_, idx) => idx !== i));
  const updateParam = (i: number, field: keyof DynamicParam, val: any) => {
    setDynamicParams(p => { const u = [...p]; (u[i] as any)[field] = val; return u; });
  };

  const generateCollection = async () => {
    if (!baseUrl.trim()) { setExecStatus({ type: 'error', msg: 'Base URL is required' }); return; }
    setGenColl(true);
    try {
      const { data } = await api.post('/postman/generate', { ticketKey, baseUrl, dynamicParams });
      setExecStatus({ type: 'success', msg: `📦 Collection generated (${data.totalRequests ?? '?'} requests)` });
    } catch (err: any) {
      setExecStatus({ type: 'error', msg: err.response?.data?.error || 'Collection generation failed' });
    } finally { setGenColl(false); }
  };

  const executeTests = async () => {
    if (!baseUrl.trim()) { setExecStatus({ type: 'error', msg: 'Base URL is required' }); return; }
    setExecuting(true); setExecResult(null);
    setExecStatus({ type: 'info', msg: '⏳ Running Newman tests...' });
    try {
      // First get collections for this ticket
      const colRes = await api.get(`/postman/${ticketKey}`);
      const cols = colRes.data;
      if (!cols || cols.length === 0) {
        setExecStatus({ type: 'error', msg: 'No collection found — generate one first' });
        setExecuting(false); return;
      }
      const latestCol = cols[0];
      const { data } = await api.post(`/newman/run/${latestCol.id}`, { baseUrl, dynamicParams });
      setExecResult(data);
      setExecStatus({
        type: (data.failed ?? 0) > 0 ? 'error' : 'success',
        msg: `Done: ${data.passed ?? 0} passed, ${data.failed ?? 0} failed`,
      });
    } catch (err: any) {
      setExecStatus({ type: 'error', msg: err.response?.data?.error || 'Execution failed' });
    } finally { setExecuting(false); }
  };

  const selectedModels = PROVIDERS.find(p => p.value === provider)?.models ?? [];

  return (
    <div className="page-container">
      <div style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: '1.3em', fontWeight: 600, color: '#e2e8f0' }}>⚡ Generate Test Cases</h2>
        <p style={{ color: '#64748b', marginTop: 4, fontSize: '0.88em' }}>
          AI-powered BDD test generation from Jira tickets
        </p>
      </div>

      {/* Stepper */}
      <div className="stepper">
        <div className="stepper-progress" style={{ width: `${progressPct}%` }} />
        {STEPS.map((label, i) => (
          <div key={i} className={`step ${i === step ? 'active' : ''} ${i < step ? 'completed' : ''}`}>
            <div className="step-circle">{i < step ? '✓' : i + 1}</div>
            <div className="step-label">{label}</div>
          </div>
        ))}
      </div>

      {/* ── Step 0: Configure ── */}
      {step === 0 && (
        <div className="card">
          <div className="card-header">
            <div className="card-icon purple">🎯</div>
            <div>
              <div className="card-title">Configure</div>
              <div className="card-subtitle">Select Jira ticket and AI provider</div>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Jira Ticket Key <span className="required">*</span></label>
            <input
              className="form-input"
              placeholder="e.g. PROJ-1234"
              value={ticketKey}
              onChange={e => setTicketKey(e.target.value.toUpperCase())}
              style={{ fontSize: '1em', letterSpacing: '0.05em' }}
            />
            <div className="form-hint">The ticket key from your Jira project (e.g. TEST-100)</div>
          </div>

          <label className="form-label" style={{ marginBottom: 10, display: 'block' }}>AI Provider</label>
          <div className="toggle-group">
            {PROVIDERS.map(p => (
              <div
                key={p.value}
                className={`toggle-option ${provider === p.value ? 'selected' : ''}`}
                onClick={() => handleProviderChange(p.value)}
              >
                <div className="toggle-radio" />
                <div>
                  <div className="toggle-text">{p.label}</div>
                  <div className="toggle-subtext">{p.models[0]}</div>
                </div>
              </div>
            ))}
          </div>

          <div className="form-group">
            <label className="form-label">Model</label>
            <select className="form-select" value={model} onChange={e => setModel(e.target.value)}>
              {selectedModels.map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>

          <div className="card-footer">
            <div />
            <button
              className="btn btn-success"
              disabled={!ticketKey.trim()}
              onClick={() => setStep(1)}
            >
              Next → Generate ›
            </button>
          </div>
        </div>
      )}

      {/* ── Step 1: Generate ── */}
      {step === 1 && (
        <div className="card">
          <div className="card-header">
            <div className="card-icon blue">✨</div>
            <div>
              <div className="card-title">Generate Test Cases</div>
              <div className="card-subtitle">
                Ticket: <strong style={{ color: '#a5b4fc' }}>{ticketKey}</strong> &nbsp;·&nbsp;
                Provider: <strong style={{ color: '#a5b4fc' }}>{provider}</strong> &nbsp;·&nbsp;
                Model: <strong style={{ color: '#a5b4fc' }}>{model}</strong>
              </div>
            </div>
          </div>

          <button
            className="btn btn-primary"
            onClick={handleGenerate}
            disabled={generating}
            style={{ marginBottom: 16 }}
          >
            {generating ? <span className="spinner" /> : '✨'} Generate Test Cases
          </button>

          {genStatus && <div className={`status-msg ${genStatus.type}`}>{genStatus.msg}</div>}

          {testCases.length > 0 && (
            <div style={{ marginTop: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                <span className="badge badge-purple">📝 {testCases.length} test cases</span>
              </div>
              <div style={{ maxHeight: 400, overflowY: 'auto', background: '#0f172a', borderRadius: 10, border: '1px solid #334155', padding: 12 }}>
                {testCases.slice(0, 10).map((tc, i) => (
                  <div key={tc.id} style={{ padding: '10px 12px', borderBottom: i < 9 ? '1px solid #1e293b' : 'none' }}>
                    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                      <span style={{ fontSize: '0.72em', color: '#64748b', minWidth: 24 }}>#{i + 1}</span>
                      <div>
                        <span className={`badge badge-${tc.status === 'approved' ? 'green' : tc.status === 'rejected' ? 'red' : 'orange'}`} style={{ marginBottom: 4 }}>
                          {tc.status}
                        </span>
                        <p style={{ fontSize: '0.8em', color: '#e2e8f0', lineHeight: 1.5, whiteSpace: 'pre-wrap', fontFamily: 'monospace' }}>
                          {tc.test_case.slice(0, 200)}{tc.test_case.length > 200 ? '...' : ''}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
                {testCases.length > 10 && (
                  <div style={{ padding: '10px 12px', color: '#64748b', fontSize: '0.82em', textAlign: 'center' }}>
                    + {testCases.length - 10} more test cases
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="card-footer">
            <button className="btn btn-ghost" onClick={() => setStep(0)}>← Back</button>
            <button
              className="btn btn-success"
              disabled={testCases.length === 0}
              onClick={() => setStep(2)}
            >
              Next → Review ›
            </button>
          </div>
        </div>
      )}

      {/* ── Step 2: Review ── */}
      {step === 2 && (
        <div className="card">
          <div className="card-header">
            <div className="card-icon green">📋</div>
            <div>
              <div className="card-title">Review & Edit</div>
              <div className="card-subtitle">Download CSV, edit offline, re-upload</div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
            <button className="btn btn-success" onClick={downloadCSV}>⬇️ Download CSV</button>
            <button className="btn btn-outline" onClick={() => window.open(`/test-cases?ticket=${ticketKey}`, '_blank')}>
              🔍 View in Test Cases
            </button>
          </div>

          <div className="divider" />

          <p style={{ fontSize: '0.83em', color: '#94a3b8', marginBottom: 14 }}>
            Edit the CSV and re-upload to update test cases:
          </p>

          <div className="file-upload" onClick={() => fileRef.current?.click()}>
            <div className="file-upload-icon">📁</div>
            <div className="file-upload-text">Click to select CSV file</div>
          </div>
          <input ref={fileRef} type="file" accept=".csv" style={{ display: 'none' }} />

          <button className="btn btn-outline" onClick={uploadCSV} disabled={uploading}>
            {uploading ? <span className="spinner" /> : '⬆️'} Upload CSV
          </button>

          {reviewStatus && <div className={`status-msg ${reviewStatus.type}`}>{reviewStatus.msg}</div>}

          <div className="card-footer">
            <button className="btn btn-ghost" onClick={() => setStep(1)}>← Back</button>
            <button className="btn btn-success" onClick={() => setStep(3)}>
              Next → Execute ›
            </button>
          </div>
        </div>
      )}

      {/* ── Step 3: Execute & Report ── */}
      {step === 3 && (
        <div className="card">
          <div className="card-header">
            <div className="card-icon orange">🚀</div>
            <div>
              <div className="card-title">Execute & Report</div>
              <div className="card-subtitle">Generate Postman collection and run via Newman</div>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Base URL <span className="required">*</span></label>
            <input
              className="form-input"
              placeholder="https://api.yourapp.com"
              value={baseUrl}
              onChange={e => setBaseUrl(e.target.value)}
            />
          </div>

          <div style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <label className="form-label" style={{ marginBottom: 0 }}>Dynamic Parameters</label>
              <button className="btn btn-outline btn-sm" onClick={addParam}>+ Add</button>
            </div>
            {dynamicParams.map((p, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
                <input
                  className="form-input"
                  placeholder="name"
                  value={p.key}
                  onChange={e => updateParam(i, 'key', e.target.value)}
                  style={{ flex: 1, padding: '8px 12px' }}
                />
                <input
                  className="form-input"
                  placeholder="value"
                  value={p.value}
                  onChange={e => updateParam(i, 'value', e.target.value)}
                  style={{ flex: 1, padding: '8px 12px', borderColor: p.required && !p.value ? '#ef4444' : undefined }}
                />
                <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.78em', color: '#94a3b8', whiteSpace: 'nowrap' }}>
                  <input type="checkbox" checked={p.required} onChange={e => updateParam(i, 'required', e.target.checked)} />
                  Required
                </label>
                <button
                  style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '1.1em', padding: '4px' }}
                  onClick={() => removeParam(i)}
                >✕</button>
              </div>
            ))}
          </div>

          <div className="btn-group" style={{ marginBottom: 16 }}>
            <button className="btn btn-outline" onClick={generateCollection} disabled={genColl || !baseUrl.trim()}>
              {genColl ? <span className="spinner" /> : '📦'} Generate Collection
            </button>
            <button className="btn btn-primary" onClick={executeTests} disabled={executing || !baseUrl.trim()}>
              {executing ? <span className="spinner" /> : '▶️'} Execute Tests
            </button>
          </div>

          {execStatus && <div className={`status-msg ${execStatus.type}`}>{execStatus.msg}</div>}

          {/* Results */}
          {execResult && (
            <div style={{ marginTop: 20, padding: 20, background: '#0f172a', borderRadius: 12, border: '1px solid #334155' }}>
              <div className="grid-4" style={{ marginBottom: 16 }}>
                {[
                  { label: 'Total',     val: execResult.total_tests ?? execResult.total ?? 0,   color: '#e2e8f0' },
                  { label: 'Passed',    val: execResult.passed  ?? 0, color: '#10b981' },
                  { label: 'Failed',    val: execResult.failed  ?? 0, color: '#ef4444' },
                  { label: 'Duration',  val: `${((execResult.duration_ms ?? 0) / 1000).toFixed(1)}s`, color: '#a5b4fc' },
                ].map(s => (
                  <div key={s.label} style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '1.8em', fontWeight: 700, color: s.color }}>{s.val}</div>
                    <div style={{ fontSize: '0.75em', color: '#64748b' }}>{s.label}</div>
                  </div>
                ))}
              </div>

              {/* Pass rate bar */}
              {(() => {
                const total = execResult.total_tests ?? execResult.total ?? 1;
                const passed = execResult.passed ?? 0;
                const pct = Math.round((passed / Math.max(total, 1)) * 100);
                return (
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78em', color: '#64748b', marginBottom: 6 }}>
                      <span>Pass rate</span><span style={{ fontWeight: 600, color: pct >= 70 ? '#10b981' : '#ef4444' }}>{pct}%</span>
                    </div>
                    <div className="progress-bar" style={{ marginBottom: 16 }}>
                      <div className={`progress-fill ${pct >= 70 ? 'green' : 'red'}`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })()}

              <span className={`badge badge-${execResult.status === 'passed' ? 'green' : execResult.status === 'failed' ? 'red' : 'orange'}`}>
                {execResult.status?.toUpperCase() ?? 'DONE'}
              </span>
            </div>
          )}

          <div className="card-footer">
            <button className="btn btn-ghost" onClick={() => setStep(2)}>← Back</button>
            <span style={{ fontSize: '0.82em', color: '#64748b' }}>✅ Workflow complete</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default Generate;
