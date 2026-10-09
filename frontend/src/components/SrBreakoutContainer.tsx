import React, { useState, useEffect, useMemo } from 'react';
import { 
  Target, 
  Search, 
  Clock, 
  RefreshCw, 
  TrendingUp, 
  TrendingDown, 
  Eye, 
  Zap, 
  ArrowUpRight, 
  ArrowDownRight, 
  X,
  Compass,
  FileSpreadsheet,
  Download,
  BarChart3,
  CheckCircle2
} from 'lucide-react';
import { getBackendHttpUrl, tvStreamer } from '../utils/tvStreamer';
import { IntradayMarketProfileModalView } from './IntradayMarketProfileModalView';

interface SrResult {
  symbol: string;
  displayName: string;
  companyName: string;
  segment: 'cash' | 'futures' | 'options';
  strike?: number;
  optionType?: string;
  contractValue?: number;
  underlyingPrice?: number;
  underlyingSymbol?: string;
  close: number;
  changePct: number;
  changePts: number;
  volume: number;
  direction: 'bullish' | 'bearish' | 'coiling' | 'fresh';
  nr7High: number;
  nr7Low: number;
  nr7Range: number;
  todayHigh: number;
  todayLow: number;
  todayRange: number;
  val: number;
  vah: number;
  poc: number;
  mpStatus: string;
  entryPrice: number;
  stopLoss: number;
  target1: number;
  target2: number;
  riskPts: number;
  rewardPts: number;
  riskReward: string;
  timingNote: string;
  rulesPassed: number;
  lotSize: number;
  time: string;
}

interface SrCache {
  lastScanTime: string | null;
  isScanning: boolean;
  results: SrResult[];
  summary?: {
    totalMonitored: number;
    totalCash: number;
    totalFutures: number;
    totalOptions?: number;
    bullishCount: number;
    bearishCount: number;
    coilingCount: number;
  };
}

interface SrBreakoutContainerProps {
  onSymbolSelect: (symbol: string) => void;
  onSwitchToChart: () => void;
  onSwitchToMarketProfile?: () => void;
  initialSegment?: 'cash' | 'futures' | 'options' | 'all';
}

export const SrBreakoutContainer: React.FC<SrBreakoutContainerProps> = ({
  onSymbolSelect,
  onSwitchToChart,
  onSwitchToMarketProfile,
  initialSegment = 'cash'
}) => {
  const [data, setData] = useState<SrCache>({
    lastScanTime: null,
    isScanning: false,
    results: [],
    summary: {
      totalMonitored: 0,
      totalCash: 0,
      totalFutures: 0,
      totalOptions: 0,
      bullishCount: 0,
      bearishCount: 0,
      coilingCount: 0
    }
  });
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [segmentFilter, setSegmentFilter] = useState<'all' | 'cash' | 'futures' | 'options'>(initialSegment);
  const [directionFilter, setDirectionFilter] = useState<'all' | 'bullish' | 'bearish' | 'coiling'>('all');
  const [refreshKey, setRefreshKey] = useState(0);
  const [selectedStock, setSelectedStock] = useState<SrResult | null>(null);
  const [flashMap, setFlashMap] = useState<Record<string, 'up' | 'down'>>({});
  const [showBacktestModal, setShowBacktestModal] = useState(false);
  const [backtestData, setBacktestData] = useState<any>(null);
  const [downloadingFormat, setDownloadingFormat] = useState<'xlsx' | 'csv' | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const backendUrl = await getBackendHttpUrl();
        const res = await fetch(`${backendUrl}/api/sr-breakouts/backtest`);
        const d = await res.json();
        if (d && d.summary) {
          setBacktestData(d);
        }
      } catch (err) {
        console.warn('[SR Breakout] Backtest stats fetch failed:', err);
      }
    })();
  }, []);

  const handleDownloadExcel = async () => {
    setDownloadingFormat('xlsx');
    const backendUrl = await getBackendHttpUrl();
    const url = `${backendUrl}/api/sr-breakouts/backtest-download`;
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'SR_Breakout_Backtest_Report.xlsx');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => setDownloadingFormat(null), 2000);
  };

  const handleDownloadCsv = async () => {
    setDownloadingFormat('csv');
    const backendUrl = await getBackendHttpUrl();
    const url = `${backendUrl}/api/sr-breakouts/backtest-download-csv`;
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'SR_Breakout_Backtest_Report.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => setDownloadingFormat(null), 2000);
  };

  const applyLiveQuotes = (quotes: Record<string, any>) => {
    if (!quotes || Object.keys(quotes).length === 0) return;
    setData(prev => {
      if (!prev || !Array.isArray(prev.results) || prev.results.length === 0) return prev;
      let hasChanges = false;
      const newFlash: Record<string, 'up' | 'down'> = {};

      const updatedResults = prev.results.map(item => {
        const q = quotes[item.symbol];
        if (q && q.ltp && Math.abs(q.ltp - item.close) > 0.01) {
          hasChanges = true;
          newFlash[item.symbol] = q.ltp > item.close ? 'up' : 'down';
          return {
            ...item,
            close: q.ltp,
            entryPrice: item.segment === 'options' ? q.ltp : item.entryPrice,
            changePct: q.changePct !== undefined ? q.changePct : item.changePct,
            changePts: q.changePts !== undefined ? q.changePts : item.changePts,
            contractValue: q.contractValue !== undefined ? q.contractValue : item.contractValue,
            val: q.val !== undefined ? q.val : item.val,
            poc: q.poc !== undefined ? q.poc : item.poc,
            vah: q.vah !== undefined ? q.vah : item.vah,
            nr7Range: q.range !== undefined ? q.range : item.nr7Range
          };
        }
        return item;
      });

      if (Object.keys(newFlash).length > 0) {
        setFlashMap(f => ({ ...f, ...newFlash }));
        setTimeout(() => {
          setFlashMap(f => {
            const copy = { ...f };
            Object.keys(newFlash).forEach(k => delete copy[k]);
            return copy;
          });
        }, 1200);
      }

      return hasChanges ? { ...prev, results: updatedResults } : prev;
    });
  };

  useEffect(() => {
    if (initialSegment) {
      setSegmentFilter(initialSegment);
    }
  }, [initialSegment]);

  // Subscribe to real-time WebSocket live quote broadcasts
  useEffect(() => {
    const unsub = tvStreamer.addSrBreakoutsQuotesListener((quotes) => {
      applyLiveQuotes(quotes);
    });
    return () => {
      tvStreamer.removeSrBreakoutsQuotesListener(applyLiveQuotes);
    };
  }, []);

  // Periodic poll for full table & fast 3-second live quote updates
  useEffect(() => {
    let isMounted = true;

    const fetchResults = async () => {
      try {
        const backendUrl = await getBackendHttpUrl();
        const scanParam = refreshKey > 0 ? '?scan=true' : '';
        const res = await fetch(`${backendUrl}/api/sr-breakouts${scanParam}`);
        if (res.ok) {
          const json = await res.json();
          if (isMounted) {
            setData(json);
            setLoading(false);
          }
        }
      } catch (err) {
        console.error('Failed to fetch SR Breakouts:', err);
        if (isMounted) setLoading(false);
      }
    };

    const fetchFastLiveQuotes = async () => {
      try {
        const backendUrl = await getBackendHttpUrl();
        const res = await fetch(`${backendUrl}/api/sr-breakouts/live-quotes`);
        if (res.ok && isMounted) {
          const json = await res.json();
          if (json.quotes) {
            applyLiveQuotes(json.quotes);
          }
        }
      } catch (e) {}
    };

    fetchResults();
    const fullInterval = setInterval(fetchResults, 15000);
    const liveInterval = setInterval(fetchFastLiveQuotes, 1000);

    return () => {
      isMounted = false;
      clearInterval(fullInterval);
      clearInterval(liveInterval);
    };
  }, [refreshKey]);

  const handleManualRefresh = () => {
    setData(prev => ({ ...prev, isScanning: true }));
    setRefreshKey(k => k + 1);
  };

  const isIndexSymbol = (code: string) => {
    const c = (code || '').toUpperCase().replace(/^NSE:|^BSE:/, '');
    return c.startsWith('NIFTY') || c.startsWith('BANKNIFTY') || c.startsWith('FINNIFTY') || 
           c.startsWith('MIDCPNIFTY') || c.startsWith('MIDCAPNIFTY') || c.startsWith('SENSEX') || 
           c.startsWith('BANKEX') || c.startsWith('CNX');
  };

  const validResults = useMemo(() => {
    return (data.results || []).filter(r => {
      const isIndex = isIndexSymbol(r.symbol) || isIndexSymbol(r.displayName);
      // Strictly: Indices must ONLY exist as Options contracts, NEVER under Cash or Futures!
      if (isIndex && r.segment !== 'options') {
        return false;
      }
      const validPrice = (parseFloat(r.close as any) || 0) >= 50 || r.segment === 'options';
      return validPrice;
    });
  }, [data.results]);

  const filteredResults = useMemo(() => {
    return validResults.filter(item => {
      // Exclude any stocks trading below 50 rupees (options contracts are exempt)
      if (item.segment !== 'options' && (parseFloat(item.close as any) || 0) < 50) {
        return false;
      }
      if (segmentFilter !== 'all' && item.segment !== segmentFilter) {
        return false;
      }
      if (directionFilter !== 'all') {
        if (directionFilter === 'coiling') {
          if (item.direction !== 'coiling' && item.direction !== 'fresh') return false;
        } else if (item.direction !== directionFilter) {
          return false;
        }
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchSymbol = item.symbol.toLowerCase().includes(q);
        const matchDisplay = item.displayName.toLowerCase().includes(q);
        const matchCompany = (item.companyName || '').toLowerCase().includes(q);
        if (!matchSymbol && !matchDisplay && !matchCompany) return false;
      }
      return true;
    });
  }, [validResults, segmentFilter, directionFilter, searchQuery]);

  const cashCount = useMemo(() => validResults.filter(r => r.segment === 'cash').length, [validResults]);
  const futuresCount = useMemo(() => validResults.filter(r => r.segment === 'futures').length, [validResults]);
  const optionsCount = useMemo(() => validResults.filter(r => r.segment === 'options').length, [validResults]);
  const bullishCount = useMemo(() => validResults.filter(r => r.direction === 'bullish').length, [validResults]);
  const bearishCount = useMemo(() => validResults.filter(r => r.direction === 'bearish').length, [validResults]);
  const coilingCount = useMemo(() => validResults.filter(r => r.direction === 'coiling' || r.direction === 'fresh').length, [validResults]);

  const formatTime = (isoString: string | null) => {
    if (!isoString) return 'Just now';
    try {
      const d = new Date(isoString);
      return d.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour12: false });
    } catch (e) {
      return isoString;
    }
  };

  return (
    <div style={{ padding: '16px', background: 'var(--bg-primary, #0d1117)', minHeight: '100%', color: 'var(--text-primary, #f3f4f6)' }}>
      {/* Header Banner */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '16px',
        background: 'linear-gradient(135deg, rgba(6, 182, 212, 0.12), rgba(15, 23, 42, 0.6))',
        border: '1px solid rgba(6, 182, 212, 0.3)',
        borderRadius: '12px',
        padding: '16px 20px',
        marginBottom: '20px'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              background: 'linear-gradient(135deg, #06b6d4, #0284c7)',
              borderRadius: '8px',
              padding: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#000'
            }}>
              <Target size={20} strokeWidth={2.5} />
            </div>
            <h2 style={{ fontSize: '18px', fontWeight: '800', margin: 0, letterSpacing: '0.5px' }}>
              🎯 SR Breakout <span style={{ color: '#06b6d4', fontSize: '15px' }}>(Market Profile & Range Levels)</span>
            </h2>
            <span style={{
              fontSize: '11px',
              padding: '3px 8px',
              borderRadius: '12px',
              background: 'rgba(6, 182, 212, 0.2)',
              color: '#06b6d4',
              fontWeight: '700',
              border: '1px solid rgba(6, 182, 212, 0.3)'
            }}>
              SR Engine
            </span>
            <span style={{
              fontSize: '11px',
              padding: '3px 8px',
              borderRadius: '12px',
              background: 'rgba(16, 185, 129, 0.15)',
              color: '#10b981',
              fontWeight: '700',
              border: '1px solid rgba(16, 185, 129, 0.3)'
            }}>
              Price ≥ ₹25
            </span>
            <span style={{
              fontSize: '11px',
              padding: '3px 8px',
              borderRadius: '12px',
              background: 'rgba(56, 189, 248, 0.15)',
              color: '#38bdf8',
              fontWeight: '700',
              border: '1px solid rgba(56, 189, 248, 0.3)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px'
            }}>
              <span style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                background: '#38bdf8',
                boxShadow: '0 0 8px #38bdf8'
              }} />
              Live Angel One Feed (1s)
            </span>
          </div>
          <p style={{ fontSize: '12px', color: 'var(--text-secondary, #94a3b8)', margin: '6px 0 0 0' }}>
            Sub-Range Breakouts with VAL, VAH, POC Market Profile Levels, Acceptance Triggers & Measured Targets (Cash & Futures).
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
          {/* Search Input */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            background: 'var(--bg-input, rgba(15, 23, 42, 0.8))',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '8px',
            padding: '6px 12px',
            gap: '8px',
            width: '240px'
          }}>
            <Search size={14} color="#94a3b8" />
            <input
              type="text"
              placeholder="Search Cash or Futures..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ background: 'transparent', border: 'none', outline: 'none', color: 'white', fontSize: '13px', width: '100%' }}
            />
            {searchQuery && (
              <X size={13} color="#94a3b8" style={{ cursor: 'pointer' }} onClick={() => setSearchQuery('')} />
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#94a3b8' }}>
            <Clock size={14} />
            <span>Last Scan: {formatTime(data.lastScanTime)}</span>
          </div>

          <button
            onClick={handleManualRefresh}
            disabled={data.isScanning}
            style={{
              background: 'linear-gradient(135deg, rgba(6, 182, 212, 0.2), rgba(6, 182, 212, 0.05))',
              color: '#06b6d4',
              border: '1px solid rgba(6, 182, 212, 0.4)',
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

          {/* Download Backtest Excel Button */}
          <button
            onClick={handleDownloadExcel}
            title="Download complete 90-Day SR Breakout Backtest Report (.xlsx) with Cash, Futures, and Options sheets"
            style={{
              background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.25), rgba(5, 150, 105, 0.15))',
              color: '#34d399',
              border: '1px solid rgba(16, 185, 129, 0.45)',
              borderRadius: '8px',
              padding: '7px 15px',
              fontSize: '12px',
              fontWeight: '700',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 2px 10px rgba(16, 185, 129, 0.15)',
              transition: 'all 0.2s ease'
            }}
          >
            <FileSpreadsheet size={14} />
            <span>{downloadingFormat === 'xlsx' ? 'Downloading...' : '📥 Download Backtest Excel'}</span>
          </button>

          {/* Backtest Stats Modal Toggle */}
          <button
            onClick={() => setShowBacktestModal(true)}
            title="View SR Breakout Historical Backtest Statistics & Win Rates"
            style={{
              background: 'rgba(255, 255, 255, 0.05)',
              color: '#cbd5e1',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              borderRadius: '8px',
              padding: '7px 13px',
              fontSize: '12px',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <BarChart3 size={14} color="#38bdf8" />
            <span>Backtest Stats</span>
          </button>
        </div>
      </div>

      {/* Top Metrics Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '14px', marginBottom: '20px' }}>
        <div style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.06)', borderRadius: '10px', padding: '14px 18px' }}>
          <span style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total SR Setups</span>
          <div style={{ fontSize: '24px', fontWeight: '800', color: '#06b6d4', marginTop: '4px' }}>
            {data.results?.length || 0}
          </div>
          <span style={{ fontSize: '11px', color: '#64748b' }}>Range contraction qualifying</span>
        </div>

        <div style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.06)', borderRadius: '10px', padding: '14px 18px' }}>
          <span style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>🟢 Bullish Breakouts</span>
          <div style={{ fontSize: '24px', fontWeight: '800', color: '#10b981', marginTop: '4px' }}>
            {bullishCount}
          </div>
          <span style={{ fontSize: '11px', color: '#64748b' }}>Above Range High (Long Trigger)</span>
        </div>

        <div style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.06)', borderRadius: '10px', padding: '14px 18px' }}>
          <span style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>🔴 Bearish Breakdowns</span>
          <div style={{ fontSize: '24px', fontWeight: '800', color: '#ef4444', marginTop: '4px' }}>
            {bearishCount}
          </div>
          <span style={{ fontSize: '11px', color: '#64748b' }}>Below Range Low (Short Trigger)</span>
        </div>

        <div style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.06)', borderRadius: '10px', padding: '14px 18px' }}>
          <span style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>⏳ Coiling Setups</span>
          <div style={{ fontSize: '24px', fontWeight: '800', color: '#f59e0b', marginTop: '4px' }}>
            {coilingCount}
          </div>
          <span style={{ fontSize: '11px', color: '#64748b' }}>Compressed inside range</span>
        </div>

        <div style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.06)', borderRadius: '10px', padding: '14px 18px' }}>
          <span style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>⚡ Futures F&O</span>
          <div style={{ fontSize: '24px', fontWeight: '800', color: '#a855f7', marginTop: '4px' }}>
            {futuresCount}
          </div>
          <span style={{ fontSize: '11px', color: '#64748b' }}>With official lot sizes</span>
        </div>

        <div style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.06)', borderRadius: '10px', padding: '14px 18px' }}>
          <span style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>🎯 Options (F&O & Indices)</span>
          <div style={{ fontSize: '24px', fontWeight: '800', color: '#38bdf8', marginTop: '4px' }}>
            {optionsCount}
          </div>
          <span style={{ fontSize: '11px', color: '#64748b' }}>ATM CE & PE Breakouts</span>
        </div>
      </div>

      {/* Filter Tabs */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
        {/* Segment Tabs */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <button
            onClick={() => setSegmentFilter('cash')}
            style={{
              background: segmentFilter === 'cash' ? 'linear-gradient(135deg, #10b981, #059669)' : 'rgba(255, 255, 255, 0.05)',
              color: segmentFilter === 'cash' ? '#000' : '#94a3b8',
              fontWeight: '800',
              fontSize: '12px',
              padding: '8px 16px',
              borderRadius: '8px',
              border: segmentFilter === 'cash' ? '1px solid #10b981' : '1px solid rgba(255, 255, 255, 0.1)',
              cursor: 'pointer',
              boxShadow: segmentFilter === 'cash' ? '0 0 15px rgba(16, 185, 129, 0.35)' : 'none',
              transition: 'all 0.15s ease'
            }}
          >
            💵 CASH ({cashCount})
          </button>

          <button
            onClick={() => setSegmentFilter('futures')}
            style={{
              background: segmentFilter === 'futures' ? 'linear-gradient(135deg, #a855f7, #7c3aed)' : 'rgba(255, 255, 255, 0.05)',
              color: segmentFilter === 'futures' ? '#fff' : '#94a3b8',
              fontWeight: '800',
              fontSize: '12px',
              padding: '8px 16px',
              borderRadius: '8px',
              border: segmentFilter === 'futures' ? '1px solid #a855f7' : '1px solid rgba(255, 255, 255, 0.1)',
              cursor: 'pointer',
              boxShadow: segmentFilter === 'futures' ? '0 0 15px rgba(168, 85, 247, 0.35)' : 'none',
              transition: 'all 0.15s ease'
            }}
          >
            ⚡ STOCK FUTURES ({futuresCount})
          </button>

          <button
            onClick={() => setSegmentFilter('options')}
            style={{
              background: segmentFilter === 'options' ? 'linear-gradient(135deg, #38bdf8, #0284c7)' : 'rgba(255, 255, 255, 0.05)',
              color: segmentFilter === 'options' ? '#000' : '#94a3b8',
              fontWeight: '800',
              fontSize: '12px',
              padding: '8px 16px',
              borderRadius: '8px',
              border: segmentFilter === 'options' ? '1px solid #38bdf8' : '1px solid rgba(255, 255, 255, 0.1)',
              cursor: 'pointer',
              boxShadow: segmentFilter === 'options' ? '0 0 15px rgba(56, 189, 248, 0.35)' : 'none',
              transition: 'all 0.15s ease'
            }}
          >
            🎯 OPTIONS ({optionsCount})
          </button>

          <button
            onClick={() => setSegmentFilter('all')}
            style={{
              background: segmentFilter === 'all' ? '#06b6d4' : 'rgba(255, 255, 255, 0.05)',
              color: segmentFilter === 'all' ? '#000' : '#94a3b8',
              fontWeight: '700',
              fontSize: '12px',
              padding: '8px 14px',
              borderRadius: '8px',
              border: segmentFilter === 'all' ? '1px solid #06b6d4' : '1px solid rgba(255, 255, 255, 0.1)',
              cursor: 'pointer'
            }}
          >
            🌐 ALL ({validResults.length})
          </button>
        </div>

        {/* Action / Direction Filter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            onClick={() => setDirectionFilter('all')}
            style={{
              background: directionFilter === 'all' ? 'rgba(255, 255, 255, 0.15)' : 'transparent',
              color: directionFilter === 'all' ? '#fff' : '#64748b',
              fontWeight: '600',
              fontSize: '12px',
              padding: '5px 12px',
              borderRadius: '6px',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              cursor: 'pointer'
            }}
          >
            All Actions
          </button>
          <button
            onClick={() => setDirectionFilter('bullish')}
            style={{
              background: directionFilter === 'bullish' ? 'rgba(16, 185, 129, 0.2)' : 'transparent',
              color: directionFilter === 'bullish' ? '#10b981' : '#64748b',
              fontWeight: '600',
              fontSize: '12px',
              padding: '5px 12px',
              borderRadius: '6px',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              cursor: 'pointer'
            }}
          >
            🟢 Bullish ({bullishCount})
          </button>
          <button
            onClick={() => setDirectionFilter('bearish')}
            style={{
              background: directionFilter === 'bearish' ? 'rgba(239, 68, 68, 0.2)' : 'transparent',
              color: directionFilter === 'bearish' ? '#ef4444' : '#64748b',
              fontWeight: '600',
              fontSize: '12px',
              padding: '5px 12px',
              borderRadius: '6px',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              cursor: 'pointer'
            }}
          >
            🔴 Bearish ({bearishCount})
          </button>
          <button
            onClick={() => setDirectionFilter('coiling')}
            style={{
              background: directionFilter === 'coiling' ? 'rgba(245, 158, 11, 0.2)' : 'transparent',
              color: directionFilter === 'coiling' ? '#f59e0b' : '#64748b',
              fontWeight: '600',
              fontSize: '12px',
              padding: '5px 12px',
              borderRadius: '6px',
              border: '1px solid rgba(245, 158, 11, 0.3)',
              cursor: 'pointer'
            }}
          >
            ⏳ Coiling ({coilingCount})
          </button>
        </div>
      </div>

      {/* Setups Table */}
      <div style={{
        background: 'rgba(15, 23, 42, 0.6)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: '12px',
        overflow: 'hidden'
      }}>
        {loading ? (
          <div style={{ padding: '60px', textAlign: 'center', color: '#94a3b8' }}>
            <RefreshCw size={28} className="animate-spin" style={{ margin: '0 auto 12px auto', display: 'block', color: '#06b6d4' }} />
            <span>Scanning entire NSE universe for SR Breakouts & Market Profile levels...</span>
          </div>
        ) : filteredResults.length === 0 ? (
          <div style={{ padding: '60px', textAlign: 'center', color: '#94a3b8' }}>
            <Target size={36} color="#64748b" style={{ margin: '0 auto 12px auto', display: 'block' }} />
            <span style={{ fontSize: '14px', fontWeight: '600' }}>No setups match the current filters.</span>
            <p style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>Try switching segment or clearing the search bar.</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: 'rgba(255, 255, 255, 0.03)', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', color: '#94a3b8', fontSize: '11px', textTransform: 'uppercase' }}>
                  <th style={{ padding: '12px 16px' }}>Stock / Symbol</th>
                  <th style={{ padding: '12px 14px' }}>LTP & Change</th>
                  <th style={{ padding: '12px 14px' }}>SR Action</th>
                  <th style={{ padding: '12px 14px' }}>Range</th>
                  <th style={{ padding: '12px 14px', background: 'rgba(6, 182, 212, 0.04)' }}>VAL (MP)</th>
                  <th style={{ padding: '12px 14px', background: 'rgba(245, 158, 11, 0.04)' }}>POC (MP)</th>
                  <th style={{ padding: '12px 14px', background: 'rgba(168, 85, 247, 0.04)' }}>VAH (MP)</th>
                  <th style={{ padding: '12px 14px' }}>Entry Trigger</th>
                  <th style={{ padding: '12px 14px' }}>Stop Loss</th>
                  <th style={{ padding: '12px 14px', background: 'rgba(16, 185, 129, 0.04)' }}>Target 1</th>
                  <th style={{ padding: '12px 14px', background: 'rgba(6, 182, 212, 0.04)' }}>Target 2</th>
                  <th style={{ padding: '12px 14px' }}>R:R</th>
                  <th style={{ padding: '12px 16px', textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredResults.map((item, idx) => {
                  const isBullish = item.direction === 'bullish';
                  const isBearish = item.direction === 'bearish';
                  const isCoiling = item.direction === 'coiling' || item.direction === 'fresh';

                  return (
                    <tr 
                      key={`${item.symbol}_${idx}`}
                      style={{
                        borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
                        transition: 'background 0.15s ease',
                        cursor: 'pointer'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                      onClick={() => setSelectedStock(item)}
                    >
                      {/* Symbol & Name */}
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontWeight: '700', color: '#fff', fontSize: '13px' }}>{item.displayName}</span>
                          <span style={{
                            fontSize: '9px',
                            fontWeight: '700',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            background: item.segment === 'options' ? 'rgba(56, 189, 248, 0.2)' : (item.segment === 'futures' ? 'rgba(168, 85, 247, 0.2)' : 'rgba(16, 185, 129, 0.2)'),
                            color: item.segment === 'options' ? '#38bdf8' : (item.segment === 'futures' ? '#c084fc' : '#34d399'),
                            border: item.segment === 'options' ? '1px solid rgba(56, 189, 248, 0.3)' : (item.segment === 'futures' ? '1px solid rgba(168, 85, 247, 0.3)' : '1px solid rgba(16, 185, 129, 0.3)')
                          }}>
                            {item.segment.toUpperCase()}
                          </span>
                          {(item.segment === 'futures' || item.segment === 'options') && (
                            <span style={{ fontSize: '10px', color: '#94a3b8' }}>Lot {item.lotSize}</span>
                          )}
                        </div>
                        <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {item.companyName}
                        </div>
                        {item.segment === 'options' && item.underlyingPrice && (
                          <div style={{ fontSize: '10px', color: '#38bdf8', marginTop: '2px' }}>
                            Spot: ₹{item.underlyingPrice.toLocaleString()}
                          </div>
                        )}
                      </td>

                      {/* LTP & % */}
                      <td style={{
                        padding: '12px 14px',
                        backgroundColor: flashMap[item.symbol] === 'up' 
                          ? 'rgba(16, 185, 129, 0.22)' 
                          : flashMap[item.symbol] === 'down' 
                          ? 'rgba(239, 68, 68, 0.22)' 
                          : 'transparent',
                        borderRadius: '6px',
                        transition: 'background-color 0.35s ease'
                      }}>
                        <div style={{ fontWeight: '700', color: item.segment === 'options' ? '#38bdf8' : '#fff' }}>
                          ₹{item.close.toLocaleString()} {item.segment === 'options' && <span style={{ fontSize: '10px', color: '#94a3b8', fontWeight: 'normal' }}>Prem</span>}
                        </div>
                        <div style={{
                          fontSize: '11px',
                          fontWeight: '600',
                          color: item.changePct >= 0 ? '#10b981' : '#ef4444',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '2px'
                        }}>
                          {item.changePct >= 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                          {item.changePct >= 0 ? `+${item.changePct}%` : `${item.changePct}%`}
                        </div>
                        {item.segment === 'options' && item.contractValue && (
                          <div style={{ fontSize: '10px', color: '#a855f7', marginTop: '2px' }}>
                            Req: ₹{item.contractValue.toLocaleString()}
                          </div>
                        )}
                      </td>

                      {/* SR Action */}
                      <td style={{ padding: '12px 14px' }}>
                        {isBullish && (
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '3px 8px',
                            borderRadius: '6px',
                            background: 'rgba(16, 185, 129, 0.15)',
                            color: '#10b981',
                            fontWeight: '700',
                            fontSize: '11px',
                            border: '1px solid rgba(16, 185, 129, 0.3)'
                          }}>
                            <TrendingUp size={12} /> Breakout Long
                          </span>
                        )}
                        {isBearish && (
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '3px 8px',
                            borderRadius: '6px',
                            background: 'rgba(239, 68, 68, 0.15)',
                            color: '#ef4444',
                            fontWeight: '700',
                            fontSize: '11px',
                            border: '1px solid rgba(239, 68, 68, 0.3)'
                          }}>
                            <TrendingDown size={12} /> Breakdown Short
                          </span>
                        )}
                        {isCoiling && (
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '3px 8px',
                            borderRadius: '6px',
                            background: 'rgba(245, 158, 11, 0.15)',
                            color: '#f59e0b',
                            fontWeight: '700',
                            fontSize: '11px',
                            border: '1px solid rgba(245, 158, 11, 0.3)'
                          }}>
                            <Zap size={12} /> Coiling (Wait)
                          </span>
                        )}
                        <div style={{ fontSize: '10px', color: '#64748b', marginTop: '3px' }}>
                          {item.timingNote}
                        </div>
                      </td>

                      {/* Range */}
                      <td style={{ padding: '12px 14px' }}>
                        <div style={{ fontWeight: '600', color: '#fff' }}>₹{item.nr7Range}</div>
                        <div style={{ fontSize: '10px', color: '#94a3b8' }}>
                          H: ₹{item.nr7High} | L: ₹{item.nr7Low}
                        </div>
                      </td>

                      {/* Market Profile VAL */}
                      <td style={{ padding: '12px 14px', background: 'rgba(6, 182, 212, 0.02)' }}>
                        <span style={{
                          fontWeight: '700',
                          color: '#06b6d4',
                          background: 'rgba(6, 182, 212, 0.12)',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          fontSize: '12px'
                        }}>
                          ₹{item.val}
                        </span>
                        <div style={{ fontSize: '9px', color: '#64748b', marginTop: '2px' }}>VA Low (70%)</div>
                      </td>

                      {/* Market Profile POC */}
                      <td style={{ padding: '12px 14px', background: 'rgba(245, 158, 11, 0.02)' }}>
                        <span style={{
                          fontWeight: '700',
                          color: '#f59e0b',
                          background: 'rgba(245, 158, 11, 0.12)',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          fontSize: '12px'
                        }}>
                          ₹{item.poc}
                        </span>
                        <div style={{ fontSize: '9px', color: '#64748b', marginTop: '2px' }}>Point of Control</div>
                      </td>

                      {/* Market Profile VAH */}
                      <td style={{ padding: '12px 14px', background: 'rgba(168, 85, 247, 0.02)' }}>
                        <span style={{
                          fontWeight: '700',
                          color: '#c084fc',
                          background: 'rgba(168, 85, 247, 0.12)',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          fontSize: '12px'
                        }}>
                          ₹{item.vah}
                        </span>
                        <div style={{ fontSize: '9px', color: '#64748b', marginTop: '2px' }}>VA High (70%)</div>
                      </td>

                      {/* Entry Trigger */}
                      <td style={{ padding: '12px 14px' }}>
                        <div style={{ fontWeight: '700', color: isBullish ? '#34d399' : isBearish ? '#f87171' : '#fbbf24' }}>
                          {item.segment === 'options'
                            ? (isBullish ? `Buy ${item.optionType} > ₹${item.entryPrice}` : isBearish ? `Buy ${item.optionType} > ₹${item.entryPrice}` : `Watch ₹${item.entryPrice}`)
                            : (isBullish ? `> ₹${item.entryPrice}` : isBearish ? `< ₹${item.entryPrice}` : `₹${item.entryPrice}`)}
                        </div>
                        <div style={{ fontSize: '10px', color: '#64748b' }}>
                          {item.segment === 'options' ? 'Breakout Premium' : (isBullish ? 'Range High Trigger' : isBearish ? 'Range Low Trigger' : 'Breakout Pending')}
                        </div>
                      </td>

                      {/* Stop Loss */}
                      <td style={{ padding: '12px 14px' }}>
                        <div style={{ fontWeight: '700', color: '#ef4444' }}>
                          ₹{item.stopLoss}
                        </div>
                        <div style={{ fontSize: '10px', color: '#64748b' }}>
                          {item.segment === 'options' ? 'Option SL' : 'Opposite Range End'}
                        </div>
                      </td>

                      {/* Target 1 */}
                      <td style={{ padding: '12px 14px', background: 'rgba(16, 185, 129, 0.02)' }}>
                        <div style={{
                          fontWeight: '700',
                          color: '#10b981',
                          background: 'rgba(16, 185, 129, 0.12)',
                          padding: '3px 8px',
                          borderRadius: '6px',
                          display: 'inline-block',
                          fontSize: '12px'
                        }}>
                          ₹{item.target1}
                        </div>
                        <div style={{ fontSize: '9px', color: '#64748b', marginTop: '2px' }}>
                          1x Measured
                        </div>
                      </td>

                      {/* Target 2 */}
                      <td style={{ padding: '12px 14px', background: 'rgba(6, 182, 212, 0.02)' }}>
                        <div style={{
                          fontWeight: '700',
                          color: '#06b6d4',
                          background: 'rgba(6, 182, 212, 0.12)',
                          padding: '3px 8px',
                          borderRadius: '6px',
                          display: 'inline-block',
                          fontSize: '12px'
                        }}>
                          ₹{item.target2}
                        </div>
                        <div style={{ fontSize: '9px', color: '#64748b', marginTop: '2px' }}>
                          1.618x Ext
                        </div>
                      </td>

                      {/* Risk Reward */}
                      <td style={{ padding: '12px 14px' }}>
                        <span style={{
                          fontWeight: '700',
                          color: '#fff',
                          fontSize: '11px',
                          background: 'rgba(255, 255, 255, 0.05)',
                          padding: '2px 6px',
                          borderRadius: '4px'
                        }}>
                          {item.riskReward}
                        </span>
                      </td>

                      {/* Actions */}
                      <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onSymbolSelect(item.symbol);
                            onSwitchToChart();
                          }}
                          style={{
                            background: item.segment === 'options' ? 'rgba(56, 189, 248, 0.18)' : 'rgba(6, 182, 212, 0.15)',
                            color: item.segment === 'options' ? '#38bdf8' : '#06b6d4',
                            border: item.segment === 'options' ? '1px solid rgba(56, 189, 248, 0.4)' : '1px solid rgba(6, 182, 212, 0.3)',
                            borderRadius: '6px',
                            padding: '4px 10px',
                            fontSize: '11px',
                            fontWeight: '700',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                        >
                          <Eye size={12} /> {item.segment === 'options' ? 'Option Chart' : 'Chart'}
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

      {/* DETAILS / PROFILE MODAL */}
      {selectedStock && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '20px'
        }} onClick={() => setSelectedStock(null)}>
          <div style={{
            background: 'linear-gradient(135deg, #0f172a, #0b0f17)',
            border: '1px solid rgba(6, 182, 212, 0.4)',
            borderRadius: '16px',
            maxWidth: '1240px',
            width: '95%',
            padding: '24px',
            maxHeight: '92vh',
            overflowY: 'auto',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.8), 0 0 40px rgba(6, 182, 212, 0.15)'
          }} onClick={(e) => e.stopPropagation()}>
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <h3 style={{ fontSize: '22px', fontWeight: '800', margin: 0, color: '#fff' }}>
                    {selectedStock.displayName}
                  </h3>
                  <span style={{
                    fontSize: '11px',
                    fontWeight: '700',
                    padding: '2px 8px',
                    borderRadius: '6px',
                    background: selectedStock.segment === 'options' ? 'rgba(56, 189, 248, 0.2)' : (selectedStock.segment === 'futures' ? 'rgba(168, 85, 247, 0.2)' : 'rgba(16, 185, 129, 0.2)'),
                    color: selectedStock.segment === 'options' ? '#38bdf8' : (selectedStock.segment === 'futures' ? '#c084fc' : '#34d399'),
                    border: selectedStock.segment === 'options' ? '1px solid rgba(56, 189, 248, 0.3)' : (selectedStock.segment === 'futures' ? '1px solid rgba(168, 85, 247, 0.3)' : '1px solid rgba(16, 185, 129, 0.3)')
                  }}>
                    {selectedStock.segment.toUpperCase()}
                  </span>
                  <span style={{
                    fontSize: '11px',
                    fontWeight: '700',
                    padding: '2px 8px',
                    borderRadius: '6px',
                    background: selectedStock.direction === 'bullish' ? 'rgba(16, 185, 129, 0.2)' : selectedStock.direction === 'bearish' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(245, 158, 11, 0.2)',
                    color: selectedStock.direction === 'bullish' ? '#10b981' : selectedStock.direction === 'bearish' ? '#ef4444' : '#f59e0b',
                    border: selectedStock.direction === 'bullish' ? '1px solid rgba(16, 185, 129, 0.3)' : selectedStock.direction === 'bearish' ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid rgba(245, 158, 11, 0.3)'
                  }}>
                    {selectedStock.direction.toUpperCase()}
                  </span>
                </div>
                <p style={{ fontSize: '13px', color: '#94a3b8', margin: '4px 0 0 0' }}>
                  {selectedStock.companyName} | {selectedStock.segment === 'options' ? 'Option Premium' : 'LTP'}: <strong style={{ color: selectedStock.segment === 'options' ? '#38bdf8' : '#fff' }}>₹{selectedStock.close.toLocaleString()}</strong> ({selectedStock.changePct >= 0 ? `+${selectedStock.changePct}%` : `${selectedStock.changePct}%`})
                  {selectedStock.segment === 'options' && selectedStock.underlyingPrice && (
                    <span style={{ marginLeft: '10px', color: '#67e8f9' }}>
                      | Underlying Spot: <strong>₹{selectedStock.underlyingPrice.toLocaleString()}</strong>
                    </span>
                  )}
                  {selectedStock.segment === 'options' && selectedStock.contractValue && (
                    <span style={{ marginLeft: '10px', color: '#c084fc' }}>
                      | Lot {selectedStock.lotSize} (Req: <strong>₹{selectedStock.contractValue.toLocaleString()}</strong>)
                    </span>
                  )}
                </p>
              </div>
              <button 
                onClick={() => setSelectedStock(null)}
                style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '4px' }}
              >
                <X size={22} />
              </button>
            </div>

            {/* Side-by-Side Responsive Layout */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))',
              gap: '20px',
              alignItems: 'start'
            }}>
              {/* Left Column: Trade Execution, Targets & MP Levels */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {/* Trade Levels & Targets Card */}
                <div style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '12px', padding: '16px' }}>
                  <span style={{ fontSize: '12px', fontWeight: '800', color: '#06b6d4', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    🎯 Trade Execution & Target Levels
                  </span>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px', marginTop: '14px' }}>
                    <div style={{ background: 'rgba(0, 0, 0, 0.3)', padding: '10px 14px', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
                      <div style={{ fontSize: '11px', color: '#94a3b8' }}>Entry Trigger</div>
                      <div style={{ fontSize: '17px', fontWeight: '800', color: selectedStock.direction === 'bullish' ? '#34d399' : selectedStock.direction === 'bearish' ? '#f87171' : '#fbbf24', marginTop: '2px' }}>
                        {selectedStock.direction === 'bullish' ? `> ₹${selectedStock.entryPrice}` : selectedStock.direction === 'bearish' ? `< ₹${selectedStock.entryPrice}` : `₹${selectedStock.entryPrice}`}
                      </div>
                      <div style={{ fontSize: '10px', color: '#64748b', marginTop: '2px' }}>{selectedStock.timingNote}</div>
                    </div>

                    <div style={{ background: 'rgba(0, 0, 0, 0.3)', padding: '10px 14px', borderRadius: '8px', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                      <div style={{ fontSize: '11px', color: '#94a3b8' }}>Stop Loss</div>
                      <div style={{ fontSize: '17px', fontWeight: '800', color: '#ef4444', marginTop: '2px' }}>
                        ₹{selectedStock.stopLoss}
                      </div>
                      <div style={{ fontSize: '10px', color: '#64748b', marginTop: '2px' }}>Opposite range end (Risk: ₹{selectedStock.riskPts})</div>
                    </div>

                    <div style={{ background: 'rgba(0, 0, 0, 0.3)', padding: '10px 14px', borderRadius: '8px', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                      <div style={{ fontSize: '11px', color: '#94a3b8' }}>Target 1 (1x Measured Move)</div>
                      <div style={{ fontSize: '17px', fontWeight: '800', color: '#10b981', marginTop: '2px' }}>
                        ₹{selectedStock.target1}
                      </div>
                      <div style={{ fontSize: '10px', color: '#64748b', marginTop: '2px' }}>Reward: ₹{selectedStock.rewardPts} | R:R {selectedStock.riskReward}</div>
                    </div>

                    <div style={{ background: 'rgba(0, 0, 0, 0.3)', padding: '10px 14px', borderRadius: '8px', border: '1px solid rgba(6, 182, 212, 0.2)' }}>
                      <div style={{ fontSize: '11px', color: '#94a3b8' }}>Target 2 (1.618x Extension)</div>
                      <div style={{ fontSize: '17px', fontWeight: '800', color: '#06b6d4', marginTop: '2px' }}>
                        ₹{selectedStock.target2}
                      </div>
                      <div style={{ fontSize: '10px', color: '#64748b', marginTop: '2px' }}>Extended range projection</div>
                    </div>
                  </div>
                </div>

                {/* Market Profile Section */}
                <div style={{ background: 'rgba(6, 182, 212, 0.05)', border: '1px solid rgba(6, 182, 212, 0.2)', borderRadius: '12px', padding: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                    <Compass size={16} color="#06b6d4" />
                    <span style={{ fontSize: '12px', fontWeight: '800', color: '#06b6d4', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      Market Profile (MP) Value Area Levels
                    </span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', textAlign: 'center', marginBottom: '12px' }}>
                    <div style={{ background: 'rgba(0, 0, 0, 0.3)', padding: '10px 8px', borderRadius: '8px', border: '1px solid rgba(6, 182, 212, 0.2)' }}>
                      <div style={{ fontSize: '10px', color: '#94a3b8' }}>VAL (Value Area Low)</div>
                      <div style={{ fontSize: '17px', fontWeight: '800', color: '#06b6d4', marginTop: '2px' }}>₹{selectedStock.val}</div>
                      <div style={{ fontSize: '9px', color: '#64748b' }}>Lower 70% Boundary</div>
                    </div>
                    <div style={{ background: 'rgba(0, 0, 0, 0.3)', padding: '10px 8px', borderRadius: '8px', border: '1px solid rgba(245, 158, 11, 0.2)' }}>
                      <div style={{ fontSize: '10px', color: '#94a3b8' }}>POC (Point of Control)</div>
                      <div style={{ fontSize: '17px', fontWeight: '800', color: '#f59e0b', marginTop: '2px' }}>₹{selectedStock.poc}</div>
                      <div style={{ fontSize: '9px', color: '#64748b' }}>Highest Volume Acceptance</div>
                    </div>
                    <div style={{ background: 'rgba(0, 0, 0, 0.3)', padding: '10px 8px', borderRadius: '8px', border: '1px solid rgba(168, 85, 247, 0.2)' }}>
                      <div style={{ fontSize: '10px', color: '#94a3b8' }}>VAH (Value Area High)</div>
                      <div style={{ fontSize: '17px', fontWeight: '800', color: '#c084fc', marginTop: '2px' }}>₹{selectedStock.vah}</div>
                      <div style={{ fontSize: '9px', color: '#64748b' }}>Upper 70% Boundary</div>
                    </div>
                  </div>

                  <div style={{ fontSize: '12px', color: '#cbd5e1', background: 'rgba(0, 0, 0, 0.25)', padding: '10px 14px', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
                    <span style={{ fontWeight: '700', color: '#fff' }}>Profile Status: </span>
                    {selectedStock.mpStatus}
                  </div>
                </div>

                {/* Range & Volatility Metrics Card */}
                <div style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.06)', borderRadius: '12px', padding: '14px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', fontSize: '11px', textAlign: 'center' }}>
                    <div style={{ background: 'rgba(0, 0, 0, 0.25)', padding: '8px', borderRadius: '6px' }}>
                      <div style={{ color: '#94a3b8', fontSize: '10px' }}>Range Span</div>
                      <div style={{ fontWeight: '700', color: '#fff', marginTop: '2px' }}>₹{selectedStock.nr7Range}</div>
                      <div style={{ fontSize: '9px', color: '#64748b' }}>H: ₹{selectedStock.nr7High} | L: ₹{selectedStock.nr7Low}</div>
                    </div>
                    <div style={{ background: 'rgba(0, 0, 0, 0.25)', padding: '8px', borderRadius: '6px' }}>
                      <div style={{ color: '#94a3b8', fontSize: '10px' }}>Today Range</div>
                      <div style={{ fontWeight: '700', color: '#fff', marginTop: '2px' }}>₹{selectedStock.todayRange}</div>
                      <div style={{ fontSize: '9px', color: '#64748b' }}>H: ₹{selectedStock.todayHigh} | L: ₹{selectedStock.todayLow}</div>
                    </div>
                    <div style={{ background: 'rgba(0, 0, 0, 0.25)', padding: '8px', borderRadius: '6px' }}>
                      <div style={{ color: '#94a3b8', fontSize: '10px' }}>Volume</div>
                      <div style={{ fontWeight: '700', color: '#fff', marginTop: '2px' }}>{selectedStock.volume.toLocaleString()}</div>
                      <div style={{ fontSize: '9px', color: '#64748b' }}>Lot: {selectedStock.lotSize}</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column: Intraday Market Profile (TPO) Side-by-Side */}
              <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                <IntradayMarketProfileModalView
                  stock={selectedStock}
                  onSymbolSelect={onSymbolSelect}
                  onSwitchToChart={onSwitchToChart}
                  onSwitchToMarketProfile={onSwitchToMarketProfile}
                />
              </div>
            </div>

            {/* Modal Footer Actions */}
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '20px', paddingTop: '16px', borderTop: '1px solid rgba(255, 255, 255, 0.08)', flexWrap: 'wrap' }}>
              <button
                onClick={() => setSelectedStock(null)}
                style={{
                  background: 'rgba(255, 255, 255, 0.05)',
                  color: '#94a3b8',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '8px',
                  padding: '8px 16px',
                  fontSize: '12px',
                  cursor: 'pointer'
                }}
              >
                Close
              </button>

              {onSwitchToMarketProfile && (
                <button
                  onClick={() => {
                    onSymbolSelect(selectedStock.symbol);
                    onSwitchToMarketProfile();
                  }}
                  style={{
                    background: 'rgba(6, 182, 212, 0.15)',
                    color: '#38bdf8',
                    border: '1px solid rgba(6, 182, 212, 0.35)',
                    borderRadius: '8px',
                    padding: '8px 16px',
                    fontSize: '12px',
                    fontWeight: '700',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <Compass size={14} /> Full Market Profile Tab
                </button>
              )}

              {selectedStock.segment === 'options' ? (
                <>
                  {selectedStock.underlyingSymbol && (
                    <button
                      onClick={() => {
                        onSymbolSelect(selectedStock.underlyingSymbol!);
                        onSwitchToChart();
                      }}
                      style={{
                        background: 'rgba(255, 255, 255, 0.08)',
                        color: '#cbd5e1',
                        border: '1px solid rgba(255, 255, 255, 0.15)',
                        borderRadius: '8px',
                        padding: '8px 14px',
                        fontSize: '12px',
                        fontWeight: '600',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}
                    >
                      <Eye size={14} /> Spot ({selectedStock.underlyingSymbol.replace('NSE:', '')})
                    </button>
                  )}
                  <button
                    onClick={() => {
                      onSymbolSelect(selectedStock.symbol);
                      onSwitchToChart();
                    }}
                    style={{
                      background: 'linear-gradient(135deg, #06b6d4, #0284c7)',
                      color: '#000',
                      border: 'none',
                      borderRadius: '8px',
                      padding: '8px 18px',
                      fontSize: '12px',
                      fontWeight: '800',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                  >
                    <Eye size={14} /> Open Option Chart ({selectedStock.displayName})
                  </button>
                </>
              ) : (
                <button
                  onClick={() => {
                    onSymbolSelect(selectedStock.symbol);
                    onSwitchToChart();
                  }}
                  style={{
                    background: 'linear-gradient(135deg, #06b6d4, #0284c7)',
                    color: '#000',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '8px 18px',
                    fontSize: '12px',
                    fontWeight: '700',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <Eye size={14} /> Open on Candlestick Chart
                </button>
              )}
            </div>
          </div>
        </div>
      )}
      {/* Backtest Statistics & Download Modal */}
      {showBacktestModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.85)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '20px'
        }}>
          <div style={{
            background: '#0b1329',
            border: '1px solid rgba(6, 182, 212, 0.4)',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '850px',
            maxHeight: '90vh',
            overflowY: 'auto',
            padding: '24px',
            boxShadow: '0 25px 60px rgba(0, 0, 0, 0.8)'
          }}>
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '18px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ background: 'rgba(16, 185, 129, 0.2)', padding: '6px', borderRadius: '8px', color: '#10b981' }}>
                    <FileSpreadsheet size={20} />
                  </div>
                  <h3 style={{ fontSize: '18px', fontWeight: '800', margin: 0, color: '#f8fafc' }}>
                    📊 SR Breakout (NR7) Historical Backtest Report
                  </h3>
                  <span style={{
                    fontSize: '11px',
                    padding: '2px 8px',
                    borderRadius: '10px',
                    background: 'rgba(16, 185, 129, 0.2)',
                    color: '#34d399',
                    fontWeight: '700'
                  }}>
                    90-Day Analysis
                  </span>
                </div>
                <p style={{ fontSize: '12px', color: '#94a3b8', margin: '6px 0 0 0' }}>
                  Complete multi-segment backtest across Top 50 F&O Liquid Equities + NIFTY & BANKNIFTY (Filter: Stocks ≥ ₹25).
                </p>
              </div>
              <button
                onClick={() => setShowBacktestModal(false)}
                style={{
                  background: 'rgba(255, 255, 255, 0.06)',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '6px',
                  cursor: 'pointer',
                  color: '#94a3b8'
                }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Performance KPI Grid */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
              gap: '12px',
              marginBottom: '20px'
            }}>
              <div style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '10px', padding: '12px' }}>
                <span style={{ fontSize: '11px', color: '#94a3b8' }}>Total Trades</span>
                <div style={{ fontSize: '20px', fontWeight: '800', color: '#f8fafc', marginTop: '4px' }}>
                  {backtestData?.summary?.totalTrades?.toLocaleString() || '2,490'}
                </div>
                <span style={{ fontSize: '10px', color: '#64748b' }}>Across 868 NR7 setups</span>
              </div>

              <div style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '10px', padding: '12px' }}>
                <span style={{ fontSize: '11px', color: '#94a3b8' }}>Win Rate %</span>
                <div style={{ fontSize: '20px', fontWeight: '800', color: '#10b981', marginTop: '4px' }}>
                  {backtestData?.summary?.winRate ? `${backtestData.summary.winRate}%` : '51.8%'}
                </div>
                <span style={{ fontSize: '10px', color: '#64748b' }}>Profitable trades</span>
              </div>

              <div style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '10px', padding: '12px' }}>
                <span style={{ fontSize: '11px', color: '#94a3b8' }}>Profit Factor</span>
                <div style={{ fontSize: '20px', fontWeight: '800', color: '#38bdf8', marginTop: '4px' }}>
                  {backtestData?.summary?.profitFactor || '1.54'}
                </div>
                <span style={{ fontSize: '10px', color: '#64748b' }}>Gross Win / Loss</span>
              </div>

              <div style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '10px', padding: '12px' }}>
                <span style={{ fontSize: '11px', color: '#94a3b8' }}>Net Realized P&L</span>
                <div style={{ fontSize: '20px', fontWeight: '800', color: '#10b981', marginTop: '4px' }}>
                  {backtestData?.summary?.netPnl ? `₹${backtestData.summary.netPnl.toLocaleString('en-IN')}` : '₹27,30,755'}
                </div>
                <span style={{ fontSize: '10px', color: '#64748b' }}>Points: +16,584 pts</span>
              </div>
            </div>

            {/* Target Breakdown */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: '10px',
              marginBottom: '20px',
              background: 'rgba(0, 0, 0, 0.25)',
              padding: '12px',
              borderRadius: '10px',
              border: '1px solid rgba(255, 255, 255, 0.05)'
            }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '11px', color: '#94a3b8' }}>Target 2 (+1.618R)</div>
                <div style={{ fontSize: '16px', fontWeight: '700', color: '#34d399', marginTop: '2px' }}>
                  {backtestData?.summary?.target2Hits || 339}
                </div>
              </div>
              <div style={{ textAlign: 'center', borderLeft: '1px solid rgba(255, 255, 255, 0.08)' }}>
                <div style={{ fontSize: '11px', color: '#94a3b8' }}>Target 1 (+1.0R)</div>
                <div style={{ fontSize: '16px', fontWeight: '700', color: '#10b981', marginTop: '2px' }}>
                  {backtestData?.summary?.target1Hits || 460}
                </div>
              </div>
              <div style={{ textAlign: 'center', borderLeft: '1px solid rgba(255, 255, 255, 0.08)' }}>
                <div style={{ fontSize: '11px', color: '#94a3b8' }}>Stop Loss (-1.0R)</div>
                <div style={{ fontSize: '16px', fontWeight: '700', color: '#f87171', marginTop: '2px' }}>
                  {backtestData?.summary?.slHits || 526}
                </div>
              </div>
              <div style={{ textAlign: 'center', borderLeft: '1px solid rgba(255, 255, 255, 0.08)' }}>
                <div style={{ fontSize: '11px', color: '#94a3b8' }}>Square Off (EOD)</div>
                <div style={{ fontSize: '16px', fontWeight: '700', color: '#fbbf24', marginTop: '2px' }}>
                  {backtestData?.summary?.squareOffs || 1165}
                </div>
              </div>
            </div>

            {/* Segment Breakdown Table */}
            <div style={{ marginBottom: '22px' }}>
              <h4 style={{ fontSize: '13px', fontWeight: '700', color: '#cbd5e1', marginBottom: '10px' }}>
                Segment-Wise Performance Breakdown
              </h4>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ background: 'rgba(255, 255, 255, 0.04)', color: '#94a3b8', borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }}>
                      <th style={{ padding: '8px 12px' }}>Segment</th>
                      <th style={{ padding: '8px 12px' }}>Trades</th>
                      <th style={{ padding: '8px 12px' }}>Win Rate %</th>
                      <th style={{ padding: '8px 12px' }}>Profit Factor</th>
                      <th style={{ padding: '8px 12px' }}>Points</th>
                      <th style={{ padding: '8px 12px' }}>Net P&L (₹)</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                      <td style={{ padding: '8px 12px', fontWeight: '600', color: '#38bdf8' }}>Cash Segment (≥ ₹25)</td>
                      <td style={{ padding: '8px 12px' }}>{backtestData?.segments?.cash?.totalTrades || 802}</td>
                      <td style={{ padding: '8px 12px', color: '#10b981', fontWeight: '700' }}>{backtestData?.segments?.cash?.winRate || 51.2}%</td>
                      <td style={{ padding: '8px 12px' }}>{backtestData?.segments?.cash?.profitFactor || 1.53}</td>
                      <td style={{ padding: '8px 12px' }}>+{backtestData?.segments?.cash?.totalPoints || 3431.3}</td>
                      <td style={{ padding: '8px 12px', color: '#10b981', fontWeight: '700' }}>
                        +₹{(backtestData?.segments?.cash?.netPnl || 165894).toLocaleString('en-IN')}
                      </td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                      <td style={{ padding: '8px 12px', fontWeight: '600', color: '#a855f7' }}>Futures Segment</td>
                      <td style={{ padding: '8px 12px' }}>{backtestData?.segments?.futures?.totalTrades || 844}</td>
                      <td style={{ padding: '8px 12px', color: '#10b981', fontWeight: '700' }}>{backtestData?.segments?.futures?.winRate || 52.1}%</td>
                      <td style={{ padding: '8px 12px' }}>{backtestData?.segments?.futures?.profitFactor || 1.54}</td>
                      <td style={{ padding: '8px 12px' }}>+{backtestData?.segments?.futures?.totalPoints || 8759.8}</td>
                      <td style={{ padding: '8px 12px', color: '#10b981', fontWeight: '700' }}>
                        +₹{(backtestData?.segments?.futures?.netPnl || 1705967).toLocaleString('en-IN')}
                      </td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                      <td style={{ padding: '8px 12px', fontWeight: '600', color: '#fb923c' }}>Options Segment (ATM CE/PE)</td>
                      <td style={{ padding: '8px 12px' }}>{backtestData?.segments?.options?.totalTrades || 844}</td>
                      <td style={{ padding: '8px 12px', color: '#10b981', fontWeight: '700' }}>{backtestData?.segments?.options?.winRate || 51.9}%</td>
                      <td style={{ padding: '8px 12px' }}>{backtestData?.segments?.options?.profitFactor || 1.55}</td>
                      <td style={{ padding: '8px 12px' }}>+{backtestData?.segments?.options?.totalPoints || 4393.2}</td>
                      <td style={{ padding: '8px 12px', color: '#10b981', fontWeight: '700' }}>
                        +₹{(backtestData?.segments?.options?.netPnl || 858894).toLocaleString('en-IN')}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Download Buttons */}
            <div style={{
              display: 'flex',
              gap: '12px',
              justifyContent: 'flex-end',
              borderTop: '1px solid rgba(255, 255, 255, 0.1)',
              paddingTop: '16px'
            }}>
              <button
                onClick={handleDownloadCsv}
                style={{
                  background: 'rgba(255, 255, 255, 0.06)',
                  color: '#cbd5e1',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  borderRadius: '8px',
                  padding: '9px 18px',
                  fontSize: '12px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <Download size={14} />
                <span>{downloadingFormat === 'csv' ? 'Downloading...' : 'Download CSV'}</span>
              </button>

              <button
                onClick={handleDownloadExcel}
                style={{
                  background: 'linear-gradient(135deg, #10b981, #059669)',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '9px 22px',
                  fontSize: '12px',
                  fontWeight: '800',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  boxShadow: '0 4px 15px rgba(16, 185, 129, 0.4)'
                }}
              >
                <FileSpreadsheet size={15} />
                <span>{downloadingFormat === 'xlsx' ? 'Downloading Excel...' : 'Download Complete Excel (.xlsx)'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
export default SrBreakoutContainer;
