import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

// ── Types ──────────────────────────────────────────────
interface JiraTicket {
  key: string;
  summary: string;
  status: string;
  priority: string;
  issueType: string;
  reporter: string;
  assignee: string | null;
  description: string | null;
}

interface AIConfig {
  provider: string;
  is_active: boolean;
}

interface AIModel {
  model_id: string;
  model_name: string;
}

interface TestCase {
  id: number;
  jira_id: string;
  test_case: string;
  status: string;
  defect_jira_id: string | null;
  jira_subtask_key: string | null;
  reviewed_by: number | null;
  created_at: string;
  updated_at: string;
}

type TabType = 'details' | 'generate' | 'testcases' | 'postman' | 'runs' | 'defects';

const TABS: { id: TabType; label: string; icon: string }[] = [
  { id: 'details', label: 'Ticket Details', icon: '📋' },
  { id: 'testcases', label: 'Test Cases', icon: '✅' },
  { id: 'generate', label: 'Generate', icon: '🤖' },
  { id: 'postman', label: 'Postman', icon: '📮' },
  { id: 'runs', label: 'Runs', icon: '🏃' },
  { id: 'defects', label: 'Defects', icon: '🐛' },
];

const TicketDetail: React.FC = () => {
  const { ticketKey } = useParams<{ ticketKey: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const defaultTab = searchParams.get('action') === 'generate' ? 'generate' : 'details';
  const [activeTab, setActiveTab] = useState<TabType>(defaultTab as TabType);

  // Ticket
  const [ticket, setTicket] = useState<JiraTicket | null>(null);
  const [ticketLoading, setTicketLoading] = useState(true);
  const [ticketError, setTicketError] = useState('');

  // Generate tab
  const [aiConfigs, setAIConfigs] = useState<AIConfig[]>([]);
  const [selectedProvider, setSelectedProvider] = useState('');
  const [models, setModels] = useState<AIModel[]>([]);
  const [selectedModel, setSelectedModel] = useState('');
  const [modelsLoading, setModelsLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generateMsg, setGenerateMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [regenModal, setRegenModal] = useState(false);

  // Test Cases tab
  const [testCases, setTestCases] = useState<TestCase[]>([]);
  const [tcLoading, setTcLoading] = useState(false);
  const [approvingAll, setApprovingAll] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editText, setEditText] = useState('');
  const [deleteModal, setDeleteModal] = useState<number | null>(null);

  // Upload csv file
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  //Pushing test cases to jira
  const [pushing, setPushing] = useState(false);
  const [pushMsg, setPushMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (!ticketKey) return;
    fetchTicket();
    fetchAIConfigs();
    fetchTestCases();
  }, [ticketKey]);

  useEffect(() => {
    if (activeTab === 'testcases') fetchTestCases();
  }, [activeTab]);

  useEffect(() => {
    if (selectedProvider) fetchModels(selectedProvider);
  }, [selectedProvider]);

  const fetchTicket = async () => {
    setTicketLoading(true);
    try {
      const { data } = await api.get(`/jira/${ticketKey}`);
      setTicket(data.ticket);
    } catch (err: any) {
      setTicketError(err.response?.data?.error || 'Failed to fetch ticket');
    } finally {
      setTicketLoading(false);
    }
  };

  const fetchAIConfigs = async () => {
    try {
      const { data } = await api.get('/ai-config');
      const active = data.configs.filter((c: AIConfig) => c.is_active);
      setAIConfigs(active);
      if (active.length > 0) setSelectedProvider(active[0].provider);
    } catch (err) {
      console.error('Failed to fetch AI configs:', err);
    }
  };

  const fetchModels = async (provider: string) => {
    setModelsLoading(true);
    setModels([]);
    setSelectedModel('');
    try {
      const { data } = await api.get(`/ai-config/${provider}/models`);
      setModels(data.models);
      if (data.models.length > 0) setSelectedModel(data.models[0].model_id);
    } catch (err: any) {
      console.error('Failed to fetch models:', err);
    } finally {
      setModelsLoading(false);
    }
  };

  const fetchTestCases = async () => {
    setTcLoading(true);
    try {
      const { data } = await api.get(`/testcases/${ticketKey}`);
      const sorted = data.testCases.sort((a: TestCase, b: TestCase) => a.id - b.id);
      setTestCases(sorted);
    } catch (err) {
      console.error('Failed to fetch test cases:', err);
    } finally {
      setTcLoading(false);
    }
  };

  const handleGenerate = async () => {
    if (!selectedProvider || !selectedModel) return;
    setGenerating(true);
    setGenerateMsg(null);
    try {
      const { data } = await api.post('/ai/generate', {
        ticketKey,
        provider: selectedProvider,
        model: selectedModel,
        modelFamily: selectedProvider
      });
      setGenerateMsg({
        type: 'success',
        text: `✅ Generated ${data.count} test cases successfully!`
      });
      setTimeout(() => {
        setActiveTab('testcases');
        fetchTestCases();
      }, 1500);
    } catch (err: any) {
      setGenerateMsg({
        type: 'error',
        text: err.response?.data?.error || 'Failed to generate test cases'
      });
    } finally {
      setGenerating(false);
    }
  };

  const handleApproveAll = async () => {
    setApprovingAll(true);
    try {
      await api.put(`/testcases/${ticketKey}/approve-all`);
      fetchTestCases();
    } catch (err) {
      console.error('Failed to approve all:', err);
    } finally {
      setApprovingAll(false);
    }
  };

  const handleApprove = async (id: number) => {
    try {
      await api.put(`/testcases/${id}/approve`);
      fetchTestCases();
    } catch (err) {
      console.error('Failed to approve:', err);
    }
  };

  const handleReject = async (id: number) => {
    try {
      await api.put(`/testcases/${id}/reject`);
      fetchTestCases();
    } catch (err) {
      console.error('Failed to reject:', err);
    }
  };

  const handleEdit = async (id: number) => {
    try {
      await api.put(`/testcases/${id}`, { test_case: editText });
      setEditingId(null);
      fetchTestCases();
    } catch (err) {
      console.error('Failed to update:', err);
    }
  };

  const handleDelete = async () => {
    if (!deleteModal) return;
    try {
      await api.delete(`/testcases/${deleteModal}`);
      setDeleteModal(null);
      fetchTestCases();
    } catch (err) {
      console.error('Failed to delete:', err);
    }
  };

  const handleDownloadCSV = async () => {
    try {
      const response = await api.get(`/testcases/${ticketKey}/download`, {
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${ticketKey}-testcases.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      console.error('Failed to download:', err);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  // Upload CSV file
  const handleUploadCSV = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setUploadMsg(null);

    try {
      const text = await file.text();
      const { data } = await api.post(
        `/testcases/${ticketKey}/upload`,
        { csv: text },
        {
          headers: { 'Content-Type': 'application/json' }
        }
      );

      setUploadMsg({

        type: 'success',
        text: `✅ ${data.message}`,

      });
      fetchTestCases();
    } catch (err: any) {
      console.error('Upload error:', err.response?.data);
      const errData = err.response?.data;
      setUploadMsg({
        type: 'error',
        text: errData?.message
          ? `${errData.error} — ${errData.message}`
          : errData?.error || 'Failed to upload CSV'
      });
    } finally {

      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }

  };

  //Pushing approved test cases to jira
  const handlePushToJira = async () => {
    setPushing(true);
    setPushMsg(null);
    try {
      const { data } = await api.post(`/push/${ticketKey}/push`);
      setPushMsg({
        type: 'success',
        text: `✅ Pushed ${data.pushed.length} new, updated ${data.updated.length} test cases to Jira`
      });
      fetchTestCases();
    } catch (err: any) {
      setPushMsg({
        type: 'error',
        text: err.response?.data?.error || 'Failed to push to Jira'
      });
    } finally {
      setPushing(false);
    }
  };

  const statusColor: Record<string, string> = {
    draft: '#64748b',
    approved: '#10b981',
    rejected: '#ef4444',
    modified: '#f59e0b',
    approved_modified: '#10b981'
  };

  const priorityColor: Record<string, string> = {
    High: '#ef4444',
    Medium: '#f59e0b',
    Low: '#10b981',
    Highest: '#dc2626',
    Lowest: '#6366f1'
  };

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

      {/* Ticket Key Banner */}
      <div style={{
        background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
        padding: '16px 32px',
        color: 'white',
        display: 'flex',
        alignItems: 'center',
        gap: 12
      }}>
        <span style={{ fontSize: '1.1em', fontWeight: 700 }}>{ticketKey}</span>
        {ticket && (
          <>
            <span style={{ opacity: 0.7 }}>·</span>
            <span style={{ fontSize: '0.9em', opacity: 0.9 }}>{ticket.summary}</span>
          </>
        )}
      </div>

      {/* Tabs */}
      <div style={{
        background: 'var(--bg-secondary)',
        borderBottom: '1px solid var(--border)',
        padding: '0 24px',
        display: 'flex',
        gap: 4,
        overflowX: 'auto'
      }}>
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '14px 18px',
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              fontSize: '0.875em',
              fontWeight: activeTab === tab.id ? 600 : 400,
              color: activeTab === tab.id ? '#6366f1' : 'var(--text-secondary)',
              borderBottom: activeTab === tab.id ? '2px solid #6366f1' : '2px solid transparent',
              whiteSpace: 'nowrap',
              transition: 'all 0.15s'
            }}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div style={{ flex: 1, padding: '28px 24px', maxWidth: 900, margin: '0 auto', width: '100%' }}>

        {/* ── TICKET DETAILS TAB ── */}
        {activeTab === 'details' && (
          <div>
            {ticketLoading ? (
              <div className="spinner-container">
                <span className="spinner spinner-lg" />
                <span>Fetching ticket...</span>
              </div>
            ) : ticketError ? (
              <div className="status-msg error">{ticketError}</div>
            ) : ticket ? (
              <div className="card">
                <div className="card-header">
                  <div className="card-icon blue">📋</div>
                  <div>
                    <div className="card-title">{ticket.key}</div>
                    <div className="card-subtitle">{ticket.issueType}</div>
                  </div>
                  <span style={{
                    marginLeft: 'auto',
                    fontSize: '0.78em',
                    padding: '3px 10px',
                    borderRadius: 20,
                    background: 'rgba(99,102,241,0.1)',
                    color: '#6366f1',
                    fontWeight: 500
                  }}>
                    {ticket.status}
                  </span>
                </div>

                <div style={{
                  background: 'var(--bg-primary)',
                  borderRadius: 10,
                  padding: 14,
                  marginBottom: 20,
                  fontSize: '0.95em',
                  color: 'var(--text-primary)',
                  fontWeight: 500
                }}>
                  {ticket.summary}
                </div>

                {ticket.description && (
                  <div style={{ marginBottom: 20 }}>
                    <div style={{ fontSize: '0.78em', color: 'var(--text-secondary)', marginBottom: 8, fontWeight: 600 }}>
                      DESCRIPTION
                    </div>
                    <div style={{
                      background: 'var(--bg-primary)',
                      borderRadius: 10,
                      padding: 14,
                      fontSize: '0.875em',
                      color: 'var(--text-primary)',
                      lineHeight: 1.6,
                      whiteSpace: 'pre-wrap'
                    }}>
                      {ticket.description}
                    </div>
                  </div>
                )}

                <div className="grid-2">
                  {[
                    { label: 'Priority', value: ticket.priority, color: priorityColor[ticket.priority] },
                    { label: 'Reporter', value: ticket.reporter, color: undefined },
                    { label: 'Assignee', value: ticket.assignee || 'Unassigned', color: undefined },
                    { label: 'Type', value: ticket.issueType, color: undefined }
                  ].map(item => (
                    <div key={item.label} style={{
                      background: 'var(--bg-primary)',
                      borderRadius: 8,
                      padding: '10px 14px'
                    }}>
                      <div style={{ fontSize: '0.72em', color: 'var(--text-secondary)', marginBottom: 4 }}>
                        {item.label}
                      </div>
                      <div style={{ fontSize: '0.85em', fontWeight: 600, color: item.color || 'var(--text-primary)' }}>
                        {item.value}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        )}

        {/* ── GENERATE TAB ── */}
        {activeTab === 'generate' && (
          <div className="card">
            <div className="card-header">
              <div className="card-icon purple">🤖</div>
              <div>
                <div className="card-title">Generate BDD Test Cases</div>
                <div className="card-subtitle">Select AI provider and model to generate test cases</div>
              </div>
            </div>

            {aiConfigs.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '32px 0' }}>
                <div style={{ fontSize: '2em', marginBottom: 12 }}>🔑</div>
                <p style={{ color: 'var(--text-secondary)', marginBottom: 16 }}>
                  No AI providers configured yet.
                </p>
                <button onClick={() => navigate('/settings')} className="btn btn-primary">
                  ⚙️ Configure AI Provider
                </button>
              </div>
            ) : (
              <>
                <div className="form-group">
                  <label className="form-label">AI Provider</label>
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    {aiConfigs.map(config => (
                      <button
                        key={config.provider}
                        onClick={() => setSelectedProvider(config.provider)}
                        className={`btn ${selectedProvider === config.provider ? 'btn-primary' : 'btn-secondary'}`}
                        style={{ textTransform: 'capitalize' }}
                      >
                        {config.provider === 'copilot' && '🐙 '}
                        {config.provider === 'gemini' && '✨ '}
                        {config.provider === 'claude' && '🤖 '}
                        {config.provider}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Model</label>
                  {modelsLoading ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-secondary)', fontSize: '0.85em' }}>
                      <span className="spinner" /> Fetching models...
                    </div>
                  ) : (
                    <select
                      className="form-select"
                      value={selectedModel}
                      onChange={e => setSelectedModel(e.target.value)}
                      disabled={models.length === 0}
                    >
                      {models.length === 0 ? (
                        <option>No models available</option>
                      ) : (
                        models.map(m => (
                          <option key={m.model_id} value={m.model_id}>
                            {m.model_name}
                          </option>
                        ))
                      )}
                    </select>
                  )}
                </div>

                {testCases.length > 0 && (
                  <div className="status-msg warning" style={{ marginBottom: 16 }}>
                    ⚠️ {testCases.length} existing test cases will be deleted and replaced with new ones.
                  </div>
                )}

                <button
                  onClick={handleGenerate}
                  className="btn btn-primary btn-full btn-lg"
                  disabled={generating || !selectedProvider || !selectedModel}
                  style={{ marginTop: 8 }}
                >
                  {generating ? (
                    <><span className="spinner" /> Generating test cases...</>
                  ) : (
                    '🤖 Generate Test Cases'
                  )}
                </button>

                {generateMsg && (
                  <div className={`status-msg ${generateMsg.type}`} style={{ marginTop: 16 }}>
                    {generateMsg.text}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ── TEST CASES TAB ── */}
        {activeTab === 'testcases' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ fontSize: '0.875em', color: 'var(--text-secondary)' }}>
                {testCases.length} test case{testCases.length !== 1 ? 's' : ''}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={handleApproveAll}
                  className="btn btn-success btn-sm"
                  title="Approve"
                  disabled={approvingAll || testCases.length === 0}
                >
                  {approvingAll ? <span className="spinner" /> : '✅'} Approve All
                </button>
                <button
                  onClick={handleDownloadCSV}
                  className="btn btn-secondary btn-sm"
                  disabled={testCases.length === 0}
                >
                  ⬇️ Download CSV
                </button>

                {/* ← Add upload button */}
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="btn btn-secondary btn-sm"
                  disabled={uploading}
                  title="Upload modified CSV"
                >
                  {uploading ? <span className="spinner" /> : '⬆️'} Upload CSV
                </button>

                {/* Hidden file input */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  style={{ display: 'none' }}
                  onChange={handleUploadCSV}
                />
                <button
                  onClick={() => setRegenModal(true)}
                  className="btn btn-outline btn-sm"
                >
                  🤖 Regenerate
                </button>

                {/* Push to Jira */}
                <button
                  onClick={handlePushToJira}
                  className="btn btn-primary btn-sm"
                  disabled={pushing || testCases.filter(tc => tc.status === 'approved').length === 0}
                  title="Push all approved test cases to Jira"
                >
                  {pushing ? <span className="spinner" /> : '🚀'} Push to Jira
                </button>
              </div>
            </div>
            {uploadMsg && <div className={`status-msg ${uploadMsg.type}`}>{uploadMsg.text}</div>}

            { /* Pushing test cases to jira message */}
            {pushMsg && <div className={`status-msg ${pushMsg.type}`} style={{ marginBottom: 12 }}>{pushMsg.text}</div>}
            {tcLoading ? (
              <div className="spinner-container">
                <span className="spinner spinner-lg" />
                <span>Loading test cases...</span>
              </div>
            ) : testCases.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">📋</div>
                <h3>No test cases yet</h3>
                <p>Go to the Generate tab to create test cases for this ticket</p>
                <button
                  onClick={() => setActiveTab('generate')}
                  className="btn btn-primary"
                  style={{ marginTop: 16 }}
                >
                  🤖 Generate Test Cases
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {testCases.map(tc => (
                  <div key={tc.id} className="card" style={{ padding: 16 }}>

                    {/* Test case header */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: '0.75em', color: 'var(--text-secondary)' }}>#{tc.id}</span>
                        <span style={{
                          fontSize: '0.75em',
                          padding: '2px 8px',
                          borderRadius: 12,
                          background: `${statusColor[tc.status]}18`,
                          color: statusColor[tc.status],
                          fontWeight: 500,
                          textTransform: 'capitalize'
                        }}>
                          {tc.status === 'approved_modified' ? 'approved' : tc.status}
                        </span>
                        {/* Show warning if approved_modified */}
                        {tc.status === 'approved_modified' && (
                          <span style={{
                            fontSize: '0.75em',
                            padding: '2px 8px',
                            borderRadius: 12,
                            background: 'rgba(245,158,11,0.1)',
                            color: '#f59e0b',
                            fontWeight: 500
                          }}>
                            ⚠️ Modified — not pushed
                          </span>
                        )}
                        {tc.jira_subtask_key ? (
                          <span style={{
                            fontSize: '0.75em',
                            padding: '2px 8px',
                            borderRadius: 12,
                            background: 'rgba(99,102,241,0.1)',
                            color: '#6366f1',
                            fontWeight: 500
                          }}>
                            🔗 {tc.jira_subtask_key}
                          </span>
                        ) : (
                          <span style={{ fontSize: '0.75em', color: '#94a3b8' }}>
                            ○ Not pushed
                          </span>
                        )}
                        {tc.defect_jira_id && (
                          <span style={{ fontSize: '0.75em', color: '#ef4444' }}>
                            🐛 {tc.defect_jira_id}
                          </span>
                        )}
                      </div>

                      {/* Action buttons */}
                      <div style={{ display: 'flex', gap: 6 }}>
                        {tc.status !== 'approved' && tc.status !== 'approved_modified' && (
  <button onClick={() => handleApprove(tc.id)} className="btn btn-success btn-sm" title="Approve">
    ✅
  </button>
                        )}
                        {tc.status !== 'rejected' && (
                          <button onClick={() => handleReject(tc.id)} className="btn btn-danger btn-sm" title="Reject test case">
                            ❌

                          </button>
                        )}
                        <button
                          onClick={() => { setEditingId(tc.id); setEditText(tc.test_case); }}
                          className="btn btn-secondary btn-sm"
                          title="Edit test case"
                        >
                          ✏️
                        </button>
                        <button
                          onClick={() => setDeleteModal(tc.id)}
                          className="btn btn-danger btn-sm"
                          title="Delete test case"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>

                    {/* Edit mode */}
                    {editingId === tc.id ? (
                      <div>
                        <textarea
                          value={editText}
                          onChange={e => setEditText(e.target.value)}
                          style={{
                            width: '100%',
                            minHeight: 120,
                            padding: 12,
                            border: '1px solid var(--border)',
                            borderRadius: 8,
                            fontSize: '0.85em',
                            fontFamily: 'monospace',
                            resize: 'vertical',
                            background: 'var(--bg-primary)',
                            color: 'var(--text-primary)'
                          }}
                        />
                        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                          <button onClick={() => handleEdit(tc.id)} className="btn btn-primary btn-sm">
                            💾 Save
                          </button>
                          <button onClick={() => setEditingId(null)} className="btn btn-secondary btn-sm">
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <pre style={{
                        fontSize: '0.82em',
                        color: 'var(--text-primary)',
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                        lineHeight: 1.6,
                        margin: 0,
                        fontFamily: 'monospace'
                      }}>
                        {tc.test_case}
                      </pre>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── POSTMAN TAB ── */}
        {activeTab === 'postman' && (
          <div className="empty-state">
            <div className="empty-state-icon">📮</div>
            <h3>Postman Collections</h3>
            <p>Coming soon</p>
          </div>
        )}

        {/* ── RUNS TAB ── */}
        {activeTab === 'runs' && (
          <div className="empty-state">
            <div className="empty-state-icon">🏃</div>
            <h3>Test Runs</h3>
            <p>Coming soon</p>
          </div>
        )}

        {/* ── DEFECTS TAB ── */}
        {activeTab === 'defects' && (
          <div className="empty-state">
            <div className="empty-state-icon">🐛</div>
            <h3>Defects</h3>
            <p>Coming soon</p>
          </div>
        )}

      </div>

      <footer className="app-footer">© TestAutoGen Platform</footer>

      {/* Regenerate Modal */}
      {regenModal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-title">⚠️ Regenerate Test Cases?</div>
            <p style={{ fontSize: '0.9em', color: 'var(--text-secondary)', marginBottom: 8 }}>
              This will <strong>delete all existing test cases</strong> for <strong>{ticketKey}</strong> and generate new ones.
            </p>
            <p style={{ fontSize: '0.9em', color: 'var(--text-secondary)', marginBottom: 8 }}>
              This action will also consume AI tokens.
            </p>
            <p style={{ fontSize: '0.9em', color: '#ef4444' }}>
              ⚠️ All approved, rejected and modified test cases will be lost!
            </p>
            <div className="modal-actions">
              <button onClick={() => setRegenModal(false)} className="btn btn-secondary">
                Cancel
              </button>
              <button
                onClick={() => { setRegenModal(false); setActiveTab('generate'); }}
                className="btn btn-danger"
              >
                Delete & Regenerate
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Modal */}
      {deleteModal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-title">🗑️ Delete Test Case?</div>
            <p style={{ fontSize: '0.9em', color: 'var(--text-secondary)' }}>
              This test case will be permanently deleted. This cannot be undone.
            </p>
            <div className="modal-actions">
              <button onClick={() => setDeleteModal(null)} className="btn btn-secondary">
                Cancel
              </button>
              <button onClick={handleDelete} className="btn btn-danger">
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default TicketDetail;
