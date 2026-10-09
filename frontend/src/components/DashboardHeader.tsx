import React, { useState, useEffect, useRef } from 'react';
import { Search, X, Activity, RefreshCw, Settings, Users, Volume2, Sun, Moon, LogOut, User, UserPlus, Landmark, TrendingUp, Layers } from 'lucide-react';
import { tvStreamer, getBackendHttpUrl } from '../utils/tvStreamer';
import { useTheme } from '../context/ThemeContext';

interface DashboardHeaderProps {
  currentSymbol: string;
  currentTimeframe: string;
  connectionStatus: 'connecting' | 'connected' | 'disconnected';
  onSymbolChange: (symbol: string) => void;
  onTimeframeChange: (timeframe: string) => void;
  onRefresh: () => void;
  authUser?: string | null;
  onLogout?: () => void;
  onOpenUserManagement?: () => void;
}

interface SymbolPreset {
  value: string;
  label: string;
  type: 'index' | 'futures' | 'stock';
  exchange: string;
}

export const DashboardHeader: React.FC<DashboardHeaderProps> = ({
  currentSymbol,
  currentTimeframe,
  connectionStatus,
  onSymbolChange,
  onTimeframeChange,
  onRefresh,
  authUser,
  onLogout,
  onOpenUserManagement
}) => {
  const { isDark, toggleTheme } = useTheme();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'stock' | 'futures' | 'index'>('all');
  const [apiResults, setApiResults] = useState<SymbolPreset[]>([]);
  const [loadingApi, setLoadingApi] = useState(false);
  const [symbolsList, setSymbolsList] = useState<SymbolPreset[]>([]);
  const [currentTime, setCurrentTime] = useState<string>('');
  const [lastUpdateTime, setLastUpdateTime] = useState<string>('');
  const [onlineUsers, setOnlineUsers] = useState<number>(1);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const modalInputRef = useRef<HTMLInputElement>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const settingsRef = useRef<HTMLDivElement>(null);

  const handleRefreshClick = () => {
    setIsRefreshing(true);
    setLastUpdateTime(new Date().toLocaleTimeString('en-GB', { timeZone: 'Asia/Kolkata' }));
    onRefresh();
    setTimeout(() => setIsRefreshing(false), 800);
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) {
        setIsSettingsOpen(false);
      }
    };
    if (isSettingsOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isSettingsOpen]);

  // Live Active Online Users Counter
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const backendUrl = await getBackendHttpUrl();
        const res = await fetch(`${backendUrl}/api/online-users`, {
          headers: { 'bypass-tunnel-reminder': 'true' }
        });
        if (res.ok) {
          const data = await res.json();
          if (data && typeof data.count === 'number') {
            setOnlineUsers(Math.max(1, data.count));
          }
        }
      } catch (err) {
        // Ignore fetch errors
      }
    };

    fetchUsers();
    tvStreamer.setOnlineUsersListener((count) => {
      setOnlineUsers(Math.max(1, count));
    });

    const interval = setInterval(fetchUsers, 5000);
    return () => clearInterval(interval);
  }, []);

  // Live IST Clock
  useEffect(() => {
    const updateClock = () => {
      const timeStr = new Date().toLocaleTimeString('en-GB', { timeZone: 'Asia/Kolkata' });
      setCurrentTime(timeStr);
      setLastUpdateTime((prev) => prev || timeStr);
    };
    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, []);

  // Load symbols list dynamically on mount
  useEffect(() => {
    const loadPresets = async () => {
      try {
        const backendUrl = await getBackendHttpUrl();
        const res = await fetch(`${backendUrl}/api/symbols/presets`);
        if (res.ok) {
          const data = await res.json();
          setSymbolsList(data);
        }
      } catch (err) {
        console.error('Failed to load symbols presets from backend:', err);
      }
    };
    loadPresets();
  }, []);

  // Debounced search query fetching from backend search proxy endpoint
  useEffect(() => {
    if (!searchQuery.trim()) {
      setApiResults([]);
      return;
    }

    const delayDebounce = setTimeout(async () => {
      setLoadingApi(true);
      try {
        const backendUrl = await getBackendHttpUrl();
        const res = await fetch(`${backendUrl}/api/search?query=${encodeURIComponent(searchQuery)}`);
        if (res.ok) {
          const data = await res.json();
          setApiResults(data);
        }
      } catch (err) {
        console.error('Failed to fetch symbols from backend search API:', err);
      } finally {
        setLoadingApi(false);
      }
    }, 300);

    return () => clearTimeout(delayDebounce);
  }, [searchQuery]);

  // Focus modal input when modal opens
  useEffect(() => {
    if (isModalOpen && modalInputRef.current) {
      setTimeout(() => {
        modalInputRef.current?.focus();
        modalInputRef.current?.select();
      }, 50);
    }
  }, [isModalOpen]);

  // Handle escape key to close modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isModalOpen) {
        setIsModalOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isModalOpen]);

  const handleSelectSymbol = (val: string) => {
    onSymbolChange(val);
    setIsModalOpen(false);
  };

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      let formatted = searchQuery.trim().toUpperCase();
      if (!formatted.includes(':')) {
        const isDeriv = (formatted.endsWith('FUT') || formatted.endsWith('CE') || formatted.endsWith('PE')) && /\d/.test(formatted);
        const isMcx = ['CRUDEOIL', 'GOLD', 'SILVER', 'NATURALGAS', 'COPPER', 'ZINC'].some(c => formatted.includes(c));
        formatted = isDeriv ? `NFO:${formatted}` : isMcx ? `MCX:${formatted}` : `NSE:${formatted}`;
      }
      handleSelectSymbol(formatted);
    }
  };

  const getStatusColor = () => {
    switch (connectionStatus) {
      case 'connected': return '#10b981';
      case 'connecting': return '#f59e0b';
      case 'disconnected': return '#ef4444';
    }
  };

  const filteredSymbols = symbolsList.filter((item) => {
    const matchesQuery = item.value.toLowerCase().includes(searchQuery.toLowerCase()) || 
                         item.label.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesTab = activeTab === 'all' || item.type === activeTab;
    return matchesQuery && matchesTab;
  }).slice(0, 100);

  const timeframes = [
    { value: '1', label: '1m' },
    { value: '5', label: '5m' },
    { value: '15', label: '15m' },
    { value: '30', label: '30m' },
    { value: '60', label: '1H' },
    { value: 'D', label: '1D' },
    { value: 'W', label: '1W' },
    { value: 'M', label: '1M' },
  ];

  const isAdmin = (authUser || '').trim().toLowerCase() === 'admin';

  return (
    <header className="glass-panel animate-fade-in" style={{ padding: '8px 14px', position: 'relative', zIndex: 1100, overflow: 'visible' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', width: '100%', flexWrap: 'wrap' }}>
        
        {/* Left: Logo & Title + Tagline */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
            <div style={{
              background: 'linear-gradient(135deg, var(--accent-blue), var(--accent-purple))',
              borderRadius: '6px',
              padding: '4px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 10px rgba(99, 102, 241, 0.4)'
            }}>
              <Activity size={16} color="white" />
            </div>
            <span style={{ fontSize: '15px', fontWeight: '900', margin: 0, letterSpacing: '-0.3px', color: 'var(--text-primary)', whiteSpace: 'nowrap', lineHeight: '1.2' }}>
              Trading Guru
            </span>
          </div>
          <span style={{
            fontSize: '9.5px',
            fontWeight: '800',
            color: isDark ? '#60a5fa' : '#1d4ed8',
            letterSpacing: '0.2px',
            whiteSpace: 'nowrap'
          }}>
            Price Action • Order Flow • Market Profile • Market Logic
          </span>
        </div>

        {/* ONE Unified Symbol Search Box (Click opens modal) */}
        <div 
          onClick={() => setIsModalOpen(true)}
          style={{ 
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: isDark ? 'rgba(255, 255, 255, 0.05)' : '#f1f5f9',
            border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.12)' : '#cbd5e1'}`,
            borderRadius: '20px',
            padding: '5px 14px',
            cursor: 'pointer',
            minWidth: '150px',
            maxWidth: '220px',
            boxSizing: 'border-box',
            transition: 'all 0.2s ease'
          }}
          title="Search any stock, future, index, or option contract"
        >
          <Search size={14} color="var(--text-secondary)" />
          <span style={{ fontSize: '12px', color: isDark ? '#38bdf8' : '#0284c7', fontWeight: '800', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {currentSymbol}
          </span>
        </div>

        {/* Timeframe Selector Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', overflowX: 'auto', WebkitOverflowScrolling: 'touch', padding: '1px 0' }}>
          {timeframes.map((tf) => {
            const isActive = currentTimeframe === tf.value;
            return (
              <button
                key={tf.value}
                onClick={() => onTimeframeChange(tf.value)}
                style={{
                  background: isActive ? (isDark ? 'rgba(56, 189, 248, 0.2)' : '#e0f2fe') : 'transparent',
                  border: isActive ? `1px solid ${isDark ? '#38bdf8' : '#0284c7'}` : '1px solid transparent',
                  color: isActive ? (isDark ? '#38bdf8' : '#0284c7') : 'var(--text-secondary)',
                  padding: '4px 8px',
                  borderRadius: '14px',
                  fontSize: '11px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  transition: 'all 0.15s ease'
                }}
              >
                {tf.label}
              </button>
            );
          })}
        </div>

        {/* Right Section: Viewers + LIVE Indicator + Theme Toggle + Settings Gear Menu */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
          
          {/* Active Viewers Count Badge (Before Live) */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              padding: '4px 9px',
              borderRadius: '12px',
              background: isDark ? 'rgba(59, 130, 246, 0.12)' : 'rgba(239, 246, 255, 0.9)',
              border: `1px solid ${isDark ? 'rgba(59, 130, 246, 0.25)' : '#bfdbfe'}`,
              color: isDark ? '#93c5fd' : '#1d4ed8',
              fontSize: '11px',
              fontWeight: '700',
              whiteSpace: 'nowrap'
            }}
            title="Real-time people currently viewing the dashboard"
          >
            <Users size={12} />
            <span>{onlineUsers} {onlineUsers === 1 ? 'Viewer' : 'Viewers'}</span>
          </div>

          {/* LIVE Connection Indicator */}
          <div
            onClick={() => {
              const current = tvStreamer.computeBackendUrl();
              const input = window.prompt('Enter Live Backend Server / Tunnel URL:', current);
              if (input !== null) {
                tvStreamer.setBackendUrl(input);
                onRefresh();
              }
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              padding: '4px 8px',
              borderRadius: '12px',
              background: 'transparent',
              cursor: 'pointer'
            }}
            title="Click to configure Backend URL"
          >
            <div style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: getStatusColor(), boxShadow: `0 0 8px ${getStatusColor()}` }} className="animate-pulse" />
            <span style={{ fontSize: '11px', fontWeight: '800', color: isDark ? '#10b981' : '#059669', letterSpacing: '0.2px' }}>
              Live
            </span>
          </div>

          {/* Refresh Button (Near Live) */}
          <button
            onClick={handleRefreshClick}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '5px',
              height: '30px',
              padding: '0 10px',
              background: isDark ? 'rgba(56, 189, 248, 0.12)' : 'rgba(2, 132, 199, 0.08)',
              border: `1px solid ${isDark ? 'rgba(56, 189, 248, 0.3)' : '#bae6fd'}`,
              borderRadius: '8px',
              cursor: 'pointer',
              color: isDark ? '#38bdf8' : '#0284c7',
              fontSize: '11px',
              fontWeight: '700',
              transition: 'all 0.2s ease'
            }}
            title="Refresh All Data & Charts"
          >
            <RefreshCw size={13} className={isRefreshing ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>

          {/* Theme Toggle Button (Sun / Moon) */}
          <button
            onClick={toggleTheme}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '30px',
              height: '30px',
              background: isDark ? 'rgba(255, 255, 255, 0.06)' : '#f1f5f9',
              border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.15)' : '#cbd5e1'}`,
              borderRadius: '8px',
              cursor: 'pointer',
              color: isDark ? '#fbbf24' : '#475569',
              transition: 'all 0.2s ease'
            }}
            title={`Theme: ${isDark ? 'Dark Mode' : 'Light Mode'}. Click to toggle.`}
          >
            {isDark ? <Sun size={15} /> : <Moon size={15} />}
          </button>

          {/* Settings Gear (⚙️) Button & Popover */}
          <div style={{ position: 'relative' }} ref={settingsRef}>
            <button
              onClick={() => setIsSettingsOpen(!isSettingsOpen)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '30px',
                height: '30px',
                background: isSettingsOpen ? 'rgba(56, 189, 248, 0.2)' : (isDark ? 'rgba(255, 255, 255, 0.06)' : '#f1f5f9'),
                border: `1px solid ${isSettingsOpen ? '#38bdf8' : (isDark ? 'rgba(255, 255, 255, 0.15)' : '#cbd5e1')}`,
                borderRadius: '8px',
                cursor: 'pointer',
                color: isSettingsOpen ? '#38bdf8' : 'var(--text-secondary)',
                transition: 'all 0.2s ease'
              }}
              title="Dashboard Settings & Tools"
            >
              <Settings size={15} />
            </button>

            {/* Popover Dropdown Menu */}
            {isSettingsOpen && (
              <div style={{
                position: 'absolute',
                top: '38px',
                right: 0,
                width: '240px',
                background: isDark ? '#0f172a' : '#ffffff',
                border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.12)' : '#cbd5e1'}`,
                borderRadius: '10px',
                boxShadow: isDark ? '0 12px 30px rgba(0, 0, 0, 0.6)' : '0 12px 30px rgba(0, 0, 0, 0.15)',
                padding: '10px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                zIndex: 9999
              }}>
                {/* Active Users Badge */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '6px 8px',
                  background: 'rgba(16, 185, 129, 0.12)',
                  borderRadius: '6px',
                  border: '1px solid rgba(16, 185, 129, 0.3)'
                }}>
                  <Users size={14} color="#10b981" />
                  <span style={{ fontSize: '11px', fontWeight: '800', color: '#10b981' }}>
                    {onlineUsers} {onlineUsers === 1 ? 'Person Active Now' : 'People Using Dashboard'}
                  </span>
                </div>

                {/* AI Voice Alert Test */}
                <button
                  onClick={() => {
                    if ('speechSynthesis' in window) {
                      window.speechSynthesis.cancel();
                      const sampleUtterance = new SpeechSynthesisUtterance('Voice alerts active. Real-time AI announcements are enabled.');
                      const voices = window.speechSynthesis.getVoices();
                      const femaleVoice = voices.find(v => v.name.includes('Zira') || v.name.includes('Jenny') || v.name.includes('Aria') || v.name.includes('Google UK English Female') || (v.name.toLowerCase().includes('female') && v.lang.startsWith('en')));
                      if (femaleVoice) sampleUtterance.voice = femaleVoice;
                      sampleUtterance.pitch = 1.25;
                      sampleUtterance.rate = 1.0;
                      window.speechSynthesis.speak(sampleUtterance);
                    }
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    background: isDark ? 'rgba(255, 255, 255, 0.05)' : '#f8fafc',
                    border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.1)' : '#e2e8f0'}`,
                    padding: '6px 10px',
                    borderRadius: '6px',
                    color: isDark ? '#ffffff' : '#0f172a',
                    fontSize: '11.5px',
                    fontWeight: '700',
                    cursor: 'pointer'
                  }}
                >
                  <Volume2 size={14} color="#60a5fa" />
                  <span>Test AI Voice Alert</span>
                </button>

                {/* Refresh Data */}
                <button
                  onClick={() => {
                    setLastUpdateTime(new Date().toLocaleTimeString('en-GB', { timeZone: 'Asia/Kolkata' }));
                    onRefresh();
                    setIsSettingsOpen(false);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    background: isDark ? 'rgba(255, 255, 255, 0.05)' : '#f8fafc',
                    border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.1)' : '#e2e8f0'}`,
                    padding: '6px 10px',
                    borderRadius: '6px',
                    color: isDark ? '#ffffff' : '#0f172a',
                    fontSize: '11.5px',
                    fontWeight: '700',
                    cursor: 'pointer'
                  }}
                >
                  <RefreshCw size={14} color="#10b981" />
                  <span>Refresh All Data</span>
                </button>

                {/* IST Clock */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '6px 8px',
                  fontSize: '11px',
                  color: 'var(--text-secondary)',
                  borderTop: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.08)' : '#e2e8f0'}`,
                  paddingTop: '8px'
                }}>
                  <span>IST Clock</span>
                  <span style={{ fontWeight: '800', color: isDark ? '#38bdf8' : '#0284c7', fontFamily: 'monospace' }}>
                    {currentTime || '--:--:--'}
                  </span>
                </div>

                {/* Last Update */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '4px 8px',
                  fontSize: '10.5px',
                  color: 'var(--text-secondary)'
                }}>
                  <span>Updated</span>
                  <span style={{ fontWeight: '700', color: '#10b981', fontFamily: 'monospace' }}>
                    {lastUpdateTime || currentTime || '--:--:--'}
                  </span>
                </div>

                {/* Manage User Logins (Admin Only) */}
                {isAdmin && onOpenUserManagement && (
                  <button
                    onClick={() => {
                      setIsSettingsOpen(false);
                      onOpenUserManagement();
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      background: isDark ? 'rgba(56, 189, 248, 0.12)' : '#f0f9ff',
                      border: `1px solid ${isDark ? 'rgba(56, 189, 248, 0.3)' : '#bae6fd'}`,
                      padding: '7px 10px',
                      borderRadius: '6px',
                      color: isDark ? '#38bdf8' : '#0284c7',
                      fontSize: '11.5px',
                      fontWeight: '700',
                      cursor: 'pointer'
                    }}
                  >
                    <UserPlus size={14} color="#38bdf8" />
                    <span>Manage User Logins</span>
                  </button>
                )}

                {/* Sign Out Option */}
                {onLogout && (
                  <button
                    onClick={() => {
                      setIsSettingsOpen(false);
                      onLogout();
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      background: isDark ? 'rgba(239, 68, 68, 0.12)' : 'rgba(254, 242, 242, 0.9)',
                      border: `1px solid ${isDark ? 'rgba(239, 68, 68, 0.25)' : '#fecaca'}`,
                      padding: '7px 10px',
                      borderRadius: '6px',
                      color: isDark ? '#f87171' : '#dc2626',
                      fontSize: '11.5px',
                      fontWeight: '700',
                      cursor: 'pointer',
                      marginTop: '4px'
                    }}
                  >
                    <LogOut size={14} color={isDark ? '#f87171' : '#dc2626'} />
                    <span>Sign Out ({authUser || 'User'})</span>
                  </button>
                )}
              </div>
            )}
          </div>

          {/* User Badge & Direct Logout Button */}
          {authUser && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: '2px' }}>
              <div
                onClick={isAdmin ? onOpenUserManagement : undefined}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  padding: '4px 9px',
                  borderRadius: '12px',
                  background: isDark ? 'rgba(99, 102, 241, 0.15)' : 'rgba(238, 242, 255, 0.9)',
                  border: `1px solid ${isDark ? 'rgba(99, 102, 241, 0.35)' : '#c7d2fe'}`,
                  color: isDark ? '#a5b4fc' : '#4338ca',
                  fontSize: '11px',
                  fontWeight: '700',
                  whiteSpace: 'nowrap',
                  cursor: isAdmin && onOpenUserManagement ? 'pointer' : 'default'
                }}
                title={isAdmin ? `Logged in as ${authUser} (Admin). Click to manage user access.` : `Logged in as ${authUser}`}
              >
                <User size={12} />
                <span style={{ textTransform: 'capitalize' }}>{authUser}</span>
              </div>
              {onLogout && (
                <button
                  onClick={onLogout}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '4px',
                    height: '30px',
                    padding: '0 8px',
                    background: isDark ? 'rgba(239, 68, 68, 0.12)' : 'rgba(254, 242, 242, 0.9)',
                    border: `1px solid ${isDark ? 'rgba(239, 68, 68, 0.3)' : '#fecaca'}`,
                    borderRadius: '8px',
                    cursor: 'pointer',
                    color: isDark ? '#f87171' : '#dc2626',
                    fontSize: '11px',
                    fontWeight: '700',
                    transition: 'all 0.15s ease'
                  }}
                  title="Sign out of Trading Guru"
                >
                  <LogOut size={13} />
                  <span>Exit</span>
                </button>
              )}
            </div>
          )}

        </div>

      </div>


          {/* TradingView-Style Search Overlay Modal */}
      {isModalOpen && (
        <div 
          onClick={() => setIsModalOpen(false)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            background: 'rgba(4, 5, 8, 0.85)',
            backdropFilter: 'blur(8px)',
            zIndex: 9999,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            padding: '12px',
            boxSizing: 'border-box'
          }}
        >
          {/* Modal Container */}
          <div 
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: '650px',
              backgroundColor: isDark ? '#0d1017' : '#ffffff',
              border: `1px solid ${isDark ? 'var(--border-color)' : '#cbd5e1'}`,
              borderRadius: '14px',
              boxShadow: isDark ? '0 20px 50px rgba(0, 0, 0, 0.7)' : '0 20px 50px rgba(0, 0, 0, 0.15)',
              display: 'flex',
              flexDirection: 'column',
              maxHeight: '90vh',
              overflow: 'hidden',
              animation: 'fadeIn 0.2s cubic-bezier(0.16, 1, 0.3, 1) forwards',
              boxSizing: 'border-box'
            }}
          >
            
            {/* Input Row */}
            <form onSubmit={handleCustomSubmit} style={{ display: 'flex', alignItems: 'center', borderBottom: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.06)' : '#e2e8f0'}`, padding: '14px 16px', gap: '10px' }}>
              <Search size={18} color="var(--text-secondary)" />
              <input
                ref={modalInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search Angel One (e.g. RELIANCE, NIFTY)..."
                style={{
                  flex: 1,
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  color: isDark ? 'white' : '#0f172a',
                  fontSize: '15px',
                  fontWeight: '500',
                  padding: '4px 0'
                }}
              />
              {searchQuery && (
                <button 
                  type="button"
                  onClick={() => setSearchQuery('')}
                  style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px', color: 'var(--text-secondary)' }}
                >
                  <X size={16} />
                </button>
              )}
              <button 
                type="button" 
                onClick={() => setIsModalOpen(false)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                  padding: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  marginLeft: '4px'
                }}
              >
                <X size={18} />
              </button>
            </form>

            {/* Category tabs */}
            <div style={{ display: 'flex', borderBottom: '1px solid rgba(255, 255, 255, 0.03)', padding: '8px 16px', gap: '6px', overflowX: 'auto' }}>
              {(['all', 'stock', 'futures', 'index'] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  style={{
                    background: activeTab === tab ? 'rgba(59, 130, 246, 0.15)' : 'transparent',
                    border: 'none',
                    color: activeTab === tab ? '#3b82f6' : 'var(--text-secondary)',
                    borderRadius: '6px',
                    padding: '6px 12px',
                    fontSize: '12px',
                    fontWeight: '600',
                    textTransform: 'capitalize',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {tab === 'all' ? 'All' : tab === 'stock' ? 'Stocks' : tab === 'futures' ? 'Futures' : 'Indices'}
                </button>
              ))}
            </div>

            {/* Symbol preset results list */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '6px 0', WebkitOverflowScrolling: 'touch' }}>
              {searchQuery && (
                <div 
                  onClick={() => {
                    let formatted = searchQuery.trim().toUpperCase();
                    if (!formatted.includes(':')) {
                      const isDeriv = (formatted.endsWith('FUT') || formatted.endsWith('CE') || formatted.endsWith('PE')) && /\d/.test(formatted);
                      const isMcx = ['CRUDEOIL', 'GOLD', 'SILVER', 'NATURALGAS', 'COPPER', 'ZINC'].some(c => formatted.includes(c));
                      formatted = isDeriv ? `NFO:${formatted}` : isMcx ? `MCX:${formatted}` : `NSE:${formatted}`;
                    }
                    handleSelectSymbol(formatted);
                  }}
                  style={{
                    padding: '12px 20px',
                    fontSize: '13px',
                    cursor: 'pointer',
                    color: '#3b82f6',
                    borderBottom: '1px solid rgba(255,255,255,0.02)',
                    fontWeight: '600'
                  }}
                >
                  Press Enter to search custom symbol: "{searchQuery.toUpperCase()}"
                </div>
              )}

              {loadingApi ? (
                <div style={{ padding: '30px 20px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '13px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: '16px', height: '16px', borderRadius: '50%', border: '2px solid rgba(255,255,255,0.1)', borderTopColor: '#3b82f6', animation: 'spin 0.8s linear infinite' }} />
                  Searching Angel One database...
                </div>
              ) : searchQuery ? (
                (() => {
                  const activeApiResults = apiResults.filter(item => activeTab === 'all' || item.type === activeTab);
                  if (activeApiResults.length === 0) {
                    return (
                      <div style={{ padding: '30px 20px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '13px' }}>
                        No matching Indian symbols found.
                      </div>
                    );
                  }
                  return activeApiResults.map((item) => {
                    const getIcon = () => {
                      switch (item.type) {
                        case 'index': return <Landmark size={14} color="#00f0ff" />;
                        case 'futures': return <TrendingUp size={14} color="#f59e0b" />;
                        case 'stock': return <Layers size={14} color="#ec4899" />;
                        default: return <Activity size={14} color="#60a5fa" />;
                      }
                    };

                    return (
                      <div
                        key={item.value}
                        onClick={() => handleSelectSymbol(item.value)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '12px 20px',
                          cursor: 'pointer',
                          minHeight: '44px',
                          borderBottom: '1px solid rgba(255, 255, 255, 0.02)'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div style={{
                            width: '26px',
                            height: '26px',
                            borderRadius: '50%',
                            backgroundColor: 'rgba(255, 255, 255, 0.04)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}>
                            {getIcon()}
                          </div>
                          <div>
                            <div style={{ fontSize: '14px', fontWeight: '700', color: isDark ? 'white' : '#0f172a' }}>
                              {(item.value && item.value.includes(':') ? item.value.split(':')[1] : item.value) || item.value}
                            </div>
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                              {item.label}
                            </div>
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ 
                            fontSize: '10px', 
                            fontWeight: '800', 
                            color: item.type === 'index' ? '#00f0ff' : item.type === 'futures' ? '#f59e0b' : '#ec4899',
                            textTransform: 'uppercase'
                          }}>
                            {item.type}
                          </span>
                          <span style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--text-secondary)' }}>
                            {item.exchange}
                          </span>
                        </div>
                      </div>
                    );
                  });
                })()
              ) : filteredSymbols.length > 0 ? (
                filteredSymbols.map((item) => {
                  const getIcon = () => {
                    switch (item.type) {
                      case 'index': return <Landmark size={14} color="#00f0ff" />;
                      case 'futures': return <TrendingUp size={14} color="#f59e0b" />;
                      case 'stock': return <Layers size={14} color="#ec4899" />;
                      default: return <Activity size={14} color="#60a5fa" />;
                    }
                  };

                  return (
                    <div
                      key={item.value}
                      onClick={() => handleSelectSymbol(item.value)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '12px 20px',
                        cursor: 'pointer',
                        minHeight: '44px',
                        borderBottom: '1px solid rgba(255, 255, 255, 0.02)'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{
                          width: '26px',
                          height: '26px',
                          borderRadius: '50%',
                          backgroundColor: 'rgba(255, 255, 255, 0.04)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}>
                          {getIcon()}
                        </div>
                        <div>
                          <div style={{ fontSize: '14px', fontWeight: '700', color: isDark ? 'white' : '#0f172a' }}>
                            {(item.value && item.value.includes(':') ? item.value.split(':')[1] : item.value) || item.value}
                          </div>
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                            {item.label}
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ 
                          fontSize: '10px', 
                          fontWeight: '800', 
                          color: item.type === 'index' ? '#00f0ff' : item.type === 'futures' ? '#f59e0b' : '#ec4899',
                          textTransform: 'uppercase'
                        }}>
                          {item.type}
                        </span>
                        <span style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--text-secondary)' }}>
                          {item.exchange}
                        </span>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div style={{ padding: '30px 20px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '13px' }}>
                  No matching presets found. Type and press Enter to search.
                </div>
              )}
            </div>

            <div style={{ 
              padding: '10px 16px', 
              borderTop: '1px solid rgba(255,255,255,0.03)', 
              fontSize: '11px', 
              color: 'var(--text-muted)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <span>Search stocks (e.g. RELIANCE, ZOMATO)</span>
              <span>Tap outside or ESC to close</span>
            </div>
            
          </div>
        </div>
      )}


      {/* Embedded fadeIn keyframe styling */}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: scale(0.97); }
          to { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </header>
  );
};
