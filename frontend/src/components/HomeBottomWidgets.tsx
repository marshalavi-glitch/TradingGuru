import React, { useState } from 'react';
import { useTheme } from '../context/ThemeContext';
import { TrendingUp, TrendingDown, Activity } from 'lucide-react';

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
      gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
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
        padding: '10px 14px',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        minHeight: '190px',
        boxSizing: 'border-box'
      }}>
        {/* Top Header & Tabs */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
          <div style={{ fontSize: '12px', fontWeight: '800', color: 'var(--text-primary)', letterSpacing: '0.2px' }}>
            Top Movers
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '3px', background: isDark ? 'rgba(0, 0, 0, 0.3)' : '#f1f5f9', padding: '2px', borderRadius: '6px' }}>
            {[
              { id: 'gainers', label: 'Gainers' },
              { id: 'losers', label: 'Losers' },
              { id: 'active', label: 'Active' }
            ].map(t => (
              <button
                key={t.id}
                onClick={() => setActiveMoversTab(t.id as any)}
                style={{
                  padding: '3px 10px',
                  fontSize: '10px',
                  fontWeight: '700',
                  borderRadius: '4px',
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
          fontSize: '9.5px',
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
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
                  padding: '4px 6px',
                  borderRadius: '5px',
                  fontSize: '11px',
                  cursor: 'pointer',
                  transition: 'background 0.15s ease'
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = isDark ? 'rgba(255, 255, 255, 0.05)' : '#f8fafc')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                title={`Click to load ${stock.name} on chart`}
              >
                {/* Symbol + Avatar Initial */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <div style={{
                    width: '18px',
                    height: '18px',
                    borderRadius: '50%',
                    background: stock.color,
                    color: '#ffffff',
                    fontSize: '9px',
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
                  {stock.ltp.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
                <div style={{ textAlign: 'right', fontFamily: 'monospace', color: 'var(--text-secondary)', fontSize: '10.5px' }}>
                  {stock.volume}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 2. MARKET BREADTH CARD */}
      <div style={{
        background: isDark ? 'rgba(15, 23, 42, 0.45)' : '#ffffff',
        border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.08)' : '#e2e8f0'}`,
        borderRadius: '8px',
        padding: '10px 14px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        minHeight: '190px',
        boxSizing: 'border-box'
      }}>
        <div style={{ fontSize: '12px', fontWeight: '800', color: 'var(--text-primary)', letterSpacing: '0.2px' }}>
          Market Breadth
        </div>

        {/* Semi-Circular SVG Gauge */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', position: 'relative', marginTop: '-4px' }}>
          <svg width="220" height="90" viewBox="0 0 220 110" style={{ overflow: 'visible' }}>
            <defs>
              <linearGradient id="breadthGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#22c55e" />
                <stop offset="70%" stopColor="#22c55e" />
                <stop offset="73%" stopColor="#ef4444" />
                <stop offset="100%" stopColor="#ef4444" />
              </linearGradient>
            </defs>

            {/* Background Arc */}
            <path
              d="M 20 100 A 90 90 0 0 1 200 100"
              fill="none"
              stroke={isDark ? 'rgba(255, 255, 255, 0.08)' : '#e2e8f0'}
              strokeWidth="14"
              strokeLinecap="round"
            />

            {/* Colored Advances/Declines Arc */}
            <path
              d="M 20 100 A 90 90 0 0 1 200 100"
              fill="none"
              stroke="url(#breadthGradient)"
              strokeWidth="14"
              strokeLinecap="round"
              strokeDasharray="283"
              strokeDashoffset="0"
            />
          </svg>

          {/* Counts Row */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-around', width: '100%', marginTop: '6px' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '14px', fontWeight: '900', color: '#22c55e', fontFamily: 'monospace' }}>
                {advances.toLocaleString()}
              </div>
              <div style={{ fontSize: '9px', fontWeight: '700', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                Advances
              </div>
            </div>

            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '14px', fontWeight: '900', color: '#ef4444', fontFamily: 'monospace' }}>
                {declines.toLocaleString()}
              </div>
              <div style={{ fontSize: '9px', fontWeight: '700', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                Declines
              </div>
            </div>

            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '13px', fontWeight: '800', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                {unchanged}
              </div>
              <div style={{ fontSize: '9px', fontWeight: '700', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                Unchanged
              </div>
            </div>
          </div>
        </div>

        {/* Split Progress Bar at bottom */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', marginTop: '6px' }}>
          <div style={{
            height: '8px',
            borderRadius: '4px',
            display: 'flex',
            overflow: 'hidden',
            background: isDark ? 'rgba(0,0,0,0.4)' : '#e2e8f0'
          }}>
            <div style={{ width: `${advancesPercent}%`, background: '#22c55e', transition: 'width 0.4s ease' }} />
            <div style={{ width: `${declinesPercent}%`, background: '#ef4444', transition: 'width 0.4s ease' }} />
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', fontWeight: '800' }}>
            <span style={{ color: '#22c55e' }}>{advancesPercent}%</span>
            <span style={{ color: '#ef4444' }}>{declinesPercent}%</span>
          </div>
        </div>
      </div>
    </div>
  );
};
