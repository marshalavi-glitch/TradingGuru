import React, { useState, useEffect } from 'react';
import { X, ShieldCheck, Key, ExternalLink, RefreshCw, CheckCircle, AlertCircle, Wallet, User, Check } from 'lucide-react';
import { getBackendHttpUrl } from '../utils/tvStreamer';

interface ZerodhaConnectModalProps {
  isOpen: boolean;
  onClose: () => void;
  isDark?: boolean;
}

export const ZerodhaConnectModal: React.FC<ZerodhaConnectModalProps> = ({
  isOpen,
  onClose,
  isDark = true
}) => {
  const [status, setStatus] = useState<any>(null);
  const [apiKey, setApiKey] = useState('');
  const [apiSecret, setApiSecret] = useState('');
  const [manualToken, setManualToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [savingCreds, setSavingCreds] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [positions, setPositions] = useState<any[]>([]);
  const [showGuide, setShowGuide] = useState(false);

  const fetchStatus = async () => {
    try {
      setLoading(true);
      const backendHttp = await getBackendHttpUrl();
      const res = await fetch(`${backendHttp}/api/zerodha/status`, {
        headers: { 'bypass-tunnel-reminder': 'true' }
      });
      if (res.ok) {
        const data = await res.json();
        setStatus(data);
        if (data.isConnected) {
          fetchPositions(backendHttp);
        }
      }
    } catch (e: any) {
      console.warn('[Zerodha] Status fetch error:', e.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchPositions = async (backendHttp: string) => {
    try {
      const res = await fetch(`${backendHttp}/api/zerodha/positions`, {
        headers: { 'bypass-tunnel-reminder': 'true' }
      });
      if (res.ok) {
        const d = await res.json();
        if (d.success && d.positions?.net) {
          setPositions(d.positions.net);
        }
      }
    } catch (e) {}
  };

  useEffect(() => {
    if (isOpen) {
      fetchStatus();
      // Check if redirected with ?zerodha_auth=success
      if (typeof window !== 'undefined') {
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('zerodha_auth') === 'success') {
          setMessage({ type: 'success', text: 'Zerodha Kite Connect session linked successfully!' });
          // Clean URL parameter
          window.history.replaceState({}, document.title, window.location.pathname);
        } else if (urlParams.get('zerodha_auth') === 'error') {
          setMessage({ type: 'error', text: urlParams.get('message') || 'Authentication failed' });
          window.history.replaceState({}, document.title, window.location.pathname);
        }
      }
    }
  }, [isOpen]);

  const handleSaveCredentials = async () => {
    if (!apiKey.trim()) {
      setMessage({ type: 'error', text: 'Please enter your Zerodha API Key.' });
      return;
    }
    setSavingCreds(true);
    setMessage(null);
    try {
      const backendHttp = await getBackendHttpUrl();
      const res = await fetch(`${backendHttp}/api/zerodha/credentials`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'bypass-tunnel-reminder': 'true'
        },
        body: JSON.stringify({ apiKey, apiSecret })
      });
      const data = await res.json();
      if (data.success) {
        setMessage({ type: 'success', text: 'API credentials saved! You can now click "Login with Kite".' });
        fetchStatus();
      } else {
        setMessage({ type: 'error', text: data.message || 'Failed to save credentials' });
      }
    } catch (e: any) {
      setMessage({ type: 'error', text: e.message || 'Network error saving credentials' });
    } finally {
      setSavingCreds(false);
    }
  };

  const handleKiteLogin = async () => {
    setMessage(null);
    try {
      const backendHttp = await getBackendHttpUrl();
      const res = await fetch(`${backendHttp}/api/zerodha/login-url`, {
        headers: { 'bypass-tunnel-reminder': 'true' }
      });
      const data = await res.json();
      if (data.success && data.loginUrl) {
        // Open Zerodha OAuth in a new tab or same window
        window.location.href = data.loginUrl;
      } else {
        setMessage({ type: 'error', text: data.message || 'Failed to generate Kite Login URL. Verify your API Key.' });
      }
    } catch (e: any) {
      setMessage({ type: 'error', text: e.message || 'Failed to open Kite Login' });
    }
  };

  const handleManualTokenExchange = async () => {
    if (!manualToken.trim()) {
      setMessage({ type: 'error', text: 'Please paste your Request Token.' });
      return;
    }
    setLoading(true);
    setMessage(null);
    try {
      const backendHttp = await getBackendHttpUrl();
      const res = await fetch(`${backendHttp}/api/zerodha/session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'bypass-tunnel-reminder': 'true'
        },
        body: JSON.stringify({ requestToken: manualToken })
      });
      const data = await res.json();
      if (data.success) {
        setMessage({ type: 'success', text: `Session authenticated for ${data.data?.user_name || 'User'}!` });
        setManualToken('');
        fetchStatus();
      } else {
        setMessage({ type: 'error', text: data.message || 'Invalid or expired Request Token' });
      }
    } catch (e: any) {
      setMessage({ type: 'error', text: e.message || 'Failed to exchange token' });
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(5px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px'
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '680px',
          maxHeight: '90vh',
          backgroundColor: isDark ? '#131722' : '#ffffff',
          borderRadius: '12px',
          border: isDark ? '1px solid #2a2e39' : '1px solid #e0e3eb',
          boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          color: isDark ? '#d1d4dc' : '#131722'
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: isDark ? '1px solid #2a2e39' : '1px solid #e0e3eb',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: isDark ? 'rgba(255,255,255,0.02)' : '#f8f9fd'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                background: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                fontWeight: 'bold',
                fontSize: '16px'
              }}
            >
              K
            </div>
            <div>
              <div style={{ fontWeight: 'bold', fontSize: '16px' }}>Zerodha Kite Connect API</div>
              <div style={{ fontSize: '11px', color: isDark ? '#787b86' : '#5d606b' }}>
                Live Order Execution & Market Data Bridge
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: isDark ? '#787b86' : '#5d606b',
              padding: '6px',
              borderRadius: '6px'
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: '20px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Status Banner */}
          <div
            style={{
              padding: '14px 16px',
              borderRadius: '8px',
              background: status?.isConnected
                ? 'rgba(16, 185, 129, 0.1)'
                : 'rgba(239, 68, 68, 0.1)',
              border: `1px solid ${status?.isConnected ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              {status?.isConnected ? (
                <CheckCircle size={22} color="#10b981" />
              ) : (
                <AlertCircle size={22} color="#ef4444" />
              )}
              <div>
                <div style={{ fontWeight: 'bold', fontSize: '13px', color: status?.isConnected ? '#10b981' : '#ef4444' }}>
                  {status?.isConnected ? 'Connected & Ready for Live Trading' : 'Disconnected / Session Not Created'}
                </div>
                <div style={{ fontSize: '11px', color: isDark ? '#9ca3af' : '#6b7280' }}>
                  {status?.isConnected
                    ? `Account: ${status.userName || 'Trader'} (${status.userId}) | Token valid until 6:00 AM IST`
                    : 'Enter API Key & Secret below and complete the 1-click Kite login to authorize session.'}
                </div>
              </div>
            </div>

            <button
              onClick={fetchStatus}
              disabled={loading}
              title="Refresh connection status"
              style={{
                background: 'transparent',
                border: 'none',
                color: isDark ? '#9ca3af' : '#4b5563',
                cursor: 'pointer',
                padding: '6px',
                borderRadius: '6px'
              }}
            >
              <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>

          {/* Feedback Message */}
          {message && (
            <div
              style={{
                padding: '10px 14px',
                borderRadius: '6px',
                fontSize: '12px',
                background: message.type === 'success' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                color: message.type === 'success' ? '#10b981' : '#ef4444',
                border: `1px solid ${message.type === 'success' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`
              }}
            >
              {message.text}
            </div>
          )}

          {/* Step 1: API Key & Secret */}
          <div
            style={{
              padding: '16px',
              borderRadius: '8px',
              background: isDark ? 'rgba(255,255,255,0.03)' : '#f9fafb',
              border: isDark ? '1px solid #2a2e39' : '1px solid #e5e7eb'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <div style={{ fontWeight: '600', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Key size={15} color="#f97316" />
                <span>Step 1: Kite Developer Credentials</span>
              </div>
              <button
                onClick={() => setShowGuide(!showGuide)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#3b82f6',
                  fontSize: '11px',
                  cursor: 'pointer',
                  textDecoration: 'underline'
                }}
              >
                {showGuide ? 'Hide Setup Guide' : 'How to get Kite API credentials?'}
              </button>
            </div>

            {/* Quick Step Guide */}
            {showGuide && (
              <div
                style={{
                  padding: '12px',
                  borderRadius: '6px',
                  background: isDark ? '#1a1e29' : '#eef2ff',
                  border: '1px solid #3b82f633',
                  fontSize: '11px',
                  lineHeight: '1.6',
                  marginBottom: '14px',
                  color: isDark ? '#cbd5e1' : '#334155'
                }}
              >
                <b>How to create your Zerodha Kite App:</b>
                <ol style={{ paddingLeft: '18px', marginTop: '6px', marginBottom: '6px' }}>
                  <li>Go to <a href="https://kite.trade" target="_blank" rel="noreferrer" style={{ color: '#3b82f6' }}>kite.trade</a> and log in with your Zerodha account.</li>
                  <li>Click <b>Create new app</b> and enter any App Name (e.g., <i>Trading Guru</i>).</li>
                  <li>In <b>Redirect URL</b>, enter: <code style={{ background: '#00000044', padding: '2px 4px', borderRadius: '4px' }}>http://localhost:3002/api/zerodha/callback</code></li>
                  <li>Complete app creation to receive your <b>API Key</b> and <b>API Secret</b>.</li>
                </ol>
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
              <div>
                <label style={{ fontSize: '11px', color: isDark ? '#9ca3af' : '#4b5563', display: 'block', marginBottom: '4px' }}>
                  Kite API Key
                </label>
                <input
                  type="text"
                  placeholder="e.g. 1a2b3c4d5e6f7g8h"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: '6px',
                    border: isDark ? '1px solid #374151' : '1px solid #d1d5db',
                    background: isDark ? '#1e222d' : '#ffffff',
                    color: isDark ? '#fff' : '#000',
                    fontSize: '12px',
                    outline: 'none'
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: '11px', color: isDark ? '#9ca3af' : '#4b5563', display: 'block', marginBottom: '4px' }}>
                  Kite API Secret
                </label>
                <input
                  type="password"
                  placeholder="e.g. secret_key_hash"
                  value={apiSecret}
                  onChange={(e) => setApiSecret(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: '6px',
                    border: isDark ? '1px solid #374151' : '1px solid #d1d5db',
                    background: isDark ? '#1e222d' : '#ffffff',
                    color: isDark ? '#fff' : '#000',
                    fontSize: '12px',
                    outline: 'none'
                  }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={handleSaveCredentials}
                disabled={savingCreds}
                style={{
                  padding: '7px 16px',
                  borderRadius: '6px',
                  background: '#f97316',
                  color: '#fff',
                  border: 'none',
                  fontSize: '12px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                {savingCreds ? 'Saving...' : 'Save API Credentials'}
              </button>
            </div>
          </div>

          {/* Step 2: One-Click Kite Login */}
          <div
            style={{
              padding: '16px',
              borderRadius: '8px',
              background: isDark ? 'rgba(255,255,255,0.03)' : '#f9fafb',
              border: isDark ? '1px solid #2a2e39' : '1px solid #e5e7eb'
            }}
          >
            <div style={{ fontWeight: '600', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <ShieldCheck size={15} color="#10b981" />
              <span>Step 2: Generate Daily Session Token</span>
            </div>
            <p style={{ fontSize: '11px', color: isDark ? '#9ca3af' : '#6b7280', marginBottom: '12px', lineHeight: '1.5' }}>
              Zerodha Kite requires an authorized session token once every morning. Click below to log in securely through Zerodha’s official OAuth page. The session will automatically link back to this terminal.
            </p>

            <button
              onClick={handleKiteLogin}
              style={{
                width: '100%',
                padding: '10px 16px',
                borderRadius: '6px',
                background: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
                color: '#fff',
                border: 'none',
                fontSize: '13px',
                fontWeight: 'bold',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                boxShadow: '0 4px 12px rgba(249, 115, 22, 0.25)'
              }}
            >
              <ExternalLink size={15} />
              <span>Login with Zerodha Kite</span>
            </button>

            {/* Manual Token Fallback */}
            <div style={{ marginTop: '16px', borderTop: isDark ? '1px dashed #2a2e39' : '1px dashed #e5e7eb', paddingTop: '12px' }}>
              <label style={{ fontSize: '11px', color: isDark ? '#9ca3af' : '#6b7280', display: 'block', marginBottom: '4px' }}>
                Or paste <code>request_token</code> manually (if logging in from another device):
              </label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  placeholder="Paste request_token from callback URL..."
                  value={manualToken}
                  onChange={(e) => setManualToken(e.target.value)}
                  style={{
                    flex: 1,
                    padding: '7px 10px',
                    borderRadius: '6px',
                    border: isDark ? '1px solid #374151' : '1px solid #d1d5db',
                    background: isDark ? '#1e222d' : '#ffffff',
                    color: isDark ? '#fff' : '#000',
                    fontSize: '12px',
                    outline: 'none'
                  }}
                />
                <button
                  onClick={handleManualTokenExchange}
                  disabled={loading}
                  style={{
                    padding: '7px 14px',
                    borderRadius: '6px',
                    background: '#374151',
                    color: '#fff',
                    border: 'none',
                    fontSize: '12px',
                    fontWeight: '600',
                    cursor: 'pointer'
                  }}
                >
                  Exchange
                </button>
              </div>
            </div>
          </div>

          {/* Positions / Portfolio Summary if Connected */}
          {status?.isConnected && (
            <div
              style={{
                padding: '14px 16px',
                borderRadius: '8px',
                background: isDark ? 'rgba(255,255,255,0.02)' : '#f9fafb',
                border: isDark ? '1px solid #2a2e39' : '1px solid #e5e7eb'
              }}
            >
              <div style={{ fontSize: '12px', fontWeight: 'bold', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Wallet size={14} color="#3b82f6" />
                <span>Live Zerodha Positions ({positions.length})</span>
              </div>
              {positions.length === 0 ? (
                <div style={{ fontSize: '11px', color: isDark ? '#787b86' : '#6b7280' }}>
                  No active open positions in Zerodha right now.
                </div>
              ) : (
                <div style={{ maxHeight: '120px', overflowY: 'auto' }}>
                  {positions.map((p, idx) => (
                    <div
                      key={idx}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        padding: '6px 0',
                        borderBottom: isDark ? '1px solid #1f2937' : '1px solid #f3f4f6',
                        fontSize: '11px'
                      }}
                    >
                      <div>
                        <b>{p.tradingsymbol}</b> <span style={{ color: '#787b86' }}>({p.product})</span>
                      </div>
                      <div style={{ color: p.m2m >= 0 ? '#10b981' : '#ef4444', fontWeight: 'bold' }}>
                        ₹{Number(p.m2m || 0).toFixed(2)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '12px 20px',
            borderTop: isDark ? '1px solid #2a2e39' : '1px solid #e0e3eb',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: isDark ? 'rgba(255,255,255,0.01)' : '#f8f9fd',
            fontSize: '11px',
            color: isDark ? '#787b86' : '#6b7280'
          }}
        >
          <span>Zerodha Kite Connect v3 Protocol</span>
          <button
            onClick={onClose}
            style={{
              padding: '6px 14px',
              borderRadius: '6px',
              background: '#374151',
              color: '#fff',
              border: 'none',
              cursor: 'pointer',
              fontWeight: '600'
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
