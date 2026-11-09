import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { ChartContainer } from './ChartContainer';
import { tvStreamer, getBackendHttpUrl } from '../utils/tvStreamer';
import type { Candle } from '../utils/profileCalculator';
import { calculateMatrixSeriesData, type MatrixSeriesData } from '../utils/matrixCalculator';
import { filterMarketHoursCandles, isWithinMarketHours } from '../utils/marketHours';
import { useTheme } from '../context/ThemeContext';
import {
  ALL_CHART_LAYOUTS,
  MultiChartLayoutId,
  getLayoutConfig
} from '../utils/multiChartLayouts';
import {
  Loader2,
  Maximize2,
  Minimize2
} from 'lucide-react';

export interface MultiChartSlot {
  id: number;
  symbol: string;
  timeframe: string;
}

// 8 Default Slots for up to 8 simultaneous charts
export const DEFAULT_8_SLOTS: MultiChartSlot[] = [
  { id: 0, symbol: 'NSE:NIFTY', timeframe: '5' },
  { id: 1, symbol: 'NSE:BANKNIFTY', timeframe: '5' },
  { id: 2, symbol: 'NSE:FINNIFTY', timeframe: '15' },
  { id: 3, symbol: 'NSE:RELIANCE', timeframe: '5' },
  { id: 4, symbol: 'MCX:CRUDEOIL', timeframe: '15' },
  { id: 5, symbol: 'MCX:GOLD', timeframe: '5' },
  { id: 6, symbol: 'NSE:HDFCBANK', timeframe: '5' },
  { id: 7, symbol: 'NSE:INFY', timeframe: '5' }
];

const STORAGE_LAYOUT_KEY = 'tradingguru_multichart_layout';
const STORAGE_SYNC_KEY = 'tradingguru_multichart_sync_symbol';
const STORAGE_SLOTS_KEY = 'tradingguru_multichart_slots';

export interface MultiChartContainerProps {
  currentSymbol: string;
  currentTimeframe: string;
  layout: MultiChartLayoutId | number | string;
  onLayoutChange: (layout: MultiChartLayoutId | any) => void;
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
          if (data.matrixHistory) {
            setMatrixHistory(data.matrixHistory);
          }
          if (data.candles && Array.isArray(data.candles) && data.candles.length > 0 && tvStreamer.isSymbolMatch(sym, symbol)) {
            const filtered = filterMarketHoursCandles(data.candles, symbol, timeframe);
            const sanitized = [...filtered].map(c => ({ ...c, time: Number(c.time) })).sort((a, b) => (a.time as number) - (b.time as number));
            setCandles(sanitized);
            setLoading(false);
            setConnectionStatus('connected');
            loadedKeyRef.current = currentKey;
          } else {
            setLoading(false);
          }
        } else {
          setLoading(false);
        }

        // Parallel fetch matrix-levels to guarantee static anchor levels are locked and available
        fetch(`${backendHttp}/api/matrix-levels?symbol=${encodeURIComponent(symbol)}&timeframe=${timeframe}`, {
          headers: { 'bypass-tunnel-reminder': 'true' }
        })
          .then(r => r.json())
          .then(mlData => {
            if (mlData?.matrixHistory && isSubscribed && isMountedRef.current) {
              setMatrixHistory(mlData.matrixHistory);
            }
          })
          .catch(() => {});
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
              return [...filtered].map(c => ({ ...c, time: Number(c.time) })).sort((a, b) => a.time - b.time);
            } else {
              if (prevCandles.length === 0) return prevCandles;
              const rawTick = data.candles[0];
              const tickTime = Number(rawTick.time);
              if (isNaN(tickTime) || !isWithinMarketHours(tickTime, symbol, timeframe)) {
                return prevCandles;
              }
              const tick = { ...rawTick, time: tickTime };
              const idx = prevCandles.findIndex((c) => Number(c.time) === tickTime);
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
  onLayoutChange,
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

  // Resolve layout config (supporting up to 8 charts)
  const layoutConfig = useMemo(() => getLayoutConfig(layout), [layout]);
  const activeChartCount = layoutConfig.chartCount;

  // Load up to 8 slots from localStorage or fallback
  const [slots, setSlots] = useState<MultiChartSlot[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_SLOTS_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length >= 8) {
          return parsed;
        } else if (Array.isArray(parsed) && parsed.length > 0) {
          // Merge with DEFAULT_8_SLOTS to ensure at least 8 slots
          const merged = [...DEFAULT_8_SLOTS];
          parsed.forEach((p, idx) => {
            if (idx < 8) merged[idx] = { ...merged[idx], ...p };
          });
          return merged;
        }
      }
    } catch {}
    const init = [...DEFAULT_8_SLOTS];
    if (currentSymbol) init[0].symbol = currentSymbol;
    if (currentTimeframe) init[0].timeframe = currentTimeframe;
    return init;
  });

  const [activeChartId, setActiveChartId] = useState<number>(0);
  const [maximizedChartId, setMaximizedChartId] = useState<number | null>(null);
  const [isMobile, setIsMobile] = useState<boolean>(() => typeof window !== 'undefined' && window.innerWidth < 768);
  const [mobileMode, setMobileMode] = useState<'tabs' | 'grid'>('tabs');
  const [isLayoutSelectorOpen, setIsLayoutSelectorOpen] = useState<boolean>(false);

  // Handle window resizing for responsive adjustments
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

  // When external currentSymbol changes (e.g. from top search or watchlist),
  // update ONLY the currently active/focused chart slot
  useEffect(() => {
    if (currentSymbol) {
      setSlots((prev) =>
        prev.map((s) => (s.id === activeChartId ? { ...s, symbol: currentSymbol } : s))
      );
    }
  }, [currentSymbol, activeChartId]);

  // Handle symbol change from within an individual chart pane (always independent)
  const handlePaneSymbolChange = useCallback(
    (slotId: number, newSymbol: string) => {
      setSlots((prev) =>
        prev.map((s) => (s.id === slotId ? { ...s, symbol: newSymbol } : s))
      );
      if (onActiveSymbolChange) {
        onActiveSymbolChange(newSymbol);
      }
    },
    [onActiveSymbolChange]
  );

  // Handle timeframe change for a specific slot (independent per chart)
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

  // Visible slots based on the active layout's chart count (1 to 8)
  const visibleSlots = useMemo(() => {
    return slots.slice(0, activeChartCount);
  }, [slots, activeChartCount]);

  // Grid styling based on active layout
  const gridContainerStyle = useMemo((): React.CSSProperties => {
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

    return layoutConfig.gridStyle(isMobile);
  }, [maximizedChartId, isMobile, mobileMode, layoutConfig]);

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
      {/* Maximized Restore Banner (Only visible when a chart is expanded) */}
      {maximizedChartId !== null && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '5px 12px',
            background: isDark ? 'rgba(2, 132, 199, 0.2)' : '#e0f2fe',
            borderBottom: '1px solid rgba(56, 189, 248, 0.35)',
            flexShrink: 0,
            gap: '8px',
            zIndex: 10
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '12px', fontWeight: '800', color: '#38bdf8' }}>
              🔍 Chart {(slots.findIndex(s => s.id === maximizedChartId) >= 0 ? slots.findIndex(s => s.id === maximizedChartId) + 1 : 1)} is EXPANDED (Fullscreen)
            </span>
            <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
              (Double-click header or click Restore to return to {activeChartCount}-chart grid)
            </span>
          </div>

          <button
            onClick={() => setMaximizedChartId(null)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              padding: '4px 12px',
              borderRadius: '6px',
              background: '#0284c7',
              border: 'none',
              color: '#ffffff',
              fontSize: '11px',
              fontWeight: '800',
              cursor: 'pointer',
              boxShadow: '0 0 10px rgba(2, 132, 199, 0.4)'
            }}
            title="Return to the multi-chart grid layout"
          >
            <Minimize2 size={13} />
            <span>Restore Grid ({activeChartCount} Charts)</span>
          </button>
        </div>
      )}

      {/* Mobile Mode Chart Switcher Tabs */}
      {isMobile && activeChartCount > 1 && maximizedChartId === null && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            padding: '4px 6px',
            background: isDark ? 'rgba(15, 23, 42, 0.7)' : '#f8fafc',
            borderBottom: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.08)' : '#e2e8f0'}`,
            flexShrink: 0,
            overflowX: 'auto'
          }}
        >
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
      )}

      {/* Grid Canvas for 1-8 Charts */}
      <div style={gridContainerStyle}>
        {/*
          PERFORMANCE CRITICAL:
          We preserve all visible slots mounted in the DOM.
          When maximized, we simply hide other slots via CSS (display: 'none')
          so that lightweight-charts canvas stays in memory without unmounting,
          avoiding unnecessary chart reloads or re-fetching candles!
        */}
        {visibleSlots.map((slot, index) => {
          const isActive = activeChartId === slot.id;
          const isSlotMaximized = maximizedChartId === slot.id;

          // If a chart is maximized and it's NOT this slot, hide it cleanly
          if (maximizedChartId !== null && !isSlotMaximized) {
            return (
              <div
                key={`slot-${slot.id}`}
                style={{ display: 'none' }}
              />
            );
          }

          // In mobile tabs mode, hide inactive slots
          if (isMobile && mobileMode === 'tabs' && maximizedChartId === null && !isActive) {
            return (
              <div
                key={`slot-${slot.id}`}
                style={{ display: 'none' }}
              />
            );
          }

          const cellStyle: React.CSSProperties = maximizedChartId !== null
            ? { width: '100%', height: '100%', minHeight: 0, minWidth: 0, flex: 1 }
            : layoutConfig.getCellStyle(index, isMobile);

          return (
            <div
              key={`slot-${slot.id}`}
              style={{
                ...cellStyle,
                display: 'flex',
                flexDirection: 'column',
                position: 'relative',
                overflow: 'hidden'
              }}
            >
              <ChartSlotPane
                slot={slot}
                index={index}
                isActive={isActive}
                isMaximized={isSlotMaximized}
                isMultiChart={activeChartCount > 1}
                onSelect={() => {
                  setActiveChartId(slot.id);
                  if (onActiveSymbolChange) onActiveSymbolChange(slot.symbol);
                  if (onActiveTimeframeChange) onActiveTimeframeChange(slot.timeframe);
                }}
                onToggleMaximize={() => {
                  setMaximizedChartId((prev) => (prev === slot.id ? null : slot.id));
                }}
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
        })}
      </div>
    </div>
  );
};
