import React, { useState } from 'react';
import { useTheme } from '../context/ThemeContext';
import { TrendingUp, TrendingDown, Activity, Zap, Compass, BarChart2 } from 'lucide-react';

interface StockMover {
  symbol: string;
  name: string;
  color: string;
  initial: string;
  ltp: number;
  change: number;
  changePercent: number;
  volume: string;
}

const TOP_GAINERS: StockMover[] = [
  { symbol: 'NSE:ADANIENT', name: 'ADANIENT', color: '#8b5cf6', initial: 'M', ltp: 3241.50, change: 110.25, changePercent: 3.52, volume: '12.4M' },
  { symbol: 'NSE:NTPC', name: 'NTPC', color: '#06b6d4', initial: 'N', ltp: 368.75, change: 10.65, changePercent: 2.98, volume: '18.7M' },
  { symbol: 'NSE:POWERGRID', name: 'POWERGRID', color: '#3b82f6', initial: 'P', ltp: 312.40, change: 7.35, changePercent: 2.41, volume: '24.1M' },
  { symbol: 'NSE:TATAMOTORS', name: 'TATAMOTORS', color: '#0284c7', initial: 'T', ltp: 938.20, change: 19.30, changePercent: 2.10, volume: '32.4M' },
  { symbol: 'NSE:BAJAJFINSV', name: 'BAJAJFINSV', color: '#38bdf8', initial: 'B', ltp: 1752.80, change: 33.50, changePercent: 1.95, volume: '9.8M' }
];

const TOP_LOSERS: StockMover[] = [
  { symbol: 'NSE:INDUSINDBK', name: 'INDUSINDBK', color: '#ef4444', initial: 'I', ltp: 1420.10, change: -46.20, changePercent: -3.15, volume: '11.2M' },
  { symbol: 'NSE:TECHM', name: 'TECHM', color: '#f97316', initial: 'T', ltp: 1280.40, change: -34.80, changePercent: -2.65, volume: '8.9M' },
  { symbol: 'NSE:INFY', name: 'INFY', color: '#ec4899', initial: 'I', ltp: 1485.50, change: -31.90, changePercent: -2.10, volume: '16.4M' },
  { symbol: 'NSE:HCLTECH', name: 'HCLTECH', color: '#f43f5e', initial: 'H', ltp: 1390.20, change: -26.15, changePercent: -1.85, volume: '7.5M' },
  { symbol: 'NSE:WIPRO', name: 'WIPRO', color: '#e11d48', initial: 'W', ltp: 460.30, change: -7.50, changePercent: -1.60, volume: '13.1M' }
];

const MOST_ACTIVE: StockMover[] = [
  { symbol: 'NSE:HDFCBANK', name: 'HDFCBANK', color: '#2563eb', initial: 'H', ltp: 1540.20, change: 6.90, changePercent: 0.45, volume: '45.8M' },
  { symbol: 'NSE:RELIANCE', name: 'RELIANCE', color: '#059669', initial: 'R', ltp: 2910.80, change: -8.75, changePercent: -0.30, volume: '38.2M' },
  { symbol: 'NSE:ICICIBANK', name: 'ICICIBANK', color: '#d97706', initial: 'I', ltp: 1110.50, change: 12.60, changePercent: 1.15, volume: '36.7M' },
  { symbol: 'NSE:SBIN', name: 'SBIN', color: '#0284c7', initial: 'S', ltp: 785.40, change: 6.60, changePercent: 0.85, volume: '34.9M' },
  { symbol: 'NSE:TATAMOTORS', name: 'TATAMOTORS', color: '#8b5cf6', initial: 'T', ltp: 938.20, change: 19.30, changePercent: 2.10, volume: '32.4M' }
];

interface IndexItem {
  symbol: string;
  name: string;
  ltp: number;
  change: number;
  changePercent: number;
  low: number;
  high: number;
}

const MAJOR_INDICES: IndexItem[] = [
  { symbol: 'NSE:NIFTY', name: 'NIFTY 50', ltp: 22517.00, change: 57.15, changePercent: 0.25, low: 22380.00, high: 22540.00 },
  { symbol: 'NSE:BANKNIFTY', name: 'BANK NIFTY', ltp: 48250.00, change: 145.20, changePercent: 0.30, low: 47980.00, high: 48390.00 },
  { symbol: 'BSE:SENSEX', name: 'SENSEX', ltp: 74119.30, change: 230.10, changePercent: 0.31, low: 73850.00, high: 74210.00 },
  { symbol: 'NSE:FINNIFTY', name: 'FIN NIFTY', ltp: 21480.50, change: 62.30, changePercent: 0.29, low: 21370.00, high: 21530.00 },
  { symbol: 'NSE:INDIAVIX', name: 'INDIA VIX', ltp: 12.85, change: -0.42, changePercent: -3.16, low: 12.40, high: 13.45 }
];

interface BreakoutRadarItem {
  symbol: string;
  name: string;
  pattern: string;
  bias: 'Bullish' | 'Bearish';
  ltp: number;
  changePercent: number;
  time: string;
}

const BREAKOUT_RADAR: BreakoutRadarItem[] = [
  { symbol: 'NSE:TATAMOTORS', name: 'TATAMOTORS', pattern: 'NR7 Vol Breakout', bias: 'Bullish', ltp: 938.20, changePercent: 2.10, time: '14:30' },
  { symbol: 'NSE:ADANIENT', name: 'ADANIENT', pattern: 'S/R Clearance', bias: 'Bullish', ltp: 3241.50, changePercent: 3.52, time: '14:15' },
  { symbol: 'NSE:NTPC', name: 'NTPC', pattern: 'Value Area Expansion', bias: 'Bullish', ltp: 368.75, changePercent: 2.98, time: '13:45' },
  { symbol: 'NSE:INDUSINDBK', name: 'INDUSINDBK', pattern: 'S3 Breakdown', bias: 'Bearish', ltp: 1420.10, changePercent: -3.15, time: '14:20' },
  { symbol: 'NSE:HDFCBANK', name: 'HDFCBANK', pattern: 'POC Retest Bounce', bias: 'Bullish', ltp: 1540.20, changePercent: 0.45, time: '13:30' }
];

interface HomeBottomWidgetsProps {
  onSymbolSelect?: (symbol: string) => void;
}

export const HomeBottomWidgets: React.FC<HomeBottomWidgetsProps> = ({ onSymbolSelect }) => {
  const { isDark } = useTheme();
  const [activeMoversTab, setActiveMoversTab] = useState<'gainers' | 'losers' | 'active'>('gainers');

  const moversList = activeMoversTab === 'gainers' 
    ? TOP_GAINERS 
    : activeMoversTab === 'losers' 
      ? TOP_LOSERS 
      : MOST_ACTIVE;

  // Market Breadth metrics
  const advances = 1842;
  const declines = 742;
  const unchanged = 128;
  const total = advances + declines;
  const advancesPercent = Math.round((advances / total) * 100);
  const declinesPercent = 100 - advancesPercent;

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
      gap: '8px',
      width: '100%',
      boxSizing: 'border-box',
      flexShrink: 0,
      marginTop: '4px'
    }}>
      {/* 1. TOP MOVERS CARD */}
      <div style={{
        background: isDark ? 'rgba(15, 23, 42, 0.45)' : '#ffffff',
        border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.08)' : '#e2e8f0'}`,
        borderRadius: '8px',
        padding: '10px 12px',
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
        minHeight: '190px',
        boxSizing: 'border-box'
      }}>
        {/* Top Header & Tabs */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
          <div style={{ fontSize: '11.5px', fontWeight: '800', color: 'var(--text-primary)', letterSpacing: '0.2px', display: 'flex', alignItems: 'center', gap: '5px' }}>
            <Activity size={13} color="#38bdf8" />
            Top Movers
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '2px', background: isDark ? 'rgba(0, 0, 0, 0.3)' : '#f1f5f9', padding: '2px', borderRadius: '5px' }}>
            {[
              { id: 'gainers', label: 'Gainers' },
              { id: 'losers', label: 'Losers' },
              { id: 'active', label: 'Active' }
            ].map(t => (
              <button
                key={t.id}
                onClick={() => setActiveMoversTab(t.id as any)}
                style={{
                  padding: '2px 8px',
                  fontSize: '9.5px',
                  fontWeight: '700',
                  borderRadius: '3px',
                  border: 'none',
                  background: activeMoversTab === t.id ? '#0284c7' : 'transparent',
                  color: activeMoversTab === t.id ? '#ffffff' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Column Headers */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1.4fr 1fr 1fr 1fr',
          fontSize: '9px',
          fontWeight: '700',
          color: 'var(--text-muted)',
          textTransform: 'uppercase',
          padding: '2px 4px',
          borderBottom: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.05)' : '#f1f5f9'}`
        }}>
          <div>Symbol</div>
          <div style={{ textAlign: 'right' }}>LTP</div>
          <div style={{ textAlign: 'right' }}>Chg%</div>
          <div style={{ textAlign: 'right' }}>Volume</div>
        </div>

        {/* Stock List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
          {moversList.map(stock => {
            const isPositive = stock.changePercent >= 0;
            return (
              <div
                key={stock.symbol}
                onClick={() => onSymbolSelect && onSymbolSelect(stock.symbol)}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1.4fr 1fr 1fr 1fr',
                  alignItems: 'center',
                  padding: '3px 4px',
                  borderRadius: '4px',
                  fontSize: '10.5px',
                  cursor: 'pointer',
                  transition: 'background 0.15s ease'
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = isDark ? 'rgba(255, 255, 255, 0.05)' : '#f8fafc')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                title={`Click to load ${stock.name} on chart`}
              >
                {/* Symbol + Avatar Initial */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <div style={{
                    width: '16px',
                    height: '16px',
                    borderRadius: '50%',
                    background: stock.color,
                    color: '#ffffff',
                    fontSize: '8.5px',
                    fontWeight: '800',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}>
                    {stock.initial}
                  </div>
                  <span style={{ fontWeight: '700', color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
                    {stock.name}
                  </span>
                </div>

                {/* LTP */}
                <div style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: '700', color: 'var(--text-primary)' }}>
                  {stock.ltp.toLocaleString('en-IN', { minimumFractionDigits: 1, maximumFractionDigits: 2 })}
                </div>

                {/* Chg% */}
                <div style={{
                  textAlign: 'right',
                  fontFamily: 'monospace',
                  fontWeight: '800',
                  color: isPositive ? '#22c55e' : '#ef4444'
                }}>
                  {isPositive ? `+${stock.changePercent.toFixed(2)}%` : `${stock.changePercent.toFixed(2)}%`}
                </div>

                {/* Volume */}
                <div style={{ textAlign: 'right', fontFamily: 'monospace', color: 'var(--text-secondary)', fontSize: '10px' }}>
                  {stock.volume}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 2. MARKET BREADTH CARD (COMPACT / SMALL AS MARKED IN RED) */}
      <div style={{
        background: isDark ? 'rgba(15, 23, 42, 0.45)' : '#ffffff',
        border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.08)' : '#e2e8f0'}`,
        borderRadius: '8px',
        padding: '10px 12px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        minHeight: '190px',
        boxSizing: 'border-box'
      }}>
        {/* Header with Title and Bullish Tag */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: '11.5px', fontWeight: '800', color: 'var(--text-primary)', letterSpacing: '0.2px', display: 'flex', alignItems: 'center', gap: '5px' }}>
            <Compass size={13} color="#22c55e" />
            Market Breadth
          </div>
          <span style={{
            fontSize: '9.5px',
            fontWeight: '800',
            color: '#22c55e',
            background: 'rgba(34, 197, 94, 0.15)',
            padding: '2px 6px',
            borderRadius: '4px'
          }}>
            71% Bullish
          </span>
        </div>

        {/* Compact Semi-Circular Gauge Meter */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', position: 'relative', margin: '2px 0' }}>
          <svg width="150" height="72" viewBox="0 0 160 85" style={{ overflow: 'visible' }}>
            <defs>
              <linearGradient id="breadthCompactGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#22c55e" />
                <stop offset="70%" stopColor="#22c55e" />
                <stop offset="73%" stopColor="#ef4444" />
                <stop offset="100%" stopColor="#ef4444" />
              </linearGradient>
            </defs>

            {/* Background Arc */}
            <path
              d="M 18 80 A 62 62 0 0 1 142 80"
              fill="none"
              stroke={isDark ? 'rgba(255, 255, 255, 0.08)' : '#e2e8f0'}
              strokeWidth="11"
              strokeLinecap="round"
            />

            {/* Colored Advances/Declines Arc */}
            <path
              d="M 18 80 A 62 62 0 0 1 142 80"
              fill="none"
              stroke="url(#breadthCompactGrad)"
              strokeWidth="11"
              strokeLinecap="round"
              strokeDasharray="195"
              strokeDashoffset="0"
            />
          </svg>

          {/* Counts Row: Advances, Declines, Unchanged */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', marginTop: '4px', padding: '0 4px' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '13px', fontWeight: '900', color: '#22c55e', fontFamily: 'monospace' }}>
                {advances.toLocaleString()}
              </div>
              <div style={{ fontSize: '8.5px', fontWeight: '700', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                Advances
              </div>
            </div>

            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '13px', fontWeight: '900', color: '#ef4444', fontFamily: 'monospace' }}>
                {declines.toLocaleString()}
              </div>
              <div style={{ fontSize: '8.5px', fontWeight: '700', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                Declines
              </div>
            </div>

            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '12px', fontWeight: '800', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                {unchanged}
              </div>
              <div style={{ fontSize: '8.5px', fontWeight: '700', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                Unchanged
              </div>
            </div>
          </div>
        </div>

        {/* Compact Split Ratio Bar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginTop: '4px' }}>
          <div style={{
            height: '6px',
            borderRadius: '3px',
            display: 'flex',
            overflow: 'hidden',
            background: isDark ? 'rgba(0,0,0,0.4)' : '#e2e8f0'
          }}>
            <div style={{ width: `${advancesPercent}%`, background: '#22c55e', transition: 'width 0.4s ease' }} />
            <div style={{ width: `${declinesPercent}%`, background: '#ef4444', transition: 'width 0.4s ease' }} />
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', fontWeight: '800' }}>
            <span style={{ color: '#22c55e' }}>{advancesPercent}% ADV</span>
            <span style={{ color: '#ef4444' }}>{declinesPercent}% DEC</span>
          </div>
        </div>
      </div>

      {/* 3. KEY BENCHMARK INDICES CARD (COVERS BLANK SPACE) */}
      <div style={{
        background: isDark ? 'rgba(15, 23, 42, 0.45)' : '#ffffff',
        border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.08)' : '#e2e8f0'}`,
        borderRadius: '8px',
        padding: '10px 12px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        minHeight: '190px',
        boxSizing: 'border-box'
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: '11.5px', fontWeight: '800', color: 'var(--text-primary)', letterSpacing: '0.2px', display: 'flex', alignItems: 'center', gap: '5px' }}>
            <BarChart2 size={13} color="#a855f7" />
            Major Indices
          </div>
          <span style={{ fontSize: '9.5px', fontWeight: '700', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e' }} />
            LIVE
          </span>
        </div>

        {/* Indices List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {MAJOR_INDICES.map(idx => {
            const isPos = idx.change >= 0;
            const range = idx.high - idx.low;
            const pctPos = range > 0 ? Math.min(100, Math.max(0, ((idx.ltp - idx.low) / range) * 100)) : 50;
            return (
              <div
                key={idx.symbol}
                onClick={() => onSymbolSelect && onSymbolSelect(idx.symbol)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '3px 4px',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  transition: 'background 0.15s ease'
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = isDark ? 'rgba(255, 255, 255, 0.05)' : '#f8fafc')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                title={`Click to load ${idx.name} chart`}
              >
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: '10.5px', fontWeight: '800', color: 'var(--text-primary)' }}>
                    {idx.name}
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', width: '60px', height: '3px', background: 'rgba(255,255,255,0.08)', borderRadius: '2px', marginTop: '2px' }}>
                    <div style={{ width: `${pctPos}%`, height: '100%', background: isPos ? '#22c55e' : '#ef4444', borderRadius: '2px' }} />
                  </div>
                </div>

                <div style={{ textAlign: 'right', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontFamily: 'monospace', fontWeight: '700', fontSize: '11px', color: 'var(--text-primary)' }}>
                    {idx.ltp.toLocaleString('en-IN', { minimumFractionDigits: 1, maximumFractionDigits: 2 })}
                  </span>
                  <span style={{
                    fontFamily: 'monospace',
                    fontWeight: '800',
                    fontSize: '9.5px',
                    color: isPos ? '#22c55e' : '#ef4444',
                    background: isPos ? 'rgba(34, 197, 94, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                    padding: '1px 5px',
                    borderRadius: '3px',
                    minWidth: '46px',
                    textAlign: 'right'
                  }}>
                    {isPos ? `+${idx.changePercent.toFixed(2)}%` : `${idx.changePercent.toFixed(2)}%`}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 4. BREAKOUT RADAR / INTRADAY SETUPS (COVERS BLANK SPACE) */}
      <div style={{
        background: isDark ? 'rgba(15, 23, 42, 0.45)' : '#ffffff',
        border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.08)' : '#e2e8f0'}`,
        borderRadius: '8px',
        padding: '10px 12px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        minHeight: '190px',
        boxSizing: 'border-box'
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: '11.5px', fontWeight: '800', color: 'var(--text-primary)', letterSpacing: '0.2px', display: 'flex', alignItems: 'center', gap: '5px' }}>
            <Zap size={13} color="#f59e0b" />
            Breakout Radar
          </div>
          <span style={{
            fontSize: '9.5px',
            fontWeight: '800',
            color: '#f59e0b',
            background: 'rgba(245, 158, 11, 0.15)',
            padding: '2px 6px',
            borderRadius: '4px'
          }}>
            Active Setups
          </span>
        </div>

        {/* Breakouts List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
          {BREAKOUT_RADAR.map(b => {
            const isBull = b.bias === 'Bullish';
            return (
              <div
                key={b.symbol}
                onClick={() => onSymbolSelect && onSymbolSelect(b.symbol)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '3px 4px',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  transition: 'background 0.15s ease'
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = isDark ? 'rgba(255, 255, 255, 0.05)' : '#f8fafc')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                title={`Click to load ${b.name} (${b.pattern})`}
              >
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <span style={{ fontSize: '10.5px', fontWeight: '800', color: 'var(--text-primary)' }}>
                      {b.name}
                    </span>
                    <span style={{
                      fontSize: '8px',
                      fontWeight: '800',
                      color: isBull ? '#22c55e' : '#ef4444',
                      background: isBull ? 'rgba(34, 197, 94, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                      padding: '1px 4px',
                      borderRadius: '2px',
                      textTransform: 'uppercase'
                    }}>
                      {b.bias}
                    </span>
                  </div>
                  <span style={{ fontSize: '8.5px', color: 'var(--text-secondary)' }}>
                    {b.pattern}
                  </span>
                </div>

                <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                  <span style={{ fontFamily: 'monospace', fontWeight: '700', fontSize: '10.5px', color: 'var(--text-primary)' }}>
                    ₹{b.ltp.toLocaleString('en-IN', { minimumFractionDigits: 1 })}
                  </span>
                  <span style={{ fontFamily: 'monospace', fontWeight: '800', fontSize: '9px', color: b.changePercent >= 0 ? '#22c55e' : '#ef4444' }}>
                    {b.changePercent >= 0 ? `+${b.changePercent.toFixed(2)}%` : `${b.changePercent.toFixed(2)}%`}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
