import React, { useState, useEffect, useMemo } from 'react';
import { Clock, AlertCircle, Play, Sparkles } from 'lucide-react';

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
  todaySignals?: any[];
}

interface SignalsContainerProps {
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

function getAtmStrike(symbol: string, price: number): number {
  const sym = symbol.toUpperCase();
  if (sym.includes('NIFTY') && !sym.includes('BANK')) {
    return Math.round(price / 50) * 50;
  }
  if (sym.includes('BANKNIFTY')) {
    return Math.round(price / 100) * 100;
  }
  if (price > 1000) {
    return Math.round(price / 20) * 20;
  }
  if (price > 500) {
    return Math.round(price / 10) * 10;
  }
  return Math.round(price / 5) * 5;
}

export const SignalsContainer: React.FC<SignalsContainerProps> = ({
  onSymbolSelect,
  onSwitchToChart
}) => {
  const [scannerData, setScannerData] = useState<ScannerData>({
    lastScanTime: null,
    isScanning: false,
    results: {},
    todaySignals: []
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openingBias, setOpeningBias] = useState<any>(null);

  useEffect(() => {
    let isMounted = true;
    
    const fetchResults = async () => {
      try {
        const backendUrl = window.location.port === '5175' ? 'http://localhost:3002' : window.location.origin;
        const res = await fetch(`${backendUrl}/api/scanner/results?timeframe=5`);
        if (res.ok) {
          const data = await res.json();
          if (isMounted) {
            setScannerData(data);
            setLoading(false);
            setError(null);
          }
        }
      } catch (err) {
        console.error('Failed to fetch scanner results for signals:', err);
        if (isMounted && !scannerData.lastScanTime) {
          setError('Could not connect to scanner backend.');
          setLoading(false);
        }
      }
    };

    fetchResults();
    const interval = setInterval(fetchResults, 10000); // Poll silently every 10 seconds

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    let isMounted = true;
    const fetchBias = async () => {
      try {
        const backendUrl = window.location.port === '5175' ? 'http://localhost:3002' : window.location.origin;
        const res = await fetch(`${backendUrl}/api/scanner/opening-bias`);
        if (res.ok) {
          const data = await res.json();
          if (isMounted) setOpeningBias(data);
        }
      } catch (err) {
        console.error('Failed to fetch opening bias for signals confluence:', err);
      }
    };
    fetchBias();
    const interval = setInterval(fetchBias, 30000); // Poll every 30 seconds
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  const formatTime = (isoString: string | null) => {
    if (!isoString) return '--:--:--';
    const date = new Date(isoString);
    return date.toLocaleTimeString('en-IN', { hour12: false });
  };

  // Memoize signal cards from today's persistent signals log
  const liveSignals = useMemo(() => {
    const signals: any[] = [];
    const rawSignals = scannerData?.todaySignals || [];
    
    // Index status for confluence check
    const niftyOpen = openingBias?.nifty?.openPrice;
    const niftyCurrent = openingBias?.nifty?.currentPrice;
    const bankniftyOpen = openingBias?.banknifty?.openPrice;
    const bankniftyCurrent = openingBias?.banknifty?.currentPrice;
    
    const isNiftyGreen = niftyOpen && niftyCurrent ? niftyCurrent > niftyOpen : false;
    const isBankNiftyGreen = bankniftyOpen && bankniftyCurrent ? bankniftyCurrent > bankniftyOpen : false;

    rawSignals.forEach(row => {
      const lvlKey = row.levelKey;
      const isBullish = ['level7', 'level8', 'level9', 'level10'].includes(lvlKey);
      const isBearish = ['level1', 'level2', 'level3', 'level4'].includes(lvlKey);
      if (!isBullish && !isBearish) return;

      const entry = row.price;
      const levelVal = row.levelValue;
      const strike = getAtmStrike(row.symbol, entry);
      const optEntry = row.optionPremium !== undefined && row.optionPremium !== null 
        ? row.optionPremium 
        : entry * 0.015;

      let sl, optSL, optTarget;
      const isSweep = row.signalType === 'sweep';
      if (isBullish) {
        sl = (isSweep && row.sweepLow) 
          ? row.sweepLow 
          : Math.min(entry * 0.996, levelVal * 0.998);
        optSL = optEntry - Math.abs(entry - sl) * 0.5;
        optTarget = optEntry + Math.abs(entry - sl) * 1.0;
      } else {
        sl = (isSweep && row.sweepHigh) 
          ? row.sweepHigh 
          : Math.max(entry * 1.004, levelVal * 1.002);
        optSL = optEntry - Math.abs(sl - entry) * 0.5;
        optTarget = optEntry + Math.abs(sl - entry) * 1.0;
      }

      // Confluence check based on stock type
      let confluence = 'Neutral Index Bias';
      let confluenceColor = 'var(--text-muted)';
      const symUpper = row.symbol.toUpperCase();
      
      const isBankStock = symUpper.includes('BANK') || ['SBIN', 'HDFCBANK', 'ICICIBANK', 'AXISBANK', 'KOTAKBANK'].some(s => symUpper.includes(s));
      const indexIsGreen = isBankStock ? isBankNiftyGreen : isNiftyGreen;
      const indexName = isBankStock ? 'Bank Nifty' : 'Nifty';

      if (niftyOpen && niftyCurrent) {
        if (isBullish) {
          confluence = indexIsGreen ? `🔥 High Conviction (${indexName} Confluence)` : `⚠️ Risky (${indexName} Drag)`;
          confluenceColor = indexIsGreen ? '#10b981' : '#f59e0b';
        } else {
          confluence = !indexIsGreen ? `🔥 High Conviction (${indexName} Confluence)` : `⚠️ Risky (${indexName} Counter-Trend)`;
          confluenceColor = !indexIsGreen ? '#10b981' : '#f59e0b';
        }
      }

      signals.push({
        symbol: row.symbol,
        direction: row.isFno === false 
          ? (isBullish ? 'BUY (Cash)' : 'SELL (Cash)') 
          : (isBullish ? 'BUY CE (Call)' : 'BUY PE (Put)'),
        strike,
        levelName: LEVEL_LABELS[lvlKey]?.label || lvlKey,
        levelValue: levelVal,
        spotEntry: entry,
        spotSL: sl,
        optEntry,
        optSL: optSL > 0 ? optSL : optEntry * 0.1,
        optTarget,
        isBullish,
        touchTime: row.touchTime,
        confluence,
        confluenceColor,
        isFno: row.isFno !== false,
        signalType: row.signalType || 'touch',
        sweepType: row.sweepType
      });
    });

    // Show latest touch signals first
    return [...signals].reverse();
  }, [scannerData, openingBias]);

  const handleSymbolClick = (symbol: string) => {
    onSymbolSelect(symbol);
    onSwitchToChart();
  };

  return (
    <div className="glass-panel animate-fade-in" style={{ padding: '24px', flex: 1, display: 'flex', flexDirection: 'column', minHeight: '600px' }}>
      
      {/* Header section */}
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255, 255, 255, 0.06)', paddingBottom: '16px', marginBottom: '20px', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '18px', fontWeight: '800', color: 'white', letterSpacing: '-0.3px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Sparkles size={18} color="#eab308" />
              Live Option Trading Signals (5m)
            </span>
          </div>
          <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>
            Lists real-time entry set-ups for stocks touching Daily Support (Buy CE) or Daily Resistance (Buy PE) levels.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '12px', color: 'var(--text-muted)' }}>
          <Clock size={14} />
          <span>Last Updated: {formatTime(scannerData.lastScanTime)}</span>
        </div>
      </div>

      {error && (
        <div style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '12px', border: '1px solid rgba(239, 68, 68, 0.3)', backgroundColor: 'rgba(239, 68, 68, 0.05)', borderRadius: '12px', marginBottom: '20px' }}>
          <AlertCircle color="#ef4444" size={20} />
          <span style={{ color: '#ef4444', fontSize: '13px' }}>{error}</span>
        </div>
      )}

      {loading ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 0' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '50%', border: '3px solid rgba(255,255,255,0.05)', borderTopColor: '#3b82f6', animation: 'spin 1s linear infinite', marginBottom: '16px' }} />
          <span style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Analyzing live market data...</span>
        </div>
      ) : (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          {liveSignals.length > 0 ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(295px, 1fr))', gap: '20px' }}>
              {liveSignals.map((sig, idx) => {
                const cleanSym = sig.symbol.split(':')[1];
                const color = sig.isBullish ? '#10b981' : '#ef4444';
                
                return (
                  <div 
                    key={`${sig.symbol}-${idx}`}
                    className="glass-panel"
                    style={{
                      background: 'rgba(255, 255, 255, 0.01)',
                      border: `1px solid ${sig.isBullish ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)'}`,
                      borderRadius: '14px',
                      padding: '20px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '14px',
                      boxShadow: '0 4px 20px rgba(0,0,0,0.15)'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <strong style={{ fontSize: '18px', color: 'white' }}>{cleanSym}</strong>
                        {sig.isFno ? (
                          <span style={{ fontSize: '10px', color: 'var(--text-secondary)', marginLeft: '8px', background: 'rgba(255,255,255,0.03)', padding: '2px 6px', borderRadius: '4px' }}>
                            ATM Strike: {sig.strike}
                          </span>
                        ) : (
                          <span style={{ fontSize: '10px', color: '#eab308', marginLeft: '8px', background: 'rgba(234, 179, 8, 0.1)', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold' }}>
                            Cash/Equity Only
                          </span>
                        )}
                        {sig.touchTime && (
                          <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>
                            {sig.signalType === 'sweep' ? 'Swept' : 'Touched'} at {sig.touchTime}
                          </div>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                        {sig.signalType === 'sweep' && (
                          <span style={{
                            fontSize: '9px',
                            fontWeight: '800',
                            color: '#a855f7',
                            background: 'rgba(168, 85, 247, 0.1)',
                            border: '1px solid rgba(168, 85, 247, 0.2)',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            textTransform: 'uppercase'
                          }}>
                            Sweep Rev
                          </span>
                        )}
                        <span style={{
                          fontSize: '11px',
                          fontWeight: '800',
                          color: color,
                          background: sig.isBullish ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                          padding: '3px 10px',
                          borderRadius: '6px',
                          textTransform: 'uppercase'
                        }}>
                          {sig.direction}
                        </span>
                      </div>
                    </div>

                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                      {sig.signalType === 'sweep' ? 'Swept level' : 'Touched level'}: <strong style={{ color: 'white' }}>{sig.levelName} ({sig.levelValue.toFixed(2)})</strong>
                    </div>

                    <div style={{
                      fontSize: '11px',
                      color: sig.confluenceColor,
                      backgroundColor: sig.confluenceColor.includes('10b981') ? 'rgba(16, 185, 129, 0.06)' : (sig.confluenceColor.includes('f59e0b') ? 'rgba(245, 158, 11, 0.06)' : 'rgba(255,255,255,0.02)'),
                      border: `1px solid ${sig.confluenceColor.includes('10b981') ? 'rgba(16, 185, 129, 0.15)' : (sig.confluenceColor.includes('f59e0b') ? 'rgba(245, 158, 11, 0.15)' : 'rgba(255,255,255,0.05)')}`,
                      padding: '5px 10px',
                      borderRadius: '6px',
                      fontWeight: '700',
                      textAlign: 'center'
                    }}>
                      {sig.confluence}
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '12px', fontSize: '13px' }}>
                      <div>
                        <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '10px', marginBottom: '2px' }}>Spot Entry:</span>
                        <strong style={{ color: 'white' }}>₹{sig.spotEntry.toFixed(2)}</strong>
                      </div>
                      <div>
                        <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '10px', marginBottom: '2px' }}>Spot SL:</span>
                        <strong style={{ color: '#ef4444' }}>₹{sig.spotSL.toFixed(2)}</strong>
                      </div>
                    </div>

                    {sig.isFno && (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.03)', borderRadius: '8px', padding: '10px', fontSize: '12px' }}>
                        <div>
                          <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '9px', marginBottom: '2px' }}>Opt Entry:</span>
                          <strong style={{ color: '#3b82f6' }}>₹{sig.optEntry.toFixed(2)}</strong>
                        </div>
                        <div>
                          <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '9px', marginBottom: '2px' }}>Opt SL:</span>
                          <strong style={{ color: '#ef4444' }}>₹{sig.optSL.toFixed(2)}</strong>
                        </div>
                        <div>
                          <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '9px', marginBottom: '2px' }}>Opt Target:</span>
                          <strong style={{ color: '#10b981' }}>₹{sig.optTarget.toFixed(2)}</strong>
                        </div>
                      </div>
                    )}

                    <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontStyle: 'italic', borderTop: '1px solid rgba(255,255,255,0.03)', paddingTop: '10px', lineHeight: '1.4' }}>
                      {sig.signalType === 'sweep' ? (
                        <span>🎯 <strong>Sweep Reversal:</strong> Rejection wick confirmed on 5m close. Stop Loss is set at the exact candle wick extreme.</span>
                      ) : (
                        <span>💡 <strong>Rule learning:</strong> Wait for a 30m candle close confirmation (wick rejection) at the level before entry to filter false breakout traps.</span>
                      )}
                    </div>

                    <button
                      onClick={() => handleSymbolClick(sig.symbol)}
                      style={{
                        background: 'linear-gradient(135deg, var(--accent-blue), var(--accent-purple))',
                        border: 'none',
                        borderRadius: '8px',
                        color: 'white',
                        fontSize: '12px',
                        fontWeight: '700',
                        padding: '8px',
                        cursor: 'pointer',
                        textAlign: 'center',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        marginTop: '4px',
                        boxShadow: '0 4px 12px rgba(99, 102, 241, 0.2)'
                      }}
                    >
                      <Play size={11} fill="white" />
                      View Interactive Chart
                    </button>
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '100px 0', border: '1px dashed rgba(255,255,255,0.06)', borderRadius: '14px' }}>
              <span style={{ fontSize: '15px', color: 'var(--text-secondary)', marginBottom: '4px', fontWeight: 'bold' }}>No Live Signals Triggered</span>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>F&O stocks will display here as soon as they test support (S3-S6) or resistance (R3-R6) on the 5-minute timeframe.</span>
            </div>
          )}
        </div>
      )}

      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};
