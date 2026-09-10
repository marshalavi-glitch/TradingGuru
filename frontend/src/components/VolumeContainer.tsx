import React, { useState, useEffect, useMemo } from 'react';
import { Loader2, AlertCircle, TrendingUp, TrendingDown, Clock, Search, Sparkles } from 'lucide-react';

interface VolumeBreakout {
  symbol: string;
  time: string;
  currentVolume: number;
  prevMaxVolume: number;
  ratio: number;
  close: number;
  direction: 'UP' | 'DOWN';
  type: 'index' | 'stock' | 'option' | 'futures';
  optionType?: 'CE' | 'PE';
  strike?: number;
}

interface VolumeCache {
  lastScanTime: string | null;
  isScanning: boolean;
  results: VolumeBreakout[];
}

interface VolumeContainerProps {
  onSymbolSelect: (symbol: string) => void;
  onSwitchToChart: () => void;
}

export const VolumeContainer: React.FC<VolumeContainerProps> = ({
  onSymbolSelect,
  onSwitchToChart
}) => {
  const [data, setData] = useState<VolumeCache>({
    lastScanTime: null,
    isScanning: false,
    results: []
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Filters
  const [filterType, setFilterType] = useState<'all' | 'index' | 'stock' | 'option' | 'futures'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    let isMounted = true;

    const fetchVolumeBreakouts = async () => {
      try {
        const backendUrl = window.location.port === '5175' ? 'http://localhost:3002' : window.location.origin;
        const res = await fetch(`${backendUrl}/api/volume-breakouts`);
        if (res.ok) {
          const payload = await res.json();
          if (isMounted) {
            setData(payload);
            setLoading(false);
            setError(null);
          }
        }
      } catch (err) {
        console.error('Failed to fetch volume breakouts:', err);
        if (isMounted && !data.lastScanTime) {
          setError('Could not fetch volume breakout signals.');
          setLoading(false);
        }
      }
    };

    fetchVolumeBreakouts();
    // Poll every 15 seconds
    const interval = setInterval(fetchVolumeBreakouts, 15000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  const handleSymbolClick = (symbolName: string) => {
    // Re-prepend exchange prefix if missing
    let fullSym = symbolName;
    if (!symbolName.startsWith('NSE:')) {
      fullSym = `NSE:${symbolName}`;
    }
    onSymbolSelect(fullSym);
    onSwitchToChart();
  };

  const filteredResults = useMemo(() => {
    return data.results.filter(item => {
      // Type match
      if (filterType !== 'all' && item.type !== filterType) return false;
      
      // Search query match
      if (searchQuery.trim() !== '') {
        const query = searchQuery.toUpperCase();
        const matchesSymbol = item.symbol.toUpperCase().includes(query);
        const matchesStrike = item.strike ? item.strike.toString().includes(query) : false;
        return matchesSymbol || matchesStrike;
      }

      return true;
    });
  }, [data.results, filterType, searchQuery]);

  const formatNumber = (num: number) => {
    if (num >= 10000000) return `${(num / 10000000).toFixed(2)} Cr`;
    if (num >= 100000) return `${(num / 100000).toFixed(2)} L`;
    return num.toLocaleString('en-IN');
  };

  const formatTime = (isoString: string | null) => {
    if (!isoString) return '--:--:--';
    const date = new Date(isoString);
    return date.toLocaleTimeString('en-IN', { hour12: false });
  };

  if (loading && !data.lastScanTime) {
    return (
      <div className="glass-panel" style={{ flex: '1', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px', minHeight: '300px' }}>
        <Loader2 className="animate-spin" size={28} color="var(--accent-blue)" style={{ animation: 'spin 1.5s linear infinite' }} />
        <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>Scanning historical and current intraday volume climax patterns...</p>
      </div>
    );
  }

  return (
    <div className="glass-panel animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '16px', borderRadius: '12px', flex: '1', minHeight: '0', position: 'relative' }}>
      
      {/* Header Info */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '12px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Sparkles size={18} color="#eab308" />
            Intraday Volume Breakouts (5m)
          </h3>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
            Shows symbols where today's latest candle volume exceeds the highest single-candle volume recorded earlier today
          </span>
        </div>
        
        {data.lastScanTime && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--text-muted)' }}>
            <Clock size={12} />
            <span>Last Scan: <strong>{formatTime(data.lastScanTime)}</strong></span>
            {data.isScanning && (
              <Loader2 className="animate-spin" size={10} color="var(--accent-blue)" style={{ animation: 'spin 1s linear infinite' }} />
            )}
          </div>
        )}
      </div>

      {error && (
        <div style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '12px', border: '1px solid rgba(239, 68, 68, 0.3)', backgroundColor: 'rgba(239, 68, 68, 0.05)', borderRadius: '8px' }}>
          <AlertCircle color="#ef4444" size={18} />
          <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{error}</span>
        </div>
      )}

      {/* Controls: Type Tabs & Search */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        
        {/* Tabs */}
        <div style={{ display: 'flex', backgroundColor: 'rgba(255, 255, 255, 0.03)', borderRadius: '8px', padding: '2px', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
          {(['all', 'index', 'stock', 'option', 'futures'] as const).map((type) => (
            <button
              key={type}
              onClick={() => setFilterType(type)}
              style={{
                padding: '5px 12px',
                borderRadius: '6px',
                border: 'none',
                background: filterType === type ? 'rgba(59, 130, 246, 0.15)' : 'transparent',
                color: filterType === type ? '#60a5fa' : 'var(--text-secondary)',
                fontSize: '12px',
                fontWeight: '600',
                cursor: 'pointer',
                textTransform: 'capitalize',
                transition: 'all 0.15s ease'
              }}
            >
              {type === 'all' ? 'Show All' : `${type}s`}
            </button>
          ))}
        </div>

        {/* Search */}
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
          <Search size={13} color="var(--text-muted)" style={{ position: 'absolute', left: '10px' }} />
          <input
            type="text"
            placeholder="Filter symbols..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              padding: '6px 12px 6px 30px',
              borderRadius: '16px',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              background: 'rgba(255, 255, 255, 0.02)',
              color: 'var(--text-primary)',
              fontSize: '12px',
              outline: 'none',
              width: '180px',
              transition: 'all 0.15s'
            }}
            onFocus={(e) => (e.currentTarget.style.borderColor = '#3b82f6')}
            onBlur={(e) => (e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)')}
          />
        </div>

      </div>

      {/* Breakouts Table */}
      <div style={{ flex: '1', overflowY: 'auto', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '8px', background: 'rgba(0,0,0,0.1)' }}>
        {filteredResults.length === 0 ? (
          <div style={{ padding: '24px', color: 'var(--text-muted)', fontSize: '13px', textAlign: 'center' }}>
            No volume breakouts detected today matching the criteria.
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid rgba(255,255,255,0.08)', color: 'var(--text-secondary)' }}>
                <th style={{ padding: '10px 16px', fontWeight: '600' }}>Symbol</th>
                <th style={{ padding: '10px 16px', fontWeight: '600' }}>Type</th>
                <th style={{ padding: '10px 16px', fontWeight: '600' }}>Time</th>
                <th style={{ padding: '10px 16px', fontWeight: '600' }}>LTP</th>
                <th style={{ padding: '10px 16px', fontWeight: '600', textAlign: 'right' }}>Breakout Vol</th>
                <th style={{ padding: '10px 16px', fontWeight: '600', textAlign: 'right' }}>Prev Max Vol</th>
                <th style={{ padding: '10px 16px', fontWeight: '600', textAlign: 'center' }}>Vol Ratio</th>
              </tr>
            </thead>
            <tbody>
              {filteredResults.map((item, idx) => {
                const isGreen = item.direction === 'UP';
                const isHighRatio = item.ratio >= 2.0;

                return (
                  <tr
                    key={`${item.symbol}-${item.time}-${idx}`}
                    style={{
                      borderBottom: '1px solid rgba(255,255,255,0.04)',
                      background: 'transparent',
                      transition: 'background 0.15s'
                    }}
                  >
                    {/* Symbol */}
                    <td
                      onClick={() => handleSymbolClick(item.symbol)}
                      style={{
                        padding: '12px 16px',
                        fontWeight: '700',
                        color: 'white',
                        cursor: 'pointer'
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = '#3b82f6')}
                      onMouseLeave={(e) => (e.currentTarget.style.color = 'white')}
                    >
                      {item.symbol}
                      {item.optionType && (
                        <span style={{
                          fontSize: '10px',
                          marginLeft: '6px',
                          padding: '1px 4px',
                          borderRadius: '3px',
                          background: item.optionType === 'CE' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                          color: item.optionType === 'CE' ? '#10b981' : '#ef4444',
                          fontWeight: 'bold'
                        }}>
                          {item.optionType} {item.strike}
                        </span>
                      )}
                    </td>

                    {/* Type Badge */}
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{
                        fontSize: '10px',
                        fontWeight: '600',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        textTransform: 'uppercase',
                        background: item.type === 'index' ? 'rgba(167, 139, 250, 0.15)' : item.type === 'option' ? 'rgba(251, 146, 60, 0.15)' : item.type === 'futures' ? 'rgba(236, 72, 153, 0.15)' : 'rgba(59, 130, 246, 0.15)',
                        color: item.type === 'index' ? '#c084fc' : item.type === 'option' ? '#fb923c' : item.type === 'futures' ? '#f472b6' : '#60a5fa'
                      }}>
                        {item.type}
                      </span>
                    </td>

                    {/* Time */}
                    <td style={{ padding: '12px 16px', color: 'var(--text-secondary)' }}>
                      {item.time}
                    </td>

                    {/* LTP / Price direction */}
                    <td style={{ padding: '12px 16px', fontWeight: '600', color: isGreen ? '#10b981' : '#ef4444' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        {isGreen ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                        ₹{item.close.toFixed(2)}
                      </div>
                    </td>

                    {/* Current Volume */}
                    <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 'bold', color: 'white' }}>
                      {formatNumber(item.currentVolume)}
                    </td>

                    {/* Prev Max Volume */}
                    <td style={{ padding: '12px 16px', textAlign: 'right', color: 'var(--text-muted)' }}>
                      {formatNumber(item.prevMaxVolume)}
                    </td>

                    {/* Ratio Badge */}
                    <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                      <span style={{
                        fontSize: '12px',
                        fontWeight: '700',
                        padding: '3px 8px',
                        borderRadius: '12px',
                        background: isHighRatio ? 'rgba(234, 179, 8, 0.18)' : 'rgba(255, 255, 255, 0.05)',
                        color: isHighRatio ? '#facc15' : 'var(--text-secondary)',
                        border: isHighRatio ? '1px solid rgba(234, 179, 8, 0.25)' : 'none',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '3px'
                      }}>
                        {isHighRatio && '🔥'}
                        {item.ratio}x
                      </span>
                    </td>

                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

    </div>
  );
};
