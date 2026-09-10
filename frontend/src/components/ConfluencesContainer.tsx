import React, { useState, useEffect } from 'react';
import { RefreshCw, Clock, Play, Layers } from 'lucide-react';

interface ConfluenceResult {
  symbol: string;
  currentPrice: number;
  dailyLevelKey: string;
  dailyLevelName: string;
  dailyLevelVal: number;
  monthlyLevelKey: string;
  monthlyLevelName: string;
  monthlyLevelVal: number;
  confluencePrice: number;
  differencePct: number;
  distancePts: number;
  distancePct: number;
}

interface ConfluencesContainerProps {
  onSymbolSelect: (symbol: string) => void;
  onSwitchToChart: () => void;
}

export const ConfluencesContainer: React.FC<ConfluencesContainerProps> = ({
  onSymbolSelect,
  onSwitchToChart
}) => {
  const [confluences, setConfluences] = useState<ConfluenceResult[]>([]);
  const [threshold, setThreshold] = useState<number>(0.5); // Default 0.5%
  const [loading, setLoading] = useState<boolean>(true);
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [lastScanTimes, setLastScanTimes] = useState<{ '5': string | null; 'D': string | null }>({ '5': null, 'D': null });
  const [refreshKey, setRefreshKey] = useState<number>(0);

  useEffect(() => {
    let isMounted = true;
    
    const fetchConfluences = async () => {
      try {
        const backendUrl = window.location.port === '5175' ? 'http://localhost:3002' : window.location.origin;
        const res = await fetch(`${backendUrl}/api/scanner/confluences?threshold=${threshold}`);
        if (res.ok) {
          const data = await res.json();
          if (isMounted) {
            setConfluences(data.confluences || []);
            setLastScanTimes(data.lastScanTime || { '5': null, 'D': null });
            setLoading(false);
          }
        }
      } catch (err) {
        console.error('Failed to fetch confluences:', err);
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchConfluences();
    const interval = setInterval(fetchConfluences, 10000); // Poll every 10 seconds

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [refreshKey, threshold]);

  const handleManualRefresh = () => {
    setLoading(true);
    setRefreshKey(prev => prev + 1);
  };

  const formatTime = (isoString: string | null) => {
    if (!isoString) return '--:--';
    const date = new Date(isoString);
    return date.toLocaleTimeString('en-IN', { hour12: false });
  };

  const handleSymbolClick = (symbol: string) => {
    onSymbolSelect(symbol);
    onSwitchToChart();
  };

  return (
    <div className="glass-panel animate-fade-in" style={{ padding: '24px', flex: 1, display: 'flex', flexDirection: 'column', minHeight: '600px' }}>
      
      {/* Header */}
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255, 255, 255, 0.06)', paddingBottom: '16px', marginBottom: '20px', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Layers size={20} color="#3b82f6" />
            <span style={{ fontSize: '18px', fontWeight: '800', color: 'white', letterSpacing: '-0.3px' }}>
              Level Confluences (5m & Daily Overlaps)
            </span>
          </div>
          <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>
            Scans for overlapping support/resistance zones where a Daily level and Monthly level are within close range of each other.
          </p>
        </div>

        {/* Controls */}
        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          {/* Threshold Selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '4px 12px' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 'bold', textTransform: 'uppercase' }}>Overlap Limit:</span>
            <select 
              value={threshold} 
              onChange={(e) => {
                setLoading(true);
                setThreshold(parseFloat(e.target.value));
              }}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#3b82f6',
                fontSize: '12px',
                fontWeight: '800',
                cursor: 'pointer',
                outline: 'none'
              }}
            >
              <option value="0.2" style={{ background: 'var(--bg-card)', color: 'white' }}>0.20% Max</option>
              <option value="0.3" style={{ background: 'var(--bg-card)', color: 'white' }}>0.30% Max</option>
              <option value="0.5" style={{ background: 'var(--bg-card)', color: 'white' }}>0.50% Max</option>
              <option value="0.8" style={{ background: 'var(--bg-card)', color: 'white' }}>0.80% Max</option>
              <option value="1.0" style={{ background: 'var(--bg-card)', color: 'white' }}>1.00% Max</option>
            </select>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', fontSize: '11px', color: 'var(--text-muted)' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Clock size={11} /> 5m Scan: {formatTime(lastScanTimes['5'])}
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
              <Clock size={11} /> Daily Scan: {formatTime(lastScanTimes['D'])}
            </span>
          </div>

          <button
            onClick={handleManualRefresh}
            style={{
              background: 'var(--bg-input)',
              color: 'white',
              border: '1px solid var(--border-color)',
              borderRadius: '8px',
              padding: '6px 12px',
              fontSize: '12px',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <RefreshCw size={12} className={loading ? 'spin-anim' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 0' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '50%', border: '3px solid rgba(255,255,255,0.05)', borderTopColor: '#3b82f6', animation: 'spin 1s linear infinite', marginBottom: '16px' }} />
          <span style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Analyzing level overlaps across all stocks...</span>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', flex: 1 }}>
          
          {/* Table list */}
          <div style={{ flex: 1, overflowX: 'auto', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '800px' }}>
              <thead>
                <tr style={{ background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                  <th style={{ padding: '12px 20px', fontSize: '11px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Symbol</th>
                  <th style={{ padding: '12px 20px', fontSize: '11px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Daily Matrix Level</th>
                  <th style={{ padding: '12px 20px', fontSize: '11px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Monthly Matrix Level</th>
                  <th style={{ padding: '12px 20px', fontSize: '11px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Confluence Price</th>
                  <th style={{ padding: '12px 20px', fontSize: '11px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Overlap Diff (%)</th>
                  <th style={{ padding: '12px 20px', fontSize: '11px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Current Price</th>
                  <th style={{ padding: '12px 20px', fontSize: '11px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Price Distance (%)</th>
                  <th style={{ padding: '12px 20px', fontSize: '11px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {confluences.length > 0 ? (
                  confluences.map((row, idx) => {
                    const cleanSymbol = row.symbol.split(':')[1];
                    const overlapColor = row.differencePct <= 0.25 ? '#10b981' : '#f59e0b';
                    const distColor = row.distancePct >= 0 ? '#10b981' : '#ef4444';
                    
                    return (
                      <tr 
                        key={`${row.symbol}-${idx}`}
                        style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', transition: 'background-color 0.15s' }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.015)'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                      >
                        {/* Symbol */}
                        <td style={{ padding: '14px 20px' }}>
                          <span style={{ fontSize: '14px', fontWeight: '700', color: 'white' }}>{cleanSymbol}</span>
                          <span style={{ fontSize: '10px', color: 'var(--text-muted)', marginLeft: '8px', background: 'rgba(255,255,255,0.03)', padding: '2px 6px', borderRadius: '4px' }}>
                            {row.symbol.split(':')[0]}
                          </span>
                        </td>

                        {/* Daily Matrix Level */}
                        <td style={{ padding: '14px 20px' }}>
                          <span style={{ fontSize: '13px', fontWeight: 'bold', color: 'white' }}>
                            {row.dailyLevelName}
                          </span>
                          <span style={{ fontSize: '11px', color: 'var(--text-secondary)', marginLeft: '8px', fontFamily: 'var(--font-mono)' }}>
                            ₹{row.dailyLevelVal.toFixed(2)}
                          </span>
                        </td>

                        {/* Monthly Matrix Level */}
                        <td style={{ padding: '14px 20px' }}>
                          <span style={{ fontSize: '13px', fontWeight: 'bold', color: 'white' }}>
                            {row.monthlyLevelName}
                          </span>
                          <span style={{ fontSize: '11px', color: 'var(--text-secondary)', marginLeft: '8px', fontFamily: 'var(--font-mono)' }}>
                            ₹{row.monthlyLevelVal.toFixed(2)}
                          </span>
                        </td>

                        {/* Confluence Price */}
                        <td style={{ padding: '14px 20px', fontSize: '14px', fontWeight: '800', color: '#60a5fa', fontFamily: 'var(--font-mono)' }}>
                          ₹{row.confluencePrice.toFixed(2)}
                        </td>

                        {/* Overlap Diff */}
                        <td style={{ padding: '14px 20px', fontSize: '13px', fontWeight: 'bold', color: overlapColor, fontFamily: 'var(--font-mono)' }}>
                          {row.differencePct.toFixed(2)}%
                        </td>

                        {/* Current Price */}
                        <td style={{ padding: '14px 20px', fontSize: '14px', fontWeight: '700', color: 'white', fontFamily: 'var(--font-mono)' }}>
                          ₹{row.currentPrice.toFixed(2)}
                        </td>

                        {/* Price Distance */}
                        <td style={{ padding: '14px 20px', fontSize: '14px', fontWeight: '800', color: distColor, fontFamily: 'var(--font-mono)' }}>
                          {row.distancePct >= 0 ? '+' : ''}{row.distancePct.toFixed(2)}%
                        </td>

                        {/* Actions */}
                        <td style={{ padding: '14px 20px', textAlign: 'right' }}>
                          <button
                            onClick={() => handleSymbolClick(row.symbol)}
                            style={{
                              background: 'linear-gradient(135deg, var(--accent-blue), var(--accent-purple))',
                              color: 'white',
                              border: 'none',
                              borderRadius: '6px',
                              padding: '6px 12px',
                              fontSize: '11px',
                              fontWeight: '600',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              boxShadow: '0 0 10px rgba(99, 102, 241, 0.2)'
                            }}
                          >
                            <Play size={10} fill="white" />
                            Load Chart
                          </button>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={8} style={{ padding: '50px 20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '14px' }}>
                      No active confluences found within the current limit. Try increasing the overlap limit.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

        </div>
      )}

      {/* Local keyframe animations */}
      <style>{`
        .spin-anim {
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};
