import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  Zap, 
  TrendingUp, 
  TrendingDown, 
  RefreshCw, 
  Search, 
  Target, 
  ShieldAlert, 
  Clock, 
  ChevronRight, 
  Filter, 
  BarChart2, 
  Sparkles,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  Radio,
  SlidersHorizontal,
  Info
} from 'lucide-react';
import { getBackendHttpUrl } from '../utils/tvStreamer';

export interface CandlestickPatternItem {
  id: string;
  symbol: string;
  pattern: string;
  direction: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  timeframe: string;
  entry: number;
  stopLoss: number;
  target1: number;
  target2: number;
  riskReward: string;
  candleTime: string;
  currentPrice: number;
  description?: string;
}

export interface TestingPatternContainerProps {
  currentSymbol?: string;
  onSymbolSelect: (symbol: string) => void;
  onSwitchToChart: () => void;
}

export const TestingPatternContainer: React.FC<TestingPatternContainerProps> = ({
  currentSymbol = 'NSE:NIFTY',
  onSymbolSelect,
  onSwitchToChart
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'intraday' | 'daily' | 'weekly'>('intraday');
  const [intradayTf, setIntradayTf] = useState<'5' | '15' | '60'>('15');
  const [patternsList, setPatternsList] = useState<CandlestickPatternItem[]>([]);
  const [currentSymbolPatterns, setCurrentSymbolPatterns] = useState<CandlestickPatternItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [scanProgress, setScanProgress] = useState<{ current: number; total: number; category?: string } | null>(null);
  const [universeSize, setUniverseSize] = useState<number>(5017);
  const [scanningCurrent, setScanningCurrent] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedPatternFilter, setSelectedPatternFilter] = useState<string>('ALL');
  const [selectedDirectionFilter, setSelectedDirectionFilter] = useState<'ALL' | 'BULLISH' | 'BEARISH'>('ALL');
  const [autoRefresh, setAutoRefresh] = useState<boolean>(true);
  const [countdown, setCountdown] = useState<number>(30);
  const [lastScanTime, setLastScanTime] = useState<string | null>(null);

  // Available Pattern filter list
  const PATTERN_OPTIONS = [
    'ALL',
    'Morning Star',
    'Evening Star',
    'Bullish Engulfing',
    'Bearish Engulfing',
    'Pin Bar',
    'Doji',
    'Tweezer',
    'Harami'
  ];

  // Fetch universe scan results for current subtab
  const fetchPatterns = useCallback(async (showLoading = false) => {
    if (showLoading) setLoading(true);
    try {
      const base = await getBackendHttpUrl();
      if (!base) return;

      const tfParam = activeSubTab === 'intraday' ? (intradayTf === '5' ? '5' : (intradayTf === '60' ? '60' : 'intraday')) : activeSubTab;
      const res = await fetch(`${base.replace(/\/+$/, '')}/api/candlestick-patterns/results?timeframe=${encodeURIComponent(tfParam)}&_t=${Date.now()}`);
      if (res.ok) {
        const json = await res.json();
        if (json && json.success) {
          setPatternsList(json.data || []);
          setIsScanning(!!json.isScanning);
          if (json.scanProgress) {
            setScanProgress(json.scanProgress);
          } else {
            setScanProgress(null);
          }
          if (json.summary?.universeSize) {
            setUniverseSize(json.summary.universeSize);
          }
          if (json.lastScanTime) {
            setLastScanTime(json.lastScanTime);
          }
        }
      }
    } catch (err) {
      console.warn('[Testing Tab] Fetch error:', err);
    } finally {
      if (showLoading) setLoading(false);
    }
  }, [activeSubTab, intradayTf]);

  // Scan currently opened/selected symbol
  const scanCurrentOpenedSymbol = useCallback(async () => {
    if (!currentSymbol) return;
    setScanningCurrent(true);
    try {
      const base = await getBackendHttpUrl();
      if (!base) return;

      const tfParam = activeSubTab === 'intraday' ? intradayTf : (activeSubTab === 'daily' ? 'D' : 'W');
      const res = await fetch(`${base.replace(/\/+$/, '')}/api/candlestick-patterns/scan-symbol`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol: currentSymbol, timeframe: tfParam })
      });
      if (res.ok) {
        const json = await res.json();
        if (json && json.success && Array.isArray(json.patterns)) {
          setCurrentSymbolPatterns(json.patterns);
          // Prepend newly found patterns to the table
          setPatternsList(prev => {
            const cleanNew = json.patterns.filter((p: CandlestickPatternItem) => !prev.some(x => x.id === p.id));
            return [...cleanNew, ...prev];
          });
        }
      }
    } catch (err) {
      console.warn('[Testing Tab] Current symbol scan error:', err);
    } finally {
      setScanningCurrent(false);
    }
  }, [currentSymbol, activeSubTab, intradayTf]);

  // Trigger full universe scan
  const triggerUniverseScan = async () => {
    setIsScanning(true);
    try {
      const base = await getBackendHttpUrl();
      if (!base) return;

      const tfParam = activeSubTab === 'intraday' ? (intradayTf === '5' ? '5' : (intradayTf === '60' ? '60' : 'intraday')) : activeSubTab;
      await fetch(`${base.replace(/\/+$/, '')}/api/candlestick-patterns/scan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ timeframe: tfParam })
      });
      setTimeout(() => fetchPatterns(false), 2000);
    } catch (err) {
      console.warn('[Testing Tab] Universe scan trigger error:', err);
    }
  };

  // Initial load & sub-tab switch
  useEffect(() => {
    fetchPatterns(true);
    scanCurrentOpenedSymbol();
  }, [fetchPatterns, scanCurrentOpenedSymbol]);

  // Auto-refresh countdown timer
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          fetchPatterns(false);
          return 30;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [autoRefresh, fetchPatterns]);

  // Combined and filtered patterns
  const filteredPatterns = useMemo(() => {
    return patternsList.filter(item => {
      // 0. Skip stocks trading below 50 rupees
      const p = Number(item.currentPrice || item.entry || 0);
      if (p > 0 && p < 50) return false;

      // 1. Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const symMatch = item.symbol.toLowerCase().includes(q);
        const patMatch = item.pattern.toLowerCase().includes(q);
        if (!symMatch && !patMatch) return false;
      }

      // 2. Pattern filter
      if (selectedPatternFilter !== 'ALL') {
        const normItemPat = item.pattern.toLowerCase();
        const normFilter = selectedPatternFilter.toLowerCase();
        if (!normItemPat.includes(normFilter)) return false;
      }

      // 3. Direction filter
      if (selectedDirectionFilter !== 'ALL') {
        if (item.direction !== selectedDirectionFilter) return false;
      }

      return true;
    });
  }, [patternsList, searchQuery, selectedPatternFilter, selectedDirectionFilter]);

  // Summary counts
  const summaryStats = useMemo(() => {
    const total = filteredPatterns.length;
    const bullish = filteredPatterns.filter(p => p.direction === 'BULLISH').length;
    const bearish = filteredPatterns.filter(p => p.direction === 'BEARISH').length;
    const morningEvening = filteredPatterns.filter(p => p.pattern.includes('Star')).length;
    const engulfing = filteredPatterns.filter(p => p.pattern.includes('Engulfing')).length;
    const pinBars = filteredPatterns.filter(p => p.pattern.includes('Pin Bar')).length;
    return { total, bullish, bearish, morningEvening, engulfing, pinBars };
  }, [filteredPatterns]);

  const handleRowClick = (item: CandlestickPatternItem) => {
    onSymbolSelect(item.symbol);
    onSwitchToChart();
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '12px',
      padding: '12px',
      color: '#e2e8f0',
      backgroundColor: '#0b0f19',
      minHeight: '100vh',
      boxSizing: 'border-box'
    }}>
      {/* HEADER BAR */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '12px 16px',
        backgroundColor: '#131b2e',
        borderRadius: '8px',
        border: '1px solid #222f4c',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.4)',
        gap: '12px'
      }}>
        {/* Title and Icon */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '36px',
            height: '36px',
            borderRadius: '8px',
            backgroundColor: 'rgba(139, 92, 246, 0.2)',
            color: '#a78bfa',
            border: '1px solid rgba(139, 92, 246, 0.4)'
          }}>
            <Sparkles size={20} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '16px', fontWeight: 900, color: '#f8fafc', letterSpacing: '0.5px' }}>
                CANDLESTICK PATTERNS RADAR
              </span>
              <span style={{
                fontSize: '10px',
                fontWeight: 800,
                color: '#a78bfa',
                backgroundColor: 'rgba(139, 92, 246, 0.15)',
                border: '1px solid rgba(139, 92, 246, 0.3)',
                padding: '2px 8px',
                borderRadius: '4px'
              }}>
                TESTING
              </span>
              <span style={{
                fontSize: '10px',
                fontWeight: 800,
                color: '#38bdf8',
                backgroundColor: 'rgba(56, 189, 248, 0.15)',
                border: '1px solid rgba(56, 189, 248, 0.3)',
                padding: '2px 8px',
                borderRadius: '4px'
              }}>
                MIN PRICE: ≥ ₹50
              </span>
            </div>
            <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>
              Institutional Price Action Scanner • Stocks ≥ ₹50 • Morning/Evening Star, Engulfing, Pin Bar, Doji, Tweezer & Harami
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {/* Quick Scan Current Opened Stock Button */}
          <button
            onClick={scanCurrentOpenedSymbol}
            disabled={scanningCurrent}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: '#1e293b',
              color: '#38bdf8',
              border: '1px solid #38bdf8',
              padding: '6px 12px',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: 800,
              cursor: scanningCurrent ? 'not-allowed' : 'pointer',
              opacity: scanningCurrent ? 0.7 : 1,
              transition: 'all 0.15s'
            }}
            title={`Run instant pattern detection for ${currentSymbol}`}
          >
            <Zap size={14} className={scanningCurrent ? 'animate-spin' : ''} />
            <span>Scan Current ({currentSymbol.replace('NSE:', '').replace('MCX:', '')})</span>
          </button>

          {/* Universe Scan Button */}
          <button
            onClick={triggerUniverseScan}
            disabled={isScanning}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: isScanning ? 'rgba(99, 102, 241, 0.2)' : '#4338ca',
              color: '#ffffff',
              border: '1px solid #6366f1',
              padding: '6px 12px',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: 800,
              cursor: isScanning ? 'not-allowed' : 'pointer',
              boxShadow: '0 2px 10px rgba(99, 102, 241, 0.3)'
            }}
          >
            <RefreshCw size={14} className={isScanning ? 'animate-spin' : ''} />
            <span>{isScanning ? 'Scanning Universe...' : 'Scan All Stocks'}</span>
          </button>

          {/* Auto Refresh Toggle */}
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: autoRefresh ? 'rgba(16, 185, 129, 0.15)' : '#1e293b',
              color: autoRefresh ? '#34d399' : '#94a3b8',
              border: '1px solid ' + (autoRefresh ? '#10b981' : '#334155'),
              padding: '6px 10px',
              borderRadius: '6px',
              fontSize: '11px',
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            <Radio size={12} className={autoRefresh ? 'animate-pulse' : ''} />
            <span>Auto: {autoRefresh ? `${countdown}s` : 'OFF'}</span>
          </button>
        </div>
      </div>

      {/* TIMEFRAME SUB-TABS: Intraday | Daily | Weekly */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        backgroundColor: '#101524',
        padding: '6px 12px',
        borderRadius: '8px',
        border: '1px solid #1e2840',
        gap: '8px'
      }}>
        {/* Main 3 Sub-Tabs */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {[
            { id: 'intraday', label: '⏱️ Intraday' },
            { id: 'daily', label: '📅 Daily' },
            { id: 'weekly', label: '🗓️ Weekly' }
          ].map(tab => {
            const isActive = activeSubTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveSubTab(tab.id as any);
                }}
                style={{
                  backgroundColor: isActive ? '#3b82f6' : 'transparent',
                  color: isActive ? '#ffffff' : '#94a3b8',
                  border: isActive ? '1px solid #60a5fa' : '1px solid transparent',
                  padding: '6px 16px',
                  borderRadius: '6px',
                  fontSize: '13px',
                  fontWeight: isActive ? 800 : 600,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease-in-out'
                }}
              >
                {tab.label}
              </button>
            );
          })}

          {/* Intraday Granularity Selector */}
          {activeSubTab === 'intraday' && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '3px',
              backgroundColor: '#182136',
              padding: '2px 4px',
              borderRadius: '5px',
              marginLeft: '8px',
              border: '1px solid #283654'
            }}>
              <span style={{ fontSize: '10px', color: '#64748b', fontWeight: 700, paddingLeft: '4px' }}>Bar:</span>
              {[
                { label: '5m', value: '5' },
                { label: '15m', value: '15' },
                { label: '1H', value: '60' }
              ].map(tf => {
                const isTfActive = intradayTf === tf.value;
                return (
                  <button
                    key={tf.value}
                    onClick={() => setIntradayTf(tf.value as any)}
                    style={{
                      backgroundColor: isTfActive ? '#0284c7' : 'transparent',
                      color: isTfActive ? '#ffffff' : '#94a3b8',
                      border: 'none',
                      borderRadius: '4px',
                      padding: '2px 8px',
                      fontSize: '11px',
                      fontWeight: isTfActive ? 800 : 600,
                      cursor: 'pointer'
                    }}
                  >
                    {tf.label}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Last Scan Time info */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: '#64748b' }}>
          <Clock size={12} />
          <span>Last Updated: {lastScanTime ? new Date(lastScanTime).toLocaleTimeString('en-IN') : 'Live'}</span>
        </div>
      </div>

      {/* LIVE SCAN PROGRESS BANNER */}
      {Boolean(isScanning || scanProgress) && (
        <div style={{
          backgroundColor: '#151d33',
          border: '1px solid #3b82f6',
          borderRadius: '8px',
          padding: '10px 16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          boxShadow: '0 4px 15px rgba(59, 130, 246, 0.15)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#60a5fa', fontWeight: 700 }}>
              <RefreshCw size={14} className="animate-spin" />
              <span>Full Universe Scanner Running ({scanProgress?.category ? `${scanProgress.category.toUpperCase()} UNIVERSE` : '5,000+ STOCKS'})</span>
            </div>
            <div style={{ color: '#cbd5e1', fontWeight: 700, fontFamily: 'monospace' }}>
              {scanProgress ? (
                `${scanProgress.current.toLocaleString()} / ${scanProgress.total.toLocaleString()} (${Math.round((scanProgress.current / scanProgress.total) * 100)}%)`
              ) : (
                'Initializing full universe batches...'
              )}
            </div>
          </div>
          <div style={{ width: '100%', height: '6px', backgroundColor: '#0b0f19', borderRadius: '3px', overflow: 'hidden' }}>
            <div style={{
              width: `${scanProgress ? Math.min(100, Math.max(3, Math.round((scanProgress.current / scanProgress.total) * 100))) : 8}%`,
              height: '100%',
              background: 'linear-gradient(90deg, #3b82f6, #8b5cf6, #ec4899)',
              transition: 'width 0.4s ease'
            }} />
          </div>
        </div>
      )}

      {/* SUMMARY STATS BAR */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
        gap: '8px'
      }}>
        <div style={{
          backgroundColor: '#141c2e',
          padding: '10px 14px',
          borderRadius: '8px',
          border: '1px solid #23304c'
        }}>
          <div style={{ fontSize: '10px', color: '#94a3b8', fontWeight: 700 }}>STOCK UNIVERSE</div>
          <div style={{ fontSize: '18px', fontWeight: 900, color: '#38bdf8', marginTop: '2px' }}>
            {universeSize.toLocaleString()}
          </div>
        </div>

        <div style={{
          backgroundColor: '#141c2e',
          padding: '10px 14px',
          borderRadius: '8px',
          border: '1px solid #23304c'
        }}>
          <div style={{ fontSize: '10px', color: '#94a3b8', fontWeight: 700 }}>TOTAL MATCHES</div>
          <div style={{ fontSize: '18px', fontWeight: 900, color: '#f8fafc', marginTop: '2px' }}>
            {summaryStats.total}
          </div>
        </div>

        <div style={{
          backgroundColor: '#141c2e',
          padding: '10px 14px',
          borderRadius: '8px',
          border: '1px solid rgba(16, 185, 129, 0.3)'
        }}>
          <div style={{ fontSize: '10px', color: '#34d399', fontWeight: 700 }}>BULLISH SETUPS</div>
          <div style={{ fontSize: '18px', fontWeight: 900, color: '#34d399', marginTop: '2px' }}>
            {summaryStats.bullish}
          </div>
        </div>

        <div style={{
          backgroundColor: '#141c2e',
          padding: '10px 14px',
          borderRadius: '8px',
          border: '1px solid rgba(239, 68, 68, 0.3)'
        }}>
          <div style={{ fontSize: '10px', color: '#f87171', fontWeight: 700 }}>BEARISH SETUPS</div>
          <div style={{ fontSize: '18px', fontWeight: 900, color: '#f87171', marginTop: '2px' }}>
            {summaryStats.bearish}
          </div>
        </div>

        <div style={{
          backgroundColor: '#141c2e',
          padding: '10px 14px',
          borderRadius: '8px',
          border: '1px solid rgba(139, 92, 246, 0.3)'
        }}>
          <div style={{ fontSize: '10px', color: '#c084fc', fontWeight: 700 }}>STAR REVERSALS</div>
          <div style={{ fontSize: '18px', fontWeight: 900, color: '#c084fc', marginTop: '2px' }}>
            {summaryStats.morningEvening}
          </div>
        </div>

        <div style={{
          backgroundColor: '#141c2e',
          padding: '10px 14px',
          borderRadius: '8px',
          border: '1px solid rgba(245, 158, 11, 0.3)'
        }}>
          <div style={{ fontSize: '10px', color: '#fbbf24', fontWeight: 700 }}>ENGULFING & PIN BARS</div>
          <div style={{ fontSize: '18px', fontWeight: 900, color: '#fbbf24', marginTop: '2px' }}>
            {summaryStats.engulfing + summaryStats.pinBars}
          </div>
        </div>
      </div>

      {/* FILTER & SEARCH CONTROLS */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#131b2e',
        padding: '10px 14px',
        borderRadius: '8px',
        border: '1px solid #222f4c',
        gap: '10px'
      }}>
        {/* Search input */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          backgroundColor: '#0b0f19',
          border: '1px solid #283756',
          borderRadius: '6px',
          padding: '4px 10px',
          width: '260px'
        }}>
          <Search size={14} color='#64748b' />
          <input
            type='text'
            placeholder='Search stock or pattern...'
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              background: 'none',
              border: 'none',
              color: '#f8fafc',
              fontSize: '12px',
              outline: 'none',
              width: '100%'
            }}
          />
        </div>

        {/* Pattern type pills */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
          {PATTERN_OPTIONS.map(opt => {
            const isSel = selectedPatternFilter === opt;
            return (
              <button
                key={opt}
                onClick={() => setSelectedPatternFilter(opt)}
                style={{
                  fontSize: '11px',
                  fontWeight: isSel ? 800 : 500,
                  backgroundColor: isSel ? '#2563eb' : '#1a2236',
                  color: isSel ? '#ffffff' : '#94a3b8',
                  border: '1px solid ' + (isSel ? '#3b82f6' : '#26334f'),
                  borderRadius: '4px',
                  padding: '3px 8px',
                  cursor: 'pointer',
                  transition: 'all 0.1s'
                }}
              >
                {opt}
              </button>
            );
          })}
        </div>

        {/* Direction filter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          {[
            { id: 'ALL', label: 'All' },
            { id: 'BULLISH', label: '▲ Bullish' },
            { id: 'BEARISH', label: '▼ Bearish' }
          ].map(dir => {
            const isSel = selectedDirectionFilter === dir.id;
            return (
              <button
                key={dir.id}
                onClick={() => setSelectedDirectionFilter(dir.id as any)}
                style={{
                  fontSize: '11px',
                  fontWeight: isSel ? 800 : 600,
                  backgroundColor: isSel 
                    ? (dir.id === 'BULLISH' ? 'rgba(16, 185, 129, 0.25)' : dir.id === 'BEARISH' ? 'rgba(239, 68, 68, 0.25)' : '#334155')
                    : '#182136',
                  color: isSel 
                    ? (dir.id === 'BULLISH' ? '#34d399' : dir.id === 'BEARISH' ? '#f87171' : '#f8fafc')
                    : '#64748b',
                  border: '1px solid ' + (isSel 
                    ? (dir.id === 'BULLISH' ? '#10b981' : dir.id === 'BEARISH' ? '#ef4444' : '#64748b')
                    : '#283654'),
                  borderRadius: '4px',
                  padding: '3px 8px',
                  cursor: 'pointer'
                }}
              >
                {dir.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* PATTERNS TABLE */}
      <div style={{
        backgroundColor: '#121929',
        borderRadius: '8px',
        border: '1px solid #1e293f',
        overflowX: 'auto',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)'
      }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '12px' }}>
          <thead>
            <tr style={{ backgroundColor: '#182135', color: '#94a3b8', borderBottom: '1px solid #283754' }}>
              <th style={{ padding: '10px 14px', fontWeight: 700 }}>STOCK / SYMBOL</th>
              <th style={{ padding: '10px 14px', fontWeight: 700 }}>PATTERN</th>
              <th style={{ padding: '10px 14px', fontWeight: 700 }}>TIMEFRAME</th>
              <th style={{ padding: '10px 14px', fontWeight: 700, color: '#38bdf8' }}>ENTRY</th>
              <th style={{ padding: '10px 14px', fontWeight: 700, color: '#f87171' }}>STOP LOSS</th>
              <th style={{ padding: '10px 14px', fontWeight: 700, color: '#34d399' }}>TARGET 1</th>
              <th style={{ padding: '10px 14px', fontWeight: 700, color: '#10b981' }}>TARGET 2</th>
              <th style={{ padding: '10px 14px', fontWeight: 700, color: '#a78bfa' }}>RISK / REWARD</th>
              <th style={{ padding: '10px 14px', fontWeight: 700, textAlign: 'center' }}>ACTION</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={9} style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                    <RefreshCw size={24} className='animate-spin' color='#3b82f6' />
                    <span>Scanning market data for candlestick patterns...</span>
                  </div>
                </td>
              </tr>
            ) : filteredPatterns.length === 0 ? (
              <tr>
                <td colSpan={9} style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                    <Info size={24} color='#64748b' />
                    <span>No candlestick patterns detected for the selected filters.</span>
                    <button
                      onClick={triggerUniverseScan}
                      style={{
                        marginTop: '6px',
                        backgroundColor: '#2563eb',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '4px',
                        padding: '6px 14px',
                        fontWeight: 700,
                        cursor: 'pointer'
                      }}
                    >
                      Run Full Universe Scan Now
                    </button>
                  </div>
                </td>
              </tr>
            ) : (
              filteredPatterns.map((item, index) => {
                const isBull = item.direction === 'BULLISH';
                return (
                  <tr 
                    key={item.id || index}
                    onClick={() => handleRowClick(item)}
                    style={{
                      borderBottom: '1px solid #1a2336',
                      backgroundColor: index % 2 === 0 ? 'transparent' : '#141c2c',
                      cursor: 'pointer',
                      transition: 'background-color 0.1s'
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#1c273e')}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = index % 2 === 0 ? 'transparent' : '#141c2c')}
                  >
                    {/* Symbol */}
                    <td style={{ padding: '10px 14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontWeight: 800, color: '#f8fafc', fontSize: '13px' }}>
                          {item.symbol.replace('NSE:', '').replace('MCX:', '')}
                        </span>
                        <span style={{
                          fontSize: '9px',
                          color: item.symbol.includes('MCX') ? '#f59e0b' : '#38bdf8',
                          backgroundColor: '#1b253b',
                          padding: '1px 5px',
                          borderRadius: '3px',
                          fontWeight: 700
                        }}>
                          {item.symbol.includes('MCX') ? 'MCX' : 'NSE'}
                        </span>
                      </div>
                      <div style={{ fontSize: '10px', color: '#64748b', marginTop: '2px' }}>
                        LTP: ₹{item.currentPrice?.toLocaleString('en-IN') || '--'}
                      </div>
                    </td>

                    {/* Pattern with visual badge */}
                    <td style={{ padding: '10px 14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          fontWeight: 800,
                          fontSize: '11px',
                          padding: '3px 8px',
                          borderRadius: '4px',
                          backgroundColor: isBull ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                          color: isBull ? '#34d399' : '#f87171',
                          border: `1px solid ${isBull ? 'rgba(16, 185, 129, 0.4)' : 'rgba(239, 68, 68, 0.4)'}`
                        }}>
                          {isBull ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
                          {item.pattern}
                        </span>
                      </div>
                      {item.description && (
                        <div style={{ fontSize: '10px', color: '#94a3b8', marginTop: '2px', maxWidth: '280px' }}>
                          {item.description}
                        </div>
                      )}
                    </td>

                    {/* Timeframe */}
                    <td style={{ padding: '10px 14px' }}>
                      <span style={{
                        backgroundColor: '#1e293b',
                        color: '#94a3b8',
                        padding: '2px 7px',
                        borderRadius: '4px',
                        fontWeight: 700,
                        fontSize: '11px'
                      }}>
                        {item.timeframe}
                      </span>
                      <div style={{ fontSize: '10px', color: '#64748b', marginTop: '2px' }}>
                        {item.candleTime}
                      </div>
                    </td>

                    {/* Entry */}
                    <td style={{ padding: '10px 14px', fontWeight: 800, color: '#38bdf8', fontFamily: 'monospace', fontSize: '13px' }}>
                      ₹{item.entry?.toLocaleString('en-IN') || '--'}
                    </td>

                    {/* Stop Loss */}
                    <td style={{ padding: '10px 14px', fontWeight: 800, color: '#f87171', fontFamily: 'monospace', fontSize: '13px' }}>
                      ₹{item.stopLoss?.toLocaleString('en-IN') || '--'}
                    </td>

                    {/* Target 1 */}
                    <td style={{ padding: '10px 14px', fontWeight: 800, color: '#34d399', fontFamily: 'monospace', fontSize: '13px' }}>
                      ₹{item.target1?.toLocaleString('en-IN') || '--'}
                    </td>

                    {/* Target 2 */}
                    <td style={{ padding: '10px 14px', fontWeight: 800, color: '#10b981', fontFamily: 'monospace', fontSize: '13px' }}>
                      ₹{item.target2?.toLocaleString('en-IN') || '--'}
                    </td>

                    {/* Risk / Reward */}
                    <td style={{ padding: '10px 14px' }}>
                      <span style={{
                        backgroundColor: 'rgba(167, 139, 250, 0.15)',
                        color: '#c084fc',
                        border: '1px solid rgba(167, 139, 250, 0.3)',
                        padding: '2px 8px',
                        borderRadius: '4px',
                        fontWeight: 800,
                        fontFamily: 'monospace',
                        fontSize: '11px'
                      }}>
                        {item.riskReward || '1 : 2.5'}
                      </span>
                    </td>

                    {/* Action Button */}
                    <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRowClick(item);
                        }}
                        style={{
                          backgroundColor: '#1e293b',
                          color: '#38bdf8',
                          border: '1px solid #38bdf8',
                          borderRadius: '4px',
                          padding: '4px 10px',
                          fontSize: '11px',
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}
                      >
                        <BarChart2 size={12} />
                        <span>Chart</span>
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
export default TestingPatternContainer;
