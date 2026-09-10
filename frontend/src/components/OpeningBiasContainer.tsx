import { useState, useEffect } from 'react';
import { Loader2, RefreshCw, AlertTriangle, TrendingUp, TrendingDown, AlignLeft } from 'lucide-react';

interface ZoneStats {
  count: number;
  greenPct: number;
  avgRange: number;
  avgMove: number;
}

interface StraddleSkew {
  ceSymbol: string;
  peSymbol: string;
  ceLtp: number;
  peLtp: number;
  totalStraddle: number;
  skewSpreadPct: number;
  biasState: string;
  actionableAdvice: string;
}

interface SymbolBias {
  symbol: string;
  openPrice: number;
  currentPrice: number;
  zoneKey: string;
  zoneName: string;
  recommendation: string;
  levels: Record<string, number>;
  stats: ZoneStats;
  straddleSkew?: StraddleSkew | null;
}

interface HourlyTimelineSlot {
  timeWindow: string;
  niftySkew: string;
  niftyStraddlePrice: string;
  bankniftySkew: string;
  marketAction: string;
  isActive?: boolean;
  isCompleted?: boolean;
}

interface OpeningBiasData {
  timestamp: string;
  nifty: SymbolBias | null;
  banknifty: SymbolBias | null;
  hourlyTimeline?: HourlyTimelineSlot[];
}

export function OpeningBiasContainer() {
  const [data, setData] = useState<OpeningBiasData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let isMounted = true;
    const backendUrl = window.location.port === '5175' ? 'http://localhost:3002' : window.location.origin;
    
    const fetchBias = () => {
      fetch(`${backendUrl}/api/scanner/opening-bias`)
        .then((res) => {
          if (!res.ok) throw new Error('Failed to fetch opening bias data');
          return res.json();
        })
        .then((data) => {
          if (isMounted) {
            setData(data);
            setLoading(false);
          }
        })
        .catch((err) => {
          if (isMounted) {
            setError(err.message);
            setLoading(false);
          }
        });
    };

    fetchBias();
    const interval = setInterval(fetchBias, 2000); // 2-second ultra-fast live polling
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [refreshKey]);

  if (loading && !data) {
    return (
      <div className="glass-panel" style={{ flex: '1', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px', minHeight: '400px' }}>
        <Loader2 className="animate-spin" size={32} color="var(--accent-blue)" style={{ animation: 'spin 1.5s linear infinite' }} />
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px', margin: 0 }}>Fetching daily levels and calculating opening bias...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="glass-panel" style={{ flex: '1', padding: '24px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px' }}>
        <AlertTriangle size={48} color="#ef4444" />
        <div style={{ textAlign: 'center' }}>
          <h3 style={{ margin: '0 0 8px 0', color: '#ef4444' }}>Failed to Load Opening Bias</h3>
          <p style={{ margin: 0, color: 'var(--text-secondary)' }}>{error || 'No data returned from server'}</p>
        </div>
        <button
          onClick={() => setRefreshKey((k) => k + 1)}
          className="btn-primary"
          style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}
        >
          <RefreshCw size={16} /> Retry
        </button>
      </div>
    );
  }

  const renderBiasCard = (bias: SymbolBias | null) => {
    if (!bias) {
      return (
        <div className="glass-panel" style={{ flex: 1, padding: '24px', textAlign: 'center', color: 'var(--text-secondary)' }}>
          No data available for symbol.
        </div>
      );
    }

    const { openPrice, currentPrice, zoneName, recommendation, levels, stats } = bias;
    const isBullish = stats.greenPct >= 55 || zoneName.includes('Capitulation') || zoneName.includes('Gap Down');
    const isBearish = stats.greenPct <= 45 || zoneName.includes('Exhaustion') || zoneName.includes('Gap Up');
    
    // Choose status colors
    let themeColor = '#eab308'; // yellow/orange
    if (isBullish) themeColor = '#10b981'; // emerald green
    if (isBearish) themeColor = '#ef4444'; // red

    const directionIcon = stats.greenPct >= 50 ? <TrendingUp size={24} color="#10b981" /> : <TrendingDown size={24} color="#ef4444" />;

    return (
      <div className="glass-panel animate-fade-in" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '20px', padding: '24px', borderRadius: '16px', border: '1px solid rgba(255, 255, 255, 0.05)', background: 'rgba(30, 41, 59, 0.4)' }}>
        
        {/* Header Spot Stats */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <span style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: '600', letterSpacing: '0.5px' }}>INDEX SPOT</span>
            <h2 style={{ margin: '4px 0 0 0', fontSize: '26px', fontWeight: '800', color: 'var(--text-primary)' }}>{bias.symbol}</h2>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Today's Open: <strong style={{ color: 'var(--text-primary)' }}>{openPrice.toFixed(2)}</strong></div>
            <div style={{ fontSize: '18px', fontWeight: '700', color: themeColor, marginTop: '4px' }}>
              Spot: {currentPrice.toFixed(2)}
            </div>
          </div>
        </div>

        {/* Zone & Recommendation Banner */}
        <div style={{ padding: '16px', borderRadius: '12px', borderLeft: `4px solid ${themeColor}`, background: 'rgba(255, 255, 255, 0.02)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {directionIcon}
            <span style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-primary)' }}>{zoneName}</span>
          </div>
          <p style={{ margin: 0, fontSize: '13px', lineHeight: '1.5', color: 'var(--text-secondary)' }}>
            <strong>Recommendation:</strong> {recommendation}
          </p>
        </div>

        {/* 2-Year Statistical Metrics */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '16px', borderRadius: '12px', background: 'rgba(255, 255, 255, 0.01)', border: '1px solid rgba(255, 255, 255, 0.03)' }}>
          <h4 style={{ margin: '0 0 4px 0', fontSize: '12px', color: 'var(--text-muted)', letterSpacing: '0.5px', textTransform: 'uppercase' }}>📊 2-Year Historical Stats (Similar Openings)</h4>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Historical Occurrences</div>
              <div style={{ fontSize: '20px', fontWeight: '700', color: 'var(--text-primary)' }}>{stats.count} Days</div>
            </div>
            <div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Green Close Probability</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                <span style={{ fontSize: '20px', fontWeight: '700', color: stats.greenPct >= 50 ? '#10b981' : '#ef4444' }}>{stats.greenPct}%</span>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>({(100 - stats.greenPct).toFixed(1)}% Red Close)</span>
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginTop: '4px' }}>
            <div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Average Daily Range</div>
              <div style={{ fontSize: '18px', fontWeight: '600', color: 'var(--text-secondary)' }}>{stats.avgRange.toFixed(1)} pts</div>
            </div>
            <div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Average Open-to-Close Move</div>
              <div style={{ fontSize: '18px', fontWeight: '600', color: stats.avgMove >= 0 ? '#10b981' : '#ef4444' }}>
                {stats.avgMove >= 0 ? '+' : ''}{stats.avgMove.toFixed(1)} pts
              </div>
            </div>
          </div>
        </div>

        {/* ATM Straddle Skew Asymmetry Block */}
        {bias.straddleSkew && (
          <div style={{ 
            display: 'flex', 
            flexDirection: 'column', 
            gap: '10px', 
            padding: '16px', 
            borderRadius: '12px', 
            background: bias.straddleSkew.skewSpreadPct > 15 
              ? 'rgba(16, 185, 129, 0.04)' 
              : (bias.straddleSkew.skewSpreadPct < -15 ? 'rgba(239, 68, 68, 0.04)' : 'rgba(255, 255, 255, 0.02)'),
            border: `1px solid ${
              bias.straddleSkew.skewSpreadPct > 15 
                ? 'rgba(16, 185, 129, 0.2)' 
                : (bias.straddleSkew.skewSpreadPct < -15 ? 'rgba(239, 68, 68, 0.2)' : 'rgba(255, 255, 255, 0.06)')
            }` 
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '12px', fontWeight: '800', letterSpacing: '0.5px', color: 'white', textTransform: 'uppercase' }}>
                🎯 Live ATM Straddle Skew Math
              </span>
              <span style={{ 
                fontSize: '11px', 
                fontWeight: '800', 
                padding: '2px 8px', 
                borderRadius: '6px',
                background: bias.straddleSkew.skewSpreadPct > 15 ? 'rgba(16, 185, 129, 0.15)' : (bias.straddleSkew.skewSpreadPct < -15 ? 'rgba(239, 68, 68, 0.15)' : 'rgba(255, 255, 255, 0.05)'),
                color: bias.straddleSkew.skewSpreadPct > 15 ? '#10b981' : (bias.straddleSkew.skewSpreadPct < -15 ? '#ef4444' : 'var(--text-secondary)')
              }}>
                {bias.straddleSkew.biasState} ({bias.straddleSkew.skewSpreadPct >= 0 ? '+' : ''}{bias.straddleSkew.skewSpreadPct.toFixed(1)}%)
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', background: 'rgba(0,0,0,0.2)', padding: '10px 12px', borderRadius: '8px' }}>
              <div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>ATM Call ({bias.straddleSkew.ceSymbol})</div>
                <div style={{ fontSize: '15px', fontWeight: '700', color: '#10b981' }}>₹{bias.straddleSkew.ceLtp.toFixed(2)}</div>
              </div>
              <div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>ATM Put ({bias.straddleSkew.peSymbol})</div>
                <div style={{ fontSize: '15px', fontWeight: '700', color: '#ef4444' }}>₹{bias.straddleSkew.peLtp.toFixed(2)}</div>
              </div>
            </div>

            <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
              <strong>Institutional Action:</strong> {bias.straddleSkew.actionableAdvice}
            </p>
          </div>
        )}

        {/* Level Boundaries Map */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <h4 style={{ margin: '0 0 4px 0', fontSize: '12px', color: 'var(--text-muted)', letterSpacing: '0.5px', textTransform: 'uppercase' }}>📏 Daily Level Boundaries</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '180px', overflowY: 'auto', paddingRight: '4px' }}>
            {Object.entries(levels).map(([lvlName, lvlVal]) => {
              const isSupport = lvlName.startsWith('s');
              let labelColor = isSupport ? '#10b981' : '#ef4444';

              return (
                <div key={lvlName} style={{ display: 'flex', justifyItems: 'center', justifyContent: 'space-between', padding: '6px 10px', borderRadius: '6px', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.02)' }}>
                  <span style={{ fontSize: '12px', fontWeight: '600', color: labelColor }}>
                    {lvlName.toUpperCase()}
                  </span>
                  <span style={{ fontSize: '12px', fontFamily: 'monospace', color: 'var(--text-secondary)' }}>
                    ₹{lvlVal.toFixed(2)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

      </div>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', padding: '24px', boxSizing: 'border-box', overflowY: 'auto', flex: 1 }}>
      
      {/* Top Banner */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '700', color: 'var(--text-primary)' }}>⚡ Live Opening Bias & Auction Analyst</h2>
          <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: 'var(--text-secondary)' }}>
            Automatically detects morning opening zones to deliver statistical probabilities based on 2 years of Nifty & Bank Nifty data.
          </p>
        </div>
        <button
          onClick={() => setRefreshKey((k) => k + 1)}
          className="glass-button"
          style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', borderRadius: '8px' }}
        >
          <RefreshCw size={14} /> Refresh Analyst
        </button>
      </div>

      {/* Main Grid Layout */}
      <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
        {renderBiasCard(data?.nifty || null)}
        {renderBiasCard(data?.banknifty || null)}
      </div>

    </div>
  );
}
