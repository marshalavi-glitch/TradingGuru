import React, { useState, useEffect, useMemo } from 'react';
import {
  BarChart2,
  TrendingDown,
  TrendingUp,
  Activity,
  Zap,
  Filter,
  Search,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ShieldCheck,
  Compass,
} from 'lucide-react';
import { tvStreamer, getBackendHttpUrl } from '../utils/tvStreamer';
import type { Candle } from '../utils/profileCalculator';
import {
  calculateOrderFlowFootprintSignal,
  calculateAllOrderFlowSignals,
  OrderFlowStockSignal,
} from '../utils/orderFlowFootprintCalculator';

interface OrderFlowFootprintContainerProps {
  onSymbolSelect?: (symbol: string) => void;
  onSwitchToChart?: () => void;
}

const QUICK_SYMBOLS = ['NIFTY', 'BANKNIFTY', 'RELIANCE', 'TCS', 'HDFCBANK', 'ICICIBANK', 'INFY'];

export const OrderFlowFootprintContainer: React.FC<OrderFlowFootprintContainerProps> = ({
  onSymbolSelect,
  onSwitchToChart,
}) => {
  const [selectedSymbol, setSelectedSymbol] = useState<string>('NSE:NIFTY');
  const [selectedFilter, setSelectedFilter] = useState<'ALL' | 'ABSORPTION' | 'EXHAUSTION' | 'DIVERGENCE' | 'COT'>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [candlesMap, setCandlesMap] = useState<Record<string, Candle[]>>({});
  const [loading, setLoading] = useState<boolean>(false);

  // Fetch initial candles for quick F&O symbols
  useEffect(() => {
    let isMounted = true;
    const backendHttp = getBackendHttpUrl();

    const fetchAllCandles = async () => {
      setLoading(true);
      const newMap: Record<string, Candle[]> = {};

      const symbolsToFetch = [
        'NSE:NIFTY',
        'NSE:BANKNIFTY',
        'NSE:RELIANCE',
        'NSE:TCS',
        'NSE:HDFCBANK',
        'NSE:ICICIBANK',
        'NSE:INFY',
      ];

      for (const sym of symbolsToFetch) {
        try {
          const res = await fetch(`${backendHttp}/api/candles?symbol=${encodeURIComponent(sym)}&timeframe=5&limit=200`);
          if (res.ok) {
            const data = await res.json();
            if (data.candles && data.candles.length > 0) {
              newMap[sym] = data.candles;
            }
          }
        } catch (e) {
          // Fallback handled by calculation engine
        }
      }

      if (isMounted) {
        setCandlesMap(newMap);
        setLoading(false);
      }
    };

    fetchAllCandles();

    // Subscribe to selected symbol for real-time updates
    const unsubscribe = tvStreamer.subscribe(
      selectedSymbol,
      '5',
      (payload) => {
        if (!isMounted) return;
        if (payload.candles && payload.candles.length > 0) {
          setCandlesMap((prev) => ({
            ...prev,
            [payload.symbol]: payload.candles,
          }));
        }
      }
    );

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [selectedSymbol]);

  // Compute all signals across scanner list
  const allSignals = useMemo(() => {
    return calculateAllOrderFlowSignals(candlesMap);
  }, [candlesMap]);

  // Active highlighted stock signal for top cards & alert banner
  const activeSignal = useMemo(() => {
    const found = allSignals.find((s) => s.symbol === selectedSymbol);
    if (found) return found;
    return calculateOrderFlowFootprintSignal(candlesMap[selectedSymbol] || [], {
      symbol: selectedSymbol,
      name: selectedSymbol.replace('NSE:', '').replace('BSE:', ''),
      subtitle: `${selectedSymbol.replace('NSE:', '')} Futures`,
    });
  }, [allSignals, selectedSymbol, candlesMap]);

  // Filtered signals for table
  const filteredSignals = useMemo(() => {
    return allSignals.filter((item) => {
      const matchFilter = selectedFilter === 'ALL' || item.signalCategory === selectedFilter;
      const matchSearch =
        !searchQuery.trim() ||
        item.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.symbol.toLowerCase().includes(searchQuery.toLowerCase());
      return matchFilter && matchSearch;
    });
  }, [allSignals, selectedFilter, searchQuery]);

  const handleInspectSymbol = (sym: string) => {
    setSelectedSymbol(sym);
    if (onSymbolSelect) onSymbolSelect(sym);
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
      {/* Top Main Header Section */}
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div
            style={{
              padding: '10px',
              borderRadius: '10px',
              background: 'rgba(59, 130, 246, 0.2)',
              color: '#38bdf8',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <BarChart2 size={28} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '800', color: '#f8fafc' }}>
                Order Flow & Institutional Footprint Engine
              </h2>
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: '700',
                  padding: '3px 8px',
                  borderRadius: '12px',
                  background: 'rgba(16, 185, 129, 0.15)',
                  color: '#10b981',
                  border: '1px solid rgba(16, 185, 129, 0.3)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981' }} />
                LIVE MARKET STREAM ACTIVE
              </span>
            </div>
            <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: 'var(--text-secondary)' }}>
              Delta Exhaustion, Absorption & Divergence with COT High / Low Radar for all F&O Stocks
            </p>
          </div>
        </div>

        {/* Quick F&O Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '11px', fontWeight: '700', color: '#94a3b8' }}>QUICK F&O:</span>
          {QUICK_SYMBOLS.map((sym) => {
            const fullSym = `NSE:${sym}`;
            const isSelected = selectedSymbol === fullSym;
            return (
              <button
                key={sym}
                onClick={() => handleInspectSymbol(fullSym)}
                style={{
                  background: isSelected ? 'var(--accent-blue)' : 'rgba(30, 41, 59, 0.8)',
                  color: isSelected ? '#ffffff' : '#94a3b8',
                  border: '1px solid var(--border-color)',
                  padding: '4px 10px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
              >
                {sym}
              </button>
            );
          })}
        </div>
      </div>

      {/* Alert Banner / Institutional Radar Summary Card */}
      <div
        className="glass-panel"
        style={{
          padding: '16px 20px',
          borderRadius: '12px',
          background: 'rgba(15, 23, 42, 0.75)',
          border: '1px solid var(--border-color)',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {activeSignal.netDelta < 0 ? (
              <TrendingDown size={20} color="#ef4444" />
            ) : (
              <TrendingUp size={20} color="#10b981" />
            )}
            <span style={{ fontSize: '18px', fontWeight: '800', color: '#f8fafc' }}>
              {activeSignal.displayName} — {activeSignal.signalType}
            </span>
            <span
              style={{
                fontSize: '11px',
                fontWeight: '800',
                padding: '2px 8px',
                borderRadius: '4px',
                background: `${activeSignal.signalBadgeColor}20`,
                color: activeSignal.signalBadgeColor,
                border: `1px solid ${activeSignal.signalBadgeColor}40`,
              }}
            >
              {activeSignal.confluencePct}% Confluence
            </span>
          </div>

          <div style={{ fontSize: '13px', color: '#cbd5e1' }}>
            Current Price: <strong style={{ color: '#f8fafc' }}>₹{activeSignal.ltp.toLocaleString('en-IN')}</strong> | Net Cumulative Delta:{' '}
            <span style={{ color: activeSignal.netDelta < 0 ? '#ef4444' : '#10b981', fontWeight: '700' }}>
              {activeSignal.netDeltaText}
            </span>{' '}
            <span style={{ color: '#94a3b8' }}>{activeSignal.deltaRatioText}</span>
          </div>
        </div>

        {/* Actionable Option Trade Pill */}
        <div
          style={{
            padding: '12px 18px',
            borderRadius: '10px',
            background: 'rgba(30, 41, 59, 0.9)',
            border: '1px solid rgba(59, 130, 246, 0.3)',
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
          }}
        >
          <div>
            <div style={{ fontSize: '10px', color: '#94a3b8', fontWeight: '700', letterSpacing: '0.5px' }}>
              RECOMMENDED CALL/PUT
            </div>
            <div
              style={{
                fontSize: '15px',
                fontWeight: '800',
                color: activeSignal.optionType === 'CE' ? '#10b981' : '#ef4444',
                marginTop: '2px',
              }}
            >
              {activeSignal.actionableOptionStrike}
            </div>
          </div>

          <div style={{ height: '30px', width: '1px', background: 'var(--border-color)' }} />

          <div style={{ display: 'flex', gap: '12px', fontSize: '12px' }}>
            <div>
              <div style={{ fontSize: '9px', color: '#64748b' }}>TRIGGER LEVEL</div>
              <div style={{ fontWeight: '700', color: '#38bdf8' }}>₹{activeSignal.triggerLevel.toFixed(1)}</div>
            </div>
            <div>
              <div style={{ fontSize: '9px', color: '#64748b' }}>STOP LOSS</div>
              <div style={{ fontWeight: '700', color: '#ef4444' }}>₹{activeSignal.stopLoss.toFixed(1)}</div>
            </div>
            <div>
              <div style={{ fontSize: '9px', color: '#64748b' }}>TARGET 1</div>
              <div style={{ fontWeight: '700', color: '#10b981' }}>₹{activeSignal.target1.toFixed(1)}</div>
            </div>
          </div>
        </div>
      </div>

      {/* 4 Core Order Flow Detection Metric Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: '14px',
        }}
      >
        {/* CARD 1: DELTA EXHAUSTION */}
        <div
          className="glass-panel"
          style={{
            padding: '16px',
            borderRadius: '10px',
            background: 'rgba(15, 23, 42, 0.7)',
            border: '1px solid var(--border-color)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontSize: '11px', fontWeight: '800', color: '#38bdf8', letterSpacing: '0.5px' }}>
                DELTA EXHAUSTION
              </span>
              <span style={{ fontSize: '10px', fontWeight: '700', padding: '2px 6px', borderRadius: '4px', background: 'rgba(16, 185, 129, 0.15)', color: '#10b981' }}>
                ACTIVE
              </span>
            </div>
            <div style={{ fontSize: '14px', fontWeight: '700', color: '#f8fafc', marginBottom: '4px' }}>
              Buyer Exhaustion at COT High
            </div>
            <div style={{ fontSize: '12px', color: '#cbd5e1', lineHeight: '1.4' }}>
              {activeSignal.deltaExhaustionText}
            </div>
          </div>
          <div style={{ fontSize: '12px', fontWeight: '800', color: '#ef4444', marginTop: '12px' }}>
            {activeSignal.deltaContractionText}
          </div>
        </div>

        {/* CARD 2: DELTA ABSORPTION */}
        <div
          className="glass-panel"
          style={{
            padding: '16px',
            borderRadius: '10px',
            background: 'rgba(15, 23, 42, 0.7)',
            border: '1px solid var(--border-color)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontSize: '11px', fontWeight: '800', color: '#38bdf8', letterSpacing: '0.5px' }}>
                DELTA ABSORPTION
              </span>
              <span style={{ fontSize: '10px', fontWeight: '700', padding: '2px 6px', borderRadius: '4px', background: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa' }}>
                CONFIRMED
              </span>
            </div>
            <div style={{ fontSize: '14px', fontWeight: '700', color: '#f8fafc', marginBottom: '4px' }}>
              Aggressive Buyers Absorbed
            </div>
            <div style={{ fontSize: '12px', color: '#cbd5e1', lineHeight: '1.4' }}>
              {activeSignal.deltaAbsorptionText}
            </div>
          </div>
          <div style={{ fontSize: '12px', fontWeight: '800', color: '#60a5fa', marginTop: '12px' }}>
            {activeSignal.absorbedContractsText}
          </div>
        </div>

        {/* CARD 3: DELTA DIVERGENCE (CVD) */}
        <div
          className="glass-panel"
          style={{
            padding: '16px',
            borderRadius: '10px',
            background: 'rgba(15, 23, 42, 0.7)',
            border: '1px solid var(--border-color)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontSize: '11px', fontWeight: '800', color: '#38bdf8', letterSpacing: '0.5px' }}>
                DELTA DIVERGENCE (CVD)
              </span>
              <span style={{ fontSize: '10px', fontWeight: '700', padding: '2px 6px', borderRadius: '4px', background: 'rgba(168, 85, 247, 0.15)', color: '#a855f7' }}>
                DETECTED
              </span>
            </div>
            <div style={{ fontSize: '14px', fontWeight: '700', color: '#f8fafc', marginBottom: '4px' }}>
              Bearish CVD Divergence
            </div>
            <div style={{ fontSize: '12px', color: '#cbd5e1', lineHeight: '1.4' }}>
              {activeSignal.deltaDivergenceText}
            </div>
          </div>
          <div style={{ fontSize: '12px', fontWeight: '800', color: '#a855f7', marginTop: '12px' }}>
            {activeSignal.divergenceHighlightText}
          </div>
        </div>

        {/* CARD 4: COT HIGH & LOW RADAR */}
        <div
          className="glass-panel"
          style={{
            padding: '16px',
            borderRadius: '10px',
            background: 'rgba(15, 23, 42, 0.7)',
            border: '1px solid var(--border-color)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontSize: '11px', fontWeight: '800', color: '#38bdf8', letterSpacing: '0.5px' }}>
                COT HIGH & LOW RADAR
              </span>
              <span style={{ fontSize: '10px', fontWeight: '700', padding: '2px 6px', borderRadius: '4px', background: 'rgba(16, 185, 129, 0.15)', color: '#10b981' }}>
                RADAR ACTIVE
              </span>
            </div>
            <div style={{ fontSize: '14px', fontWeight: '700', color: '#f8fafc', marginBottom: '4px' }}>
              COT Low Sliced - Free Fall Expansion
            </div>
            <div style={{ fontSize: '12px', color: '#cbd5e1', lineHeight: '1.4' }}>
              {activeSignal.cotRadarText}
            </div>
          </div>
          <div style={{ fontSize: '12px', fontWeight: '800', color: '#10b981', marginTop: '12px' }}>
            COT High: {activeSignal.cotHigh.toFixed(1)} | COT Low: {activeSignal.cotLow.toFixed(1)}
          </div>
        </div>
      </div>

      {/* All F&O Stocks Live Order Flow Scanner Table */}
      <div
        className="glass-panel"
        style={{
          padding: '16px',
          borderRadius: '12px',
          background: 'rgba(15, 23, 42, 0.75)',
          border: '1px solid var(--border-color)',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px',
        }}
      >
        {/* Table Header Controls */}
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '800', color: '#f8fafc' }}>
              All F&O Stocks Live Order Flow Scanner
            </h3>
            <span
              style={{
                fontSize: '11px',
                fontWeight: '700',
                padding: '2px 8px',
                borderRadius: '12px',
                background: 'rgba(59, 130, 246, 0.15)',
                color: '#60a5fa',
                border: '1px solid rgba(59, 130, 246, 0.3)',
              }}
            >
              ⚡ {filteredSignals.length} Active Setups (Scrollable)
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            {/* Search Input */}
            <div style={{ position: 'relative', width: '200px' }}>
              <Search size={14} style={{ position: 'absolute', left: '10px', top: '9px', color: '#64748b' }} />
              <input
                type="text"
                placeholder="Search F&O ticker..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  background: 'rgba(30, 41, 59, 0.8)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '6px',
                  padding: '6px 10px 6px 30px',
                  fontSize: '12px',
                  color: '#f8fafc',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            {/* Filter Tabs */}
            <div
              style={{
                display: 'flex',
                background: 'rgba(30, 41, 59, 0.8)',
                borderRadius: '6px',
                padding: '2px',
                border: '1px solid var(--border-color)',
              }}
            >
              {(['ALL', 'ABSORPTION', 'EXHAUSTION', 'DIVERGENCE', 'COT'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setSelectedFilter(tab)}
                  style={{
                    background: selectedFilter === tab ? 'var(--accent-blue)' : 'transparent',
                    color: selectedFilter === tab ? '#ffffff' : '#94a3b8',
                    border: 'none',
                    padding: '4px 10px',
                    borderRadius: '4px',
                    fontSize: '11px',
                    fontWeight: '700',
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                  }}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Scrollable High-Tech Table */}
        <div style={{ overflowX: 'auto', maxHeight: '450px' }}>
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: '12px',
              textAlign: 'left',
            }}
          >
            <thead>
              <tr
                style={{
                  borderBottom: '1px solid var(--border-color)',
                  color: '#94a3b8',
                  fontSize: '11px',
                  fontWeight: '700',
                  textTransform: 'uppercase',
                  background: 'rgba(30, 41, 59, 0.5)',
                }}
              >
                <th style={{ padding: '10px 12px' }}>F&O SYMBOL</th>
                <th style={{ padding: '10px 12px' }}>LTP PRICE</th>
                <th style={{ padding: '10px 12px' }}>NET DELTA</th>
                <th style={{ padding: '10px 12px' }}>ORDER FLOW SIGNAL</th>
                <th style={{ padding: '10px 12px' }}>PRIMARY STRATEGY TRIGGER</th>
                <th style={{ padding: '10px 12px' }}>COT HIGH / LOW LOCATION</th>
                <th style={{ padding: '10px 12px' }}>ACTIONABLE OPTION STRIKE</th>
                <th style={{ padding: '10px 12px', textAlign: 'center' }}>LOAD</th>
              </tr>
            </thead>
            <tbody>
              {filteredSignals.map((item, idx) => {
                const isSelected = selectedSymbol === item.symbol;
                return (
                  <tr
                    key={idx}
                    style={{
                      borderBottom: '1px solid rgba(255,255,255,0.05)',
                      background: isSelected ? 'rgba(59, 130, 246, 0.1)' : idx % 2 === 0 ? 'rgba(15, 23, 42, 0.3)' : 'transparent',
                      transition: 'background 0.15s',
                    }}
                  >
                    {/* F&O SYMBOL */}
                    <td style={{ padding: '10px 12px' }}>
                      <div style={{ fontWeight: '800', color: '#f8fafc' }}>{item.displayName}</div>
                      <div style={{ fontSize: '10px', color: '#64748b' }}>{item.subtitle}</div>
                    </td>

                    {/* LTP PRICE */}
                    <td style={{ padding: '10px 12px', fontWeight: '700', color: '#f8fafc' }}>
                      ₹{item.ltp.toLocaleString('en-IN', { minimumFractionDigits: 1 })}{' '}
                      <span style={{ fontSize: '11px', color: item.changePct >= 0 ? '#10b981' : '#ef4444' }}>
                        {item.changePct >= 0 ? '+' : ''}{item.changePct}%
                      </span>
                    </td>

                    {/* NET DELTA */}
                    <td
                      style={{
                        padding: '10px 12px',
                        fontWeight: '800',
                        color: item.netDelta < 0 ? '#ef4444' : '#10b981',
                      }}
                    >
                      {item.netDelta > 0 ? '+' : ''}{item.netDelta.toLocaleString('en-IN')}
                    </td>

                    {/* ORDER FLOW SIGNAL */}
                    <td style={{ padding: '10px 12px' }}>
                      <span
                        style={{
                          fontSize: '10px',
                          fontWeight: '800',
                          padding: '3px 8px',
                          borderRadius: '4px',
                          background: `${item.signalBadgeColor}20`,
                          color: item.signalBadgeColor,
                          border: `1px solid ${item.signalBadgeColor}40`,
                        }}
                      >
                        {item.signalType}
                      </span>
                    </td>

                    {/* PRIMARY STRATEGY TRIGGER */}
                    <td style={{ padding: '10px 12px', color: '#cbd5e1' }}>
                      {item.primaryTrigger}
                    </td>

                    {/* COT HIGH / LOW LOCATION */}
                    <td style={{ padding: '10px 12px', color: '#e2e8f0', fontSize: '11px' }}>
                      {item.cotLocation}
                    </td>

                    {/* ACTIONABLE OPTION STRIKE */}
                    <td style={{ padding: '10px 12px' }}>
                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: '800',
                          padding: '3px 8px',
                          borderRadius: '4px',
                          background: item.optionType === 'CE' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                          color: item.optionType === 'CE' ? '#10b981' : '#ef4444',
                          border: `1px solid ${item.optionType === 'CE' ? '#10b981' : '#ef4444'}40`,
                        }}
                      >
                        {item.actionableOptionStrike}
                      </span>
                    </td>

                    {/* LOAD / ACTION */}
                    <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                      <button
                        onClick={() => handleInspectSymbol(item.symbol)}
                        style={{
                          background: 'var(--accent-blue)',
                          border: 'none',
                          color: '#fff',
                          padding: '4px 10px',
                          borderRadius: '4px',
                          fontSize: '11px',
                          fontWeight: '700',
                          cursor: 'pointer',
                        }}
                      >
                        Inspect
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ---------------------------------------------------------------- */}
      {/* ORDER FLOW & FOOTPRINT PATTERN CARDS (Matching media_1789306131485.png) */}
      {/* ---------------------------------------------------------------- */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
          <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '800', color: 'white', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <BarChart2 size={18} style={{ color: '#00f0ff' }} />
            <span>Footprint & Order Flow Core Mechanics</span>
          </h3>
          <span style={{ fontSize: '12px', color: '#94a3b8', fontWeight: '600' }}>
            Reference guide for institutional footprint signals
          </span>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
          gap: '16px'
        }}>
          {[
            {
              title: 'Absorption',
              bannerColor: '#1b4d4f',
              description: 'Large limit orders absorb aggressive market orders. Price stalls despite heavy volume. Often precedes a reversal.'
            },
            {
              title: 'Exhaustion',
              bannerColor: '#ea580c',
              description: 'Buy/sell aggression continues but momentum decays. Price fails to follow through. Delta diverges from price.'
            },
            {
              title: 'Initiative Buyer/Seller',
              bannerColor: '#2a7b88',
              description: 'Participants who initiate price movement away from value — typically institutions entering directional trades.'
            },
            {
              title: 'Responsive Buyer/Seller',
              bannerColor: '#b45309',
              description: 'Participants who fade price moves away from value, fading the initiative. They act when price reaches extremes.'
            },
            {
              title: 'Liquidity',
              bannerColor: '#1e5659',
              description: 'Availability of resting orders at price levels. High liquidity = stable zone; low liquidity = fast-move zone.'
            },
            {
              title: 'Stop Loss Hunting',
              bannerColor: '#dc2626',
              description: 'Large players push price beyond obvious levels to trigger retail stop orders, collecting their liquidity.'
            },
            {
              title: 'Stopping Volume',
              bannerColor: '#f97316',
              description: 'Surge of volume that halts a trending move — aggressive orders meet a wall of limit orders. First signal of reversal.'
            },
            {
              title: 'Unfinished Auction',
              bannerColor: '#1b7a82',
              description: 'A price level where the auction is incomplete — bid/ask imbalance remains visible, signaling a likely revisit.'
            }
          ].map((card, idx) => (
            <div
              key={idx}
              style={{
                display: 'flex',
                borderRadius: '8px',
                overflow: 'hidden',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                background: 'rgba(255, 255, 255, 0.02)',
                minHeight: '80px'
              }}
            >
              {/* Left Color Banner with Title */}
              <div style={{
                width: '140px',
                minWidth: '140px',
                backgroundColor: card.bannerColor,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '12px',
                boxSizing: 'border-box'
              }}>
                <span style={{
                  color: '#ffffff',
                  fontWeight: '800',
                  fontSize: '13px',
                  textAlign: 'center',
                  lineHeight: '1.3'
                }}>
                  {card.title}
                </span>
              </div>

              {/* Right Description Body */}
              <div style={{
                flex: 1,
                padding: '14px 16px',
                display: 'flex',
                alignItems: 'center',
                backgroundColor: 'rgba(15, 23, 42, 0.5)'
              }}>
                <p style={{
                  margin: 0,
                  fontSize: '12px',
                  lineHeight: '1.5',
                  color: '#cbd5e1',
                  fontWeight: '500'
                }}>
                  {card.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
