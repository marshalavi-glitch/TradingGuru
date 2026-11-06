import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { createChart } from 'lightweight-charts';
import type { IChartApi, ISeriesApi, Time } from 'lightweight-charts';
import { calculateDayProfile, type Candle } from '../utils/profileCalculator';
import { calculateMatrixSeriesData, type MatrixSeriesData } from '../utils/matrixCalculator';
import { AdvIndicatorPanel } from './AdvIndicatorPanel';
import { RealtimeLevelAlertPopup } from './RealtimeLevelAlertPopup';
import type { LevelAlert } from './RealtimeLevelAlertPopup';
import { Bell, RotateCcw, Zap, AlertCircle, Wifi, WifiOff, Plus, Minus, Maximize2, Minimize2, Search, X } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { isWithinMarketHours } from '../utils/marketHours';

interface ChartContainerProps {
  candles: Candle[];
  symbol: string;
  timeframe?: string;
  matrixSeriesData?: MatrixSeriesData | null;
  pocPrice?: number;
  vahPrice?: number;
  valPrice?: number;
  ibHigh?: number;
  ibLow?: number;
  
  // PDF-based reference levels
  priorPocPrice?: number;
  priorVahPrice?: number;
  priorValPrice?: number;
  poorHighPrice?: number;
  poorLowPrice?: number;
  untestedPocs?: { price: number; date: string }[];
  failedAuctions?: { price: number; type: 'high' | 'low'; date: string }[];
  ddGapTop?: number;
  ddGapBottom?: number;
  threeDayBalanceHigh?: number;
  threeDayBalanceLow?: number;

  // Session Opening props
  openPrice?: number;
  openingType?: string;

  // Active single prints
  activeSinglePrints?: { start: number; end: number }[];
  legacySapnas?: { start: number; end: number; date: string }[];

  // Visible price range change callback
  onVisiblePriceRangeChange?: (range: { min: number; max: number; paneHeight: number } | null) => void;

  // GEX Levels props (ready for scanner updates)
  gexCallWall?: number;
  gexPutWall?: number;
  gexFlipZone?: number;
  gexMaxPain?: number;
  sessionPeriod?: 'daily' | 'weekly' | 'monthly';

  // Real-time Connection status & errors
  connectionStatus?: 'connecting' | 'connected' | 'disconnected';
  connectionError?: string | null;

  // Global Level Alert Props (optional, when managed by App.tsx)
  activeAlert?: LevelAlert | null;
  onCloseAlert?: () => void;
  onResetSetupAlerts?: () => void;
  alertsMuted?: boolean;
  onToggleAlertsMuted?: () => void;
  firedAlertsCount?: number;

  // Multi-Chart Layout props
  isMultiChart?: boolean;
  chartIndex?: number;
  isActive?: boolean;
  isMaximized?: boolean;
  onSelect?: () => void;
  onToggleMaximize?: () => void;
  onSymbolChange?: (newSymbol: string) => void;
  onTimeframeChange?: (newTimeframe: string) => void;
}

// Indian Standard Time (IST) is UTC + 5:30 (19,800 seconds).
// TradingView Lightweight Charts formats all numeric timestamps internally as UTC.
// Shifting timestamps by +19,800 seconds maps the Indian market trading session
// from UTC 03:45-10:00 directly to 09:15-15:30 IST on the chart timescale and tooltips.
const IST_OFFSET_SECONDS = 19800;

export const ChartContainer: React.FC<ChartContainerProps> = ({
  candles,
  symbol,
  timeframe = '5',
  matrixSeriesData,
  sessionPeriod,
  pocPrice,
  vahPrice,
  valPrice,
  ibHigh,
  ibLow,
  priorPocPrice,
  priorVahPrice,
  priorValPrice,
  poorHighPrice,
  poorLowPrice,
  untestedPocs,
  failedAuctions,
  ddGapTop,
  ddGapBottom,
  threeDayBalanceHigh,
  threeDayBalanceLow,
  openPrice,
  openingType,
  activeSinglePrints,
  legacySapnas,
  onVisiblePriceRangeChange,
  gexCallWall,
  gexPutWall,
  gexFlipZone,
  gexMaxPain,
  connectionStatus = 'connected',
  connectionError = null,
  activeAlert: globalActiveAlert,
  onCloseAlert: globalOnCloseAlert,
  onResetSetupAlerts: globalOnResetSetupAlerts,
  alertsMuted: globalAlertsMuted,
  onToggleAlertsMuted: globalOnToggleAlertsMuted,
  firedAlertsCount: globalFiredAlertsCount,
  isMultiChart = false,
  chartIndex,
  isActive = false,
  isMaximized = false,
  onSelect,
  onToggleMaximize,
  onSymbolChange,
  onTimeframeChange
}) => {
  const { isDark } = useTheme();
  const [candleStyle, setCandleStyle] = useState<'japanese' | 'heikin-ashi'>('japanese');
  const [showAdvPanel, setShowAdvPanel] = useState<boolean>(false);
  const [showMobileChartTools, setShowMobileChartTools] = useState<boolean>(false);
  const [isPaneSearchOpen, setIsPaneSearchOpen] = useState(false);
  const [paneSearchQuery, setPaneSearchQuery] = useState('');

  const [hoveredCandle, setHoveredCandle] = useState<{
    open: number;
    high: number;
    low: number;
    close: number;
    time?: number | string;
  } | null>(null);

  // Local fallback state if not managed globally
  const [localActiveAlert, setLocalActiveAlert] = useState<LevelAlert | null>(null);
  const [localAlertsMuted, setLocalAlertsMuted] = useState<boolean>(false);
  const [localFiredCount, setLocalFiredCount] = useState<number>(0);
  const triggeredAlertsRef = useRef<Set<string>>(new Set());
  const currentSetupRef = useRef<string>('');
  const prevPriceRef = useRef<number | null>(null);

  const isGloballyManaged = globalOnResetSetupAlerts !== undefined;
  const activeAlert = isGloballyManaged ? (globalActiveAlert ?? null) : localActiveAlert;
  const alertsMuted = isGloballyManaged ? (globalAlertsMuted ?? false) : localAlertsMuted;
  const firedCount = isGloballyManaged ? (globalFiredAlertsCount ?? 0) : localFiredCount;
  const handleResetSetupAlerts = globalOnResetSetupAlerts || (() => {
    triggeredAlertsRef.current.clear();
    setLocalFiredCount(0);
    setLocalActiveAlert(null);
  });
  const handleToggleAlertsMuted = globalOnToggleAlertsMuted || (() => setLocalAlertsMuted(!localAlertsMuted));

  // Setup identifier (symbol + timeframe + session date)
  const latestCandle = candles && candles.length > 0 ? candles[candles.length - 1] : null;
  const sessionDate = latestCandle
    ? (typeof latestCandle.time === 'string'
        ? latestCandle.time.slice(0, 10)
        : new Date((latestCandle.time as number) * 1000).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }))
    : new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

  const setupKey = `${symbol}-${timeframe}-${sessionDate}`;

  // Derive Market Profile levels (POC, VAH, VAL, IB High, IB Low) from intraday candles if not explicitly passed
  const calculatedProfile = useMemo(() => {
    if (!candles || candles.length === 0) return null;
    try {
      let todayCandles = candles.filter((c) => {
        const d = typeof c.time === 'string'
          ? c.time.slice(0, 10)
          : new Date((c.time as number) * 1000).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
        return d === sessionDate;
      });

      if (todayCandles.length === 0) {
        todayCandles = candles;
      }
      return calculateDayProfile(sessionDate, todayCandles, 40, 'daily', undefined, undefined, symbol);
    } catch (e) {
      console.warn('[ChartContainer] calculateDayProfile error:', e);
      return null;
    }
  }, [candles, sessionDate, symbol]);

  const activePoc = pocPrice || calculatedProfile?.pocPrice;
  const activeVah = vahPrice || calculatedProfile?.vahPrice;
  const activeVal = valPrice || calculatedProfile?.valPrice;
  const activeIbHigh = ibHigh || calculatedProfile?.ibHigh;
  const activeIbLow = ibLow || calculatedProfile?.ibLow;

  // Reset alerts when setup changes (different stock, timeframe, or new day session)
  useEffect(() => {
    if (isGloballyManaged) return;
    if (currentSetupRef.current && currentSetupRef.current !== setupKey) {
      triggeredAlertsRef.current.clear();
      prevPriceRef.current = null;
      setLocalFiredCount(0);
      setLocalActiveAlert(null);
    }
    currentSetupRef.current = setupKey;
  }, [setupKey, isGloballyManaged]);

  // Real-time touch/cross detection against matrix trading levels (local fallback)
  useEffect(() => {
    if (isGloballyManaged || alertsMuted || !candles || candles.length === 0 || !matrixSeriesData) return;

    const currentCandle = candles[candles.length - 1];
    const currentPrice = currentCandle.close;
    const candleHigh = currentCandle.high;
    const candleLow = currentCandle.low;
    const prevPrice = prevPriceRef.current;

    const getLevelVal = (points?: { value: number }[]) =>
      points && points.length > 0 ? points[points.length - 1].value : undefined;

    const monitoredLevels: { id: string; type: LevelAlert['type']; price?: number; label: string }[] = [
      { id: 'level4_r3', type: 'SELL REVERSAL', price: getLevelVal(matrixSeriesData.level4), label: 'Sell Reversal (R3)' },
      { id: 'level7_s3', type: 'BUY REVERSAL', price: getLevelVal(matrixSeriesData.level7), label: 'Buy Reversal (S3)' },
      { id: 'level3_r4', type: 'BREAKOUT', price: getLevelVal(matrixSeriesData.level3), label: 'Bullish Breakout (R4)' },
      { id: 'level8_s4', type: 'BREAK DOWN', price: getLevelVal(matrixSeriesData.level8), label: 'Bearish Breakdown (S4)' },
      { id: 'level2_r5', type: 'TARGET 1', price: getLevelVal(matrixSeriesData.level2), label: 'Target 1 Hit (R5)' },
      { id: 'level9_s5', type: 'TARGET 1', price: getLevelVal(matrixSeriesData.level9), label: 'Target 1 Hit (S5)' },
      { id: 'level1_r6', type: 'TARGET 2', price: getLevelVal(matrixSeriesData.level1), label: 'Target 2 Hit (R6)' },
      { id: 'level10_s6', type: 'TARGET 2', price: getLevelVal(matrixSeriesData.level10), label: 'Target 2 Hit (S6)' },
    ];

    for (const lvl of monitoredLevels) {
      if (!lvl.price || lvl.price <= 0) continue;
      if (triggeredAlertsRef.current.has(lvl.id)) continue;

      let isTriggered = false;

      // 1. Cross up through level
      if (prevPrice !== null && prevPrice < lvl.price && currentPrice >= lvl.price) {
        isTriggered = true;
      }
      // 2. Cross down through level
      else if (prevPrice !== null && prevPrice > lvl.price && currentPrice <= lvl.price) {
        isTriggered = true;
      }
      // 3. Candle range touch
      else if (candleHigh >= lvl.price && candleLow <= lvl.price) {
        isTriggered = true;
      }
      // 4. Proximity touch within 0.05%
      else if (Math.abs(currentPrice - lvl.price) / lvl.price <= 0.0005) {
        isTriggered = true;
      }

      if (isTriggered) {
        triggeredAlertsRef.current.add(lvl.id);
        setLocalFiredCount(triggeredAlertsRef.current.size);

        const istTime = new Intl.DateTimeFormat('en-IN', {
          timeZone: 'Asia/Kolkata',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true
        }).format(new Date()) + ' IST';

        setLocalActiveAlert({
          id: `${symbol}-${lvl.id}-${Date.now()}`,
          symbol,
          alertType: lvl.type,
          type: lvl.type,
          triggeredPrice: currentPrice,
          levelPrice: lvl.price,
          timestamp: istTime,
          setupKey,
          levelName: lvl.label,
          levelLabel: lvl.label,
          isBullish: lvl.type === 'BUY REVERSAL' || lvl.type === 'BREAKOUT' || lvl.id.startsWith('level2') || lvl.id.startsWith('level1'),
          condition: 'touched'
        });

        // Trigger one alert per tick
        break;
      }
    }

    prevPriceRef.current = currentPrice;
  }, [candles, matrixSeriesData, symbol, setupKey, alertsMuted, isGloballyManaged]);
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candlestickSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);
  const vwapSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const levelsSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const prevDatasetKeyRef = useRef<string>('');
  const prevCandlesCountRef = useRef<number>(0);
  const lastAppliedCandleTimeRef = useRef<number | null>(null);
  const lastVwapAppliedTimeRef = useRef<number | null>(null);
  
  // Custom price lines for profile metrics
  const pocLineRef = useRef<any>(null);
  const vahLineRef = useRef<any>(null);
  const valLineRef = useRef<any>(null);

  // Price lines for Initial Balance & Extensions
  const ibHighLineRef = useRef<any>(null);
  const ibLowLineRef = useRef<any>(null);
  const ext1618UpLineRef = useRef<any>(null);
  const ext1618DownLineRef = useRef<any>(null);
  const ext2618UpLineRef = useRef<any>(null);
  const ext2618DownLineRef = useRef<any>(null);
  const ext3618UpLineRef = useRef<any>(null);
  const ext3618DownLineRef = useRef<any>(null);

  // PDF references
  const priorPocLineRef = useRef<any>(null);
  const priorVahLineRef = useRef<any>(null);
  const priorValLineRef = useRef<any>(null);
  const poorHighLineRef = useRef<any>(null);
  const poorLowLineRef = useRef<any>(null);
  const ddGapTopLineRef = useRef<any>(null);
  const ddGapBottomLineRef = useRef<any>(null);
  const threeDayBalHighLineRef = useRef<any>(null);
  const threeDayBalLowLineRef = useRef<any>(null);
  const untestedPocLinesRef = useRef<any[]>([]);
  const failedAuctionLinesRef = useRef<any[]>([]);
  const activeSinglePrintLinesRef = useRef<any[]>([]);
  const legacySapnaLinesRef = useRef<any[]>([]);
  const matrixSeriesRef = useRef<any[]>([]);

  // Open line
  const openPriceLineRef = useRef<any>(null);
  const lastSymbolTimeframeRef = useRef<string>('');

  const candlesRef = useRef<Candle[]>(candles);
  candlesRef.current = candles;

  const symbolDisplayName = useMemo(() => {
    if (!symbol) return 'Nifty 50 Index';
    if (symbol.includes('NIFTY') && !symbol.includes('BANK') && !symbol.includes('FIN') && !symbol.includes('MID')) return 'Nifty 50 Index';
    if (symbol.includes('BANKNIFTY')) return 'Bank Nifty Index';
    if (symbol.includes('FINNIFTY')) return 'Nifty Fin Service';
    if (symbol.includes('MIDCPNIFTY')) return 'Nifty Midcap 50';
    if (symbol.includes('SENSEX')) return 'BSE Sensex Index';
    if (symbol.includes('RELIANCE')) return 'Reliance Industries';
    if (symbol.includes('CRUDEOIL')) return 'Crude Oil Futures';
    return symbol.replace('NSE:', '').replace('NFO:', '').replace('BSE:', '').replace('MCX:', '');
  }, [symbol]);

  // Orderflow Levels (Marshall Matrix Engine)
  const activeOrderflowLevels = useMemo(() => {
    const currentPrice = (candles && candles.length > 0) ? candles[candles.length - 1].close : 0;
    const isMatrixCompatible = matrixSeriesData && matrixSeriesData.level1 && matrixSeriesData.level1.length > 0 &&
      currentPrice > 0 &&
      Math.abs(matrixSeriesData.level1[matrixSeriesData.level1.length - 1].value - currentPrice) / currentPrice < 2.0;

    const effData = isMatrixCompatible
      ? matrixSeriesData!
      : calculateMatrixSeriesData(candles, timeframe);

    const getLatest = (arr?: any[]) => {
      if (!arr || arr.length === 0) return 0;
      return arr[arr.length - 1].value;
    };

    const r6 = getLatest(effData.level1);
    const r5 = getLatest(effData.level2);
    const r4 = getLatest(effData.level3);
    const r3 = getLatest(effData.level4);
    const r2 = getLatest(effData.level5);
    const s2 = getLatest(effData.level6);
    const s3 = getLatest(effData.level7);
    const s4 = getLatest(effData.level8);
    const s5 = getLatest(effData.level9);
    const s6 = getLatest(effData.level10);

    if (!r6 && !r4) return [];

    const darkLine = isDark ? '#94a3b8' : '#1e293b';

    return [
      { key: 'r6', price: r6, title: 'Target', color: '#f23645', labelColor: '#f23645', lineStyle: 'solid' as const, lineWidth: 1.5, hasExtension: false },
      { key: 'r5', price: r5, title: 'Target', color: '#f23645', labelColor: '#f23645', lineStyle: 'solid' as const, lineWidth: 1.5, hasExtension: true, extensionColor: '#f23645' },
      { key: 'r4', price: r4, title: 'Breakout', color: '#f59e0b', labelColor: '#f59e0b', lineStyle: 'solid' as const, lineWidth: 1.5, hasExtension: true, extensionColor: '#f59e0b' },
      { key: 'r3', price: r3, title: 'Sell reversal', color: darkLine, labelColor: '#f23645', lineStyle: 'solid' as const, lineWidth: 1.5, hasExtension: false },
      { key: 'r2', price: r2, title: '', color: '#9333ea', labelColor: '#9333ea', lineStyle: 'solid' as const, lineWidth: 1.2, hasExtension: false },
      { key: 's2', price: s2, title: '', color: '#9333ea', labelColor: '#9333ea', lineStyle: 'solid' as const, lineWidth: 1.2, hasExtension: false },
      { key: 's3', price: s3, title: 'Buy Reversal', color: darkLine, labelColor: '#089981', lineStyle: 'solid' as const, lineWidth: 1.5, hasExtension: false },
      { key: 's4', price: s4, title: 'Break Down', color: '#f59e0b', labelColor: '#f59e0b', lineStyle: 'solid' as const, lineWidth: 1.5, hasExtension: true, extensionColor: '#f59e0b' },
      { key: 's5', price: s5, title: 'Target', color: '#f23645', labelColor: '#f23645', lineStyle: 'solid' as const, lineWidth: 1.5, hasExtension: false },
      { key: 's6', price: s6, title: 'Target', color: '#f23645', labelColor: '#f23645', lineStyle: 'solid' as const, lineWidth: 1.5, hasExtension: true, extensionColor: '#f23645' },
    ];
  }, [matrixSeriesData, candles, timeframe, isDark]);

  const activeOrderflowLevelsRef = useRef(activeOrderflowLevels);
  activeOrderflowLevelsRef.current = activeOrderflowLevels;

  const [orderflowLines, setOrderflowLines] = useState<{
    startX: number;
    rightX: number;
    labelX: number;
    lines: Array<{
      key: string;
      title: string;
      price: number;
      y: number;
      color: string;
      labelColor: string;
      lineStyle: 'solid' | 'dashed';
      lineWidth: number;
      hasExtension?: boolean;
      extensionColor?: string;
    }>;
  }>({ startX: 0, rightX: 0, labelX: 0, lines: [] });

  // GEX Refs
  const gexCallWallLineRef = useRef<any>(null);
  const gexPutWallLineRef = useRef<any>(null);
  const gexFlipZoneLineRef = useRef<any>(null);
  const gexMaxPainLineRef = useRef<any>(null);

  const onVisiblePriceRangeChangeRef = useRef(onVisiblePriceRangeChange);
  const handleRangeChangeRef = useRef<() => void>(() => {});

  // Y-Axis Zoom Level (1.0 = auto default, > 1.0 = zoom out / compress candles, < 1.0 = zoom in / expand candles)
  const [yZoom, setYZoom] = useState<number>(1.25);
  const yZoomRef = useRef<number>(1.25);
  const handleYZoomRef = useRef<(delta: number) => void>(() => {});
  const handleYResetRef = useRef<() => void>(() => {});

  const getAutoscaleProvider = useCallback((zoomVal: number) => {
    return (original: () => any) => {
      const res = original();
      if (!res || !res.priceRange) return null;
      const min = res.priceRange.minValue;
      const max = res.priceRange.maxValue;
      const mid = (min + max) / 2;
      const rawSpan = Math.max(max - min, 1);

      // Ensure healthy minimum price span so ticks are not spaced 4 points apart on flat market
      // For NIFTY (mid ~ 24,000), 0.35% is ~84 points.
      // For BANKNIFTY (mid ~ 53,000), 0.35% is ~185 points.
      // For stocks, 0.5% gives a natural view.
      const minPct = mid > 10000 ? 0.0035 : (mid > 1000 ? 0.005 : 0.01);
      const minSpan = Math.max(rawSpan, mid * minPct);

      const halfSpan = (minSpan / 2) * zoomVal;

      return {
        priceRange: {
          minValue: mid - halfSpan,
          maxValue: mid + halfSpan,
        },
        margins: {
          above: 0.08,
          below: 0.08,
        }
      };
    };
  }, []);

  const handleYZoom = useCallback((delta: number) => {
    // delta < 0: zoom in (decrease price range, taller candles)
    // delta > 0: zoom out (increase price range, shorter candles)
    const current = yZoomRef.current;
    let nextZoom = delta > 0 ? current * 1.25 : current * 0.8;
    nextZoom = Math.max(0.3, Math.min(6.0, nextZoom));
    nextZoom = Math.round(nextZoom * 100) / 100;
    yZoomRef.current = nextZoom;
    setYZoom(nextZoom);

    if (candlestickSeriesRef.current) {
      candlestickSeriesRef.current.applyOptions({
        autoscaleInfoProvider: getAutoscaleProvider(nextZoom)
      });
    }
    if (chartRef.current) {
      chartRef.current.priceScale('right').applyOptions({ autoScale: true });
      requestAnimationFrame(handleRangeChangeRef.current);
    }
  }, [getAutoscaleProvider]);

  const handleYReset = useCallback(() => {
    yZoomRef.current = 1.0;
    setYZoom(1.0);
    if (candlestickSeriesRef.current) {
      candlestickSeriesRef.current.applyOptions({
        autoscaleInfoProvider: getAutoscaleProvider(1.0)
      });
    }
    if (chartRef.current) {
      chartRef.current.priceScale('right').applyOptions({ autoScale: true });
      requestAnimationFrame(handleRangeChangeRef.current);
    }
  }, [getAutoscaleProvider]);

  useEffect(() => {
    handleYZoomRef.current = handleYZoom;
    handleYResetRef.current = handleYReset;
  }, [handleYZoom, handleYReset]);

  useEffect(() => {
    onVisiblePriceRangeChangeRef.current = onVisiblePriceRangeChange;
  }, [onVisiblePriceRangeChange]);

  useEffect(() => {
    if (!chartContainerRef.current) return;

    const initialWidth = chartContainerRef.current.clientWidth || 800;
    const initialHeight = chartContainerRef.current.clientHeight || 500;

    // Create chart instance matching TradingView standard styling
    const chart = createChart(chartContainerRef.current, {
      width: initialWidth,
      height: initialHeight,
      layout: {
        background: { color: isDark ? '#0b0e14' : '#ffffff' },
        textColor: isDark ? '#9ca3af' : '#787b86',
        fontSize: 11,
        fontFamily: "'Outfit', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
      },
      handleScroll: {
        vertTouchDrag: true,
        horzTouchDrag: true,
        mouseWheel: true,
        pressedMouseMove: true,
      },
      handleScale: {
        axisPressedMouseMove: true,
        mouseWheel: true,
        pinch: true,
      },
      grid: {
        vertLines: { color: isDark ? 'rgba(255, 255, 255, 0.04)' : '#f0f3fa' },
        horzLines: { color: isDark ? 'rgba(255, 255, 255, 0.04)' : '#f0f3fa' }
      },
      crosshair: {
        mode: 1, // CrosshairMode.Normal
        vertLine: {
          color: isDark ? 'rgba(255, 255, 255, 0.2)' : '#9598a1',
          width: 1,
          style: 3, // LineStyle.Dashed
          labelBackgroundColor: isDark ? '#1e293b' : '#334155'
        },
        horzLine: {
          color: isDark ? 'rgba(255, 255, 255, 0.2)' : '#9598a1',
          width: 1,
          style: 3, // LineStyle.Dashed
          labelBackgroundColor: isDark ? '#1e293b' : '#334155'
        }
      },
      rightPriceScale: {
        borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#e0e3eb',
        visible: true,
        autoScale: true,
        scaleMargins: {
          top: 0.1,
          bottom: 0.12
        }
      },
      localization: {
        locale: 'en-IN',
        dateFormat: 'dd MMM yyyy',
        timeFormatter: (time: number) => {
          const d = new Date(time * 1000);
          const hours = String(d.getUTCHours()).padStart(2, '0');
          const minutes = String(d.getUTCMinutes()).padStart(2, '0');
          return `${hours}:${minutes}`;
        }
      },
      timeScale: {
        borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#e0e3eb',
        timeVisible: true,
        secondsVisible: false,
        tickMarkFormatter: (time: number, tickMarkType: number) => {
          const d = new Date(time * 1000);
          // 0: Year, 1: Month, 2: DayOfMonth, 3: Time, 4: TimeWithSeconds
          if (tickMarkType === 2) {
            return String(d.getUTCDate());
          } else if (tickMarkType === 1) {
            return d.toLocaleString('en-IN', { month: 'short', timeZone: 'UTC' });
          } else if (tickMarkType === 0) {
            return String(d.getUTCFullYear());
          }
          const hours = String(d.getUTCHours()).padStart(2, '0');
          const minutes = String(d.getUTCMinutes()).padStart(2, '0');
          return `${hours}:${minutes}`;
        }
      }
    });

    chartRef.current = chart;

    // Suppress and remove TradingView attribution badge injected by lightweight-charts library
    const removeTvLogo = () => {
      const tvEl = chartContainerRef.current?.querySelectorAll('#tv-attr-logo, a[href*="tradingview.com"], [id^="tv-attr"]');
      tvEl?.forEach(el => el.remove());
    };
    removeTvLogo();
    let logoObserver: MutationObserver | null = null;
    if (chartContainerRef.current) {
      logoObserver = new MutationObserver(removeTvLogo);
      logoObserver.observe(chartContainerRef.current, { childList: true, subtree: true });
    }

    // Add Candlestick Series with TradingView signature colors & crisp borders
    const candlestickSeries = chart.addCandlestickSeries({
      upColor: '#089981',
      downColor: '#f23645',
      borderVisible: true,
      borderUpColor: '#089981',
      borderDownColor: '#f23645',
      wickUpColor: '#089981',
      wickDownColor: '#f23645',
      priceLineColor: '#089981',
      priceLineWidth: 1,
      priceLineStyle: 3,
      autoscaleInfoProvider: getAutoscaleProvider(yZoomRef.current)
    });
    candlestickSeriesRef.current = candlestickSeries;

    // Dedicated zero-overhead line series to host all level price lines (POC, VAH, VAL, GEX, Fibs, etc.)
    // With autoscaleInfoProvider: () => null, price lines will NOT forcefully expand the Y-axis!
    const levelsSeries = chart.addLineSeries({
      priceScaleId: 'right',
      color: 'transparent',
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
      autoscaleInfoProvider: () => null
    });
    levelsSeriesRef.current = levelsSeries;

    // Add Volume Series
    const volumeSeries = chart.addHistogramSeries({
      color: '#3b82f6',
      priceFormat: {
        type: 'volume'
      },
      priceScaleId: 'volume-scale'
    });
    
    chart.priceScale('volume-scale').applyOptions({
      scaleMargins: {
        top: 0.8,
        bottom: 0
      },
      visible: false
    });
    volumeSeriesRef.current = volumeSeries;

    // Add Anchored VWAP Series
    const vwapSeries = chart.addLineSeries({
      color: '#3b82f6',
      lineWidth: 2,
      lineStyle: 2,
      priceLineVisible: false,
      title: 'VWAP',
      autoscaleInfoProvider: () => null
    });
    vwapSeriesRef.current = vwapSeries;

    // Add Matrix Step Line Series with TradingView intraday level labels
    const colors = {
      target: '#ef4444',    // Red
      breakout: '#f97316',  // Orange
      sellRev: '#f43f5e',   // Red/Pink
      inner: '#3b82f6',     // Blue
      buyRev: '#10b981'     // Green
    };

    const matrixConfigs = [
      { color: colors.target,   title: 'Target' },
      { color: colors.target,   title: 'Target' },
      { color: colors.breakout, title: 'Breakout' },
      { color: colors.sellRev,  title: 'Sell reversal' },
      { color: colors.inner,    title: 'Resistance (R2)' },
      { color: colors.inner,    title: 'Support (S2)' },
      { color: colors.buyRev,   title: 'Buy Reversal' },
      { color: colors.breakout, title: 'Break Down' },
      { color: colors.target,   title: 'Target' },
      { color: colors.target,   title: 'Target' }
    ];

    const matrixSeriesList = matrixConfigs.map((cfg) => {
      return chart.addLineSeries({
        color: cfg.color,
        lineWidth: 1,
        lineType: 2, // LineType.WithSteps
        priceLineVisible: false,
        lastValueVisible: false,
        title: cfg.title,
        visible: false, // Suppress jagged historical stair-steps in favor of clean projected session levels
        autoscaleInfoProvider: () => null
      });
    });
    matrixSeriesRef.current = matrixSeriesList;

    const handleRangeChange = () => {
      if (!chartRef.current || !candlestickSeriesRef.current || !chartContainerRef.current) return;
      try {
        const height = chartRef.current.paneSize().height;
        const width = chartContainerRef.current.clientWidth;
        const min = candlestickSeriesRef.current.coordinateToPrice(height);
        const max = candlestickSeriesRef.current.coordinateToPrice(0);
        if (min !== null && max !== null && min < max) {
          onVisiblePriceRangeChangeRef.current?.({ min, max, paneHeight: height });
        }

        const curCandles = candlesRef.current;
        if (curCandles && curCandles.length > 0) {
          const lastCandle = curCandles[curCandles.length - 1];
          const lastDateStr = new Date((lastCandle.time as number) * 1000).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
          let sessionStartCandle = curCandles[0];
          for (let i = 0; i < curCandles.length; i++) {
            const d = new Date((curCandles[i].time as number) * 1000).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
            if (d === lastDateStr) {
              sessionStartCandle = curCandles[i];
              break;
            }
          }

          const startXCoord = chartRef.current.timeScale().timeToCoordinate(((sessionStartCandle.time as number) + IST_OFFSET_SECONDS) as Time);
          const startX = startXCoord !== null ? Math.max(0, startXCoord) : 0;
          const rightX = Math.max(startX + 60, width - 68);

          const lastXCoord = chartRef.current.timeScale().timeToCoordinate(((lastCandle.time as number) + IST_OFFSET_SECONDS) as Time);
          const lastX = lastXCoord !== null ? lastXCoord : rightX - 160;
          const labelX = Math.min(rightX - 145, Math.max(startX + 60, lastX + 18));

          const curLevels = activeOrderflowLevelsRef.current;
          const computedLines: any[] = [];
          if (curLevels && curLevels.length > 0) {
            for (const lvl of curLevels) {
              const y = candlestickSeriesRef.current.priceToCoordinate(lvl.price);
              if (y !== null && y >= -15 && y <= height + 15) {
                computedLines.push({
                  ...lvl,
                  y: Math.round(y)
                });
              }
            }
          }

          setOrderflowLines(prev => {
            if (prev.startX === startX && prev.rightX === rightX && prev.labelX === labelX && prev.lines.length === computedLines.length) {
              let identical = true;
              for (let i = 0; i < computedLines.length; i++) {
                if (prev.lines[i]?.y !== computedLines[i]?.y || prev.lines[i]?.key !== computedLines[i]?.key) {
                  identical = false;
                  break;
                }
              }
              if (identical) return prev;
            }
            return { startX, rightX, labelX, lines: computedLines };
          });
        }
      } catch (e) {
        // Safe catch if paneSize is not ready yet
      }
    };

    handleRangeChangeRef.current = handleRangeChange;

    chart.timeScale().subscribeVisibleLogicalRangeChange(() => {
      requestAnimationFrame(handleRangeChange);
    });

    // Real-time Crosshair Move listener to update interactive OHLC legend
    chart.subscribeCrosshairMove((param) => {
      if (!param.time || !param.seriesData || !candlestickSeriesRef.current) {
        setHoveredCandle(null);
        return;
      }
      const data = param.seriesData.get(candlestickSeriesRef.current) as any;
      if (data && typeof data.close === 'number') {
        setHoveredCandle({
          open: data.open,
          high: data.high,
          low: data.low,
          close: data.close,
          time: param.time as any
        });
      } else {
        setHoveredCandle(null);
      }
    });

    const lastChartDimensionsRef = { width: 0, height: 0 };
    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        const width = Math.floor(chartContainerRef.current.clientWidth);
        const height = Math.floor(chartContainerRef.current.clientHeight);
        if (width > 0 && height > 0) {
          if (width === lastChartDimensionsRef.width && height === lastChartDimensionsRef.height) {
            return;
          }
          lastChartDimensionsRef.width = width;
          lastChartDimensionsRef.height = height;
          chartRef.current.applyOptions({
            width,
            height
          });
          requestAnimationFrame(handleRangeChange);
        }
      }
    };
    
    window.addEventListener('resize', handleResize);
    handleResize();

    // Robust ResizeObserver: Prevents chart from collapsing or misaligning without infinite feedback loops
    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined' && chartContainerRef.current) {
      resizeObserver = new ResizeObserver(() => {
        handleResize();
      });
      if (chartContainerRef.current.parentElement) {
        resizeObserver.observe(chartContainerRef.current.parentElement);
      }
    }

    const container = chartContainerRef.current;
    const triggerUpdate = () => {
      requestAnimationFrame(handleRangeChange);
    };

    const handleContainerWheel = (e: WheelEvent) => {
      if (!chartContainerRef.current) return;
      const rect = chartContainerRef.current.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      // If mouse is within the right price scale area (~70px from right)
      if (mouseX >= rect.width - 70) {
        e.preventDefault();
        e.stopPropagation();
        if (e.deltaY < 0) {
          handleYZoomRef.current(-1); // Zoom in
        } else {
          handleYZoomRef.current(1);  // Zoom out
        }
      } else {
        requestAnimationFrame(handleRangeChange);
      }
    };

    const handleContainerDblClick = (e: MouseEvent) => {
      if (!chartContainerRef.current) return;
      const rect = chartContainerRef.current.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      if (mouseX >= rect.width - 70) {
        e.preventDefault();
        handleYResetRef.current();
      }
    };

    if (container) {
      container.addEventListener('wheel', handleContainerWheel, { passive: false });
      container.addEventListener('dblclick', handleContainerDblClick);
      container.addEventListener('mousemove', triggerUpdate);
      container.addEventListener('touchmove', triggerUpdate, { passive: true });
    }

    return () => {
      window.removeEventListener('resize', handleResize);
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
      if (logoObserver) {
        logoObserver.disconnect();
      }
      if (container) {
        container.removeEventListener('wheel', handleContainerWheel);
        container.removeEventListener('dblclick', handleContainerDblClick);
        container.removeEventListener('mousemove', triggerUpdate);
        container.removeEventListener('touchmove', triggerUpdate);
      }
      chart.remove();
      chartRef.current = null;
      candlestickSeriesRef.current = null;
      volumeSeriesRef.current = null;
      vwapSeriesRef.current = null;
      levelsSeriesRef.current = null;
      matrixSeriesRef.current = [];
      prevDatasetKeyRef.current = '';
      prevCandlesCountRef.current = 0;
      lastAppliedCandleTimeRef.current = null;
      lastVwapAppliedTimeRef.current = null;
    };
  }, []);

  // Update chart data
  useEffect(() => {
    if (!candlestickSeriesRef.current || !volumeSeriesRef.current) return;

    if (!candles || candles.length === 0) {
      candlestickSeriesRef.current.setData([]);
      volumeSeriesRef.current.setData([]);
      if (vwapSeriesRef.current) vwapSeriesRef.current.setData([]);
      if (matrixSeriesRef.current) {
        matrixSeriesRef.current.forEach((s: any) => {
          try { s.setData([]); } catch (e) {}
        });
      }
      prevDatasetKeyRef.current = '';
      prevCandlesCountRef.current = 0;
      lastAppliedCandleTimeRef.current = null;
      lastVwapAppliedTimeRef.current = null;
      return;
    }

    // Sanitize candles: filter out invalid numbers, deduplicate timestamps, filter market hours, and sort ascending
    const validCandlesMap = new Map<number, Candle>();
    candles.forEach((c) => {
      if (!c) return;
      const t = typeof c.time === 'number' ? c.time : (typeof c.time === 'string' ? (isNaN(Number(c.time)) ? Math.floor(new Date(c.time).getTime() / 1000) : Number(c.time)) : Number(c.time));
      if (!isNaN(t) && t > 0 && !isNaN(c.close) && !isNaN(c.open) && !isNaN(c.high) && !isNaN(c.low)) {
        if (isWithinMarketHours(t, symbol, timeframe)) {
          validCandlesMap.set(t, { ...c, time: t });
        }
      }
    });
    let sortedCandles = Array.from(validCandlesMap.values()).sort((a, b) => a.time - b.time);
    if (sortedCandles.length === 0) return;

    // Safety guard: reject price outlier candles from contaminated multi-symbol streams
    const lastClose = sortedCandles[sortedCandles.length - 1].close;
    if (lastClose > 0) {
      sortedCandles = sortedCandles.filter(c => {
        const ratio = c.close / lastClose;
        return ratio >= 0.4 && ratio <= 2.5;
      });
    }
    if (sortedCandles.length === 0) return;

    let chartData = [];
    if (candleStyle === 'heikin-ashi') {
      let prevHaOpen = null;
      let prevHaClose = null;
      
      chartData = sortedCandles.map((c, idx) => {
        const haClose = (c.open + c.high + c.low + c.close) / 4;
        let haOpen;
        if (idx === 0 || prevHaOpen === null) {
          haOpen = (c.open + c.close) / 2;
        } else {
          haOpen = (prevHaOpen + prevHaClose) / 2;
        }
        const haHigh = Math.max(c.high, haOpen, haClose);
        const haLow = Math.min(c.low, haOpen, haClose);
        
        prevHaOpen = haOpen;
        prevHaClose = haClose;
        
        return {
          time: ((c.time as number) + IST_OFFSET_SECONDS) as Time,
          open: haOpen,
          high: haHigh,
          low: haLow,
          close: haClose
        };
      });
    } else {
      chartData = sortedCandles.map((c) => ({
        time: ((c.time as number) + IST_OFFSET_SECONDS) as Time,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close
      }));
    }

    const volumeData = sortedCandles.map((c, idx) => {
      let isBullish = c.close >= c.open;
      if (candleStyle === 'heikin-ashi') {
        const ha = chartData[idx];
        isBullish = ha.close >= ha.open;
      }
      return {
        time: ((c.time as number) + IST_OFFSET_SECONDS) as Time,
        value: c.volume,
        color: isBullish ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'
      };
    });

    try {
      const datasetKey = `${symbol}_${timeframe}_${sessionPeriod || 'daily'}_${candleStyle}`;
      const isDatasetChange = prevDatasetKeyRef.current !== datasetKey;
      const lastCandle = chartData[chartData.length - 1];
      const lastVol = volumeData[volumeData.length - 1];
      const lastCandleTime = lastCandle ? (lastCandle.time as number) : null;

      // Always use setData() with strictly sorted ascending data.
      // Calling series.update() with real-time websocket ticks is fragile in Lightweight Charts
      // and throws fatal "Cannot update oldest data, last time=[object Object], new time=[object Object]"
      // whenever ticks arrive slightly out of order or on bar transitions.
      // setData() on ~300 items is virtually instant (<1ms) and 100% immune to this failure.
      try {
        candlestickSeriesRef.current.setData(chartData);
        volumeSeriesRef.current.setData(volumeData);
        prevDatasetKeyRef.current = datasetKey;
        prevCandlesCountRef.current = sortedCandles.length;
        lastAppliedCandleTimeRef.current = lastCandleTime;
      } catch (setErr) {
        console.warn('[Chart] Initial setData failed, retrying clean reset:', setErr);
        try {
          candlestickSeriesRef.current.setData([]);
          volumeSeriesRef.current.setData([]);
          candlestickSeriesRef.current.setData(chartData);
          volumeSeriesRef.current.setData(volumeData);
          prevDatasetKeyRef.current = datasetKey;
          prevCandlesCountRef.current = sortedCandles.length;
          lastAppliedCandleTimeRef.current = lastCandleTime;
        } catch (cleanErr) {
          console.error('[Chart] Clean setData failed:', cleanErr);
        }
      }

      // Calculate and set daily-anchored VWAP
      if (vwapSeriesRef.current) {
        try {
          let currentDayStr = '';
          let cumulativeVolume = 0;
          let cumulativePriceVolume = 0;

          const vwapData = sortedCandles.map((c) => {
            const date = new Date((c.time as number) * 1000);
            const dayStr = date.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

            if (dayStr !== currentDayStr) {
              currentDayStr = dayStr;
              cumulativeVolume = 0;
              cumulativePriceVolume = 0;
            }

            const ohlcPrice = (c.open + c.high + c.low + c.close) / 4;
            const vol = typeof c.volume === 'number' && !isNaN(c.volume) ? c.volume : 0;
            cumulativePriceVolume += ohlcPrice * vol;
            cumulativeVolume += vol;

            return {
              time: ((c.time as number) + IST_OFFSET_SECONDS) as Time,
              value: cumulativeVolume > 0 ? cumulativePriceVolume / cumulativeVolume : ohlcPrice
            };
          });

          const lastVwap = vwapData[vwapData.length - 1];
          const lastVwapTime = lastVwap ? (lastVwap.time as number) : null;

          try {
            vwapSeriesRef.current.setData(vwapData);
            lastVwapAppliedTimeRef.current = lastVwapTime;
          } catch (vwapErr) {
            try {
              vwapSeriesRef.current.setData([]);
              vwapSeriesRef.current.setData(vwapData);
              lastVwapAppliedTimeRef.current = lastVwapTime;
            } catch (e) {}
          }
        } catch (vwapErr) {
          console.warn('[Chart] VWAP computation error:', vwapErr);
        }
      }

      // Set Matrix series data with strict deduplication & ascending time order
      if (matrixSeriesRef.current.length === 10 && matrixSeriesData) {
        try {
          const shiftSeries = (seriesArr: any[]) => {
            if (!Array.isArray(seriesArr)) return [];
            const seen = new Set<number>();
            const valid = [];
            for (const item of seriesArr) {
              if (item && typeof item.time === 'number' && !isNaN(item.time) && !isNaN(item.value)) {
                if (!seen.has(item.time)) {
                  seen.add(item.time);
                  valid.push(item);
                }
              }
            }
            const sorted = valid
              .sort((a, b) => a.time - b.time)
              .map((item) => ({
                time: ((item.time as number) + IST_OFFSET_SECONDS) as Time,
                value: item.value
              }));

            // Extrapolate a 2nd point if only 1 data point exists so Lightweight Charts draws a visible horizontal line segment
            if (sorted.length === 1) {
              const stepSec = timeframe === 'D' ? 86400 : (parseInt(timeframe, 10) || 5) * 60;
              sorted.push({
                time: ((sorted[0].time as number) + stepSec) as Time,
                value: sorted[0].value
              });
            }
            return sorted;
          };

          const s1 = shiftSeries(matrixSeriesData.level1);
          if (s1.length > 0) {
            matrixSeriesRef.current[0]?.setData(s1);
            matrixSeriesRef.current[1]?.setData(shiftSeries(matrixSeriesData.level2));
            matrixSeriesRef.current[2]?.setData(shiftSeries(matrixSeriesData.level3));
            matrixSeriesRef.current[3]?.setData(shiftSeries(matrixSeriesData.level4));
            matrixSeriesRef.current[4]?.setData(shiftSeries(matrixSeriesData.level5));
            matrixSeriesRef.current[5]?.setData(shiftSeries(matrixSeriesData.level6));
            matrixSeriesRef.current[6]?.setData(shiftSeries(matrixSeriesData.level7));
            matrixSeriesRef.current[7]?.setData(shiftSeries(matrixSeriesData.level8));
            matrixSeriesRef.current[8]?.setData(shiftSeries(matrixSeriesData.level9));
            matrixSeriesRef.current[9]?.setData(shiftSeries(matrixSeriesData.level10));
          }
        } catch (matrixErr) {
          console.warn('[Chart] Matrix series update error:', matrixErr);
        }
      }
      
      // Viewport visible range logic (TradingView standard default view)
      const currentKey = `${symbol}-${timeframe}-${sessionPeriod || 'daily'}`;
      if (lastSymbolTimeframeRef.current !== currentKey) {
        if (sessionPeriod === 'monthly' && candles.length > 150) {
          chartRef.current?.timeScale().setVisibleLogicalRange({
            from: candles.length - 150,
            to: candles.length + 5,
          });
        } else if (sessionPeriod === 'weekly' && candles.length > 100) {
          chartRef.current?.timeScale().setVisibleLogicalRange({
            from: candles.length - 100,
            to: candles.length + 3,
          });
        } else {
          const total = candles.length;
          const visibleBars = Math.min(total, 70);
          chartRef.current?.timeScale().setVisibleLogicalRange({
            from: Math.max(0, total - visibleBars),
            to: total + 4,
          });
        }
        lastSymbolTimeframeRef.current = currentKey;
      }

      // Propagate visible range
      requestAnimationFrame(() => {
        handleRangeChangeRef.current();
      });
    } catch (globalChartErr) {
      console.error('[Chart] Safe render effect caught error:', globalChartErr);
    }
  }, [candles, symbol, timeframe, sessionPeriod, matrixSeriesData, candleStyle]);

  // Immediately render orderflow levels overlay whenever activeOrderflowLevels recalculates
  useEffect(() => {
    requestAnimationFrame(() => {
      handleRangeChangeRef.current();
    });
  }, [activeOrderflowLevels]);

  // Dynamic theme update for Lightweight Charts
  useEffect(() => {
    if (!chartRef.current) return;
    chartRef.current.applyOptions({
      layout: {
        background: { color: isDark ? '#0b0e14' : '#ffffff' },
        textColor: isDark ? '#9ca3af' : '#787b86'
      },
      grid: {
        vertLines: { color: isDark ? 'rgba(255, 255, 255, 0.04)' : '#f0f3fa' },
        horzLines: { color: isDark ? 'rgba(255, 255, 255, 0.04)' : '#f0f3fa' }
      },
      rightPriceScale: {
        borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#e0e3eb'
      },
      timeScale: {
        borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#e0e3eb'
      }
    });
  }, [isDark]);

  // Update Price Lines on dedicated levelsSeries (preventing Y-axis expansion from distant levels)
  useEffect(() => {
    const series = levelsSeriesRef.current || candlestickSeriesRef.current;
    if (!series) return;

    const currentPrice = (candles && candles.length > 0) ? candles[candles.length - 1].close : 0;
    const isOptionSymbol = /(CE|PE|CALL|PUT|\d+[CP])$/i.test(symbol || '') || /\s+(CE|PE|CE\/PE)$/i.test(symbol || '');
    // Guard against distant levels (like Fib 3.618 or old monthly NPOCs) distorting/collapsing the vertical candle scale
    const isPriceNear = (price?: number, maxDistancePct: number = 0.035) => {
      if (!price || !currentPrice || price <= 0) return false;
      const threshold = isOptionSymbol ? Math.max(0.75, maxDistancePct * 15) : maxDistancePct;
      return Math.abs(price - currentPrice) / currentPrice <= threshold;
    };

    // Helper to clear a line ref
    const clearLine = (ref: React.MutableRefObject<any>) => {
      if (ref.current) {
        try { series.removePriceLine(ref.current); } catch (e) {}
        ref.current = null;
      }
    };

    // Clean up standard lines
    clearLine(pocLineRef);
    clearLine(vahLineRef);
    clearLine(valLineRef);

    // Clean up IB & extensions
    clearLine(ibHighLineRef);
    clearLine(ibLowLineRef);
    clearLine(ext1618UpLineRef);
    clearLine(ext1618DownLineRef);
    clearLine(ext2618UpLineRef);
    clearLine(ext2618DownLineRef);
    clearLine(ext3618UpLineRef);
    clearLine(ext3618DownLineRef);

    // Clean up PDF lines
    clearLine(priorPocLineRef);
    clearLine(priorVahLineRef);
    clearLine(priorValLineRef);
    clearLine(poorHighLineRef);
    clearLine(poorLowLineRef);
    clearLine(ddGapTopLineRef);
    clearLine(ddGapBottomLineRef);
    clearLine(threeDayBalHighLineRef);
    clearLine(threeDayBalLowLineRef);
    clearLine(openPriceLineRef);

    // Clean up untested POCs list
    if (untestedPocLinesRef.current.length > 0) {
      untestedPocLinesRef.current.forEach(line => {
        try { series.removePriceLine(line); } catch (e) {}
      });
      untestedPocLinesRef.current = [];
    }

    // Clean up Failed Auctions list
    if (failedAuctionLinesRef.current.length > 0) {
      failedAuctionLinesRef.current.forEach(line => {
        try { series.removePriceLine(line); } catch (e) {}
      });
      failedAuctionLinesRef.current = [];
    }

    // Clean up active single prints list
    if (activeSinglePrintLinesRef.current.length > 0) {
      activeSinglePrintLinesRef.current.forEach(line => {
        try { series.removePriceLine(line); } catch (e) {}
      });
      activeSinglePrintLinesRef.current = [];
    }

    // Clean up legacy Sapnas list
    if (legacySapnaLinesRef.current.length > 0) {
      legacySapnaLinesRef.current.forEach(line => {
        try { series.removePriceLine(line); } catch (e) {}
      });
      legacySapnaLinesRef.current = [];
    }

    // Clean up GEX lines
    clearLine(gexCallWallLineRef);
    clearLine(gexPutWallLineRef);
    clearLine(gexFlipZoneLineRef);
    clearLine(gexMaxPainLineRef);

    // 1. Draw Active POC
    if (activePoc) {
      pocLineRef.current = series.createPriceLine({
        price: activePoc,
        color: '#00f0ff',
        lineWidth: 2,
        lineStyle: 0,
        axisLabelVisible: true,
        title: 'POC'
      });
    }

    // 2. Draw Active VAH
    if (activeVah) {
      vahLineRef.current = series.createPriceLine({
        price: activeVah,
        color: '#ec4899',
        lineWidth: 1,
        lineStyle: 1,
        axisLabelVisible: true,
        title: 'VAH'
      });
    }

    // 3. Draw Active VAL
    if (activeVal) {
      valLineRef.current = series.createPriceLine({
        price: activeVal,
        color: '#a855f7',
        lineWidth: 1,
        lineStyle: 1,
        axisLabelVisible: true,
        title: 'VAL'
      });
    }

    // 4. Draw Initial Balance & Fibonacci Extensions (clamped to realistic proximity)
    if (activeIbHigh && activeIbLow && activeIbHigh > activeIbLow) {
      const ibRange = activeIbHigh - activeIbLow;

      ibHighLineRef.current = series.createPriceLine({
        price: activeIbHigh,
        color: '#ef4444',
        lineWidth: 2,
        lineStyle: 0,
        axisLabelVisible: true,
        title: 'IB High'
      });

      ibLowLineRef.current = series.createPriceLine({
        price: activeIbLow,
        color: '#10b981',
        lineWidth: 2,
        lineStyle: 0,
        axisLabelVisible: true,
        title: 'IB Low'
      });

      // 1.618
      const up1618 = ibLow + (ibRange * 1.618);
      if (isPriceNear(up1618, 0.035)) {
        ext1618UpLineRef.current = series.createPriceLine({
          price: up1618,
          color: '#a855f7',
          lineWidth: 1,
          lineStyle: 2,
          axisLabelVisible: true,
          title: 'Fib 1.618 U'
        });
      }

      const down1618 = ibHigh - (ibRange * 1.618);
      if (isPriceNear(down1618, 0.035)) {
        ext1618DownLineRef.current = series.createPriceLine({
          price: down1618,
          color: '#a855f7',
          lineWidth: 1,
          lineStyle: 2,
          axisLabelVisible: true,
          title: 'Fib 1.618 D'
        });
      }

      // 2.618
      const up2618 = ibLow + (ibRange * 2.618);
      if (isPriceNear(up2618, 0.025)) {
        ext2618UpLineRef.current = series.createPriceLine({
          price: up2618,
          color: '#f97316',
          lineWidth: 1,
          lineStyle: 2,
          axisLabelVisible: true,
          title: 'Fib 2.618 U'
        });
      }

      const down2618 = ibHigh - (ibRange * 2.618);
      if (isPriceNear(down2618, 0.025)) {
        ext2618DownLineRef.current = series.createPriceLine({
          price: down2618,
          color: '#f97316',
          lineWidth: 1,
          lineStyle: 2,
          axisLabelVisible: true,
          title: 'Fib 2.618 D'
        });
      }

      // 3.618
      const up3618 = ibLow + (ibRange * 3.618);
      if (isPriceNear(up3618, 0.02)) {
        ext3618UpLineRef.current = series.createPriceLine({
          price: up3618,
          color: '#ffffff',
          lineWidth: 1,
          lineStyle: 2,
          axisLabelVisible: true,
          title: 'Fib 3.618 U'
        });
      }

      const down3618 = ibHigh - (ibRange * 3.618);
      if (isPriceNear(down3618, 0.02)) {
        ext3618DownLineRef.current = series.createPriceLine({
          price: down3618,
          color: '#ffffff',
          lineWidth: 1,
          lineStyle: 2,
          axisLabelVisible: true,
          title: 'Fib 3.618 D'
        });
      }
    }

    // 5. Draw Prior POC
    if (priorPocPrice && isPriceNear(priorPocPrice, 0.04)) {
      priorPocLineRef.current = series.createPriceLine({
        price: priorPocPrice,
        color: '#06b6d4',
        lineWidth: 1,
        lineStyle: 2,
        axisLabelVisible: true,
        title: 'Prior POC'
      });
    }

    // 6. Draw Prior VAH
    if (priorVahPrice && isPriceNear(priorVahPrice, 0.04)) {
      priorVahLineRef.current = series.createPriceLine({
        price: priorVahPrice,
        color: '#f43f5e',
        lineWidth: 1,
        lineStyle: 2,
        axisLabelVisible: true,
        title: 'Prior VAH'
      });
    }

    // 7. Draw Prior VAL
    if (priorValPrice && isPriceNear(priorValPrice, 0.04)) {
      priorValLineRef.current = series.createPriceLine({
        price: priorValPrice,
        color: '#a855f7',
        lineWidth: 1,
        lineStyle: 2,
        axisLabelVisible: true,
        title: 'Prior VAL'
      });
    }

    // 8. Draw Poor High
    if (poorHighPrice && isPriceNear(poorHighPrice, 0.04)) {
      poorHighLineRef.current = series.createPriceLine({
        price: poorHighPrice,
        color: '#ef4444',
        lineWidth: 1,
        lineStyle: 3,
        axisLabelVisible: true,
        title: 'Poor High'
      });
    }

    // 9. Draw Poor Low
    if (poorLowPrice && isPriceNear(poorLowPrice, 0.04)) {
      poorLowLineRef.current = series.createPriceLine({
        price: poorLowPrice,
        color: '#ef4444',
        lineWidth: 1,
        lineStyle: 3,
        axisLabelVisible: true,
        title: 'Poor Low'
      });
    }

    // 10. Draw Sapna boundary
    if (ddGapTop && isPriceNear(ddGapTop, 0.04)) {
      ddGapTopLineRef.current = series.createPriceLine({
        price: ddGapTop,
        color: '#ec4899',
        lineWidth: 1,
        lineStyle: 2,
        axisLabelVisible: true,
        title: 'Prior Sapna Top'
      });
    }
    if (ddGapBottom && isPriceNear(ddGapBottom, 0.04)) {
      ddGapBottomLineRef.current = series.createPriceLine({
        price: ddGapBottom,
        color: '#ec4899',
        lineWidth: 1,
        lineStyle: 2,
        axisLabelVisible: true,
        title: 'Prior Sapna Btm'
      });
    }

    // 11. Draw 3-Day Balance boundaries
    if (threeDayBalanceHigh && isPriceNear(threeDayBalanceHigh, 0.04)) {
      threeDayBalHighLineRef.current = series.createPriceLine({
        price: threeDayBalanceHigh,
        color: '#f59e0b',
        lineWidth: 1,
        lineStyle: 3,
        axisLabelVisible: true,
        title: '3D Bal High'
      });
    }
    if (threeDayBalanceLow && isPriceNear(threeDayBalanceLow, 0.04)) {
      threeDayBalLowLineRef.current = series.createPriceLine({
        price: threeDayBalanceLow,
        color: '#f59e0b',
        lineWidth: 1,
        lineStyle: 3,
        axisLabelVisible: true,
        title: '3D Bal Low'
      });
    }

    // 12. Draw Untested POCs (filtered to realistic proximity)
    if (untestedPocs && untestedPocs.length > 0) {
      untestedPocs.forEach((upoc) => {
        if (!isPriceNear(upoc.price, 0.035)) return;
        const line = series.createPriceLine({
          price: upoc.price,
          color: '#f43f5e',
          lineWidth: 2,
          lineStyle: 2,
          axisLabelVisible: true,
          title: `NPOC (${upoc.date})`
        });
        untestedPocLinesRef.current.push(line);
      });
    }

    // 12b. Draw Failed Auctions
    if (failedAuctions && failedAuctions.length > 0) {
      failedAuctions.forEach((fa) => {
        if (!isPriceNear(fa.price, 0.035)) return;
        const titleLabel = fa.type === 'high' ? `FA High (${fa.date})` : `FA Low (${fa.date})`;
        const line = series.createPriceLine({
          price: fa.price,
          color: '#f97316',
          lineWidth: 2,
          lineStyle: 1,
          axisLabelVisible: true,
          title: titleLabel
        });
        failedAuctionLinesRef.current.push(line);
      });
    }

    // Draw Legacy Sapnas
    if (legacySapnas && legacySapnas.length > 0) {
      legacySapnas.forEach((sapna) => {
        if (!isPriceNear(sapna.start, 0.035) && !isPriceNear(sapna.end, 0.035)) return;
        const lineTop = series.createPriceLine({
          price: sapna.end,
          color: '#ec4899',
          lineWidth: 2,
          lineStyle: 2,
          axisLabelVisible: true,
          title: `Sapna Top (${sapna.date})`
        });
        legacySapnaLinesRef.current.push(lineTop);

        const lineBottom = series.createPriceLine({
          price: sapna.start,
          color: '#ec4899',
          lineWidth: 2,
          lineStyle: 2,
          axisLabelVisible: true,
          title: `Sapna Btm (${sapna.date})`
        });
        legacySapnaLinesRef.current.push(lineBottom);
      });
    }

    // 13. Draw Opening Price
    if (openPrice && typeof openingType === 'string') {
      let lineColor = '#f59e0b';
      if (openingType.includes('Bullish')) {
        lineColor = '#10b981';
      } else if (openingType.includes('Bearish')) {
        lineColor = '#ef4444';
      } else if (openingType.includes('ORR') || openingType.includes('Rejection')) {
        lineColor = '#c084fc';
      }
      
      openPriceLineRef.current = series.createPriceLine({
        price: openPrice,
        color: lineColor,
        lineWidth: 2,
        lineStyle: 0,
        axisLabelVisible: true,
        title: `Open: ${openingType}`
      });
    }

    // 14. Draw Active Single Prints
    if (activeSinglePrints && activeSinglePrints.length > 0) {
      activeSinglePrints.forEach((range, idx) => {
        if (!isPriceNear(range.start, 0.035) && !isPriceNear(range.end, 0.035)) return;
        const lineStart = series.createPriceLine({
          price: range.start,
          color: '#f43f5e',
          lineWidth: 1,
          lineStyle: 3,
          axisLabelVisible: true,
          title: `Sapna Btm ${idx + 1}`
        });
        activeSinglePrintLinesRef.current.push(lineStart);

        const lineEnd = series.createPriceLine({
          price: range.end,
          color: '#f43f5e',
          lineWidth: 1,
          lineStyle: 3,
          axisLabelVisible: true,
          title: `Sapna Top ${idx + 1}`
        });
        activeSinglePrintLinesRef.current.push(lineEnd);
      });
    }

    // GEX levels (if provided and near market)
    if (gexCallWall && isPriceNear(gexCallWall, 0.04)) {
      gexCallWallLineRef.current = series.createPriceLine({
        price: gexCallWall,
        color: '#ef4444',
        lineWidth: 2,
        lineStyle: 2,
        axisLabelVisible: true,
        title: 'CW'
      });
    }
    if (gexPutWall && isPriceNear(gexPutWall, 0.04)) {
      gexPutWallLineRef.current = series.createPriceLine({
        price: gexPutWall,
        color: '#10b981',
        lineWidth: 2,
        lineStyle: 2,
        axisLabelVisible: true,
        title: 'PW'
      });
    }
    if (gexFlipZone && isPriceNear(gexFlipZone, 0.04)) {
      gexFlipZoneLineRef.current = series.createPriceLine({
        price: gexFlipZone,
        color: '#a78bfa',
        lineWidth: 1,
        lineStyle: 3,
        axisLabelVisible: true,
        title: 'FZ'
      });
    }
    if (gexMaxPain && isPriceNear(gexMaxPain, 0.04)) {
      gexMaxPainLineRef.current = series.createPriceLine({
        price: gexMaxPain,
        color: '#e879f9',
        lineWidth: 1,
        lineStyle: 3,
        axisLabelVisible: true,
        title: 'MP'
      });
    }

  }, [
    symbol,
    activePoc, activeVah, activeVal, activeIbHigh, activeIbLow,
    priorPocPrice, priorVahPrice, priorValPrice,
    poorHighPrice, poorLowPrice, untestedPocs, failedAuctions,
    ddGapTop, ddGapBottom,
    threeDayBalanceHigh, threeDayBalanceLow,
    openPrice, openingType, activeSinglePrints, legacySapnas,
    gexCallWall, gexPutWall, gexFlipZone, gexMaxPain
  ]);

  const isOption = useMemo(() => {
    const s = (symbol || '').toUpperCase();
    return /(CE|PE|CALL|PUT|\d+[CP])$/i.test(s) || /\s+(CE|PE|CE\/PE)$/i.test(s);
  }, [symbol]);

  return (
    <div
      onClick={onSelect}
      className="glass-panel animate-fade-in"
      style={{
        display: 'flex',
        flexDirection: 'column',
        flex: 1,
        width: '100%',
        height: '100%',
        minHeight: 0,
        minWidth: 0,
        overflow: 'hidden',
        position: 'relative',
        boxSizing: 'border-box',
        border: isMultiChart ? (isActive ? '1.5px solid #38bdf8' : '1px solid rgba(255, 255, 255, 0.08)') : undefined,
        boxShadow: isMultiChart && isActive ? '0 0 12px rgba(56, 189, 248, 0.22)' : undefined
      }}
    >
      {/* Inline Symbol Search Popover for Multi-Chart Panes */}
      {isPaneSearchOpen && onSymbolChange && (
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            position: 'absolute',
            top: '40px',
            left: '8px',
            zIndex: 9999,
            background: isDark ? '#0f172a' : '#ffffff',
            border: '1px solid #38bdf8',
            borderRadius: '8px',
            padding: '10px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            minWidth: '220px',
            maxWidth: '300px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
            <span style={{ fontSize: '11px', fontWeight: '800', color: '#38bdf8' }}>
              Change Symbol (Chart {typeof chartIndex === 'number' ? chartIndex + 1 : ''})
            </span>
            <button
              onClick={() => setIsPaneSearchOpen(false)}
              style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '2px' }}
            >
              <X size={14} />
            </button>
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (paneSearchQuery.trim()) {
                let q = paneSearchQuery.trim().toUpperCase();
                if (!q.includes(':')) {
                  const isDeriv = (q.endsWith('FUT') || q.endsWith('CE') || q.endsWith('PE')) && /\d/.test(q);
                  const isMcx = ['CRUDEOIL', 'GOLD', 'SILVER', 'NATURALGAS', 'COPPER', 'ZINC'].some(c => q.includes(c));
                  q = isDeriv ? `NFO:${q}` : isMcx ? `MCX:${q}` : `NSE:${q}`;
                }
                onSymbolChange(q);
                setIsPaneSearchOpen(false);
                setPaneSearchQuery('');
              }
            }}
          >
            <input
              autoFocus
              type="text"
              placeholder="e.g. NIFTY, BANKNIFTY, RELIANCE..."
              value={paneSearchQuery}
              onChange={(e) => setPaneSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '6px 8px',
                borderRadius: '6px',
                border: `1px solid ${isDark ? 'rgba(255,255,255,0.18)' : '#cbd5e1'}`,
                background: isDark ? 'rgba(0,0,0,0.35)' : '#f8fafc',
                color: 'var(--text-primary)',
                fontSize: '12px',
                boxSizing: 'border-box',
                outline: 'none'
              }}
            />
          </form>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
            {['NSE:NIFTY', 'NSE:BANKNIFTY', 'NSE:FINNIFTY', 'NSE:RELIANCE', 'MCX:CRUDEOIL', 'MCX:GOLD'].map(preset => (
              <button
                key={preset}
                type="button"
                onClick={() => {
                  onSymbolChange(preset);
                  setIsPaneSearchOpen(false);
                  setPaneSearchQuery('');
                }}
                style={{
                  fontSize: '10px',
                  fontWeight: '600',
                  padding: '3px 6px',
                  borderRadius: '4px',
                  border: 'none',
                  background: isDark ? 'rgba(255,255,255,0.08)' : '#e2e8f0',
                  color: 'var(--text-primary)',
                  cursor: 'pointer'
                }}
              >
                {preset.replace('NSE:', '').replace('MCX:', '')}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Chart Title Overlay & Status Toolbar */}
      <div 
        onDoubleClick={() => onToggleMaximize && onToggleMaximize()}
        title={onToggleMaximize ? (isMaximized ? "Double-click to restore grid" : "Double-click to expand this chart") : undefined}
        style={{ display: 'flex', flexWrap: 'nowrap', justifyContent: 'space-between', alignItems: 'center', padding: isMultiChart ? '4px 8px' : '8px 14px', borderBottom: '1px solid var(--border-color)', backgroundColor: 'rgba(13, 16, 23, 0.4)', gap: '6px', flexShrink: 0, minHeight: isMultiChart ? '34px' : 'auto' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'nowrap', overflowX: 'auto', minWidth: 0 }}>
          {isMultiChart && typeof chartIndex === 'number' && (
            <span
              style={{
                fontSize: '10px',
                fontWeight: '900',
                padding: '2px 5px',
                borderRadius: '4px',
                backgroundColor: isActive ? '#0284c7' : 'rgba(255,255,255,0.08)',
                color: isActive ? '#ffffff' : 'var(--text-secondary)',
                boxShadow: isActive ? '0 0 8px rgba(2, 132, 199, 0.5)' : 'none',
                flexShrink: 0
              }}
              title={`Chart Pane ${chartIndex + 1} ${isActive ? '(Active Chart)' : ''}`}
            >
              {chartIndex + 1}
            </span>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexShrink: 0 }}>
            <span
              onClick={(e) => {
                if (onSymbolChange) {
                  e.stopPropagation();
                  setIsPaneSearchOpen(!isPaneSearchOpen);
                }
              }}
              style={{
                fontSize: isMultiChart ? '12.5px' : '14px',
                fontWeight: '700',
                color: 'white',
                cursor: onSymbolChange ? 'pointer' : 'default',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '3px',
                padding: onSymbolChange ? '1px 4px' : 0,
                borderRadius: '4px',
                backgroundColor: isPaneSearchOpen ? 'rgba(56, 189, 248, 0.2)' : 'transparent',
                border: isPaneSearchOpen ? '1px solid #38bdf8' : '1px solid transparent'
              }}
              title={onSymbolChange ? "Click to search/change symbol for this chart" : undefined}
            >
              {symbol}
              {onSymbolChange && <Search size={11} style={{ opacity: 0.7 }} />}
            </span>

            {isOption && (
              <span style={{
                fontSize: '9px',
                fontWeight: '800',
                color: '#38bdf8',
                backgroundColor: 'rgba(56, 189, 248, 0.15)',
                border: '1px solid rgba(56, 189, 248, 0.4)',
                padding: '1px 5px',
                borderRadius: '4px',
                letterSpacing: '0.4px'
              }}>
                🎯 OPTION
              </span>
            )}
          </div>

          {/* Connection Status Pill */}
          <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
            {connectionStatus === 'connected' ? (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: '9.5px', fontWeight: '600', color: '#10b981', backgroundColor: 'rgba(16, 185, 129, 0.1)', padding: '2px 5px', borderRadius: '5px', border: '1px solid rgba(16, 185, 129, 0.25)' }}>
                <Wifi size={10} /> Live
              </span>
            ) : connectionStatus === 'connecting' ? (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: '9.5px', fontWeight: '600', color: '#f59e0b', backgroundColor: 'rgba(245, 158, 11, 0.1)', padding: '2px 5px', borderRadius: '5px', border: '1px solid rgba(245, 158, 11, 0.25)' }}>
                <Wifi size={10} /> Conn...
              </span>
            ) : (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: '9.5px', fontWeight: '600', color: '#ef4444', backgroundColor: 'rgba(239, 68, 68, 0.1)', padding: '2px 5px', borderRadius: '5px', border: '1px solid rgba(239, 68, 68, 0.25)' }}>
                <WifiOff size={10} /> Disconn
              </span>
            )}
          </div>
        </div>

        {/* Mobile-Only Toolbar Toggle Button */}
        <div className="mobile-only" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <button
            onClick={() => setShowMobileChartTools(!showMobileChartTools)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '11px',
              fontWeight: '600',
              padding: '4px 9px',
              borderRadius: '6px',
              border: '1px solid rgba(56, 189, 248, 0.3)',
              backgroundColor: showMobileChartTools ? 'rgba(56, 189, 248, 0.2)' : 'rgba(255, 255, 255, 0.05)',
              color: showMobileChartTools ? '#38bdf8' : 'var(--text-primary)',
              cursor: 'pointer'
            }}
          >
            🛠️ Tools {showMobileChartTools ? '▲' : '▼'}
          </button>
        </div>

        {/* Secondary Tools Controls: always on desktop, toggled on mobile */}
        <div
          className={showMobileChartTools ? '' : 'desktop-only'}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            flexWrap: 'wrap',
            width: showMobileChartTools ? '100%' : 'auto',
            paddingTop: showMobileChartTools ? '6px' : '0',
            borderTop: showMobileChartTools ? '1px dashed rgba(255, 255, 255, 0.1)' : 'none'
          }}
        >
          {/* Verified Angel One Data Feed Badge */}
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '10.5px',
                fontWeight: '700',
                color: '#38bdf8',
                backgroundColor: 'rgba(56, 189, 248, 0.12)',
                padding: '2px 8px',
                borderRadius: '6px',
                border: '1px solid rgba(56, 189, 248, 0.3)'
              }}
              title="Verified direct real-time data feed from Angel One SmartAPI"
            >
              <Zap size={11} color="#38bdf8" /> Angel One SmartAPI
            </span>
          </div>

          {/* Real-time Level Alerts Toolbar Controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: 'rgba(255, 255, 255, 0.03)', borderRadius: '6px', padding: '2px 4px', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
            <button
              onClick={handleToggleAlertsMuted}
              title={alertsMuted ? "Click to enable popup alerts" : "Click to mute popup alerts"}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                fontSize: '10px',
                fontWeight: '600',
                padding: '3px 8px',
                borderRadius: '4px',
                border: 'none',
                cursor: 'pointer',
                backgroundColor: alertsMuted ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.12)',
                color: alertsMuted ? '#f87171' : '#34d399',
                transition: 'all 0.15s ease'
              }}
            >
              <Bell size={12} />
              {alertsMuted ? 'Alerts Muted' : 'Level Alerts Active'}
              {firedCount > 0 && (
                <span style={{ backgroundColor: 'rgba(59, 130, 246, 0.35)', color: '#93c5fd', padding: '1px 5px', borderRadius: '10px', fontSize: '9px', fontWeight: '700' }}>
                  {firedCount} fired
                </span>
              )}
            </button>

            <button
              onClick={handleResetSetupAlerts}
              title="Reset alerts for current setup so levels can trigger again"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '3px',
                fontSize: '10px',
                fontWeight: '500',
                padding: '3px 6px',
                borderRadius: '4px',
                border: 'none',
                cursor: 'pointer',
                backgroundColor: 'transparent',
                color: 'var(--text-secondary)',
                transition: 'all 0.15s ease'
              }}
            >
              <RotateCcw size={11} /> Reset
            </button>
          </div>

          {/* Candlestick Style Toggle */}
          <div style={{ display: 'flex', backgroundColor: 'rgba(255, 255, 255, 0.03)', borderRadius: '6px', padding: '2px', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
            <button 
              onClick={() => setCandleStyle('japanese')}
              style={{
                fontSize: '10px',
                fontWeight: '600',
                padding: '3px 8px',
                borderRadius: '4px',
                border: 'none',
                cursor: 'pointer',
                backgroundColor: candleStyle === 'japanese' ? 'rgba(59, 130, 246, 0.15)' : 'transparent',
                color: candleStyle === 'japanese' ? '#60a5fa' : 'var(--text-secondary)',
                transition: 'all 0.15s ease'
              }}
            >
              Candles
            </button>
            <button 
              onClick={() => setCandleStyle('heikin-ashi')}
              style={{
                fontSize: '10px',
                fontWeight: '600',
                padding: '3px 8px',
                borderRadius: '4px',
                border: 'none',
                cursor: 'pointer',
                backgroundColor: candleStyle === 'heikin-ashi' ? 'rgba(59, 130, 246, 0.15)' : 'transparent',
                color: candleStyle === 'heikin-ashi' ? '#60a5fa' : 'var(--text-secondary)',
                transition: 'all 0.15s ease'
              }}
            >
              Heikin Ashi
            </button>
            <button 
              onClick={() => setShowAdvPanel(!showAdvPanel)}
              style={{
                fontSize: '10px',
                fontWeight: '600',
                padding: '3px 8px',
                borderRadius: '4px',
                border: 'none',
                cursor: 'pointer',
                backgroundColor: showAdvPanel ? 'rgba(245, 158, 11, 0.25)' : 'transparent',
                color: showAdvPanel ? '#f59e0b' : 'var(--text-secondary)',
                borderLeft: '1px solid rgba(255,255,255,0.08)',
                transition: 'all 0.15s ease'
              }}
            >
              📈 ADV Indicator
            </button>
            <button
              onClick={() => chartRef.current?.timeScale().fitContent()}
              title="Fit all candles into chart view"
              style={{
                fontSize: '10px',
                fontWeight: '600',
                padding: '3px 8px',
                borderRadius: '4px',
                border: 'none',
                cursor: 'pointer',
                backgroundColor: 'transparent',
                color: 'var(--text-secondary)',
                borderLeft: '1px solid rgba(255,255,255,0.08)',
                transition: 'all 0.15s ease'
              }}
            >
              🎯 Fit View
            </button>
            {/* Y-Axis Zoom In / Out Controls */}
            <div style={{ display: 'inline-flex', alignItems: 'center', backgroundColor: isDark ? 'rgba(255, 255, 255, 0.04)' : '#f1f5f9', borderRadius: '4px', borderLeft: '1px solid rgba(255,255,255,0.08)', padding: '0 3px', gap: '2px' }}>
              <span style={{ fontSize: '10px', fontWeight: '700', color: 'var(--text-secondary)', padding: '0 2px' }}>↕ Y:</span>
              <button
                onClick={() => handleYZoom(1)}
                title="Zoom Out Y-Axis (Compress candles / increase price span)"
                style={{
                  fontSize: '10px',
                  fontWeight: '700',
                  padding: '3px 6px',
                  borderRadius: '3px',
                  border: 'none',
                  cursor: 'pointer',
                  backgroundColor: 'transparent',
                  color: 'var(--text-primary)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '2px'
                }}
              >
                <Minus size={11} /> Zoom Out
              </button>
              <button
                onClick={() => handleYZoom(-1)}
                title="Zoom In Y-Axis (Expand candles vertically)"
                style={{
                  fontSize: '10px',
                  fontWeight: '700',
                  padding: '3px 6px',
                  borderRadius: '3px',
                  border: 'none',
                  cursor: 'pointer',
                  backgroundColor: 'transparent',
                  color: 'var(--text-primary)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '2px'
                }}
              >
                <Plus size={11} /> Zoom In
              </button>
              <button
                onClick={handleYReset}
                title="Reset Y-Axis to Auto-fit"
                style={{
                  fontSize: '10px',
                  fontWeight: '700',
                  padding: '3px 5px',
                  borderRadius: '3px',
                  border: 'none',
                  cursor: 'pointer',
                  backgroundColor: 'transparent',
                  color: '#38bdf8'
                }}
              >
                Auto
              </button>
            </div>
          </div>
        </div>

        {/* Maximize / Restore Button for Multi-Chart */}
        {onToggleMaximize && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleMaximize();
            }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '4px',
              padding: '0 8px',
              height: '26px',
              borderRadius: '6px',
              border: `1px solid ${isMaximized ? '#38bdf8' : (isDark ? 'rgba(56, 189, 248, 0.4)' : '#bae6fd')}`,
              backgroundColor: isMaximized ? 'rgba(56, 189, 248, 0.25)' : (isDark ? 'rgba(56, 189, 248, 0.1)' : 'rgba(2, 132, 199, 0.08)'),
              color: isMaximized ? '#38bdf8' : (isDark ? '#38bdf8' : '#0284c7'),
              cursor: 'pointer',
              flexShrink: 0,
              fontSize: '11px',
              fontWeight: '700',
              transition: 'all 0.15s ease'
            }}
            title={isMaximized ? "Restore grid layout (Show all charts)" : "Expand this chart to fullscreen (or double click top bar)"}
          >
            {isMaximized ? (
              <>
                <Minimize2 size={13} />
                <span>Restore</span>
              </>
            ) : (
              <>
                <Maximize2 size={13} />
                <span>Expand</span>
              </>
            )}
          </button>
        )}
      </div>

      {/* Delayed Data / WebSocket Disconnection Notice */}
      {connectionError && (
        <div style={{
          backgroundColor: 'rgba(239, 68, 68, 0.12)',
          borderBottom: '1px solid rgba(239, 68, 68, 0.25)',
          padding: '6px 16px',
          fontSize: '11px',
          color: '#fca5a5',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <AlertCircle size={14} color="#ef4444" style={{ flexShrink: 0 }} />
          <span><strong>Data Notice:</strong> {connectionError} — Reconnecting / retrying live feed.</span>
        </div>
      )}

      {/* CHART CANVAS AREA - Fluid Responsive Container with Absolute Inset Child */}
      <div style={{
        flex: 1,
        minHeight: 0,
        minWidth: 0,
        position: 'relative',
        width: '100%',
        height: '100%',
        overflow: 'hidden'
      }}>
        <div 
          ref={chartContainerRef} 
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} 
        >
        {/* Top-Left TradingView Style Symbol & Real-Time Bar Legend */}
        <div
          style={{
            position: 'absolute',
            top: '10px',
            left: '14px',
            zIndex: 12,
            pointerEvents: 'none',
            userSelect: 'none',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            fontSize: '11px',
            fontFamily: "'Outfit', -apple-system, BlinkMacSystemFont, sans-serif"
          }}
        >
          <span style={{ fontWeight: '700', color: isDark ? '#e2e8f0' : '#1e293b' }}>
            {symbolDisplayName} • {timeframe} • {symbol.split(':')[0] || 'NSE'}
          </span>
          {(() => {
            const c = hoveredCandle || (candles && candles.length > 0 ? candles[candles.length - 1] : null);
            if (!c || typeof c.close !== 'number') return null;
            const open = c.open ?? c.close;
            const high = c.high ?? c.close;
            const low = c.low ?? c.close;
            const close = c.close;
            const chg = close - open;
            const chgPct = open > 0 ? (chg / open) * 100 : 0;
            const isUp = chg >= 0;
            const col = isUp ? '#089981' : '#f23645';
            return (
              <span style={{ display: 'inline-flex', gap: '8px', color: col, fontWeight: '600' }}>
                <span style={{ color: isDark ? '#94a3b8' : '#64748b' }}>O <span style={{ color: col }}>{open.toFixed(2)}</span></span>
                <span style={{ color: isDark ? '#94a3b8' : '#64748b' }}>H <span style={{ color: col }}>{high.toFixed(2)}</span></span>
                <span style={{ color: isDark ? '#94a3b8' : '#64748b' }}>L <span style={{ color: col }}>{low.toFixed(2)}</span></span>
                <span style={{ color: isDark ? '#94a3b8' : '#64748b' }}>C <span style={{ color: col }}>{close.toFixed(2)}</span></span>
                <span style={{ fontWeight: '700' }}>{isUp ? '+' : ''}{chg.toFixed(2)} ({isUp ? '+' : ''}{chgPct.toFixed(2)}%)</span>
              </span>
            );
          })()}
        </div>

        {/* SVG Orderflow Levels Overlay matching TradingView media_1791133477061.png */}
        <svg
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            pointerEvents: 'none',
            zIndex: 10
          }}
        >
          {orderflowLines.lines.map((lvl) => {
            const isLabelLess = !lvl.title;
            const solidEndX = isLabelLess ? orderflowLines.rightX : orderflowLines.labelX;
            return (
              <g key={`ofl-${lvl.key}`}>
                {/* Projected Solid Level Line */}
                <line
                  x1={orderflowLines.startX}
                  y1={lvl.y}
                  x2={solidEndX}
                  y2={lvl.y}
                  stroke={lvl.color}
                  strokeWidth={lvl.lineWidth}
                  strokeDasharray={lvl.lineStyle === 'dashed' ? '5,4' : 'none'}
                  opacity={0.92}
                />
                {/* Right-aligned or End Level Label */}
                {lvl.title && (
                  <text
                    x={orderflowLines.labelX + 6}
                    y={lvl.y + 3.5}
                    textAnchor="start"
                    fill={lvl.labelColor}
                    fontSize="11"
                    fontWeight="700"
                    fontFamily="'Outfit', -apple-system, BlinkMacSystemFont, sans-serif"
                    style={{ letterSpacing: '0.2px' }}
                  >
                    {lvl.title} • {lvl.price.toFixed(1)}
                  </text>
                )}
                {/* Dashed Continuation Extension to Right Price Scale */}
                {lvl.hasExtension && (
                  <line
                    x1={orderflowLines.labelX + 125}
                    y1={lvl.y}
                    x2={orderflowLines.rightX}
                    y2={lvl.y}
                    stroke={lvl.extensionColor || lvl.color}
                    strokeWidth={1.2}
                    strokeDasharray="5,4"
                    opacity={0.85}
                  />
                )}
              </g>
            );
          })}
        </svg>

        {/* Center Chart Background Watermark matching TradingView */}
        <div
          style={{
            position: 'absolute',
            top: '48%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            textAlign: 'center',
            pointerEvents: 'none',
            userSelect: 'none',
            zIndex: 1,
            opacity: isDark ? 0.12 : 0.13
          }}
        >
          <div style={{
            fontSize: '58px',
            fontWeight: '900',
            color: isDark ? '#ffffff' : '#334155',
            letterSpacing: '-1.5px',
            lineHeight: 1.1
          }}>
            {symbol.replace('NSE:', '').replace('NFO:', '').replace('BSE:', '').replace('MCX:', '')}, {timeframe}
          </div>
          <div style={{
            fontSize: '26px',
            fontWeight: '700',
            color: isDark ? '#ffffff' : '#475569',
            marginTop: '2px',
            letterSpacing: '-0.5px'
          }}>
            {symbolDisplayName}
          </div>
        </div>

        {/* Bottom Right TradingView-style Indicator Badge */}
        <div
          style={{
            position: 'absolute',
            bottom: '36px',
            right: '75px',
            pointerEvents: 'none',
            userSelect: 'none',
            zIndex: 3,
            fontWeight: '800',
            fontSize: '11.5px',
            letterSpacing: '1px',
            color: '#ea580c',
            textTransform: 'uppercase'
          }}
        >
          ORDERFLOW LEVELS - MARSHALL
        </div>

        {/* Interactive Floating Y-Axis Zoom & Scale Handle on Price Scale */}
        <div
          style={{
            position: 'absolute',
            top: '8px',
            right: '6px',
            zIndex: 20,
            backgroundColor: 'rgba(15, 23, 42, 0.92)',
            border: '1px solid rgba(56, 189, 248, 0.45)',
            borderRadius: '6px',
            padding: '3px 4px',
            display: 'flex',
            alignItems: 'center',
            gap: '3px',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.6)'
          }}
        >
          <span style={{ fontSize: '9px', fontWeight: '800', color: '#38bdf8', letterSpacing: '0.3px', padding: '0 2px' }}>
            ↕ Y
          </span>
          <button
            onClick={() => handleYZoom(-1)}
            title="Zoom In Y-Axis (Expand candles vertically)"
            style={{
              width: '18px',
              height: '18px',
              borderRadius: '3px',
              border: 'none',
              background: 'rgba(56, 189, 248, 0.2)',
              color: '#38bdf8',
              fontSize: '13px',
              fontWeight: '900',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              lineHeight: 1
            }}
          >
            +
          </button>
          <button
            onClick={() => handleYZoom(1)}
            title="Zoom Out Y-Axis (Compress candles / reduce height)"
            style={{
              width: '18px',
              height: '18px',
              borderRadius: '3px',
              border: 'none',
              background: 'rgba(56, 189, 248, 0.2)',
              color: '#38bdf8',
              fontSize: '13px',
              fontWeight: '900',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              lineHeight: 1
            }}
          >
            −
          </button>
          <button
            onClick={handleYReset}
            title="Auto-Fit Price Range (Reset)"
            style={{
              padding: '1px 4px',
              borderRadius: '3px',
              border: 'none',
              background: 'rgba(255, 255, 255, 0.1)',
              color: '#94a3b8',
              fontSize: '9px',
              fontWeight: '700',
              cursor: 'pointer'
            }}
          >
            Fit
          </button>
        </div>

        {/* Two-Way Resize Arrow Handle on Time Scale (X-axis) */}
        <div
          title="Time Scale (X-axis): Click & drag left/right to scale time, scroll wheel to zoom"
          style={{
            position: 'absolute',
            bottom: '6px',
            right: '80px',
            zIndex: 15,
            backgroundColor: 'rgba(15, 23, 42, 0.85)',
            border: '1px solid rgba(56, 189, 248, 0.5)',
            color: '#38bdf8',
            borderRadius: '4px',
            padding: '2px 6px',
            fontSize: '9px',
            fontWeight: 800,
            cursor: 'ew-resize',
            pointerEvents: 'none',
            display: 'flex',
            alignItems: 'center',
            gap: '3px',
            boxShadow: '0 2px 6px rgba(0, 0, 0, 0.5)',
            fontFamily: 'monospace'
          }}
        >
          <span>↔ SCALE TIME</span>
        </div>
      </div>
      </div>

      {showAdvPanel && (
        <div style={{ padding: '0 16px 16px 16px', overflowY: 'auto', flexShrink: 0, maxHeight: '200px' }}>
          <AdvIndicatorPanel candles={candles} symbol={symbol} timeframe={timeframe} />
        </div>
      )}

      {/* Real-time Level Alert Popup (rendered if not globally managed) */}
      {!isGloballyManaged && (
        <RealtimeLevelAlertPopup
          alert={activeAlert}
          onClose={() => setLocalActiveAlert(null)}
          onResetSetup={handleResetSetupAlerts}
        />
      )}

    </div>
  );
};
