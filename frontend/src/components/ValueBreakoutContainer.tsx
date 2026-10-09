import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Zap, 
  TrendingUp, 
  TrendingDown, 
  RefreshCw, 
  Search, 
  Layers, 
  Flame, 
  Volume2, 
  VolumeX, 
  ChevronRight, 
  ArrowUpRight, 
  ArrowDownRight, 
  Target, 
  ShieldAlert, 
  Clock, 
  SlidersHorizontal,
  X,
  Eye,
  BarChart2
} from 'lucide-react';
import { getBackendHttpUrl } from '../utils/tvStreamer';

interface ValueBreakoutItem {
  symbol: string;
  displayName: string;
  category: 'indices' | 'commodities' | 'stocks';
  currentPrice: number;
  changePts: number;
  changePct: number;
  status: 'BULLISH_BREAKOUT' | 'BEARISH_BREAKDOWN' | 'IN_BALANCE';
  statusText: string;
  action: string;
  confidence: number;
  isVaInner: boolean;
  isRangeInner: boolean;
  isStrictInner: boolean;
  innerType: string;
  dateOneDayPrior: string;
  datePreviousDay: string;
  dateToday: string;
  
  priorHigh: number;
  priorLow: number;
  priorVah: number;
  priorVal: number;
  priorPoc: number;

  prevHigh: number;
  prevLow: number;
  prevVah: number;
  prevVal: number;
  prevPoc: number;

  todayHigh: number;
  todayLow: number;
  todayOpen: number;
  todayClose: number;

  balanceHigh: number;
  balanceLow: number;
  balanceVah: number;
  balanceVal: number;
  balancePoc: number;
  balanceRange: number;

  triggerPrice: number;
  stopLoss: number;
  target1: number;
  target2: number;
  target3: number;
  distancePct: number;
  scanTime: string;
}

interface ValueBreakoutData {
  lastScanTime: string | null;
  isScanning: boolean;
  results: ValueBreakoutItem[];
  summary: {
    totalMonitored: number;
    activeBalances: number;
    bullishBreakouts: number;
    bearishBreakdowns: number;
    inBalanceCoiling: number;
  };
  featured: {
    nifty: ValueBreakoutItem | null;
    banknifty: ValueBreakoutItem | null;
    crudeoil: ValueBreakoutItem | null;
  };
}

interface ValueBreakoutContainerProps {
  onSymbolSelect: (symbol: string) => void;
  onSwitchToChart: () => void;
  onSwitchToMarketProfile?: () => void;
}

// Melodic Institutional Chime
function playBreakoutAlertSound(isBullish: boolean) {
  try {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    const now = ctx.currentTime;
    
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();

    osc1.type = 'sine';
    osc2.type = 'sine';

    if (isBullish) {
      osc1.frequency.setValueAtTime(587.33, now); // D5
      osc1.frequency.exponentialRampToValueAtTime(880.00, now + 0.35); // A5
      osc2.frequency.setValueAtTime(739.99, now + 0.1); // F#5
      osc2.frequency.exponentialRampToValueAtTime(1174.66, now + 0.45); // D6
    } else {
      osc1.frequency.setValueAtTime(739.99, now); // F#5
      osc1.frequency.exponentialRampToValueAtTime(440.00, now + 0.35); // A4
      osc2.frequency.setValueAtTime(587.33, now + 0.1); // D5
      osc2.frequency.exponentialRampToValueAtTime(293.66, now + 0.45); // D4
    }

    gain.gain.setValueAtTime(0.35, now);
    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(ctx.destination);

    osc1.start(now);
    osc2.start(now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.55);
    osc1.stop(now + 0.6);
    osc2.stop(now + 0.6);
  } catch (e) {}
}

export const ValueBreakoutContainer: React.FC<ValueBreakoutContainerProps> = ({
  onSymbolSelect,
  onSwitchToChart,
  onSwitchToMarketProfile
}) => {
  const [data, setData] = useState<ValueBreakoutData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshKey, setRefreshKey] = useState<number>(0);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'BULLISH' | 'BEARISH' | 'COILING'>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<'ALL' | 'INDICES_COMMODITIES' | 'STOCKS'>('ALL');
  const [innerTypeFilter, setInnerTypeFilter] = useState<'ALL' | 'STRICT' | 'VA_INNER' | 'RANGE_INNER'>('ALL');
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [selectedModalItem, setSelectedModalItem] = useState<ValueBreakoutItem | null>(null);

  const prevBreakoutsCountRef = useRef<number>(0);

  const fetchData = async () => {
    try {
      const backendUrl = await getBackendHttpUrl();
      const scanParam = refreshKey > 0 ? '?scan=true' : '';
      const res = await fetch(`${backendUrl}/api/value-breakouts${scanParam}`);
      if (res.ok) {
        const payload: ValueBreakoutData = await res.json();
        setData(payload);

        // Sound alert on new breakouts
        const currentBreakoutsCount = (payload.summary?.bullishBreakouts || 0) + (payload.summary?.bearishBreakdowns || 0);
        if (soundEnabled && prevBreakoutsCountRef.current > 0 && currentBreakoutsCount > prevBreakoutsCountRef.current) {
          const latest = payload.results?.[0];
          playBreakoutAlertSound(latest?.status === 'BULLISH_BREAKOUT');
        }
        prevBreakoutsCountRef.current = currentBreakoutsCount;
      }
    } catch (err) {
      console.warn('[Value Breakout Container] Fetch failed:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [refreshKey]);

  const handleManualRefresh = () => {
    setLoading(true);
    setRefreshKey(prev => prev + 1);
  };

  const handleSymbolClick = (sym: string) => {
    onSymbolSelect(sym);
    onSwitchToChart();
  };

  const handleMarketProfileClick = (sym: string) => {
    onSymbolSelect(sym);
    if (onSwitchToMarketProfile) {
      onSwitchToMarketProfile();
    }
  };

  // Filter and search logic
  const filteredResults = useMemo(() => {
    if (!data?.results) return [];
    return data.results.filter(item => {
      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toUpperCase();
        if (!item.symbol.toUpperCase().includes(q) && !item.displayName.toUpperCase().includes(q)) {
          return false;
        }
      }
      // Status filter
      if (statusFilter === 'BULLISH' && item.status !== 'BULLISH_BREAKOUT') return false;
      if (statusFilter === 'BEARISH' && item.status !== 'BEARISH_BREAKDOWN') return false;
      if (statusFilter === 'COILING' && item.status !== 'IN_BALANCE') return false;

      // Category filter
      if (categoryFilter === 'INDICES_COMMODITIES' && item.category === 'stocks') return false;
      if (categoryFilter === 'STOCKS' && item.category !== 'stocks') return false;

      // Inner type filter
      if (innerTypeFilter === 'STRICT' && !item.isStrictInner) return false;
      if (innerTypeFilter === 'VA_INNER' && !item.isVaInner) return false;
      if (innerTypeFilter === 'RANGE_INNER' && !item.isRangeInner) return false;

      return true;
    });
  }, [data?.results, searchQuery, statusFilter, categoryFilter, innerTypeFilter]);

  const featuredItems = useMemo(() => {
    if (!data) return [];
    const list: ValueBreakoutItem[] = [];
    if (data.featured?.nifty) list.push(data.featured.nifty);
    if (data.featured?.banknifty) list.push(data.featured.banknifty);
    if (data.featured?.crudeoil) list.push(data.featured.crudeoil);
    return list;
  }, [data]);

  return (
    <div style={{ padding: '16px 20px', maxWidth: '1600px', margin: '0 auto', color: '#f8fafc', minHeight: '85vh' }}>
      
      {/* 1. Header & Summary Stats */}
      <div className="glass-panel" style={{ padding: '20px 24px', borderRadius: '16px', marginBottom: '20px', background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.9) 0%, rgba(30, 41, 59, 0.8) 100%)', border: '1px solid rgba(245, 158, 11, 0.25)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ 
                background: 'linear-gradient(135deg, #f59e0b, #d97706)', 
                color: '#000', 
                padding: '4px 10px', 
                borderRadius: '8px', 
                fontWeight: '900', 
                fontSize: '12px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px'
              }}>
                <Zap size={14} /> VALUE BREAKOUT
              </span>
              <span style={{ fontSize: '12px', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Clock size={13} /> {data?.lastScanTime ? new Date(data.lastScanTime).toLocaleTimeString('en-IN') : 'Live Engine'}
              </span>
            </div>
            <h1 style={{ fontSize: '24px', fontWeight: '800', margin: '8px 0 4px 0', letterSpacing: '-0.5px', color: '#ffffff' }}>
              2-Days Balance & Inner Value Breakouts
            </h1>
            <p style={{ margin: 0, fontSize: '13px', color: '#94a3b8', maxWidth: '850px', lineHeight: '1.4' }}>
              Institutional Auction Market Theory scanner: Identifies coiling setups where <strong>Previous Day (Day T-1) Value Area is strictly inner to One Day Prior (Day T-2)</strong>, detecting powerful volatility expansion & trend acceptance breakouts.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              onClick={() => setSoundEnabled(prev => !prev)}
              style={{
                background: soundEnabled ? 'rgba(245, 158, 11, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                border: `1px solid ${soundEnabled ? 'rgba(245, 158, 11, 0.4)' : 'rgba(255, 255, 255, 0.1)'}`,
                color: soundEnabled ? '#f59e0b' : '#94a3b8',
                padding: '8px 12px',
                borderRadius: '8px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '12px',
                fontWeight: '700'
              }}
              title="Toggle Audio Breakout Chimes"
            >
              {soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
              {soundEnabled ? 'Sound ON' : 'Muted'}
            </button>

            <button
              onClick={handleManualRefresh}
              disabled={loading}
              style={{
                background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                border: 'none',
                color: '#000000',
                padding: '8px 16px',
                borderRadius: '8px',
                cursor: loading ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '12px',
                fontWeight: '800'
              }}
            >
              <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
              {loading ? 'Scanning...' : 'Scan Now'}
            </button>
          </div>
        </div>

        {/* Quick Stat Counters */}
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', 
          gap: '12px', 
          marginTop: '20px',
          paddingTop: '16px',
          borderTop: '1px solid rgba(255, 255, 255, 0.08)'
        }}>
          <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '12px 16px', borderRadius: '10px', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
            <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: '600' }}>MONITORED ASSETS</div>
            <div style={{ fontSize: '20px', fontWeight: '800', color: '#ffffff', marginTop: '2px' }}>{data?.summary?.totalMonitored || 50}</div>
          </div>

          <div style={{ background: 'rgba(245, 158, 11, 0.08)', padding: '12px 16px', borderRadius: '10px', border: '1px solid rgba(245, 158, 11, 0.2)' }}>
            <div style={{ fontSize: '11px', color: '#f59e0b', fontWeight: '600' }}>2-DAY INNER BALANCES</div>
            <div style={{ fontSize: '20px', fontWeight: '800', color: '#f59e0b', marginTop: '2px' }}>{data?.summary?.activeBalances || 0}</div>
          </div>

          <div style={{ background: 'rgba(16, 185, 129, 0.08)', padding: '12px 16px', borderRadius: '10px', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
            <div style={{ fontSize: '11px', color: '#10b981', fontWeight: '600' }}>BULLISH BREAKOUTS 🚀</div>
            <div style={{ fontSize: '20px', fontWeight: '800', color: '#10b981', marginTop: '2px' }}>{data?.summary?.bullishBreakouts || 0}</div>
          </div>

          <div style={{ background: 'rgba(239, 68, 68, 0.08)', padding: '12px 16px', borderRadius: '10px', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
            <div style={{ fontSize: '11px', color: '#ef4444', fontWeight: '600' }}>BEARISH BREAKDOWNS 🔻</div>
            <div style={{ fontSize: '20px', fontWeight: '800', color: '#ef4444', marginTop: '2px' }}>{data?.summary?.bearishBreakdowns || 0}</div>
          </div>

          <div style={{ background: 'rgba(59, 130, 246, 0.08)', padding: '12px 16px', borderRadius: '10px', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
            <div style={{ fontSize: '11px', color: '#60a5fa', fontWeight: '600' }}>COILING IN BALANCE ⏳</div>
            <div style={{ fontSize: '20px', fontWeight: '800', color: '#60a5fa', marginTop: '2px' }}>{data?.summary?.inBalanceCoiling || 0}</div>
          </div>
        </div>
      </div>

      {/* 2. Benchmark Featured Highlights (Nifty, Bank Nifty, MCX Crude) */}
      {featuredItems.length > 0 && (
        <div style={{ marginBottom: '24px' }}>
          <div style={{ fontSize: '13px', fontWeight: '800', color: '#94a3b8', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Flame size={15} color="#f59e0b" /> BENCHMARK INDEX & COMMODITY 2-DAY BALANCES
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '16px' }}>
            {featuredItems.map(item => {
              const isBull = item.status === 'BULLISH_BREAKOUT';
              const isBear = item.status === 'BEARISH_BREAKDOWN';
              const statusBg = isBull ? 'rgba(16, 185, 129, 0.15)' : isBear ? 'rgba(239, 68, 68, 0.15)' : 'rgba(245, 158, 11, 0.15)';
              const statusBorder = isBull ? 'rgba(16, 185, 129, 0.4)' : isBear ? 'rgba(239, 68, 68, 0.4)' : 'rgba(245, 158, 11, 0.4)';
              const statusColor = isBull ? '#10b981' : isBear ? '#ef4444' : '#f59e0b';

              return (
                <div 
                  key={item.symbol} 
                  className="glass-panel" 
                  style={{ 
                    padding: '16px 20px', 
                    borderRadius: '14px', 
                    border: `1px solid ${statusBorder}`, 
                    background: 'rgba(15, 23, 42, 0.75)',
                    position: 'relative'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '15px', fontWeight: '900', color: '#ffffff' }}>{item.displayName}</span>
                      <span style={{ 
                        fontSize: '10px', 
                        fontWeight: '800', 
                        padding: '2px 6px', 
                        borderRadius: '4px', 
                        background: 'rgba(255, 255, 255, 0.08)',
                        color: '#94a3b8'
                      }}>
                        {item.category.toUpperCase()}
                      </span>
                    </div>

                    <span style={{ 
                      fontSize: '11px', 
                      fontWeight: '800', 
                      padding: '3px 8px', 
                      borderRadius: '6px', 
                      background: statusBg,
                      color: statusColor,
                      border: `1px solid ${statusBorder}`
                    }}>
                      {item.statusText}
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', marginBottom: '12px' }}>
                    <span style={{ fontSize: '22px', fontWeight: '900', color: '#ffffff', fontFamily: 'monospace' }}>
                      ₹{item.currentPrice.toLocaleString('en-IN')}
                    </span>
                    <span style={{ 
                      fontSize: '13px', 
                      fontWeight: '700', 
                      color: item.changePct >= 0 ? '#10b981' : '#ef4444' 
                    }}>
                      {item.changePct >= 0 ? '+' : ''}{item.changePct.toFixed(2)}% ({item.changePts >= 0 ? '+' : ''}{item.changePts.toFixed(2)} pts)
                    </span>
                  </div>

                  {/* Inner Logic Spec */}
                  <div style={{ 
                    background: 'rgba(0, 0, 0, 0.25)', 
                    padding: '10px 12px', 
                    borderRadius: '8px', 
                    fontSize: '11px',
                    fontFamily: 'monospace',
                    marginBottom: '12px',
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '6px'
                  }}>
                    <div>
                      <span style={{ color: '#94a3b8' }}>Day T-2 (Prior): </span>
                      <span style={{ color: '#ffffff', fontWeight: '700' }}>₹{item.priorVal} - ₹{item.priorVah}</span>
                    </div>
                    <div>
                      <span style={{ color: '#f59e0b' }}>Day T-1 (Inner): </span>
                      <span style={{ color: '#ffffff', fontWeight: '700' }}>₹{item.prevVal} - ₹{item.prevVah}</span>
                    </div>
                    <div>
                      <span style={{ color: '#94a3b8' }}>2D High (Trigger): </span>
                      <strong style={{ color: '#10b981' }}>₹{item.balanceHigh}</strong>
                    </div>
                    <div>
                      <span style={{ color: '#94a3b8' }}>2D Low (Trigger): </span>
                      <strong style={{ color: '#ef4444' }}>₹{item.balanceLow}</strong>
                    </div>
                  </div>

                  {/* Action Bar */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', paddingTop: '8px', borderTop: '1px solid rgba(255, 255, 255, 0.06)' }}>
                    <div style={{ fontSize: '11px', color: statusColor, fontWeight: '800' }}>
                      {item.action}
                    </div>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button
                        onClick={() => setSelectedModalItem(item)}
                        style={{
                          background: 'rgba(245, 158, 11, 0.15)',
                          border: '1px solid rgba(245, 158, 11, 0.3)',
                          color: '#f59e0b',
                          padding: '4px 8px',
                          borderRadius: '6px',
                          fontSize: '11px',
                          fontWeight: '700',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '3px'
                        }}
                      >
                        <Eye size={12} /> Inspect
                      </button>
                      <button
                        onClick={() => handleMarketProfileClick(item.symbol)}
                        style={{
                          background: 'rgba(0, 240, 255, 0.15)',
                          border: '1px solid rgba(0, 240, 255, 0.3)',
                          color: '#00f0ff',
                          padding: '4px 8px',
                          borderRadius: '6px',
                          fontSize: '11px',
                          fontWeight: '700',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '3px'
                        }}
                      >
                        <BarChart2 size={12} /> Profile
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 3. Controls & Filter Toolbar */}
      <div className="glass-panel" style={{ padding: '14px 18px', borderRadius: '12px', marginBottom: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        
        {/* Search */}
        <div style={{ position: 'relative', minWidth: '220px' }}>
          <Search size={15} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
          <input
            type="text"
            placeholder="Search symbol (e.g. NIFTY, RELIANCE)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              background: 'rgba(0, 0, 0, 0.3)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              color: '#ffffff',
              padding: '6px 10px 6px 32px',
              borderRadius: '6px',
              fontSize: '12px',
              width: '100%',
              outline: 'none'
            }}
          />
        </div>

        {/* Status Filter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(0, 0, 0, 0.25)', padding: '3px', borderRadius: '8px' }}>
          {[
            { id: 'ALL', label: 'All Statuses' },
            { id: 'BULLISH', label: '🚀 Bullish' },
            { id: 'BEARISH', label: '🔻 Bearish' },
            { id: 'COILING', label: '⏳ Coiling' }
          ].map(f => (
            <button
              key={f.id}
              onClick={() => setStatusFilter(f.id as any)}
              style={{
                background: statusFilter === f.id ? '#f59e0b' : 'transparent',
                color: statusFilter === f.id ? '#000000' : '#94a3b8',
                border: 'none',
                padding: '4px 10px',
                borderRadius: '6px',
                fontSize: '11px',
                fontWeight: '700',
                cursor: 'pointer'
              }}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Category Filter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(0, 0, 0, 0.25)', padding: '3px', borderRadius: '8px' }}>
          {[
            { id: 'ALL', label: 'All Assets' },
            { id: 'INDICES_COMMODITIES', label: 'Indices & MCX' },
            { id: 'STOCKS', label: 'F&O Stocks' }
          ].map(c => (
            <button
              key={c.id}
              onClick={() => setCategoryFilter(c.id as any)}
              style={{
                background: categoryFilter === c.id ? '#3b82f6' : 'transparent',
                color: categoryFilter === c.id ? '#ffffff' : '#94a3b8',
                border: 'none',
                padding: '4px 10px',
                borderRadius: '6px',
                fontSize: '11px',
                fontWeight: '700',
                cursor: 'pointer'
              }}
            >
              {c.label}
            </button>
          ))}
        </div>

        {/* Inner Logic Filter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(0, 0, 0, 0.25)', padding: '3px', borderRadius: '8px' }}>
          {[
            { id: 'ALL', label: 'All Inner Types' },
            { id: 'STRICT', label: 'Strict (VA+Range)' },
            { id: 'VA_INNER', label: 'Inner VA Only' }
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setInnerTypeFilter(t.id as any)}
              style={{
                background: innerTypeFilter === t.id ? '#8b5cf6' : 'transparent',
                color: innerTypeFilter === t.id ? '#ffffff' : '#94a3b8',
                border: 'none',
                padding: '4px 10px',
                borderRadius: '6px',
                fontSize: '11px',
                fontWeight: '700',
                cursor: 'pointer'
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* 4. Main Results Data Table */}
      <div className="glass-panel" style={{ borderRadius: '14px', overflow: 'hidden', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: 'rgba(0, 0, 0, 0.4)', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', color: '#94a3b8' }}>
                <th style={{ padding: '12px 14px', fontWeight: '800' }}>SYMBOL</th>
                <th style={{ padding: '12px 14px', fontWeight: '800' }}>LTP (₹)</th>
                <th style={{ padding: '12px 14px', fontWeight: '800' }}>2D INNER SETUP</th>
                <th style={{ padding: '12px 14px', fontWeight: '800' }}>PRIOR (T-2) VA</th>
                <th style={{ padding: '12px 14px', fontWeight: '800' }}>PREV (T-1) INNER VA</th>
                <th style={{ padding: '12px 14px', fontWeight: '800' }}>2D BALANCE RANGE</th>
                <th style={{ padding: '12px 14px', fontWeight: '800' }}>STATUS / ACTION</th>
                <th style={{ padding: '12px 14px', fontWeight: '800' }}>TARGETS / SL</th>
                <th style={{ padding: '12px 14px', fontWeight: '800', textAlign: 'right' }}>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {filteredResults.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>
                    {loading ? (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                        <RefreshCw size={24} className="animate-spin" color="#f59e0b" />
                        <span>Running Market Profile 2-Day Balance Engine...</span>
                      </div>
                    ) : (
                      <div>No active 2-Day Balance setups match the selected criteria.</div>
                    )}
                  </td>
                </tr>
              ) : (
                filteredResults.map((item, idx) => {
                  const isBull = item.status === 'BULLISH_BREAKOUT';
                  const isBear = item.status === 'BEARISH_BREAKDOWN';
                  const statusBg = isBull ? 'rgba(16, 185, 129, 0.15)' : isBear ? 'rgba(239, 68, 68, 0.15)' : 'rgba(245, 158, 11, 0.15)';
                  const statusColor = isBull ? '#10b981' : isBear ? '#ef4444' : '#f59e0b';

                  return (
                    <tr 
                      key={item.symbol} 
                      style={{ 
                        borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
                        backgroundColor: idx % 2 === 0 ? 'rgba(255, 255, 255, 0.01)' : 'transparent',
                        transition: 'background 0.2s'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.04)'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = idx % 2 === 0 ? 'rgba(255, 255, 255, 0.01)' : 'transparent'}
                    >
                      {/* Symbol */}
                      <td style={{ padding: '12px 14px', fontWeight: '800' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span 
                            onClick={() => handleSymbolClick(item.symbol)}
                            style={{ color: '#ffffff', cursor: 'pointer', textDecoration: 'underline' }}
                            title="Click to view Candlestick Chart"
                          >
                            {item.displayName}
                          </span>
                          <span style={{ fontSize: '9px', padding: '1px 5px', borderRadius: '4px', background: 'rgba(255, 255, 255, 0.06)', color: '#94a3b8' }}>
                            {item.category.toUpperCase()}
                          </span>
                        </div>
                      </td>

                      {/* LTP & Change */}
                      <td style={{ padding: '12px 14px', fontFamily: 'monospace' }}>
                        <div style={{ fontWeight: '800', color: '#ffffff' }}>₹{item.currentPrice.toLocaleString('en-IN')}</div>
                        <div style={{ fontSize: '11px', color: item.changePct >= 0 ? '#10b981' : '#ef4444', fontWeight: '700' }}>
                          {item.changePct >= 0 ? '+' : ''}{item.changePct.toFixed(2)}%
                        </div>
                      </td>

                      {/* Setup Badge */}
                      <td style={{ padding: '12px 14px' }}>
                        <span style={{ 
                          fontSize: '10px', 
                          fontWeight: '800', 
                          padding: '2px 7px', 
                          borderRadius: '4px', 
                          background: item.isStrictInner ? 'rgba(139, 92, 246, 0.2)' : 'rgba(59, 130, 246, 0.2)',
                          color: item.isStrictInner ? '#c084fc' : '#60a5fa',
                          border: `1px solid ${item.isStrictInner ? 'rgba(139, 92, 246, 0.4)' : 'rgba(59, 130, 246, 0.4)'}`
                        }}>
                          {item.innerType}
                        </span>
                      </td>

                      {/* Prior (T-2) VA */}
                      <td style={{ padding: '12px 14px', fontFamily: 'monospace', color: '#cbd5e1' }}>
                        <div>VA: <strong style={{ color: '#ffffff' }}>₹{item.priorVal} - ₹{item.priorVah}</strong></div>
                        <div style={{ fontSize: '10px', color: '#94a3b8' }}>POC: ₹{item.priorPoc} | Range: ₹{item.priorLow} - ₹{item.priorHigh}</div>
                      </td>

                      {/* Prev (T-1) Inner VA */}
                      <td style={{ padding: '12px 14px', fontFamily: 'monospace', color: '#f59e0b' }}>
                        <div>VA: <strong style={{ color: '#f59e0b' }}>₹{item.prevVal} - ₹{item.prevVah}</strong></div>
                        <div style={{ fontSize: '10px', color: '#94a3b8' }}>POC: ₹{item.prevPoc} | Range: ₹{item.prevLow} - ₹{item.prevHigh}</div>
                      </td>

                      {/* 2D Balance Range */}
                      <td style={{ padding: '12px 14px', fontFamily: 'monospace' }}>
                        <div style={{ color: '#ffffff' }}>High: <strong style={{ color: '#10b981' }}>₹{item.balanceHigh}</strong></div>
                        <div style={{ color: '#ffffff' }}>Low: <strong style={{ color: '#ef4444' }}>₹{item.balanceLow}</strong></div>
                      </td>

                      {/* Status / Action */}
                      <td style={{ padding: '12px 14px' }}>
                        <span style={{ 
                          fontSize: '11px', 
                          fontWeight: '800', 
                          padding: '3px 8px', 
                          borderRadius: '6px', 
                          background: statusBg,
                          color: statusColor,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}>
                          {item.statusText}
                        </span>
                        <div style={{ fontSize: '10px', color: '#cbd5e1', marginTop: '3px', fontWeight: '700' }}>
                          {item.action}
                        </div>
                      </td>

                      {/* Targets / SL */}
                      <td style={{ padding: '12px 14px', fontFamily: 'monospace', fontSize: '11px' }}>
                        <div style={{ color: '#60a5fa' }}>T1: <strong>₹{item.target1}</strong> | T2: <strong>₹{item.target2}</strong></div>
                        <div style={{ color: '#ef4444' }}>SL: <strong>₹{item.stopLoss}</strong></div>
                      </td>

                      {/* Actions */}
                      <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '6px' }}>
                          <button
                            onClick={() => setSelectedModalItem(item)}
                            style={{
                              background: 'rgba(245, 158, 11, 0.15)',
                              border: '1px solid rgba(245, 158, 11, 0.3)',
                              color: '#f59e0b',
                              padding: '4px 8px',
                              borderRadius: '6px',
                              fontSize: '11px',
                              fontWeight: '700',
                              cursor: 'pointer'
                            }}
                            title="Inspect 2-Day Balance Box"
                          >
                            Inspect
                          </button>

                          <button
                            onClick={() => handleMarketProfileClick(item.symbol)}
                            style={{
                              background: 'rgba(0, 240, 255, 0.15)',
                              border: '1px solid rgba(0, 240, 255, 0.3)',
                              color: '#00f0ff',
                              padding: '4px 8px',
                              borderRadius: '6px',
                              fontSize: '11px',
                              fontWeight: '700',
                              cursor: 'pointer'
                            }}
                            title="Open Market Profile"
                          >
                            Profile
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 5. Interactive 2-Day Balance Visualizer Modal */}
      {selectedModalItem && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          backdropFilter: 'blur(8px)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '16px'
        }}>
          <div className="glass-panel" style={{
            width: '100%',
            maxWidth: '680px',
            backgroundColor: '#0f172a',
            border: '1px solid rgba(245, 158, 11, 0.4)',
            borderRadius: '16px',
            padding: '24px',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.9)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '18px', fontWeight: '900', color: '#ffffff' }}>{selectedModalItem.displayName}</span>
                <span style={{ fontSize: '11px', fontWeight: '800', padding: '2px 6px', borderRadius: '4px', background: 'rgba(245, 158, 11, 0.2)', color: '#f59e0b' }}>
                  2-DAY BALANCE INSPECTION
                </span>
              </div>
              <button
                onClick={() => setSelectedModalItem(null)}
                style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '4px' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Visual Box Diagram */}
            <div style={{ 
              background: 'rgba(0, 0, 0, 0.4)', 
              borderRadius: '12px', 
              padding: '20px', 
              border: '1px solid rgba(255, 255, 255, 0.08)',
              marginBottom: '20px',
              fontFamily: 'monospace'
            }}>
              <div style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '12px', fontWeight: '700' }}>
                AUCTION FRAME COMPRESSION DIAGRAM:
              </div>

              {/* Day T-2 Outer Box */}
              <div style={{ 
                border: '2px dashed rgba(255, 255, 255, 0.3)', 
                borderRadius: '8px', 
                padding: '16px', 
                position: 'relative',
                background: 'rgba(255, 255, 255, 0.02)'
              }}>
                <div style={{ position: 'absolute', top: '-10px', left: '12px', background: '#0f172a', padding: '0 6px', fontSize: '10px', color: '#94a3b8', fontWeight: '700' }}>
                  DAY T-2 (ONE DAY PRIOR / MOTHER FRAME): ₹{selectedModalItem.priorLow} - ₹{selectedModalItem.priorHigh}
                </div>

                {/* Day T-1 Inner Box */}
                <div style={{ 
                  margin: '12px 24px', 
                  border: '2px solid #f59e0b', 
                  borderRadius: '6px', 
                  padding: '12px', 
                  background: 'rgba(245, 158, 11, 0.08)',
                  position: 'relative'
                }}>
                  <div style={{ position: 'absolute', top: '-9px', left: '10px', background: '#0f172a', padding: '0 6px', fontSize: '10px', color: '#f59e0b', fontWeight: '800' }}>
                    ⚡ DAY T-1 (PREVIOUS DAY INNER): ₹{selectedModalItem.prevLow} - ₹{selectedModalItem.prevHigh}
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#cbd5e1', marginTop: '4px' }}>
                    <span>VAL: ₹{selectedModalItem.prevVal}</span>
                    <span style={{ color: '#00f0ff' }}>POC: ₹{selectedModalItem.prevPoc}</span>
                    <span>VAH: ₹{selectedModalItem.prevVah}</span>
                  </div>
                </div>

                {/* Live Day T Position */}
                <div style={{ 
                  marginTop: '14px', 
                  padding: '8px 12px', 
                  borderRadius: '6px', 
                  background: selectedModalItem.status === 'BULLISH_BREAKOUT' ? 'rgba(16, 185, 129, 0.2)' : (selectedModalItem.status === 'BEARISH_BREAKDOWN' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(245, 158, 11, 0.2)'),
                  border: `1px solid ${selectedModalItem.status === 'BULLISH_BREAKOUT' ? '#10b981' : (selectedModalItem.status === 'BEARISH_BREAKDOWN' ? '#ef4444' : '#f59e0b')}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}>
                  <span style={{ fontSize: '11px', fontWeight: '800', color: '#ffffff' }}>
                    TODAY (DAY T) LIVE: ₹{selectedModalItem.currentPrice}
                  </span>
                  <span style={{ fontSize: '11px', fontWeight: '800', color: selectedModalItem.status === 'BULLISH_BREAKOUT' ? '#10b981' : (selectedModalItem.status === 'BEARISH_BREAKDOWN' ? '#ef4444' : '#f59e0b') }}>
                    {selectedModalItem.statusText}
                  </span>
                </div>
              </div>
            </div>

            {/* Action Plan Details */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px', fontSize: '12px', fontFamily: 'monospace' }}>
              <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '12px', borderRadius: '8px' }}>
                <div style={{ color: '#94a3b8' }}>TRADE ACTION:</div>
                <div style={{ fontSize: '14px', fontWeight: '900', color: '#ffffff', marginTop: '2px' }}>{selectedModalItem.action}</div>
                <div style={{ color: '#94a3b8', marginTop: '6px' }}>CONFIDENCE: <strong style={{ color: '#34d399' }}>{selectedModalItem.confidence}%</strong></div>
              </div>

              <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '12px', borderRadius: '8px' }}>
                <div style={{ color: '#94a3b8' }}>TRIGGER LEVEL:</div>
                <div style={{ fontSize: '14px', fontWeight: '900', color: '#f59e0b', marginTop: '2px' }}>₹{selectedModalItem.triggerPrice}</div>
                <div style={{ color: '#94a3b8', marginTop: '6px' }}>STOP LOSS: <strong style={{ color: '#ef4444' }}>₹{selectedModalItem.stopLoss}</strong></div>
              </div>

              <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '12px', borderRadius: '8px' }}>
                <div style={{ color: '#94a3b8' }}>TARGET 1 (0.618x):</div>
                <div style={{ fontSize: '13px', fontWeight: '800', color: '#60a5fa', marginTop: '2px' }}>₹{selectedModalItem.target1}</div>
              </div>

              <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '12px', borderRadius: '8px' }}>
                <div style={{ color: '#94a3b8' }}>TARGET 2 (1.0x Full Range):</div>
                <div style={{ fontSize: '13px', fontWeight: '800', color: '#34d399', marginTop: '2px' }}>₹{selectedModalItem.target2}</div>
              </div>
            </div>

            {/* Quick Links */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                onClick={() => {
                  setSelectedModalItem(null);
                  handleSymbolClick(selectedModalItem.symbol);
                }}
                style={{
                  background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
                  border: 'none',
                  color: '#ffffff',
                  padding: '8px 16px',
                  borderRadius: '8px',
                  fontWeight: '700',
                  fontSize: '12px',
                  cursor: 'pointer'
                }}
              >
                Open Candlestick Chart 📈
              </button>
              <button
                onClick={() => {
                  setSelectedModalItem(null);
                  handleMarketProfileClick(selectedModalItem.symbol);
                }}
                style={{
                  background: 'linear-gradient(135deg, #00f0ff, #0284c7)',
                  border: 'none',
                  color: '#000000',
                  padding: '8px 16px',
                  borderRadius: '8px',
                  fontWeight: '800',
                  fontSize: '12px',
                  cursor: 'pointer'
                }}
              >
                Open Market Profile 🏛️
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
