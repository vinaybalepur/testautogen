import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

interface AIConfig {
    id: number;
    provider: string;
    is_active: boolean;
    created_at: string;
    updated_at: string;
}

interface ProviderInfo {
    id: string;
    label: string;
    icon: string;
    placeholder: string;
    docsUrl: string;
    keyHint: string;
}

const PROVIDERS: ProviderInfo[] = [
    {
        id: 'copilot',
        label: 'GitHub Copilot',
        icon: '🐙',
        placeholder: 'gho_xxxxxxxxxxxxxxxxxxxx',
        docsUrl: 'https://github.com/settings/tokens',
        keyHint: 'Starts with gho_ or ghp_'
    },
    {
        id: 'gemini',
        label: 'Google Gemini',
        icon: '✨',
        placeholder: 'AIzaSyxxxxxxxxxxxxxxxxxxxxxxxxx',
        docsUrl: 'https://aistudio.google.com/app/apikey',
        keyHint: 'Starts with AIzaSy'
    },
    {
        id: 'claude',
        label: 'Anthropic Claude',
        icon: '🤖',
        placeholder: 'sk-ant-xxxxxxxxxxxxxxxxxxxxxxxxx',
        docsUrl: 'https://console.anthropic.com/settings/keys',
        keyHint: 'Starts with sk-ant-'
    }
];

const Settings: React.FC = () => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const [configs, setConfigs] = useState<AIConfig[]>([]);
    const [apiKeys, setApiKeys] = useState<Record<string, string>>({});
    const [showKey, setShowKey] = useState<Record<string, boolean>>({});
    const [saving, setSaving] = useState<Record<string, boolean>>({});
    const [deleting, setDeleting] = useState<Record<string, boolean>>({});
    const [messages, setMessages] = useState<Record<string, { type: 'success' | 'error'; text: string }>>({});
    const [loading, setLoading] = useState(true);
    const [confirmModal, setConfirmModal] = useState<{ provider: string; label: string } | null>(null);

    useEffect(() => {
        fetchConfigs();
    }, []);

    const fetchConfigs = async () => {
        try {
            const { data } = await api.get('/ai-config');
            setConfigs(data.configs);
        } catch (err) {
            console.error('Failed to fetch configs:', err);
        } finally {
            setLoading(false);
        }
    };

    const isConfigured = (provider: string) =>
        configs.some(c => c.provider === provider && c.is_active);

    const setMessage = (provider: string, type: 'success' | 'error', text: string) => {
        setMessages(prev => ({ ...prev, [provider]: { type, text } }));
        setTimeout(() => {
            setMessages(prev => {
                const updated = { ...prev };
                delete updated[provider];
                return updated;
            });
        }, 4000);
    };

    const validateKey = (provider: string, key: string): string | null => {
        if (!key.trim()) return 'API key is required';
        switch (provider) {
            case 'copilot':
                if (!key.startsWith('gho_') && !key.startsWith('ghp_'))
                    return 'Copilot key must start with gho_ or ghp_';
                if (key.length < 40)
                    return 'Copilot key is too short';
                break;
            case 'gemini':
                if (!key.startsWith('AIzaSy'))
                    return 'Gemini key must start with AIzaSy';
                if (key.length < 39)
                    return 'Gemini key is too short';
                break;
            case 'claude':
                if (!key.startsWith('sk-ant-'))
                    return 'Claude key must start with sk-ant-';
                if (key.length < 20)
                    return 'Claude key is too short';
                break;
        }
        return null;
    };

    const handleSave = async (provider: string) => {
        const key = apiKeys[provider]?.trim();
        const validationError = validateKey(provider, key || '');
        if (validationError) {
            setMessage(provider, 'error', validationError);
            return;
        }
        if (isConfigured(provider)) {
            setConfirmModal({
                provider,
                label: PROVIDERS.find(p => p.id === provider)?.label || provider
            });
            return;
        }
        await saveKey(provider);
    };

    const saveKey = async (provider: string) => {
        const key = apiKeys[provider]?.trim();
        setSaving(prev => ({ ...prev, [provider]: true }));
        try {
            await api.post('/ai-config', { provider, api_key: key });
            setMessage(provider, 'success', 'API key saved and validated successfully!');
            setApiKeys(prev => ({ ...prev, [provider]: '' }));
            fetchConfigs();
        } catch (err: any) {
            const msg = err.response?.data?.error || 'Failed to save API key';
            setMessage(provider, 'error', msg);
        } finally {
            setSaving(prev => ({ ...prev, [provider]: false }));
            setConfirmModal(null);
        }
    };

    const handleDelete = async (provider: string) => {
        setDeleting(prev => ({ ...prev, [provider]: true }));
        try {
            await api.delete(`/ai-config/${provider}`);
            setMessage(provider, 'success', 'API key removed successfully');
            fetchConfigs();
        } catch (err: any) {
            setMessage(provider, 'error', 'Failed to remove API key');
        } finally {
            setDeleting(prev => ({ ...prev, [provider]: false }));
        }
    };

    const handleLogout = async () => {
        await logout();
        navigate('/login');
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

            {/* Main Content */}
            <div style={{ flex: 1, padding: '40px 24px', maxWidth: 680, margin: '0 auto', width: '100%' }}>

                <div style={{ marginBottom: 32 }}>
                    <h2 style={{ fontSize: '1.4em', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>
                        ⚙️ AI Provider Settings
                    </h2>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.9em' }}>
                        Configure your AI provider API keys. Keys are encrypted and stored securely.
                    </p>
                </div>

                {loading ? (
                    <div className="spinner-container">
                        <span className="spinner spinner-lg" />
                        <span>Loading settings...</span>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        {PROVIDERS.map(provider => {
                            const configured = isConfigured(provider.id);
                            const config = configs.find(c => c.provider === provider.id);
                            const msg = messages[provider.id];

                            return (
                                <div key={provider.id} className="card">

                                    {/* Provider Header */}
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                            <span style={{ fontSize: '1.6em' }}>{provider.icon}</span>
                                            <div>
                                                <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.95em' }}>
                                                    {provider.label}
                                                </div>
                                                <div style={{ fontSize: '0.75em', color: 'var(--text-secondary)', marginTop: 2 }}>
                                                    <a
                                                        href={provider.docsUrl}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                        style={{ color: 'var(--accent)' }}
                                                    >
                                                        Get API Key instructions
                                                    </a>
                                                </div>
                                            </div>
                                        </div>
                                        <span className={`badge ${configured ? 'badge-approved' : 'badge-draft'}`}>
                                            {configured ? '✅ Configured' : '⚪ Not configured'}
                                        </span>
                                    </div>

                                    {/* Configured info */}
                                    {configured && config && (
                                        <div style={{
                                            background: 'rgba(16,185,129,0.06)',
                                            border: '1px solid rgba(16,185,129,0.2)',
                                            borderRadius: 8,
                                            padding: '10px 14px',
                                            marginBottom: 14,
                                            fontSize: '0.82em',
                                            color: '#059669'
                                        }}>
                                            ✅ API key configured · Last updated {new Date(config.updated_at).toLocaleDateString()}
                                        </div>
                                    )}

                                    {/* API Key Input */}
                                    <div style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
                                        <div style={{ position: 'relative', flex: 1 }}>
                                            <input
                                                type={showKey[provider.id] ? 'text' : 'password'}
                                                className="form-input"
                                                placeholder={configured ? '••••••••••••••••••••' : provider.placeholder}
                                                value={apiKeys[provider.id] || ''}
                                                onChange={e => setApiKeys(prev => ({ ...prev, [provider.id]: e.target.value }))}
                                                disabled={saving[provider.id]}
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowKey(prev => ({ ...prev, [provider.id]: !prev[provider.id] }))}
                                                style={{
                                                    position: 'absolute',
                                                    right: 10,
                                                    top: '50%',
                                                    transform: 'translateY(-50%)',
                                                    background: 'none',
                                                    border: 'none',
                                                    cursor: 'pointer',
                                                    fontSize: '0.85em',
                                                    color: 'var(--text-secondary)',
                                                    padding: 0
                                                }}
                                            >
                                                {showKey[provider.id] ? '🙈' : '👁️'}
                                            </button>
                                        </div>
                                        <button
                                            onClick={() => handleSave(provider.id)}
                                            className="btn btn-primary btn-sm"
                                            disabled={saving[provider.id] || !apiKeys[provider.id]?.trim()}
                                        >
                                            {saving[provider.id] ? <span className="spinner" /> : '💾'} Save
                                        </button>
                                        {configured && (
                                            <button
                                                onClick={() => handleDelete(provider.id)}
                                                className="btn btn-danger btn-sm"
                                                disabled={deleting[provider.id]}
                                            >
                                                {deleting[provider.id] ? <span className="spinner" /> : '🗑️'}
                                            </button>
                                        )}
                                    </div>

                                    {/* Key hint */}
                                    <div style={{ fontSize: '0.75em', color: 'var(--text-secondary)', marginBottom: 8 }}>
                                        {provider.keyHint}
                                    </div>

                                    {/* Message */}
                                    {msg && (
                                        <div className={`status-msg ${msg.type}`}>
                                            {msg.text}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* Info Box */}
                <div style={{
                    marginTop: 24,
                    background: 'rgba(99,102,241,0.06)',
                    border: '1px solid rgba(99,102,241,0.15)',
                    borderRadius: 10,
                    padding: 16,
                    fontSize: '0.82em',
                    color: 'var(--text-secondary)'
                }}>
                    🔒 Your API keys are encrypted with AES-256 before being stored.
                    They are never returned to the browser and only used server-side to make AI API calls.
                </div>
            </div>

            <footer className="app-footer">© TestAutoGen Platform</footer>

            {/* Confirm Replace Modal */}
            {confirmModal && (
                <div className="modal-overlay">
                    <div className="modal">
                        <div className="modal-title">⚠️ Replace Existing Key?</div>
                        <p style={{ fontSize: '0.9em', color: 'var(--text-secondary)', marginBottom: 8 }}>
                            A key for <strong>{confirmModal.label}</strong> is already configured.
                        </p>
                        <p style={{ fontSize: '0.9em', color: 'var(--text-secondary)' }}>
                            Replacing it will overwrite the existing key. This cannot be undone.
                        </p>
                        <div className="modal-actions">
                            <button
                                onClick={() => setConfirmModal(null)}
                                className="btn btn-secondary"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => saveKey(confirmModal.provider)}
                                className="btn btn-danger"
                                disabled={saving[confirmModal.provider]}
                            >
                                {saving[confirmModal.provider] ? <span className="spinner" /> : 'Yes, Replace Key'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
};

export default Settings;