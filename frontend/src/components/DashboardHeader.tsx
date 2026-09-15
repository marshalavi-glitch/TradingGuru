import React, { useState, useEffect, useRef } from 'react';
import { Search, X, Activity, RefreshCw, Landmark, TrendingUp, Layers, Users } from 'lucide-react';
import { tvStreamer, getBackendHttpUrl } from '../utils/tvStreamer';

interface DashboardHeaderProps {
  currentSymbol: string;
  currentTimeframe: string;
  connectionStatus: 'connecting' | 'connected' | 'disconnected';
  onSymbolChange: (symbol: string) => void;
  onTimeframeChange: (timeframe: string) => void;
  onRefresh: () => void;
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
  onRefresh
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'stock' | 'futures' | 'index'>('all');
  const [apiResults, setApiResults] = useState<SymbolPreset[]>([]);
  const [loadingApi, setLoadingApi] = useState(false);
  const [symbolsList, setSymbolsList] = useState<SymbolPreset[]>([]);
  const [currentTime, setCurrentTime] = useState<string>('');
  const [lastUpdateTime, setLastUpdateTime] = useState<string>('');
  const [onlineUsers, setOnlineUsers] = useState<number>(1);
  const modalInputRef = useRef<HTMLInputElement>(null);

  // Live Active Online Users Counter
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const backendUrl = await getBackendHttpUrl();
        const res = await fetch(`${backendUrl}/api/online-users`);
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

    const interval = setInterval(fetchUsers, 15000);
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
        formatted = `NSE:${formatted}`;
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

  return (
    <header className="glass-panel animate-fade-in" style={{ padding: '12px 16px', position: 'relative', zIndex: 1100, overflow: 'visible' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '100%' }}>
        
        {/* Row 1: Logo & Title + Connection Status + Refresh */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
          
          {/* Logo & Title */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              background: 'linear-gradient(135deg, var(--accent-blue), var(--accent-purple))',
              borderRadius: '8px',
              padding: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 12px rgba(99, 102, 241, 0.4)'
            }}>
              <Activity size={20} color="white" />
            </div>
            <div>
              <h1 style={{ fontSize: '18px', fontWeight: '800', margin: 0, letterSpacing: '-0.3px', lineHeight: '1.2' }}>
                Trading Guru
              </h1>
              <p style={{ fontSize: '10px', color: 'var(--text-secondary)', margin: 0, fontWeight: '700', letterSpacing: '0.4px' }}>
                REAL-TIME CANDLESTICK CHARTS
              </p>
            </div>
          </div>

          {/* Right Controls: IST Clock + Status + Refresh */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            
            {/* IST Clock */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'var(--bg-input)', border: '1px solid var(--border-color)', padding: '4px 8px', borderRadius: '6px' }}>
              <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#00f0ff', fontFamily: 'monospace' }}>
                {currentTime ? `${currentTime}` : '--:--:--'}
              </span>
            </div>

            {/* Active Users Badge */}
            <div 
              style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '6px', 
                background: 'rgba(16, 185, 129, 0.15)', 
                border: '1px solid rgba(16, 185, 129, 0.4)', 
                padding: '4px 10px', 
                borderRadius: '6px',
                boxShadow: '0 0 10px rgba(16, 185, 129, 0.2)'
              }} 
              title="Current Active Users Connected to Dashboard Right Now"
            >
              <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#10b981' }} className="animate-pulse" />
              <Users size={13} color="#10b981" />
              <span style={{ fontSize: '11px', fontWeight: '800', color: '#10b981', letterSpacing: '0.2px' }}>
                {onlineUsers} {onlineUsers === 1 ? 'User Active' : 'Users Active Right Now'}
              </span>
            </div>

            {/* Live Connection Badge */}
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
                gap: '6px',
                background: 'var(--bg-input)',
                border: '1px solid var(--border-color)',
                padding: '4px 10px',
                borderRadius: '6px',
                cursor: 'pointer'
              }}
              title="Click to configure Backend URL"
            >
              <div style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: getStatusColor(), boxShadow: `0 0 8px ${getStatusColor()}` }} />
              <span style={{ fontSize: '11px', textTransform: 'capitalize', fontWeight: 'bold', color: 'var(--text-primary)' }}>
                {connectionStatus === 'connected' ? 'LIVE' : connectionStatus}
              </span>
            </div>

            {/* Refresh */}
            <button
              onClick={() => {
                setLastUpdateTime(new Date().toLocaleTimeString('en-GB', { timeZone: 'Asia/Kolkata' }));
                onRefresh();
              }}
              style={{
                background: 'transparent',
                cursor: 'pointer',
                padding: '6px',
                borderRadius: '6px',
                color: 'var(--text-secondary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '1px solid var(--border-color)'
              }}
              title="Refresh Data"
            >
              <RefreshCw size={14} />
            </button>
          </div>
        </div>

        {/* Row 2: Symbol Search Tap Target & Timeframe Selector Bar */}
        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px', width: '100%' }}>
          
          {/* Symbol Search Selector Button (Full width on mobile) */}
          <div 
            onClick={() => setIsModalOpen(true)}
            style={{ 
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              background: 'var(--bg-input)',
              border: '1px solid var(--border-color)',
              borderRadius: '8px',
              padding: '8px 12px',
              cursor: 'pointer',
              flex: '1 1 200px',
              minWidth: '180px',
              boxSizing: 'border-box'
            }}
          >
            <Search size={15} color="var(--text-secondary)" />
            <span style={{ fontSize: '13px', color: '#60a5fa', fontWeight: '800', flex: 1, letterSpacing: '0.2px' }}>
              {currentSymbol}
            </span>
            <span style={{ fontSize: '10px', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.06)', padding: '2px 6px', borderRadius: '4px', fontWeight: '600' }}>
              Search 🔍
            </span>
          </div>

          {/* Timeframe Selector Pill Bar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', overflowX: 'auto', WebkitOverflowScrolling: 'touch', padding: '2px 0' }}>
            {timeframes.map((tf) => (
              <button
                key={tf.value}
                onClick={() => onTimeframeChange(tf.value)}
                style={{
                  background: currentTimeframe === tf.value ? '#3b82f6' : 'rgba(255, 255, 255, 0.05)',
                  border: currentTimeframe === tf.value ? '1px solid #3b82f6' : '1px solid transparent',
                  color: currentTimeframe === tf.value ? '#ffffff' : 'var(--text-secondary)',
                  padding: '5px 9px',
                  borderRadius: '6px',
                  fontSize: '11px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap'
                }}
              >
                {tf.label}
              </button>
            ))}
          </div>
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
            justify: 'center',
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
              backgroundColor: '#0d1017',
              border: '1px solid var(--border-color)',
              borderRadius: '14px',
              boxShadow: '0 20px 50px rgba(0, 0, 0, 0.7)',
              display: 'flex',
              flexDirection: 'column',
              maxHeight: '90vh',
              overflow: 'hidden',
              animation: 'fadeIn 0.2s cubic-bezier(0.16, 1, 0.3, 1) forwards',
              boxSizing: 'border-box'
            }}
          >
            
            {/* Input Row */}
            <form onSubmit={handleCustomSubmit} style={{ display: 'flex', alignItems: 'center', borderBottom: '1px solid rgba(255, 255, 255, 0.06)', padding: '14px 16px', gap: '10px' }}>
              <Search size={18} color="var(--text-secondary)" />
              <input
                ref={modalInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search symbol (e.g. RELIANCE, NIFTY)..."
                style={{
                  flex: 1,
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  color: 'white',
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
                      formatted = `NSE:${formatted}`;
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
                  Searching TradingView database...
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
                            <div style={{ fontSize: '14px', fontWeight: '700', color: 'white' }}>
                              {item.value.split(':')[1]}
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
                          <div style={{ fontSize: '14px', fontWeight: '700', color: 'white' }}>
                            {item.value.split(':')[1]}
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
              justify: 'space-between',
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
