import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { getBackendHttpUrl, tvStreamer } from '../utils/tvStreamer';
import { groupCandlesByDay, calculateDayProfile, Candle, DayProfile, TPOBin } from '../utils/profileCalculator';
import { resolveSymbol } from '../utils/symbolResolver';
import { filterMarketHoursCandles, isWithinMarketHours } from '../utils/marketHours';
import { RefreshCw, ZoomIn, ZoomOut, Sliders, ChevronLeft, ChevronRight, Maximize2, Minimize2, ShieldAlert } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

interface TrialContainerProps {
  selectedSymbol?: string;
  onSymbolSelect?: (symbol: string) => void;
  onSwitchToChart?: () => void;
  initialTimeframe?: string;
  initialLookbackDays?: number;
  singleDayOnly?: boolean;
}

export interface TrialBinData {
  price: number;
  tpos: string[];
  volume: number;
  delta: number;
  buyVolume: number;
  sellVolume: number;
}

export interface TrialProfileData {
  bins: TrialBinData[];
  maxVol: number;
  maxAbsDelta: number;
  volPocPrice: number;
}

export interface TrialDayProfile extends DayProfile {
  candles: Candle[];
}

function formatDateShort(dateStr: string): string {
  const parts = dateStr.split('-');
  if (parts.length < 3) return dateStr;
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const mIdx = parseInt(parts[1], 10) - 1;
  const dStr = parseInt(parts[2], 10).toString();
  if (mIdx >= 0 && mIdx < 12) {
    return `${monthNames[mIdx]} ${dStr}`;
  }
  return dateStr;
}

function computeTrialBins(profile: DayProfile, dayCandles: Candle[], tpoSize: number): TrialProfileData {
  const bins = profile.bins || [];
  if (bins.length === 0) {
    return {
      bins: [],
      maxVol: 1,
      maxAbsDelta: 1,
      volPocPrice: profile.pocPrice || 0
    };
  }

  const trialBins: TrialBinData[] = bins.map(b => ({
    price: b.price,
    tpos: b.tpos || [],
    volume: b.volume || 0,
    delta: 0,
    buyVolume: 0,
    sellVolume: 0
  }));

  const candles = dayCandles || [];
  const halfStep = Math.max(0.01, tpoSize / 2);

  for (const c of candles) {
    const range = c.high - c.low;
    let buyRatio = 0.5;
    if (range > 0) {
      if (c.close >= c.open) {
        buyRatio = 0.5 + 0.5 * Math.min(1, Math.max(0, (c.close - c.open) / range));
      } else {
        buyRatio = 0.5 - 0.5 * Math.min(1, Math.max(0, (c.open - c.close) / range));
      }
    } else {
      buyRatio = c.close >= c.open ? 0.6 : 0.4;
    }

    const candleVol = c.volume || 100;
    const cBuy = candleVol * buyRatio;
    const cSell = candleVol * (1 - buyRatio);
    const cDelta = cBuy - cSell;

    const touchedIndices: number[] = [];
    for (let i = 0; i < trialBins.length; i++) {
      const bPrice = trialBins[i].price;
      if (bPrice + halfStep >= c.low && bPrice - halfStep <= c.high) {
        touchedIndices.push(i);
      }
    }

    if (touchedIndices.length > 0) {
      const share = 1 / touchedIndices.length;
      for (const idx of touchedIndices) {
        trialBins[idx].buyVolume += cBuy * share;
        trialBins[idx].sellVolume += cSell * share;
        trialBins[idx].delta += cDelta * share;
        if (trialBins[idx].volume <= 0) {
          trialBins[idx].volume += candleVol * share;
        }
      }
    }
  }

  let maxVol = 1;
  let maxAbsDelta = 1;
  let volPocPrice = profile.pocPrice || (bins[0] ? bins[0].price : 0);
  let highestVol = -1;

  for (const b of trialBins) {
    if (b.volume > maxVol) maxVol = b.volume;
    const absD = Math.abs(b.delta);
    if (absD > maxAbsDelta) maxAbsDelta = absD;
    if (b.volume > highestVol) {
      highestVol = b.volume;
      volPocPrice = b.price;
    }
  }

  return {
    bins: trialBins,
    maxVol,
    maxAbsDelta,
    volPocPrice
  };
}

export const TrialContainer: React.FC<TrialContainerProps> = ({
  selectedSymbol,
  onSymbolSelect,
  onSwitchToChart,
  initialTimeframe = '30',
  initialLookbackDays,
  singleDayOnly = false
}) => {
  const { isDark } = useTheme();
  const [symbol, setSymbol] = useState<string>(() => {
    try {
      const p = new URLSearchParams(window.location.search);
      const s = p.get('symbol');
      if (s) return s;
    } catch (e) {}
    return selectedSymbol || 'NSE:NIFTY1!';
  });

  const [timeframe, setTimeframe] = useState<string>(() => {
    try {
      const p = new URLSearchParams(window.location.search);
      const tf = p.get('timeframe');
      if (tf) return tf;
    } catch (e) {}
    return initialTimeframe || '30';
  });

  const [lookbackDays, setLookbackDays] = useState<number>(() => {
    if (singleDayOnly) return 1;
    return initialLookbackDays || 5;
  });
  const [theme, setTheme] = useState<'dark-slate' | 'dark'>('dark-slate');
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const isStandalone = useMemo(() => {
    try {
      const p = new URLSearchParams(window.location.search);
      return p.get('standalone') === 'true';
    } catch (e) {
      return false;
    }
  }, []);

  // Interactive Scaling State
  const [zoomLevel, setZoomLevel] = useState<number>(1.0);
  const [yScale, setYScale] = useState<number>(1.0);
  const [xScale, setXScale] = useState<number>(1.0);
  const [isMobile, setIsMobile] = useState<boolean>(() => typeof window !== 'undefined' && window.innerWidth <= 768);
  const [showMobileProfileTools, setShowMobileProfileTools] = useState<boolean>(false);

  const prevScaleRef = useRef<{ yScale: number; xScale: number; zoomLevel: number }>({ yScale: 1.0, xScale: 1.0, zoomLevel: 1.0 });

  const toggleFullscreen = useCallback(() => {
    setIsExpanded((prev) => {
      const next = !prev;
      if (next) {
        prevScaleRef.current = { yScale, xScale, zoomLevel };
        setYScale(prevY => Math.max(1.85, prevY * 1.6));
        setXScale(prevX => Math.max(1.35, prevX * 1.3));
        setZoomLevel(prevZ => Math.max(1.2, prevZ * 1.2));
        if (containerRef.current && containerRef.current.requestFullscreen) {
          containerRef.current.requestFullscreen().catch(() => {});
        }
      } else {
        if (prevScaleRef.current) {
          setYScale(prevScaleRef.current.yScale);
          setXScale(prevScaleRef.current.xScale);
          setZoomLevel(prevScaleRef.current.zoomLevel);
        }
        if (document.fullscreenElement && document.exitFullscreen) {
          document.exitFullscreen().catch(() => {});
        }
      }
      return next;
    });
  }, [yScale, xScale, zoomLevel]);

  const activeSymbolInfo = useMemo(() => resolveSymbol(symbol), [symbol]);
  const [candles, setCandles] = useState<Candle[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [tpoSize, setTpoSize] = useState<number>(() => {
    const sym = (symbol || '').toUpperCase();
    if (sym.includes('BANKNIFTY')) return 20;
    if (sym.includes('NIFTY')) return 5;
    if (sym.includes('CRUDE')) return 5;
    return 10;
  });

  const [gridStep, setGridStep] = useState<number>(() => {
    const sym = (symbol || '').toUpperCase();
    if (sym.includes('BANKNIFTY')) return 50;
    if (sym.includes('NIFTY')) return 20;
    if (sym.includes('CRUDE')) return 20;
    return 20;
  });

  // Adjust defaults when symbol changes
  useEffect(() => {
    const sym = (symbol || '').toUpperCase();
    if (sym.includes('BANKNIFTY')) {
      setTpoSize(20);
      setGridStep(50);
    } else if (sym.includes('NIFTY')) {
      setTpoSize(5);
      setGridStep(20);
    } else if (sym.includes('SENSEX')) {
      setTpoSize(25);
      setGridStep(50);
    } else {
      setTpoSize(5);
      setGridStep(20);
    }
  }, [symbol]);

  const [panOffset, setPanOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [dragMode, setDragMode] = useState<'none' | 'pan' | 'y-axis' | 'x-axis'>('none');
  const [dragStartPos, setDragStartPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [initialPanOffset, setInitialPanOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [initialYScale, setInitialYScale] = useState<number>(1.0);
  const [initialXScale, setInitialXScale] = useState<number>(1.0);
  const [cursorStyle, setCursorStyle] = useState<string>('crosshair');

  // Interactive Crosshair State
  const [crosshairPos, setCrosshairPos] = useState<{
    x: number;
    y: number;
    price: number;
    dateStr?: string;
  } | null>(null);

  const [streamStatus, setStreamStatus] = useState<'LIVE' | 'DISCONNECTED'>('LIVE');
  const liveLtpRef = useRef<number | null>(null);
  const lastTickTimeRef = useRef<number | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 640 });

  // Sync selected symbol
  useEffect(() => {
    if (selectedSymbol && selectedSymbol !== symbol) {
      setSymbol(selectedSymbol);
    }
  }, [selectedSymbol]);

  // Fetch candles
  const fetchCandles = useCallback(async (sym: string, tf: string, days: number = 5) => {
    setLoading(true);
    setError(null);
    try {
      const backendUrl = await getBackendHttpUrl();
      if (!backendUrl) throw new Error('No backend connection available');

      const resolved = resolveSymbol(sym);
      const isFutures = resolved.type === 'futures' || sym.endsWith('1!');

      let effectiveTf = tf;
      if (isFutures && (tf === 'D' || tf === '1D')) {
        effectiveTf = '30';
      }

      const reqLimit = Math.max(500, days * 90);
      const res = await fetch(`${backendUrl}/api/candles?symbol=${encodeURIComponent(sym)}&timeframe=${effectiveTf}&limit=${reqLimit}`, {
        headers: { 'bypass-tunnel-reminder': 'true' }
      });

      if (!res.ok) throw new Error(`API error: ${res.statusText}`);
      const data = await res.json();

      let candleList = Array.isArray(data) ? data : data.candles || [];
      if (candleList && candleList.length > 0) {
        candleList = filterMarketHoursCandles(candleList, sym, effectiveTf);
        setCandles(candleList);
        setStreamStatus('LIVE');
      } else {
        setError(`No candle data received for ${sym}`);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch candle data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCandles(symbol, timeframe, lookbackDays);
  }, [symbol, timeframe, lookbackDays, fetchCandles]);

  // Real-Time Tick-by-Tick Synchronization
  useEffect(() => {
    let isMounted = true;

    // 1. Initial cached quote check
    const cached = tvStreamer.getLatestLtp(symbol);
    if (cached) {
      liveLtpRef.current = cached.ltp;
      lastTickTimeRef.current = cached.timestamp;
      setStreamStatus('LIVE');
    }

    // 2. Subscribe to centralized stream
    const unsubscribeStream = tvStreamer.subscribe(
      symbol,
      timeframe,
      (payload) => {
        if (!isMounted) return;
        if (payload.candles && payload.candles.length > 0) {
          const lastCandle = payload.candles[payload.candles.length - 1];
          if (lastCandle && typeof lastCandle.close === 'number') {
            const now = Date.now();
            liveLtpRef.current = lastCandle.close;
            lastTickTimeRef.current = now;
            setStreamStatus('LIVE');
          }

          if (payload.isSnapshot) {
            setCandles(filterMarketHoursCandles(payload.candles, symbol, timeframe));
          } else {
            setCandles(prev => {
              if (!prev || prev.length === 0) return filterMarketHoursCandles(payload.candles, symbol, timeframe);
              const next = [...prev];
              for (const c of payload.candles) {
                if (!isWithinMarketHours(c.time, symbol, timeframe)) continue;
                const idx = next.length - 1;
                if (next[idx].time === c.time) {
                  next[idx] = {
                    ...next[idx],
                    high: Math.max(next[idx].high, c.high),
                    low: Math.min(next[idx].low, c.low),
                    close: c.close,
                    volume: (next[idx].volume || 0) + (c.volume || 0)
                  };
                } else if (c.time > next[idx].time) {
                  next.push(c);
                }
              }
              return next;
            });
          }
        }
      }
    );

    // 3. Centralized tick listener
    const unsubscribeTicks = tvStreamer.addTickListener((tick) => {
      if (!isMounted) return;
      const cleanTarget = symbol.replace(/^(NSE:|BSE:|MCX:|NFO:)/, '').trim().toUpperCase();
      const cleanTick = tick.symbol.replace(/^(NSE:|BSE:|MCX:|NFO:)/, '').trim().toUpperCase();
      if (cleanTarget === cleanTick) {
        liveLtpRef.current = tick.ltp;
        lastTickTimeRef.current = tick.timestamp;
        setStreamStatus('LIVE');

        if (!isWithinMarketHours(Math.floor(Date.now() / 1000), symbol, timeframe)) {
          return;
        }

        setCandles(prev => {
          if (!prev || prev.length === 0) return prev;
          const last = prev[prev.length - 1];
          if (last.close === tick.ltp && tick.ltp <= last.high && tick.ltp >= last.low) return prev;
          const next = [...prev];
          next[next.length - 1] = {
            ...last,
            close: tick.ltp,
            high: Math.max(last.high, tick.ltp),
            low: Math.min(last.low, tick.ltp)
          };
          return next;
        });
      }
    });

    // 4. Live connection state listener
    const unsubscribeStatus = tvStreamer.addStatusListener((status) => {
      if (!isMounted) return;
      if (status === 'disconnected') {
        setStreamStatus('DISCONNECTED');
      } else {
        setStreamStatus('LIVE');
      }
    });

    return () => {
      isMounted = false;
      unsubscribeStream();
      unsubscribeTicks();
      unsubscribeStatus();
    };
  }, [symbol, timeframe]);

  // Group candles into day profiles
  const dayProfiles: TrialDayProfile[] = useMemo(() => {
    if (!candles || candles.length === 0) return [];
    const grouped = groupCandlesByDay(candles, symbol);
    const dates = Object.keys(grouped).sort();
    const targetDates = singleDayOnly ? dates.slice(-1) : dates.slice(-lookbackDays);

    const profiles: TrialDayProfile[] = [];
    targetDates.forEach(dateStr => {
      const dayCandles = grouped[dateStr];
      if (dayCandles && dayCandles.length > 0) {
        const p = calculateDayProfile(dateStr, dayCandles, 50, 'daily', undefined, tpoSize, symbol);
        if (p && p.bins && p.bins.length > 0) {
          profiles.push({
            ...p,
            candles: dayCandles
          });
        }
      }
    });
    return profiles;
  }, [candles, lookbackDays, tpoSize, symbol, singleDayOnly]);

  // Compute trial bins (Volume + Delta + TPO) for all profiles
  const trialProfilesData = useMemo(() => {
    const map = new Map<string, TrialProfileData>();
    dayProfiles.forEach(p => {
      map.set(p.dateStr, computeTrialBins(p, p.candles || [], tpoSize));
    });
    return map;
  }, [dayProfiles, tpoSize]);

  // Global Price Extents across visible sessions
  const { minPrice, maxPrice } = useMemo(() => {
    if (dayProfiles.length === 0) return { minPrice: 0, maxPrice: 100 };
    let minP = Infinity;
    let maxP = -Infinity;

    dayProfiles.forEach(p => {
      if (typeof p.dayLow === 'number' && p.dayLow < minP) minP = p.dayLow;
      if (typeof p.dayHigh === 'number' && p.dayHigh > maxP) maxP = p.dayHigh;
    });

    if (minP === Infinity || maxP === -Infinity) return { minPrice: 0, maxPrice: 100 };
    const pad = Math.max(tpoSize * 2, (maxP - minP) * 0.05);
    return {
      minPrice: Math.floor(minP - pad),
      maxPrice: Math.ceil(maxP + pad)
    };
  }, [dayProfiles, tpoSize]);

  // Container resize listener with ResizeObserver for dynamic flex container fitting
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(typeof window !== 'undefined' && window.innerWidth <= 768);
      if (canvasContainerRef.current) {
        const clientH = canvasContainerRef.current.clientHeight;
        const clientW = canvasContainerRef.current.clientWidth;
        const targetH = isExpanded || isStandalone
          ? Math.max(650, window.innerHeight - 65)
          : Math.max(380, clientH);
        if (clientW > 0 && targetH > 0) {
          setDimensions({
            width: clientW,
            height: targetH
          });
        }
      }
    };

    window.addEventListener('resize', handleResize);
    handleResize();

    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined' && canvasContainerRef.current) {
      ro = new ResizeObserver(() => {
        handleResize();
      });
      ro.observe(canvasContainerRef.current);
    }

    const timer = setTimeout(handleResize, 150);
    return () => {
      window.removeEventListener('resize', handleResize);
      clearTimeout(timer);
      if (ro) ro.disconnect();
    };
  }, [isExpanded, isStandalone]);

  // Helper functions for coordinates
  const padding = { top: 40, bottom: 45, left: 15, right: 80 };
  const baseChartHeight = Math.max(100, dimensions.height - padding.top - padding.bottom);
  const baseChartWidth = Math.max(100, dimensions.width - padding.left - padding.right);

  const priceRange = Math.max(1, maxPrice - minPrice);

  const getPriceY = useCallback((price: number): number => {
    if (typeof price !== 'number' || isNaN(price)) return padding.top;
    const norm = (price - minPrice) / priceRange;
    const centerY = padding.top + baseChartHeight / 2;
    const unclampedY = padding.top + (1 - norm) * baseChartHeight;
    return centerY + (unclampedY - centerY) * yScale + panOffset.y;
  }, [minPrice, priceRange, baseChartHeight, padding.top, yScale, panOffset.y]);

  const getYPrice = useCallback((y: number): number => {
    const centerY = padding.top + baseChartHeight / 2;
    const unscaledY = centerY + (y - panOffset.y - centerY) / yScale;
    const norm = 1 - (unscaledY - padding.top) / baseChartHeight;
    return minPrice + norm * priceRange;
  }, [minPrice, priceRange, baseChartHeight, padding.top, yScale, panOffset.y]);

  // Main Canvas Rendering Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const width = dimensions.width;
    const height = dimensions.height;

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);

    // Background
    ctx.fillStyle = theme === 'dark-slate' ? '#181c27' : '#0d1017';
    ctx.fillRect(0, 0, width, height);

    if (dayProfiles.length === 0) return;

    const rulerX = width - padding.right;
    const rulerY = height - padding.bottom;

    // 1. Draw Horizontal Grid Lines & Price Labels
    const startTick = Math.ceil(minPrice / gridStep) * gridStep;
    const endTick = Math.floor(maxPrice / gridStep) * gridStep;

    ctx.font = '10px "JetBrains Mono", monospace';
    ctx.textAlign = 'left';

    for (let priceTick = startTick; priceTick <= endTick; priceTick += gridStep) {
      const y = getPriceY(priceTick);
      if (y >= padding.top && y <= rulerY) {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
        ctx.lineWidth = 1;
        ctx.setLineDash([2, 4]);
        ctx.beginPath();
        ctx.moveTo(padding.left, y);
        ctx.lineTo(rulerX, y);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.fillStyle = '#64748b';
        ctx.fillText(priceTick.toFixed(1), rulerX + 8, y + 3.5);
      }
    }

    // Y-axis boundary line
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.beginPath();
    ctx.moveTo(rulerX, padding.top);
    ctx.lineTo(rulerX, rulerY);
    ctx.stroke();

    // 2. Render Sessions (Volume | Delta | TPO | Candles)
    const sessionCount = dayProfiles.length;
    const colGap = Math.max(12, 20 * zoomLevel * xScale);
    const minColW = 340 * zoomLevel * xScale; // comfortable width to host all 4 sub-columns
    const availWidthForCols = baseChartWidth - (sessionCount - 1) * colGap;
    const colWidth = Math.max(minColW, (availWidthForCols / sessionCount) * zoomLevel * xScale);

    // Clip rendering inside chart boundaries
    ctx.save();
    ctx.beginPath();
    ctx.rect(padding.left, padding.top - 28, baseChartWidth, baseChartHeight + 35);
    ctx.clip();

    const rowHeight = Math.max(2, (baseChartHeight / (priceRange / tpoSize)) * yScale);

    dayProfiles.forEach((profile, sIdx) => {
      const colStartX = padding.left + panOffset.x + sIdx * (colWidth + colGap);
      const colEndX = colStartX + colWidth;

      // Skip off-screen sessions
      if (colEndX < padding.left || colStartX > rulerX) return;

      const trialData = trialProfilesData.get(profile.dateStr);
      if (!trialData || !trialData.bins || trialData.bins.length === 0) return;

      const innerWidth = colWidth - 12;
      const subVolW = Math.max(65, innerWidth * 0.22);
      const subDeltaW = Math.max(65, innerWidth * 0.22);
      const subTpoW = Math.max(65, innerWidth * 0.22);
      const subCandleW = Math.max(85, innerWidth - (subVolW + subDeltaW + subTpoW + 12));

      const volStartX = colStartX;
      const deltaStartX = volStartX + subVolW + 4;
      const tpoStartX = deltaStartX + subDeltaW + 4;
      const candleStartX = tpoStartX + subTpoW + 4;
      const candleEndX = candleStartX + subCandleW;

      // Session Sub-Panel Backgrounds with subtle rounded border
      const topHeaderY = padding.top - 20;
      const subPanelH = baseChartHeight + 15;

      const drawSubPanel = (x: number, w: number, title: string, titleColor: string) => {
        ctx.fillStyle = 'rgba(15, 23, 42, 0.45)';
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
        ctx.lineWidth = 1;
        
        ctx.beginPath();
        if (typeof (ctx as any).roundRect === 'function') {
          (ctx as any).roundRect(x, padding.top - 2, w, subPanelH, 6);
        } else {
          ctx.rect(x, padding.top - 2, w, subPanelH);
        }
        ctx.fill();
        ctx.stroke();

        // Header Label (VOLUME, DELTA, TPO, CANDLES)
        ctx.font = 'bold 10px "Outfit", sans-serif';
        ctx.fillStyle = titleColor;
        ctx.textAlign = 'center';
        ctx.fillText(title, x + w / 2, topHeaderY + 12);
      };

      drawSubPanel(volStartX, subVolW, 'VOLUME', '#f8fafc');
      drawSubPanel(deltaStartX, subDeltaW, 'DELTA', '#22c55e');
      drawSubPanel(tpoStartX, subTpoW, 'TPO', '#fbbf24');
      drawSubPanel(candleStartX, subCandleW, 'CANDLES', '#22c55e');

      const pocPrice = profile.pocPrice ?? (profile as any).poc ?? trialData.volPocPrice;
      const vahPrice = profile.vahPrice ?? (profile as any).vah;
      const valPrice = profile.valPrice ?? (profile as any).val;

      // 2A. VOLUME SUB-COLUMN (Horizontal grey bars, magenta POC)
      trialData.bins.forEach(b => {
        if (b.volume <= 0) return;
        const binY = getPriceY(b.price) - rowHeight / 2;
        const barW = (b.volume / trialData.maxVol) * (subVolW - 6);
        const isPoc = b.price === trialData.volPocPrice || b.price === pocPrice;

        ctx.fillStyle = isPoc ? '#ec4899' : 'rgba(148, 163, 184, 0.65)';
        ctx.fillRect(volStartX + 3, binY + 0.5, barW, Math.max(1, rowHeight - 1));
      });

      // 2B. DELTA SUB-COLUMN (Red for negative selling delta, Green for positive buying delta)
      const deltaCenter = deltaStartX + subDeltaW / 2;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(deltaCenter, padding.top);
      ctx.lineTo(deltaCenter, padding.top + subPanelH);
      ctx.stroke();

      trialData.bins.forEach(b => {
        if (Math.abs(b.delta) <= 0.01) return;
        const binY = getPriceY(b.price) - rowHeight / 2;
        const barW = (Math.abs(b.delta) / trialData.maxAbsDelta) * (subDeltaW * 0.44);

        if (b.delta >= 0) {
          ctx.fillStyle = '#22c55e'; // Green for positive buying delta
          ctx.fillRect(deltaCenter, binY + 0.5, barW, Math.max(1, rowHeight - 1));
        } else {
          ctx.fillStyle = '#ef4444'; // Red for negative selling delta
          ctx.fillRect(deltaCenter - barW, binY + 0.5, barW, Math.max(1, rowHeight - 1));
        }
      });

      // 2C. TPO SUB-COLUMN (Differentiated colors: Inside Value Area vs Above VAH / Below VAL, plus POC)
      trialData.bins.forEach(b => {
        const count = b.tpos.length;
        if (count === 0) return;
        const binY = getPriceY(b.price) - rowHeight / 2;
        const isPoc = b.price === pocPrice;

        const hasVa = typeof valPrice === 'number' && typeof vahPrice === 'number';
        const isInsideVA = hasVa && b.price >= valPrice && b.price <= vahPrice;
        const isAboveVAH = typeof vahPrice === 'number' && b.price > vahPrice;
        const isBelowVAL = typeof valPrice === 'number' && b.price < valPrice;

        const blockSize = Math.max(2, Math.min(rowHeight - 1, (subTpoW - 8) / Math.max(1, count)));

        // Color Logic:
        // - Point of Control (POC): Bright Yellow/Gold (#fef08a / #facc15)
        // - Inside Value Area (VAL to VAH): Royal Blue (#3b82f6)
        // - Above VAH: Amber / Gold (#f59e0b)
        // - Below VAL: Warm Orange (#f97316)
        let fillCol = '#f59e0b';
        let strokeCol = 'rgba(217, 119, 6, 0.6)';
        let textCol = '#ffffff';

        if (isPoc) {
          fillCol = '#fef08a';
          strokeCol = '#facc15';
          textCol = '#000000';
        } else if (isInsideVA) {
          fillCol = '#3b82f6';
          strokeCol = 'rgba(59, 130, 246, 0.7)';
          textCol = '#ffffff';
        } else if (isAboveVAH) {
          fillCol = '#f59e0b';
          strokeCol = 'rgba(217, 119, 6, 0.7)';
          textCol = '#ffffff';
        } else if (isBelowVAL) {
          fillCol = '#f97316';
          strokeCol = 'rgba(234, 88, 12, 0.7)';
          textCol = '#ffffff';
        }

        for (let i = 0; i < count; i++) {
          const bx = tpoStartX + 4 + i * (blockSize + 0.5);
          if (bx + blockSize > tpoStartX + subTpoW) break;

          ctx.fillStyle = fillCol;
          ctx.fillRect(bx, binY + 0.5, blockSize, Math.max(1, rowHeight - 1));

          ctx.strokeStyle = strokeCol;
          ctx.lineWidth = 0.5;
          ctx.strokeRect(bx, binY + 0.5, blockSize, Math.max(1, rowHeight - 1));

          if (rowHeight >= 11 && blockSize >= 8) {
            ctx.fillStyle = textCol;
            ctx.font = 'bold 8px monospace';
            ctx.textAlign = 'center';
            ctx.fillText(b.tpos[i] || '', bx + blockSize / 2, binY + rowHeight / 2 + 2.5);
          }
        }
      });

      // 2D. CANDLES SUB-COLUMN (Green for bullish, Red for bearish)
      const sessionCandles = profile.candles || [];
      if (sessionCandles.length > 0) {
        const candleStep = (subCandleW - 12) / Math.max(1, sessionCandles.length);
        const candleBodyW = Math.max(2, Math.min(8, candleStep * 0.72));

        sessionCandles.forEach((c, cIdx) => {
          const cX = candleStartX + 6 + cIdx * candleStep + candleStep / 2;
          const highY = getPriceY(c.high);
          const lowY = getPriceY(c.low);
          const openY = getPriceY(c.open);
          const closeY = getPriceY(c.close);
          const isBull = c.close >= c.open;

          const color = isBull ? '#22c55e' : '#ef4444'; // Green for bullish, Red for bearish

          // Wick
          ctx.strokeStyle = color;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(cX, highY);
          ctx.lineTo(cX, lowY);
          ctx.stroke();

          // Body
          const topBodyY = Math.min(openY, closeY);
          const bodyH = Math.max(1.5, Math.abs(closeY - openY));
          ctx.fillStyle = color;
          ctx.fillRect(cX - candleBodyW / 2, topBodyY, candleBodyW, bodyH);
        });
      }

      // 2E. CROSS-PANEL REFERENCE LINES (VAH, VAL, POC)
      if (typeof vahPrice === 'number') {
        const vahY = getPriceY(vahPrice);
        ctx.strokeStyle = 'rgba(148, 163, 184, 0.75)';
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(volStartX, vahY);
        ctx.lineTo(candleEndX, vahY);
        ctx.stroke();
      }

      if (typeof valPrice === 'number') {
        const valY = getPriceY(valPrice);
        ctx.strokeStyle = 'rgba(148, 163, 184, 0.75)';
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(volStartX, valY);
        ctx.lineTo(candleEndX, valY);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      if (typeof pocPrice === 'number') {
        const pocY = getPriceY(pocPrice);
        ctx.strokeStyle = '#ec4899';
        ctx.lineWidth = 2;
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.moveTo(volStartX, pocY);
        ctx.lineTo(candleEndX, pocY);
        ctx.stroke();
      }

      // Top Date Label above the session
      ctx.fillStyle = '#f1f5f9';
      ctx.font = 'bold 11px "Outfit", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(formatDateShort(profile.dateStr), colStartX + colWidth / 2, padding.top - 24);

      // Bottom Date Label
      ctx.fillText(formatDateShort(profile.dateStr), colStartX + colWidth / 2, rulerY + 20);
    });

    ctx.restore();

    // 3. Right Axis Live Price Indicator
    const liveLtp = liveLtpRef.current;
    if (liveLtp && liveLtp >= minPrice && liveLtp <= maxPrice) {
      const liveY = getPriceY(liveLtp);
      ctx.fillStyle = '#00f0ff';
      ctx.fillRect(rulerX, liveY - 9, padding.right - 4, 18);
      ctx.fillStyle = '#000000';
      ctx.font = 'bold 10px "JetBrains Mono", monospace';
      ctx.textAlign = 'left';
      ctx.fillText(liveLtp.toFixed(1), rulerX + 6, liveY + 3.5);
    }

    // 4. DRAW INTERACTIVE CROSSHAIR & PRICE/DATE RULER BADGES ON HOVER
    if (
      crosshairPos &&
      crosshairPos.x >= padding.left &&
      crosshairPos.x <= rulerX &&
      crosshairPos.y >= padding.top &&
      crosshairPos.y <= rulerY
    ) {
      ctx.save();

      // Crosshair Horizontal & Vertical Lines
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);

      // Horizontal Crosshair Line
      ctx.beginPath();
      ctx.moveTo(padding.left, crosshairPos.y);
      ctx.lineTo(rulerX, crosshairPos.y);
      ctx.stroke();

      // Vertical Crosshair Line
      ctx.beginPath();
      ctx.moveTo(crosshairPos.x, padding.top);
      ctx.lineTo(crosshairPos.x, rulerY);
      ctx.stroke();

      ctx.setLineDash([]);

      // Price Badge on Right Axis
      const priceText = crosshairPos.price.toFixed(2);
      ctx.font = 'bold 10px "JetBrains Mono", monospace';
      const priceMetrics = ctx.measureText(priceText);
      const priceBadgeW = Math.max(55, priceMetrics.width + 12);
      const priceBadgeH = 18;

      ctx.fillStyle = '#00f0ff';
      ctx.fillRect(rulerX, crosshairPos.y - priceBadgeH / 2, priceBadgeW, priceBadgeH);

      ctx.fillStyle = '#000000';
      ctx.textAlign = 'center';
      ctx.fillText(priceText, rulerX + priceBadgeW / 2, crosshairPos.y + 3.5);

      // Date Badge on Bottom Axis (if over session)
      if (crosshairPos.dateStr) {
        const dateText = formatDateShort(crosshairPos.dateStr);
        ctx.font = 'bold 10px "Outfit", sans-serif';
        const dateMetrics = ctx.measureText(dateText);
        const dateBadgeW = dateMetrics.width + 14;
        const dateBadgeH = 18;
        const dateBadgeX = Math.max(padding.left + dateBadgeW / 2, Math.min(rulerX - dateBadgeW / 2, crosshairPos.x));

        ctx.fillStyle = '#00f0ff';
        ctx.fillRect(dateBadgeX - dateBadgeW / 2, rulerY, dateBadgeW, dateBadgeH);

        ctx.fillStyle = '#000000';
        ctx.textAlign = 'center';
        ctx.fillText(dateText, dateBadgeX, rulerY + 13);
      }

      ctx.restore();
    }
  }, [dimensions, dayProfiles, trialProfilesData, minPrice, maxPrice, priceRange, tpoSize, gridStep, yScale, xScale, zoomLevel, panOffset, theme, getPriceY, crosshairPos]);

  // Touch & Mouse Handlers for Pan, Zoom & Crosshair
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (x >= dimensions.width - padding.right) {
      setDragMode('y-axis');
      setDragStartPos({ x: e.clientX, y: e.clientY });
      setInitialYScale(yScale);
      setCrosshairPos(null);
    } else if (y >= dimensions.height - padding.bottom) {
      setDragMode('x-axis');
      setDragStartPos({ x: e.clientX, y: e.clientY });
      setInitialXScale(xScale);
      setCrosshairPos(null);
    } else {
      setDragMode('pan');
      setDragStartPos({ x: e.clientX, y: e.clientY });
      setInitialPanOffset(panOffset);
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    if (dragMode === 'pan') {
      const dx = e.clientX - dragStartPos.x;
      const dy = e.clientY - dragStartPos.y;
      setPanOffset({
        x: initialPanOffset.x + dx,
        y: initialPanOffset.y + dy
      });
      setCrosshairPos(null);
      return;
    }

    if (dragMode === 'y-axis') {
      const dy = dragStartPos.y - e.clientY;
      const factor = Math.exp(dy * 0.006);
      setYScale(Math.min(10.0, Math.max(0.15, initialYScale * factor)));
      setCrosshairPos(null);
      return;
    }

    if (dragMode === 'x-axis') {
      const dx = e.clientX - dragStartPos.x;
      const factor = Math.exp(dx * 0.005);
      setXScale(Math.min(10.0, Math.max(0.2, initialXScale * factor)));
      setCrosshairPos(null);
      return;
    }

    // Hover detection & Crosshair update
    if (mouseX >= dimensions.width - padding.right) {
      setCursorStyle('ns-resize');
      setCrosshairPos(null);
    } else if (mouseY >= dimensions.height - padding.bottom) {
      setCursorStyle('ew-resize');
      setCrosshairPos(null);
    } else if (mouseX < padding.left || mouseY < padding.top) {
      setCursorStyle('default');
      setCrosshairPos(null);
    } else {
      setCursorStyle('crosshair');
      const hoveredPrice = getYPrice(mouseY);

      // Find if mouse is over any session column
      const sessionCount = dayProfiles.length;
      const colGap = Math.max(12, 20 * zoomLevel * xScale);
      const minColW = 340 * zoomLevel * xScale;
      const availWidthForCols = baseChartWidth - (sessionCount - 1) * colGap;
      const colWidth = Math.max(minColW, (availWidthForCols / sessionCount) * zoomLevel * xScale);

      let matchedDateStr: string | undefined;
      for (let sIdx = 0; sIdx < dayProfiles.length; sIdx++) {
        const colStartX = padding.left + panOffset.x + sIdx * (colWidth + colGap);
        const colEndX = colStartX + colWidth;
        if (mouseX >= colStartX && mouseX <= colEndX) {
          matchedDateStr = dayProfiles[sIdx].dateStr;
          break;
        }
      }

      setCrosshairPos({
        x: mouseX,
        y: mouseY,
        price: hoveredPrice,
        dateStr: matchedDateStr
      });
    }
  };

  const handleMouseUp = () => {
    setDragMode('none');
  };

  const handleMouseLeave = () => {
    setDragMode('none');
    setCrosshairPos(null);
  };

  const handleDoubleClick = () => {
    setZoomLevel(1.0);
    setYScale(1.0);
    setXScale(1.0);
    setPanOffset({ x: 0, y: 0 });
    setCrosshairPos(null);
  };

  return (
    <div
      ref={containerRef}
      className="glass-panel animate-fade-in"
      style={{
        display: 'flex',
        flexDirection: 'column',
        position: isExpanded ? 'fixed' : 'relative',
        top: isExpanded ? 0 : 'auto',
        left: isExpanded ? 0 : 'auto',
        right: isExpanded ? 0 : 'auto',
        bottom: isExpanded ? 0 : 'auto',
        zIndex: isExpanded ? 999999 : 'auto',
        width: isExpanded ? '100vw' : '100%',
        height: isExpanded || isStandalone ? '100vh' : '100%',
        flex: 1,
        margin: 0,
        padding: isExpanded ? '10px 14px' : '6px 8px',
        backgroundColor: isExpanded ? (!isDark ? '#f8fafc' : (theme === 'dark-slate' ? '#0f172a' : '#090d16')) : undefined,
        gap: isExpanded ? '10px' : '6px',
        boxSizing: 'border-box',
        overflow: 'hidden'
      }}
    >
      {/* Controls Toolbar (Exact same navigation & features as Market Profile) */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px', background: 'rgba(15, 23, 42, 0.6)', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
        
        {/* Mobile Quick Bar */}
        <div className="mobile-only" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '12px', fontWeight: '800', color: '#00f0ff' }}>📊 Trial Profile</span>
            <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>({symbol})</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <button
              onClick={() => {
                setShowMobileProfileTools(!showMobileProfileTools);
              }}
              style={{
                background: showMobileProfileTools ? 'rgba(56, 189, 248, 0.25)' : 'rgba(255, 255, 255, 0.08)',
                border: '1px solid rgba(56, 189, 248, 0.4)',
                color: showMobileProfileTools ? '#38bdf8' : '#e2e8f0',
                padding: '4px 9px',
                borderRadius: '4px',
                fontSize: '11px',
                fontWeight: '700',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              🛠️ Tools {showMobileProfileTools ? '▲' : '▼'}
            </button>
          </div>
        </div>

        {/* Customization & View Controls */}
        <div className={showMobileProfileTools ? '' : 'desktop-only'} style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', width: showMobileProfileTools ? '100%' : 'auto', paddingTop: showMobileProfileTools ? '6px' : '0', borderTop: showMobileProfileTools ? '1px dashed rgba(255, 255, 255, 0.1)' : 'none' }}>
          
          {/* Axis Grid Step with direct [-] [+] manual controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '3px', background: 'rgba(0,0,0,0.4)', padding: '3px 8px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.1)' }}>
            <Sliders size={12} style={{ color: '#00f0ff' }} />
            <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: '600' }}>Grid:</span>
            <button
              onClick={() => {
                const steps = [5, 10, 20, 25, 50, 100];
                const curIdx = steps.indexOf(gridStep);
                if (curIdx > 0) setGridStep(steps[curIdx - 1]);
                else setGridStep(5);
              }}
              style={{ background: 'rgba(255,255,255,0.08)', border: 'none', color: '#60a5fa', width: '18px', height: '18px', borderRadius: '3px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              title="Decrease Grid Step Spacing"
            >
              -
            </button>
            <select
              value={gridStep}
              onChange={(e) => setGridStep(Number(e.target.value))}
              style={{
                background: 'transparent',
                color: '#00f0ff',
                border: 'none',
                fontSize: '11px',
                fontWeight: '800',
                cursor: 'pointer',
                outline: 'none',
                padding: '0 2px'
              }}
            >
              <option value={5} style={{ background: '#1e293b' }}>5 pts</option>
              <option value={10} style={{ background: '#1e293b' }}>10 pts</option>
              <option value={20} style={{ background: '#1e293b' }}>20 pts</option>
              <option value={25} style={{ background: '#1e293b' }}>25 pts</option>
              <option value={50} style={{ background: '#1e293b' }}>50 pts</option>
              <option value={100} style={{ background: '#1e293b' }}>100 pts</option>
            </select>
            <button
              onClick={() => {
                const steps = [5, 10, 20, 25, 50, 100];
                const curIdx = steps.indexOf(gridStep);
                if (curIdx !== -1 && curIdx < steps.length - 1) setGridStep(steps[curIdx + 1]);
                else setGridStep(100);
              }}
              style={{ background: 'rgba(255,255,255,0.08)', border: 'none', color: '#60a5fa', width: '18px', height: '18px', borderRadius: '3px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              title="Increase Grid Step Spacing"
            >
              +
            </button>
          </div>

          {/* TPO Size selection with direct [-] [+] manual controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '3px', background: 'rgba(0,0,0,0.4)', padding: '3px 8px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.1)' }}>
            <span style={{ fontSize: '11px', color: '#60a5fa', fontWeight: '800' }}>TPO:</span>
            <button
              onClick={() => {
                const steps = [0.5, 1, 2, 3, 4, 5, 6, 8, 10, 15, 20, 25, 30, 40, 50, 100];
                const curIdx = steps.indexOf(tpoSize);
                if (curIdx > 0) setTpoSize(steps[curIdx - 1]);
                else setTpoSize(steps[0]);
              }}
              style={{ background: 'rgba(255,255,255,0.08)', border: 'none', color: '#60a5fa', width: '18px', height: '18px', borderRadius: '3px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              title="Decrease TPO Size"
            >
              -
            </button>
            <select
              value={tpoSize}
              onChange={(e) => setTpoSize(Number(e.target.value))}
              style={{
                background: 'transparent',
                color: '#60a5fa',
                border: 'none',
                fontSize: '11px',
                fontWeight: '800',
                cursor: 'pointer',
                outline: 'none',
                padding: '0 2px'
              }}
            >
              {[0.5, 1, 2, 3, 4, 5, 6, 8, 10, 15, 20, 25, 30, 40, 50, 100].map(s => (
                <option key={s} value={s} style={{ background: '#1e293b', color: '#ffffff' }}>
                  {s} pts
                </option>
              ))}
            </select>
            <button
              onClick={() => {
                const steps = [0.5, 1, 2, 3, 4, 5, 6, 8, 10, 15, 20, 25, 30, 40, 50, 100];
                const curIdx = steps.indexOf(tpoSize);
                if (curIdx !== -1 && curIdx < steps.length - 1) setTpoSize(steps[curIdx + 1]);
                else setTpoSize(steps[steps.length - 1]);
              }}
              style={{ background: 'rgba(255,255,255,0.08)', border: 'none', color: '#60a5fa', width: '18px', height: '18px', borderRadius: '3px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              title="Increase TPO Size"
            >
              +
            </button>
          </div>

          {/* Zoom Controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(0,0,0,0.4)', padding: '3px 6px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.1)' }}>
            <button
              onClick={() => setZoomLevel(prev => Math.min(5.0, prev * 1.25))}
              style={{ background: 'transparent', border: 'none', color: '#60a5fa', cursor: 'pointer', padding: '3px', display: 'flex', alignItems: 'center' }}
              title="Zoom In (+)"
            >
              <ZoomIn size={15} />
            </button>
            <span style={{ fontSize: '11px', fontWeight: '800', color: '#00f0ff', padding: '0 4px', minWidth: '38px', textAlign: 'center' }}>
              {Math.round(zoomLevel * 100)}%
            </span>
            <button
              onClick={() => setZoomLevel(prev => Math.max(0.4, prev * 0.8))}
              style={{ background: 'transparent', border: 'none', color: '#60a5fa', cursor: 'pointer', padding: '3px', display: 'flex', alignItems: 'center' }}
              title="Zoom Out (-)"
            >
              <ZoomOut size={15} />
            </button>
            <button
              onClick={handleDoubleClick}
              style={{ background: 'rgba(255,255,255,0.08)', border: 'none', color: 'white', cursor: 'pointer', padding: '3px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: '700', marginLeft: '4px' }}
              title="Reset Zoom & Pan"
            >
              Reset
            </button>
          </div>

          {/* Scroll & Pan Navigation */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(0,0,0,0.4)', padding: '3px 6px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.1)' }}>
            <button
              onClick={() => setPanOffset(prev => ({ ...prev, x: prev.x + 220 }))}
              style={{ background: 'transparent', border: 'none', color: '#60a5fa', cursor: 'pointer', padding: '3px 6px', display: 'flex', alignItems: 'center', gap: '2px', fontSize: '11px', fontWeight: '700' }}
              title="Scroll Left (View Older Sessions)"
            >
              <ChevronLeft size={16} /> Older
            </button>
            <button
              onClick={handleDoubleClick}
              style={{ background: 'rgba(0, 240, 255, 0.15)', border: '1px solid rgba(0, 240, 255, 0.4)', color: '#00f0ff', cursor: 'pointer', padding: '2px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: '800' }}
              title="Reset to Latest Session"
            >
              Latest ⚡
            </button>
            <button
              onClick={() => setPanOffset(prev => ({ ...prev, x: prev.x - 220 }))}
              style={{ background: 'transparent', border: 'none', color: '#60a5fa', cursor: 'pointer', padding: '3px 6px', display: 'flex', alignItems: 'center', gap: '2px', fontSize: '11px', fontWeight: '700' }}
              title="Scroll Right (View Newer Sessions)"
            >
              Newer <ChevronRight size={16} />
            </button>
          </div>

          {/* Timeframe */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(0,0,0,0.3)', padding: '2px', borderRadius: '6px' }}>
            {['5', '15', '30'].map((tf) => (
              <button
                key={tf}
                onClick={() => setTimeframe(tf)}
                style={{
                  background: timeframe === tf ? '#3b82f6' : 'transparent',
                  color: timeframe === tf ? 'white' : 'var(--text-secondary)',
                  border: 'none',
                  padding: '4px 8px',
                  borderRadius: '4px',
                  fontSize: '11px',
                  fontWeight: '700',
                  cursor: 'pointer'
                }}
              >
                {tf}m
              </button>
            ))}
          </div>

          {/* Lookback Days Selection */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            background: isDark ? 'rgba(0,0,0,0.35)' : 'rgba(241, 245, 249, 0.9)',
            padding: '2px 6px',
            borderRadius: '6px',
            border: `1px solid ${isDark ? 'rgba(139, 92, 246, 0.35)' : '#cbd5e1'}`
          }}>
            <select
              value={lookbackDays}
              onChange={(e) => setLookbackDays(Number(e.target.value))}
              style={{
                background: 'transparent',
                color: isDark ? '#a78bfa' : '#6d28d9',
                border: 'none',
                borderRadius: '4px',
                padding: '3px 4px',
                fontSize: '11px',
                fontWeight: '700',
                cursor: 'pointer',
                outline: 'none'
              }}
              title="Select profile lookback period"
            >
              <option value={1} style={{ background: '#1e293b', color: '#fff' }}>1 Day</option>
              <option value={2} style={{ background: '#1e293b', color: '#fff' }}>2 Days</option>
              <option value={3} style={{ background: '#1e293b', color: '#fff' }}>3 Days</option>
              <option value={5} style={{ background: '#1e293b', color: '#fff' }}>5 Days</option>
              <option value={10} style={{ background: '#1e293b', color: '#fff' }}>10 Days</option>
              <option value={20} style={{ background: '#1e293b', color: '#fff' }}>20 Days</option>
              <option value={50} style={{ background: '#1e293b', color: '#fff' }}>50 Days</option>
              <option value={100} style={{ background: '#1e293b', color: '#fff' }}>100 Days</option>
            </select>
          </div>

          {/* Layout Legend Pill with updated color badges */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(0,0,0,0.4)', padding: '3px 8px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.1)' }}>
            <span style={{ fontSize: '10px', color: '#f8fafc', fontWeight: '800' }}>VOL</span>
            <span style={{ fontSize: '10px', color: '#64748b' }}>•</span>
            <span style={{ fontSize: '10px', color: '#22c55e', fontWeight: '800' }}>DELTA</span>
            <span style={{ fontSize: '10px', color: '#64748b' }}>•</span>
            <span style={{ fontSize: '10px', color: '#3b82f6', fontWeight: '800' }}>TPO (VA)</span>
            <span style={{ fontSize: '10px', color: '#f59e0b', fontWeight: '800' }}>(OUT)</span>
            <span style={{ fontSize: '10px', color: '#64748b' }}>•</span>
            <span style={{ fontSize: '10px', color: '#22c55e', fontWeight: '800' }}>CANDLES</span>
          </div>

        </div>

        {/* Right Action Icons: Fullscreen & Live Indicator */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', background: 'rgba(0, 240, 255, 0.1)', padding: '4px 8px', borderRadius: '6px', border: '1px solid rgba(0, 240, 255, 0.25)' }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: streamStatus === 'LIVE' ? '#10b981' : '#ef4444' }} className={streamStatus === 'LIVE' ? 'animate-pulse' : ''} />
            <span style={{ fontSize: '11px', fontWeight: '800', color: streamStatus === 'LIVE' ? '#34d399' : '#f87171' }}>
              {streamStatus}
            </span>
          </div>

          <button
            onClick={toggleFullscreen}
            style={{
              background: isExpanded ? 'rgba(0, 240, 255, 0.2)' : 'rgba(255, 255, 255, 0.08)',
              border: `1px solid ${isExpanded ? '#00f0ff' : 'rgba(255, 255, 255, 0.12)'}`,
              color: isExpanded ? '#00f0ff' : '#cbd5e1',
              padding: '6px',
              borderRadius: '6px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            title={isExpanded ? "Exit Fullscreen" : "Fullscreen View"}
          >
            {isExpanded ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
          </button>
        </div>

      </div>

      {/* Main Chart Viewport */}
      <div 
        ref={canvasContainerRef} 
        style={{ 
          position: 'relative', 
          width: '100%', 
          flex: 1,
          minHeight: isExpanded || isStandalone ? '500px' : (typeof window !== 'undefined' && window.innerWidth <= 768 ? '360px' : '380px'),
          height: isExpanded || isStandalone ? 'calc(100vh - 65px)' : '100%',
          backgroundColor: theme === 'dark-slate' ? '#181c27' : '#0d1017', 
          borderRadius: isExpanded ? '0' : '8px', 
          border: '1px solid var(--border-color)',
          overflow: 'hidden'
        }}
      >
        <canvas
          ref={canvasRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseLeave}
          onDoubleClick={handleDoubleClick}
          onTouchStart={(e) => {
            if (e.touches.length === 1) {
              setDragMode('pan');
              setDragStartPos({ x: e.touches[0].clientX, y: e.touches[0].clientY });
              setInitialPanOffset(panOffset);
              setCrosshairPos(null);
            }
          }}
          onTouchMove={(e) => {
            if (dragMode === 'pan' && e.touches.length === 1) {
              setPanOffset({
                x: initialPanOffset.x + (e.touches[0].clientX - dragStartPos.x),
                y: initialPanOffset.y + (e.touches[0].clientY - dragStartPos.y)
              });
              setCrosshairPos(null);
            }
          }}
          onTouchEnd={() => {
            setDragMode('none');
            setCrosshairPos(null);
          }}
          style={{ cursor: cursorStyle, display: 'block', touchAction: 'none' }}
        />

        {loading && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(15, 23, 42, 0.85)', zIndex: 10 }}>
            <RefreshCw size={28} className="animate-spin" style={{ color: '#00f0ff', marginBottom: '12px' }} />
            <span style={{ fontSize: '14px', color: 'white', fontWeight: '600' }}>Calculating Volume, Delta & TPO Profiles for {symbol}...</span>
          </div>
        )}

        {error && !loading && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(15, 23, 42, 0.9)', zIndex: 10 }}>
            <ShieldAlert size={32} style={{ color: '#ef4444', marginBottom: '12px' }} />
            <span style={{ fontSize: '14px', color: '#ef4444', fontWeight: '600', marginBottom: '12px' }}>{error}</span>
            <button
              onClick={() => fetchCandles(symbol, timeframe, lookbackDays)}
              style={{
                background: 'rgba(0, 240, 255, 0.15)',
                border: '1px solid rgba(0, 240, 255, 0.4)',
                color: '#00f0ff',
                padding: '6px 16px',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: '700',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <RefreshCw size={14} /> Retry Connecting
            </button>
          </div>
        )}
      </div>

    </div>
  );
};
