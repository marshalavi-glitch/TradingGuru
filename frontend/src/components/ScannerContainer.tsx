import React, { useState, useEffect } from 'react';
import { RefreshCw, Clock, Play } from 'lucide-react';

interface ScanResult {
  symbol: string;
  close: number;
  levelValue: number;
  distancePct: number;
  distancePts: number;
}

interface ScannerData {
  lastScanTime: string | null;
  isScanning: boolean;
  results: Record<string, ScanResult[]>;
}

interface ScannerContainerProps {
  onSymbolSelect: (symbol: string) => void;
  onSwitchToChart: () => void;
}

const LEVEL_LABELS: Record<string, { label: string; desc: string; isBullish: boolean }> = {
  level1: { label: 'L1 (R6)', desc: 'Extreme Breakout V-Shape VAH', isBullish: true },
  level2: { label: 'L2 (R5)', desc: 'Strong Breakout Momentum', isBullish: true },
  level3: { label: 'L3 (R4)', desc: 'Breakout Threshold Line', isBullish: true },
  level4: { label: 'L4 (R3)', desc: 'Fading Resistance Boundary', isBullish: false },
  level5: { label: 'L5 (R2)', desc: 'Minor Resistance Level', isBullish: false },
  level6: { label: 'L6 (S2)', desc: 'Minor Support Level', isBullish: false },
  level7: { label: 'L7 (S3)', desc: 'Fading Support Boundary', isBullish: false },
  level8: { label: 'L8 (S4)', desc: 'Breakdown Threshold Line', isBullish: false },
  level9: { label: 'L9 (S5)', desc: 'Strong Breakdown Momentum', isBullish: false },
  level10: { label: 'L10 (S6)', desc: 'Extreme Breakdown V-Shape VAL', isBullish: false }
};

export const ScannerContainer: React.FC<ScannerContainerProps> = ({
  onSymbolSelect,
  onSwitchToChart
}) => {
  const [activeLevel, setActiveLevel] = useState<string>('level3'); // Default to L3 (R4) breakout line
  const [activeTimeframe, setActiveTimeframe] = useState<'5' | 'D'>('5'); // Timeframe state
  const [scannerData, setScannerData] = useState<ScannerData>({
    lastScanTime: null,
    isScanning: false,
    results: {
      level1: [], level2: [], level3: [], level4: [], level5: [],
      level6: [], level7: [], level8: [], level9: [], level10: []
    }
  });
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  // Poll background scanner results from backend
  useEffect(() => {
    let isMounted = true;
    
    // Only show loading spinner on initial load to prevent layout bounce
    if (!scannerData.lastScanTime) {
      setLoading(true);
    }
    
    const fetchResults = async () => {
      try {
        const backendUrl = window.location.port === '5175' ? 'http://localhost:3002' : window.location.origin;
        const res = await fetch(`${backendUrl}/api/scanner/results?timeframe=${activeTimeframe}`);
        if (res.ok) {
          const data = await res.json();
          if (isMounted) {
            setScannerData(data);
            setLoading(false);
          }
        }
      } catch (err) {
        console.error('Failed to fetch scanner results:', err);
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchResults();
    
    // Poll every 10 seconds silently
    const interval = setInterval(fetchResults, 10000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [refreshKey, activeTimeframe]);

  const handleManualRefresh = () => {
    setRefreshKey(prev => prev + 1);
  };

  const formatTime = (isoString: string | null) => {
    if (!isoString) return 'Never';
    const date = new Date(isoString);
    return date.toLocaleTimeString('en-IN', { hour12: false });
  };

  const getLevelColor = (key: string, isActive: boolean) => {
    const isBullish = LEVEL_LABELS[key]?.isBullish;
    if (isActive) {
      return isBullish 
        ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.25), rgba(5, 150, 105, 0.35))'
        : 'linear-gradient(135deg, rgba(239, 68, 68, 0.25), rgba(220, 38, 38, 0.35))';
    }
    return 'rgba(255, 255, 255, 0.02)';
  };

  const getLevelBorder = (key: string, isActive: boolean) => {
    const isBullish = LEVEL_LABELS[key]?.isBullish;
    if (isActive) {
      return isBullish ? '1px solid #10b981' : '1px solid #ef4444';
    }
    return '1px solid rgba(255, 255, 255, 0.05)';
  };

  const handleSymbolClick = (symbol: string) => {
    onSymbolSelect(symbol);
    onSwitchToChart();
  };

  const activeResults = scannerData.results[activeLevel] || [];

  return (
    <div className="glass-panel animate-fade-in" style={{ padding: '24px', flex: 1, display: 'flex', flexDirection: 'column', minHeight: '600px' }}>
      
      {/* Scanner Status Header */}
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255, 255, 255, 0.06)', paddingBottom: '16px', marginBottom: '20px', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '18px', fontWeight: '800', color: 'white', letterSpacing: '-0.3px' }}>
              Real-Time Matrix Scanner ({activeTimeframe === '5' ? '5m' : '1D'})
            </span>
            {scannerData.isScanning && (
              <span style={{ fontSize: '10px', background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b', padding: '2px 8px', borderRadius: '12px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#f59e0b', animation: 'pulse 1.2s infinite' }} />
                SCANNING...
              </span>
            )}
          </div>
          <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>
            Scans top 500 Indian stocks automatically to identify opportunities trading within 0.25% of any {activeTimeframe === '5' ? 'Daily' : 'Monthly'} matrix level.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          {/* Timeframe Switcher Toggle */}
          <div style={{ display: 'flex', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', padding: '2px', border: '1px solid var(--border-color)', gap: '2px' }}>
            <button
              onClick={() => setActiveTimeframe('5')}
              style={{
                background: activeTimeframe === '5' ? 'var(--bg-input)' : 'transparent',
                color: activeTimeframe === '5' ? '#3b82f6' : 'var(--text-secondary)',
                border: 'none',
                borderRadius: '6px',
                padding: '5px 12px',
                fontSize: '11px',
                fontWeight: '700',
                cursor: 'pointer',
                transition: 'all 0.15s'
              }}
            >
              5 Min
            </button>
            <button
              onClick={() => setActiveTimeframe('D')}
              style={{
                background: activeTimeframe === 'D' ? 'var(--bg-input)' : 'transparent',
                color: activeTimeframe === 'D' ? '#3b82f6' : 'var(--text-secondary)',
                border: 'none',
                borderRadius: '6px',
                padding: '5px 12px',
                fontSize: '11px',
                fontWeight: '700',
                cursor: 'pointer',
                transition: 'all 0.15s'
              }}
            >
              1 Day
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--text-muted)' }}>
            <Clock size={14} />
            <span>Last Scan: {formatTime(scannerData.lastScanTime)}</span>
          </div>

          <button
            onClick={handleManualRefresh}
            disabled={scannerData.isScanning}
            style={{
              background: 'var(--bg-input)',
              color: 'white',
              border: '1px solid var(--border-color)',
              borderRadius: '8px',
              padding: '6px 12px',
              fontSize: '12px',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              opacity: scannerData.isScanning ? 0.6 : 1
            }}
          >
            <RefreshCw size={12} className={scannerData.isScanning ? 'spin-anim' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 0' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '50%', border: '3px solid rgba(255,255,255,0.05)', borderTopColor: '#3b82f6', animation: 'spin 1s linear infinite', marginBottom: '16px' }} />
          <span style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Gathering initial stock scans... (this may take up to 10 seconds)</span>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', flex: 1 }}>
          
          {/* Level selection grid */}
          <div>
            <div style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--text-secondary)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Select Matrix Level to View
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: '10px' }}>
              {Object.keys(LEVEL_LABELS).map((lvlKey) => {
                const count = scannerData.results[lvlKey]?.length || 0;
                const isActive = activeLevel === lvlKey;
                const isBullish = LEVEL_LABELS[lvlKey].isBullish;
                
                return (
                  <button
                    key={lvlKey}
                    onClick={() => setActiveLevel(lvlKey)}
                    style={{
                      background: getLevelColor(lvlKey, isActive),
                      border: getLevelBorder(lvlKey, isActive),
                      borderRadius: '10px',
                      padding: '10px 8px',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '4px',
                      transition: 'all 0.2s',
                      boxShadow: isActive ? `0 0 15px ${isBullish ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)'}` : 'none'
                    }}
                  >
                    <span style={{ fontSize: '12px', fontWeight: '800', color: isActive ? 'white' : 'var(--text-secondary)' }}>
                      {LEVEL_LABELS[lvlKey].label}
                    </span>
                    <span style={{ 
                      fontSize: '15px', 
                      fontWeight: '900', 
                      color: count > 0 
                        ? (isBullish ? '#10b981' : '#ef4444') 
                        : 'var(--text-muted)' 
                    }}>
                      {count} {count === 1 ? 'stock' : 'stocks'}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Active Level Detail Banner */}
          <div style={{
            background: 'var(--bg-input)',
            border: '1px solid rgba(255,255,255,0.04)',
            borderRadius: '12px',
            padding: '12px 18px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px'
          }}>
            <div>
              <span style={{ 
                fontSize: '11px', 
                fontWeight: '800', 
                color: LEVEL_LABELS[activeLevel].isBullish ? '#10b981' : '#ef4444', 
                background: LEVEL_LABELS[activeLevel].isBullish ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                padding: '2px 8px', 
                borderRadius: '4px',
                textTransform: 'uppercase',
                marginRight: '8px'
              }}>
                {LEVEL_LABELS[activeLevel].isBullish ? 'Bullish Break' : 'Bearish Level'}
              </span>
              <span style={{ fontSize: '14px', fontWeight: 'bold', color: 'white' }}>
                {LEVEL_LABELS[activeLevel].desc}
              </span>
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
              Showing {activeResults.length} matches within 0.25% proximity.
            </div>
          </div>

          {/* Table list */}
          <div style={{ flex: 1, overflowX: 'auto', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '600px' }}>
              <thead>
                <tr style={{ background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                  <th style={{ padding: '12px 20px', fontSize: '11px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Symbol</th>
                  <th style={{ padding: '12px 20px', fontSize: '11px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Type</th>
                  <th style={{ padding: '12px 20px', fontSize: '11px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Current Close</th>
                  <th style={{ padding: '12px 20px', fontSize: '11px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Level Target</th>
                  <th style={{ padding: '12px 20px', fontSize: '11px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Distance (Pts)</th>
                  <th style={{ padding: '12px 20px', fontSize: '11px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Distance (%)</th>
                  <th style={{ padding: '12px 20px', fontSize: '11px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {activeResults.length > 0 ? (
                  activeResults.map((row) => {
                    const cleanSymbolName = row.symbol.split(':')[1];
                    const isBullish = LEVEL_LABELS[activeLevel].isBullish;
                    const distColor = row.distancePct >= 0 ? '#10b981' : '#ef4444';

                    return (
                      <tr 
                        key={row.symbol}
                        style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', transition: 'background-color 0.15s' }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.015)'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                      >
                        <td style={{ padding: '14px 20px' }}>
                          <span style={{ fontSize: '14px', fontWeight: '700', color: 'white' }}>{cleanSymbolName}</span>
                          <span style={{ fontSize: '10px', color: 'var(--text-muted)', marginLeft: '8px', background: 'rgba(255,255,255,0.03)', padding: '2px 6px', borderRadius: '4px' }}>
                            {row.symbol.split(':')[0]}
                          </span>
                        </td>
                        <td style={{ padding: '14px 20px' }}>
                          <span style={{ 
                            fontSize: '10px', 
                            fontWeight: '800', 
                            color: isBullish ? '#10b981' : '#ef4444',
                            textTransform: 'uppercase'
                          }}>
                            {isBullish ? 'BULLISH' : 'BEARISH'}
                          </span>
                        </td>
                        <td style={{ padding: '14px 20px', fontSize: '14px', fontWeight: '700', color: 'white', fontFamily: 'var(--font-mono)' }}>
                          ₹{row.close.toFixed(2)}
                        </td>
                        <td style={{ padding: '14px 20px', fontSize: '14px', fontWeight: '700', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                          ₹{row.levelValue.toFixed(2)}
                        </td>
                        <td style={{ padding: '14px 20px', fontSize: '14px', fontWeight: 'bold', color: distColor, fontFamily: 'var(--font-mono)' }}>
                          {row.distancePts >= 0 ? '+' : ''}{row.distancePts.toFixed(2)}
                        </td>
                        <td style={{ padding: '14px 20px', fontSize: '14px', fontWeight: '800', color: distColor, fontFamily: 'var(--font-mono)' }}>
                          {row.distancePct >= 0 ? '+' : ''}{row.distancePct.toFixed(2)}%
                        </td>
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
                    <td colSpan={7} style={{ padding: '50px 20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '14px' }}>
                      No stocks currently trading near this level.
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
        @keyframes pulse {
          0% { transform: scale(0.9); opacity: 0.6; }
          50% { transform: scale(1.1); opacity: 1; }
          100% { transform: scale(0.9); opacity: 0.6; }
        }
      `}</style>
    </div>
  );
};
