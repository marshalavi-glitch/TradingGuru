import React, { useState, useEffect, useMemo } from 'react';
import { RefreshCw, Clock, Search, Sparkles, TrendingUp, Play } from 'lucide-react';
import { getBackendHttpUrl } from '../utils/tvStreamer';

interface Nr7Result {
  symbol: string;
  close: number;
  open: number;
  prevHigh: number;
  prevLow: number;
  prevRange: number;
  changePts: number;
  changePct: number;
  volume: number;
  sma20: number;
  sma40: number;
  sma60: number;
  time: string;
}

interface Nr7Cache {
  lastScanTime: string | null;
  isScanning: boolean;
  results: Nr7Result[];
}

interface Nr7BreakoutContainerProps {
  onSymbolSelect: (symbol: string) => void;
  onSwitchToChart: () => void;
}

export const Nr7BreakoutContainer: React.FC<Nr7BreakoutContainerProps> = ({
  onSymbolSelect,
  onSwitchToChart
}) => {
  const [data, setData] = useState<Nr7Cache>({
    lastScanTime: null,
    isScanning: false,
    results: []
  });
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let isMounted = true;

    const fetchResults = async () => {
      try {
        const backendUrl = getBackendHttpUrl();
        const res = await fetch(`${backendUrl}/api/nr7-breakouts`);
        if (res.ok) {
          const payload = await res.json();
          if (isMounted) {
            setData(payload);
            setLoading(false);
          }
        }
      } catch (err) {
        console.error('Failed to fetch NR7 breakouts:', err);
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchResults();
    const interval = setInterval(fetchResults, 15000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [refreshKey]);

  const handleManualRefresh = () => {
    setRefreshKey(prev => prev + 1);
  };

  const handleSymbolClick = (symbolName: string) => {
    let fullSym = symbolName;
    if (!symbolName.startsWith('NSE:')) {
      fullSym = `NSE:${symbolName}`;
    }
    onSymbolSelect(fullSym);
    onSwitchToChart();
  };

  const formatTime = (isoString: string | null) => {
    if (!isoString) return 'Never';
    const date = new Date(isoString);
    return date.toLocaleTimeString('en-IN', { hour12: false });
  };

  const filteredResults = useMemo(() => {
    return data.results.filter(item => {
      if (searchQuery.trim() !== '') {
        const query = searchQuery.toUpperCase();
        return item.symbol.toUpperCase().includes(query);
      }
      return true;
    });
  }, [data.results, searchQuery]);

  return (
    <div className="glass-panel animate-fade-in" style={{ padding: '24px', flex: 1, display: 'flex', flexDirection: 'column', minHeight: '600px' }}>
      
      {/* Header Bar */}
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255, 255, 255, 0.06)', paddingBottom: '16px', marginBottom: '20px', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '20px', fontWeight: '800', color: 'white', letterSpacing: '-0.3px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Sparkles size={22} color="#3b82f6" />
              20% Upper Circuit Potential
            </span>
            {data.isScanning && (
              <span style={{ fontSize: '10px', background: 'rgba(59, 130, 246, 0.15)', color: '#3b82f6', padding: '2px 8px', borderRadius: '12px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#3b82f6', animation: 'pulse 1.2s infinite' }} />
                SCANNING...
              </span>
            )}
          </div>
          <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>
            Real-time radar scanning stocks with high 20% upper circuit expansion potential.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          {/* Search Input */}
          <div style={{ display: 'flex', alignItems: 'center', background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '6px 12px', gap: '8px', width: '220px' }}>
            <Search size={14} color="var(--text-muted)" />
            <input
              type="text"
              placeholder="Search symbol..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ background: 'transparent', border: 'none', outline: 'none', color: 'white', fontSize: '13px', width: '100%' }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--text-muted)' }}>
            <Clock size={14} />
            <span>Last Scan: {formatTime(data.lastScanTime)}</span>
          </div>

          <button
            onClick={handleManualRefresh}
            disabled={data.isScanning}
            style={{
              background: 'var(--bg-input)',
              color: 'white',
              border: '1px solid var(--border-color)',
              borderRadius: '8px',
              padding: '6px 14px',
              fontSize: '12px',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              opacity: data.isScanning ? 0.6 : 1
            }}
          >
            <RefreshCw size={12} className={data.isScanning ? 'spin-anim' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {/* Main Table */}
      {loading ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 0' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '50%', border: '3px solid rgba(255,255,255,0.05)', borderTopColor: '#3b82f6', animation: 'spin 1s linear infinite', marginBottom: '16px' }} />
          <span style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Scanning market for 20% Upper Circuit Potential candidates...</span>
        </div>
      ) : filteredResults.length === 0 ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 0', border: '1px dashed rgba(255,255,255,0.08)', borderRadius: '12px', backgroundColor: 'rgba(255,255,255,0.01)' }}>
          <TrendingUp size={36} color="var(--text-muted)" style={{ marginBottom: '12px', opacity: 0.5 }} />
          <span style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-primary)' }}>No Active 20% Upper Circuit Potential Candidates</span>
          <span style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>Standing by for high momentum expansion triggers across top Indian stocks.</span>
        </div>
      ) : (
        <div style={{ flex: 1, overflowX: 'auto', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '700px' }}>
            <thead>
              <tr style={{ background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                <th style={{ padding: '14px 20px', fontSize: '11px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Symbol</th>
                <th style={{ padding: '14px 20px', fontSize: '11px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Current Price</th>
                <th style={{ padding: '14px 20px', fontSize: '11px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Day Change</th>
                <th style={{ padding: '14px 20px', fontSize: '11px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Volume</th>
                <th style={{ padding: '14px 20px', fontSize: '11px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Prev High</th>
                <th style={{ padding: '14px 20px', fontSize: '11px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredResults.map((row) => {
                const cleanSymbol = row.symbol.includes(':') ? row.symbol.split(':')[1] : row.symbol;
                const isPositive = row.changePct >= 0;

                return (
                  <tr
                    key={row.symbol}
                    style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', transition: 'background-color 0.15s' }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.02)'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  >
                    <td style={{ padding: '14px 20px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '14px', fontWeight: '800', color: 'white' }}>{cleanSymbol}</span>
                        <span style={{ fontSize: '10px', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.03)', padding: '2px 6px', borderRadius: '4px' }}>
                          NSE
                        </span>
                      </div>
                    </td>

                    <td style={{ padding: '14px 20px', fontSize: '14px', fontWeight: '700', color: 'white', fontFamily: 'var(--font-mono)' }}>
                      ₹{row.close.toFixed(2)}
                    </td>

                    <td style={{ padding: '14px 20px', fontSize: '13px', fontWeight: '800', color: isPositive ? '#10b981' : '#ef4444', fontFamily: 'var(--font-mono)' }}>
                      {isPositive ? '+' : ''}{row.changePct.toFixed(2)}% ({isPositive ? '+' : ''}₹{row.changePts.toFixed(2)})
                    </td>

                    <td style={{ padding: '14px 20px', fontSize: '13px', fontWeight: '600', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                      {row.volume.toLocaleString('en-IN')}
                    </td>

                    <td style={{ padding: '14px 20px', fontSize: '13px', fontWeight: '600', color: '#60a5fa', fontFamily: 'var(--font-mono)' }}>
                      ₹{row.prevHigh.toFixed(2)}
                    </td>

                    <td style={{ padding: '14px 20px', textAlign: 'right' }}>
                      <button
                        onClick={() => handleSymbolClick(row.symbol)}
                        style={{
                          background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.2), rgba(37, 99, 235, 0.3))',
                          border: '1px solid #3b82f6',
                          color: '#60a5fa',
                          borderRadius: '6px',
                          padding: '6px 14px',
                          fontSize: '12px',
                          fontWeight: '700',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          transition: 'all 0.15s'
                        }}
                      >
                        <Play size={12} fill="#60a5fa" />
                        View Chart
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
