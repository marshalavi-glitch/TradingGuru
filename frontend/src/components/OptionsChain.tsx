import { useState, useEffect, useRef } from 'react';
import { Loader2, AlertCircle, TrendingUp, Search, X } from 'lucide-react';

interface OptionsChainProps {
  currentSymbol: string;
  onSymbolChange: (symbol: string) => void;
  onSwitchToChart: () => void;
}

interface ExpiryItem {
  code: string;
  label: string;
}

interface OptionItem {
  strike: number;
  CE: { symbol: string; ltp: number | null };
  PE: { symbol: string; ltp: number | null };
}

interface OptionChainResponse {
  underlyingPrice: number;
  expiries: ExpiryItem[];
  selectedExpiry: string;
  data: OptionItem[];
}

interface SearchResult {
  value: string;
  label: string;
  type: string;
  exchange: string;
}

export function OptionsChain({ currentSymbol, onSymbolChange, onSwitchToChart }: OptionsChainProps) {
  const backendUrl = window.location.port === '5175' ? 'http://localhost:3002' : window.location.origin;

  const [expiry, setExpiry] = useState<string>('');
  const [data, setData] = useState<OptionChainResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Local search states
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [loadingSearch, setLoadingSearch] = useState<boolean>(false);
  const [showDropdown, setShowDropdown] = useState<boolean>(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Normalize underlying symbol (extract root if currently viewing an option contract)
  const underlyingSymbol = (() => {
    let clean = currentSymbol;
    if (currentSymbol.includes(':')) {
      clean = currentSymbol.split(':')[1];
    }
    const match = clean.match(/^([A-Z]+)\d+/);
    if (match) {
      return `NSE:${match[1]}`;
    }
    return currentSymbol;
  })();

  // Fetch Option Chain data
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    const fetchUrl = `${backendUrl}/api/options/chain?symbol=${underlyingSymbol}${expiry ? `&expiry=${expiry}` : ''}`;
    
    fetch(fetchUrl)
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load options chain data');
        return res.json();
      })
      .then((payload: OptionChainResponse) => {
        if (active) {
          setData(payload);
          if (!expiry || !payload.expiries.some(e => e.code === expiry)) {
            setExpiry(payload.selectedExpiry);
          }
          setLoading(false);
        }
      })
      .catch((err) => {
        if (active) {
          setError(err.message || 'An error occurred');
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [underlyingSymbol, expiry, backendUrl]);

  // Debounced search query lookup
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    setLoadingSearch(true);
    const delayDebounce = setTimeout(() => {
      fetch(`${backendUrl}/api/search?query=${encodeURIComponent(searchQuery)}`)
        .then(res => res.json())
        .then((results: SearchResult[]) => {
          // Filter to stock indices and stocks suitable for options
          setSearchResults(results.slice(0, 8));
          setLoadingSearch(false);
        })
        .catch(err => {
          console.error('Search failed:', err);
          setLoadingSearch(false);
        });
    }, 250);

    return () => clearTimeout(delayDebounce);
  }, [searchQuery, backendUrl]);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleOptionClick = (optionSymbol: string) => {
    onSymbolChange(optionSymbol);
    onSwitchToChart();
  };

  const handleSelectUnderlying = (symbolCode: string) => {
    onSymbolChange(symbolCode);
    setSearchQuery('');
    setShowDropdown(false);
    setExpiry(''); // Reset expiry so it loads default for new symbol
  };

  if (loading && !data) {
    return (
      <div className="glass-panel" style={{ flex: '1', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px', minHeight: '300px' }}>
        <Loader2 className="animate-spin" size={28} color="var(--accent-blue)" style={{ animation: 'spin 1.5s linear infinite' }} />
        <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>Compiling live options chain prices...</p>
      </div>
    );
  }

  // Find closest strike for ATM marker
  const atmStrike = data?.data && data.data.length > 0
    ? data.data.reduce((prev, curr) => {
        return Math.abs(curr.strike - data.underlyingPrice) < Math.abs(prev.strike - data.underlyingPrice) ? curr : prev;
      }).strike
    : null;

  return (
    <div className="glass-panel animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '16px', borderRadius: '12px', flex: '1', minHeight: '0', position: 'relative' }}>
      
      {/* Top Banner Info & Search bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '12px', flexWrap: 'wrap', gap: '12px' }}>
        
        {/* Left Side: Local Search & Title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', position: 'relative' }} ref={dropdownRef}>
          <div>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: 'var(--text-primary)' }}>
              {underlyingSymbol.replace('NSE:', '')} Options Chain
            </h3>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Real-time premiums sourced from TradingView</span>
          </div>

          {/* Search Box */}
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <Search size={14} color="var(--text-muted)" style={{ position: 'absolute', left: '10px' }} />
            <input
              type="text"
              placeholder="Search underlying..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setShowDropdown(true);
              }}
              onFocus={() => setShowDropdown(true)}
              style={{
                padding: '6px 12px 6px 30px',
                borderRadius: '16px',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                background: 'rgba(255, 255, 255, 0.02)',
                color: 'var(--text-primary)',
                fontSize: '12px',
                outline: 'none',
                width: '160px',
                transition: 'all 0.15s'
              }}
              onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.15)')}
              onMouseLeave={(e) => {
                if (document.activeElement !== e.currentTarget) {
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)';
                }
              }}
              onFocusCapture={(e) => (e.currentTarget.style.borderColor = '#3b82f6')}
              onBlurCapture={(e) => (e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)')}
            />
            {searchQuery && (
              <X
                size={14}
                color="var(--text-muted)"
                onClick={() => setSearchQuery('')}
                style={{ position: 'absolute', right: '10px', cursor: 'pointer' }}
              />
            )}

            {/* Search Dropdown Popup */}
            {showDropdown && (searchQuery.trim() !== '') && (
              <div style={{
                position: 'absolute',
                top: '34px',
                left: 0,
                width: '260px',
                background: 'rgba(20, 20, 25, 0.95)',
                backdropFilter: 'blur(10px)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '8px',
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
                zIndex: 999,
                overflow: 'hidden',
                padding: '4px 0'
              }}>
                {loadingSearch ? (
                  <div style={{ padding: '12px', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)', fontSize: '12px' }}>
                    <Loader2 className="animate-spin" size={14} style={{ animation: 'spin 1.5s linear infinite' }} />
                    Searching...
                  </div>
                ) : searchResults.length === 0 ? (
                  <div style={{ padding: '12px', color: 'var(--text-muted)', fontSize: '12px' }}>
                    No matching F&O symbols found
                  </div>
                ) : (
                  searchResults.map((item) => (
                    <div
                      key={item.value}
                      onClick={() => handleSelectUnderlying(item.value)}
                      style={{
                        padding: '8px 12px',
                        cursor: 'pointer',
                        fontSize: '12px',
                        color: 'var(--text-primary)',
                        display: 'flex',
                        flexDirection: 'column',
                        borderBottom: '1px solid rgba(255, 255, 255, 0.02)',
                        transition: 'background 0.15s'
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(59, 130, 246, 0.12)')}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                    >
                      <span style={{ fontWeight: '600' }}>{item.value.replace('NSE:', '')}</span>
                      <span style={{ fontSize: '10px', color: 'var(--text-muted)', textOverflow: 'ellipsis', whiteSpace: 'nowrap', overflow: 'hidden' }}>
                        {item.label}
                      </span>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Spot price indicator */}
        {data && (
          <div style={{ textAlign: 'right' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Underlying Spot Price</span>
            <div style={{ fontSize: '18px', fontWeight: '700', color: '#10b981', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <TrendingUp size={16} />
              ₹{data.underlyingPrice.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
          </div>
        )}
      </div>

      {error ? (
        <div style={{ padding: '24px', display: 'flex', alignItems: 'center', gap: '12px', border: '1px solid rgba(239, 68, 68, 0.3)', backgroundColor: 'rgba(239, 68, 68, 0.05)', borderRadius: '12px' }}>
          <AlertCircle color="#ef4444" size={24} />
          <div>
            <h4 style={{ margin: 0, color: '#ef4444', fontSize: '15px' }}>Option Chain Unavailable</h4>
            <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: 'var(--text-secondary)' }}>
              Could not fetch options chain. Ensure underlying symbol matches F&O lists.
            </p>
          </div>
        </div>
      ) : !data || data.data.length === 0 ? (
        <div style={{ padding: '24px', color: 'var(--text-muted)', fontSize: '13px', textAlign: 'center' }}>
          No options data resolved for this contract.
        </div>
      ) : (
        <>
          {/* Horizontal Expiry List */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', paddingBottom: '4px' }}>
            {data.expiries.map((exp) => (
              <button
                key={exp.code}
                onClick={() => setExpiry(exp.code)}
                style={{
                  padding: '6px 12px',
                  borderRadius: '20px',
                  border: expiry === exp.code ? '1px solid #3b82f6' : '1px solid rgba(255, 255, 255, 0.08)',
                  background: expiry === exp.code ? 'rgba(59, 130, 246, 0.15)' : 'rgba(255, 255, 255, 0.02)',
                  color: expiry === exp.code ? '#3b82f6' : 'var(--text-secondary)',
                  fontSize: '12px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all 0.15s'
                }}
              >
                {exp.label}
              </button>
            ))}
          </div>

          {/* Options Chain Table */}
          <div style={{ flex: '1', overflowY: 'auto', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '8px', background: 'rgba(0,0,0,0.1)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', tableLayout: 'fixed' }}>
              <thead>
                <tr style={{ background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                  <th style={{ padding: '10px 16px', textAlign: 'left', color: 'var(--text-secondary)', fontWeight: '600', width: '40%' }}>Calls (CE LTP)</th>
                  <th style={{ padding: '10px 8px', textAlign: 'center', color: '#3b82f6', fontWeight: '700', width: '20%', background: 'rgba(59,130,246,0.05)' }}>Strike</th>
                  <th style={{ padding: '10px 16px', textAlign: 'right', color: 'var(--text-secondary)', fontWeight: '600', width: '40%' }}>Puts (PE LTP)</th>
                </tr>
              </thead>
              <tbody>
                {data.data.map((row) => {
                  const isAtm = row.strike === atmStrike;
                  return (
                    <tr
                      key={row.strike}
                      style={{
                        borderBottom: '1px solid rgba(255,255,255,0.04)',
                        background: isAtm ? 'rgba(59, 130, 246, 0.04)' : 'transparent'
                      }}
                    >
                      {/* Call Option Cell */}
                      <td
                        onClick={() => handleOptionClick(row.CE.symbol)}
                        style={{
                          padding: '12px 16px',
                          textAlign: 'left',
                          cursor: 'pointer',
                          color: 'var(--text-primary)',
                          transition: 'background 0.15s'
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(16, 185, 129, 0.08)')}
                        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>CE</span>
                          <span style={{ fontWeight: '600', color: row.CE.ltp ? '#10b981' : 'var(--text-muted)' }}>
                            {row.CE.ltp ? `₹${row.CE.ltp.toFixed(2)}` : '-'}
                          </span>
                        </div>
                      </td>

                      {/* Strike Price Center Column */}
                      <td
                        style={{
                          padding: '12px 8px',
                          textAlign: 'center',
                          fontWeight: '700',
                          color: isAtm ? '#3b82f6' : 'var(--text-primary)',
                          background: 'rgba(59, 130, 246, 0.03)',
                          borderLeft: '1px solid rgba(255,255,255,0.05)',
                          borderRight: '1px solid rgba(255,255,255,0.05)',
                          fontSize: '14px'
                        }}
                      >
                        {row.strike.toLocaleString('en-IN')}
                        {isAtm && <div style={{ fontSize: '9px', fontWeight: '600', color: '#3b82f6', marginTop: '2px' }}>ATM</div>}
                      </td>

                      {/* Put Option Cell */}
                      <td
                        onClick={() => handleOptionClick(row.PE.symbol)}
                        style={{
                          padding: '12px 16px',
                          textAlign: 'right',
                          cursor: 'pointer',
                          color: 'var(--text-primary)',
                          transition: 'background 0.15s'
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.08)')}
                        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', direction: 'rtl' }}>
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>PE</span>
                          <span style={{ fontWeight: '600', color: row.PE.ltp ? '#ef4444' : 'var(--text-muted)' }}>
                            {row.PE.ltp ? `₹${row.PE.ltp.toFixed(2)}` : '-'}
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      <style>{`
        .glass-panel::-webkit-scrollbar {
          width: 6px;
        }
        .glass-panel::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.1);
          border-radius: 4px;
        }
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
