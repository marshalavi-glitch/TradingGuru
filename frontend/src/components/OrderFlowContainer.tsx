import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Layers,
  Activity,
  CheckCircle2,
  Sliders,
  Sparkles,
  ShieldCheck,
  Zap,
  RefreshCw,
  AlertCircle,
  Clock,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { tvStreamer, getBackendHttpUrl } from '../utils/tvStreamer';
import type { Candle, DayProfile } from '../utils/profileCalculator';
import { calculateDayProfile } from '../utils/profileCalculator';
import {
  performOrderFlowAnalysis,
  OrderFlowAnalysisResult,
} from '../utils/orderFlowCalculator';
import { resolveSymbol, SymbolInfo } from '../utils/symbolResolver';
import { filterMarketHoursCandles, isWithinMarketHours } from '../utils/marketHours';

interface OrderFlowContainerProps {
  candles?: Candle[];
  currentSymbol?: string;
  onSymbolSelect?: (symbol: string) => void;
  onSwitchToChart?: () => void;
}

const POPULAR_SYMBOLS = [
  'NSE:NIFTY',
  'NSE:BANKNIFTY',
  'NSE:RELIANCE',
  'NSE:HDFCBANK',
  'NSE:ICICIBANK',
  'NSE:INFY',
  'NSE:TCS',
  'NSE:SBIN',
  'NSE:TATAMOTORS',
  'NSE:BHARTIARTL',
  'BSE:SENSEX',
];

type DataStatus = 'LOADING' | 'LIVE' | 'MARKET_CLOSED' | 'ERROR' | 'UNAVAILABLE';

export const OrderFlowContainer: React.FC<OrderFlowContainerProps> = ({
  candles: propCandles,
  currentSymbol = 'NSE:NIFTY',
  onSymbolSelect,
  onSwitchToChart,
}) => {
  // Master Single Source of Truth Symbol & Timeframe State
  const [selectedSymbol, setSelectedSymbol] = useState<string>(currentSymbol);
  const [customSymbolInput, setCustomSymbolInput] = useState<string>('');
  const [timeframe, setTimeframe] = useState<'5' | '15' | '75' | 'D'>('5');

  // Authoritative Symbol Info
  const symbolInfo: SymbolInfo = useMemo(() => {
    return resolveSymbol(selectedSymbol);
  }, [selectedSymbol]);

  // Data Pipeline State - Strictly Keyed by Symbol
  const [candles, setCandles] = useState<Candle[]>([]);
  const [dataStatus, setDataStatus] = useState<DataStatus>('LOADING');
  const [lastUpdateTime, setLastUpdateTime] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Sync state if currentSymbol prop changes from parent
  useEffect(() => {
    if (currentSymbol && currentSymbol !== selectedSymbol) {
      const resolved = resolveSymbol(currentSymbol);
      setSelectedSymbol(resolved.formattedSymbol);
    }
  }, [currentSymbol]);

  // Primary Data Pipeline: Fetch fresh historical & live candles whenever symbol or timeframe changes
  useEffect(() => {
    let isMounted = true;
    const targetSymbol = symbolInfo.formattedSymbol;

    // STEP 1: Strict Invalidation - Clear all prior symbol data
    setCandles([]);
    setDataStatus('LOADING');
    setErrorMessage(null);
    setLastUpdateTime(null);

    console.log(`[Lucky Flow Audit Log] Switching to Symbol: ${targetSymbol} | Timeframe: ${timeframe}`);

    // STEP 2: Fetch fresh OHLCV candles via REST API
    const fetchCandles = async () => {
      try {
        const backendHttp = await getBackendHttpUrl();
        const url = `${backendHttp}/api/candles?symbol=${encodeURIComponent(targetSymbol)}&timeframe=${timeframe}&limit=500`;
        const res = await fetch(url);
        
        if (!isMounted) return;

        if (!res.ok) {
          throw new Error(`Server returned HTTP ${res.status}`);
        }

        const data = await res.json();
        
        if (!isMounted) return;

        // DATA VALIDATION: Verify returned symbol matches requested targetSymbol
        if (data.symbol && data.symbol.toUpperCase() !== targetSymbol.toUpperCase()) {
          console.warn(`[Lucky Flow Audit Log] REJECTED mismatched data payload! Expected: ${targetSymbol}, Received: ${data.symbol}`);
          return;
        }

        if (data.candles && data.candles.length > 0) {
          // Sort candles chronologically and filter strictly by official exchange market hours
          const filtered = filterMarketHoursCandles(data.candles, targetSymbol, timeframe);
          const validCandles: Candle[] = filtered.sort((a: Candle, b: Candle) => a.time - b.time);
          setCandles(validCandles);

          const now = new Date();
          const timeStr = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
          setLastUpdateTime(timeStr);

          // Determine market status based on timestamp of latest candle
          if (validCandles.length > 0) {
            const latestTime = validCandles[validCandles.length - 1].time * 1000;
            const isStale = (Date.now() - latestTime) > 24 * 3600 * 1000; // > 24h
            setDataStatus(isStale ? 'MARKET_CLOSED' : 'LIVE');

            const latestClose = validCandles[validCandles.length - 1].close;
            console.log(`[Lucky Flow Audit Log] Successfully loaded ${validCandles.length} candles for ${targetSymbol}. Live Price: ₹${latestClose}`);
          }
        } else {
          setDataStatus('UNAVAILABLE');
          setErrorMessage(`No candle data returned from market data provider for ${targetSymbol}`);
        }
      } catch (err: any) {
        if (!isMounted) return;
        console.error(`[Lucky Flow Audit Log] Failed to fetch candles for ${targetSymbol}:`, err);
        
        // If propCandles provided as fallback matching symbol
        if (propCandles && propCandles.length > 0) {
          setCandles(filterMarketHoursCandles(propCandles, targetSymbol, timeframe));
          setDataStatus('LIVE');
        } else {
          setDataStatus('ERROR');
          setErrorMessage(err.message || `Failed to connect to market data provider for ${targetSymbol}`);
        }
      }
    };

    fetchCandles();

    // STEP 3: Subscribe to live streaming updates via tvStreamer WebSocket
    const unsubscribe = tvStreamer.subscribe(
      targetSymbol,
      timeframe,
      (payload) => {
        if (!isMounted) return;

        // DATA VALIDATION: Verify payload matches selected symbol
        if (payload.symbol && payload.symbol.toUpperCase() !== targetSymbol.toUpperCase()) {
          return; // Ignore updates for previous symbols
        }

        if (payload.candles && payload.candles.length > 0) {
          setCandles((prevCandles) => {
            if (payload.isSnapshot) {
              const filtered = filterMarketHoursCandles(payload.candles, targetSymbol, timeframe);
              return filtered.sort((a, b) => a.time - b.time);
            } else {
              const tick = payload.candles[0];
              if (!isWithinMarketHours(tick.time, targetSymbol, timeframe)) {
                return prevCandles; // Drop ticks outside market hours
              }
              const index = prevCandles.findIndex((c) => c.time === tick.time);
              if (index !== -1) {
                const updated = [...prevCandles];
                updated[index] = tick;
                return updated;
              } else {
                return [...prevCandles, tick];
              }
            }
          });

          const now = new Date();
          setLastUpdateTime(now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
          setDataStatus('LIVE');
        }
      },
      (err) => {
        console.warn(`[Lucky Flow Audit Log] WebSocket streaming note for ${targetSymbol}:`, err);
      }
    );

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [symbolInfo.formattedSymbol, timeframe]);

  // Interactive Level Toggles
  const [showPoc, setShowPoc] = useState<boolean>(true);
  const [showVpoc, setShowVpoc] = useState<boolean>(true);
  const [showVahVal, setShowVahVal] = useState<boolean>(true);
  const [showBalance, setShowBalance] = useState<boolean>(true);
  const [showHvnLvn, setShowHvnLvn] = useState<boolean>(true);
  const [showConfluenceZone, setShowConfluenceZone] = useState<boolean>(true);

  // Authoritative Market Profile Calculation
  const dayProfile: DayProfile | null = useMemo(() => {
    if (!candles || candles.length === 0) return null;
    try {
      const todayStr = new Date().toISOString().split('T')[0];
      return calculateDayProfile(
        todayStr,
        candles,
        40,
        'daily',
        undefined,
        undefined,
        symbolInfo.formattedSymbol
      );
    } catch (err) {
      console.error('[Lucky Flow Audit Log] Error in calculateDayProfile:', err);
      return null;
    }
  }, [candles, symbolInfo.formattedSymbol]);

  // Authoritative Order Flow & Market Profile Analysis
  const analysis: OrderFlowAnalysisResult | null = useMemo(() => {
    if (!candles || candles.length === 0) return null;
    try {
      const tfLabel = timeframe === 'D' ? '1d' : `${timeframe}m`;
      const res = performOrderFlowAnalysis(candles, dayProfile, symbolInfo.formattedSymbol, tfLabel);
      
      console.log(`[Lucky Flow Diagnostic Log] Symbol: ${symbolInfo.formattedSymbol} | Price: ₹${res.livePrice} | POC: ₹${res.pocVpoc.pocPrice} | VPOC: ₹${res.pocVpoc.vpocPrice} | VAH: ₹${res.balance.balanceHigh} | VAL: ₹${res.balance.balanceLow} | Score: ${res.confluenceScore}`);
      return res;
    } catch (err) {
      console.error('[Lucky Flow Audit Log] Error in performOrderFlowAnalysis:', err);
      return null;
    }
  }, [candles, dayProfile, symbolInfo.formattedSymbol, timeframe]);

  // Master Symbol Selection Handler
  const handleSymbolChange = (newSymbolInput: string) => {
    const resolved = resolveSymbol(newSymbolInput);
    setSelectedSymbol(resolved.formattedSymbol);
    if (onSymbolSelect) {
      onSymbolSelect(resolved.formattedSymbol);
    }
  };

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customSymbolInput.trim()) return;
    handleSymbolChange(customSymbolInput.trim());
    setCustomSymbolInput('');
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        padding: '16px',
        color: 'var(--text-primary)',
        minHeight: '100%',
        boxSizing: 'border-box',
      }}
    >
      {/* Header & Controls Panel */}
      <div
        className="glass-panel"
        style={{
          padding: '16px 20px',
          borderRadius: '12px',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px',
          border: '1px solid var(--border-color)',
          background: 'rgba(15, 23, 42, 0.65)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            style={{
              padding: '8px',
              borderRadius: '8px',
              background: 'rgba(16, 185, 129, 0.15)',
              color: '#10b981',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Zap size={24} />
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '800', color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '8px' }}>
              🍀 Lucky Flow Analysis
            </h2>
            <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-secondary)' }}>
              Live Order Flow & Market Profile Engine • Instrument: <strong>{symbolInfo.formattedSymbol}</strong>
            </p>
          </div>
        </div>

        {/* Symbol Selector & Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            <select
              value={selectedSymbol}
              onChange={(e) => handleSymbolChange(e.target.value)}
              style={{
                background: 'rgba(30, 41, 59, 0.9)',
                border: '1px solid var(--border-color)',
                color: '#f8fafc',
                padding: '6px 12px',
                borderRadius: '6px',
                fontSize: '13px',
                fontWeight: '700',
                outline: 'none',
                cursor: 'pointer',
              }}
            >
              {POPULAR_SYMBOLS.map((sym) => {
                const sInfo = resolveSymbol(sym);
                return (
                  <option key={sym} value={sym}>
                    {sInfo.displayName} ({sInfo.exchange})
                  </option>
                );
              })}
            </select>
          </div>

          <form onSubmit={handleCustomSubmit} style={{ display: 'flex', gap: '6px' }}>
            <input
              type="text"
              placeholder="Search Stock (e.g. RELIANCE)"
              value={customSymbolInput}
              onChange={(e) => setCustomSymbolInput(e.target.value)}
              style={{
                background: 'rgba(30, 41, 59, 0.9)',
                border: '1px solid var(--border-color)',
                color: '#f8fafc',
                padding: '6px 10px',
                borderRadius: '6px',
                fontSize: '13px',
                outline: 'none',
                width: '180px',
              }}
            />
            <button
              type="submit"
              style={{
                background: 'var(--accent-blue)',
                border: 'none',
                color: '#fff',
                padding: '6px 12px',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: '600',
                cursor: 'pointer',
              }}
            >
              Go
            </button>
          </form>

          {/* Timeframe Selector */}
          <div
            style={{
              display: 'flex',
              background: 'rgba(30, 41, 59, 0.8)',
              borderRadius: '6px',
              padding: '2px',
              border: '1px solid var(--border-color)',
            }}
          >
            {(['5', '15', '75', 'D'] as const).map((tf) => (
              <button
                key={tf}
                onClick={() => setTimeframe(tf)}
                style={{
                  background: timeframe === tf ? 'var(--accent-blue)' : 'transparent',
                  color: timeframe === tf ? '#ffffff' : 'var(--text-secondary)',
                  border: 'none',
                  padding: '4px 10px',
                  borderRadius: '4px',
                  fontSize: '12px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
              >
                {tf === 'D' ? '1D' : `${tf}M`}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Level Toggles Bar */}
      <div
        className="glass-panel"
        style={{
          padding: '10px 16px',
          borderRadius: '8px',
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
          flexWrap: 'wrap',
          fontSize: '12px',
          background: 'rgba(15, 23, 42, 0.5)',
          border: '1px solid var(--border-color)',
        }}
      >
        <span style={{ fontWeight: '700', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '4px' }}>
          <Sliders size={14} /> LEVEL TOGGLES:
        </span>
        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
          <input type="checkbox" checked={showPoc} onChange={(e) => setShowPoc(e.target.checked)} />
          <span style={{ color: '#ef4444', fontWeight: '600' }}>TPO POC</span>
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
          <input type="checkbox" checked={showVpoc} onChange={(e) => setShowVpoc(e.target.checked)} />
          <span style={{ color: '#a855f7', fontWeight: '600' }}>Volume VPOC</span>
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
          <input type="checkbox" checked={showVahVal} onChange={(e) => setShowVahVal(e.target.checked)} />
          <span style={{ color: '#3b82f6', fontWeight: '600' }}>VAH / VAL</span>
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
          <input type="checkbox" checked={showBalance} onChange={(e) => setShowBalance(e.target.checked)} />
          <span style={{ color: '#f59e0b', fontWeight: '600' }}>Balance High/Low</span>
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
          <input type="checkbox" checked={showHvnLvn} onChange={(e) => setShowHvnLvn(e.target.checked)} />
          <span style={{ color: '#10b981', fontWeight: '600' }}>HVN / LVN</span>
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
          <input type="checkbox" checked={showConfluenceZone} onChange={(e) => setShowConfluenceZone(e.target.checked)} />
          <span style={{ color: '#ec4899', fontWeight: '600' }}>POC/VPOC Confluence Zone</span>
        </label>
      </div>

      {/* Loading / Error / Data Unavailable States */}
      {dataStatus === 'LOADING' || !analysis ? (
        <div
          className="glass-panel"
          style={{
            padding: '60px',
            textAlign: 'center',
            borderRadius: '12px',
            color: 'var(--text-secondary)',
            background: 'rgba(15, 23, 42, 0.7)',
            border: '1px solid var(--border-color)',
          }}
        >
          <Activity className="animate-spin" size={36} style={{ marginBottom: '16px', color: 'var(--accent-blue)' }} />
          <h3 style={{ margin: '0 0 8px 0', fontSize: '18px', color: '#f8fafc' }}>
            Loading live data for {symbolInfo.displayName} ({symbolInfo.formattedSymbol})...
          </h3>
          <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)' }}>
            Fetching authentic OHLCV candles and calculating Market Profile & Order Flow metrics...
          </p>
        </div>
      ) : dataStatus === 'UNAVAILABLE' || dataStatus === 'ERROR' ? (
        <div
          className="glass-panel"
          style={{
            padding: '40px',
            textAlign: 'center',
            borderRadius: '12px',
            color: '#ef4444',
            background: 'rgba(239, 68, 68, 0.05)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
          }}
        >
          <AlertCircle size={36} style={{ marginBottom: '12px' }} />
          <h3 style={{ margin: '0 0 8px 0', fontSize: '18px' }}>REAL-TIME DATA UNAVAILABLE</h3>
          <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)' }}>
            {errorMessage || `Unable to retrieve live market data for ${symbolInfo.formattedSymbol} from Angel One feed.`}
          </p>
          <button
            onClick={() => handleSymbolChange(selectedSymbol)}
            style={{
              marginTop: '16px',
              background: 'var(--accent-blue)',
              border: 'none',
              color: '#fff',
              padding: '8px 16px',
              borderRadius: '6px',
              fontSize: '13px',
              fontWeight: '600',
              cursor: 'pointer',
            }}
          >
            Retry Data Connection
          </button>
        </div>
      ) : (
        <>
          {/* Top Grid: Market Structure Summary & "Why This Bias?" Panel */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
              gap: '16px',
            }}
          >
            {/* Market Structure Summary & Confluence Score */}
            <div
              className="glass-panel"
              style={{
                padding: '20px',
                borderRadius: '12px',
                background: 'rgba(15, 23, 42, 0.7)',
                border: '1px solid var(--border-color)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  right: 0,
                  width: '120px',
                  height: '120px',
                  background: `radial-gradient(circle, ${analysis.bracketColor}25 0%, transparent 70%)`,
                  pointerEvents: 'none',
                }}
              />

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#94a3b8', fontWeight: '700' }}>
                    LUCKY FLOW MARKET STRUCTURE SUMMARY
                  </span>

                  {/* Authentic Data Status & Last Update Time */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontWeight: '600' }}>
                    {dataStatus === 'LIVE' ? (
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#10b981', background: 'rgba(16, 185, 129, 0.15)', padding: '2px 8px', borderRadius: '4px' }}>
                        <Wifi size={12} /> LIVE
                      </span>
                    ) : (
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#f59e0b', background: 'rgba(245, 158, 11, 0.15)', padding: '2px 8px', borderRadius: '4px' }}>
                        <Clock size={12} /> MARKET CLOSED
                      </span>
                    )}
                    {lastUpdateTime && (
                      <span style={{ color: '#64748b' }}>Updated: {lastUpdateTime}</span>
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', marginTop: '10px' }}>
                  <span style={{ fontSize: '26px', fontWeight: '800', color: '#f8fafc' }}>
                    {symbolInfo.displayName}
                  </span>
                  <span style={{ fontSize: '22px', fontWeight: '800', color: '#38bdf8' }}>
                    ₹{analysis.livePrice.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              <div
                style={{
                  margin: '16px 0',
                  padding: '16px',
                  borderRadius: '10px',
                  background: 'rgba(30, 41, 59, 0.8)',
                  border: `1px solid ${analysis.bracketColor}40`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div>
                  <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: '600' }}>SETUP CLASSIFICATION</div>
                  <div style={{ fontSize: '18px', fontWeight: '800', color: analysis.bracketColor, marginTop: '2px' }}>
                    {analysis.setupBracket}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                    Structural Bias: <strong style={{ color: analysis.bias === 'BULLISH' ? '#10b981' : analysis.bias === 'BEARISH' ? '#ef4444' : '#f59e0b' }}>{analysis.bias}</strong>
                  </div>
                </div>

                {/* Score Circular Badge */}
                <div
                  style={{
                    width: '64px',
                    height: '64px',
                    borderRadius: '50%',
                    background: `conic-gradient(${analysis.bracketColor} ${analysis.confluenceScore * 3.6}deg, rgba(255,255,255,0.05) 0deg)`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    position: 'relative',
                  }}
                >
                  <div
                    style={{
                      width: '52px',
                      height: '52px',
                      borderRadius: '50%',
                      background: '#0f172a',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexDirection: 'column',
                    }}
                  >
                    <span style={{ fontSize: '16px', fontWeight: '800', color: '#f8fafc', lineHeight: '1' }}>
                      {analysis.confluenceScore}
                    </span>
                    <span style={{ fontSize: '9px', color: '#94a3b8' }}>/100</span>
                  </div>
                </div>
              </div>

              {/* Bracket Legend */}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#64748b' }}>
                <span>0-30: NO TRADE</span>
                <span>31-50: WATCH</span>
                <span>51-70: DEV</span>
                <span>71-85: VALID</span>
                <span>86-100: HIGH</span>
              </div>
            </div>

            {/* "WHY THIS BIAS?" Rationale Panel */}
            <div
              className="glass-panel"
              style={{
                padding: '20px',
                borderRadius: '12px',
                background: 'rgba(15, 23, 42, 0.7)',
                border: '1px solid var(--border-color)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                <Sparkles size={18} color="#38bdf8" />
                <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '700', color: '#f8fafc' }}>
                  WHY THIS BIAS? (DATA-BACKED REASONS FOR {symbolInfo.displayName})
                </h3>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {analysis.whyThisBias.map((reason, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '8px',
                      fontSize: '12px',
                      color: '#cbd5e1',
                      lineHeight: '1.4',
                      padding: '6px 8px',
                      background: 'rgba(30, 41, 59, 0.4)',
                      borderRadius: '6px',
                    }}
                  >
                    <CheckCircle2 size={15} color="#38bdf8" style={{ flexShrink: 0, marginTop: '2px' }} />
                    <span>{reason}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Interactive Chart Preview & Level Profile Visualizer */}
          <div
            className="glass-panel"
            style={{
              padding: '16px',
              borderRadius: '12px',
              background: 'rgba(15, 23, 42, 0.7)',
              border: '1px solid var(--border-color)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <div style={{ fontSize: '14px', fontWeight: '700', color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Layers size={16} color="var(--accent-blue)" />
                Interactive Lucky Flow & Volume Profile Levels Chart ({symbolInfo.displayName})
              </div>
              {onSwitchToChart && (
                <button
                  onClick={onSwitchToChart}
                  style={{
                    background: 'rgba(59, 130, 246, 0.15)',
                    border: '1px solid var(--accent-blue)',
                    color: '#60a5fa',
                    padding: '4px 10px',
                    borderRadius: '6px',
                    fontSize: '12px',
                    fontWeight: '600',
                    cursor: 'pointer',
                  }}
                >
                  View Main Live Chart ↗
                </button>
              )}
            </div>

            {/* Profile Level Overview Grid */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                gap: '10px',
                marginBottom: '16px',
              }}
            >
              {showPoc && (
                <div style={{ padding: '8px 12px', borderRadius: '6px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
                  <div style={{ fontSize: '10px', color: '#ef4444', fontWeight: '700' }}>TPO POC</div>
                  <div style={{ fontSize: '15px', fontWeight: '800', color: '#f8fafc' }}>₹{analysis.pocVpoc.pocPrice.toFixed(2)}</div>
                </div>
              )}

              {showVpoc && (
                <div style={{ padding: '8px 12px', borderRadius: '6px', background: 'rgba(168, 85, 247, 0.1)', border: '1px solid rgba(168, 85, 247, 0.3)' }}>
                  <div style={{ fontSize: '10px', color: '#a855f7', fontWeight: '700' }}>Volume VPOC</div>
                  <div style={{ fontSize: '15px', fontWeight: '800', color: '#f8fafc' }}>₹{analysis.pocVpoc.vpocPrice.toFixed(2)}</div>
                </div>
              )}

              {showVahVal && (
                <>
                  <div style={{ padding: '8px 12px', borderRadius: '6px', background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.3)' }}>
                    <div style={{ fontSize: '10px', color: '#60a5fa', fontWeight: '700' }}>VAH (Value High)</div>
                    <div style={{ fontSize: '15px', fontWeight: '800', color: '#f8fafc' }}>₹{analysis.balance.balanceHigh.toFixed(2)}</div>
                  </div>
                  <div style={{ padding: '8px 12px', borderRadius: '6px', background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.3)' }}>
                    <div style={{ fontSize: '10px', color: '#60a5fa', fontWeight: '700' }}>VAL (Value Low)</div>
                    <div style={{ fontSize: '15px', fontWeight: '800', color: '#f8fafc' }}>₹{analysis.balance.balanceLow.toFixed(2)}</div>
                  </div>
                </>
              )}

              {showHvnLvn && (
                <div style={{ padding: '8px 12px', borderRadius: '6px', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
                  <div style={{ fontSize: '10px', color: '#10b981', fontWeight: '700' }}>Major HVN</div>
                  <div style={{ fontSize: '15px', fontWeight: '800', color: '#f8fafc' }}>₹{analysis.volumeDist.majorHvn.toFixed(2)}</div>
                </div>
              )}

              {showConfluenceZone && analysis.pocVpoc.isConfluenceZone && (
                <div style={{ padding: '8px 12px', borderRadius: '6px', background: 'rgba(236, 72, 153, 0.15)', border: '1px solid rgba(236, 72, 153, 0.5)', gridColumn: 'span 2' }}>
                  <div style={{ fontSize: '10px', color: '#ec4899', fontWeight: '800' }}>🔥 POC/VPOC CONFLUENCE ZONE</div>
                  <div style={{ fontSize: '14px', fontWeight: '800', color: '#f8fafc' }}>
                    ₹{analysis.pocVpoc.confluenceZone?.min.toFixed(2)} - ₹{analysis.pocVpoc.confluenceZone?.max.toFixed(2)}
                  </div>
                </div>
              )}
            </div>

            {/* Volume Histogram Profile Canvas / Visualizer Bar */}
            <div style={{ height: '140px', background: '#090d16', borderRadius: '8px', padding: '10px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', border: '1px solid rgba(255,255,255,0.05)' }}>
              <div style={{ fontSize: '11px', color: '#94a3b8', display: 'flex', justifyContent: 'space-between' }}>
                <span>{symbolInfo.displayName} Volume Profile Distribution</span>
                <span>Total Volume: {analysis.volumeProfile.totalVolume.toLocaleString()}</span>
              </div>

              {/* Bins Volume Bar Representation */}
              <div style={{ display: 'flex', alignItems: 'flex-end', height: '80px', gap: '2px', overflowX: 'hidden' }}>
                {analysis.volumeProfile.bins.slice(-60).map((bin, idx) => {
                  const maxVol = Math.max(...analysis.volumeProfile.bins.map((b) => b.volume)) || 1;
                  const heightPct = (bin.volume / maxVol) * 100;
                  const isPoc = bin.price === analysis.pocVpoc.pocPrice;
                  const isVpoc = bin.price === analysis.pocVpoc.vpocPrice;

                  return (
                    <div
                      key={idx}
                      title={`Price: ₹${bin.price} | Vol: ${Math.round(bin.volume)}`}
                      style={{
                        flex: 1,
                        height: `${Math.max(4, heightPct)}%`,
                        background: isPoc ? '#ef4444' : isVpoc ? '#a855f7' : bin.price >= analysis.balance.balanceLow && bin.price <= analysis.balance.balanceHigh ? 'rgba(59, 130, 246, 0.6)' : 'rgba(148, 163, 184, 0.25)',
                        borderRadius: '1px',
                        transition: 'height 0.2s',
                      }}
                    />
                  );
                })}
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#64748b' }}>
                <span>VAL: ₹{analysis.balance.balanceLow.toFixed(2)}</span>
                <span style={{ color: '#ef4444', fontWeight: '700' }}>POC: ₹{analysis.pocVpoc.pocPrice.toFixed(2)}</span>
                <span style={{ color: '#a855f7', fontWeight: '700' }}>VPOC: ₹{analysis.pocVpoc.vpocPrice.toFixed(2)}</span>
                <span>VAH: ₹{analysis.balance.balanceHigh.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* 7-Step Sequence Analysis Checklist Grid */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <h3 style={{ margin: '8px 0 0 0', fontSize: '15px', fontWeight: '700', color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ShieldCheck size={18} color="#10b981" />
              LUCKY FLOW CHECKLIST SEQUENCE FOR {symbolInfo.displayName} (STEPS 1–7)
            </h3>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
                gap: '14px',
              }}
            >
              {/* STEP 1: TREND */}
              <div className="glass-panel" style={{ padding: '16px', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontSize: '11px', fontWeight: '800', color: '#38bdf8' }}>STEP 1 • SEE THE TREND</span>
                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: '700',
                      padding: '2px 8px',
                      borderRadius: '4px',
                      background: analysis.trend.overallTrend.includes('Bullish') ? 'rgba(16, 185, 129, 0.15)' : analysis.trend.overallTrend.includes('Bearish') ? 'rgba(239, 68, 68, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                      color: analysis.trend.overallTrend.includes('Bullish') ? '#10b981' : analysis.trend.overallTrend.includes('Bearish') ? '#ef4444' : '#f59e0b',
                    }}
                  >
                    {analysis.trend.overallTrend}
                  </span>
                </div>
                <div style={{ fontSize: '13px', fontWeight: '600', color: '#f8fafc' }}>
                  {analysis.trend.priceVsEma}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                  20 EMA: ₹{analysis.trend.ema20} | 50 EMA: ₹{analysis.trend.ema50}
                </div>
              </div>

              {/* STEP 2: BALANCED AREA */}
              <div className="glass-panel" style={{ padding: '16px', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontSize: '11px', fontWeight: '800', color: '#38bdf8' }}>STEP 2 • BALANCED AREA</span>
                  <span style={{ fontSize: '11px', fontWeight: '700', color: '#f59e0b' }}>
                    {analysis.balance.status}
                  </span>
                </div>
                <div style={{ fontSize: '12px', color: '#cbd5e1', lineHeight: '1.4' }}>
                  {analysis.balance.interpretation}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '6px' }}>
                  Bracket High: ₹{analysis.balance.balanceHigh} | Low: ₹{analysis.balance.balanceLow}
                </div>
              </div>

              {/* STEP 3: CVA DELTA */}
              <div className="glass-panel" style={{ padding: '16px', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontSize: '11px', fontWeight: '800', color: '#38bdf8' }}>STEP 3 • CHECK CVA</span>
                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: '700',
                      padding: '2px 8px',
                      borderRadius: '4px',
                      background: analysis.cva.status.includes('Bullish') ? 'rgba(16, 185, 129, 0.15)' : analysis.cva.status.includes('Bearish') ? 'rgba(239, 68, 68, 0.15)' : 'rgba(148, 163, 184, 0.15)',
                      color: analysis.cva.status.includes('Bullish') ? '#10b981' : analysis.cva.status.includes('Bearish') ? '#ef4444' : '#94a3b8',
                    }}
                  >
                    {analysis.cva.status}
                  </span>
                </div>
                <div style={{ fontSize: '12px', color: '#cbd5e1', lineHeight: '1.4' }}>
                  {analysis.cva.interpretation}
                </div>
                {analysis.cva.status !== 'CVA DATA UNAVAILABLE' && (
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                    Buy Ratio: {(analysis.cva.deltaRatio * 100).toFixed(1)}% | Cum Delta: {analysis.cva.cumDelta > 0 ? '+' : ''}{analysis.cva.cumDelta.toLocaleString()}
                  </div>
                )}
              </div>

              {/* STEP 4: VALUE ACCEPTANCE */}
              <div className="glass-panel" style={{ padding: '16px', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontSize: '11px', fontWeight: '800', color: '#38bdf8' }}>STEP 4 • VALUE ACCEPTANCE</span>
                  <span style={{ fontSize: '11px', fontWeight: '700', color: '#60a5fa' }}>
                    {analysis.valueAcceptance.status}
                  </span>
                </div>
                <div style={{ fontSize: '12px', color: '#cbd5e1', lineHeight: '1.4' }}>
                  {analysis.valueAcceptance.interpretation}
                </div>
              </div>

              {/* STEP 5: POC IMBALANCE */}
              <div className="glass-panel" style={{ padding: '16px', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontSize: '11px', fontWeight: '800', color: '#38bdf8' }}>STEP 5 • POC IMBALANCE</span>
                  <span style={{ fontSize: '11px', fontWeight: '700', color: '#a855f7' }}>
                    {analysis.pocImbalance.position}
                  </span>
                </div>
                <div style={{ fontSize: '12px', color: '#cbd5e1', lineHeight: '1.4' }}>
                  {analysis.pocImbalance.interpretation}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                  Value Area Height Pos: {(analysis.pocImbalance.valPct * 100).toFixed(0)}%
                </div>
              </div>

              {/* STEP 6: POC & VPOC CONFLUENCE */}
              <div
                className="glass-panel"
                style={{
                  padding: '16px',
                  borderRadius: '10px',
                  border: analysis.pocVpoc.isConfluenceZone ? '1px solid rgba(236, 72, 153, 0.6)' : '1px solid var(--border-color)',
                  background: analysis.pocVpoc.isConfluenceZone ? 'rgba(236, 72, 153, 0.08)' : undefined,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontSize: '11px', fontWeight: '800', color: '#38bdf8' }}>STEP 6 • POC & VPOC</span>
                  <span style={{ fontSize: '11px', fontWeight: '800', color: analysis.pocVpoc.isConfluenceZone ? '#ec4899' : '#a855f7' }}>
                    {analysis.pocVpoc.classification} ({analysis.pocVpoc.distancePct.toFixed(2)}%)
                  </span>
                </div>
                <div style={{ fontSize: '12px', color: '#cbd5e1', lineHeight: '1.4' }}>
                  {analysis.pocVpoc.interpretation}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                  TPO POC: ₹{analysis.pocVpoc.pocPrice} | Volume VPOC: ₹{analysis.pocVpoc.vpocPrice}
                </div>
              </div>

              {/* STEP 7: MAJOR VOLUME DISTRIBUTION */}
              <div className="glass-panel" style={{ padding: '16px', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontSize: '11px', fontWeight: '800', color: '#38bdf8' }}>STEP 7 • VOLUME DISTRIBUTION</span>
                  <span style={{ fontSize: '11px', fontWeight: '700', color: '#10b981' }}>
                    HVN & LVN Nodes
                  </span>
                </div>
                <div style={{ fontSize: '12px', color: '#cbd5e1', lineHeight: '1.4' }}>
                  {analysis.volumeDist.interpretation}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                  Major HVN: ₹{analysis.volumeDist.majorHvn} | Major LVN: ₹{analysis.volumeDist.majorLvn}
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
