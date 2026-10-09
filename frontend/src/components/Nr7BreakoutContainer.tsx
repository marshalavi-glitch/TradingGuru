import React, { useState, useEffect, useMemo } from 'react';
import { 
  Sparkles, 
  Search, 
  Clock, 
  RefreshCw, 
  TrendingUp, 
  CheckCircle2, 
  Layers, 
  ChevronRight, 
  Eye, 
  SlidersHorizontal,
  Zap,
  Target,
  ShieldAlert,
  ArrowUpRight,
  Info,
  X
} from 'lucide-react';
import { getBackendHttpUrl } from '../utils/tvStreamer';

interface Nr7Result {
  symbol: string;
  displayName: string;
  companyName?: string;
  segment: 'cash' | 'futures';
  close: number;
  open: number;
  high: number;
  low: number;
  prevHigh: number;
  prevLow: number;
  prevOpen: number;
  todayRange: number;
  priorMaxRange7: number;
  expansionRatio: number;
  changePts: number;
  changePct: number;
  volume: number;
  sma20: number;
  sma40: number;
  sma60: number;
  weekOpen: number;
  monthOpen: number;
  targetPrice: number;
  targetExpansion: number;
  stopLoss: number;
  lotSize: number;
  time: string;
  rulesPassed: number;
}

interface Nr7Cache {
  lastScanTime: string | null;
  isScanning: boolean;
  results: Nr7Result[];
  summary?: {
    totalMonitored: number;
    totalCash: number;
    totalFutures: number;
    matchedCash: number;
    matchedFutures: number;
  };
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
    results: [],
    summary: {
      totalMonitored: 0,
      totalCash: 0,
      totalFutures: 0,
      matchedCash: 0,
      matchedFutures: 0
    }
  });
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [segmentFilter, setSegmentFilter] = useState<'all' | 'cash' | 'futures'>('all');
  const [refreshKey, setRefreshKey] = useState(0);
  const [selectedStock, setSelectedStock] = useState<Nr7Result | null>(null);

  useEffect(() => {
    let isMounted = true;

    const fetchResults = async () => {
      try {
        const backendUrl = await getBackendHttpUrl();
        const scanParam = refreshKey > 0 ? '?scan=true' : '';
        const res = await fetch(`${backendUrl}/api/nr7-breakouts${scanParam}`);
        if (res.ok) {
          const payload = await res.json();
          if (isMounted) {
            setData(payload);
            setLoading(false);
          }
        }
      } catch (err) {
        console.error('Failed to fetch 20% upper circuit breakouts:', err);
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
    setLoading(true);
    setRefreshKey(prev => prev + 1);
  };

  const handleSymbolClick = (item: Nr7Result) => {
    let fullSym = item.symbol;
    if (!item.symbol.includes(':')) {
      fullSym = `NSE:${item.symbol}`;
    }
    onSymbolSelect(fullSym);
    onSwitchToChart();
  };

  const formatTime = (isoString: string | null) => {
    if (!isoString) return 'Never';
    const date = new Date(isoString);
    return date.toLocaleTimeString('en-IN', { hour12: false });
  };

  const formatVolume = (vol: number) => {
    if (vol >= 10000000) return `${(vol / 10000000).toFixed(2)} Cr`;
    if (vol >= 100000) return `${(vol / 100000).toFixed(2)} L`;
    if (vol >= 1000) return `${(vol / 1000).toFixed(1)} K`;
    return vol.toLocaleString();
  };

  // Filter results by search and segment
  const filteredResults = useMemo(() => {
    return (data.results || []).filter(item => {
      // Segment filter
      if (segmentFilter === 'cash' && item.segment !== 'cash') return false;
      if (segmentFilter === 'futures' && item.segment !== 'futures') return false;

      // Search query
      if (searchQuery.trim() !== '') {
        const q = searchQuery.toUpperCase();
        return (
          item.symbol.toUpperCase().includes(q) ||
          (item.displayName && item.displayName.toUpperCase().includes(q))
        );
      }
      return true;
    });
  }, [data.results, segmentFilter, searchQuery]);

  const cashCount = useMemo(() => (data.results || []).filter(r => r.segment === 'cash').length, [data.results]);
  const futuresCount = useMemo(() => (data.results || []).filter(r => r.segment === 'futures').length, [data.results]);

  return (
    <div className="glass-panel animate-fade-in" style={{ padding: '24px', flex: 1, display: 'flex', flexDirection: 'column', minHeight: '650px' }}>
      
      {/* Header Bar matching Chartink 14-Rule Scanner */}
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '16px', marginBottom: '20px', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '22px', fontWeight: '800', color: 'white', letterSpacing: '-0.3px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Sparkles size={24} color="#f59e0b" />
              20% Upper Circuit Potential (Cash & Futures)
            </span>
          </div>
          <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>
            Multi-timeframe expansion scanner: Range &gt; 7-Day Prior Ranges, Daily/Weekly/Monthly Green, SMA 20 &gt; 40 &gt; 60.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
          {/* Search Input */}
          <div style={{ display: 'flex', alignItems: 'center', background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '6px 12px', gap: '8px', width: '220px' }}>
            <Search size={14} color="var(--text-muted)" />
            <input
              type="text"
              placeholder="Search Cash or Futures..."
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
              background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.2), rgba(245, 158, 11, 0.05))',
              color: '#f59e0b',
              border: '1px solid rgba(245, 158, 11, 0.4)',
              borderRadius: '8px',
              padding: '7px 16px',
              fontSize: '12px',
              fontWeight: '700',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              opacity: data.isScanning ? 0.6 : 1
            }}
          >
            <RefreshCw size={13} className={data.isScanning ? 'animate-spin' : ''} />
            {data.isScanning ? 'Scanning...' : 'Rescan Market'}
          </button>
        </div>
      </div>

      {/* Top Metrics Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px', marginBottom: '20px' }}>
        <div style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.06)', borderRadius: '10px', padding: '14px 18px' }}>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total 20% UC Setups</span>
          <div style={{ fontSize: '24px', fontWeight: '800', color: '#f59e0b', marginTop: '4px' }}>
            {data.results?.length || 0}
          </div>
          <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Passed all 14 Chartink conditions</span>
        </div>

        <div style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.06)', borderRadius: '10px', padding: '14px 18px' }}>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>💵 Cash Breakouts</span>
          <div style={{ fontSize: '24px', fontWeight: '800', color: '#10b981', marginTop: '4px' }}>
            {cashCount}
          </div>
          <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>High beta & momentum stocks</span>
        </div>

        <div style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.06)', borderRadius: '10px', padding: '14px 18px' }}>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>⚡ Futures Breakouts</span>
          <div style={{ fontSize: '24px', fontWeight: '800', color: '#00f0ff', marginTop: '4px' }}>
            {futuresCount}
          </div>
          <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>F&O stock & index futures</span>
        </div>

        <div style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.06)', borderRadius: '10px', padding: '14px 18px' }}>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Top Range Expansion</span>
          <div style={{ fontSize: '24px', fontWeight: '800', color: '#ec4899', marginTop: '4px' }}>
            {data.results && data.results.length > 0 ? `${data.results[0].expansionRatio}x` : '0x'}
          </div>
          <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
            {data.results && data.results.length > 0 ? data.results[0].displayName : 'Awaiting trigger'}
          </span>
        </div>
      </div>

      {/* Segment Filter Tabs */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
        <button
          onClick={() => setSegmentFilter('all')}
          style={{
            background: segmentFilter === 'all' ? '#f59e0b' : 'rgba(255, 255, 255, 0.05)',
            color: segmentFilter === 'all' ? '#000' : 'var(--text-secondary)',
            fontWeight: '700',
            fontSize: '12px',
            padding: '6px 14px',
            borderRadius: '8px',
            border: 'none',
            cursor: 'pointer'
          }}
        >
          ALL ({data.results?.length || 0})
        </button>

        <button
          onClick={() => setSegmentFilter('cash')}
          style={{
            background: segmentFilter === 'cash' ? '#10b981' : 'rgba(255, 255, 255, 0.05)',
            color: segmentFilter === 'cash' ? '#000' : 'var(--text-secondary)',
            fontWeight: '700',
            fontSize: '12px',
            padding: '6px 14px',
            borderRadius: '8px',
            border: 'none',
            cursor: 'pointer'
          }}
        >
          💵 CASH ({cashCount})
        </button>

        <button
          onClick={() => setSegmentFilter('futures')}
          style={{
            background: segmentFilter === 'futures' ? '#00f0ff' : 'rgba(255, 255, 255, 0.05)',
            color: segmentFilter === 'futures' ? '#000' : 'var(--text-secondary)',
            fontWeight: '700',
            fontSize: '12px',
            padding: '6px 14px',
            borderRadius: '8px',
            border: 'none',
            cursor: 'pointer'
          }}
        >
          ⚡ FUTURES ({futuresCount})
        </button>
      </div>

      {/* Main Table */}
      {loading ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 0' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '50%', border: '3px solid rgba(255,255,255,0.05)', borderTopColor: '#f59e0b', animation: 'spin 1s linear infinite', marginBottom: '16px' }} />
          <span style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Scanning Cash and Futures for 20% Upper Circuit expansion candidates...</span>
        </div>
      ) : filteredResults.length === 0 ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 0', border: '1px dashed rgba(255,255,255,0.08)', borderRadius: '12px', backgroundColor: 'rgba(255,255,255,0.01)' }}>
          <TrendingUp size={36} color="var(--text-muted)" style={{ marginBottom: '12px', opacity: 0.5 }} />
          <span style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-primary)' }}>No Matching 20% Upper Circuit Setups in Selected View</span>
          <span style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
            Requires Daily Range &gt; 7 prior days, Close &gt; Open &amp; Prev Open, Weekly Green, Monthly Green, SMA 20 &gt; 40 &gt; 60.
          </span>
        </div>
      ) : (
        <div className="table-responsive-wrapper" style={{ flex: 1, border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '12px', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '950px' }}>
            <thead>
              <tr style={{ background: 'rgba(255, 255, 255, 0.03)', borderBottom: '1px solid rgba(255, 255, 255, 0.08)' }}>
                <th style={{ padding: '12px 16px', fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700', textTransform: 'uppercase' }}>Symbol & Name</th>
                <th style={{ padding: '12px 16px', fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700', textTransform: 'uppercase' }}>Segment</th>
                <th style={{ padding: '12px 16px', fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700', textTransform: 'uppercase' }}>LTP & Day Change</th>
                <th style={{ padding: '12px 16px', fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700', textTransform: 'uppercase' }}>Range vs 7-Day Max</th>
                <th style={{ padding: '12px 16px', fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700', textTransform: 'uppercase' }}>Trend Alignment</th>
                <th style={{ padding: '12px 16px', fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700', textTransform: 'uppercase' }}>20% UC Target / SL</th>
                <th style={{ padding: '12px 16px', fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700', textTransform: 'uppercase' }}>Volume</th>
                <th style={{ padding: '12px 16px', fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700', textTransform: 'uppercase', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredResults.map((item) => {
                const isPositive = item.changePct >= 0;
                return (
                  <tr 
                    key={item.symbol} 
                    style={{ 
                      borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
                      transition: 'background-color 0.15s'
                    }}
                    className="table-row-hover"
                  >
                    {/* Symbol */}
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontWeight: '800', fontSize: '14px', color: 'white' }}>
                          {item.displayName}
                        </span>
                        {item.segment === 'futures' && (
                          <span style={{ fontSize: '10px', background: 'rgba(0, 240, 255, 0.15)', color: '#00f0ff', padding: '2px 6px', borderRadius: '4px', fontWeight: '800' }}>
                            LOT: {item.lotSize}
                          </span>
                        )}
                      </div>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{item.companyName ? `${item.companyName} (${item.symbol})` : item.symbol}</span>
                    </td>

                    {/* Segment */}
                    <td style={{ padding: '14px 16px' }}>
                      {item.segment === 'futures' ? (
                        <span style={{ background: 'rgba(0, 240, 255, 0.12)', color: '#00f0ff', border: '1px solid rgba(0, 240, 255, 0.3)', padding: '3px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: '700', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <Zap size={11} /> FUTURES
                        </span>
                      ) : (
                        <span style={{ background: 'rgba(16, 185, 129, 0.12)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.3)', padding: '3px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: '700', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          💵 CASH
                        </span>
                      )}
                    </td>

                    {/* LTP & Change */}
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ fontWeight: '800', fontSize: '14px', color: 'white' }}>
                        ₹{item.close.toLocaleString('en-IN')}
                      </div>
                      <div style={{ fontSize: '12px', fontWeight: '700', color: isPositive ? '#10b981' : '#ef4444', display: 'flex', alignItems: 'center', gap: '3px' }}>
                        {isPositive ? '+' : ''}{item.changePts} ({isPositive ? '+' : ''}{item.changePct.toFixed(2)}%)
                      </div>
                    </td>

                    {/* Range vs 7-Day Max */}
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontSize: '13px', fontWeight: '800', color: '#f59e0b' }}>
                          {item.todayRange} pts
                        </span>
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                          vs {item.priorMaxRange7} pts
                        </span>
                      </div>
                      <div style={{ fontSize: '11px', color: '#10b981', fontWeight: '700' }}>
                        🔥 {item.expansionRatio}x Volatility Expansion
                      </div>
                    </td>

                    {/* Trend Alignment */}
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '10px', background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', padding: '2px 6px', borderRadius: '4px', fontWeight: '700' }}>
                          SMA 20&gt;40&gt;60
                        </span>
                        <span style={{ fontSize: '10px', background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', padding: '2px 6px', borderRadius: '4px', fontWeight: '700' }}>
                          W-Green
                        </span>
                        <span style={{ fontSize: '10px', background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', padding: '2px 6px', borderRadius: '4px', fontWeight: '700' }}>
                          M-Green
                        </span>
                      </div>
                      <span style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '3px', display: 'block' }}>
                        SMA20: ₹{item.sma20} | SMA40: ₹{item.sma40}
                      </span>
                    </td>

                    {/* Target & SL */}
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ fontSize: '13px', fontWeight: '800', color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Target size={12} /> 20% UC: ₹{item.targetPrice.toLocaleString('en-IN')}
                      </div>
                      <div style={{ fontSize: '11px', color: '#ef4444', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                        <ShieldAlert size={11} /> SL: ₹{item.stopLoss.toLocaleString('en-IN')}
                      </div>
                    </td>

                    {/* Volume */}
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ fontSize: '13px', fontWeight: '700', color: 'white' }}>
                        {formatVolume(item.volume)}
                      </div>
                      <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Shares</span>
                    </td>

                    {/* Actions */}
                    <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px' }}>
                        <button
                          onClick={() => setSelectedStock(item)}
                          style={{
                            background: 'rgba(245, 158, 11, 0.15)',
                            color: '#f59e0b',
                            border: '1px solid rgba(245, 158, 11, 0.3)',
                            padding: '6px 10px',
                            borderRadius: '6px',
                            fontSize: '11px',
                            fontWeight: '700',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                          title="View 14-Rule Chartink Checklist"
                        >
                          <Info size={12} /> Checklist
                        </button>

                        <button
                          onClick={() => handleSymbolClick(item)}
                          style={{
                            background: 'rgba(59, 130, 246, 0.15)',
                            color: '#3b82f6',
                            border: '1px solid rgba(59, 130, 246, 0.3)',
                            padding: '6px 10px',
                            borderRadius: '6px',
                            fontSize: '11px',
                            fontWeight: '700',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                        >
                          <TrendingUp size={12} /> Chart
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* 14-Condition Chartink Checklist Modal */}
      {selectedStock && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0, 0, 0, 0.8)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ backgroundColor: '#0d1117', border: '1px solid rgba(245, 158, 11, 0.4)', borderRadius: '14px', width: '100%', maxWidth: '640px', maxHeight: '90vh', overflowY: 'auto', padding: '24px', boxShadow: '0 20px 40px rgba(0,0,0,0.6)' }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '14px', marginBottom: '16px' }}>
              <div>
                <span style={{ fontSize: '18px', fontWeight: '800', color: 'white' }}>
                  {selectedStock.displayName} — 14-Rule Chartink Audit
                </span>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block', marginTop: '2px' }}>
                  {selectedStock.symbol} ({selectedStock.segment.toUpperCase()}) | LTP: ₹{selectedStock.close} (+{selectedStock.changePct}%)
                </span>
              </div>
              <button 
                onClick={() => setSelectedStock(null)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.25)', borderRadius: '8px', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <CheckCircle2 size={16} color="#10b981" />
                <span style={{ fontSize: '12px', color: 'white', flex: 1 }}>
                  <strong>1-7. NR7 Range Expansion:</strong> Today's range (<strong>{selectedStock.todayRange} pts</strong>) &gt; all 7 prior daily ranges (Max prior: <strong>{selectedStock.priorMaxRange7} pts</strong>) — <strong>{selectedStock.expansionRatio}x</strong> expansion
                </span>
              </div>

              <div style={{ background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.25)', borderRadius: '8px', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <CheckCircle2 size={16} color="#10b981" />
                <span style={{ fontSize: '12px', color: 'white', flex: 1 }}>
                  <strong>8. Bullish Green Session:</strong> Daily Close (₹{selectedStock.close}) &gt; Daily Open (₹{selectedStock.open})
                </span>
              </div>

              <div style={{ background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.25)', borderRadius: '8px', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <CheckCircle2 size={16} color="#10b981" />
                <span style={{ fontSize: '12px', color: 'white', flex: 1 }}>
                  <strong>9. Prior Open Rejection:</strong> Daily Close (₹{selectedStock.close}) &gt; 1 Day Ago Open (₹{selectedStock.prevOpen})
                </span>
              </div>

              <div style={{ background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.25)', borderRadius: '8px', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <CheckCircle2 size={16} color="#10b981" />
                <span style={{ fontSize: '12px', color: 'white', flex: 1 }}>
                  <strong>10. Weekly Alignment:</strong> Weekly Close (₹{selectedStock.close}) &gt; Weekly Open (₹{selectedStock.weekOpen})
                </span>
              </div>

              <div style={{ background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.25)', borderRadius: '8px', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <CheckCircle2 size={16} color="#10b981" />
                <span style={{ fontSize: '12px', color: 'white', flex: 1 }}>
                  <strong>11. Monthly Alignment:</strong> Monthly Close (₹{selectedStock.close}) &gt; Monthly Open (₹{selectedStock.monthOpen})
                </span>
              </div>

              <div style={{ background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.25)', borderRadius: '8px', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <CheckCircle2 size={16} color="#10b981" />
                <span style={{ fontSize: '12px', color: 'white', flex: 1 }}>
                  <strong>12. Liquidity Filter:</strong> 1 Day Ago Volume &gt; 10,000 (Current Volume: {formatVolume(selectedStock.volume)})
                </span>
              </div>

              <div style={{ background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.25)', borderRadius: '8px', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <CheckCircle2 size={16} color="#10b981" />
                <span style={{ fontSize: '12px', color: 'white', flex: 1 }}>
                  <strong>13-14. Triple SMA Alignment:</strong> SMA 20 (₹{selectedStock.sma20}) &gt; SMA 40 (₹{selectedStock.sma40}) &gt; SMA 60 (₹{selectedStock.sma60})
                </span>
              </div>
            </div>

            <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                onClick={() => {
                  handleSymbolClick(selectedStock);
                  setSelectedStock(null);
                }}
                style={{
                  background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                  color: '#000',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '8px 18px',
                  fontSize: '13px',
                  fontWeight: '800',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <TrendingUp size={14} /> Open Chart
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
