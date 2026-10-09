import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { createChart } from 'lightweight-charts';
import type { IChartApi, ISeriesApi, Time } from 'lightweight-charts';
import { getBackendHttpUrl, tvStreamer } from '../utils/tvStreamer';
import { RefreshCw, Layers, BarChart2, ShieldCheck, Activity, Camera, Radio, Plus, Minus } from 'lucide-react';

interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface TestingContainerProps {
  selectedSymbol?: string;
  selectedTimeframe?: string;
  onSymbolSelect?: (symbol: string) => void;
  onTimeframeChange?: (timeframe: string) => void;
  onSwitchToChart?: () => void;
}

const IST_OFFSET_SECONDS = 19800; // +5:30 IST shift for TradingView Lightweight Charts UTC mapping

interface LevelConfig {
  key: string;
  title: string;
  price: number;
  color: string;
  lineStyle: 'solid' | 'dashed' | 'dotted';
  lineWidth: number;
  badgeBg: string;
  category: 'matrix' | 'option' | 'vwap';
}

// Exact 1-to-1 Screenshot Reference Levels as shown in user's image (22498.35 Nifty setup)
const SCREENSHOT_REFERENCE_LEVELS: LevelConfig[] = [
  { key: 'L1', title: 'L1', price: 22818.87, color: '#ef4444', lineStyle: 'solid', lineWidth: 1.5, badgeBg: '#ef4444', category: 'matrix' },
  { key: 'L2', title: 'L2', price: 22764.59, color: '#f87171', lineStyle: 'solid', lineWidth: 1.5, badgeBg: '#f87171', category: 'matrix' },
  { key: 'CW', title: 'CW', price: 22700.00, color: '#dc2626', lineStyle: 'solid', lineWidth: 1.5, badgeBg: '#dc2626', category: 'option' },
  { key: 'L3', title: 'L3', price: 22638.27, color: '#f59e0b', lineStyle: 'solid', lineWidth: 1.5, badgeBg: '#f59e0b', category: 'matrix' },
  { key: 'L4', title: 'L4', price: 22530.11, color: '#ec4899', lineStyle: 'dashed', lineWidth: 1.5, badgeBg: '#ec4899', category: 'matrix' },
  { key: 'MP', title: 'MP', price: 22500.00, color: '#d946ef', lineStyle: 'solid', lineWidth: 1.5, badgeBg: '#d946ef', category: 'option' },
  { key: 'PZ', title: 'PZ', price: 22500.00, color: '#8b5cf6', lineStyle: 'solid', lineWidth: 1.5, badgeBg: '#8b5cf6', category: 'option' },
  { key: 'L5', title: 'L5', price: 22494.06, color: '#f59e0b', lineStyle: 'solid', lineWidth: 1.2, badgeBg: '#f59e0b', category: 'matrix' },
  { key: 'VWAP', title: 'VWAP', price: 22479.03, color: '#6366f1', lineStyle: 'dashed', lineWidth: 1.5, badgeBg: '#6366f1', category: 'vwap' },
  { key: 'L6', title: 'L6', price: 22349.85, color: '#f59e0b', lineStyle: 'solid', lineWidth: 1.2, badgeBg: '#f59e0b', category: 'matrix' },
  { key: 'L7', title: 'L7', price: 22313.79, color: '#10b981', lineStyle: 'dashed', lineWidth: 1.5, badgeBg: '#10b981', category: 'matrix' },
  { key: 'PW', title: 'PW', price: 22300.00, color: '#22c55e', lineStyle: 'solid', lineWidth: 1.5, badgeBg: '#22c55e', category: 'option' },
  { key: 'L8', title: 'L8', price: 22205.64, color: '#f59e0b', lineStyle: 'solid', lineWidth: 1.5, badgeBg: '#f59e0b', category: 'matrix' },
  { key: '0', title: '0', price: 22100.00, color: '#10b981', lineStyle: 'solid', lineWidth: 1.2, badgeBg: '#10b981', category: 'matrix' },
  { key: 'L9', title: 'L9', price: 22079.31, color: '#059669', lineStyle: 'solid', lineWidth: 1.5, badgeBg: '#059669', category: 'matrix' },
];

// Exact candles sequence matching the screenshot from 01 Oct
// Base time: 01 Oct 2026, drop candle at 06:45 UTC
const BASE_T = 1790833200; // ~05:40 UTC
const SCREENSHOT_CANDLES: Candle[] = [
  { time: BASE_T + 0, open: 22475.0, high: 22502.0, low: 22460.0, close: 22485.0, volume: 1650 },
  { time: BASE_T + 900, open: 22485.0, high: 22518.0, low: 22478.0, close: 22512.0, volume: 2100 },
  { time: BASE_T + 1800, open: 22512.0, high: 22524.0, low: 22495.0, close: 22506.0, volume: 1840 },
  { time: BASE_T + 2700, open: 22506.0, high: 22516.0, low: 22488.0, close: 22492.0, volume: 1530 },
  { time: BASE_T + 3600, open: 22492.0, high: 22518.0, low: 22490.0, close: 22515.0, volume: 1720 },
  { time: BASE_T + 4500, open: 22515.0, high: 22518.0, low: 22475.0, close: 22482.0, volume: 2280 },
  // Drop bar highlighted with circle marker at 01 Oct 06:45:
  { time: BASE_T + 5400, open: 22482.0, high: 22486.0, low: 22425.0, close: 22432.0, volume: 3850 },
  { time: BASE_T + 6300, open: 22432.0, high: 22438.0, low: 22365.0, close: 22372.0, volume: 4420 },
  { time: BASE_T + 7200, open: 22372.0, high: 22376.0, low: 22312.0, close: 22325.0, volume: 5120 }, // Low at PW / L7
  { time: BASE_T + 8100, open: 22325.0, high: 22405.0, low: 22308.0, close: 22390.0, volume: 4890 }, // Bounce
  { time: BASE_T + 9000, open: 22390.0, high: 22462.0, low: 22385.0, close: 22458.0, volume: 3950 },
  { time: BASE_T + 9900, open: 22458.0, high: 22530.0, low: 22452.0, close: 22525.0, volume: 4320 }, // Push above PZ
  { time: BASE_T + 10800, open: 22525.0, high: 22535.0, low: 22482.0, close: 22490.0, volume: 3100 },
  { time: BASE_T + 11700, open: 22490.0, high: 22508.0, low: 22472.0, close: 22478.0, volume: 2450 },
  { time: BASE_T + 12600, open: 22478.0, high: 22506.0, low: 22475.0, close: 22498.35, volume: 2180 } // Current close 22498.35
];

export function TestingContainer({
  selectedSymbol = 'NSE:NIFTY',
  selectedTimeframe = '5',
  onSymbolSelect,
  onTimeframeChange,
  onSwitchToChart
}: TestingContainerProps) {
  const [symbol, setSymbol] = useState(selectedSymbol);
  const [timeframe, setTimeframe] = useState(selectedTimeframe);
  const [isScreenshotMode, setIsScreenshotMode] = useState<boolean>(true); // Defaults to exact screenshot match
  const [candles, setCandles] = useState<Candle[]>(SCREENSHOT_CANDLES);
  const [loading, setLoading] = useState(false);
  const [liveLtp, setLiveLtp] = useState<number | null>(22498.35);
  const [optionsChainData, setOptionsChainData] = useState<any>(null);

  // Indicator Toggles
  const [showMatrixLevels, setShowMatrixLevels] = useState(true);
  const [showOptionWalls, setShowOptionWalls] = useState(true);
  const [showVwap, setShowVwap] = useState(true);
  const [showStepLadder, setShowStepLadder] = useState(true);
  const [showMajorBoundaries, setShowMajorBoundaries] = useState(true);

  // Hovered candle info for legend
  const [hoveredCandle, setHoveredCandle] = useState<Candle | null>(null);

  // Chart DOM and references
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candlestickSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const vwapSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const priceLinesRef = useRef<any[]>([]);

  // Step ladder overlay lines state
  const [ladderLines, setLadderLines] = useState<{
    startX: number;
    rightX: number;
    lines: Array<{
      key: string;
      title: string;
      price: number;
      y: number;
      color: string;
      lineStyle: 'solid' | 'dashed' | 'dotted';
      lineWidth: number;
    }>;
  }>({ startX: 0, rightX: 0, lines: [] });

  // Y-Axis Zoom Level (1.0 = auto default, > 1.0 = zoom out / compress candles, < 1.0 = zoom in / expand candles)
  const [yZoom, setYZoom] = useState<number>(1.25);
  const yZoomRef = useRef<number>(1.25);
  const handleYZoomRef = useRef<(delta: number) => void>(() => {});
  const handleYResetRef = useRef<() => void>(() => {});
  const updateLadderOverlayRef = useRef<() => void>(() => {});

  const getAutoscaleProvider = useCallback((zoomVal: number) => {
    return (original: () => any) => {
      const res = original();
      if (!res || !res.priceRange) return null;
      const min = res.priceRange.minValue;
      const max = res.priceRange.maxValue;
      const mid = (min + max) / 2;
      const rawSpan = Math.max(max - min, 1);

      // Ensure healthy minimum price span so ticks are not spaced 4 points apart on flat market
      const minPct = mid > 10000 ? 0.0035 : (mid > 1000 ? 0.005 : 0.01);
      const minSpan = Math.max(rawSpan, mid * minPct);

      const halfSpan = (minSpan / 2) * zoomVal;

      return {
        priceRange: {
          minValue: mid - halfSpan,
          maxValue: mid + halfSpan,
        },
        margins: {
          above: 0.06,
          below: 0.06,
        }
      };
    };
  }, []);

  const handleYZoom = useCallback((delta: number) => {
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
      requestAnimationFrame(updateLadderOverlayRef.current);
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
      requestAnimationFrame(updateLadderOverlayRef.current);
    }
  }, [getAutoscaleProvider]);

  useEffect(() => {
    handleYZoomRef.current = handleYZoom;
    handleYResetRef.current = handleYReset;
  }, [handleYZoom, handleYReset]);

  // Sync props
  useEffect(() => {
    if (selectedSymbol && selectedSymbol !== symbol) setSymbol(selectedSymbol);
  }, [selectedSymbol]);

  useEffect(() => {
    if (selectedTimeframe && selectedTimeframe !== timeframe) setTimeframe(selectedTimeframe);
  }, [selectedTimeframe]);

  // Fetch initial candles & option chain if in LIVE mode
  const fetchCandlesData = async () => {
    if (isScreenshotMode) {
      setCandles(SCREENSHOT_CANDLES);
      setLiveLtp(22498.35);
      return;
    }

    try {
      setLoading(true);
      const backendUrl = await getBackendHttpUrl();
      const [candleRes, optRes] = await Promise.all([
        fetch(`${backendUrl}/api/candles?symbol=${encodeURIComponent(symbol)}&timeframe=${timeframe}&limit=350`),
        fetch(`${backendUrl}/api/options/chain?symbol=${encodeURIComponent(symbol)}`).catch(() => null)
      ]);

      if (candleRes.ok) {
        const json = await candleRes.json();
        const raw = json.candles || [];
        if (raw.length > 0) {
          setCandles(raw);
          setLiveLtp(raw[raw.length - 1].close);
        }
      }

      if (optRes && optRes.ok) {
        const optJson = await optRes.json();
        setOptionsChainData(optJson);
      }
    } catch (err) {
      console.warn('[Testing Tab] Fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCandlesData();
  }, [symbol, timeframe, isScreenshotMode]);

  // Subscribe to real-time WebSocket ticker when live
  useEffect(() => {
    if (isScreenshotMode) return;

    const handleData = (msg: any) => {
      if (msg && msg.symbol === symbol && Array.isArray(msg.candles) && msg.candles.length > 0) {
        setCandles(prev => {
          if (msg.isSnapshot) return msg.candles;
          const updated = [...prev];
          for (const newC of msg.candles) {
            const idx = updated.findIndex(c => c.time === newC.time);
            if (idx >= 0) {
              updated[idx] = newC;
            } else {
              updated.push(newC);
            }
          }
          return updated;
        });

        const last = msg.candles[msg.candles.length - 1];
        if (last) setLiveLtp(last.close);
      }
    };

    const unsubscribe = tvStreamer.subscribe(symbol, timeframe, handleData);
    return () => {
      unsubscribe();
    };
  }, [symbol, timeframe, isScreenshotMode]);

  // Calculate VWAP series
  const vwapData = useMemo(() => {
    if (isScreenshotMode) {
      // Screenshot reference VWAP line tracking the exact indigo dashed line
      return SCREENSHOT_CANDLES.map((c, i) => {
        const targetVwap = i === SCREENSHOT_CANDLES.length - 1 ? 22479.03 : (22470 + Math.sin(i / 2) * 12);
        return {
          time: ((c.time + IST_OFFSET_SECONDS) as Time),
          value: parseFloat(targetVwap.toFixed(2))
        };
      });
    }

    if (!candles || candles.length === 0) return [];
    const points: { time: Time; value: number }[] = [];
    let cumulativeVol = 0;
    let cumulativeTypicalVol = 0;
    let lastDateStr = '';

    for (const c of candles) {
      const d = new Date((c.time + IST_OFFSET_SECONDS) * 1000);
      const dateStr = d.toISOString().slice(0, 10);

      // Session anchor reset at start of each day
      if (dateStr !== lastDateStr) {
        cumulativeVol = 0;
        cumulativeTypicalVol = 0;
        lastDateStr = dateStr;
      }

      const typicalPrice = (c.high + c.low + c.close) / 3;
      const vol = Math.max(1, c.volume || 100);
      cumulativeTypicalVol += typicalPrice * vol;
      cumulativeVol += vol;

      const vwapVal = cumulativeVol > 0 ? parseFloat((cumulativeTypicalVol / cumulativeVol).toFixed(2)) : c.close;
      points.push({
        time: ((c.time + IST_OFFSET_SECONDS) as Time),
        value: vwapVal
      });
    }

    return points;
  }, [candles, isScreenshotMode]);

  const currentVwap = useMemo(() => {
    if (isScreenshotMode) return 22479.03;
    if (vwapData.length === 0) return null;
    return vwapData[vwapData.length - 1].value;
  }, [vwapData, isScreenshotMode]);

  // Calculate Matrix levels (L1 - L9) and Options Walls (CW, PW, MP, PZ)
  const computedLevels = useMemo((): LevelConfig[] => {
    if (isScreenshotMode) {
      return [...SCREENSHOT_REFERENCE_LEVELS];
    }

    if (!candles || candles.length === 0) return [];

    // Group candles by IST date
    const groups: Record<string, Candle[]> = {};
    const groupKeys: string[] = [];

    candles.forEach(c => {
      const d = new Date((c.time + IST_OFFSET_SECONDS) * 1000);
      const k = d.toISOString().slice(0, 10);
      if (!groups[k]) {
        groups[k] = [];
        groupKeys.push(k);
      }
      groups[k].push(c);
    });

    groupKeys.sort();

    // Use previous completed session for levels anchor
    const prevKey = groupKeys.length >= 2 ? groupKeys[groupKeys.length - 2] : groupKeys[0];
    const prevCandles = groups[prevKey] || candles;

    let h_prev = Math.max(...prevCandles.map(c => c.high));
    let l_prev = Math.min(...prevCandles.map(c => c.low));
    const sortedPrev = [...prevCandles].sort((a, b) => a.time - b.time);
    let c_prev = sortedPrev[sortedPrev.length - 1].close;

    let r_prev = h_prev - l_prev;
    if (r_prev <= 0) r_prev = Math.max(10, c_prev * 0.015);

    // Exact Mathematical Formulas as verified from the reference screenshot:
    // L5 = r2 = c_prev + (r_prev * 1.1 / 6)
    // L4 = r3 = c_prev + (r_prev * 1.1 / 4)
    // L3 = r4 = c_prev + (r_prev * 1.1 / 2)
    // L2 = r5 = r4 + 1.168 * (r4 - r3)
    // L1 = r6 = (h_prev / l_prev) * c_prev
    // L6 = s2 = c_prev - (r_prev * 1.1 / 6)
    // L7 = s3 = c_prev - (r_prev * 1.1 / 4)
    // L8 = s4 = c_prev - (r_prev * 1.1 / 2)
    // 0  = s5 = s4 - 1.168 * (s3 - s4)
    // L9 = s6 = c_prev - (r6 - c_prev)

    const r2 = c_prev + (r_prev * 1.1 / 6.0);
    const s2 = c_prev - (r_prev * 1.1 / 6.0);
    const r3 = c_prev + (r_prev * 1.1 / 4.0);
    const s3 = c_prev - (r_prev * 1.1 / 4.0);
    const r4 = c_prev + (r_prev * 1.1 / 2.0);
    const s4 = c_prev - (r_prev * 1.1 / 2.0);
    const r5 = r4 + 1.168 * (r4 - r3);
    const s5 = s4 - 1.168 * (s3 - s4);
    const r6 = l_prev > 0 ? (h_prev / l_prev) * c_prev : c_prev * 1.03;
    const s6 = c_prev - (r6 - c_prev);

    const curClose = liveLtp || candles[candles.length - 1].close;

    // Detect strike interval: 50 for Nifty, 100 for Bank Nifty, 20 for stocks, 5 for MCX
    const symUpper = symbol.toUpperCase();
    const interval = symUpper.includes('BANK') ? 100 : (symUpper.includes('NIFTY') ? 50 : (curClose > 1000 ? 50 : 20));

    // Option Wall strikes
    let pzStrike = Math.round(curClose / interval) * interval;
    let mpStrike = pzStrike;
    let cwStrike = pzStrike + (interval * 4);
    let pwStrike = pzStrike - (interval * 4);
    let zeroStrike = Math.round(s5 / interval) * interval;

    if (optionsChainData) {
      if (optionsChainData.callWall) cwStrike = optionsChainData.callWall;
      if (optionsChainData.putWall) pwStrike = optionsChainData.putWall;
      if (optionsChainData.maxPain) mpStrike = optionsChainData.maxPain;
      if (optionsChainData.atmStrike) pzStrike = optionsChainData.atmStrike;
    }

    const configs: LevelConfig[] = [
      // Top Resistance levels
      { key: 'L1', title: 'L1', price: parseFloat(r6.toFixed(2)), color: '#ef4444', lineStyle: 'solid', lineWidth: 1.5, badgeBg: '#ef4444', category: 'matrix' },
      { key: 'L2', title: 'L2', price: parseFloat(r5.toFixed(2)), color: '#f87171', lineStyle: 'solid', lineWidth: 1.5, badgeBg: '#f87171', category: 'matrix' },
      { key: 'CW', title: 'CW', price: cwStrike, color: '#dc2626', lineStyle: 'solid', lineWidth: 1.5, badgeBg: '#dc2626', category: 'option' },
      { key: 'L3', title: 'L3', price: parseFloat(r4.toFixed(2)), color: '#f59e0b', lineStyle: 'solid', lineWidth: 1.5, badgeBg: '#f59e0b', category: 'matrix' },
      { key: 'L4', title: 'L4', price: parseFloat(r3.toFixed(2)), color: '#ec4899', lineStyle: 'dashed', lineWidth: 1.5, badgeBg: '#ec4899', category: 'matrix' },
      
      // Pivot Equilibrium / Walls
      { key: 'MP', title: 'MP', price: mpStrike, color: '#d946ef', lineStyle: 'solid', lineWidth: 1.5, badgeBg: '#d946ef', category: 'option' },
      { key: 'PZ', title: 'PZ', price: pzStrike, color: '#8b5cf6', lineStyle: 'solid', lineWidth: 1.5, badgeBg: '#8b5cf6', category: 'option' },
      { key: 'L5', title: 'L5', price: parseFloat(r2.toFixed(2)), color: '#f59e0b', lineStyle: 'solid', lineWidth: 1.2, badgeBg: '#f59e0b', category: 'matrix' },
      
      // Support levels
      { key: 'L6', title: 'L6', price: parseFloat(s2.toFixed(2)), color: '#f59e0b', lineStyle: 'solid', lineWidth: 1.2, badgeBg: '#f59e0b', category: 'matrix' },
      { key: 'L7', title: 'L7', price: parseFloat(s3.toFixed(2)), color: '#10b981', lineStyle: 'dashed', lineWidth: 1.5, badgeBg: '#10b981', category: 'matrix' },
      { key: 'PW', title: 'PW', price: pwStrike, color: '#22c55e', lineStyle: 'solid', lineWidth: 1.5, badgeBg: '#22c55e', category: 'option' },
      { key: 'L8', title: 'L8', price: parseFloat(s4.toFixed(2)), color: '#f59e0b', lineStyle: 'solid', lineWidth: 1.5, badgeBg: '#f59e0b', category: 'matrix' },
      { key: '0', title: '0', price: zeroStrike, color: '#10b981', lineStyle: 'solid', lineWidth: 1.2, badgeBg: '#10b981', category: 'matrix' },
      { key: 'L9', title: 'L9', price: parseFloat(s6.toFixed(2)), color: '#059669', lineStyle: 'solid', lineWidth: 1.5, badgeBg: '#059669', category: 'matrix' },
    ];

    // Append VWAP level if active
    if (currentVwap !== null) {
      configs.push({
        key: 'VWAP',
        title: 'VWAP',
        price: currentVwap,
        color: '#6366f1',
        lineStyle: 'dashed',
        lineWidth: 1.5,
        badgeBg: '#6366f1',
        category: 'vwap'
      });
    }

    // Sort descending by price so badges stack cleanly
    configs.sort((a, b) => b.price - a.price);

    return configs;
  }, [candles, liveLtp, symbol, optionsChainData, currentVwap, isScreenshotMode]);

  // Setup and manage Lightweight Chart
  useEffect(() => {
    if (!chartContainerRef.current) return;

    const initialWidth = chartContainerRef.current.clientWidth || 800;
    const initialHeight = chartContainerRef.current.clientHeight || 500;

    // Create chart instance
    const chart = createChart(chartContainerRef.current, {
      width: initialWidth,
      height: initialHeight,
      layout: {
        background: { color: '#0b0e14' },
        textColor: '#9ca3af',
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
        vertLines: { color: 'rgba(255, 255, 255, 0.03)' },
        horzLines: { color: 'rgba(255, 255, 255, 0.03)' }
      },
      crosshair: {
        mode: 1, // CrosshairMode.Normal
        vertLine: {
          color: 'rgba(168, 85, 247, 0.75)',
          width: 1,
          style: 3, // LineStyle.Dashed
          labelBackgroundColor: '#6b21a8'
        },
        horzLine: {
          color: 'rgba(168, 85, 247, 0.75)',
          width: 1,
          style: 3, // LineStyle.Dashed
          labelBackgroundColor: '#6b21a8'
        }
      },
      rightPriceScale: {
        borderColor: 'rgba(255, 255, 255, 0.12)',
        visible: true,
        autoScale: true,
        scaleMargins: { top: 0.06, bottom: 0.06 }
      },
      timeScale: {
        borderColor: 'rgba(255, 255, 255, 0.12)',
        timeVisible: true,
        secondsVisible: false,
        rightOffset: 12 // Provides space on right for step ladder
      }
    });

    chartRef.current = chart;

    // Add Candlestick Series
    const candleSeries = chart.addCandlestickSeries({
      upColor: '#26a69a',
      downColor: '#ef5350',
      borderVisible: false,
      wickUpColor: '#26a69a',
      wickDownColor: '#ef5350',
      autoscaleInfoProvider: getAutoscaleProvider(yZoomRef.current)
    });
    candlestickSeriesRef.current = candleSeries;

    // Add VWAP Line Series
    const vwapSeries = chart.addLineSeries({
      color: '#6366f1',
      lineWidth: 2,
      lineStyle: 2, // LineStyle.Dashed
      priceLineVisible: false,
      lastValueVisible: false
    });
    vwapSeriesRef.current = vwapSeries;

    // Track crosshair move for legend
    chart.subscribeCrosshairMove(param => {
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
          time: param.time as any,
          volume: 0
        });
      } else {
        setHoveredCandle(null);
      }
    });

    // Update ladder step overlay on range change
    const updateLadderOverlay = () => {
      if (!chartRef.current || !candlestickSeriesRef.current || !chartContainerRef.current) return;
      try {
        const width = chartContainerRef.current.clientWidth;
        const height = chartContainerRef.current.clientHeight;
        if (width <= 0 || height <= 0) return;

        const curCandles = candles;
        if (curCandles.length === 0) return;

        const lastC = curCandles[curCandles.length - 1];
        const lastXCoord = chartRef.current.timeScale().timeToCoordinate(((lastC.time + IST_OFFSET_SECONDS) as Time));
        const startX = lastXCoord !== null ? Math.max(10, lastXCoord + 12) : width - 180;
        const rightX = width - 68;

        const curLines: any[] = [];
        for (const lvl of computedLevels) {
          if (!showMatrixLevels && lvl.category === 'matrix') continue;
          if (!showOptionWalls && lvl.category === 'option') continue;
          if (!showVwap && lvl.category === 'vwap') continue;

          const y = candlestickSeriesRef.current.priceToCoordinate(lvl.price);
          if (y !== null && y >= -15 && y <= height + 15) {
            curLines.push({
              ...lvl,
              y: Math.round(y)
            });
          }
        }

        setLadderLines(prev => {
          if (prev.startX === startX && prev.rightX === rightX && prev.lines.length === curLines.length) {
            let identical = true;
            for (let i = 0; i < curLines.length; i++) {
              if (prev.lines[i]?.y !== curLines[i]?.y || prev.lines[i]?.key !== curLines[i]?.key) {
                identical = false;
                break;
              }
            }
            if (identical) return prev;
          }
          return { startX, rightX, lines: curLines };
        });
      } catch (e) {}
    };
    updateLadderOverlayRef.current = updateLadderOverlay;

    chart.timeScale().subscribeVisibleLogicalRangeChange(() => {
      requestAnimationFrame(updateLadderOverlay);
    });

    const lastTestingDimensionsRef = { width: 0, height: 0 };
    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        const w = Math.floor(chartContainerRef.current.clientWidth);
        const h = Math.floor(chartContainerRef.current.clientHeight);
        if (w > 0 && h > 0) {
          if (w === lastTestingDimensionsRef.width && h === lastTestingDimensionsRef.height) {
            return;
          }
          lastTestingDimensionsRef.width = w;
          lastTestingDimensionsRef.height = h;
          chartRef.current.applyOptions({ width: w, height: h });
          requestAnimationFrame(updateLadderOverlay);
        }
      }
    };

    window.addEventListener('resize', handleResize);
    handleResize();

    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined' && chartContainerRef.current) {
      resizeObserver = new ResizeObserver(() => {
        handleResize();
      });
      if (chartContainerRef.current.parentElement) {
        resizeObserver.observe(chartContainerRef.current.parentElement);
      }
    }

    const containerEl = chartContainerRef.current;
    const handleContainerWheel = (e: WheelEvent) => {
      if (!chartContainerRef.current) return;
      const rect = chartContainerRef.current.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      if (mouseX >= rect.width - 70) {
        e.preventDefault();
        e.stopPropagation();
        if (e.deltaY < 0) {
          handleYZoomRef.current(-1);
        } else {
          handleYZoomRef.current(1);
        }
      } else {
        requestAnimationFrame(updateLadderOverlay);
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

    if (containerEl) {
      containerEl.addEventListener('wheel', handleContainerWheel, { passive: false });
      containerEl.addEventListener('dblclick', handleContainerDblClick);
    }

    return () => {
      window.removeEventListener('resize', handleResize);
      if (resizeObserver) resizeObserver.disconnect();
      if (containerEl) {
        containerEl.removeEventListener('wheel', handleContainerWheel);
        containerEl.removeEventListener('dblclick', handleContainerDblClick);
      }
      chart.remove();
      chartRef.current = null;
    };
  }, []);

  // Update chart data whenever candles or indicators change
  useEffect(() => {
    if (!candlestickSeriesRef.current || candles.length === 0) return;

    // Format candles for TradingView with IST shift
    const formatted = candles.map(c => ({
      time: ((c.time + IST_OFFSET_SECONDS) as Time),
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close
    }));

    candlestickSeriesRef.current.setData(formatted);
    chartRef.current?.timeScale().fitContent();

    // Set drop bar circular highlight marker (matching screenshot)
    if (isScreenshotMode) {
      candlestickSeriesRef.current.setMarkers([
        {
          time: ((BASE_T + 5400 + IST_OFFSET_SECONDS) as Time),
          position: 'inBar',
          color: '#38bdf8',
          shape: 'circle',
          text: ''
        }
      ]);
    } else {
      candlestickSeriesRef.current.setMarkers([]);
    }

    // Update VWAP series
    if (vwapSeriesRef.current) {
      if (showVwap && vwapData.length > 0) {
        vwapSeriesRef.current.setData(vwapData);
      } else {
        vwapSeriesRef.current.setData([]);
      }
    }

    // Clear old price lines
    priceLinesRef.current.forEach(pl => {
      try {
        candlestickSeriesRef.current?.removePriceLine(pl);
      } catch (e) {}
    });
    priceLinesRef.current = [];

    // Create crisp price lines and badges matching the screenshot
    computedLevels.forEach(lvl => {
      if (!showMatrixLevels && lvl.category === 'matrix') return;
      if (!showOptionWalls && lvl.category === 'option') return;
      if (!showVwap && lvl.category === 'vwap') return;

      const style = lvl.lineStyle === 'solid' ? 0 : (lvl.lineStyle === 'dashed' ? 2 : 1);
      const pl = candlestickSeriesRef.current?.createPriceLine({
        price: lvl.price,
        color: lvl.color,
        lineWidth: lvl.lineWidth as any,
        lineStyle: style as any,
        axisLabelVisible: true,
        title: lvl.title
      });

      if (pl) priceLinesRef.current.push(pl);
    });

    // Fit content cleanly
    if (chartRef.current && isScreenshotMode) {
      chartRef.current.timeScale().fitContent();
    }

    // Update Step Ladder Overlay
    if (chartRef.current && chartContainerRef.current) {
      try {
        const width = chartContainerRef.current.clientWidth;
        const height = chartContainerRef.current.clientHeight;
        const lastC = candles[candles.length - 1];
        const lastXCoord = chartRef.current.timeScale().timeToCoordinate(((lastC.time + IST_OFFSET_SECONDS) as Time));
        const startX = lastXCoord !== null ? Math.max(10, lastXCoord + 12) : width - 180;
        const rightX = width - 68;

        const curLines: any[] = [];
        for (const lvl of computedLevels) {
          if (!showMatrixLevels && lvl.category === 'matrix') continue;
          if (!showOptionWalls && lvl.category === 'option') continue;
          if (!showVwap && lvl.category === 'vwap') continue;

          const y = candlestickSeriesRef.current.priceToCoordinate(lvl.price);
          if (y !== null && y >= -15 && y <= height + 15) {
            curLines.push({
              ...lvl,
              y: Math.round(y)
            });
          }
        }

        setLadderLines(prev => {
          if (prev.startX === startX && prev.rightX === rightX && prev.lines.length === curLines.length) {
            let identical = true;
            for (let i = 0; i < curLines.length; i++) {
              if (prev.lines[i]?.y !== curLines[i]?.y || prev.lines[i]?.key !== curLines[i]?.key) {
                identical = false;
                break;
              }
            }
            if (identical) return prev;
          }
          return { startX, rightX, lines: curLines };
        });
      } catch (e) {}
    }
  }, [candles, computedLevels, showMatrixLevels, showOptionWalls, showVwap, isScreenshotMode]);

  const activeCandle = hoveredCandle || (candles.length > 0 ? candles[candles.length - 1] : null);

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      width: '100%',
      backgroundColor: '#07090e',
      color: '#e2e8f0',
      fontFamily: "'Outfit', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* HEADER / TOOLBAR */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '8px 16px',
        backgroundColor: '#0d111a',
        borderBottom: '1px solid #1e2638',
        gap: '8px',
        zIndex: 20
      }}>
        {/* Left: Mode Toggle, Symbol, Timeframe & Status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '18px' }}>🧪</span>
            <span style={{ fontSize: '14px', fontWeight: '800', letterSpacing: '-0.3px', color: '#f8fafc' }}>TESTING</span>
          </div>

          <div style={{ height: '18px', width: '1px', backgroundColor: '#2a354f' }} />

          {/* Screenshot vs Live Mode Toggle */}
          <button
            onClick={() => setIsScreenshotMode(!isScreenshotMode)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: isScreenshotMode ? '#8b5cf6' : '#0284c7',
              color: '#ffffff',
              border: 'none',
              borderRadius: '6px',
              padding: '4px 10px',
              fontSize: '11px',
              fontWeight: '800',
              cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
              transition: 'all 0.2s ease'
            }}
          >
            {isScreenshotMode ? <Camera size={13} /> : <Radio size={13} />}
            <span>{isScreenshotMode ? '📸 SCREENSHOT COPY' : '🔴 LIVE MARKET'}</span>
          </button>

          {/* Symbol Select */}
          <select
            value={symbol}
            disabled={isScreenshotMode}
            onChange={(e) => {
              setSymbol(e.target.value);
              onSymbolSelect?.(e.target.value);
            }}
            style={{
              backgroundColor: '#161d2e',
              color: isScreenshotMode ? '#94a3b8' : '#38bdf8',
              border: '1px solid #2a354f',
              borderRadius: '6px',
              padding: '4px 8px',
              fontSize: '12px',
              fontWeight: '700',
              cursor: isScreenshotMode ? 'not-allowed' : 'pointer',
              outline: 'none'
            }}
          >
            <option value="NSE:NIFTY">NIFTY 50 (Index)</option>
            <option value="NSE:BANKNIFTY">BANK NIFTY (Index)</option>
            <option value="NSE:FINNIFTY">FIN NIFTY (Index)</option>
            <option value="NSE:RELIANCE">RELIANCE</option>
            <option value="NSE:HDFCBANK">HDFCBANK</option>
            <option value="NSE:TCS">TCS</option>
            <option value="MCX:CRUDEOIL1!">CRUDE OIL (MCX)</option>
          </select>

          {/* Timeframe Buttons */}
          <div style={{ display: 'flex', backgroundColor: '#131926', borderRadius: '6px', padding: '2px', border: '1px solid #1e2638' }}>
            {(['1', '3', '5', '15', '30', '60', 'D'] as const).map(tFrame => (
              <button
                key={tFrame}
                onClick={() => {
                  setTimeframe(tFrame);
                  onTimeframeChange?.(tFrame);
                }}
                style={{
                  background: timeframe === tFrame ? '#0284c7' : 'transparent',
                  color: timeframe === tFrame ? '#ffffff' : '#94a3b8',
                  border: 'none',
                  borderRadius: '4px',
                  padding: '3px 8px',
                  fontSize: '11px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                {tFrame === 'D' ? '1D' : (tFrame === '60' ? '1H' : `${tFrame}m`)}
              </button>
            ))}
          </div>

          {/* Status Pill */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
            backgroundColor: isScreenshotMode ? 'rgba(139, 92, 246, 0.15)' : 'rgba(16, 185, 129, 0.12)',
            border: `1px solid ${isScreenshotMode ? 'rgba(139, 92, 246, 0.35)' : 'rgba(16, 185, 129, 0.3)'}`,
            padding: '3px 8px',
            borderRadius: '12px',
            fontSize: '11px',
            fontWeight: '700',
            color: isScreenshotMode ? '#c084fc' : '#10b981'
          }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: isScreenshotMode ? '#c084fc' : '#10b981', display: 'inline-block' }} />
            <span>{isScreenshotMode ? 'EXACT MATCH' : 'LIVE 0ms'}</span>
          </div>
        </div>

        {/* Center: Key Metric Badges */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {liveLtp !== null && (
            <div style={{ padding: '3px 8px', backgroundColor: '#161d2e', border: '1px solid #232c42', borderRadius: '6px', fontSize: '11px' }}>
              <span style={{ color: '#94a3b8' }}>LTP: </span>
              <span style={{ color: '#22c55e', fontWeight: '800' }}>{liveLtp.toFixed(2)}</span>
            </div>
          )}

          {currentVwap !== null && (
            <div style={{ padding: '3px 8px', backgroundColor: 'rgba(99, 102, 241, 0.15)', border: '1px solid rgba(99, 102, 241, 0.35)', borderRadius: '6px', fontSize: '11px' }}>
              <span style={{ color: '#a5b4fc' }}>VWAP: </span>
              <span style={{ color: '#818cf8', fontWeight: '800' }}>{currentVwap.toFixed(2)}</span>
            </div>
          )}

          <div style={{ padding: '3px 8px', backgroundColor: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.35)', borderRadius: '6px', fontSize: '11px' }}>
            <span style={{ color: '#fca5a5' }}>CW: </span>
            <span style={{ color: '#ef4444', fontWeight: '800' }}>
              {computedLevels.find(l => l.key === 'CW')?.price || '22700.00'}
            </span>
          </div>

          <div style={{ padding: '3px 8px', backgroundColor: 'rgba(34, 197, 94, 0.15)', border: '1px solid rgba(34, 197, 94, 0.35)', borderRadius: '6px', fontSize: '11px' }}>
            <span style={{ color: '#86efac' }}>PW: </span>
            <span style={{ color: '#22c55e', fontWeight: '800' }}>
              {computedLevels.find(l => l.key === 'PW')?.price || '22300.00'}
            </span>
          </div>

          <div style={{ padding: '3px 8px', backgroundColor: 'rgba(217, 70, 239, 0.15)', border: '1px solid rgba(217, 70, 239, 0.35)', borderRadius: '6px', fontSize: '11px' }}>
            <span style={{ color: '#f0abfc' }}>MP/PZ: </span>
            <span style={{ color: '#d946ef', fontWeight: '800' }}>
              {computedLevels.find(l => l.key === 'MP')?.price || '22500.00'}
            </span>
          </div>
        </div>

        {/* Right: Feature Toggles & Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <button
            onClick={() => setShowMatrixLevels(!showMatrixLevels)}
            title="Toggle Matrix Levels (L1 - L9)"
            style={{
              background: showMatrixLevels ? 'rgba(245, 158, 11, 0.2)' : '#161d2e',
              border: `1px solid ${showMatrixLevels ? '#f59e0b' : '#2a354f'}`,
              color: showMatrixLevels ? '#fbbf24' : '#64748b',
              padding: '4px 8px',
              borderRadius: '6px',
              fontSize: '11px',
              fontWeight: '700',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            <Layers size={13} />
            <span>L1-L9</span>
          </button>

          <button
            onClick={() => setShowOptionWalls(!showOptionWalls)}
            title="Toggle Option Walls (CW, PW, MP, PZ)"
            style={{
              background: showOptionWalls ? 'rgba(168, 85, 247, 0.2)' : '#161d2e',
              border: `1px solid ${showOptionWalls ? '#a855f7' : '#2a354f'}`,
              color: showOptionWalls ? '#c084fc' : '#64748b',
              padding: '4px 8px',
              borderRadius: '6px',
              fontSize: '11px',
              fontWeight: '700',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            <ShieldCheck size={13} />
            <span>Walls</span>
          </button>

          <button
            onClick={() => setShowVwap(!showVwap)}
            title="Toggle VWAP Indicator"
            style={{
              background: showVwap ? 'rgba(99, 102, 241, 0.2)' : '#161d2e',
              border: `1px solid ${showVwap ? '#6366f1' : '#2a354f'}`,
              color: showVwap ? '#a5b4fc' : '#64748b',
              padding: '4px 8px',
              borderRadius: '6px',
              fontSize: '11px',
              fontWeight: '700',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            <Activity size={13} />
            <span>VWAP</span>
          </button>

          <button
            onClick={() => setShowStepLadder(!showStepLadder)}
            title="Toggle Step Ladder Segment Overlay"
            style={{
              background: showStepLadder ? 'rgba(6, 182, 212, 0.2)' : '#161d2e',
              border: `1px solid ${showStepLadder ? '#06b6d4' : '#2a354f'}`,
              color: showStepLadder ? '#67e8f9' : '#64748b',
              padding: '4px 8px',
              borderRadius: '6px',
              fontSize: '11px',
              fontWeight: '700',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            <BarChart2 size={13} />
            <span>Ladder</span>
          </button>

          {/* Y-Axis Zoom In / Out Controls */}
          <div style={{ display: 'inline-flex', alignItems: 'center', backgroundColor: '#131926', borderRadius: '6px', padding: '2px 4px', border: '1px solid #1e2638', gap: '3px' }}>
            <span style={{ fontSize: '10px', fontWeight: '700', color: '#94a3b8', padding: '0 3px' }}>↕ Y-Axis:</span>
            <button
              onClick={() => handleYZoom(1)}
              title="Zoom Out Y-Axis (Compress candles / increase price span)"
              style={{
                background: '#1e2638',
                color: '#e2e8f0',
                border: 'none',
                borderRadius: '4px',
                padding: '3px 7px',
                fontSize: '11px',
                fontWeight: '700',
                cursor: 'pointer',
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
                background: '#1e2638',
                color: '#e2e8f0',
                border: 'none',
                borderRadius: '4px',
                padding: '3px 7px',
                fontSize: '11px',
                fontWeight: '700',
                cursor: 'pointer',
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
                background: 'transparent',
                color: '#38bdf8',
                border: 'none',
                borderRadius: '4px',
                padding: '3px 6px',
                fontSize: '10px',
                fontWeight: '700',
                cursor: 'pointer'
              }}
            >
              🎯 Auto
            </button>
          </div>

          <button
            onClick={fetchCandlesData}
            title="Refresh Chart"
            style={{
              background: '#161d2e',
              border: '1px solid #2a354f',
              color: '#94a3b8',
              padding: '4px 8px',
              borderRadius: '6px',
              cursor: 'pointer'
            }}
          >
            <RefreshCw size={13} />
          </button>
        </div>
      </div>

      {/* INTERACTIVE OHLC LEGEND (TOP-LEFT OF CHART) */}
      <div style={{
        position: 'absolute',
        top: '52px',
        left: '16px',
        zIndex: 10,
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        fontSize: '12px',
        fontWeight: '700',
        color: '#94a3b8',
        backgroundColor: 'rgba(11, 14, 20, 0.85)',
        padding: '4px 10px',
        borderRadius: '6px',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        backdropFilter: 'blur(4px)',
        pointerEvents: 'none'
      }}>
        <span style={{ color: '#f8fafc', fontWeight: '800' }}>{symbol.replace('NSE:', '').replace('MCX:', '')}</span>
        {activeCandle && (
          <>
            <span>O: <strong style={{ color: activeCandle.close >= activeCandle.open ? '#26a69a' : '#ef5350' }}>{activeCandle.open.toFixed(2)}</strong></span>
            <span>H: <strong style={{ color: activeCandle.close >= activeCandle.open ? '#26a69a' : '#ef5350' }}>{activeCandle.high.toFixed(2)}</strong></span>
            <span>L: <strong style={{ color: activeCandle.close >= activeCandle.open ? '#26a69a' : '#ef5350' }}>{activeCandle.low.toFixed(2)}</strong></span>
            <span>C: <strong style={{ color: activeCandle.close >= activeCandle.open ? '#26a69a' : '#ef5350' }}>{activeCandle.close.toFixed(2)}</strong></span>
          </>
        )}
      </div>

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
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%'
          }}
        />

        {/* Floating Y-Axis Zoom & Scale Handle on Price Scale */}
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

        {/* STEP LADDER & BOUNDARY LINES OVERLAY (SVG LAYER) */}
        {showStepLadder && ladderLines.lines.length > 0 && (
          <svg
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              pointerEvents: 'none',
              zIndex: 5
            }}
          >
            {/* Major dotted boundary lines extending across the entire chart as in screenshot */}
            {showMajorBoundaries && (
              <>
                {/* Red Dotted Boundary near L4/CW/L3 */}
                {(() => {
                  const cwLvl = ladderLines.lines.find(l => l.key === 'CW' || l.key === 'L3');
                  if (!cwLvl) return null;
                  return (
                    <line
                      x1={0}
                      y1={cwLvl.y}
                      x2={ladderLines.rightX}
                      y2={cwLvl.y}
                      stroke="#ef4444"
                      strokeWidth={1.2}
                      strokeDasharray="4,4"
                      opacity={0.8}
                    />
                  );
                })()}

                {/* Purple Dotted Boundary at PZ / Equilibrium */}
                {(() => {
                  const pzLvl = ladderLines.lines.find(l => l.key === 'PZ' || l.key === 'MP');
                  if (!pzLvl) return null;
                  return (
                    <line
                      x1={0}
                      y1={pzLvl.y}
                      x2={ladderLines.rightX}
                      y2={pzLvl.y}
                      stroke="#8b5cf6"
                      strokeWidth={1.2}
                      strokeDasharray="4,4"
                      opacity={0.8}
                    />
                  );
                })()}

                {/* Green Dotted Boundary near PW / L7 */}
                {(() => {
                  const pwLvl = ladderLines.lines.find(l => l.key === 'PW' || l.key === 'L7');
                  if (!pwLvl) return null;
                  return (
                    <line
                      x1={0}
                      y1={pwLvl.y}
                      x2={ladderLines.rightX}
                      y2={pwLvl.y}
                      stroke="#22c55e"
                      strokeWidth={1.2}
                      strokeDasharray="4,4"
                      opacity={0.8}
                    />
                  );
                })()}

                {/* Lower Green Dotted Boundary at L9 */}
                {(() => {
                  const l9Lvl = ladderLines.lines.find(l => l.key === 'L9');
                  if (!l9Lvl) return null;
                  return (
                    <line
                      x1={0}
                      y1={l9Lvl.y}
                      x2={ladderLines.rightX}
                      y2={l9Lvl.y}
                      stroke="#10b981"
                      strokeWidth={1}
                      strokeDasharray="3,3"
                      opacity={0.65}
                    />
                  );
                })()}
              </>
            )}

            {/* Individual Ladder Horizontal Step Segments on the right side */}
            {ladderLines.lines.map((lvl) => (
              <g key={lvl.key}>
                <line
                  x1={ladderLines.startX}
                  y1={lvl.y}
                  x2={ladderLines.rightX}
                  y2={lvl.y}
                  stroke={lvl.color}
                  strokeWidth={lvl.lineWidth}
                  opacity={0.9}
                />
              </g>
            ))}
          </svg>
        )}

        {/* BOTTOM-LEFT TRADINGVIEW WATERMARK (TV LOGO) */}
        <div style={{
          position: 'absolute',
          bottom: '24px',
          left: '14px',
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          pointerEvents: 'none',
          userSelect: 'none',
          zIndex: 6,
          opacity: 0.85
        }}>
          <svg width="28" height="20" viewBox="0 0 36 28" fill="none">
            <path d="M14 22H7V6H14V22Z" fill="#ffffff" />
            <path d="M28 22H21V12H28V22Z" fill="#ffffff" />
            <circle cx="17.5" cy="14" r="3" fill="#38bdf8" />
          </svg>
        </div>
      </div>
    </div>
  );
}
