import React, { useState, useEffect } from 'react';
import { RefreshCw, Clock, Zap, TrendingUp, TrendingDown } from 'lucide-react';

interface EarlyPick {
  symbol: string;
  currentPrice: number;
  dailyLevelName: string;
  monthlyLevelName: string;
  confluencePrice: number;
  touchTime: string;
  pickType: string;
  bouncePct: number;
  rejectPct: number;
  volRatio: number;
  score: number;
  optionSymbol?: string;
  optionLtp?: number;
  isFno?: boolean;
}

interface EarlyPicksContainerProps {
  onSymbolSelect: (symbol: string) => void;
  onSwitchToChart: () => void;
}

export const EarlyPicksContainer: React.FC<EarlyPicksContainerProps> = ({
  onSymbolSelect,
  onSwitchToChart
}) => {
  const [picks, setPicks] = useState<EarlyPick[]>([]);
  const [threshold, setThreshold] = useState<number>(0.5); // Default 0.5%
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshKey, setRefreshKey] = useState<number>(0);

  useEffect(() => {
    let isMounted = true;
    
    const fetchEarlyPicks = async () => {
      try {
        const backendUrl = window.location.port === '5175' ? 'http://localhost:3002' : window.location.origin;
        const res = await fetch(`${backendUrl}/api/scanner/early-picks?threshold=${threshold}`);
        if (res.ok) {
          const data = await res.json();
          if (isMounted) {
            setPicks(data.picks || []);
            setLoading(false);
          }
        }
      } catch (err) {
        console.error('Failed to fetch early picks:', err);
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchEarlyPicks();
    const interval = setInterval(fetchEarlyPicks, 15000); // Poll every 15 seconds

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [refreshKey, threshold]);

  const handleManualRefresh = () => {
    setLoading(true);
    setRefreshKey(prev => prev + 1);
  };

  const handleSymbolClick = (symbol: string) => {
    onSymbolSelect(symbol);
    onSwitchToChart();
  };

  const gainers = picks.filter(p => p.pickType === 'Bullish Rebound');
  const losers = picks.filter(p => p.pickType === 'Bearish Rejection');

  return (
    <div className="glass-panel animate-fade-in" style={{ padding: '24px', flex: 1, display: 'flex', flexDirection: 'column', minHeight: '600px' }}>
      
      {/* Header */}
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255, 255, 255, 0.06)', paddingBottom: '16px', marginBottom: '20px', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Zap size={20} color="#eab308" />
            <span style={{ fontSize: '18px', fontWeight: '800', color: 'white', letterSpacing: '-0.3px' }}>
              ⚡ Early Gainer / Loser Picks
            </span>
          </div>
          <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>
            Identifies trending stocks early by scanning for morning touches of Daily-to-Monthly confluences accompanied by volume confirmation.
          </p>
        </div>

        {/* Controls */}
        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          {/* Threshold Selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '4px 12px' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 'bold', textTransform: 'uppercase' }}>Confluence Limit:</span>
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
              <option value="0.3" style={{ background: 'var(--bg-card)', color: 'white' }}>0.30% Max</option>
              <option value="0.5" style={{ background: 'var(--bg-card)', color: 'white' }}>0.50% Max</option>
              <option value="0.8" style={{ background: 'var(--bg-card)', color: 'white' }}>0.80% Max</option>
              <option value="1.0" style={{ background: 'var(--bg-card)', color: 'white' }}>1.00% Max</option>
            </select>
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
          <div style={{ width: '40px', height: '40px', borderRadius: '50%', border: '3px solid rgba(255,255,255,0.05)', borderTopColor: '#eab308', animation: 'spin 1s linear infinite', marginBottom: '16px' }} />
          <span style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Identifying early gainer and loser candidates...</span>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))', gap: '24px', flex: 1 }}>
          
          {/* Column 1: Gainers */}
          <div style={{ background: 'rgba(16, 185, 129, 0.02)', border: '1px solid rgba(16, 185, 129, 0.1)', borderRadius: '12px', padding: '16px', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', borderBottom: '1px solid rgba(16, 185, 129, 0.1)', paddingBottom: '10px' }}>
              <TrendingUp size={18} color="#10b981" />
              <span style={{ fontSize: '15px', fontWeight: '800', color: '#10b981' }}>Bullish Rebound Picks (Early Gainer Candidates)</span>
            </div>
            
            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {gainers.length > 0 ? (
                gainers.map((p, idx) => {
                  const cleanSymbol = p.symbol.split(':')[1];
                  return (
                    <div 
                      key={`${p.symbol}-g-${idx}`}
                      onClick={() => handleSymbolClick(p.symbol)}
                      style={{
                        background: 'rgba(255,255,255,0.02)',
                        border: '1px solid rgba(255,255,255,0.04)',
                        borderRadius: '10px',
                        padding: '12px 16px',
                        cursor: 'pointer',
                        transition: 'all 0.15s',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '6px'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = 'rgba(16, 185, 129, 0.3)';
                        e.currentTarget.style.backgroundColor = 'rgba(16, 185, 129, 0.02)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.04)';
                        e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.02)';
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '15px', fontWeight: 'bold', color: 'white' }}>{cleanSymbol}</span>
                        <span style={{ fontSize: '11px', color: '#10b981', fontWeight: '800', background: 'rgba(16, 185, 129, 0.1)', padding: '2px 8px', borderRadius: '6px' }}>
                          Score: {p.score.toFixed(1)}
                        </span>
                      </div>
                      
                      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                        <span>Zone: {p.dailyLevelName} / {p.monthlyLevelName}</span>
                        <span>Touch Time: <strong>{p.touchTime}</strong></span>
                      </div>

                      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', fontSize: '12px', color: 'var(--text-secondary)', borderTop: '1px solid rgba(255,255,255,0.03)', paddingTop: '6px', marginTop: '2px' }}>
                        <span>Close: ₹{p.currentPrice.toFixed(2)} (vs Confluence ₹{p.confluencePrice.toFixed(2)})</span>
                        <span style={{ color: '#10b981', fontWeight: 'bold' }}>Bounce: +{p.bouncePct.toFixed(2)}%</span>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', color: 'var(--text-muted)' }}>
                        <span>Vol Ratio: <strong>{p.volRatio.toFixed(1)}x</strong></span>
                        {p.optionSymbol ? (
                          <span style={{ color: '#10b981', background: 'rgba(16, 185, 129, 0.1)', padding: '2px 8px', borderRadius: '4px', fontWeight: 'bold' }}>
                            ATM CE: {p.optionSymbol.replace('NSE:', '')} {p.optionLtp !== undefined ? `(₹${p.optionLtp.toFixed(2)})` : ''}
                          </span>
                        ) : p.isFno === false ? (
                          <span style={{ color: '#6b7280', fontSize: '10px' }}>Non-F&O Stock</span>
                        ) : null}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', height: '150px', color: 'var(--text-muted)', fontSize: '13px' }}>
                  No bullish rebounds scanned yet today.
                </div>
              )}
            </div>
          </div>

          {/* Column 2: Losers */}
          <div style={{ background: 'rgba(239, 68, 68, 0.02)', border: '1px solid rgba(239, 68, 68, 0.1)', borderRadius: '12px', padding: '16px', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', borderBottom: '1px solid rgba(239, 68, 68, 0.1)', paddingBottom: '10px' }}>
              <TrendingDown size={18} color="#ef4444" />
              <span style={{ fontSize: '15px', fontWeight: '800', color: '#ef4444' }}>Bearish Rejection Picks (Early Loser Candidates)</span>
            </div>
            
            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {losers.length > 0 ? (
                losers.map((p, idx) => {
                  const cleanSymbol = p.symbol.split(':')[1];
                  return (
                    <div 
                      key={`${p.symbol}-l-${idx}`}
                      onClick={() => handleSymbolClick(p.symbol)}
                      style={{
                        background: 'rgba(255,255,255,0.02)',
                        border: '1px solid rgba(255,255,255,0.04)',
                        borderRadius: '10px',
                        padding: '12px 16px',
                        cursor: 'pointer',
                        transition: 'all 0.15s',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '6px'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.3)';
                        e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.02)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.04)';
                        e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.02)';
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '15px', fontWeight: 'bold', color: 'white' }}>{cleanSymbol}</span>
                        <span style={{ fontSize: '11px', color: '#ef4444', fontWeight: '800', background: 'rgba(239, 68, 68, 0.1)', padding: '2px 8px', borderRadius: '6px' }}>
                          Score: {p.score.toFixed(1)}
                        </span>
                      </div>
                      
                      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                        <span>Zone: {p.dailyLevelName} / {p.monthlyLevelName}</span>
                        <span>Touch Time: <strong>{p.touchTime}</strong></span>
                      </div>

                      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', fontSize: '12px', color: 'var(--text-secondary)', borderTop: '1px solid rgba(255,255,255,0.03)', paddingTop: '6px', marginTop: '2px' }}>
                        <span>Close: ₹{p.currentPrice.toFixed(2)} (vs Confluence ₹{p.confluencePrice.toFixed(2)})</span>
                        <span style={{ color: '#ef4444', fontWeight: 'bold' }}>Rejection: -{p.rejectPct.toFixed(2)}%</span>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', color: 'var(--text-muted)' }}>
                        <span>Vol Ratio: <strong>{p.volRatio.toFixed(1)}x</strong></span>
                        {p.optionSymbol ? (
                          <span style={{ color: '#ef4444', background: 'rgba(239, 68, 68, 0.1)', padding: '2px 8px', borderRadius: '4px', fontWeight: 'bold' }}>
                            ATM PE: {p.optionSymbol.replace('NSE:', '')} {p.optionLtp !== undefined ? `(₹${p.optionLtp.toFixed(2)})` : ''}
                          </span>
                        ) : p.isFno === false ? (
                          <span style={{ color: '#6b7280', fontSize: '10px' }}>Non-F&O Stock</span>
                        ) : null}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', height: '150px', color: 'var(--text-muted)', fontSize: '13px' }}>
                  No bearish rejections scanned yet today.
                </div>
              )}
            </div>
          </div>

        </div>
      )}
    </div>
  );
};
