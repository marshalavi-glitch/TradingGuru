import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { ChartContainer } from './ChartContainer';
import { tvStreamer, getBackendHttpUrl } from '../utils/tvStreamer';
import type { Candle } from '../utils/profileCalculator';
import { calculateMatrixSeriesData, type MatrixSeriesData } from '../utils/matrixCalculator';
import { filterMarketHoursCandles, isWithinMarketHours } from '../utils/marketHours';
import { useTheme } from '../context/ThemeContext';
import { Loader2, AlertCircle, LayoutGrid, Maximize2, Minimize2, Check, RefreshCw } from 'lucide-react';

export interface MultiChartSlot {
  id: number;
  symbol: string;
  timeframe: string;
}

const DEFAULT_SLOTS: MultiChartSlot[] = [
  { id: 0, symbol: 'NSE:NIFTY', timeframe: '5' },
  { id: 1, symbol: 'NSE:BANKNIFTY', timeframe: '5' },
  { id: 2, symbol: 'NSE:FINNIFTY', timeframe: '5' },
  { id: 3, symbol: 'NSE:RELIANCE', timeframe: '5' },
  { id: 4, symbol: 'MCX:CRUDEOIL', timeframe: '5' },
  { id: 5, symbol: 'MCX:GOLD', timeframe: '5' },
];

const STORAGE_LAYOUT_KEY = 'tradingguru_multichart_layout';
const STORAGE_SYNC_KEY = 'tradingguru_multichart_sync_symbol';
const STORAGE_SLOTS_KEY = 'tradingguru_multichart_slots';

interface MultiChartContainerProps {
  currentSymbol: string;
  currentTimeframe: string;
  layout: number; // 1 | 2 | 3 | 4 | 5 | 6
  syncSymbol: boolean;
  onLayoutChange: (layout: number) => void;
  onToggleSyncSymbol: () => void;
  onActiveSymbolChange?: (symbol: string) => void;
  onActiveTimeframeChange?: (timeframe: string) => void;
  levelAlert?: any;
  onCloseLevelAlert?: () => void;
  onResetSetupAlerts?: () => void;
  levelAlertsMuted?: boolean;
  onToggleAlertsMuted?: () => void;
  levelAlertsFiredCount?: number;
}

// Sub-component for an individual Chart Slot Pane
const ChartSlotPane: React.FC<{
  slot: MultiChartSlot;
  index: number;
  isActive: boolean;
  isMaximized: boolean;
  isMultiChart: boolean;
  onSelect: () => void;
  onToggleMaximize: () => void;
  onSymbolChange: (newSymbol: string) => void;
  onTimeframeChange: (newTimeframe: string) => void;
  levelAlert?: any;
  onCloseLevelAlert?: () => void;
  onResetSetupAlerts?: () => void;
  levelAlertsMuted?: boolean;
  onToggleAlertsMuted?: () => void;
  levelAlertsFiredCount?: number;
}> = ({
  slot,
  index,
  isActive,
  isMaximized,
  isMultiChart,
  onSelect,
  onToggleMaximize,
  onSymbolChange,
  onTimeframeChange,
  levelAlert,
  onCloseLevelAlert,
  onResetSetupAlerts,
  levelAlertsMuted,
  onToggleAlertsMuted,
  levelAlertsFiredCount
}) => {
  const { symbol, timeframe } = slot;
  const [candles, setCandles] = useState<Candle[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');
  const [matrixHistory, setMatrixHistory] = useState<Record<string, any> | null>(null);

  const isMountedRef = useRef(true);
  const loadedKeyRef = useRef('');

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Fetch initial candles & setup real-time streaming for this slot
  useEffect(() => {
    const currentKey = `${symbol}_${timeframe}`;
    if (loadedKeyRef.current !== currentKey) {
      setLoading(true);
      setError(null);
    }

    let isSubscribed = true;

    // Fast 3.5s safety timer: ensures the UI never hangs forever on initial spinner
    const safetyTimer = setTimeout(() => {
      if (isMountedRef.current && isSubscribed) {
        setLoading(false);
      }
    }, 3500);

    const fetchInitialCandles = async () => {
      try {
        const backendHttp = await getBackendHttpUrl();
        const url = `${backendHttp}/api/candles?symbol=${encodeURIComponent(symbol)}&timeframe=${timeframe}&limit=500`;
        const res = await fetch(url, { headers: { 'bypass-tunnel-reminder': 'true' } });
        if (res.ok && isSubscribed && isMountedRef.current) {
          const data = await res.json();
          const sym = data.symbol || symbol;
          if (data.candles && Array.isArray(data.candles) && data.candles.length > 0 && tvStreamer.isSymbolMatch(sym, symbol)) {
            const filtered = filterMarketHoursCandles(data.candles, symbol, timeframe);
            setCandles(filtered);
            setLoading(false);
            setConnectionStatus('connected');
            loadedKeyRef.current = currentKey;
          } else {
            setLoading(false);
          }
        } else {
          setLoading(false);
        }
      } catch (err: any) {
        if (isMountedRef.current && isSubscribed) {
          setLoading(false);
          setError(err?.message || null);
        }
      }
    };

    fetchInitialCandles();

    const unsubscribe = tvStreamer.subscribe(
      symbol,
      timeframe,
      (data) => {
        if (!isSubscribed || !isMountedRef.current) return;
        if (!tvStreamer.isSymbolMatch(data.symbol, symbol)) return;

        setLoading(false);
        setConnectionStatus('connected');
        setError(null);
        loadedKeyRef.current = currentKey;

        if (data.matrixHistory) {
          setMatrixHistory(data.matrixHistory);
        }

        if (data.candles && data.candles.length > 0) {
          setCandles((prevCandles) => {
            if (data.isSnapshot) {
              const filtered = filterMarketHoursCandles(data.candles, symbol, timeframe);
              return [...filtered].sort((a, b) => (a.time as number) - (b.time as number));
            } else {
              if (prevCandles.length === 0) return prevCandles;
              const tick = data.candles[0];
              if (!isWithinMarketHours(tick.time as number, symbol, timeframe)) {
                return prevCandles;
              }
              const idx = prevCandles.findIndex((c) => c.time === tick.time);
              if (idx !== -1) {
                const updated = [...prevCandles];
                updated[idx] = tick;
                return updated;
              } else {
                const updated = [...prevCandles, tick];
                return updated.sort((a, b) => (a.time as number) - (b.time as number));
              }
            }
          });
        }
      },
      (err) => {
        if (!isSubscribed || !isMountedRef.current) return;
        setLoading(false);
        setError(err);
      }
    );

    return () => {
      isSubscribed = false;
      clearTimeout(safetyTimer);
      unsubscribe();
    };
  }, [symbol, timeframe]);

  const matrixSeriesData: MatrixSeriesData | null = useMemo(() => {
    if (!candles || candles.length === 0) return null;
    return calculateMatrixSeriesData(candles, timeframe, matrixHistory);
  }, [candles, timeframe, matrixHistory]);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        height: '100%',
        minHeight: 0,
        minWidth: 0,
        overflow: 'hidden',
        position: 'relative'
      }}
    >
      {loading && candles.length === 0 ? (
        <div
          className="glass-panel"
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            width: '100%',
            height: '100%'
          }}
        >
          <Loader2 className="animate-spin" size={24} color="#38bdf8" />
          <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
            Loading {symbol.replace('NSE:', '').replace('MCX:', '')} ({timeframe}m)...
          </span>
        </div>
      ) : (
        <ChartContainer
          key={`${symbol}-${timeframe}`}
          candles={candles}
          symbol={symbol}
          timeframe={timeframe}
          matrixSeriesData={matrixSeriesData}
          connectionStatus={connectionStatus}
          connectionError={error}
          isMultiChart={isMultiChart}
          chartIndex={index}
          isActive={isActive}
          isMaximized={isMaximized}
          onSelect={onSelect}
          onToggleMaximize={onToggleMaximize}
          onSymbolChange={onSymbolChange}
          onTimeframeChange={onTimeframeChange}
          activeAlert={isActive ? levelAlert : null}
          onCloseAlert={onCloseLevelAlert}
          onResetSetupAlerts={onResetSetupAlerts}
          alertsMuted={levelAlertsMuted}
          onToggleAlertsMuted={onToggleAlertsMuted}
          firedAlertsCount={levelAlertsFiredCount}
        />
      )}
    </div>
  );
};

export const MultiChartContainer: React.FC<MultiChartContainerProps> = ({
  currentSymbol,
  currentTimeframe,
  layout,
  syncSymbol,
  onLayoutChange,
  onToggleSyncSymbol,
  onActiveSymbolChange,
  onActiveTimeframeChange,
  levelAlert,
  onCloseLevelAlert,
  onResetSetupAlerts,
  levelAlertsMuted,
  onToggleAlertsMuted,
  levelAlertsFiredCount
}) => {
  const { isDark } = useTheme();

  // Load slots from localStorage or fallback
  const [slots, setSlots] = useState<MultiChartSlot[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_SLOTS_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length >= 6) {
          return parsed;
        }
      }
    } catch {}
    const init = [...DEFAULT_SLOTS];
    if (currentSymbol) init[0].symbol = currentSymbol;
    if (currentTimeframe) init[0].timeframe = currentTimeframe;
    return init;
  });

  const [activeChartId, setActiveChartId] = useState<number>(0);
  const [maximizedChartId, setMaximizedChartId] = useState<number | null>(null);
  const [isMobile, setIsMobile] = useState<boolean>(() => typeof window !== 'undefined' && window.innerWidth < 768);
  const [mobileMode, setMobileMode] = useState<'tabs' | 'grid'>('tabs');

  // Handle window resizing for responsive mobile adjustments
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Save slots changes to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_SLOTS_KEY, JSON.stringify(slots));
    } catch {}
  }, [slots]);

  // Synchronize slot 0 with external currentSymbol when needed
  useEffect(() => {
    if (currentSymbol) {
      if (syncSymbol) {
        // Sync to all slots if changed externally
        setSlots((prev) =>
          prev.map((s, idx) => (idx < layout ? { ...s, symbol: currentSymbol } : s))
        );
      } else {
        // Update active slot
        setSlots((prev) =>
          prev.map((s) => (s.id === activeChartId ? { ...s, symbol: currentSymbol } : s))
        );
      }
    }
  }, [currentSymbol, syncSymbol, layout]);

  // Handle symbol change from within a chart pane
  const handlePaneSymbolChange = useCallback(
    (slotId: number, newSymbol: string) => {
      if (syncSymbol) {
        // Update all visible slots
        setSlots((prev) =>
          prev.map((s, idx) => (idx < layout ? { ...s, symbol: newSymbol } : s))
        );
      } else {
        // Update only this slot
        setSlots((prev) =>
          prev.map((s) => (s.id === slotId ? { ...s, symbol: newSymbol } : s))
        );
      }
      if (onActiveSymbolChange) {
        onActiveSymbolChange(newSymbol);
      }
    },
    [syncSymbol, layout, onActiveSymbolChange]
  );

  // Handle timeframe change for a specific slot (always independent!)
  const handlePaneTimeframeChange = useCallback(
    (slotId: number, newTf: string) => {
      setSlots((prev) =>
        prev.map((s) => (s.id === slotId ? { ...s, timeframe: newTf } : s))
      );
      if (slotId === activeChartId && onActiveTimeframeChange) {
        onActiveTimeframeChange(newTf);
      }
    },
    [activeChartId, onActiveTimeframeChange]
  );

  // Number of active visible slots (1 to 6)
  const visibleSlots = useMemo(() => {
    const count = Math.min(Math.max(1, layout), 6);
    return slots.slice(0, count);
  }, [slots, layout]);

  // Grid styling based on active layout
  const getGridStyle = (): React.CSSProperties => {
    if (maximizedChartId !== null) {
      return {
        display: 'flex',
        width: '100%',
        height: '100%',
        flex: 1,
        minHeight: 0,
        minWidth: 0,
        position: 'relative',
        overflow: 'hidden'
      };
    }

    if (isMobile && mobileMode === 'tabs') {
      return {
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        height: '100%',
        flex: 1,
        minHeight: 0,
        minWidth: 0,
        overflow: 'hidden'
      };
    }

    const baseStyle: React.CSSProperties = {
      display: 'grid',
      gap: '4px',
      width: '100%',
      height: '100%',
      flex: 1,
      minHeight: 0,
      minWidth: 0,
      overflow: 'hidden'
    };

    switch (layout) {
      case 1:
        return {
          ...baseStyle,
          gridTemplateColumns: '1fr',
          gridTemplateRows: '1fr'
        };
      case 2:
        return {
          ...baseStyle,
          gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
          gridTemplateRows: isMobile ? '1fr 1fr' : '1fr'
        };
      case 3:
        return {
          ...baseStyle,
          gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
          gridTemplateRows: isMobile ? '1fr 1fr 1fr' : '1fr 1fr'
        };
      case 4:
        return {
          ...baseStyle,
          gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
          gridTemplateRows: isMobile ? 'repeat(4, 1fr)' : '1fr 1fr'
        };
      case 5:
        return {
          ...baseStyle,
          gridTemplateColumns: isMobile ? '1fr' : 'repeat(6, 1fr)',
          gridTemplateRows: isMobile ? 'repeat(5, 1fr)' : '1fr 1fr'
        };
      case 6:
        return {
          ...baseStyle,
          gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)',
          gridTemplateRows: isMobile ? 'repeat(6, 1fr)' : '1fr 1fr'
        };
      default:
        return {
          ...baseStyle,
          gridTemplateColumns: '1fr',
          gridTemplateRows: '1fr'
        };
    }
  };

  // Specific cell styling for irregular layouts (3 and 5 charts)
  const getCellGridStyle = (index: number): React.CSSProperties => {
    if (maximizedChartId !== null || isMobile) {
      return { width: '100%', height: '100%', minHeight: 0, minWidth: 0 };
    }

    if (layout === 3) {
      if (index === 0) {
        return { gridColumn: '1 / span 2', gridRow: '1', width: '100%', height: '100%', minHeight: 0, minWidth: 0 };
      } else if (index === 1) {
        return { gridColumn: '1 / 2', gridRow: '2', width: '100%', height: '100%', minHeight: 0, minWidth: 0 };
      } else if (index === 2) {
        return { gridColumn: '2 / 3', gridRow: '2', width: '100%', height: '100%', minHeight: 0, minWidth: 0 };
      }
    }

    if (layout === 5) {
      if (index === 0) {
        return { gridColumn: 'span 3', gridRow: '1', width: '100%', height: '100%', minHeight: 0, minWidth: 0 };
      } else if (index === 1) {
        return { gridColumn: 'span 3', gridRow: '1', width: '100%', height: '100%', minHeight: 0, minWidth: 0 };
      } else if (index === 2) {
        return { gridColumn: 'span 2', gridRow: '2', width: '100%', height: '100%', minHeight: 0, minWidth: 0 };
      } else if (index === 3) {
        return { gridColumn: 'span 2', gridRow: '2', width: '100%', height: '100%', minHeight: 0, minWidth: 0 };
      } else if (index === 4) {
        return { gridColumn: 'span 2', gridRow: '2', width: '100%', height: '100%', minHeight: 0, minWidth: 0 };
      }
    }

    return { width: '100%', height: '100%', minHeight: 0, minWidth: 0 };
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        height: '100%',
        minHeight: 0,
        minWidth: 0,
        flex: 1,
        position: 'relative',
        overflow: 'hidden'
      }}
    >
      {/* Mobile Mode Selector & Chart Switcher Tabs */}
      {isMobile && layout > 1 && maximizedChartId === null && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '6px',
            padding: '4px 6px',
            background: isDark ? 'rgba(15, 23, 42, 0.7)' : '#f8fafc',
            borderBottom: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.08)' : '#e2e8f0'}`,
            flexShrink: 0,
            overflowX: 'auto'
          }}
        >
          {/* Chart selection tabs */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', overflowX: 'auto' }}>
            {visibleSlots.map((s, idx) => {
              const isSelected = activeChartId === s.id;
              return (
                <button
                  key={s.id}
                  onClick={() => setActiveChartId(s.id)}
                  style={{
                    padding: '3px 8px',
                    fontSize: '11px',
                    fontWeight: isSelected ? '800' : '600',
                    borderRadius: '6px',
                    border: 'none',
                    background: isSelected ? '#0284c7' : (isDark ? 'rgba(255,255,255,0.06)' : '#e2e8f0'),
                    color: isSelected ? '#ffffff' : 'var(--text-secondary)',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {idx + 1}: {s.symbol.replace('NSE:', '').replace('MCX:', '')} ({s.timeframe}m)
                </button>
              );
            })}
          </div>

          {/* Toggle Mobile Tabs vs Stacked Grid */}
          <button
            onClick={() => setMobileMode(mobileMode === 'tabs' ? 'grid' : 'tabs')}
            style={{
              padding: '3px 7px',
              fontSize: '10.5px',
              fontWeight: '700',
              borderRadius: '5px',
              border: `1px solid ${isDark ? 'rgba(56, 189, 248, 0.3)' : '#bae6fd'}`,
              background: 'transparent',
              color: '#38bdf8',
              cursor: 'pointer',
              whiteSpace: 'nowrap'
            }}
          >
            {mobileMode === 'tabs' ? '📱 Grid' : '📱 Tab View'}
          </button>
        </div>
      )}

      {/* Grid Canvas for 1-6 Charts */}
      <div style={getGridStyle()}>
        {maximizedChartId !== null ? (
          // Render only the single maximized chart
          (() => {
            const maxSlot = slots.find((s) => s.id === maximizedChartId) || slots[0];
            const maxIndex = slots.findIndex((s) => s.id === maxSlot.id);
            return (
              <div style={{ width: '100%', height: '100%', minHeight: 0, minWidth: 0 }}>
                <ChartSlotPane
                  key={`max-${maxSlot.id}-${maxSlot.symbol}-${maxSlot.timeframe}`}
                  slot={maxSlot}
                  index={maxIndex >= 0 ? maxIndex : 0}
                  isActive={true}
                  isMaximized={true}
                  isMultiChart={layout > 1}
                  onSelect={() => {
                    setActiveChartId(maxSlot.id);
                    if (onActiveSymbolChange) onActiveSymbolChange(maxSlot.symbol);
                  }}
                  onToggleMaximize={() => setMaximizedChartId(null)}
                  onSymbolChange={(sym) => handlePaneSymbolChange(maxSlot.id, sym)}
                  onTimeframeChange={(tf) => handlePaneTimeframeChange(maxSlot.id, tf)}
                  levelAlert={levelAlert}
                  onCloseLevelAlert={onCloseLevelAlert}
                  onResetSetupAlerts={onResetSetupAlerts}
                  levelAlertsMuted={levelAlertsMuted}
                  onToggleAlertsMuted={onToggleAlertsMuted}
                  levelAlertsFiredCount={levelAlertsFiredCount}
                />
              </div>
            );
          })()
        ) : isMobile && mobileMode === 'tabs' ? (
          // Render active chart in mobile tab mode
          (() => {
            const currentSlot = slots.find((s) => s.id === activeChartId) || visibleSlots[0];
            const currentIndex = visibleSlots.findIndex((s) => s.id === currentSlot.id);
            return (
              <div style={{ width: '100%', height: '100%', minHeight: 0, minWidth: 0 }}>
                <ChartSlotPane
                  key={`mob-${currentSlot.id}-${currentSlot.symbol}-${currentSlot.timeframe}`}
                  slot={currentSlot}
                  index={currentIndex >= 0 ? currentIndex : 0}
                  isActive={true}
                  isMaximized={false}
                  isMultiChart={layout > 1}
                  onSelect={() => {
                    setActiveChartId(currentSlot.id);
                    if (onActiveSymbolChange) onActiveSymbolChange(currentSlot.symbol);
                  }}
                  onToggleMaximize={() => setMaximizedChartId(currentSlot.id)}
                  onSymbolChange={(sym) => handlePaneSymbolChange(currentSlot.id, sym)}
                  onTimeframeChange={(tf) => handlePaneTimeframeChange(currentSlot.id, tf)}
                  levelAlert={levelAlert}
                  onCloseLevelAlert={onCloseLevelAlert}
                  onResetSetupAlerts={onResetSetupAlerts}
                  levelAlertsMuted={levelAlertsMuted}
                  onToggleAlertsMuted={onToggleAlertsMuted}
                  levelAlertsFiredCount={levelAlertsFiredCount}
                />
              </div>
            );
          })()
        ) : (
          // Render all visible slots in CSS Grid
          visibleSlots.map((slot, index) => {
            const isActive = activeChartId === slot.id;
            return (
              <div key={`grid-${slot.id}`} style={getCellGridStyle(index)}>
                <ChartSlotPane
                  slot={slot}
                  index={index}
                  isActive={isActive}
                  isMaximized={false}
                  isMultiChart={layout > 1}
                  onSelect={() => {
                    setActiveChartId(slot.id);
                    if (onActiveSymbolChange) onActiveSymbolChange(slot.symbol);
                    if (onActiveTimeframeChange) onActiveTimeframeChange(slot.timeframe);
                  }}
                  onToggleMaximize={() => setMaximizedChartId(slot.id)}
                  onSymbolChange={(sym) => handlePaneSymbolChange(slot.id, sym)}
                  onTimeframeChange={(tf) => handlePaneTimeframeChange(slot.id, tf)}
                  levelAlert={isActive ? levelAlert : null}
                  onCloseLevelAlert={onCloseLevelAlert}
                  onResetSetupAlerts={onResetSetupAlerts}
                  levelAlertsMuted={levelAlertsMuted}
                  onToggleAlertsMuted={onToggleAlertsMuted}
                  levelAlertsFiredCount={levelAlertsFiredCount}
                />
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
