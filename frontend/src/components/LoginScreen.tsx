import React, { useState, useEffect } from 'react';
import { Lock, User, Key, ShieldCheck, Eye, EyeOff, AlertCircle, CheckCircle2, Copy } from 'lucide-react';
import { getBackendHttpUrl } from '../utils/tvStreamer';

interface LoginScreenProps {
  onLoginSuccess: (username: string) => void;
}

export interface UserAccount {
  username: string;
  name: string;
  password: string;
  role?: string;
  lastLogin?: string;
  isOnline?: boolean;
  lastSeen?: string | number;
}

// Built-in Authoritative Access Accounts
export const DEFAULT_ACCOUNTS: UserAccount[] = [
  { username: 'admin', name: 'Admin', password: 'Melissa@123', role: 'admin' },
  { username: 'sharath', name: 'Sharath SG', password: 'sharath@2026', role: 'trader' },
  { username: 'sharathsg', name: 'Sharath SG', password: 'sharath@2026', role: 'trader' }
];

export const AUTH_STORAGE_KEY = 'trading_guru_auth_user_v2';
export const AUTH_EPOCH_KEY = 'trading_guru_auth_epoch';
export const CURRENT_AUTH_EPOCH = 1759600000000;
const CUSTOM_ACCOUNTS_KEY = 'trading_guru_custom_accounts';
const DELETED_ACCOUNTS_KEY = 'trading_guru_deleted_accounts';

export function getDeletedUsers(): string[] {
  try {
    const raw = localStorage.getItem(DELETED_ACCOUNTS_KEY);
    return raw ? JSON.parse(raw).map((s: string) => s.toLowerCase()) : [];
  } catch {
    return [];
  }
}

export function addDeletedUser(username: string): void {
  try {
    const clean = username.trim().toLowerCase();
    const deleted = getDeletedUsers();
    if (!deleted.includes(clean)) {
      deleted.push(clean);
      localStorage.setItem(DELETED_ACCOUNTS_KEY, JSON.stringify(deleted));
    }
    // Also remove from CUSTOM_ACCOUNTS_KEY if present
    const custom = localStorage.getItem(CUSTOM_ACCOUNTS_KEY);
    if (custom) {
      let list = JSON.parse(custom);
      list = list.filter((u: any) => (u.username || '').toLowerCase() !== clean);
      localStorage.setItem(CUSTOM_ACCOUNTS_KEY, JSON.stringify(list));
    }
  } catch {}
}

export function unmarkDeletedUser(username: string): void {
  try {
    const clean = username.trim().toLowerCase();
    const deleted = getDeletedUsers();
    const filtered = deleted.filter(u => u !== clean);
    localStorage.setItem(DELETED_ACCOUNTS_KEY, JSON.stringify(filtered));
  } catch {}
}

export function getStoredAuthUser(): string | null {
  try {
    // Purge legacy sessions to ensure all existing devices are logged out
    localStorage.removeItem('trading_guru_auth_user');
    sessionStorage.removeItem('trading_guru_auth_user');

    const storedEpoch = Number(localStorage.getItem(AUTH_EPOCH_KEY) || sessionStorage.getItem(AUTH_EPOCH_KEY) || 0);
    if (!storedEpoch || storedEpoch < CURRENT_AUTH_EPOCH) {
      clearStoredAuthUser();
      return null;
    }

    const user = localStorage.getItem(AUTH_STORAGE_KEY) || sessionStorage.getItem(AUTH_STORAGE_KEY);
    if (user && ['trader', 'guest'].includes(user.trim().toLowerCase())) {
      clearStoredAuthUser();
      return null;
    }
    return user;
  } catch {
    return null;
  }
}

export function clearStoredAuthUser(): void {
  try {
    localStorage.removeItem('trading_guru_auth_user');
    sessionStorage.removeItem('trading_guru_auth_user');
    localStorage.removeItem(AUTH_STORAGE_KEY);
    sessionStorage.removeItem(AUTH_STORAGE_KEY);
    localStorage.removeItem(AUTH_EPOCH_KEY);
    sessionStorage.removeItem(AUTH_EPOCH_KEY);
  } catch {}
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginSuccess }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showCredHelper, setShowCredHelper] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [allAccounts, setAllAccounts] = useState<UserAccount[]>([]);

  const getAccountsList = (): UserAccount[] => {
    const deleted = getDeletedUsers();
    let combined = DEFAULT_ACCOUNTS.filter(a => !deleted.includes(a.username.toLowerCase()));
    try {
      const custom = localStorage.getItem(CUSTOM_ACCOUNTS_KEY);
      if (custom) {
        const parsed: UserAccount[] = JSON.parse(custom);
        parsed.forEach(p => {
          if (!deleted.includes(p.username.toLowerCase()) && !combined.some(c => c.username.toLowerCase() === p.username.toLowerCase())) {
            combined.push(p);
          }
        });
      }
    } catch {}
    return combined;
  };

  useEffect(() => {
    // Purge trader and guest permanently from any stored local storage cache
    addDeletedUser('trader');
    addDeletedUser('guest');
    const stored = getStoredAuthUser();
    if (stored && ['trader', 'guest'].includes(stored.trim().toLowerCase())) {
      clearStoredAuthUser();
    }
    setAllAccounts(getAccountsList());
  }, []);

  const validateCredentials = (u: string, p: string): { valid: boolean; user?: UserAccount; deactivated?: boolean } => {
    const cleanUser = (u || '').trim().toLowerCase();
    if (cleanUser === 'trader' || cleanUser === 'guest') {
      return { valid: false, deactivated: true };
    }
    const deleted = getDeletedUsers();
    if (deleted.includes(cleanUser)) {
      return { valid: false };
    }
    const list = getAccountsList();
    const match = list.find(a => 
      (a.username.toLowerCase() === cleanUser || a.name.toLowerCase() === cleanUser) && 
      a.password === p
    );
    return { valid: !!match, user: match };
  };

  // Check URL query parameters for 1-click sharing (e.g. ?auth=sharath:sharath@2026)
  useEffect(() => {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const authParam = urlParams.get('auth');
      if (authParam && authParam.includes(':')) {
        // Strip ?auth= from URL address bar immediately to prevent continuous logout/login bounce loops
        try {
          const cleanUrl = new URL(window.location.href);
          cleanUrl.searchParams.delete('auth');
          window.history.replaceState({}, document.title, cleanUrl.toString());
        } catch {}

        const [u, p] = authParam.split(':');
        const cleanU = (u || '').trim().toLowerCase();
        const cleanP = (p || '').trim();

        (async () => {
          try {
            const backendUrl = await getBackendHttpUrl();
            if (backendUrl) {
              const res = await fetch(`${backendUrl}/api/auth/verify`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: cleanU, password: cleanP })
              });
              if (res.ok) {
                const data = await res.json();
                if (data && data.success && data.user) {
                  completeLogin(data.user.name || data.user.username, data.user.username, data.sessionEpoch || Date.now());
                  return;
                }
              }
            }
          } catch {}

          const validation = validateCredentials(cleanU, cleanP);
          if (validation.valid && validation.user) {
            completeLogin(validation.user.name || validation.user.username, validation.user.username, Date.now());
          }
        })();
      }
    } catch {}
  }, []);

  const completeLogin = (userToStore: string, rawUsername?: string, sessionEpoch?: number) => {
    const cleanUser = (rawUsername || userToStore).trim().toLowerCase();
    const nowIso = new Date().toISOString();
    const epochToSave = sessionEpoch || Date.now();

    // 1. Record in local storage
    try {
      if (rememberMe) {
        localStorage.setItem(AUTH_STORAGE_KEY, userToStore);
        localStorage.setItem(AUTH_EPOCH_KEY, String(epochToSave));
      } else {
        sessionStorage.setItem(AUTH_STORAGE_KEY, userToStore);
        sessionStorage.setItem(AUTH_EPOCH_KEY, String(epochToSave));
      }
      const rawLogins = localStorage.getItem('trading_guru_user_last_logins');
      const logins = rawLogins ? JSON.parse(rawLogins) : {};
      logins[cleanUser] = nowIso;
      if (rawUsername && rawUsername.toLowerCase() !== cleanUser) {
        logins[rawUsername.toLowerCase()] = nowIso;
      }
      localStorage.setItem('trading_guru_user_last_logins', JSON.stringify(logins));
    } catch {}

    // 2. Persist to backend server & announce live presence
    try {
      getBackendHttpUrl().then((backendUrl) => {
        if (backendUrl) {
          fetch(`${backendUrl}/api/auth/record-login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'bypass-tunnel-reminder': 'true' },
            body: JSON.stringify({ username: cleanUser, timestamp: nowIso })
          }).catch(() => {});
          fetch(`${backendUrl}/api/auth/heartbeat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'bypass-tunnel-reminder': 'true' },
            body: JSON.stringify({ username: cleanUser })
          }).catch(() => {});
        }
      }).catch(() => {});
    } catch {}

    onLoginSuccess(userToStore);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setIsLoading(true);

    const cleanUser = username.trim().toLowerCase();
    if (cleanUser === 'trader' || cleanUser === 'guest') {
      setErrorMsg('This account has been deactivated. Please contact the Administrator.');
      setIsLoading(false);
      return;
    }

    // Attempt backend verification first
    try {
      const backendUrl = await getBackendHttpUrl();
      if (backendUrl) {
        const res = await fetch(`${backendUrl}/api/auth/verify`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: cleanUser, password: password.trim() })
        });
        const data = await res.json();
        if (data && data.success && data.user) {
          completeLogin(data.user.name || data.user.username, data.user.username, data.sessionEpoch || Date.now());
          return;
        } else if (res.status === 403) {
          setErrorMsg(data.error || 'This account has been deactivated. Contact Administrator.');
          setIsLoading(false);
          return;
        }
      }
    } catch {}

    setTimeout(() => {
      const validation = validateCredentials(username, password);
      if (validation.valid && validation.user) {
        completeLogin(validation.user.name || validation.user.username, validation.user.username, Date.now());
      } else {
        if (validation.deactivated) {
          setErrorMsg('This account has been deactivated. Please contact the Administrator.');
        } else {
          setErrorMsg('Invalid Username or Password. Please try again.');
        }
        setIsLoading(false);
      }
    }, 150);
  };

  const copyCred = (u: string, p: string) => {
    setUsername(u);
    setPassword(p);
    navigator.clipboard?.writeText?.(`${u} / ${p}`);
    setCopiedKey(u);
    setTimeout(() => setCopiedKey(null), 1500);
  };

  return (
    <div style={{
      minHeight: '100vh',
      width: '100vw',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'radial-gradient(ellipse at 50% 20%, #0d1e3a 0%, #070d18 60%, #030712 100%)',
      fontFamily: '"Outfit", sans-serif',
      padding: '20px',
      boxSizing: 'border-box',
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* Background Decorative Blur Orbs */}
      <div style={{
        position: 'absolute',
        width: '450px',
        height: '450px',
        borderRadius: '50%',
        background: 'rgba(56, 189, 248, 0.08)',
        filter: 'blur(100px)',
        top: '10%',
        left: '20%',
        pointerEvents: 'none'
      }} />
      <div style={{
        position: 'absolute',
        width: '400px',
        height: '400px',
        borderRadius: '50%',
        background: 'rgba(139, 92, 246, 0.08)',
        filter: 'blur(100px)',
        bottom: '10%',
        right: '20%',
        pointerEvents: 'none'
      }} />

      {/* Main Glass Card */}
      <div style={{
        width: '100%',
        maxWidth: '430px',
        background: 'rgba(15, 23, 42, 0.78)',
        backdropFilter: 'blur(20px)',
        border: '1px solid rgba(255, 255, 255, 0.12)',
        borderRadius: '16px',
        padding: '36px 32px',
        boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.8), 0 0 40px rgba(0, 240, 255, 0.08)',
        zIndex: 10,
        position: 'relative'
      }}>
        {/* Terminal Header Badge */}
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '54px',
            height: '54px',
            borderRadius: '14px',
            background: 'linear-gradient(135deg, rgba(6, 182, 212, 0.2), rgba(59, 130, 246, 0.2))',
            border: '1px solid rgba(0, 240, 255, 0.35)',
            marginBottom: '14px',
            boxShadow: '0 8px 24px rgba(0, 240, 255, 0.2)'
          }}>
            <ShieldCheck size={28} color="#00f0ff" />
          </div>

          <h1 style={{
            margin: '0 0 6px 0',
            fontSize: '22px',
            fontWeight: '800',
            color: '#ffffff',
            letterSpacing: '0.4px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px'
          }}>
            Trading Guru <span style={{ color: '#00f0ff' }}>Terminal</span>
          </h1>

          <p style={{
            margin: 0,
            fontSize: '12px',
            color: '#94a3b8',
            fontWeight: '500'
          }}>
            Authorized Portal Access • Sign in with your credentials
          </p>
        </div>

        {/* Error Alert Box */}
        {errorMsg && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            background: 'rgba(239, 68, 68, 0.12)',
            border: '1px solid rgba(239, 68, 68, 0.35)',
            borderRadius: '8px',
            padding: '10px 14px',
            color: '#f87171',
            fontSize: '12px',
            marginBottom: '20px'
          }}>
            <AlertCircle size={16} style={{ flexShrink: 0 }} />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {/* Username Input */}
          <div>
            <label style={{
              display: 'block',
              fontSize: '12px',
              fontWeight: '600',
              color: '#cbd5e1',
              marginBottom: '6px'
            }}>
              Username
            </label>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <User size={16} color="#64748b" style={{ position: 'absolute', left: '12px' }} />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter username (e.g. admin)"
                required
                autoFocus
                style={{
                  width: '100%',
                  background: 'rgba(11, 25, 46, 0.8)',
                  border: '1px solid rgba(255, 255, 255, 0.14)',
                  borderRadius: '8px',
                  padding: '11px 14px 11px 38px',
                  color: '#ffffff',
                  fontSize: '13px',
                  outline: 'none',
                  boxSizing: 'border-box',
                  transition: 'border-color 0.2s',
                  fontFamily: 'inherit'
                }}
                onFocus={(e) => e.target.style.borderColor = '#00f0ff'}
                onBlur={(e) => e.target.style.borderColor = 'rgba(255, 255, 255, 0.14)'}
              />
            </div>
          </div>

          {/* Password Input */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
              <label style={{
                fontSize: '12px',
                fontWeight: '600',
                color: '#cbd5e1'
              }}>
                Password
              </label>
            </div>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <Key size={16} color="#64748b" style={{ position: 'absolute', left: '12px' }} />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                required
                style={{
                  width: '100%',
                  background: 'rgba(11, 25, 46, 0.8)',
                  border: '1px solid rgba(255, 255, 255, 0.14)',
                  borderRadius: '8px',
                  padding: '11px 40px 11px 38px',
                  color: '#ffffff',
                  fontSize: '13px',
                  outline: 'none',
                  boxSizing: 'border-box',
                  transition: 'border-color 0.2s',
                  fontFamily: 'inherit'
                }}
                onFocus={(e) => e.target.style.borderColor = '#00f0ff'}
                onBlur={(e) => e.target.style.borderColor = 'rgba(255, 255, 255, 0.14)'}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute',
                  right: '10px',
                  background: 'transparent',
                  border: 'none',
                  color: '#64748b',
                  cursor: 'pointer',
                  padding: '4px',
                  display: 'flex',
                  alignItems: 'center'
                }}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {/* Remember Me Checkbox */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', color: '#94a3b8' }}>
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                style={{ accentColor: '#00f0ff', cursor: 'pointer' }}
              />
              Stay logged in on this browser
            </label>

            <button
              type="button"
              onClick={() => setShowCredHelper(!showCredHelper)}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#60a5fa',
                cursor: 'pointer',
                fontSize: '11px',
                fontWeight: '600'
              }}
            >
              {showCredHelper ? 'Hide Credentials' : 'Show Credentials'}
            </button>
          </div>

          {/* Credentials Helper Box */}
          {showCredHelper && (
            <div style={{
              background: 'rgba(30, 41, 59, 0.65)',
              border: '1px solid rgba(96, 165, 250, 0.3)',
              borderRadius: '8px',
              padding: '12px',
              fontSize: '11px'
            }}>
              <div style={{ fontWeight: '700', color: '#60a5fa', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Lock size={12} /> Pre-configured Access Credentials:
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {allAccounts
                  .filter((acc, idx, arr) => arr.findIndex(x => (x.name === acc.name && x.password === acc.password)) === idx)
                  .map((acc) => (
                  <div
                    key={acc.username}
                    onClick={() => copyCred(acc.username, acc.password)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      background: 'rgba(15, 23, 42, 0.6)',
                      padding: '6px 10px',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      border: '1px solid rgba(255,255,255,0.06)'
                    }}
                    title="Click to auto-fill credentials"
                  >
                    <div>
                      <span style={{ fontWeight: '800', color: '#ffffff' }}>{acc.name || acc.username}</span>
                      <span style={{ color: '#64748b', margin: '0 6px' }}>•</span>
                      <span style={{ color: '#38bdf8', fontSize: '10.5px' }}>@{acc.username}</span>
                      <span style={{ color: '#64748b', margin: '0 6px' }}>•</span>
                      <span style={{ color: '#cbd5e1', fontFamily: 'monospace' }}>{acc.password}</span>
                    </div>
                    {copiedKey === acc.username ? (
                      <span style={{ color: '#10b981', display: 'flex', alignItems: 'center', gap: '2px', fontSize: '10px' }}>
                        <CheckCircle2 size={12} /> Selected
                      </span>
                    ) : (
                      <span style={{ color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '2px', fontSize: '10px' }}>
                        <Copy size={11} /> Auto-fill
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading}
            style={{
              background: 'linear-gradient(135deg, #0284c7 0%, #2563eb 100%)',
              color: '#ffffff',
              border: 'none',
              borderRadius: '8px',
              padding: '12px',
              fontSize: '13px',
              fontWeight: '700',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              boxShadow: '0 4px 15px rgba(37, 99, 235, 0.35)',
              transition: 'all 0.2s',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              marginTop: '4px'
            }}
          >
            {isLoading ? (
              <span>Authenticating...</span>
            ) : (
              <>
                <Lock size={15} />
                <span>Enter Terminal</span>
              </>
            )}
          </button>
        </form>

        {/* Security Notice Footer */}
        <div style={{
          marginTop: '24px',
          paddingTop: '16px',
          borderTop: '1px solid rgba(255, 255, 255, 0.08)',
          textAlign: 'center',
          fontSize: '10.5px',
          color: '#64748b'
        }}>
          Protected by End-to-End Terminal Session Guard • Trading Guru v2.4
        </div>
      </div>
    </div>
  );
};
