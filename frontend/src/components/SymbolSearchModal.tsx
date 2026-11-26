import React, { useState, useEffect, useRef } from 'react';
import { Search, X, Activity, Landmark, TrendingUp, Layers } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { getBackendHttpUrl } from '../utils/tvStreamer';

export interface SymbolPresetItem {
  value: string;
  label: string;
  exchange: string;
  type: string;
}

interface SymbolSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectSymbol: (symbol: string) => void;
  currentSymbol?: string;
}

export const SymbolSearchModal: React.FC<SymbolSearchModalProps> = ({
  isOpen,
  onClose,
  onSelectSymbol,
  currentSymbol
}) => {
  const { isDark } = useTheme();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'stock' | 'futures' | 'index'>('all');
  const [symbolsList, setSymbolsList] = useState<SymbolPresetItem[]>([]);
  const [apiResults, setApiResults] = useState<SymbolPresetItem[]>([]);
  const [loadingApi, setLoadingApi] = useState(false);
  const modalInputRef = useRef<HTMLInputElement>(null);

  // Load symbols list dynamically on mount or open
  useEffect(() => {
    if (!isOpen) return;
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
  }, [isOpen]);

  // Focus modal input when modal opens
  useEffect(() => {
    if (isOpen && modalInputRef.current) {
      setTimeout(() => {
        modalInputRef.current?.focus();
        modalInputRef.current?.select();
      }, 50);
    }
  }, [isOpen]);

  // Handle escape key to close modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

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
          if (Array.isArray(data)) {
            setApiResults(data);
          } else if (data && Array.isArray(data.results)) {
            setApiResults(data.results);
          } else {
            setApiResults([]);
          }
        } else {
          setApiResults([]);
        }
      } catch (err) {
        console.error('Failed to fetch symbols from backend search API:', err);
      } finally {
        setLoadingApi(false);
      }
    }, 300);

    return () => clearTimeout(delayDebounce);
  }, [searchQuery]);

  const handleSelect = (sym: string) => {
    let clean = sym.trim().toUpperCase();
    if (!clean.includes(':')) {
      if (clean.includes('GIFT')) {
        clean = (clean.endsWith('1!') || clean.endsWith('FUT')) ? 'NSEIX:GIFTNIFTY1!' : 'NSEIX:GIFTNIFTY';
      } else {
        const isDeriv = (clean.endsWith('FUT') || clean.endsWith('CE') || clean.endsWith('PE')) && /\d/.test(clean);
        const isMcx = ['CRUDEOIL', 'GOLD', 'SILVER', 'NATURALGAS', 'COPPER', 'ZINC'].some(c => clean.includes(c));
        clean = isDeriv ? `NFO:${clean}` : isMcx ? `MCX:${clean}` : `NSE:${clean}`;
      }
    }
    onSelectSymbol(clean);
    onClose();
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      handleSelect(searchQuery);
    }
  };

  const filteredSymbols = symbolsList.filter((item) => {
    const matchesQuery = item.value.toLowerCase().includes(searchQuery.toLowerCase()) || 
                         item.label.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesTab = activeTab === 'all' || item.type === activeTab;
    return matchesQuery && matchesTab;
  }).slice(0, 100);

  if (!isOpen) return null;

  return (
    <div 
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(5px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        paddingTop: '60px'
      }}
      onClick={onClose}
    >
      <div 
        style={{
          width: '90%',
          maxWidth: '560px',
          maxHeight: '80vh',
          backgroundColor: isDark ? '#0f172a' : '#ffffff',
          borderRadius: '12px',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.5)',
          border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.1)' : '#cbd5e1'}`,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          animation: 'fadeIn 0.15s ease-out'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search header bar */}
        <form 
          onSubmit={handleFormSubmit}
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: '12px 16px',
            borderBottom: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.08)' : '#e2e8f0'}`,
            gap: '10px'
          }}
        >
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
            onClick={onClose}
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
              onClick={() => handleSelect(searchQuery)}
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
              const activeApiResults = (Array.isArray(apiResults) ? apiResults : []).filter(item => activeTab === 'all' || item.type === activeTab);
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
                    onClick={() => handleSelect(item.value)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '12px 20px',
                      cursor: 'pointer',
                      minHeight: '44px',
                      borderBottom: '1px solid rgba(255, 255, 255, 0.02)',
                      backgroundColor: currentSymbol === item.value ? 'rgba(59, 130, 246, 0.1)' : 'transparent'
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
                  onClick={() => handleSelect(item.value)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 20px',
                    cursor: 'pointer',
                    minHeight: '44px',
                    borderBottom: '1px solid rgba(255, 255, 255, 0.02)',
                    backgroundColor: currentSymbol === item.value ? 'rgba(59, 130, 246, 0.1)' : 'transparent'
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
  );
};
