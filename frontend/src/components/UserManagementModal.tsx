import React, { useState, useEffect, useMemo } from 'react';
import { X, UserPlus, Users, Trash2, Key, Shield, Copy, CheckCircle2, RefreshCw, ExternalLink, Clock } from 'lucide-react';
import { DEFAULT_ACCOUNTS, UserAccount, getDeletedUsers, addDeletedUser, unmarkDeletedUser } from './LoginScreen';
import { tvStreamer, getBackendHttpUrl } from '../utils/tvStreamer';

interface UserManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: string | null;
}

const CUSTOM_ACCOUNTS_KEY = 'trading_guru_custom_accounts';

function isRecent(isoString?: string): boolean {
  if (!isoString) return false;
  try {
    const diffMs = Date.now() - new Date(isoString).getTime();
    return diffMs >= 0 && diffMs < 5 * 60 * 1000;
  } catch {
    return false;
  }
}

function formatDisplayTime(isoString: string): string {
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);

    if (diffSec < 60) return 'Just now';
    if (diffMin < 60) return `${diffMin}m ago`;

    // Same calendar date in IST
    const isToday = d.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' }) === now.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' });
    const timeStr = d.toLocaleTimeString('en-IN', {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });

    if (isToday) return `Today, ${timeStr}`;

    const dateStr = d.toLocaleDateString('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: 'short'
    });
    return `${dateStr}, ${timeStr}`;
  } catch {
    return isoString;
  }
}

function formatFullIST(isoString: string): string {
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;
    return d.toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    }) + ' IST';
  } catch {
    return isoString;
  }
}

export const UserManagementModal: React.FC<UserManagementModalProps> = ({
  isOpen,
  onClose,
  currentUser
}) => {
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [newName, setNewName] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<'trader' | 'guest' | 'admin'>('trader');
  const [copiedLinkUser, setCopiedLinkUser] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<{ text: string; isError?: boolean } | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [confirmDeleteUser, setConfirmDeleteUser] = useState<string | null>(null);
  const [isLoggingOutAll, setIsLoggingOutAll] = useState(false);

  const handleLogoutAllDevices = async () => {
    if (!isAdmin) return;
    if (!window.confirm('Are you sure you want to log out all active sessions across all devices?')) return;
    setIsLoggingOutAll(true);
    try {
      const backendUrl = await getBackendHttpUrl();
      if (backendUrl) {
        await fetch(`${backendUrl}/api/auth/logout-all`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-auth-user': currentUser || '' }
        });
      }
      setStatusMsg({ text: 'All sessions across all devices have been revoked!' });
    } catch {
      setStatusMsg({ text: 'Revocation signal sent.', isError: false });
    } finally {
      setIsLoggingOutAll(false);
    }
  };

  // Load users from Backend API + LocalStorage + Default
  const loadUsers = async () => {
    const deleted = getDeletedUsers();
    let combined: UserAccount[] = [];
    let backendSuccess = false;

    // Fetch from backend
    try {
      const backendUrl = await getBackendHttpUrl();
      if (backendUrl) {
        const res = await fetch(`${backendUrl}/api/auth/users`, {
          headers: { 'bypass-tunnel-reminder': 'true' }
        });
        if (res.ok) {
          const data = await res.json();
          if (data && Array.isArray(data.users)) {
            combined = data.users.filter((u: UserAccount) => !deleted.includes(u.username.toLowerCase()));
            backendSuccess = true;
          }
        }
      }
    } catch (e) {
      console.warn('[UserManagement] Error loading users:', e);
    }

    // Fallback if backend wasn't reached
    if (!backendSuccess) {
      combined = DEFAULT_ACCOUNTS.filter(u => !deleted.includes(u.username.toLowerCase()));
      try {
        const stored = localStorage.getItem(CUSTOM_ACCOUNTS_KEY);
        if (stored) {
          const parsed: UserAccount[] = JSON.parse(stored);
          parsed.forEach(p => {
            if (!deleted.includes(p.username.toLowerCase()) && !combined.some(c => c.username.toLowerCase() === p.username.toLowerCase())) {
              combined.push(p);
            }
          });
        }
      } catch {}
    }

    // Merge local storage last logins if any
    try {
      const rawLogins = localStorage.getItem('trading_guru_user_last_logins');
      if (rawLogins) {
        const localLogins = JSON.parse(rawLogins);
        combined.forEach(u => {
          const storedTime = localLogins[u.username.toLowerCase()] || (u.name ? localLogins[u.name.toLowerCase()] : null);
          if (storedTime && (!u.lastLogin || new Date(storedTime) > new Date(u.lastLogin))) {
            u.lastLogin = storedTime;
          }
        });
      }
    } catch {}

    // For current logged-in user (e.g. Admin), ensure active online flag
    const currentClean = (currentUser || '').trim().toLowerCase();
    if (currentClean) {
      combined.forEach(u => {
        if (u.username.toLowerCase() === currentClean || (u.name && u.name.toLowerCase() === currentClean)) {
          u.isOnline = true;
        }
      });
    }

    setUsers(combined);
  };

  useEffect(() => {
    if (!isOpen) return;

    loadUsers();
    setStatusMsg(null);
    setConfirmDeleteUser(null);
    const timer = setInterval(loadUsers, 4000);

    // Real-time WebSocket presence synchronization
    const handleWsOnlineUpdate = (onlineList: string[], count: number) => {
      if (Array.isArray(onlineList)) {
        const onlineSet = new Set(onlineList.map(u => u.toLowerCase()));
        const currentClean = (currentUser || '').trim().toLowerCase();
        setUsers(prev => prev.map(u => {
          const isCurrent = currentClean && (currentClean === u.username.toLowerCase() || currentClean === (u.name || '').toLowerCase());
          const isOnline = isCurrent || onlineSet.has(u.username.toLowerCase()) || (u.name ? onlineSet.has(u.name.toLowerCase()) : false);
          return { ...u, isOnline };
        }));
      }
    };

    tvStreamer.addOnlineUsersListListener(handleWsOnlineUpdate);

    return () => {
      clearInterval(timer);
      tvStreamer.removeOnlineUsersListListener(handleWsOnlineUpdate);
    };
  }, [isOpen, currentUser]);

  const isAdmin = (currentUser || '').trim().toLowerCase() === 'admin';

  const onlineCount = useMemo(() => {
    const currentClean = (currentUser || '').trim().toLowerCase();
    return users.filter(u => {
      const isCurrent = currentClean && (currentClean === u.username.toLowerCase() || currentClean === (u.name || '').toLowerCase());
      return isCurrent || !!u.isOnline;
    }).length;
  }, [users, currentUser]);

  const offlineCount = Math.max(0, users.length - onlineCount);

  if (!isOpen || !isAdmin) return null;

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) {
      setStatusMsg({ text: 'Access denied: Only administrator can add user access.', isError: true });
      return;
    }

    if (!newUsername.trim() || !newPassword.trim()) {
      setStatusMsg({ text: 'Username and Password are required.', isError: true });
      return;
    }

    const cleanUser = newUsername.trim().toLowerCase();
    const cleanName = (newName.trim() || cleanUser);
    const cleanPass = newPassword.trim();

    setIsSaving(true);
    setStatusMsg(null);

    // Unmark in deleted users if re-adding
    unmarkDeletedUser(cleanUser);

    const newUserObj: UserAccount = {
      username: cleanUser,
      name: cleanName,
      password: cleanPass,
      role: newRole
    };

    // 1. Save to local storage
    try {
      const stored = localStorage.getItem(CUSTOM_ACCOUNTS_KEY);
      let list: UserAccount[] = stored ? JSON.parse(stored) : [];
      list = list.filter(u => u.username.toLowerCase() !== cleanUser);
      list.push(newUserObj);
      localStorage.setItem(CUSTOM_ACCOUNTS_KEY, JSON.stringify(list));
    } catch {}

    // 2. Sync to Backend
    try {
      const backendUrl = await getBackendHttpUrl();
      if (backendUrl) {
        await fetch(`${backendUrl}/api/auth/users`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-auth-user': currentUser || ''
          },
          body: JSON.stringify(newUserObj)
        });
      }
    } catch {}

    setIsSaving(false);
    setStatusMsg({ text: `Access granted successfully for ${cleanName}!` });
    setNewName('');
    setNewUsername('');
    setNewPassword('');
    loadUsers();
  };

  const handleDeleteUser = async (usernameToDelete: string) => {
    if (!isAdmin) {
      setStatusMsg({ text: 'Access denied: Only administrator can delete user access.', isError: true });
      return;
    }

    const clean = usernameToDelete.trim().toLowerCase();
    if (clean === 'admin') {
      setStatusMsg({ text: 'Cannot delete primary Admin account.', isError: true });
      return;
    }

    // 1. Mark in deleted users registry immediately
    addDeletedUser(clean);

    // 2. Immediately update local UI state for instant responsiveness (no modal blocking)
    setUsers(prev => prev.filter(u => u.username.toLowerCase() !== clean));
    setConfirmDeleteUser(null);
    setStatusMsg({ text: `Access revoked successfully for "${usernameToDelete}".` });

    // 3. Remove from backend asynchronously
    try {
      const backendUrl = await getBackendHttpUrl();
      if (backendUrl) {
        await fetch(`${backendUrl}/api/auth/users/${encodeURIComponent(clean)}`, {
          method: 'DELETE',
          headers: {
            'x-auth-user': currentUser || ''
          }
        });
      }
    } catch {}

    loadUsers();
  };

  const copyShareLink = (user: UserAccount) => {
    const origin = window.location.origin;
    const pathname = window.location.pathname;
    const shareUrl = `${origin}${pathname}?auth=${encodeURIComponent(user.username)}:${encodeURIComponent(user.password)}`;
    navigator.clipboard?.writeText?.(shareUrl);
    setCopiedLinkUser(user.username);
    setTimeout(() => setCopiedLinkUser(null), 2000);
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100vw',
      height: '100vh',
      background: 'rgba(4, 5, 8, 0.85)',
      backdropFilter: 'blur(8px)',
      zIndex: 99999,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '16px',
      boxSizing: 'border-box'
    }}>
      <div style={{
        width: '100%',
        maxWidth: '680px',
        maxHeight: '90vh',
        background: '#0f172a',
        border: '1px solid rgba(255, 255, 255, 0.15)',
        borderRadius: '16px',
        boxShadow: '0 25px 60px rgba(0, 0, 0, 0.8), 0 0 30px rgba(56, 189, 248, 0.15)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}>
        {/* Modal Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 20px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
          background: 'rgba(30, 41, 59, 0.4)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              background: 'linear-gradient(135deg, #0284c7, #2563eb)',
              borderRadius: '8px',
              padding: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Users size={18} color="#ffffff" />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '800', color: '#ffffff' }}>
                Manage User Access & Logins
              </h3>
              <p style={{ margin: 0, fontSize: '11px', color: '#94a3b8' }}>
                Create, revoke, and share direct credentials for individual people
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {isAdmin && (
              <button
                type="button"
                onClick={handleLogoutAllDevices}
                disabled={isLoggingOutAll}
                style={{
                  background: 'rgba(239, 68, 68, 0.15)',
                  border: '1px solid rgba(239, 68, 68, 0.4)',
                  color: '#f87171',
                  borderRadius: '6px',
                  padding: '5px 10px',
                  fontSize: '11px',
                  fontWeight: '700',
                  cursor: isLoggingOutAll ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
                title="Revoke all active sessions and log out every device"
              >
                <Shield size={12} />
                {isLoggingOutAll ? 'Revoking...' : 'Log Out All Devices'}
              </button>
            )}
            <button
              onClick={onClose}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#94a3b8',
                cursor: 'pointer',
                padding: '4px',
                borderRadius: '6px'
              }}
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Modal Content */}
        <div style={{ padding: '20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {statusMsg && (
            <div style={{
              padding: '10px 14px',
              borderRadius: '8px',
              fontSize: '12px',
              fontWeight: '600',
              background: statusMsg.isError ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)',
              border: `1px solid ${statusMsg.isError ? '#ef4444' : '#10b981'}`,
              color: statusMsg.isError ? '#f87171' : '#34d399',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <CheckCircle2 size={16} />
              <span>{statusMsg.text}</span>
            </div>
          )}

          {/* Create New User Section */}
          <div style={{
            background: 'rgba(30, 41, 59, 0.5)',
            border: '1px solid rgba(56, 189, 248, 0.25)',
            borderRadius: '12px',
            padding: '16px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '12px', color: '#38bdf8', fontSize: '13px', fontWeight: '800' }}>
              <UserPlus size={16} />
              <span>Grant Access to New Person</span>
            </div>

            <form onSubmit={handleAddUser} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '10px', alignItems: 'end' }}>
              <div>
                <label style={{ display: 'block', fontSize: '10.5px', color: '#94a3b8', marginBottom: '4px', fontWeight: '700' }}>
                  Full Name / Display Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Sharath SG"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: '6px',
                    background: 'rgba(15, 23, 42, 0.8)',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    color: '#ffffff',
                    fontSize: '12px',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '10.5px', color: '#94a3b8', marginBottom: '4px', fontWeight: '700' }}>
                  Username *
                </label>
                <input
                  type="text"
                  placeholder="e.g. sharath"
                  required
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: '6px',
                    background: 'rgba(15, 23, 42, 0.8)',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    color: '#ffffff',
                    fontSize: '12px',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '10.5px', color: '#94a3b8', marginBottom: '4px', fontWeight: '700' }}>
                  Password *
                </label>
                <input
                  type="text"
                  placeholder="e.g. sharath@2026"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: '6px',
                    background: 'rgba(15, 23, 42, 0.8)',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    color: '#ffffff',
                    fontSize: '12px',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '10.5px', color: '#94a3b8', marginBottom: '4px', fontWeight: '700' }}>
                  Role
                </label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as any)}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: '6px',
                    background: 'rgba(15, 23, 42, 0.8)',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    color: '#ffffff',
                    fontSize: '12px',
                    boxSizing: 'border-box'
                  }}
                >
                  <option value="trader">Trader</option>
                  <option value="guest">Guest / Viewer</option>
                  <option value="admin">Admin</option>
                </select>
              </div>

              <div style={{ display: 'flex', alignItems: 'end' }}>
                <button
                  type="submit"
                  disabled={isSaving}
                  style={{
                    width: '100%',
                    padding: '8px 14px',
                    background: 'linear-gradient(135deg, #0284c7, #2563eb)',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '6px',
                    fontWeight: '700',
                    fontSize: '12px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    height: '35px'
                  }}
                >
                  <UserPlus size={14} />
                  <span>{isSaving ? 'Saving...' : 'Add Access'}</span>
                </button>
              </div>
            </form>
          </div>

          {/* Active Authorized Users List */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px', flexWrap: 'wrap', gap: '8px' }}>
              <div style={{ fontSize: '13px', fontWeight: '800', color: '#ffffff', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <Shield size={15} color="#10b981" />
                <span>Authorized Users ({users.length})</span>
                <span style={{
                  fontSize: '11px',
                  fontWeight: '700',
                  color: '#34d399',
                  background: 'rgba(16, 185, 129, 0.15)',
                  border: '1px solid rgba(16, 185, 129, 0.3)',
                  padding: '2px 8px',
                  borderRadius: '12px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px'
                }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981', boxShadow: '0 0 6px #10b981' }} className="animate-pulse" />
                  {onlineCount} Online
                </span>
                <span style={{
                  fontSize: '11px',
                  fontWeight: '700',
                  color: '#94a3b8',
                  background: 'rgba(100, 116, 139, 0.15)',
                  border: '1px solid rgba(100, 116, 139, 0.25)',
                  padding: '2px 8px',
                  borderRadius: '12px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px'
                }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#64748b' }} />
                  {offlineCount} Offline
                </span>
              </div>
              <button
                onClick={loadUsers}
                style={{
                  background: 'transparent',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  borderRadius: '6px',
                  color: '#94a3b8',
                  padding: '4px 8px',
                  fontSize: '11px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                <RefreshCw size={11} /> Refresh
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {users.map((u) => {
                const currentClean = (currentUser || '').trim().toLowerCase();
                const isCurrent = currentClean === u.username.toLowerCase() || currentClean === (u.name || '').toLowerCase();
                const isOnline = isCurrent || !!u.isOnline;
                const isCopied = copiedLinkUser === u.username;
                return (
                  <div
                    key={u.username}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      background: 'rgba(30, 41, 59, 0.4)',
                      border: `1px solid ${isCurrent ? 'rgba(56, 189, 248, 0.4)' : (isOnline ? 'rgba(16, 185, 129, 0.25)' : 'rgba(255, 255, 255, 0.08)')}`,
                      borderRadius: '8px',
                      padding: '10px 14px',
                      gap: '12px',
                      flexWrap: 'wrap'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: '160px' }}>
                      <div style={{
                        position: 'relative',
                        width: '34px',
                        height: '34px',
                        borderRadius: '50%',
                        background: u.role === 'admin' ? 'rgba(168, 85, 247, 0.2)' : 'rgba(56, 189, 248, 0.2)',
                        border: `1px solid ${u.role === 'admin' ? '#a855f7' : '#38bdf8'}`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: u.role === 'admin' ? '#c084fc' : '#38bdf8',
                        fontWeight: '800',
                        fontSize: '13px'
                      }}>
                        {(u.name || u.username)[0].toUpperCase()}
                        {/* Avatar status dot */}
                        <span
                          style={{
                            position: 'absolute',
                            bottom: '-1px',
                            right: '-1px',
                            width: '9px',
                            height: '9px',
                            borderRadius: '50%',
                            backgroundColor: isOnline ? '#10b981' : '#64748b',
                            border: '1.5px solid #0f172a',
                            boxShadow: isOnline ? '0 0 6px #10b981' : 'none'
                          }}
                        />
                      </div>
                      <div>
                        <div style={{ fontSize: '13px', fontWeight: '800', color: '#ffffff', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span>{u.name || u.username}</span>
                          {isCurrent && (
                            <span style={{ fontSize: '9.5px', background: 'rgba(56, 189, 248, 0.2)', color: '#38bdf8', padding: '1px 5px', borderRadius: '4px' }}>
                              You
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: '11px', color: '#94a3b8', fontFamily: 'monospace' }}>
                          @{u.username} · Role: <strong style={{ color: '#cbd5e1', textTransform: 'capitalize' }}>{u.role || 'trader'}</strong>
                        </div>
                      </div>
                    </div>

                    {/* Online / Offline Status Badge */}
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      background: isOnline ? 'rgba(16, 185, 129, 0.12)' : 'rgba(100, 116, 139, 0.12)',
                      border: `1px solid ${isOnline ? 'rgba(16, 185, 129, 0.35)' : 'rgba(100, 116, 139, 0.25)'}`,
                      padding: '4px 10px',
                      borderRadius: '6px',
                      fontSize: '11px',
                      whiteSpace: 'nowrap'
                    }}>
                      <span
                        style={{
                          width: '7px',
                          height: '7px',
                          borderRadius: '50%',
                          backgroundColor: isOnline ? '#10b981' : '#64748b',
                          boxShadow: isOnline ? '0 0 8px #10b981' : 'none'
                        }}
                        className={isOnline ? 'animate-pulse' : ''}
                      />
                      <strong style={{
                        color: isOnline ? '#34d399' : '#94a3b8',
                        fontWeight: '800',
                        letterSpacing: '0.2px'
                      }}>
                        {isOnline ? (isCurrent ? 'Online (You)' : 'Online') : 'Offline'}
                      </strong>
                    </div>

                    {/* Password Display */}
                    <div style={{
                      background: 'rgba(15, 23, 42, 0.7)',
                      padding: '4px 8px',
                      borderRadius: '6px',
                      fontSize: '11px',
                      fontFamily: 'monospace',
                      color: '#94a3b8',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}>
                      <Key size={12} color="#60a5fa" />
                      <span>Password: <strong style={{ color: '#e2e8f0' }}>{u.password}</strong></span>
                    </div>

                    {/* True Last Login Display */}
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                      background: u.lastLogin ? 'rgba(56, 189, 248, 0.08)' : 'rgba(255, 255, 255, 0.04)',
                      border: `1px solid ${u.lastLogin ? 'rgba(56, 189, 248, 0.25)' : 'rgba(255, 255, 255, 0.08)'}`,
                      padding: '4px 9px',
                      borderRadius: '6px',
                      fontSize: '11px',
                      whiteSpace: 'nowrap'
                    }}
                    title={u.lastLogin ? `Last Login: ${formatFullIST(u.lastLogin)}` : 'No recorded login session yet'}
                    >
                      <Clock size={12} color={u.lastLogin ? '#38bdf8' : '#64748b'} />
                      <span style={{ color: '#94a3b8' }}>Last Login:</span>
                      <strong style={{
                        color: u.lastLogin ? '#e2e8f0' : '#64748b',
                        fontWeight: '700'
                      }}>
                        {u.lastLogin ? formatDisplayTime(u.lastLogin) : 'Never'}
                      </strong>
                    </div>

                    {/* Action Buttons */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <button
                        onClick={() => copyShareLink(u)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          background: isCopied ? 'rgba(16, 185, 129, 0.2)' : 'rgba(56, 189, 248, 0.12)',
                          border: `1px solid ${isCopied ? '#10b981' : 'rgba(56, 189, 248, 0.3)'}`,
                          color: isCopied ? '#34d399' : '#38bdf8',
                          padding: '5px 10px',
                          borderRadius: '6px',
                          fontSize: '11px',
                          fontWeight: '700',
                          cursor: 'pointer'
                        }}
                        title="Copy direct 1-click login URL"
                      >
                        {isCopied ? <CheckCircle2 size={13} /> : <Copy size={13} />}
                        <span>{isCopied ? 'Link Copied!' : 'Copy 1-Click Link'}</span>
                      </button>

                      {u.username.toLowerCase() !== 'admin' && (
                        confirmDeleteUser === u.username ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <button
                              onClick={() => handleDeleteUser(u.username)}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px',
                                background: '#dc2626',
                                color: '#ffffff',
                                border: 'none',
                                padding: '5px 9px',
                                borderRadius: '6px',
                                fontSize: '11px',
                                fontWeight: '800',
                                cursor: 'pointer',
                                boxShadow: '0 2px 6px rgba(220, 38, 38, 0.4)'
                              }}
                            >
                              <Trash2 size={12} />
                              <span>Confirm</span>
                            </button>
                            <button
                              onClick={() => setConfirmDeleteUser(null)}
                              style={{
                                background: 'rgba(255, 255, 255, 0.1)',
                                color: '#94a3b8',
                                border: 'none',
                                padding: '5px 8px',
                                borderRadius: '6px',
                                fontSize: '11px',
                                cursor: 'pointer'
                              }}
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setConfirmDeleteUser(u.username)}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              background: 'rgba(239, 68, 68, 0.12)',
                              border: '1px solid rgba(239, 68, 68, 0.3)',
                              color: '#f87171',
                              padding: '5px 8px',
                              borderRadius: '6px',
                              cursor: 'pointer'
                            }}
                            title="Delete user access"
                          >
                            <Trash2 size={13} />
                          </button>
                        )
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

        </div>

      </div>
    </div>
  );
};
