import React, { useState } from 'react';
import api from '../services/api';
import type { PostmanCollection } from '../types';

const Postman: React.FC = () => {
  const [_ticketKey, setTicketKey]   = useState('');
  const [searchKey, setSearchKey]   = useState('');
  const [collections, setCollections] = useState<PostmanCollection[]>([]);
  const [loading, setLoading]       = useState(false);
  const [selected, setSelected]     = useState<PostmanCollection | null>(null);
  const [status, setStatus]         = useState<{ type: 'success'|'error'|'info'; msg: string } | null>(null);

  const fetchCollections = async () => {
    const k = searchKey.trim();
    if (!k) { setStatus({ type: 'error', msg: 'Enter a ticket key' }); return; }
    setLoading(true); setStatus(null); setCollections([]); setSelected(null);
    try {
      const { data } = await api.get(`/postman/${k}`);
      setCollections(Array.isArray(data) ? data : []);
      setTicketKey(k);
      if ((Array.isArray(data) ? data : []).length === 0)
        setStatus({ type: 'info', msg: 'No collections found for this ticket. Generate one from the workflow.' });
    } catch (err: any) {
      setStatus({ type: 'error', msg: err.response?.data?.error || 'Failed to load collections' });
    } finally { setLoading(false); }
  };

  const downloadCollection = async (id: number, name: string) => {
    try {
      const res = await api.get(`/postman/collection/${id}/download`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url; a.download = `${name || 'collection'}.postman_collection.json`; a.click();
    } catch { setStatus({ type: 'error', msg: 'Download failed' }); }
  };

  const viewCollection = async (id: number) => {
    try {
      const { data } = await api.get(`/postman/collection/${id}`);
      setSelected(data);
    } catch { setStatus({ type: 'error', msg: 'Failed to load collection details' }); }
  };

  return (
    <div className="page-container">
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: '1.3em', fontWeight: 600, color: '#e2e8f0' }}>📦 Postman Collections</h2>
        <p style={{ color: '#64748b', marginTop: 4, fontSize: '0.88em' }}>AI-generated Postman collections from approved test cases</p>
      </div>

      {/* Search */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', gap: 12 }}>
          <input
            className="form-input"
            placeholder="Enter Jira ticket key (e.g. PROJ-1234)"
            value={searchKey}
            onChange={e => setSearchKey(e.target.value.toUpperCase())}
            onKeyDown={e => e.key === 'Enter' && fetchCollections()}
            style={{ flex: 1 }}
          />
          <button className="btn btn-primary" onClick={fetchCollections} disabled={loading}>
            {loading ? <span className="spinner" /> : '🔍'} Search
          </button>
        </div>
        {status && <div className={`status-msg ${status.type}`}>{status.msg}</div>}
      </div>

      {collections.length > 0 && (
        <div className="grid-2" style={{ gap: 16 }}>
          {/* Collection list */}
          <div>
            {collections.map(col => (
              <div
                key={col.id}
                className="card"
                style={{
                  marginBottom: 12, cursor: 'pointer', padding: '18px 20px',
                  borderColor: selected?.id === col.id ? '#6366f1' : '#334155',
                  background: selected?.id === col.id ? 'rgba(99,102,241,0.06)' : undefined,
                }}
                onClick={() => viewCollection(col.id)}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.9em', color: '#e2e8f0', marginBottom: 4 }}>
                      {col.collection_name || `Collection #${col.id}`}
                    </div>
                    <div style={{ fontSize: '0.78em', color: '#64748b' }}>
                      Ticket: <span style={{ color: '#a5b4fc' }}>{col.ticket_key}</span>
                    </div>
                    <div style={{ fontSize: '0.75em', color: '#475569', marginTop: 3 }}>
                      {new Date(col.created_at).toLocaleString()}
                    </div>
                  </div>
                  <button
                    className="btn btn-outline btn-sm"
                    onClick={e => { e.stopPropagation(); downloadCollection(col.id, col.collection_name); }}
                  >
                    ⬇️ Download
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Collection detail */}
          <div>
            {selected ? (
              <div className="card" style={{ height: 'fit-content' }}>
                <div className="card-header">
                  <div className="card-icon blue">📄</div>
                  <div>
                    <div className="card-title">{selected.collection_name || 'Collection'}</div>
                    <div className="card-subtitle">Collection JSON preview</div>
                  </div>
                </div>
                <div style={{
                  background: '#0f172a', borderRadius: 8, padding: 14,
                  maxHeight: 500, overflowY: 'auto',
                  fontSize: '0.72em', fontFamily: 'monospace', color: '#94a3b8',
                  lineHeight: 1.6, border: '1px solid #334155',
                }}>
                  <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                    {JSON.stringify(selected.collection_json, null, 2)}
                  </pre>
                </div>
                <div style={{ marginTop: 12 }}>
                  <button
                    className="btn btn-success btn-sm"
                    onClick={() => downloadCollection(selected.id, selected.collection_name)}
                  >
                    ⬇️ Download Collection
                  </button>
                </div>
              </div>
            ) : (
              <div className="card">
                <div className="empty-state">
                  <div className="empty-state-icon">📦</div>
                  <div className="empty-state-title">Select a collection</div>
                  <div className="empty-state-desc">Click a collection on the left to preview its JSON</div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {!loading && collections.length === 0 && !status && (
        <div className="card">
          <div className="empty-state">
            <div className="empty-state-icon">📦</div>
            <div className="empty-state-title">No collections loaded</div>
            <div className="empty-state-desc">Search by Jira ticket key to find generated Postman collections</div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Postman;
