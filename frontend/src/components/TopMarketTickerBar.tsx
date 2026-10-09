import React, { useState, useEffect, useRef } from 'react';
import { tvStreamer, getBackendHttpUrl } from '../utils/tvStreamer';
import { TrendingUp, TrendingDown, Radio } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

interface TickerItem {
  key: string;
  name: string;
  shortName: string;
  symbol: string;
  ltp: number;
  close: number;
  change: number;
  changePct: number;
}

interface TopMarketTickerBarProps {
  currentSymbol?: string;
  onSymbolSelect?: (symbol: string) => void;
}

const DEFAULT_ITEMS: TickerItem[] = [
  { key: 'nifty', name: 'NIFTY 50', shortName: 'NIFTY', symbol: 'NSE:NIFTY', ltp: 23361.00, close: 23329.00, change: 32.00, changePct: 0.14 },
  { key: 'niftyFut', name: 'NIFTY FUTURES', shortName: 'NIFTY FUT', symbol: 'NSE:NIFTY1!', ltp: 23380.50, close: 23348.50, change: 32.00, changePct: 0.14 },
  { key: 'banknifty', name: 'BANK NIFTY', shortName: 'BANKNIFTY', symbol: 'NSE:BANKNIFTY', ltp: 56384.00, close: 56215.55, change: 168.45, changePct: 0.30 },
  { key: 'bankniftyFut', name: 'BANKNIFTY FUTURES', shortName: 'BANKNIFTY FUT', symbol: 'NSE:BANKNIFTY1!', ltp: 56472.50, close: 56304.05, change: 168.45, changePct: 0.30 },
  { key: 'sensex', name: 'SENSEX', shortName: 'SENSEX', symbol: 'BSE:SENSEX', ltp: 74644.00, close: 74529.08, change: 114.92, changePct: 0.15 }
];

export const TopMarketTickerBar: React.FC<TopMarketTickerBarProps> = ({
  currentSymbol,
  onSymbolSelect
}) => {
  const { isDark } = useTheme();
  const [items, setItems] = useState<TickerItem[]>(DEFAULT_ITEMS);
  const [source, setSource] = useState<string>('Angel One SmartAPI');
  const [lastUpdate, setLastUpdate] = useState<string>('');
  const [flashKey, setFlashKey] = useState<string | null>(null);
  const [tickFlashes, setTickFlashes] = useState<Record<string, 'up' | 'down'>>({});

  const applyUpdate = (newItems: TickerItem[], newSource?: string) => {
    setItems((prev) => {
      const nextFlashes: Record<string, 'up' | 'down'> = {};
      newItems.forEach((newItem) => {
        const oldItem = prev.find((p) => p.key === newItem.key);
        if (oldItem && oldItem.ltp !== newItem.ltp) {
          nextFlashes[newItem.key] = newItem.ltp > oldItem.ltp ? 'up' : 'down';
        }
      });

      if (Object.keys(nextFlashes).length > 0) {
        setTickFlashes((f) => ({ ...f, ...nextFlashes }));
        setTimeout(() => {
          setTickFlashes((current) => {
            const copy = { ...current };
            Object.keys(nextFlashes).forEach((k) => delete copy[k]);
            return copy;
          });
        }, 600);
      }
      return newItems;
    });

    if (newSource) setSource(newSource);
    setLastUpdate(
      new Date().toLocaleTimeString('en-IN', {
        timeZone: 'Asia/Kolkata',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      })
    );
  };

  const lastWsTimestampRef = useRef<number>(0);

  useEffect(() => {
    // 1. Instant WebSocket push listener (0ms latency direct stream)
    const handleWsIndices = (data: any) => {
      if (Array.isArray(data?.items) && data.items.length >= 5) {
        lastWsTimestampRef.current = Date.now();
        applyUpdate(data.items, data.source);
      }
    };
    tvStreamer.addMarketIndicesListener(handleWsIndices);

    // 2. Resilient polling loop with timeout guard as secondary stream (only if WS silent)
    let isMounted = true;
    const fetchIndices = async () => {
      // If WebSocket is actively streaming ticks, skip HTTP poll to save bandwidth and UI thread
      if (Date.now() - lastWsTimestampRef.current < 4000) {
        return;
      }

      try {
        const backendUrl = await getBackendHttpUrl();
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 2000);
        const res = await fetch(`${backendUrl}/api/market-indices`, {
          signal: ctrl.signal,
          headers: { 'bypass-tunnel-reminder': 'true' }
        });
        clearTimeout(timer);

        if (res.ok && isMounted) {
          const data = await res.json();
          if (Array.isArray(data.items) && data.items.length >= 5) {
            applyUpdate(data.items, data.source);
          }
        }
      } catch (e) {
        // Silently keep previous data during transient tunnel jitters
      }
    };

    fetchIndices();
    const interval = setInterval(fetchIndices, 2500);

    return () => {
      isMounted = false;
      clearInterval(interval);
      tvStreamer.removeMarketIndicesListener(handleWsIndices);
    };
  }, []);

  const handleSelect = (sym: string, key: string) => {
    setFlashKey(key);
    setTimeout(() => setFlashKey(null), 500);
    if (onSymbolSelect) {
      onSymbolSelect(sym);
    }
  };

  return (
    <div
      style={{
        width: '100%',
        backgroundColor: isDark ? '#090d16' : '#ffffff',
        borderBottom: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.08)' : '#e2e8f0'}`,
        padding: '5px 12px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'nowrap',
        overflowX: 'auto',
        WebkitOverflowScrolling: 'touch',
        gap: '8px',
        boxSizing: 'border-box',
        boxShadow: isDark ? 'none' : '0 1px 4px rgba(0, 0, 0, 0.04)',
        zIndex: 50,
        transition: 'background-color 0.2s ease, border-color 0.2s ease'
      }}
      className="mobile-tab-scroll"
    >
      {/* Live Badge */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          background: isDark ? 'rgba(16, 185, 129, 0.12)' : 'rgba(16, 185, 129, 0.15)',
          border: `1px solid ${isDark ? 'rgba(16, 185, 129, 0.35)' : 'rgba(16, 185, 129, 0.5)'}`,
          padding: '3px 8px',
          borderRadius: '5px',
          flexShrink: 0
        }}
        title={`Connected to ${source} • Last Tick: ${lastUpdate || 'Live Stream'}`}
      >
        <span
          style={{
            width: '7px',
            height: '7px',
            borderRadius: '50%',
            backgroundColor: '#10b981',
            boxShadow: '0 0 10px #10b981'
          }}
          className="animate-pulse"
        />
        <span style={{ fontSize: '10px', fontWeight: '900', color: isDark ? '#34d399' : '#059669', letterSpacing: '0.4px', whiteSpace: 'nowrap' }}>
          ANGEL ONE LIVE
        </span>
      </div>

      {/* 5 Instrument Cards */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          flex: 1,
          justifyContent: 'flex-start',
          flexWrap: 'nowrap'
        }}
      >
        {items.map((item) => {
          const isPositive = item.change >= 0;
          const isSelected = currentSymbol === item.symbol;
          const isUserClicked = flashKey === item.key;
          const tickFlash = tickFlashes[item.key];

          let bg = isDark ? 'rgba(15, 23, 42, 0.65)' : '#f8fafc';
          let border = `1px solid ${isDark ? 'rgba(255, 255, 255, 0.08)' : '#e2e8f0'}`;

          if (isSelected) {
            bg = isDark 
              ? 'linear-gradient(135deg, rgba(2, 132, 199, 0.25), rgba(15, 23, 42, 0.8))'
              : 'linear-gradient(135deg, rgba(224, 242, 254, 0.9), rgba(240, 249, 255, 0.95))';
            border = '1px solid #0284c7';
          } else if (isUserClicked) {
            bg = isDark ? 'rgba(0, 240, 255, 0.2)' : 'rgba(8, 145, 178, 0.15)';
            border = isDark ? '1px solid rgba(0, 240, 255, 0.5)' : '1px solid #0891b2';
          } else if (tickFlash === 'up') {
            bg = isDark ? 'rgba(16, 185, 129, 0.22)' : 'rgba(16, 185, 129, 0.18)';
            border = isDark ? '1px solid rgba(16, 185, 129, 0.5)' : '1px solid #10b981';
          } else if (tickFlash === 'down') {
            bg = isDark ? 'rgba(239, 68, 68, 0.22)' : 'rgba(239, 68, 68, 0.18)';
            border = isDark ? '1px solid rgba(239, 68, 68, 0.5)' : '1px solid #ef4444';
          }

          return (
            <div
              key={item.key}
              onClick={() => handleSelect(item.symbol, item.key)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                background: bg,
                border: border,
                padding: '3px 10px',
                borderRadius: '6px',
                cursor: 'pointer',
                transition: 'background-color 0.2s ease, border-color 0.2s ease',
                flexShrink: 0,
                boxShadow: isSelected ? (isDark ? '0 0 10px rgba(2, 132, 199, 0.3)' : '0 1px 6px rgba(2, 132, 199, 0.2)') : 'none'
              }}
              title={`Click to analyze ${item.name} (${item.symbol})`}
            >
              {/* Asset Name */}
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: '800',
                    color: isSelected ? (isDark ? '#38bdf8' : '#0284c7') : (isDark ? '#e2e8f0' : '#1e293b'),
                    letterSpacing: '0.2px',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {item.shortName}
                </span>
              </div>

              {/* Live LTP with Dynamic Tick Animation */}
              <span
                style={{
                  fontSize: '12px',
                  fontWeight: '900',
                  color: tickFlash === 'up' 
                    ? (isDark ? '#34d399' : '#059669') 
                    : (tickFlash === 'down' 
                      ? (isDark ? '#f87171' : '#dc2626') 
                      : (isDark ? '#ffffff' : '#0f172a')),
                  fontFamily: '"JetBrains Mono", monospace',
                  whiteSpace: 'nowrap',
                  transition: 'color 0.2s ease'
                }}
              >
                ₹{Number(item.ltp).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>

              {/* Change & Change % */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '3px',
                  fontSize: '10px',
                  fontWeight: '800',
                  color: isPositive ? (isDark ? '#34d399' : '#059669') : (isDark ? '#f87171' : '#dc2626'),
                  fontFamily: '"JetBrains Mono", monospace',
                  whiteSpace: 'nowrap'
                }}
              >
                {isPositive ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                <span>
                  {isPositive ? `+${item.change.toFixed(2)}` : item.change.toFixed(2)} ({isPositive ? `+${item.changePct.toFixed(2)}%` : `${item.changePct.toFixed(2)}%`})
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Clock / IST time */}
      {lastUpdate && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0, paddingRight: '4px' }}>
          <span style={{ fontSize: '10px', color: '#94a3b8', fontFamily: 'monospace', fontWeight: '600' }}>
            {lastUpdate} IST
          </span>
        </div>
      )}
    </div>
  );
};
