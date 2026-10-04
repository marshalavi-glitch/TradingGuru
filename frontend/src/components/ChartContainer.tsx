import React, { useEffect, useRef, useState, useMemo } from 'react';
import { createChart } from 'lightweight-charts';
import type { IChartApi, ISeriesApi, Time } from 'lightweight-charts';
import { calculateDayProfile, type Candle } from '../utils/profileCalculator';
import type { MatrixSeriesData } from '../utils/matrixCalculator';
import { AdvIndicatorPanel } from './AdvIndicatorPanel';
import { RealtimeLevelAlertPopup } from './RealtimeLevelAlertPopup';
import type { LevelAlert } from './RealtimeLevelAlertPopup';
import { Bell, RotateCcw, Zap, AlertCircle, Wifi, WifiOff } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

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
  firedAlertsCount: globalFiredAlertsCount
}) => {
  const { isDark } = useTheme();
  const [candleStyle, setCandleStyle] = useState<'japanese' | 'heikin-ashi'>('japanese');
  const [showAdvPanel, setShowAdvPanel] = useState<boolean>(false);
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
      const todayCandles = candles.filter((c) => {
        const d = typeof c.time === 'string'
          ? c.time.slice(0, 10)
          : new Date((c.time as number) * 1000).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
        return d === sessionDate;
      });

      if (todayCandles.length === 0) return null;
      return calculateDayProfile(todayCandles, 5, sessionDate);
    } catch (e) {
      return null;
    }
  }, [candles, sessionDate]);

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

  // GEX Refs
  const gexCallWallLineRef = useRef<any>(null);
  const gexPutWallLineRef = useRef<any>(null);
  const gexFlipZoneLineRef = useRef<any>(null);
  const gexMaxPainLineRef = useRef<any>(null);

  const onVisiblePriceRangeChangeRef = useRef(onVisiblePriceRangeChange);
  const handleRangeChangeRef = useRef<() => void>(() => {});

  useEffect(() => {
    onVisiblePriceRangeChangeRef.current = onVisiblePriceRangeChange;
  }, [onVisiblePriceRangeChange]);

  useEffect(() => {
    if (!chartContainerRef.current) return;

    // Create chart instance
    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { color: isDark ? '#0d1017' : '#ffffff' },
        textColor: isDark ? '#9ca3af' : '#334155',
        fontSize: 12,
        fontFamily: 'Outfit, sans-serif'
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
        vertLines: { color: isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.05)' },
        horzLines: { color: isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.05)' }
      },
      crosshair: {
        mode: 1, // CrosshairMode.Normal
        vertLine: {
          color: '#8b5cf6',
          width: 1,
          style: 3, // LineStyle.Dashed
          labelBackgroundColor: '#8b5cf6'
        },
        horzLine: {
          color: '#8b5cf6',
          width: 1,
          style: 3, // LineStyle.Dashed
          labelBackgroundColor: '#8b5cf6'
        }
      },
      rightPriceScale: {
        borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.1)',
        visible: true,
        autoScale: true,
        scaleMargins: {
          top: 0.1,
          bottom: 0.15
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
        borderColor: 'rgba(255, 255, 255, 0.08)',
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

    // Add Candlestick Series with stable auto-scale based strictly on visible candle bars
    const candlestickSeries = chart.addCandlestickSeries({
      upColor: '#10b981',
      downColor: '#ef4444',
      borderVisible: false,
      wickUpColor: '#10b981',
      wickDownColor: '#ef4444',
      autoscaleInfoProvider: (original: () => any) => {
        const res = original();
        if (!res || !res.priceRange) return null;
        return {
          priceRange: {
            minValue: res.priceRange.minValue,
            maxValue: res.priceRange.maxValue,
          },
          margins: {
            above: 0.08,
            below: 0.12,
          }
        };
      }
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
        lastValueVisible: true,
        title: cfg.title,
        autoscaleInfoProvider: () => null
      });
    });
    matrixSeriesRef.current = matrixSeriesList;

    const handleRangeChange = () => {
      if (!chartRef.current || !candlestickSeriesRef.current) return;
      try {
        const height = chartRef.current.paneSize().height;
        const min = candlestickSeriesRef.current.coordinateToPrice(height);
        const max = candlestickSeriesRef.current.coordinateToPrice(0);
        if (min !== null && max !== null && min < max) {
          onVisiblePriceRangeChangeRef.current?.({ min, max, paneHeight: height });
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

    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.applyOptions({
          width: chartContainerRef.current.clientWidth,
          height: chartContainerRef.current.clientHeight
        });
        requestAnimationFrame(handleRangeChange);
      }
    };
    
    window.addEventListener('resize', handleResize);
    handleResize();

    // Robust ResizeObserver: Prevents chart from collapsing or misaligning when switching tabs
    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined' && chartContainerRef.current) {
      resizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
          if (entry.target === chartContainerRef.current && chartRef.current) {
            const { width, height } = entry.contentRect;
            if (width > 0 && height > 0) {
              chartRef.current.applyOptions({ width, height });
              requestAnimationFrame(handleRangeChange);
            }
          }
        }
      });
      resizeObserver.observe(chartContainerRef.current);
    }

    const container = chartContainerRef.current;
    const triggerUpdate = () => {
      requestAnimationFrame(handleRangeChange);
    };

    if (container) {
      container.addEventListener('wheel', triggerUpdate, { passive: true });
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
        container.removeEventListener('wheel', triggerUpdate);
        container.removeEventListener('mousemove', triggerUpdate);
        container.removeEventListener('touchmove', triggerUpdate);
      }
      chart.remove();
    };
  }, []);

  // Update chart data
  useEffect(() => {
    if (!candlestickSeriesRef.current || !volumeSeriesRef.current || !candles || candles.length === 0) return;

    // Sanitize candles: filter out invalid numbers, deduplicate timestamps, and sort ascending
    const validCandlesMap = new Map<number, Candle>();
    candles.forEach((c) => {
      if (c && typeof c.time === 'number' && !isNaN(c.time) && !isNaN(c.close) && !isNaN(c.open) && !isNaN(c.high) && !isNaN(c.low)) {
        validCandlesMap.set(c.time, c);
      }
    });
    const sortedCandles = Array.from(validCandlesMap.values()).sort((a, b) => a.time - b.time);
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

    const datasetKey = `${symbol}_${timeframe}_${sessionPeriod || 'daily'}_${candleStyle}`;
    const isDatasetChange = prevDatasetKeyRef.current !== datasetKey;
    const isMajorCountChange = Math.abs(sortedCandles.length - prevCandlesCountRef.current) > 1;

    if (isDatasetChange || isMajorCountChange || prevCandlesCountRef.current === 0) {
      candlestickSeriesRef.current.setData(chartData);
      volumeSeriesRef.current.setData(volumeData);
      prevDatasetKeyRef.current = datasetKey;
      prevCandlesCountRef.current = sortedCandles.length;
    } else {
      // Incremental real-time tick update: only update the latest candle in-place!
      // This prevents Lightweight Charts from repeatedly resetting/expanding the Y-axis!
      const lastCandle = chartData[chartData.length - 1];
      const lastVol = volumeData[volumeData.length - 1];
      if (lastCandle) {
        candlestickSeriesRef.current.update(lastCandle);
      }
      if (lastVol) {
        volumeSeriesRef.current.update(lastVol);
      }
      prevCandlesCountRef.current = sortedCandles.length;
    }

    // Calculate and set daily-anchored VWAP
    if (vwapSeriesRef.current) {
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

      if (isDatasetChange || isMajorCountChange) {
        vwapSeriesRef.current.setData(vwapData);
      } else {
        const lastVwap = vwapData[vwapData.length - 1];
        if (lastVwap) {
          vwapSeriesRef.current.update(lastVwap);
        }
      }
    }

    // Set Matrix series data with strict deduplication & ascending time order
    if (matrixSeriesRef.current.length === 10 && matrixSeriesData) {
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
        matrixSeriesRef.current[0].setData(s1);
        matrixSeriesRef.current[1].setData(shiftSeries(matrixSeriesData.level2));
        matrixSeriesRef.current[2].setData(shiftSeries(matrixSeriesData.level3));
        matrixSeriesRef.current[3].setData(shiftSeries(matrixSeriesData.level4));
        matrixSeriesRef.current[4].setData(shiftSeries(matrixSeriesData.level5));
        matrixSeriesRef.current[5].setData(shiftSeries(matrixSeriesData.level6));
        matrixSeriesRef.current[6].setData(shiftSeries(matrixSeriesData.level7));
        matrixSeriesRef.current[7].setData(shiftSeries(matrixSeriesData.level8));
        matrixSeriesRef.current[8].setData(shiftSeries(matrixSeriesData.level9));
        matrixSeriesRef.current[9].setData(shiftSeries(matrixSeriesData.level10));
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
  }, [candles, symbol, timeframe, sessionPeriod, matrixSeriesData, candleStyle]);

  // Dynamic theme update for Lightweight Charts
  useEffect(() => {
    if (!chartRef.current) return;
    chartRef.current.applyOptions({
      layout: {
        background: { color: isDark ? '#0d1017' : '#ffffff' },
        textColor: isDark ? '#9ca3af' : '#334155'
      },
      grid: {
        vertLines: { color: isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.05)' },
        horzLines: { color: isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.05)' }
      },
      rightPriceScale: {
        borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.1)'
      }
    });
  }, [isDark]);

  // Update Price Lines on dedicated levelsSeries (preventing Y-axis expansion from distant levels)
  useEffect(() => {
    const series = levelsSeriesRef.current || candlestickSeriesRef.current;
    if (!series) return;

    const currentPrice = (candles && candles.length > 0) ? candles[candles.length - 1].close : 0;
    // Guard against distant levels (like Fib 3.618 or old monthly NPOCs) distorting/collapsing the vertical candle scale
    const isPriceNear = (price?: number, maxDistancePct: number = 0.035) => {
      if (!price || !currentPrice || price <= 0) return false;
      return Math.abs(price - currentPrice) / currentPrice <= maxDistancePct;
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
    <div className="glass-panel animate-fade-in" style={{ display: 'flex', flexDirection: 'column', flex: '1', height: '100%', overflow: 'hidden', position: 'relative' }}>
      
      {/* Chart Title Overlay & Status Toolbar */}
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', padding: '12px 18px', borderBottom: '1px solid var(--border-color)', backgroundColor: 'rgba(13, 16, 23, 0.4)', gap: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '15px', fontWeight: '700', color: 'white' }}>{symbol}</span>
            <span style={{ fontSize: '11px', color: 'var(--text-secondary)', backgroundColor: 'rgba(255,255,255,0.05)', padding: '2px 6px', borderRadius: '4px' }}>
              {timeframe === 'D' ? 'Daily' : timeframe === 'W' ? 'Weekly' : timeframe === 'M' ? 'Monthly' : `${timeframe}m`} Chart
            </span>
            {isOption && (
              <span style={{
                fontSize: '10px',
                fontWeight: '800',
                color: '#38bdf8',
                backgroundColor: 'rgba(56, 189, 248, 0.15)',
                border: '1px solid rgba(56, 189, 248, 0.4)',
                padding: '2px 8px',
                borderRadius: '4px',
                letterSpacing: '0.5px'
              }}>
                🎯 OPTION CHART
              </span>
            )}
          </div>

          {/* Connection Status Pill */}
          <div style={{ display: 'flex', alignItems: 'center' }}>
            {connectionStatus === 'connected' ? (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '11px', fontWeight: '600', color: '#10b981', backgroundColor: 'rgba(16, 185, 129, 0.1)', padding: '2px 8px', borderRadius: '6px', border: '1px solid rgba(16, 185, 129, 0.25)' }}>
                <Wifi size={12} /> Live Ticks
              </span>
            ) : connectionStatus === 'connecting' ? (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '11px', fontWeight: '600', color: '#f59e0b', backgroundColor: 'rgba(245, 158, 11, 0.1)', padding: '2px 8px', borderRadius: '6px', border: '1px solid rgba(245, 158, 11, 0.25)' }}>
                <Wifi size={12} /> Connecting...
              </span>
            ) : (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '11px', fontWeight: '600', color: '#ef4444', backgroundColor: 'rgba(239, 68, 68, 0.1)', padding: '2px 8px', borderRadius: '6px', border: '1px solid rgba(239, 68, 68, 0.25)' }}>
                <WifiOff size={12} /> Disconnected
              </span>
            )}
          </div>

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
          </div>
        </div>

        {(() => {
          const displayCandle = hoveredCandle || (candles && candles.length > 0 ? candles[candles.length - 1] : null);
          if (!displayCandle || typeof displayCandle.close !== 'number' || isNaN(displayCandle.close)) return null;

          const open = typeof displayCandle.open === 'number' ? displayCandle.open : displayCandle.close;
          const high = typeof displayCandle.high === 'number' ? displayCandle.high : displayCandle.close;
          const low = typeof displayCandle.low === 'number' ? displayCandle.low : displayCandle.close;
          const close = displayCandle.close;
          const change = close - open;
          const changePct = open > 0 ? (change / open) * 100 : 0;
          const isUp = change >= 0;
          const changeColor = isUp ? '#10b981' : '#ef4444';

          return (
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '11px', fontFamily: 'var(--font-mono)' }}>
              <span>O: <strong style={{ color: isDark ? 'white' : '#0f172a' }}>{open.toFixed(2)}</strong></span>
              <span>H: <strong style={{ color: '#10b981' }}>{high.toFixed(2)}</strong></span>
              <span>L: <strong style={{ color: '#ef4444' }}>{low.toFixed(2)}</strong></span>
              <span>C: <strong style={{ color: changeColor }}>{close.toFixed(2)}</strong></span>
              <span style={{ color: changeColor, fontWeight: '700' }}>
                {isUp ? '+' : ''}{change.toFixed(2)} ({isUp ? '+' : ''}{changePct.toFixed(2)}%)
              </span>
            </div>
          );
        })()}
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

      <div 
        ref={chartContainerRef} 
        style={{ flex: '1', minHeight: '320px', width: '100%', position: 'relative' }} 
      >
        {/* Two-Way Resize Arrow Handle on Price Scale (Y-axis) */}
        <div
          title="Price Scale (Y-axis): Click & drag up/down to scale price, double-click to auto-fit"
          style={{
            position: 'absolute',
            top: '8px',
            right: '6px',
            zIndex: 15,
            backgroundColor: 'rgba(15, 23, 42, 0.85)',
            border: '1px solid rgba(56, 189, 248, 0.5)',
            color: '#38bdf8',
            borderRadius: '4px',
            padding: '2px 5px',
            fontSize: '9px',
            fontWeight: 800,
            cursor: 'ns-resize',
            pointerEvents: 'none',
            display: 'flex',
            alignItems: 'center',
            gap: '2px',
            boxShadow: '0 2px 6px rgba(0, 0, 0, 0.5)',
            fontFamily: 'monospace'
          }}
        >
          <span>↕ SCALE</span>
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

      {showAdvPanel && (
        <div style={{ padding: '0 16px 16px 16px', overflowY: 'auto' }}>
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
