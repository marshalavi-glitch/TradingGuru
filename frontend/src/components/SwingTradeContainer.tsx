import React, { useState, useEffect, useMemo } from 'react';
import { 
  TrendingUp, TrendingDown, RefreshCw, Filter, Search, Zap, 
  ArrowUpRight, ArrowDownRight, Target, ShieldAlert, BarChart2, CheckCircle2, Sliders, Layers
} from 'lucide-react';
import { getBackendHttpUrl } from '../utils/tvStreamer';
import { SwingStockResult, analyzeSwingTrade } from '../utils/swingCalculator';
import { Candle } from '../utils/profileCalculator';

interface SwingTradeContainerProps {
  onSymbolSelect: (symbol: string) => void;
  onSwitchToChart: () => void;
}

export const SwingTradeContainer: React.FC<SwingTradeContainerProps> = ({
  onSymbolSelect,
  onSwitchToChart
}) => {
  const [timeframe, setTimeframe] = useState<'D' | 'W' | '60'>('D');
  const [filterBias, setFilterBias] = useState<'ALL' | 'BULLISH' | 'BEARISH' | 'GOLDEN_CROSS' | 'OVERSOLD' | 'OVERBOUGHT'>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [viewMode, setViewMode] = useState<'CARDS' | 'TABLE'>('CARDS');

  const [stocks, setStocks] = useState<SwingStockResult[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [lastScanTime, setLastScanTime] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Poll backend for swing trade signals
  const fetchSwingTrades = async (forceScan: boolean = false) => {
    setLoading(true);
    setError(null);
    try {
      const backendUrl = await getBackendHttpUrl();
      const res = await fetch(`${backendUrl}/api/swing-scanner?timeframe=${timeframe}${forceScan ? '&scan=true' : ''}`);
      if (res.ok) {
        const data = await res.json();
        setLastScanTime(data.lastScanTime);
        setIsScanning(data.isScanning || false);

        if (data.results && data.results.length > 0) {
          setStocks(data.results);
          setLoading(false);
          return;
        }
      }
    } catch (err) {
      console.warn('[Swing Scanner] Backend fetch error:', err);
    }

    // Fallback: Calculate live swing setups for default key watchlist symbols via REST candles API
    try {
      const fallbackSymbols = [
        { symbol: 'NSE:NIFTY', name: 'NIFTY 50 Index', category: 'Indices' },
        { symbol: 'NSE:BANKNIFTY', name: 'BANK NIFTY Index', category: 'Indices' },
        { symbol: 'NSE:RELIANCE', name: 'Reliance Industries', category: 'Energy' },
        { symbol: 'NSE:TCS', name: 'TCS', category: 'IT' },
        { symbol: 'NSE:HDFCBANK', name: 'HDFC Bank', category: 'Banking' },
        { symbol: 'NSE:ICICIBANK', name: 'ICICI Bank', category: 'Banking' },
        { symbol: 'NSE:INFY', name: 'Infosys', category: 'IT' },
        { symbol: 'NSE:BHARTIARTL', name: 'Bharti Airtel', category: 'Telecom' },
        { symbol: 'NSE:SBIN', name: 'State Bank of India', category: 'Banking' },
        { symbol: 'NSE:LT', name: 'Larsen & Toubro', category: 'Infra' },
        { symbol: 'NSE:TATAMOTORS', name: 'Tata Motors', category: 'Auto' },
        { symbol: 'NSE:SUNPHARMA', name: 'Sun Pharma', category: 'Pharma' }
      ];

      const backendUrl = await getBackendHttpUrl();
      const computedResults: SwingStockResult[] = [];

      for (const item of fallbackSymbols) {
        try {
          const cRes = await fetch(`${backendUrl}/api/candles?symbol=${encodeURIComponent(item.symbol)}&timeframe=${timeframe}&limit=100`);
          if (cRes.ok) {
            const cData = await cRes.json();
            if (cData.candles && cData.candles.length >= 35) {
              const res = analyzeSwingTrade(item.symbol, item.name, item.category, cData.candles, timeframe);
              if (res) computedResults.push(res);
            }
          }
        } catch (e) {}
      }

      computedResults.sort((a, b) => b.score - a.score);
      setStocks(computedResults);
    } catch (err: any) {
      setError('Failed to compute swing trade setups');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSwingTrades(false);
    const interval = setInterval(() => fetchSwingTrades(false), 15000);
    return () => clearInterval(interval);
  }, [timeframe]);

  // Categories list
  const categories = useMemo(() => {
    const set = new Set<string>();
    stocks.forEach(s => { if (s.category) set.add(s.category); });
    return ['ALL', ...Array.from(set).sort()];
  }, [stocks]);

  // Filtered stocks
  const filteredStocks = useMemo(() => {
    return stocks.filter(stock => {
      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchSym = stock.symbol.toLowerCase().includes(q);
        const matchName = stock.name.toLowerCase().includes(q);
        if (!matchSym && !matchName) return false;
      }

      // Category Filter
      if (categoryFilter !== 'ALL' && stock.category !== categoryFilter) {
        return false;
      }

      // Bias / Setup Filter
      if (filterBias === 'BULLISH') return stock.bias === 'BULLISH';
      if (filterBias === 'BEARISH') return stock.bias === 'BEARISH';
      if (filterBias === 'GOLDEN_CROSS') return stock.macd.crossover === 'GOLDEN_CROSS';
      if (filterBias === 'OVERSOLD') return stock.rsi.rsi <= 35 || stock.rsi.signal === 'OVERSOLD_BOUNCE';
      if (filterBias === 'OVERBOUGHT') return stock.rsi.rsi >= 65 || stock.rsi.signal === 'OVERBOUGHT_REVERSAL';

      return true;
    });
  }, [stocks, searchQuery, categoryFilter, filterBias]);

  // Key Summary Stats
  const summaryStats = useMemo(() => {
    const bullishCount = stocks.filter(s => s.bias === 'BULLISH').length;
    const bearishCount = stocks.filter(s => s.bias === 'BEARISH').length;
    const goldenCrossCount = stocks.filter(s => s.macd.crossover === 'GOLDEN_CROSS').length;
    const oversoldCount = stocks.filter(s => s.rsi.rsi <= 35).length;
    const avgRsi = stocks.length > 0 ? stocks.reduce((acc, s) => acc + s.rsi.rsi, 0) / stocks.length : 50;

    return {
      total: stocks.length,
      bullishCount,
      bearishCount,
      goldenCrossCount,
      oversoldCount,
      avgRsi: Math.round(avgRsi * 10) / 10
    };
  }, [stocks]);

  const handleStockClick = (sym: string) => {
    onSymbolSelect(sym);
    onSwitchToChart();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', width: '100%', padding: '16px', boxSizing: 'border-box', background: '#040d1a', color: '#e2e8f0', minHeight: '85vh', borderRadius: '10px' }}>
      
      {/* Top Header & Controls */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#0b192e', padding: '14px 18px', borderRadius: '8px', border: '1px solid #1e3a8a', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '20px', fontWeight: '900', color: '#ffffff', letterSpacing: '-0.3px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Zap color="#00f0ff" size={24} />
              MACD & RSI Swing Trade Screener
            </span>
            {isScanning && (
              <span style={{ fontSize: '10px', background: 'rgba(0, 240, 255, 0.15)', color: '#00f0ff', padding: '3px 8px', borderRadius: '12px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px', border: '1px solid rgba(0, 240, 255, 0.3)' }}>
                <RefreshCw size={10} className="animate-spin" /> SCANNING...
              </span>
            )}
          </div>
          <p style={{ fontSize: '12px', color: '#94a3b8', margin: '4px 0 0 0' }}>
            Multi-timeframe swing trading scanner analyzing MACD (12,26,9) crossovers & RSI (14) momentum zones for target risk-reward setups.
          </p>
        </div>

        {/* Action Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          
          {/* Timeframe selector */}
          <div style={{ display: 'flex', background: '#071326', borderRadius: '6px', border: '1px solid #1e3a8a', padding: '2px' }}>
            {(['D', 'W', '60'] as const).map(tf => (
              <button
                key={tf}
                onClick={() => setTimeframe(tf)}
                style={{
                  background: timeframe === tf ? '#1d4ed8' : 'transparent',
                  color: timeframe === tf ? '#ffffff' : '#94a3b8',
                  border: 'none',
                  padding: '5px 12px',
                  borderRadius: '4px',
                  fontSize: '11px',
                  fontWeight: '800',
                  cursor: 'pointer'
                }}
              >
                {tf === 'D' ? '1D (Daily)' : tf === 'W' ? '1W (Weekly)' : '1H (Hourly)'}
              </button>
            ))}
          </div>

          {/* View Mode Toggle */}
          <div style={{ display: 'flex', background: '#071326', borderRadius: '6px', border: '1px solid #1e3a8a', padding: '2px' }}>
            <button
              onClick={() => setViewMode('CARDS')}
              style={{
                background: viewMode === 'CARDS' ? '#1d4ed8' : 'transparent',
                color: viewMode === 'CARDS' ? '#ffffff' : '#94a3b8',
                border: 'none',
                padding: '5px 10px',
                borderRadius: '4px',
                fontSize: '11px',
                fontWeight: '800',
                cursor: 'pointer'
              }}
            >
              Cards
            </button>
            <button
              onClick={() => setViewMode('TABLE')}
              style={{
                background: viewMode === 'TABLE' ? '#1d4ed8' : 'transparent',
                color: viewMode === 'TABLE' ? '#ffffff' : '#94a3b8',
                border: 'none',
                padding: '5px 10px',
                borderRadius: '4px',
                fontSize: '11px',
                fontWeight: '800',
                cursor: 'pointer'
              }}
            >
              Table
            </button>
          </div>

          {/* Manual Refresh Button */}
          <button
            onClick={() => fetchSwingTrades(true)}
            disabled={loading}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: 'linear-gradient(135deg, #1d4ed8, #2563eb)',
              color: '#ffffff',
              border: 'none',
              padding: '6px 14px',
              borderRadius: '6px',
              fontSize: '11px',
              fontWeight: '800',
              cursor: loading ? 'not-allowed' : 'pointer'
            }}
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            SCAN NOW
          </button>

        </div>
      </div>

      {/* Metric Overview Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px' }}>
        
        <div style={{ background: '#0b192e', border: '1px solid #1e3a8a', padding: '12px 16px', borderRadius: '8px' }}>
          <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: '700' }}>TOTAL STOCKS EVALUATED</span>
          <div style={{ fontSize: '22px', fontWeight: '900', color: '#ffffff', marginTop: '2px' }}>{summaryStats.total}</div>
        </div>

        <div style={{ background: '#0b192e', border: '1px solid rgba(16, 185, 129, 0.4)', padding: '12px 16px', borderRadius: '8px' }}>
          <span style={{ fontSize: '11px', color: '#10b981', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <TrendingUp size={14} /> BULLISH SWINGS
          </span>
          <div style={{ fontSize: '22px', fontWeight: '900', color: '#10b981', marginTop: '2px' }}>{summaryStats.bullishCount}</div>
        </div>

        <div style={{ background: '#0b192e', border: '1px solid rgba(239, 68, 68, 0.4)', padding: '12px 16px', borderRadius: '8px' }}>
          <span style={{ fontSize: '11px', color: '#ef4444', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <TrendingDown size={14} /> BEARISH SWINGS
          </span>
          <div style={{ fontSize: '22px', fontWeight: '900', color: '#ef4444', marginTop: '2px' }}>{summaryStats.bearishCount}</div>
        </div>

        <div style={{ background: '#0b192e', border: '1px solid rgba(0, 240, 255, 0.4)', padding: '12px 16px', borderRadius: '8px' }}>
          <span style={{ fontSize: '11px', color: '#00f0ff', fontWeight: '700' }}>MACD GOLDEN CROSSES</span>
          <div style={{ fontSize: '22px', fontWeight: '900', color: '#00f0ff', marginTop: '2px' }}>{summaryStats.goldenCrossCount}</div>
        </div>

        <div style={{ background: '#0b192e', border: '1px solid rgba(245, 158, 11, 0.4)', padding: '12px 16px', borderRadius: '8px' }}>
          <span style={{ fontSize: '11px', color: '#f59e0b', fontWeight: '700' }}>AVG MARKET RSI (14)</span>
          <div style={{ fontSize: '22px', fontWeight: '900', color: '#f59e0b', marginTop: '2px' }}>{summaryStats.avgRsi}</div>
        </div>

      </div>

      {/* Filter Toolbar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#0b192e', padding: '10px 14px', borderRadius: '8px', border: '1px solid #1e3a8a', flexWrap: 'wrap', gap: '10px' }}>
        
        {/* Signal Type Filters */}
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {[
            { id: 'ALL', label: 'All Stocks' },
            { id: 'BULLISH', label: '🚀 Bullish (Buy)' },
            { id: 'BEARISH', label: '📉 Bearish (Sell)' },
            { id: 'GOLDEN_CROSS', label: '⚡ MACD Golden Cross' },
            { id: 'OVERSOLD', label: '🎯 RSI Oversold (<35)' },
            { id: 'OVERBOUGHT', label: '⚠️ RSI Overbought (>65)' }
          ].map(f => (
            <button
              key={f.id}
              onClick={() => setFilterBias(f.id as any)}
              style={{
                background: filterBias === f.id ? '#1d4ed8' : '#071326',
                color: filterBias === f.id ? '#ffffff' : '#94a3b8',
                border: '1px solid #1e3a8a',
                padding: '4px 10px',
                borderRadius: '4px',
                fontSize: '11px',
                fontWeight: '800',
                cursor: 'pointer'
              }}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Search & Category Filter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', background: '#071326', padding: '4px 8px', borderRadius: '4px', border: '1px solid #1e3a8a' }}>
            <Search size={14} color="#94a3b8" style={{ marginRight: '6px' }} />
            <input
              type="text"
              placeholder="Search stock..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ background: 'transparent', border: 'none', color: '#ffffff', fontSize: '11px', outline: 'none', width: '120px' }}
            />
          </div>

          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            style={{ background: '#071326', color: '#60a5fa', border: '1px solid #1e3a8a', padding: '4px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '800', outline: 'none', cursor: 'pointer' }}
          >
            {categories.map(cat => (
              <option key={cat} value={cat} style={{ background: '#0b192e', color: '#ffffff' }}>
                {cat === 'ALL' ? 'All Sectors' : cat}
              </option>
            ))}
          </select>
        </div>

      </div>

      {/* Main Content List / Cards */}
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '300px', gap: '12px' }}>
          <RefreshCw size={28} className="animate-spin" color="#00f0ff" />
          <span style={{ fontSize: '13px', color: '#94a3b8', fontWeight: '700' }}>Evaluating MACD & RSI Swing Trade Setups...</span>
        </div>
      ) : filteredStocks.length === 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '240px', background: '#0b192e', borderRadius: '8px', border: '1px dashed #1e3a8a' }}>
          <Sliders size={32} color="#60a5fa" />
          <span style={{ fontSize: '14px', color: '#e2e8f0', fontWeight: '800', marginTop: '8px' }}>No swing trade candidates matching active filter.</span>
          <span style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>Try switching filter chips or choosing 'All Stocks'.</span>
        </div>
      ) : viewMode === 'CARDS' ? (
        
        /* Cards View Layout */
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '14px' }}>
          {filteredStocks.map(stock => {
            const isBullish = stock.bias === 'BULLISH';
            const isBearish = stock.bias === 'BEARISH';

            const cardBorderColor = isBullish ? '#10b981' : isBearish ? '#ef4444' : '#1e3a8a';
            const cardGlow = isBullish ? 'rgba(16, 185, 129, 0.1)' : isBearish ? 'rgba(239, 68, 68, 0.1)' : 'transparent';

            return (
              <div
                key={stock.symbol}
                style={{
                  background: '#0b192e',
                  border: `1px solid ${cardBorderColor}`,
                  boxShadow: `0 4px 12px ${cardGlow}`,
                  borderRadius: '8px',
                  padding: '14px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                  transition: 'transform 0.15s ease'
                }}
              >
                {/* Card Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '15px', fontWeight: '900', color: '#ffffff' }}>
                        {stock.symbol.replace('NSE:', '').replace('BSE:', '')}
                      </span>
                      <span style={{ fontSize: '10px', background: '#071326', color: '#60a5fa', padding: '1px 6px', borderRadius: '3px', border: '1px solid #1e3a8a', fontWeight: '700' }}>
                        {stock.category}
                      </span>
                    </div>
                    <span style={{ fontSize: '11px', color: '#94a3b8' }}>{stock.name}</span>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '16px', fontWeight: '900', color: '#ffffff' }}>
                      ₹{stock.ltp.toFixed(2)}
                    </div>
                    <div style={{ fontSize: '11px', fontWeight: '800', color: stock.changePct >= 0 ? '#10b981' : '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '2px' }}>
                      {stock.changePct >= 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                      {stock.changePct >= 0 ? '+' : ''}{stock.changePct}%
                    </div>
                  </div>
                </div>

                {/* Signal Badge & Score Banner */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: isBullish ? 'rgba(16, 185, 129, 0.12)' : isBearish ? 'rgba(239, 68, 68, 0.12)' : '#071326', padding: '6px 10px', borderRadius: '6px', border: `1px solid ${isBullish ? 'rgba(16, 185, 129, 0.3)' : isBearish ? 'rgba(239, 68, 68, 0.3)' : '#1e3a8a'}` }}>
                  <span style={{ fontSize: '11px', fontWeight: '900', color: isBullish ? '#10b981' : isBearish ? '#ef4444' : '#94a3b8' }}>
                    {stock.signalTitle}
                  </span>
                  <span style={{ fontSize: '10px', fontWeight: '900', background: isBullish ? '#10b981' : isBearish ? '#ef4444' : '#60a5fa', color: '#000000', padding: '2px 6px', borderRadius: '3px' }}>
                    {stock.grade} ({stock.score}%)
                  </span>
                </div>

                {/* Setup Description */}
                <p style={{ fontSize: '11px', color: '#cbd5e1', margin: 0, lineHeight: '1.4' }}>
                  {stock.setupDescription}
                </p>

                {/* Indicator Metric Badges */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', background: '#071326', padding: '8px 10px', borderRadius: '6px', border: '1px solid #1e3a8a' }}>
                  
                  {/* MACD Info */}
                  <div>
                    <span style={{ fontSize: '9px', fontWeight: '800', color: '#94a3b8', display: 'block' }}>MACD (12,26,9)</span>
                    <span style={{ fontSize: '11px', fontWeight: '800', color: stock.macd.histogram >= 0 ? '#10b981' : '#ef4444' }}>
                      Hist: {stock.macd.histogram > 0 ? '+' : ''}{stock.macd.histogram}
                    </span>
                    <span style={{ fontSize: '9px', color: '#60a5fa', display: 'block' }}>
                      Line: {stock.macd.macdLine} / Sig: {stock.macd.signalLine}
                    </span>
                  </div>

                  {/* RSI Info */}
                  <div>
                    <span style={{ fontSize: '9px', fontWeight: '800', color: '#94a3b8', display: 'block' }}>RSI (14)</span>
                    <span style={{ fontSize: '12px', fontWeight: '900', color: stock.rsi.rsi <= 35 ? '#10b981' : stock.rsi.rsi >= 65 ? '#ef4444' : '#00f0ff' }}>
                      {stock.rsi.rsi}
                    </span>
                    
                    {/* RSI Bar */}
                    <div style={{ width: '100%', height: '4px', background: '#1e293b', borderRadius: '2px', marginTop: '4px', overflow: 'hidden' }}>
                      <div 
                        style={{ 
                          width: `${Math.min(100, Math.max(0, stock.rsi.rsi))}%`, 
                          height: '100%', 
                          background: stock.rsi.rsi <= 35 ? '#10b981' : stock.rsi.rsi >= 65 ? '#ef4444' : '#00f0ff' 
                        }} 
                      />
                    </div>
                  </div>

                </div>

                {/* Targets & Stop Loss */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '4px', textAlign: 'center', background: '#071326', padding: '6px', borderRadius: '6px', border: '1px solid #1e3a8a' }}>
                  <div>
                    <span style={{ fontSize: '9px', color: '#ef4444', fontWeight: '800', display: 'block' }}>STOP LOSS</span>
                    <span style={{ fontSize: '11px', fontWeight: '900', color: '#ffffff' }}>₹{stock.stopLoss}</span>
                  </div>
                  <div>
                    <span style={{ fontSize: '9px', color: '#10b981', fontWeight: '800', display: 'block' }}>TARGET 1</span>
                    <span style={{ fontSize: '11px', fontWeight: '900', color: '#ffffff' }}>₹{stock.target1}</span>
                  </div>
                  <div>
                    <span style={{ fontSize: '9px', color: '#00f0ff', fontWeight: '800', display: 'block' }}>TARGET 2</span>
                    <span style={{ fontSize: '11px', fontWeight: '900', color: '#ffffff' }}>₹{stock.target2}</span>
                  </div>
                </div>

                {/* Action Button */}
                <button
                  onClick={() => handleStockClick(stock.symbol)}
                  style={{
                    background: '#1d4ed8',
                    color: '#ffffff',
                    border: 'none',
                    padding: '7px 12px',
                    borderRadius: '5px',
                    fontSize: '11px',
                    fontWeight: '800',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    marginTop: '2px'
                  }}
                >
                  <BarChart2 size={14} /> VIEW CHART & MARKET PROFILE
                </button>

              </div>
            );
          })}
        </div>

      ) : (

        /* Table View Layout */
        <div style={{ overflowX: 'auto', background: '#0b192e', borderRadius: '8px', border: '1px solid #1e3a8a' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '11px' }}>
            <thead>
              <tr style={{ background: '#071326', borderBottom: '1px solid #1e3a8a', color: '#94a3b8' }}>
                <th style={{ padding: '10px 12px' }}>Symbol</th>
                <th style={{ padding: '10px 12px' }}>Price (LTP)</th>
                <th style={{ padding: '10px 12px' }}>Swing Signal</th>
                <th style={{ padding: '10px 12px' }}>Grade</th>
                <th style={{ padding: '10px 12px' }}>MACD Line / Hist</th>
                <th style={{ padding: '10px 12px' }}>RSI (14)</th>
                <th style={{ padding: '10px 12px' }}>Stop Loss</th>
                <th style={{ padding: '10px 12px' }}>Target 1</th>
                <th style={{ padding: '10px 12px' }}>Target 2</th>
                <th style={{ padding: '10px 12px' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredStocks.map(stock => {
                const isBullish = stock.bias === 'BULLISH';
                const isBearish = stock.bias === 'BEARISH';
                return (
                  <tr key={stock.symbol} style={{ borderBottom: '1px solid #1e3a8a' }}>
                    <td style={{ padding: '10px 12px' }}>
                      <div style={{ fontWeight: '900', color: '#ffffff' }}>{stock.symbol.replace('NSE:', '')}</div>
                      <div style={{ fontSize: '10px', color: '#94a3b8' }}>{stock.category}</div>
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <div style={{ fontWeight: '900', color: '#ffffff' }}>₹{stock.ltp.toFixed(2)}</div>
                      <div style={{ fontWeight: '800', color: stock.changePct >= 0 ? '#10b981' : '#ef4444' }}>
                        {stock.changePct >= 0 ? '+' : ''}{stock.changePct}%
                      </div>
                    </td>
                    <td style={{ padding: '10px 12px', fontWeight: '800', color: isBullish ? '#10b981' : isBearish ? '#ef4444' : '#94a3b8' }}>
                      {stock.signalTitle}
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <span style={{ background: isBullish ? 'rgba(16, 185, 129, 0.2)' : isBearish ? 'rgba(239, 68, 68, 0.2)' : '#071326', color: isBullish ? '#10b981' : isBearish ? '#ef4444' : '#60a5fa', padding: '2px 8px', borderRadius: '4px', fontWeight: '900', border: `1px solid ${isBullish ? '#10b981' : isBearish ? '#ef4444' : '#1e3a8a'}` }}>
                        {stock.grade} ({stock.score}%)
                      </span>
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <div style={{ color: stock.macd.histogram >= 0 ? '#10b981' : '#ef4444', fontWeight: '800' }}>
                        Hist: {stock.macd.histogram}
                      </div>
                      <div style={{ fontSize: '10px', color: '#94a3b8' }}>
                        Line: {stock.macd.macdLine}
                      </div>
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <div style={{ fontWeight: '900', color: stock.rsi.rsi <= 35 ? '#10b981' : stock.rsi.rsi >= 65 ? '#ef4444' : '#00f0ff' }}>
                        {stock.rsi.rsi}
                      </div>
                    </td>
                    <td style={{ padding: '10px 12px', color: '#ef4444', fontWeight: '800' }}>₹{stock.stopLoss}</td>
                    <td style={{ padding: '10px 12px', color: '#10b981', fontWeight: '800' }}>₹{stock.target1}</td>
                    <td style={{ padding: '10px 12px', color: '#00f0ff', fontWeight: '800' }}>₹{stock.target2}</td>
                    <td style={{ padding: '10px 12px' }}>
                      <button
                        onClick={() => handleStockClick(stock.symbol)}
                        style={{ background: '#1d4ed8', color: '#ffffff', border: 'none', padding: '4px 8px', borderRadius: '4px', fontWeight: '800', cursor: 'pointer' }}
                      >
                        CHART
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
  );
};
