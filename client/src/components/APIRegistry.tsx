import React, { useState, useEffect, useRef } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

interface APIEntry {
  id:        number;
  name:      string;
  method:    string;
  path:      string;
  auth_type: string;
  headers:   any[];
  body:      any;
  source:    string;
  created_at:string;
}

interface BodyField {
  key:          string;
  value:        string;
  isVariable:   boolean;
  variableName: string;
}

const METHOD_COLORS: Record<string, string> = {
  GET:    '#10b981',
  POST:   '#6366f1',
  PUT:    '#f59e0b',
  PATCH:  '#f59e0b',
  DELETE: '#ef4444'
};

const APIRegistry: React.FC = () => {
  const { user }                          = useAuth();
  const isAdmin                            = user?.role === 'admin';
  const [apis, setApis]                   = useState<APIEntry[]>([]);
  const [loading, setLoading]             = useState(true);
  const [expandedId, setExpandedId]       = useState<number | null>(null);
  const [bodyFields, setBodyFields]       = useState<Record<number, BodyField[]>>({});
  const [showAddForm, setShowAddForm]     = useState(false);
  const [showImport, setShowImport]       = useState(false);
  const [importing, setImporting]         = useState(false);
  const [saving, setSaving]               = useState(false);
  const [deleteModal, setDeleteModal]     = useState<number | null>(null);
  const [msg, setMsg]                     = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const fileInputRef                       = useRef<HTMLInputElement>(null);

  // New API form state
  const [newAPI, setNewAPI] = useState({
    name:      '',
    method:    'POST',
    path:      '',
    auth_type: 'none',
    body:      ''
  });

  useEffect(() => {
    fetchAPIs();
  }, []);

  const fetchAPIs = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/registry');
      setApis(data.apis);
    } catch (err) {
      console.error('Failed to fetch APIs:', err);
    } finally {
      setLoading(false);
    }
  };

  const parseBodyFields = (apiId: number, body: any): BodyField[] => {
    if (!body) return [];
    return Object.entries(body).map(([key, value]) => {
      const isVar      = typeof value === 'string' && (value as string).startsWith('{{');
      const varName    = isVar
        ? (value as string).replace('{{', '').replace('}}', '').trim()
        : `${apis.find(a => a.id === apiId)?.name.toLowerCase().replace(/\s+/g, '_')}_${key}`;
      return {
        key,
        value:        String(value),
        isVariable:   isVar,
        variableName: varName
      };
    });
  };

  const handleExpand = (apiId: number, body: any) => {
    if (expandedId === apiId) {
      setExpandedId(null);
      return;
    }
    setExpandedId(apiId);
    if (!bodyFields[apiId]) {
      setBodyFields(prev => ({ ...prev, [apiId]: parseBodyFields(apiId, body) }));
    }
  };

  const handleToggleVariable = (apiId: number, fieldKey: string) => {
    setBodyFields(prev => ({
      ...prev,
      [apiId]: prev[apiId].map(f =>
        f.key === fieldKey ? { ...f, isVariable: !f.isVariable } : f
      )
    }));
  };

  const handleFieldValueChange = (apiId: number, fieldKey: string, value: string) => {
    setBodyFields(prev => ({
      ...prev,
      [apiId]: prev[apiId].map(f =>
        f.key === fieldKey ? { ...f, value } : f
      )
    }));
  };

  const handleSaveFields = async (apiId: number) => {
    setSaving(true);
    try {
      const fields  = bodyFields[apiId];
      const newBody: any = {};

      for (const field of fields) {
        if (field.isVariable) {
          newBody[field.key] = `{{${field.variableName}}}`;
          // Save variable value to DB
          await api.post(`/registry/${apiId}/variables`, {
            name:  field.variableName,
            value: field.value
          });
        } else {
          newBody[field.key] = field.value;
        }
      }

      // Update API body
      await api.put(`/registry/${apiId}`, { body: newBody });

      setMsg({ type: 'success', text: 'Saved successfully!' });
      fetchAPIs();
      setTimeout(() => setMsg(null), 3000);
    } catch (err) {
      setMsg({ type: 'error', text: 'Failed to save' });
    } finally {
      setSaving(false);
    }
  };

  const handleCreateAPI = async () => {
    if (!newAPI.name || !newAPI.path) {
      setMsg({ type: 'error', text: 'Name and path are required' });
      return;
    }
    setSaving(true);
    try {
      let body = null;
      if (newAPI.body.trim()) {
        body = JSON.parse(newAPI.body);
      }
      await api.post('/registry', {
        name:      newAPI.name,
        method:    newAPI.method,
        path:      newAPI.path,
        auth_type: newAPI.auth_type,
        body
      });
      setMsg({ type: 'success', text: 'API created successfully!' });
      setShowAddForm(false);
      setNewAPI({ name: '', method: 'POST', path: '', auth_type: 'none', body: '' });
      fetchAPIs();
      setTimeout(() => setMsg(null), 3000);
    } catch (err: any) {
      setMsg({ type: 'error', text: err.response?.data?.error || 'Failed to create API' });
    } finally {
      setSaving(false);
    }
  };

  const handleImportPostman = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    try {
      const text       = await file.text();
      const collection = JSON.parse(text);
      const { data }   = await api.post('/registry/import/postman', { collection });
      setMsg({ type: 'success', text: `✅ ${data.message}` });
      fetchAPIs();
    } catch (err: any) {
      setMsg({ type: 'error', text: 'Failed to import collection' });
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDelete = async () => {
    if (!deleteModal) return;
    try {
      await api.delete(`/registry/${deleteModal}`);
      setDeleteModal(null);
      fetchAPIs();
      setMsg({ type: 'success', text: 'API deleted' });
      setTimeout(() => setMsg(null), 3000);
    } catch (err) {
      setMsg({ type: 'error', text: 'Failed to delete API' });
    }
  };

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: '1.4em', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>
          📮 API Registry
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9em' }}>
          Manage APIs used for Postman collection generation.
        </p>
      </div>

      {/* Actions — Admin only */}
      {isAdmin && (
        <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="btn btn-primary btn-sm"
          >
            ➕ Add API
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="btn btn-secondary btn-sm"
            disabled={importing}
          >
            {importing ? <span className="spinner" /> : '📤'} Import Postman
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            style={{ display: 'none' }}
            onChange={handleImportPostman}
          />
        </div>
      )}

      {msg && (
        <div className={`status-msg ${msg.type}`} style={{ marginBottom: 16 }}>
          {msg.text}
        </div>
      )}

      {/* Add API Form */}
      {showAddForm && isAdmin && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-title" style={{ marginBottom: 16 }}>Add New API</div>
          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Name *</label>
              <input
                type="text"
                className="form-input"
                placeholder="Login API"
                value={newAPI.name}
                onChange={e => setNewAPI(prev => ({ ...prev, name: e.target.value }))}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Method *</label>
              <select
                className="form-select"
                value={newAPI.method}
                onChange={e => setNewAPI(prev => ({ ...prev, method: e.target.value }))}
              >
                {['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Path *</label>
              <input
                type="text"
                className="form-input"
                placeholder="/auth/login"
                value={newAPI.path}
                onChange={e => setNewAPI(prev => ({ ...prev, path: e.target.value }))}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Auth Type</label>
              <select
                className="form-select"
                value={newAPI.auth_type}
                onChange={e => setNewAPI(prev => ({ ...prev, auth_type: e.target.value }))}
              >
                <option value="none">None</option>
                <option value="bearer">Bearer Token</option>
                <option value="basic">Basic Auth</option>
                <option value="api_key">API Key</option>
              </select>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Body (JSON)</label>
            <textarea
              className="form-input"
              placeholder='{ "username": "{{username}}", "password": "{{password}}" }'
              value={newAPI.body}
              onChange={e => setNewAPI(prev => ({ ...prev, body: e.target.value }))}
              style={{ minHeight: 80, fontFamily: 'monospace', fontSize: '0.85em' }}
            />
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={handleCreateAPI}
              className="btn btn-primary btn-sm"
              disabled={saving}
            >
              {saving ? <span className="spinner" /> : '💾'} Save API
            </button>
            <button
              onClick={() => setShowAddForm(false)}
              className="btn btn-secondary btn-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* API List */}
      {loading ? (
        <div className="spinner-container">
          <span className="spinner spinner-lg" />
          <span>Loading APIs...</span>
        </div>
      ) : apis.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">📮</div>
          <h3>No APIs yet</h3>
          <p>Add APIs manually or import a Postman collection</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {apis.map(api_entry => (
            <div key={api_entry.id} className="card" style={{ padding: 16 }}>

              {/* API Header */}
              <div
                style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}
                onClick={() => handleExpand(api_entry.id, api_entry.body)}
              >
                <span style={{
                  fontSize:     '0.72em',
                  fontWeight:   700,
                  padding:      '2px 8px',
                  borderRadius: 4,
                  background:   `${METHOD_COLORS[api_entry.method]}18`,
                  color:        METHOD_COLORS[api_entry.method],
                  minWidth:     50,
                  textAlign:    'center'
                }}>
                  {api_entry.method}
                </span>
                <span style={{ fontSize: '0.85em', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
                  {api_entry.path}
                </span>
                <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.9em' }}>
                  {api_entry.name}
                </span>
                <span style={{
                  marginLeft:   'auto',
                  fontSize:     '0.72em',
                  padding:      '2px 8px',
                  borderRadius: 10,
                  background:   'var(--bg-primary)',
                  color:        'var(--text-secondary)'
                }}>
                  {api_entry.source}
                </span>
                {isAdmin && (
                  <button
                    onClick={e => { e.stopPropagation(); setDeleteModal(api_entry.id); }}
                    className="btn btn-danger btn-sm"
                    title="Delete API"
                  >
                    🗑️
                  </button>
                )}
                <span style={{ color: 'var(--text-secondary)', fontSize: '0.8em' }}>
                  {expandedId === api_entry.id ? '▲' : '▼'}
                </span>
              </div>

              {/* Expanded Body Fields */}
              {expandedId === api_entry.id && (
                <div style={{ marginTop: 16, borderTop: '1px solid var(--border)', paddingTop: 16 }}>

                  {!api_entry.body || Object.keys(api_entry.body).length === 0 ? (
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.85em' }}>
                      No body fields for this API
                    </p>
                  ) : (
                    <>
                      <div style={{ fontSize: '0.78em', color: 'var(--text-secondary)', marginBottom: 12, fontWeight: 600 }}>
                        BODY FIELDS
                      </div>

                      {/* Table Header */}
                      <div style={{
                        display:             'grid',
                        gridTemplateColumns: '1fr 1.5fr 1fr auto',
                        gap:                 8,
                        marginBottom:        8,
                        fontSize:            '0.75em',
                        color:               'var(--text-secondary)',
                        fontWeight:          600
                      }}>
                        <span>Field</span>
                        <span>Value</span>
                        <span>Variable Name</span>
                        <span>Is Variable?</span>
                      </div>

                      {/* Table Rows */}
                      {(bodyFields[api_entry.id] || []).map(field => (
                        <div key={field.key} style={{
                          display:             'grid',
                          gridTemplateColumns: '1fr 1.5fr 1fr auto',
                          gap:                 8,
                          marginBottom:        8,
                          alignItems:          'center'
                        }}>
                          <span style={{
                            fontSize:   '0.85em',
                            fontFamily: 'monospace',
                            color:      'var(--text-primary)'
                          }}>
                            {field.key}
                          </span>
                          <input
                            type={field.key.toLowerCase().includes('password') ? 'password' : 'text'}
                            className="form-input"
                            value={field.isVariable ? field.value : field.value}
                            onChange={e => handleFieldValueChange(api_entry.id, field.key, e.target.value)}
                            style={{ fontSize: '0.82em', padding: '6px 10px' }}
                            disabled={!isAdmin}
                          />
                          <span style={{
                            fontSize:   '0.78em',
                            fontFamily: 'monospace',
                            color:      field.isVariable ? '#6366f1' : 'var(--text-secondary)'
                          }}>
                            {field.isVariable ? `{{${field.variableName}}}` : '—'}
                          </span>
                          <input
                            type="checkbox"
                            checked={field.isVariable}
                            onChange={() => isAdmin && handleToggleVariable(api_entry.id, field.key)}
                            disabled={!isAdmin}
                            style={{ cursor: isAdmin ? 'pointer' : 'not-allowed' }}
                          />
                        </div>
                      ))}

                      {/* Save Button — Admin only */}
                      {isAdmin && (
                        <button
                          onClick={() => handleSaveFields(api_entry.id)}
                          className="btn btn-primary btn-sm"
                          disabled={saving}
                          style={{ marginTop: 12 }}
                        >
                          {saving ? <span className="spinner" /> : '💾'} Save Changes
                        </button>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Delete Modal */}
      {deleteModal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-title">🗑️ Delete API?</div>
            <p style={{ fontSize: '0.9em', color: 'var(--text-secondary)' }}>
              This API will be permanently deleted from the registry.
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

export default APIRegistry;