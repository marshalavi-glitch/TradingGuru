import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import tvStreamer, { getBackendHttpUrl } from '../utils/tvStreamer';
import { groupCandlesByDay, calculateDayProfile, Candle, DayProfile, TPOBin, calculateSinglePrintZones, SinglePrintZone } from '../utils/profileCalculator';
import { resolveSymbol } from '../utils/symbolResolver';
import { filterMarketHoursCandles, isWithinMarketHours } from '../utils/marketHours';
import { 
  RefreshCw, ZoomIn, ZoomOut, Move, BarChart2, TrendingUp, TrendingDown, 
  ShieldAlert, Zap, Sliders, ChevronLeft, ChevronRight, Maximize2, Minimize2, ExternalLink, Layers,
  Pin, PinOff, Camera, X
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

interface ProMarketProfileContainerProps {
  selectedSymbol?: string;
  onSymbolSelect?: (symbol: string) => void;
  onSwitchToChart?: () => void;
}

function formatDateHeader(dateStr: string): string {
  if (dateStr.startsWith('W:')) {
    const parts = dateStr.replace('W:', '').split('-');
    if (parts.length === 3) {
      return `Wk ${parts[2]}-${parts[1]}-${parts[0]}`;
    }
  }
  if (dateStr.startsWith('M:')) {
    const parts = dateStr.replace('M:', '').split('-');
    if (parts.length === 2) {
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const mIdx = parseInt(parts[1], 10) - 1;
      return `${monthNames[mIdx]} ${parts[0]}`;
    }
  }
  if (dateStr.startsWith('Y:')) {
    return `Yr ${dateStr.replace('Y:', '')}`;
  }
  // Converts YYYY-MM-DD to DD-MM-YYYY format
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    return `${parts[2]}-${parts[1]}-${parts[0]}`;
  }
  return dateStr;
}

function formatDateShort(dateStr: string): string {
  if (dateStr.startsWith('W:')) {
    const parts = dateStr.replace('W:', '').split('-');
    return `Wk ${parts[2] || ''}`;
  }
  if (dateStr.startsWith('M:')) {
    const parts = dateStr.replace('M:', '').split('-');
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const mIdx = parseInt(parts[1], 10) - 1;
    return `${monthNames[mIdx] || ''} ${parts[0] || ''}`;
  }
  if (dateStr.startsWith('Y:')) {
    return dateStr.replace('Y:', '');
  }
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const mIdx = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);
    return `${day} ${monthNames[mIdx] || parts[1]}`;
  }
  return dateStr;
}

export const QUICK_SYMBOLS = [
  { label: 'NIFTY_I', symbol: 'NSE:NIFTY1!' },
  { label: 'BNF', symbol: 'NSE:BANKNIFTY1!' },
  { label: 'RELIANCE', symbol: 'NSE:RELIANCE' },
  { label: 'TATAMOTORS', symbol: 'NSE:TATAMOTORS' },
  { label: 'FINNIFTY_I', symbol: 'NSE:FINNIFTY1!' },
  { label: 'MIDCPNIFTY_I', symbol: 'NSE:MIDCPNIFTY1!' },
  { label: 'BANKNIFTY_I', symbol: 'NSE:BANKNIFTY1!' },
  { label: 'NF - W', symbol: 'NSE:NIFTY' },
  { label: 'HDFCBANK_I', symbol: 'NSE:HDFCBANK' },
  { label: 'AXISBANK_I', symbol: 'NSE:AXISBANK' },
  { label: 'SBIN', symbol: 'NSE:SBIN' },
];

function groupCandlesBySessionPeriod(
  candles: Candle[],
  period: 'D' | 'W' | 'W_S' | 'M_S' | 'Y'
): { keys: string[]; grouped: Record<string, Candle[]>; sessionPeriodType: 'daily' | 'weekly' | 'monthly' | 'yearly' } {
  const grouped: Record<string, Candle[]> = {};
  
  if (period === 'D') {
    for (const c of candles) {
      const date = new Date(c.time * 1000);
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, '0');
      const d = String(date.getDate()).padStart(2, '0');
      const dateStr = `${y}-${m}-${d}`;
      if (!grouped[dateStr]) grouped[dateStr] = [];
      grouped[dateStr].push(c);
    }
    return { keys: Object.keys(grouped).sort(), grouped, sessionPeriodType: 'daily' };
  }
  
  if (period === 'W' || period === 'W_S') {
    for (const c of candles) {
      const d = new Date(c.time * 1000);
      const dayOfWeek = d.getDay(); // 0 is Sun, 1 is Mon...
      const diffToMon = (dayOfWeek === 0 ? -6 : 1 - dayOfWeek);
      const monDate = new Date(d);
      monDate.setDate(d.getDate() + diffToMon);
      const y = monDate.getFullYear();
      const m = String(monDate.getMonth() + 1).padStart(2, '0');
      const day = String(monDate.getDate()).padStart(2, '0');
      const weekStr = `W:${y}-${m}-${day}`;
      if (!grouped[weekStr]) grouped[weekStr] = [];
      grouped[weekStr].push(c);
    }
    return { keys: Object.keys(grouped).sort(), grouped, sessionPeriodType: 'weekly' };
  }
  
  if (period === 'M_S') {
    for (const c of candles) {
      const d = new Date(c.time * 1000);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const monthStr = `M:${y}-${m}`;
      if (!grouped[monthStr]) grouped[monthStr] = [];
      grouped[monthStr].push(c);
    }
    return { keys: Object.keys(grouped).sort(), grouped, sessionPeriodType: 'monthly' };
  }
  
  if (period === 'Y') {
    for (const c of candles) {
      const d = new Date(c.time * 1000);
      const yearStr = `Y:${d.getFullYear()}`;
      if (!grouped[yearStr]) grouped[yearStr] = [];
      grouped[yearStr].push(c);
    }
    return { keys: Object.keys(grouped).sort(), grouped, sessionPeriodType: 'yearly' };
  }
  
  return { keys: [], grouped: {}, sessionPeriodType: 'daily' };
}

function getLetterColor(letter: string): string {
  const code = letter.toUpperCase().charCodeAt(0);
  if (code >= 65 && code <= 66) return '#c084fc'; // A-B Initial Balance Purple
  if (code >= 67 && code <= 70) return '#38bdf8'; // C-F Morning Cyan/Blue
  if (code >= 71 && code <= 74) return '#22c55e'; // G-J Midday Green
  if (code >= 75 && code <= 78) return '#ffffff'; // K-N Afternoon White
  if (code >= 79 && code <= 82) return '#f97316'; // O-R Pre-Close Orange
  return '#ef4444'; // S-Z Red
}

export const ProMarketProfileContainer: React.FC<ProMarketProfileContainerProps> = ({
  selectedSymbol,
  onSymbolSelect,
  onSwitchToChart
}) => {
  const { isDark } = useTheme();
  const [symbol, setSymbol] = useState<string>(() => {
    try {
      const p = new URLSearchParams(window.location.search);
      const s = p.get('symbol');
      if (s) return s;
    } catch (e) {}
    return selectedSymbol || 'NSE:NIFTY';
  });
  const [timeframe, setTimeframe] = useState<string>(() => {
    try {
      const p = new URLSearchParams(window.location.search);
      const tf = p.get('timeframe');
      if (tf) return tf;
    } catch (e) {}
    return '30';
  });
  const [lookbackDays, setLookbackDays] = useState<number>(12);
  const [sessionPeriod, setSessionPeriod] = useState<'D' | 'W' | 'W_S' | 'M_S' | 'Y'>('D');
  const [viewMode, setViewMode] = useState<'GV' | 'GVN' | 'T' | 'T-V' | 'T/V' | 'V' | 'VN' | 'T-VA' | 'V-VA' | 'H-VA'>('T-V');

  // Fullscreen and Pop Out States
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Check if opened standalone via Pop Out
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
  const [barRemainingSeconds, setBarRemainingSeconds] = useState<number>(0);

  useEffect(() => {
    const updateCountdown = () => {
      const now = Math.floor(Date.now() / 1000);
      let tfMins = 30;
      if (timeframe === '5') tfMins = 5;
      else if (timeframe === '15') tfMins = 15;
      else if (timeframe === '60') tfMins = 60;
      else if (timeframe === 'D' || sessionPeriod === 'Y') tfMins = 375;
      const blockSecs = tfMins * 60;
      const rem = blockSecs - (now % blockSecs);
      setBarRemainingSeconds(rem);
    };
    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [timeframe, sessionPeriod]);

  // Saved scales to restore on exit
  const prevScaleRef = useRef<{ yScale: number; xScale: number; zoomLevel: number }>({ yScale: 1.0, xScale: 1.0, zoomLevel: 1.0 });

  // Toggle Fullscreen: covers dashboard with fixed overlay + native fullscreen and increases scale
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

  // Pop Out into new browser tab / window
  const handlePopOut = useCallback(() => {
    const origin = window.location.origin;
    const pathname = window.location.pathname;
    const params = new URLSearchParams();
    params.set('tab', 'pro_market_profile');
    params.set('symbol', symbol);
    params.set('timeframe', String(timeframe));
    params.set('standalone', 'true');
    window.open(`${origin}${pathname}?${params.toString()}`, '_blank');
  }, [symbol, timeframe]);

  // Sync with Escape key and fullscreenchange event
  useEffect(() => {
    const handleFsChange = () => {
      if (!document.fullscreenElement && isExpanded) {
        setIsExpanded(false);
        if (prevScaleRef.current) {
          setYScale(prevScaleRef.current.yScale);
          setXScale(prevScaleRef.current.xScale);
          setZoomLevel(prevScaleRef.current.zoomLevel);
        }
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isExpanded) {
        setIsExpanded(false);
        if (prevScaleRef.current) {
          setYScale(prevScaleRef.current.yScale);
          setXScale(prevScaleRef.current.xScale);
          setZoomLevel(prevScaleRef.current.zoomLevel);
        }
        if (document.fullscreenElement && document.exitFullscreen) {
          document.exitFullscreen().catch(() => {});
        }
      }
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('fullscreenchange', handleFsChange);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isExpanded]);

  // Sync with incoming selectedSymbol from App.tsx
  useEffect(() => {
    if (selectedSymbol && selectedSymbol !== symbol) {
      setSymbol(selectedSymbol);
      if (selectedSymbol.includes('BANKNIFTY')) {
        setGridStep(50);
        setTpoStep(10);
      } else if (selectedSymbol.includes('NIFTY')) {
        setGridStep(20);
        setTpoStep(4);
      } else if (selectedSymbol.includes('SENSEX')) {
        setGridStep(50);
        setTpoStep(20);
      }
    }
  }, [selectedSymbol]);

  // Customization State
  const [gridStep, setGridStep] = useState<number>(20); // Grid line spacing
  const [showIbLine, setShowIbLine] = useState<boolean>(true); // Initial Balance vertical line
  const [highlightSinglePrints, setHighlightSinglePrints] = useState<boolean>(true); // Single prints highlight
  const [showPoorHighLow, setShowPoorHighLow] = useState<boolean>(true); // Poor High/Low markers
  const [showTwoDayBalance, setShowTwoDayBalance] = useState<boolean>(true); // 2-Day Balance toggle
  const [showG2G3, setShowG2G3] = useState<boolean>(true); // G2 (2-Day) and G3 (3-Day) Balance reference lines
  const [showWeeklyLevels, setShowWeeklyLevels] = useState<boolean>(true); // Weekly High & Low lines
  const [showHvn, setShowHvn] = useState<boolean>(true); // High Volume Node (HVN) reference lines
  const [showLvn, setShowLvn] = useState<boolean>(true); // Low Volume Node (LVN) reference lines
  const [tpoStep, setTpoStep] = useState<number>(4); // TPO Tick step (default 4 as in screenshot)
  const [panOffset, setPanOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [dragMode, setDragMode] = useState<'none' | 'pan' | 'y-axis' | 'x-axis'>('none');
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [initialYScale, setInitialYScale] = useState<number>(1.0);
  const [initialXScale, setInitialXScale] = useState<number>(1.0);
  const [hoveredAxis, setHoveredAxis] = useState<'none' | 'y-axis' | 'x-axis'>('none');
  const [cursorStyle, setCursorStyle] = useState<string>('crosshair');

  // Multi-touch pinch & pan state ref for smooth mobile gestures
  const touchStateRef = useRef<{
    mode: 'none' | 'pan' | 'pinch';
    startX: number;
    startY: number;
    initialPan: { x: number; y: number };
    startDist: number;
    initialZoom: number;
    initialYScale: number;
  }>({
    mode: 'none',
    startX: 0,
    startY: 0,
    initialPan: { x: 0, y: 0 },
    startDist: 0,
    initialZoom: 1.0,
    initialYScale: 1.0
  });

  const [candles, setCandles] = useState<Candle[]>([]);
  const [liveLtp, setLiveLtp] = useState<number | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 680 });
  const [hoverInfo, setHoverInfo] = useState<{
    profile: DayProfile;
    bin: TPOBin;
    x: number;
    y: number;
  } | null>(null);
  const [pinnedInfo, setPinnedInfo] = useState<{
    profile: DayProfile;
    bin: TPOBin;
    x: number;
    y: number;
  } | null>(null);
  const [screenshotStatus, setScreenshotStatus] = useState<string | null>(null);

  const [crosshairPos, setCrosshairPos] = useState<{
    x: number;
    y: number;
    price: number;
    dateStr?: string;
  } | null>(null);

  // Fetch candles with auto-retry
  const fetchCandles = async (silent: boolean = false) => {
    if (!silent) setLoading(true);
    if (!silent) setError(null);
    let attempts = 0;
    const maxAttempts = 2;

    while (attempts < maxAttempts) {
      try {
        attempts++;
        const backendHttp = await getBackendHttpUrl();
        const resolved = resolveSymbol(symbol);
        const isYearly = sessionPeriod === 'Y' || timeframe === 'Y';
        const isMonthly = sessionPeriod === 'M_S' || timeframe === 'M';
        const isWeekly = sessionPeriod === 'W' || sessionPeriod === 'W_S' || timeframe === 'W';
        const effTf = (isYearly || isMonthly || isWeekly) ? 'D' : timeframe;
        let limit: number;
        if (isYearly) {
          limit = 2000; // 6 years of daily candles (~1500 trading days)
        } else if (isMonthly) {
          limit = 1000; // 25 months of daily candles (~525 trading days)
        } else if (isWeekly) {
          limit = 800;  // 50 weeks of daily candles (~250 trading days)
        } else {
          const multiplier = timeframe === '5' ? 85 : timeframe === '15' ? 40 : 35;
          limit = Math.min(1500, Math.max(450, (lookbackDays + 1) * multiplier));
        }
        const url = `${backendHttp}/api/candles?symbol=${encodeURIComponent(resolved.formattedSymbol)}&timeframe=${effTf}&limit=${limit}`;
        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          if (data.candles && data.candles.length > 0) {
            setCandles(filterMarketHoursCandles(data.candles, resolved.formattedSymbol, effTf));
            const last = data.candles[data.candles.length - 1];
            if (last && typeof last.close === 'number') {
              setLiveLtp(last.close);
            }
            setError(null);
            if (!silent) setLoading(false);
            return;
          } else if (resolved.formattedSymbol.includes('1!')) {
            const fallbackSym = resolved.formattedSymbol.replace('1!', '');
            const fbRes = await fetch(`${backendHttp}/api/candles?symbol=${encodeURIComponent(fallbackSym)}&timeframe=${effTf}&limit=${limit}`);
            if (fbRes.ok) {
              const fbData = await fbRes.json();
              if (fbData.candles && fbData.candles.length > 0) {
                setCandles(filterMarketHoursCandles(fbData.candles, fallbackSym, effTf));
                const last = fbData.candles[fbData.candles.length - 1];
                if (last && typeof last.close === 'number') {
                  setLiveLtp(last.close);
                }
                setError(null);
                if (!silent) setLoading(false);
                return;
              }
            }
          }
        }
      } catch (err: any) {
        console.warn(`[ProMarketProfileContainer] Fetch attempt ${attempts} failed:`, err);
      }
      if (attempts < maxAttempts) {
        await new Promise(r => setTimeout(r, 600));
      }
    }

    if (!silent) {
      setError('Connecting to market feed...');
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCandles();
  }, [symbol, timeframe, lookbackDays, sessionPeriod]);

  // Real-Time Tick-by-Tick Synchronization from Dashboard's Centralized Live Market Data Stream (tvStreamer)
  useEffect(() => {
    let isMounted = true;
    const resolved = resolveSymbol(symbol);
    const targetSym = resolved.formattedSymbol || symbol;

    const cached = tvStreamer.getLatestLtp(targetSym);
    if (cached) {
      setLiveLtp(cached.ltp);
    }

    const unsubscribeStream = tvStreamer.subscribe(
      targetSym,
      timeframe,
      (payload) => {
        if (!isMounted) return;
        if (payload.candles && payload.candles.length > 0) {
          const last = payload.candles[payload.candles.length - 1];
          if (last && typeof last.close === 'number') {
            setLiveLtp(last.close);
          }

          if (payload.isSnapshot) {
            setCandles(filterMarketHoursCandles(payload.candles, targetSym, timeframe));
          } else {
            setCandles(prev => {
              if (!prev || prev.length === 0) return filterMarketHoursCandles(payload.candles, targetSym, timeframe);
              const next = [...prev];
              for (const c of payload.candles) {
                if (!isWithinMarketHours(c.time, targetSym, timeframe)) continue;
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

    const unsubscribeTicks = tvStreamer.addTickListener((tick) => {
      if (!isMounted) return;
      const cleanTarget = targetSym.replace(/^(NSE:|BSE:|MCX:|NFO:)/, '').trim().toUpperCase();
      const cleanTick = tick.symbol.replace(/^(NSE:|BSE:|MCX:|NFO:)/, '').trim().toUpperCase();
      if (cleanTarget === cleanTick) {
        setLiveLtp(tick.ltp);
        
        // Dynamically update latest candle high/low/close only during official market hours
        if (!isWithinMarketHours(Math.floor(Date.now() / 1000), targetSym, timeframe)) {
          return; // Do not alter completed candles during pre-open or after 3:30 PM
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

    const pollInterval = setInterval(() => {
      if (isMounted) fetchCandles(true);
    }, 5000);

    return () => {
      isMounted = false;
      unsubscribeStream();
      unsubscribeTicks();
      clearInterval(pollInterval);
    };
  }, [symbol, timeframe]);

  // Group candles and build profiles
  const dayProfiles: DayProfile[] = useMemo(() => {
    if (!candles || candles.length === 0) return [];
    const { keys, grouped, sessionPeriodType } = groupCandlesBySessionPeriod(candles, sessionPeriod);
    
    // Slice keys based on session period
    let lookbackLimit = lookbackDays;
    if (sessionPeriod === 'W' || sessionPeriod === 'W_S') {
      lookbackLimit = 50; // Last 50 weeks of TPO profiles
    } else if (sessionPeriod === 'M_S') {
      lookbackLimit = 25; // Last 25 months of TPO profiles
    } else if (sessionPeriod === 'Y') {
      lookbackLimit = 6;  // Last 6 years of TPO profiles
    }
    
    const activeKeys = keys.slice(Math.max(0, keys.length - lookbackLimit));
    
    return activeKeys.map(kStr => {
      return calculateDayProfile(kStr, grouped[kStr], 40, sessionPeriodType, undefined, tpoStep, symbol);
    });
  }, [candles, lookbackDays, sessionPeriod, tpoStep, symbol]);

  // Auto-scroll to show the latest sessions on load or symbol switch
  const lastAutoScrollKey = useRef<string>('');
  useEffect(() => {
    if (dayProfiles.length > 0 && dimensions.width > 0) {
      const key = `${symbol}_${timeframe}_${sessionPeriod}_${dayProfiles.length}`;
      if (lastAutoScrollKey.current !== key) {
        lastAutoScrollKey.current = key;
        const chartW = dimensions.width - 25 - 80;
        const baseColWidth = Math.max(180, Math.min(260, chartW / 5.2));
        const colWidth = baseColWidth * zoomLevel * xScale;
        const colGap = Math.max(8, 14 * zoomLevel * xScale);
        const totalW = dayProfiles.length * (colWidth + colGap);
        if (totalW > chartW) {
          setPanOffset({ x: chartW - totalW + 20, y: 0 });
        } else {
          setPanOffset({ x: 0, y: 0 });
        }
      }
    }
  }, [dayProfiles, dimensions.width, symbol, timeframe, sessionPeriod]);

  // Keyboard shortcut listener for Pin/Unpin (P) and Unpin (Esc)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName)) return;
      if (e.key === 'p' || e.key === 'P') {
        if (pinnedInfo) {
          setPinnedInfo(null);
        } else if (hoverInfo) {
          setPinnedInfo(hoverInfo);
        } else if (dayProfiles.length > 0) {
          const latestProf = dayProfiles[dayProfiles.length - 1];
          const pocBin = latestProf.bins.find(b => b.price === latestProf.pocPrice) || latestProf.bins[0];
          setPinnedInfo({
            profile: latestProf,
            bin: pocBin,
            x: 150,
            y: 110
          });
        }
      } else if (e.key === 'Escape') {
        setPinnedInfo(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [pinnedInfo, hoverInfo, dayProfiles]);

  // Compute composite global volume histogram across all loaded sessions for the left side
  const globalVolumeProfile = useMemo(() => {
    if (dayProfiles.length === 0) return { bins: [], maxVolume: 0 };
    const priceBinsMap: Record<number, number> = {};
    let maxVol = 0;

    dayProfiles.forEach(p => {
      p.bins.forEach(b => {
        const roundedPrice = Math.round(b.price * 10) / 10;
        priceBinsMap[roundedPrice] = (priceBinsMap[roundedPrice] || 0) + b.volume;
        if (priceBinsMap[roundedPrice] > maxVol) {
          maxVol = priceBinsMap[roundedPrice];
        }
      });
    });

    const bins = Object.entries(priceBinsMap).map(([pStr, vol]) => ({
      price: parseFloat(pStr),
      volume: vol
    })).sort((a, b) => b.price - a.price);

    return { bins, maxVolume: maxVol };
  }, [dayProfiles]);

  // Compute dynamic Date & Time Range for top info display (e.g. 13-12-2023 14:15:00 - 19-12-2023 11:45:00)
  const dateRangeStr = useMemo(() => {
    if (!candles || candles.length === 0) return '';
    const first = candles[0];
    const last = candles[candles.length - 1];
    const fmt = (t: number) => {
      const d = new Date(t * 1000);
      const pad = (n: number) => String(n).padStart(2, '0');
      return `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    };
    return `${fmt(first.time)} - ${fmt(last.time)}`;
  }, [candles]);

  // Compute structural Market Profile levels (PPOC, Poor High/Low, AB Poor High/Low, Double Mech Ref Bot, Weekly High/Low, G2/G3 Balance, HVN)
  const structuralLevels = useMemo(() => {
    if (dayProfiles.length === 0) {
      return {
        ppocs: [],
        poorHighs: [],
        poorLows: [],
        abPoorHighs: [],
        abPoorLows: [],
        doubleMechBots: [],
        weeklyHigh: null,
        weeklyLow: null,
        g2High: null,
        g2Low: null,
        g3High: null,
        g3Low: null,
        hvns: [],
        lvns: []
      };
    }

    let maxHigh = -Infinity;
    let minLow = Infinity;
    dayProfiles.forEach(p => {
      if (p.dayHigh > maxHigh) maxHigh = p.dayHigh;
      if (p.dayLow < minLow) minLow = p.dayLow;
    });

    // 1. PPOCs (Untested / Virgin POCs extending forward)
    const ppocs: { sIdx: number; price: number; testedInIdx: number | null }[] = [];
    dayProfiles.forEach((p, idx) => {
      let testedIdx: number | null = null;
      for (let fIdx = idx + 1; fIdx < dayProfiles.length; fIdx++) {
        const fut = dayProfiles[fIdx];
        if (p.pocPrice >= fut.dayLow && p.pocPrice <= fut.dayHigh) {
          testedIdx = fIdx;
          break;
        }
      }
      ppocs.push({ sIdx: idx, price: p.pocPrice, testedInIdx: testedIdx });
    });

    // 2. Poor Highs, Poor Lows, AB Poor Highs, AB Poor Lows
    const poorHighs: { sIdx: number; price: number }[] = [];
    const poorLows: { sIdx: number; price: number }[] = [];
    const abPoorHighs: { sIdx: number; price: number }[] = [];
    const abPoorLows: { sIdx: number; price: number }[] = [];

    dayProfiles.forEach((p, idx) => {
      if (p.bins.length > 0) {
        const sorted = [...p.bins].sort((a, b) => b.price - a.price);
        const topBin = sorted[0];
        const botBin = sorted[sorted.length - 1];

        // AB Poor High: High was formed in A or B period without single-print excess / flat top with >= 2 TPOs
        if (topBin && topBin.tpos.length >= 2) {
          const isAbHigh = topBin.tpos.some(t => t === 'A' || t === 'B');
          if (isAbHigh) {
            abPoorHighs.push({ sIdx: idx, price: topBin.price });
          } else {
            poorHighs.push({ sIdx: idx, price: topBin.price });
          }
        }

        // AB Poor Low: Low was formed in A or B period without single-print excess / flat bottom with >= 2 TPOs
        if (botBin && botBin.tpos.length >= 2) {
          const isAbLow = botBin.tpos.some(t => t === 'A' || t === 'B');
          if (isAbLow) {
            abPoorLows.push({ sIdx: idx, price: botBin.price });
          } else {
            poorLows.push({ sIdx: idx, price: botBin.price });
          }
        }
      }
    });

    // 3. Double Mech Ref Bottoms (Low matching adjacent session low within ~5 pts)
    const doubleMechBots: { sIdx: number; price: number }[] = [];
    for (let i = 0; i < dayProfiles.length - 1; i++) {
      const cur = dayProfiles[i];
      const nxt = dayProfiles[i + 1];
      const diff = Math.abs(cur.dayLow - nxt.dayLow);
      const threshold = cur.tickSize ? cur.tickSize * 3 : 5;
      if (diff <= threshold) {
        doubleMechBots.push({ sIdx: i, price: Math.min(cur.dayLow, nxt.dayLow) });
      }
    }

    // 4. G2 & G3 High and Low Balance levels
    let g2High: number | null = null;
    let g2Low: number | null = null;
    let g3High: number | null = null;
    let g3Low: number | null = null;

    if (dayProfiles.length >= 2) {
      const s1 = dayProfiles[dayProfiles.length - 1];
      const s2 = dayProfiles[dayProfiles.length - 2];
      g2High = Math.max(s1.dayHigh, s2.dayHigh);
      g2Low = Math.min(s1.dayLow, s2.dayLow);
    }
    if (dayProfiles.length >= 3) {
      const s1 = dayProfiles[dayProfiles.length - 1];
      const s2 = dayProfiles[dayProfiles.length - 2];
      const s3 = dayProfiles[dayProfiles.length - 3];
      g3High = Math.max(s1.dayHigh, s2.dayHigh, s3.dayHigh);
      g3Low = Math.min(s1.dayLow, s2.dayLow, s3.dayLow);
    }

    // 5. HVN (High Volume Node) & LVN (Low Volume Node) Lines:
    // Computed per session, tracked independently forward until first valid price test
    const hvns: { sIdx: number; price: number; volume: number; testedInIdx: number | null }[] = [];
    const lvns: { sIdx: number; price: number; volume: number; testedInIdx: number | null }[] = [];

    dayProfiles.forEach((p, sIdx) => {
      if (!p.bins || p.bins.length < 5) return;
      const sortedBins = [...p.bins].sort((a, b) => a.price - b.price);
      const totalVol = sortedBins.reduce((acc, b) => acc + b.volume, 0);
      const avgVol = totalVol / sortedBins.length;

      // Find local volume peaks (HVN)
      const candHvns: { price: number; volume: number }[] = [];
      for (let i = 1; i < sortedBins.length - 1; i++) {
        const cur = sortedBins[i];
        const prev = sortedBins[i - 1];
        const next = sortedBins[i + 1];
        if (cur.volume > prev.volume && cur.volume > next.volume && cur.volume >= avgVol * 1.3) {
          if (Math.abs(cur.price - p.pocPrice) >= (tpoStep * 1.5)) {
            candHvns.push({ price: cur.price, volume: cur.volume });
          }
        }
      }
      candHvns.sort((a, b) => b.volume - a.volume);
      const sessionTopHvns = candHvns.slice(0, 2);

      sessionTopHvns.forEach(node => {
        let testedIdx: number | null = null;
        for (let fIdx = sIdx + 1; fIdx < dayProfiles.length; fIdx++) {
          const fut = dayProfiles[fIdx];
          if (node.price >= fut.dayLow && node.price <= fut.dayHigh) {
            testedIdx = fIdx;
            break;
          }
        }
        hvns.push({ sIdx, price: node.price, volume: node.volume, testedInIdx: testedIdx });
      });

      // Find local volume valleys (LVN)
      const candLvns: { price: number; volume: number }[] = [];
      for (let i = 2; i < sortedBins.length - 2; i++) {
        const cur = sortedBins[i];
        const prev = sortedBins[i - 1];
        const next = sortedBins[i + 1];
        if (cur.volume < prev.volume && cur.volume < next.volume && cur.volume <= avgVol * 0.7 && cur.volume > 0) {
          if (Math.abs(cur.price - p.pocPrice) >= (tpoStep * 1.5)) {
            candLvns.push({ price: cur.price, volume: cur.volume });
          }
        }
      }
      candLvns.sort((a, b) => a.volume - b.volume);
      const sessionTopLvns = candLvns.slice(0, 2);

      sessionTopLvns.forEach(node => {
        let testedIdx: number | null = null;
        for (let fIdx = sIdx + 1; fIdx < dayProfiles.length; fIdx++) {
          const fut = dayProfiles[fIdx];
          if (node.price >= fut.dayLow && node.price <= fut.dayHigh) {
            testedIdx = fIdx;
            break;
          }
        }
        lvns.push({ sIdx, price: node.price, volume: node.volume, testedInIdx: testedIdx });
      });
    });

    return {
      ppocs,
      poorHighs,
      poorLows,
      abPoorHighs,
      abPoorLows,
      doubleMechBots,
      weeklyHigh: maxHigh > -Infinity ? maxHigh : null,
      weeklyLow: minLow < Infinity ? minLow : null,
      g2High,
      g2Low,
      g3High,
      g3Low,
      hvns,
      lvns
    };
  }, [dayProfiles, globalVolumeProfile, tpoStep]);

  // Calculate Single Print Zones and track traversal / clearance across subsequent market action
  const singlePrintZones = useMemo(() => {
    return calculateSinglePrintZones(dayProfiles, liveLtp);
  }, [dayProfiles, liveLtp]);

  // Handle Resize
  useEffect(() => {
    const handleResize = () => {
      if (canvasContainerRef.current) {
        const clientH = canvasContainerRef.current.clientHeight;
        const targetH = isExpanded || isStandalone
          ? Math.max(650, window.innerHeight - 65)
          : Math.max(600, clientH || 680);
        setDimensions({
          width: canvasContainerRef.current.clientWidth,
          height: targetH
        });
      }
    };
    window.addEventListener('resize', handleResize);
    handleResize();
    const timer = setTimeout(handleResize, 100);
    return () => {
      window.removeEventListener('resize', handleResize);
      clearTimeout(timer);
    };
  }, [isExpanded, isStandalone]);

  // Main Canvas Renderer
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || dayProfiles.length === 0 || dimensions.width === 0) return;

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

    // Pitch Black Background matching NinjaTrader reference screenshot
    const bgColor = isDark ? '#000000' : '#ffffff';
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, width, height);

    const padding = { top: 35, bottom: 45, left: viewMode === 'GV' ? 100 : 20, right: 75 };
    const baseChartWidth = width - padding.left - padding.right;
    const baseChartHeight = height - padding.top - padding.bottom;

    // 1. Calculate Session Column Sizing (Each session gets full breathing room: 180px - 260px)
    const sessionCount = dayProfiles.length;
    const baseColWidth = Math.max(180, Math.min(260, baseChartWidth / 5.2));
    const colWidth = baseColWidth * zoomLevel * xScale;
    const colGap = Math.max(8, 14 * zoomLevel * xScale);

    // 2. Identify Visible Sessions currently in the canvas viewport (or fallback to recent sessions)
    const visibleProfiles = dayProfiles.filter((p, sIdx) => {
      const colStartX = padding.left + panOffset.x + sIdx * (colWidth + colGap);
      const colEndX = colStartX + colWidth;
      return colEndX >= padding.left - 50 && colStartX <= width - padding.right + 50;
    });
    const activeProfiles = visibleProfiles.length > 0 ? visibleProfiles : dayProfiles.slice(-5);

    // 3. Compute Price Bounds from Active/Visible Sessions so profiles fill the chart height
    let globalMin = Infinity;
    let globalMax = -Infinity;
    activeProfiles.forEach(p => {
      if (p.dayLow < globalMin) globalMin = p.dayLow;
      if (p.dayHigh > globalMax) globalMax = p.dayHigh;
    });

    if (globalMin === Infinity || globalMax === -Infinity || globalMin >= globalMax) return;

    const pMargin = Math.max(15, (globalMax - globalMin) * 0.08);
    const rawMin = globalMin - pMargin;
    const rawMax = globalMax + pMargin;
    const rawRange = rawMax - rawMin;

    const centerPrice = (rawMax + rawMin) / 2 - (panOffset.y / baseChartHeight) * rawRange;
    const visibleRange = rawRange / (zoomLevel * yScale);

    const minPrice = centerPrice - visibleRange / 2;
    const maxPrice = centerPrice + visibleRange / 2;
    const priceRange = maxPrice - minPrice;

    const getPriceY = (price: number) => {
      return padding.top + ((maxPrice - price) / priceRange) * baseChartHeight;
    };

    // 4. Draw Subtle Horizontal Dotted Grid Lines & Clean Right Price Scale
    const targetTicks = Math.max(8, Math.min(18, Math.floor(baseChartHeight / 36)));
    const rawStep = priceRange / targetTicks;
    const niceSteps = [0.5, 1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000];
    const step = gridStep > 0 ? gridStep : (niceSteps.find(s => s >= rawStep) || (Math.ceil(rawStep / 50) * 50));

    const startTick = Math.floor(minPrice / step) * step;
    const endTick = Math.ceil(maxPrice / step) * step;

    ctx.font = '10px "JetBrains Mono", monospace';
    ctx.textAlign = 'left';

    for (let priceTick = startTick; priceTick <= endTick; priceTick += step) {
      const y = getPriceY(priceTick);
      if (y >= padding.top && y <= height - padding.bottom) {
        ctx.strokeStyle = isDark ? 'rgba(255, 255, 255, 0.07)' : 'rgba(0, 0, 0, 0.08)';
        ctx.lineWidth = 1;
        ctx.setLineDash([2, 4]);
        ctx.beginPath();
        ctx.moveTo(padding.left, y);
        ctx.lineTo(width - padding.right, y);
        ctx.stroke();
        ctx.setLineDash([]);

        // Small tick mark on right axis ruler
        ctx.strokeStyle = isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.2)';
        ctx.beginPath();
        ctx.moveTo(width - padding.right, y);
        ctx.lineTo(width - padding.right + 4, y);
        ctx.stroke();

        // Right Price Scale Label
        ctx.fillStyle = isDark ? '#d1d5db' : '#475569';
        if (typeof priceTick === 'number' && !isNaN(priceTick)) {
          ctx.fillText(priceTick.toFixed(1), width - padding.right + 7, y + 3.5);
        }
      }
    }

    // 5. Draw Left Edge Composite Volume Profile Histogram ONLY if viewMode === 'GV'
    if (viewMode === 'GV') {
      const leftHistWidth = 80;
      const maxVol = globalVolumeProfile.maxVolume || 1;

      ctx.strokeStyle = isDark ? '#383838' : '#e2e8f0';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(leftHistWidth + 15, padding.top);
      ctx.lineTo(leftHistWidth + 15, height - padding.bottom);
      ctx.stroke();

      globalVolumeProfile.bins.forEach(bin => {
        const binY = getPriceY(bin.price);
        if (binY >= padding.top && binY <= height - padding.bottom) {
          const barW = (bin.volume / maxVol) * leftHistWidth;
          ctx.fillStyle = 'rgba(212, 175, 55, 0.65)';
          ctx.fillRect(10, binY - 1, barW, 2);
        }
      });
    }

    ctx.save();
    ctx.beginPath();
    ctx.rect(padding.left, padding.top, baseChartWidth, baseChartHeight);
    ctx.clip();

    dayProfiles.forEach((profile, sIdx) => {
      const colStartX = padding.left + panOffset.x + sIdx * (colWidth + colGap);
      const colEndX = colStartX + colWidth;

      if (colEndX < padding.left || colStartX > width - padding.right) return;

      // Bottom Date Label (e.g. 30 Sep, 1 Oct, 5 Oct, 6 Oct...)
      const dateShort = formatDateShort(profile.dateStr);
      ctx.fillStyle = '#9ca3af';
      ctx.font = '10px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(dateShort, colStartX + colWidth / 2, height - padding.bottom + 16);

      const bins = profile.bins;
      if (bins.length === 0) return;

      const binStep = bins.length > 1 ? Math.abs(bins[0].price - bins[1].price) : profile.tickSize;
      const rawRowHeight = (binStep / priceRange) * baseChartHeight;
      const rowHeight = Math.max(2.5, rawRowHeight);

      const baseBlockSize = Math.max(2, Math.min(18, rowHeight - 0.5));
      const showLetters = baseBlockSize >= 7 && viewMode !== 'V';
      const blockGap = showLetters ? 1 : 0.5;

      const maxSessionVol = Math.max(...bins.map(b => b.volume), 1);
      const tpoSubW = viewMode === 'T' ? colWidth : Math.max(28, colWidth * 0.44);
      const volSubW = colWidth - tpoSubW;
      const isUpDay = profile.closePrice >= profile.openPrice;

      // Render Bins (TPO Letters on left, Volume Profile Bars on right matching screenshot)
      bins.forEach(bin => {
        const binY = getPriceY(bin.price) - rowHeight / 2;
        if (binY < padding.top - rowHeight || binY > height - padding.bottom) return;

        const isPoc = bin.price === profile.pocPrice;
        const inValueArea = bin.price >= profile.valPrice && bin.price <= profile.vahPrice;

        if (viewMode === 'V') {
          // Pure Volume Bar Mode
          const barW = (bin.volume / maxSessionVol) * (colWidth - 6);
          const barColor = inValueArea ? (isUpDay ? '#ef4444' : '#2563eb') : '#71717a';
          ctx.fillStyle = barColor;
          ctx.fillRect(colStartX, binY + 0.5, Math.max(2, barW), Math.max(1, rowHeight - 1));
        } else {
          // T-V Mode (Default): TPO Letters on left, Volume Profile Bars on right
          if (bin.tpos.length > 0) {
            bin.tpos.forEach((letter, colIdx) => {
              const x = colStartX + colIdx * (baseBlockSize + blockGap);
              if (x + baseBlockSize <= colStartX + tpoSubW) {
                // Highlight Single Prints
                if (highlightSinglePrints && bin.tpos.length === 1 && bin.price !== profile.dayHigh && bin.price !== profile.dayLow && colIdx === 0) {
                  ctx.fillStyle = 'rgba(245, 158, 11, 0.25)';
                  ctx.fillRect(x - 1, binY + (rowHeight - baseBlockSize) / 2 - 1, baseBlockSize + 2, baseBlockSize + 2);
                }

                ctx.fillStyle = getLetterColor(letter);
                if (showLetters) {
                  ctx.font = `bold ${Math.max(7, Math.floor(baseBlockSize * 0.75))}px "JetBrains Mono", monospace`;
                  ctx.textAlign = 'center';
                  ctx.fillText(letter, x + baseBlockSize / 2, binY + rowHeight / 2 + (baseBlockSize * 0.28));
                } else {
                  ctx.fillRect(x, binY + (rowHeight - baseBlockSize) / 2, baseBlockSize, baseBlockSize);
                }

                // Highlight Boxes matching screenshot [F], [A], [M]
                const isSessionHigh = bin.price === profile.dayHigh && colIdx === 0;
                const isSessionLow = bin.price === profile.dayLow && colIdx === 0;
                const isIbHigh = bin.price === profile.ibHigh && colIdx === 0;
                const isIbLow = bin.price === profile.ibLow && colIdx === 0;

                if (isSessionHigh || isSessionLow || isIbHigh || isIbLow) {
                  ctx.strokeStyle = '#ffffff';
                  ctx.lineWidth = 1;
                  ctx.strokeRect(x - 1, binY + (rowHeight - baseBlockSize) / 2 - 1, baseBlockSize + 2, baseBlockSize + 2);
                }
              }
            });

            // If POC row, highlight with red box around the letters in the TPO column
            if (isPoc && bin.tpos.length > 0) {
              const pocLettersCount = Math.min(bin.tpos.length, Math.floor((tpoSubW - 4) / (baseBlockSize + blockGap)));
              const pocBoxW = Math.max(baseBlockSize + 2, pocLettersCount * (baseBlockSize + blockGap));
              ctx.strokeStyle = '#ef4444';
              ctx.lineWidth = 1;
              ctx.strokeRect(colStartX - 1, binY + (rowHeight - baseBlockSize) / 2 - 1, pocBoxW + 2, baseBlockSize + 2);
            }
          }

          // Volume Histogram Bar on Right Side of Letters
          if (viewMode !== 'T') {
            const barStartX = colStartX + tpoSubW;
            const barW = (bin.volume / maxSessionVol) * (volSubW - 6);

            // Red on Up days, Blue on Down days inside Value Area; Grey for tails/excess outside Value Area
            const barColor = inValueArea ? (isUpDay ? '#ef4444' : '#2563eb') : '#71717a';
            ctx.fillStyle = barColor;
            ctx.fillRect(barStartX, binY + 0.5, Math.max(2, barW), Math.max(1, rowHeight - 1));
          }
        }
      });

      // Session Open Marker: Prominent Orange Circle as seen in screenshot
      if (profile.openPrice) {
        const openY = getPriceY(profile.openPrice);
        if (openY >= padding.top && openY <= height - padding.bottom) {
          ctx.fillStyle = '#f97316'; // Vibrant orange
          ctx.beginPath();
          ctx.arc(colStartX + 4, openY, 3.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = 'rgba(0, 0, 0, 0.6)';
          ctx.lineWidth = 0.8;
          ctx.stroke();
        }
      }

      // Initial Balance (IB) Vertical Bracket Line
      if (showIbLine && profile.ibHigh && profile.ibLow) {
        const ibYTop = getPriceY(profile.ibHigh);
        const ibYBottom = getPriceY(profile.ibLow);
        if (ibYTop < height - padding.bottom && ibYBottom > padding.top) {
          const drawTop = Math.max(padding.top, ibYTop);
          const drawBottom = Math.min(height - padding.bottom, ibYBottom);
          const ibX = colStartX - 4;

          ctx.strokeStyle = '#c084fc';
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.moveTo(ibX, drawTop);
          ctx.lineTo(ibX, drawBottom);
          ctx.stroke();

          // Top bracket tick
          ctx.beginPath();
          ctx.moveTo(ibX - 3, drawTop);
          ctx.lineTo(ibX + 3, drawTop);
          ctx.stroke();

          // Bottom bracket tick
          ctx.beginPath();
          ctx.moveTo(ibX - 3, drawBottom);
          ctx.lineTo(ibX + 3, drawBottom);
          ctx.stroke();
        }
      }

      // Key Session Reference Lines matching screenshot:
      // 1. VAH (Thin crisp White line across session)
      if (profile.vahPrice) {
        const vahY = getPriceY(profile.vahPrice);
        if (vahY >= padding.top && vahY <= height - padding.bottom) {
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.moveTo(colStartX, vahY);
          ctx.lineTo(colStartX + colWidth, vahY);
          ctx.stroke();
        }
      }

      // 2. VAL (Thin crisp White line across session)
      if (profile.valPrice) {
        const valY = getPriceY(profile.valPrice);
        if (valY >= padding.top && valY <= height - padding.bottom) {
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.moveTo(colStartX, valY);
          ctx.lineTo(colStartX + colWidth, valY);
          ctx.stroke();
        }
      }

      // 3. POC (Thin crisp Yellow line across session + Dotted extension forward)
      if (profile.pocPrice) {
        const pocY = getPriceY(profile.pocPrice);
        if (pocY >= padding.top && pocY <= height - padding.bottom) {
          // Historical level visible within its session
          ctx.strokeStyle = '#facc15';
          ctx.lineWidth = 1.6;
          ctx.beginPath();
          ctx.moveTo(colStartX, pocY);
          ctx.lineTo(colStartX + colWidth, pocY);
          ctx.stroke();

          // Tested POC logic:
          // Once price tests a POC, stop extending that POC level.
          // Keep the historical level visible without extending it further past the first valid test.
          let testedIdx: number | null = null;
          for (let fIdx = sIdx + 1; fIdx < dayProfiles.length; fIdx++) {
            const fut = dayProfiles[fIdx];
            if (profile.pocPrice >= fut.dayLow && profile.pocPrice <= fut.dayHigh) {
              testedIdx = fIdx;
              break;
            }
          }

          if (testedIdx !== null) {
            // Tested POC: Extend only until the first valid test touch point, then stop immediately
            const futX = padding.left + panOffset.x + testedIdx * (colWidth + colGap) + colWidth * 0.35;
            const endX = Math.max(colStartX + colWidth, futX);
            ctx.strokeStyle = 'rgba(250, 204, 21, 0.45)';
            ctx.lineWidth = 1.0;
            ctx.setLineDash([2, 2]);
            ctx.beginPath();
            ctx.moveTo(colStartX + colWidth, pocY);
            ctx.lineTo(endX, pocY);
            ctx.stroke();
            ctx.setLineDash([]);
            // Small test touch marker dot
            ctx.fillStyle = 'rgba(250, 204, 21, 0.65)';
            ctx.beginPath();
            ctx.arc(endX, pocY, 2, 0, Math.PI * 2);
            ctx.fill();
          } else {
            // Untested / Virgin POC: extends forward to the current price axis
            const endX = width - padding.right;
            if (endX > colStartX + colWidth) {
              ctx.strokeStyle = '#facc15';
              ctx.lineWidth = 1.3;
              ctx.setLineDash([4, 4]);
              ctx.beginPath();
              ctx.moveTo(colStartX + colWidth, pocY);
              ctx.lineTo(endX, pocY);
              ctx.stroke();
              ctx.setLineDash([]);

              ctx.fillStyle = '#facc15';
              ctx.font = 'bold 9px "JetBrains Mono", monospace';
              ctx.textAlign = 'right';
              ctx.fillText(`nPOC: ₹${profile.pocPrice.toFixed(1)}`, width - padding.right - 8, pocY - 3);
            }
          }
        }
      }

      // 5. Poor High / Low & AB Poor High / Low Markers
      if (showPoorHighLow) {
        // AB Poor High (priority) or Standard Poor High
        const abPoorHigh = structuralLevels.abPoorHighs.find(p => p.sIdx === sIdx);
        const poorHigh = structuralLevels.poorHighs.find(p => p.sIdx === sIdx);
        if (abPoorHigh) {
          const phY = getPriceY(abPoorHigh.price);
          if (phY >= padding.top && phY <= height - padding.bottom) {
            ctx.fillStyle = '#ef4444';
            ctx.font = 'bold 9px "JetBrains Mono", monospace';
            ctx.textAlign = 'center';
            ctx.fillText('⚠️ AB Poor High', colStartX + colWidth / 2, phY - 6);
          }
        } else if (poorHigh) {
          const phY = getPriceY(poorHigh.price);
          if (phY >= padding.top && phY <= height - padding.bottom) {
            ctx.fillStyle = '#f87171';
            ctx.font = 'bold 9px "JetBrains Mono", monospace';
            ctx.textAlign = 'center';
            ctx.fillText('⚠️ Poor H', colStartX + colWidth / 2, phY - 6);
          }
        }

        // AB Poor Low (priority) or Standard Poor Low
        const abPoorLow = structuralLevels.abPoorLows.find(p => p.sIdx === sIdx);
        const poorLow = structuralLevels.poorLows.find(p => p.sIdx === sIdx);
        if (abPoorLow) {
          const plY = getPriceY(abPoorLow.price);
          if (plY >= padding.top && plY <= height - padding.bottom) {
            ctx.fillStyle = '#10b981';
            ctx.font = 'bold 9px "JetBrains Mono", monospace';
            ctx.textAlign = 'center';
            ctx.fillText('⚠️ AB Poor Low', colStartX + colWidth / 2, plY + 14);
          }
        } else if (poorLow) {
          const plY = getPriceY(poorLow.price);
          if (plY >= padding.top && plY <= height - padding.bottom) {
            ctx.fillStyle = '#f87171';
            ctx.font = 'bold 9px "JetBrains Mono", monospace';
            ctx.textAlign = 'center';
            ctx.fillText('⚠️ Poor L', colStartX + colWidth / 2, plY + 14);
          }
        }
      }
    });

    // 8. Weekly High & Weekly LOW Lines across lookback
    if (showWeeklyLevels) {
      if (structuralLevels.weeklyHigh) {
        const whY = getPriceY(structuralLevels.weeklyHigh);
        if (whY >= padding.top && whY <= height - padding.bottom) {
          ctx.strokeStyle = '#10b981';
          ctx.lineWidth = 1.5;
          ctx.setLineDash([8, 4, 2, 4]);
          ctx.beginPath();
          ctx.moveTo(padding.left, whY);
          ctx.lineTo(width - padding.right, whY);
          ctx.stroke();
          ctx.setLineDash([]);

          ctx.fillStyle = '#10b981';
          ctx.font = 'bold 9.5px "JetBrains Mono", monospace';
          ctx.textAlign = 'left';
          ctx.fillText(`Weekly High: ₹${structuralLevels.weeklyHigh.toFixed(1)}`, padding.left + 8, whY - 4);
        }
      }

      if (structuralLevels.weeklyLow) {
        const wlY = getPriceY(structuralLevels.weeklyLow);
        if (wlY >= padding.top && wlY <= height - padding.bottom) {
          ctx.strokeStyle = '#ef4444';
          ctx.lineWidth = 1.5;
          ctx.setLineDash([8, 4, 2, 4]);
          ctx.beginPath();
          ctx.moveTo(padding.left, wlY);
          ctx.lineTo(width - padding.right, wlY);
          ctx.stroke();
          ctx.setLineDash([]);

          ctx.fillStyle = '#ef4444';
          ctx.font = 'bold 9.5px "JetBrains Mono", monospace';
          ctx.textAlign = 'left';
          ctx.fillText(`Weekly Low: ₹${structuralLevels.weeklyLow.toFixed(1)}`, padding.left + 8, wlY + 12);
        }
      }
    }

    // 9. G2 & G3 High / Low Balance Lines
    if (showG2G3) {
      if (structuralLevels.g2High) {
        const g2Hy = getPriceY(structuralLevels.g2High);
        if (g2Hy >= padding.top && g2Hy <= height - padding.bottom) {
          ctx.strokeStyle = '#06b6d4';
          ctx.lineWidth = 1.2;
          ctx.setLineDash([6, 3]);
          ctx.beginPath();
          ctx.moveTo(padding.left, g2Hy);
          ctx.lineTo(width - padding.right, g2Hy);
          ctx.stroke();
          ctx.setLineDash([]);

          ctx.fillStyle = '#06b6d4';
          ctx.font = 'bold 9px "JetBrains Mono", monospace';
          ctx.textAlign = 'left';
          ctx.fillText(`G2 High (2D): ₹${structuralLevels.g2High.toFixed(1)}`, padding.left + 140, g2Hy - 4);
        }
      }
      if (structuralLevels.g2Low) {
        const g2Ly = getPriceY(structuralLevels.g2Low);
        if (g2Ly >= padding.top && g2Ly <= height - padding.bottom) {
          ctx.strokeStyle = '#06b6d4';
          ctx.lineWidth = 1.2;
          ctx.setLineDash([6, 3]);
          ctx.beginPath();
          ctx.moveTo(padding.left, g2Ly);
          ctx.lineTo(width - padding.right, g2Ly);
          ctx.stroke();
          ctx.setLineDash([]);

          ctx.fillStyle = '#06b6d4';
          ctx.font = 'bold 9px "JetBrains Mono", monospace';
          ctx.textAlign = 'left';
          ctx.fillText(`G2 Low (2D): ₹${structuralLevels.g2Low.toFixed(1)}`, padding.left + 140, g2Ly + 12);
        }
      }

      if (structuralLevels.g3High) {
        const g3Hy = getPriceY(structuralLevels.g3High);
        if (g3Hy >= padding.top && g3Hy <= height - padding.bottom) {
          ctx.strokeStyle = '#ec4899';
          ctx.lineWidth = 1.2;
          ctx.setLineDash([4, 4]);
          ctx.beginPath();
          ctx.moveTo(padding.left, g3Hy);
          ctx.lineTo(width - padding.right, g3Hy);
          ctx.stroke();
          ctx.setLineDash([]);

          ctx.fillStyle = '#ec4899';
          ctx.font = 'bold 9px "JetBrains Mono", monospace';
          ctx.textAlign = 'left';
          ctx.fillText(`G3 High (3D): ₹${structuralLevels.g3High.toFixed(1)}`, padding.left + 270, g3Hy - 4);
        }
      }
      if (structuralLevels.g3Low) {
        const g3Ly = getPriceY(structuralLevels.g3Low);
        if (g3Ly >= padding.top && g3Ly <= height - padding.bottom) {
          ctx.strokeStyle = '#ec4899';
          ctx.lineWidth = 1.2;
          ctx.setLineDash([4, 4]);
          ctx.beginPath();
          ctx.moveTo(padding.left, g3Ly);
          ctx.lineTo(width - padding.right, g3Ly);
          ctx.stroke();
          ctx.setLineDash([]);

          ctx.fillStyle = '#ec4899';
          ctx.font = 'bold 9px "JetBrains Mono", monospace';
          ctx.textAlign = 'left';
          ctx.fillText(`G3 Low (3D): ₹${structuralLevels.g3Low.toFixed(1)}`, padding.left + 270, g3Ly + 12);
        }
      }
    }

    // 10. HVN (High Volume Node) Lines - Extended until tested
    if (showHvn && structuralLevels.hvns && structuralLevels.hvns.length > 0) {
      structuralLevels.hvns.forEach((hvn) => {
        const hvnY = getPriceY(hvn.price);
        if (hvnY < padding.top || hvnY > height - padding.bottom) return;

        const startX = padding.left + panOffset.x + hvn.sIdx * (colWidth + colGap) + colWidth;
        if (hvn.testedInIdx !== null) {
          // Stop extending each level immediately after its first valid test
          const futX = padding.left + panOffset.x + hvn.testedInIdx * (colWidth + colGap) + colWidth * 0.35;
          const endX = Math.max(startX, futX);
          ctx.strokeStyle = 'rgba(56, 189, 248, 0.4)';
          ctx.lineWidth = 1.0;
          ctx.setLineDash([3, 3]);
          ctx.beginPath();
          ctx.moveTo(startX, hvnY);
          ctx.lineTo(endX, hvnY);
          ctx.stroke();
          ctx.setLineDash([]);

          ctx.fillStyle = 'rgba(56, 189, 248, 0.6)';
          ctx.beginPath();
          ctx.arc(endX, hvnY, 2, 0, Math.PI * 2);
          ctx.fill();
        } else {
          // Untested HVN: extends to the right price axis
          const endX = width - padding.right;
          if (endX > startX) {
            ctx.strokeStyle = '#38bdf8';
            ctx.lineWidth = 1.2;
            ctx.setLineDash([5, 3]);
            ctx.beginPath();
            ctx.moveTo(startX, hvnY);
            ctx.lineTo(endX, hvnY);
            ctx.stroke();
            ctx.setLineDash([]);

            ctx.fillStyle = '#38bdf8';
            ctx.font = 'bold 9px "JetBrains Mono", monospace';
            ctx.textAlign = 'right';
            ctx.fillText(`HVN: ₹${hvn.price.toFixed(1)}`, width - padding.right - 8, hvnY - 3);
          }
        }
      });
    }

    // 10b. LVN (Low Volume Node) Lines - Extended until tested
    if (showLvn && structuralLevels.lvns && structuralLevels.lvns.length > 0) {
      structuralLevels.lvns.forEach((lvn) => {
        const lvnY = getPriceY(lvn.price);
        if (lvnY < padding.top || lvnY > height - padding.bottom) return;

        const startX = padding.left + panOffset.x + lvn.sIdx * (colWidth + colGap) + colWidth;
        if (lvn.testedInIdx !== null) {
          // Stop extending each level immediately after its first valid test
          const futX = padding.left + panOffset.x + lvn.testedInIdx * (colWidth + colGap) + colWidth * 0.35;
          const endX = Math.max(startX, futX);
          ctx.strokeStyle = 'rgba(249, 115, 22, 0.4)';
          ctx.lineWidth = 1.0;
          ctx.setLineDash([3, 3]);
          ctx.beginPath();
          ctx.moveTo(startX, lvnY);
          ctx.lineTo(endX, lvnY);
          ctx.stroke();
          ctx.setLineDash([]);

          ctx.fillStyle = 'rgba(249, 115, 22, 0.6)';
          ctx.beginPath();
          ctx.arc(endX, lvnY, 2, 0, Math.PI * 2);
          ctx.fill();
        } else {
          // Untested LVN: extends to the right price axis
          const endX = width - padding.right;
          if (endX > startX) {
            ctx.strokeStyle = '#f97316';
            ctx.lineWidth = 1.2;
            ctx.setLineDash([5, 3]);
            ctx.beginPath();
            ctx.moveTo(startX, lvnY);
            ctx.lineTo(endX, lvnY);
            ctx.stroke();
            ctx.setLineDash([]);

            ctx.fillStyle = '#f97316';
            ctx.font = 'bold 9px "JetBrains Mono", monospace';
            ctx.textAlign = 'right';
            ctx.fillText(`LVN: ₹${lvn.price.toFixed(1)}`, width - padding.right - 8, lvnY - 3);
          }
        }
      });
    }

    // 11. UNCLEARED SINGLE PRINT ZONES (Market Profile Imbalance Zones)
    if (highlightSinglePrints && singlePrintZones.length > 0) {
      singlePrintZones.forEach(zone => {
        // Automatically remove cleared zones: only display uncleared or partially tested zones
        if (zone.isCleared) return;

        const colStartX = padding.left + panOffset.x + zone.sessionIdx * (colWidth + colGap);
        const lineStartX = colStartX;
        const lineEndX = width - padding.right;

        // Skip if offscreen horizontally
        if (lineEndX < padding.left || lineStartX > width - padding.right) return;

        const yTop = getPriceY(zone.highPrice);
        const yBottom = getPriceY(zone.lowPrice);
        const zoneY = Math.min(yTop, yBottom);
        const zoneH = Math.max(3, Math.abs(yBottom - yTop));

        // Skip if offscreen vertically
        if (zoneY + zoneH < padding.top || zoneY > height - padding.bottom) return;

        // 1. Semi-transparent Amber Zone Fill
        ctx.fillStyle = zone.isPartiallyTested ? 'rgba(245, 158, 11, 0.12)' : 'rgba(245, 158, 11, 0.20)';
        ctx.fillRect(lineStartX, zoneY, lineEndX - lineStartX, zoneH);

        // 2. Label Badge on Origin Column
        if (lineStartX >= padding.left - 40 && lineStartX <= width - padding.right) {
          const badgeText = zone.isPartiallyTested
            ? `⚡ SP Zone (Tested) [${zone.lowPrice.toFixed(1)} - ${zone.highPrice.toFixed(1)}]`
            : `⚡ SP Zone [${zone.lowPrice.toFixed(1)} - ${zone.highPrice.toFixed(1)}]`;
          ctx.font = 'bold 9px "JetBrains Mono", monospace';
          const textWidth = ctx.measureText(badgeText).width;
          const badgeX = lineStartX + 4;
          const badgeY = zoneH >= 16 
            ? zoneY + zoneH / 2 + 3 
            : Math.max(padding.top + 10, zoneY - 4);

          ctx.fillStyle = isDark ? 'rgba(15, 23, 42, 0.88)' : 'rgba(255, 255, 255, 0.92)';
          ctx.fillRect(badgeX, badgeY - 9, textWidth + 8, 12);
          ctx.strokeStyle = 'rgba(245, 158, 11, 0.6)';
          ctx.lineWidth = 0.8;
          ctx.strokeRect(badgeX, badgeY - 9, textWidth + 8, 12);

          ctx.fillStyle = '#fbbf24';
          ctx.textAlign = 'left';
          ctx.fillText(badgeText, badgeX + 4, badgeY);
        }
      });
    }

    ctx.restore();

    // 6. DRAW X-AXIS DATE/TIME RULER & Y-AXIS PRICE SCALE RULER LINES
    const rulerY = height - padding.bottom;
    const rulerX = width - padding.right;

    // Visual feedback when hovering or dragging on axes
    const isYActive = hoveredAxis === 'y-axis' || dragMode === 'y-axis';
    const isXActive = hoveredAxis === 'x-axis' || dragMode === 'x-axis';

    if (isYActive) {
      ctx.fillStyle = 'rgba(56, 189, 248, 0.08)';
      ctx.fillRect(rulerX, padding.top, padding.right, rulerY - padding.top);
    }
    if (isXActive) {
      ctx.fillStyle = 'rgba(56, 189, 248, 0.08)';
      ctx.fillRect(padding.left, rulerY, rulerX - padding.left, padding.bottom);
    }

    ctx.strokeStyle = isXActive ? '#38bdf8' : (isDark ? '#262626' : '#cbd5e1');
    ctx.lineWidth = 1;

    // X-Axis Horizontal Ruler Line
    ctx.beginPath();
    ctx.moveTo(padding.left, rulerY);
    ctx.lineTo(rulerX, rulerY);
    ctx.stroke();

    // Y-Axis Vertical Ruler Line
    ctx.strokeStyle = isYActive ? '#38bdf8' : (isDark ? '#262626' : '#cbd5e1');
    ctx.beginPath();
    ctx.moveTo(rulerX, padding.top);
    ctx.lineTo(rulerX, rulerY);
    ctx.stroke();

    // Bottom-Right Countdown Bar Timer
    ctx.save();
    const minutes = Math.floor(barRemainingSeconds / 60);
    const seconds = barRemainingSeconds % 60;
    const formattedRemaining = `00:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '11px "JetBrains Mono", monospace';
    ctx.textAlign = 'right';
    ctx.fillText(`Time remaining = ${formattedRemaining}`, width - padding.right - 10, height - padding.bottom + 26);
    ctx.restore();

    // Live Current Price (LTP) Marker on Right Y-Axis (matching screenshot)
    if (typeof liveLtp === 'number' && !isNaN(liveLtp)) {
      const ltpY = getPriceY(liveLtp);
      if (ltpY >= padding.top && ltpY <= rulerY) {
        ctx.save();
        const ltpText = liveLtp.toFixed(2);
        ctx.font = 'bold 10px "JetBrains Mono", monospace';
        const metrics = ctx.measureText(ltpText);
        const badgeW = metrics.width + 12;
        const badgeH = 18;
        const badgeX = rulerX + 3;

        // Dark box with white border
        ctx.fillStyle = '#000000';
        ctx.fillRect(badgeX, ltpY - badgeH / 2, badgeW, badgeH);
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(badgeX, ltpY - badgeH / 2, badgeW, badgeH);

        // Bold white text
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.fillText(ltpText, badgeX + badgeW / 2, ltpY + 3.5);
        ctx.restore();
      }
    }

    // 7. DRAW INTERACTIVE CROSSHAIR & PRICE/DATE RULER BADGES
    if (crosshairPos && crosshairPos.x >= padding.left && crosshairPos.x <= rulerX && crosshairPos.y >= padding.top && crosshairPos.y <= rulerY) {
      ctx.save();

      // Crosshair Vertical & Horizontal Cyan Lines
      ctx.strokeStyle = '#00f0ff';
      ctx.lineWidth = 1.0;
      ctx.setLineDash([4, 4]);

      // Vertical Line
      ctx.beginPath();
      ctx.moveTo(crosshairPos.x, padding.top);
      ctx.lineTo(crosshairPos.x, rulerY);
      ctx.stroke();

      // Horizontal Line
      ctx.beginPath();
      ctx.moveTo(padding.left, crosshairPos.y);
      ctx.lineTo(rulerX, crosshairPos.y);
      ctx.stroke();

      ctx.setLineDash([]);

      // Price Badge Tag on Right Y-Axis Scale
      const priceText = typeof crosshairPos?.price === 'number' && !isNaN(crosshairPos.price) ? crosshairPos.price.toFixed(2) : '';
      ctx.font = 'bold 10px "JetBrains Mono", monospace';
      const priceMetrics = ctx.measureText(priceText);
      const priceBadgeW = priceMetrics.width + 12;
      const priceBadgeH = 20;

      ctx.fillStyle = '#00f0ff';
      ctx.fillRect(rulerX, crosshairPos.y - priceBadgeH / 2, priceBadgeW, priceBadgeH);

      ctx.fillStyle = '#000000';
      ctx.textAlign = 'center';
      ctx.fillText(priceText, rulerX + priceBadgeW / 2, crosshairPos.y + 3.5);

      // Date/Time Badge Tag on Bottom X-Axis Scale
      if (crosshairPos.dateStr) {
        const dateText = crosshairPos.dateStr;
        ctx.font = 'bold 10px "Outfit", sans-serif';
        const dateMetrics = ctx.measureText(dateText);
        const dateBadgeW = dateMetrics.width + 14;
        const dateBadgeH = 20;
        const dateBadgeX = Math.max(padding.left + dateBadgeW / 2, Math.min(rulerX - dateBadgeW / 2, crosshairPos.x));

        ctx.fillStyle = '#00f0ff';
        ctx.fillRect(dateBadgeX - dateBadgeW / 2, rulerY, dateBadgeW, dateBadgeH);

        ctx.fillStyle = '#000000';
        ctx.textAlign = 'center';
        ctx.fillText(dateText, dateBadgeX, rulerY + 14);
      }

      ctx.restore();
    }

  }, [dayProfiles, dimensions, viewMode, zoomLevel, panOffset, tpoStep, gridStep, showIbLine, highlightSinglePrints, singlePrintZones, showPoorHighLow, showTwoDayBalance, showG2G3, showWeeklyLevels, showHvn, showLvn, globalVolumeProfile, structuralLevels, liveLtp, crosshairPos, isDark, yScale, xScale, hoveredAxis, dragMode, barRemainingSeconds]);

  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const padding = { top: 35, bottom: 45, left: 130, right: 75 };

    if (mouseX >= rect.width - padding.right) {
      setDragMode('y-axis');
      setDragStart({ x: e.clientX, y: e.clientY });
      setInitialYScale(yScale);
      setCursorStyle('ns-resize');
      return;
    }

    if (mouseY >= rect.height - padding.bottom) {
      setDragMode('x-axis');
      setDragStart({ x: e.clientX, y: e.clientY });
      setInitialXScale(xScale);
      setCursorStyle('ew-resize');
      return;
    }

    setDragMode('pan');
    setDragStart({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y });
    setCursorStyle('grabbing');
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || dayProfiles.length === 0) return;

    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const padding = { top: 35, bottom: 45, left: 130, right: 75 };
    const baseChartWidth = rect.width - padding.left - padding.right;
    const baseChartHeight = rect.height - padding.top - padding.bottom;

    if (dragMode === 'y-axis') {
      const deltaY = e.clientY - dragStart.y;
      const factor = Math.exp(-deltaY * 0.006);
      const newYScale = Math.min(10.0, Math.max(0.15, initialYScale * factor));
      setYScale(newYScale);
      setCursorStyle('ns-resize');
      return;
    }

    if (dragMode === 'x-axis') {
      const deltaX = e.clientX - dragStart.x;
      const factor = Math.exp(deltaX * 0.005);
      const newXScale = Math.min(10.0, Math.max(0.2, initialXScale * factor));
      setXScale(newXScale);
      setCursorStyle('ew-resize');
      return;
    }

    if (dragMode === 'pan') {
      setPanOffset({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
      setCursorStyle('grabbing');
      setCrosshairPos(null);
      return;
    }

    // Check if mouse is hovering over Price Axis (Y) or Time Axis (X)
    if (mouseX >= rect.width - padding.right) {
      setHoveredAxis('y-axis');
      setCursorStyle('ns-resize');
      setHoverInfo(null);
      setCrosshairPos(null);
      return;
    } else if (mouseY >= rect.height - padding.bottom) {
      setHoveredAxis('x-axis');
      setCursorStyle('ew-resize');
      setHoverInfo(null);
      setCrosshairPos(null);
      return;
    } else {
      setHoveredAxis('none');
      setCursorStyle('crosshair');
    }

    if (mouseY < padding.top || mouseX < padding.left) {
      setHoverInfo(null);
      setCrosshairPos(null);
      return;
    }

    const sessionCount = dayProfiles.length;
    const colGap = Math.max(4, 10 * zoomLevel * xScale);
    const availWidthForCols = baseChartWidth - (sessionCount - 1) * colGap;
    const colWidth = Math.max(25, (availWidthForCols / sessionCount) * zoomLevel * xScale);

    let hoveredSessionIdx = -1;
    for (let i = 0; i < sessionCount; i++) {
      const colStartX = padding.left + panOffset.x + i * (colWidth + colGap);
      if (mouseX >= colStartX && mouseX <= colStartX + colWidth) {
        hoveredSessionIdx = i;
        break;
      }
    }

    let globalMin = Infinity;
    let globalMax = -Infinity;
    dayProfiles.forEach(p => {
      if (p.dayLow < globalMin) globalMin = p.dayLow;
      if (p.dayHigh > globalMax) globalMax = p.dayHigh;
    });

    const pMargin = (globalMax - globalMin) * 0.03;
    const rawMin = globalMin - pMargin;
    const rawMax = globalMax + pMargin;
    const rawRange = rawMax - rawMin;

    const centerPrice = (rawMax + rawMin) / 2 - (panOffset.y / baseChartHeight) * rawRange;
    const visibleRange = rawRange / (zoomLevel * yScale);

    const minPrice = centerPrice - visibleRange / 2;
    const maxPrice = centerPrice + visibleRange / 2;
    const priceRange = maxPrice - minPrice;

    const clickPct = (mouseY - padding.top) / baseChartHeight;
    const hoveredPrice = maxPrice - clickPct * priceRange;

    const profile = hoveredSessionIdx !== -1 ? dayProfiles[hoveredSessionIdx] : null;

    setCrosshairPos({
      x: mouseX,
      y: mouseY,
      price: hoveredPrice,
      dateStr: profile ? profile.dateStr : (dayProfiles[0] ? dayProfiles[0].dateStr : undefined)
    });

    if (profile) {
      let closestBin: TPOBin | null = null;
      let minDiff = Infinity;
      profile.bins.forEach(b => {
        const diff = Math.abs(b.price - hoveredPrice);
        if (diff < minDiff) {
          minDiff = diff;
          closestBin = b;
        }
      });
      if (closestBin && !pinnedInfo) {
        const tooltipX = mouseX + 270 > rect.width ? Math.max(10, mouseX - 250) : mouseX + 15;
        const tooltipY = Math.max(10, Math.min(rect.height - 240, mouseY - 50));
        setHoverInfo({
          profile,
          bin: closestBin,
          x: tooltipX,
          y: tooltipY
        });
      }
    } else {
      if (!pinnedInfo) setHoverInfo(null);
    }
  };

  const handleCanvasMouseUp = (e?: React.MouseEvent<HTMLCanvasElement>) => {
    if (e && dragStart) {
      const dist = Math.hypot(e.clientX - (dragStart.x + panOffset.x), e.clientY - (dragStart.y + panOffset.y));
      if (dist < 6 && hoverInfo) {
        if (pinnedInfo && pinnedInfo.profile.dateStr === hoverInfo.profile.dateStr && Math.abs(pinnedInfo.bin.price - hoverInfo.bin.price) < 0.01) {
          setPinnedInfo(null);
        } else {
          setPinnedInfo(hoverInfo);
        }
      }
    }
    setDragMode('none');
  };

  // Touch Handlers for Mobile: Single finger pan & Two-finger pinch-to-zoom
  const handleCanvasTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (e.touches.length === 1) {
      const t = e.touches[0];
      touchStateRef.current = {
        mode: 'pan',
        startX: t.clientX,
        startY: t.clientY,
        initialPan: { ...panOffset },
        startDist: 0,
        initialZoom: zoomLevel,
        initialYScale: yScale
      };
      setDragMode('pan');
    } else if (e.touches.length === 2) {
      const t0 = e.touches[0];
      const t1 = e.touches[1];
      const dist = Math.hypot(t0.clientX - t1.clientX, t0.clientY - t1.clientY);
      touchStateRef.current = {
        mode: 'pinch',
        startX: (t0.clientX + t1.clientX) / 2,
        startY: (t0.clientY + t1.clientY) / 2,
        initialPan: { ...panOffset },
        startDist: Math.max(10, dist),
        initialZoom: zoomLevel,
        initialYScale: yScale
      };
      setDragMode('none');
    }
  };

  const handleCanvasTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (e.touches.length === 1 && touchStateRef.current.mode === 'pan') {
      const t = e.touches[0];
      const dx = t.clientX - touchStateRef.current.startX;
      const dy = t.clientY - touchStateRef.current.startY;
      setPanOffset({
        x: touchStateRef.current.initialPan.x + dx,
        y: touchStateRef.current.initialPan.y + dy
      });
    } else if (e.touches.length === 2) {
      const t0 = e.touches[0];
      const t1 = e.touches[1];
      const dist = Math.hypot(t0.clientX - t1.clientX, t0.clientY - t1.clientY);
      if (touchStateRef.current.startDist > 0) {
        const factor = dist / touchStateRef.current.startDist;
        const newZoom = Math.min(4.0, Math.max(0.25, touchStateRef.current.initialZoom * factor));
        setZoomLevel(newZoom);
      }
    }
  };

  const handleCanvasTouchEnd = () => {
    touchStateRef.current.mode = 'none';
    setDragMode('none');
  };

  const handleTakeScreenshot = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    try {
      setScreenshotStatus('Capturing...');
      const exportCanvas = document.createElement('canvas');
      exportCanvas.width = canvas.width;
      exportCanvas.height = canvas.height;
      const ctx = exportCanvas.getContext('2d');
      if (!ctx) return;

      // 1. Draw chart canvas
      ctx.drawImage(canvas, 0, 0);

      // 2. Draw watermark header bar
      ctx.save();
      ctx.fillStyle = 'rgba(11, 25, 46, 0.9)';
      ctx.fillRect(0, 0, exportCanvas.width, 36);
      ctx.strokeStyle = 'rgba(0, 240, 255, 0.4)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, 36);
      ctx.lineTo(exportCanvas.width, 36);
      ctx.stroke();

      ctx.fillStyle = '#00f0ff';
      ctx.font = 'bold 13px "Outfit", sans-serif';
      ctx.fillText(`📊 Trading Guru • Pro TPO Profile • ${symbol} (${sessionPeriod} - ${viewMode})`, 16, 23);

      const dStr = new Date().toLocaleString();
      ctx.fillStyle = '#94a3b8';
      ctx.font = '11px "JetBrains Mono", monospace';
      ctx.textAlign = 'right';
      ctx.fillText(`Captured: ${dStr}`, exportCanvas.width - 16, 23);
      ctx.restore();

      // 3. If pinned info or active display info exists, render a clean stylish info card onto the image
      const infoToRender = pinnedInfo || hoverInfo;
      if (infoToRender) {
        ctx.save();
        const cardX = Math.max(20, Math.min(exportCanvas.width - 300, infoToRender.x));
        const cardY = Math.max(50, Math.min(exportCanvas.height - 300, infoToRender.y - 40));
        const cardW = 280;
        const cardH = 240;

        // Card background
        ctx.fillStyle = 'rgba(11, 25, 46, 0.96)';
        ctx.beginPath();
        ctx.roundRect(cardX, cardY, cardW, cardH, 8);
        ctx.fill();

        ctx.strokeStyle = '#00f0ff';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Card Title
        ctx.fillStyle = '#00f0ff';
        ctx.font = 'bold 11px "Outfit", sans-serif';
        ctx.fillText(`📅 Session: ${formatDateHeader(infoToRender.profile.dateStr)} (${infoToRender.profile.dateStr})`, cardX + 12, cardY + 22);

        // Value Area & POC
        ctx.fillStyle = '#ffffff';
        ctx.font = '10.5px "JetBrains Mono", monospace';
        if (typeof infoToRender.profile?.vahPrice === 'number' && !isNaN(infoToRender.profile.vahPrice)) {
          ctx.fillText(`VAH: ₹${infoToRender.profile.vahPrice.toFixed(2)}`, cardX + 12, cardY + 46);
        }
        ctx.fillStyle = '#00f0ff';
        if (typeof infoToRender.profile?.pocPrice === 'number' && !isNaN(infoToRender.profile.pocPrice)) {
          ctx.fillText(`POC: ₹${infoToRender.profile.pocPrice.toFixed(2)} (Point of Control)`, cardX + 12, cardY + 66);
        }
        ctx.fillStyle = '#ffffff';
        if (typeof infoToRender.profile?.valPrice === 'number' && !isNaN(infoToRender.profile.valPrice)) {
          ctx.fillText(`VAL: ₹${infoToRender.profile.valPrice.toFixed(2)}`, cardX + 12, cardY + 86);
        }

        // IB High / Low
        if (typeof infoToRender.profile?.ibHigh === 'number' && typeof infoToRender.profile?.ibLow === 'number' && !isNaN(infoToRender.profile.ibHigh) && !isNaN(infoToRender.profile.ibLow)) {
          ctx.fillStyle = '#fbbf24';
          ctx.fillText(`IB High: ₹${infoToRender.profile.ibHigh.toFixed(2)} | IB Low: ₹${infoToRender.profile.ibLow.toFixed(2)}`, cardX + 12, cardY + 110);
        }

        // Volume & TPO Count
        ctx.fillStyle = '#cbd5e1';
        ctx.font = '10px "JetBrains Mono", monospace';
        ctx.fillText(`Session Volume: ${Math.round(infoToRender.profile?.totalVolume || 0).toLocaleString()}`, cardX + 12, cardY + 134);
        ctx.fillText(`Total TPOs: ${infoToRender.profile?.totalTpoCount || 0} prints`, cardX + 12, cardY + 154);

        // Selected Level
        ctx.fillStyle = '#38bdf8';
        if (typeof infoToRender.bin?.price === 'number' && !isNaN(infoToRender.bin.price)) {
          ctx.fillText(`Price Level: ₹${infoToRender.bin.price.toFixed(2)} (${infoToRender.bin?.tpos?.length || 0} TPOs)`, cardX + 12, cardY + 178);
        }

        // Badge Footer
        ctx.fillStyle = 'rgba(0, 240, 255, 0.15)';
        ctx.fillRect(cardX + 10, cardY + 196, cardW - 20, 28);
        ctx.fillStyle = '#00f0ff';
        ctx.font = 'bold 10px "Outfit", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`📌 PINNED TRADING GURU TPO PROFILE`, cardX + cardW / 2, cardY + 214);

        ctx.restore();
      }

      // Convert to blob
      exportCanvas.toBlob(async (blob) => {
        if (!blob) return;
        try {
          if (navigator.clipboard && (window as any).ClipboardItem) {
            await navigator.clipboard.write([
              new ClipboardItem({ 'image/png': blob })
            ]);
            setScreenshotStatus('Copied to Clipboard!');
          }
        } catch (e) {}

        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        const cleanSym = symbol.replace(/[^a-zA-Z0-9]/g, '_');
        link.download = `Pro_TPO_Profile_${cleanSym}_${new Date().toISOString().slice(0, 10)}.png`;
        link.href = url;
        link.click();
        URL.revokeObjectURL(url);

        setScreenshotStatus('Saved PNG!');
        setTimeout(() => setScreenshotStatus(null), 3500);
      }, 'image/png');
    } catch (err) {
      console.error('Failed to capture screenshot:', err);
      setScreenshotStatus('Error');
      setTimeout(() => setScreenshotStatus(null), 2500);
    }
  };

  return (
    <div
      ref={containerRef}
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
        height: isExpanded || isStandalone ? '100vh' : 'auto',
        margin: 0,
        gap: '8px',
        minHeight: isExpanded || isStandalone ? '100vh' : '85vh',
        background: '#000000',
        color: '#e2e8f0',
        padding: isExpanded ? '8px 12px' : '10px',
        borderRadius: isExpanded ? '0' : '4px',
        boxSizing: 'border-box',
        overflowY: isExpanded || isStandalone ? 'hidden' : 'auto'
      }}
    >
      
      {/* Controls Toolbar (Matching Reference Screenshot & Design Language) */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', background: 'rgba(15, 23, 42, 0.75)', padding: '10px 14px', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.1)', backdropFilter: 'blur(10px)', marginBottom: '8px' }}>
        
        {/* Row 1: Core TPO & Analysis Controls (Matches Screenshot Exact Layout) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          
          {/* Axis Grid Step with [-] [+] controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '3px', background: 'rgba(0,0,0,0.4)', padding: '3px 8px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.1)' }}>
            <Sliders size={12} style={{ color: '#00f0ff' }} />
            <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: '600' }}>Grid:</span>
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

          {/* TPO Size / Tick Step with direct [-] [+] manual controls (KEPT TPO SIZE SELECTING) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '3px', background: 'rgba(0,0,0,0.4)', padding: '3px 8px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.1)' }}>
            <span style={{ fontSize: '11px', color: '#60a5fa', fontWeight: '800' }}>TPO:</span>
            <button
              onClick={() => {
                const steps = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 15, 16, 18, 20, 24, 25, 30, 40, 50];
                const curIdx = steps.indexOf(tpoStep);
                if (curIdx > 0) setTpoStep(steps[curIdx - 1]);
                else setTpoStep(steps[0]);
              }}
              style={{ background: 'rgba(255,255,255,0.08)', border: 'none', color: '#60a5fa', width: '18px', height: '18px', borderRadius: '3px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              title="Decrease TPO Size"
            >
              -
            </button>
            <select
              value={tpoStep}
              onChange={(e) => setTpoStep(Number(e.target.value))}
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
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 15, 16, 18, 20, 24, 25, 30, 40, 50].map((stepVal) => (
                <option key={stepVal} value={stepVal} style={{ background: '#1e293b', color: '#ffffff' }}>
                  {stepVal} pts
                </option>
              ))}
            </select>
            <button
              onClick={() => {
                const steps = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 15, 16, 18, 20, 24, 25, 30, 40, 50];
                const curIdx = steps.indexOf(tpoStep);
                if (curIdx !== -1 && curIdx < steps.length - 1) setTpoStep(steps[curIdx + 1]);
                else setTpoStep(steps[steps.length - 1]);
              }}
              style={{ background: 'rgba(255,255,255,0.08)', border: 'none', color: '#60a5fa', width: '18px', height: '18px', borderRadius: '3px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              title="Increase TPO Size"
            >
              +
            </button>
          </div>

          {/* IB Line, Single Prints & Poor H/L Toggles */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(0,0,0,0.3)', padding: '2px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.08)' }}>
            <button
              onClick={() => setShowIbLine(!showIbLine)}
              style={{
                background: showIbLine ? 'rgba(59, 130, 246, 0.25)' : 'transparent',
                color: showIbLine ? '#60a5fa' : '#94a3b8',
                border: 'none',
                padding: '4px 8px',
                borderRadius: '4px',
                fontSize: '11px',
                fontWeight: '700',
                cursor: 'pointer'
              }}
              title="Toggle Initial Balance (IB) Vertical Bracket Line"
            >
              IB Line
            </button>
            <button
              onClick={() => setHighlightSinglePrints(!highlightSinglePrints)}
              style={{
                background: highlightSinglePrints ? 'rgba(245, 158, 11, 0.25)' : 'transparent',
                color: highlightSinglePrints ? '#f59e0b' : '#94a3b8',
                border: 'none',
                padding: '4px 8px',
                borderRadius: '4px',
                fontSize: '11px',
                fontWeight: '700',
                cursor: 'pointer'
              }}
              title="Highlight Single Prints (Excess & Breakout Imbalance Gaps)"
            >
              Single Prints
            </button>
            <button
              onClick={() => setShowPoorHighLow(!showPoorHighLow)}
              style={{
                background: showPoorHighLow ? 'rgba(239, 68, 68, 0.25)' : 'transparent',
                color: showPoorHighLow ? '#f87171' : '#94a3b8',
                border: 'none',
                padding: '4px 8px',
                borderRadius: '4px',
                fontSize: '11px',
                fontWeight: '700',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '3px'
              }}
              title="Toggle Poor High/Low & AB Poor High/Low Unfinished Business Markers"
            >
              <span>⚠️</span> Poor & AB
            </button>
            <button
              onClick={() => setShowWeeklyLevels(!showWeeklyLevels)}
              style={{
                background: showWeeklyLevels ? 'rgba(16, 185, 129, 0.25)' : 'transparent',
                color: showWeeklyLevels ? '#34d399' : '#94a3b8',
                border: 'none',
                padding: '4px 8px',
                borderRadius: '4px',
                fontSize: '11px',
                fontWeight: '700',
                cursor: 'pointer'
              }}
              title="Toggle Weekly High & Weekly Low Reference Lines"
            >
              Weekly H/L
            </button>
            <button
              onClick={() => setShowG2G3(!showG2G3)}
              style={{
                background: showG2G3 ? 'rgba(6, 182, 212, 0.25)' : 'transparent',
                color: showG2G3 ? '#22d3ee' : '#94a3b8',
                border: 'none',
                padding: '4px 8px',
                borderRadius: '4px',
                fontSize: '11px',
                fontWeight: '700',
                cursor: 'pointer'
              }}
              title="Toggle G2 (2-Day) and G3 (3-Day) Balance High/Low Lines"
            >
              G2/G3 Bal
            </button>
            <button
              onClick={() => setShowHvn(!showHvn)}
              style={{
                background: showHvn ? 'rgba(56, 189, 248, 0.25)' : 'transparent',
                color: showHvn ? '#38bdf8' : '#94a3b8',
                border: 'none',
                padding: '4px 8px',
                borderRadius: '4px',
                fontSize: '11px',
                fontWeight: '700',
                cursor: 'pointer'
              }}
              title="Toggle High Volume Node (HVN) Lines"
            >
              HVN
            </button>
            <button
              onClick={() => setShowLvn(!showLvn)}
              style={{
                background: showLvn ? 'rgba(249, 115, 22, 0.25)' : 'transparent',
                color: showLvn ? '#f97316' : '#94a3b8',
                border: 'none',
                padding: '4px 8px',
                borderRadius: '4px',
                fontSize: '11px',
                fontWeight: '700',
                cursor: 'pointer'
              }}
              title="Toggle Low Volume Node (LVN) Lines"
            >
              LVN
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
              onClick={() => { setZoomLevel(1.0); setPanOffset({ x: 0, y: 0 }); }}
              style={{ background: 'rgba(255,255,255,0.08)', border: 'none', color: 'white', cursor: 'pointer', padding: '3px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: '700', marginLeft: '4px' }}
              title="Reset Zoom & Pan"
            >
              Reset
            </button>
          </div>

          {/* Timeframe Buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '3px', background: 'rgba(0,0,0,0.3)', padding: '2px', borderRadius: '6px' }}>
            {[
              { id: '5', label: '5m', period: 'D', lookback: 5 },
              { id: '15', label: '15m', period: 'D', lookback: 5 },
              { id: '30', label: '30m', period: 'D', lookback: 5 },
              { id: 'D', label: '1D', period: 'D', lookback: 30 },
              { id: 'W', label: '50W', period: 'W', lookback: 50 },
              { id: 'M', label: '25M', period: 'M_S', lookback: 25 },
              { id: 'Y', label: '6Y', period: 'Y', lookback: 6 }
            ].map((btn) => {
              const isActive = btn.period === 'D'
                ? (sessionPeriod === 'D' && timeframe === btn.id)
                : (sessionPeriod === btn.period);
              return (
                <button
                  key={btn.id}
                  onClick={() => {
                    setSessionPeriod(btn.period as any);
                    setTimeframe(btn.period === 'D' ? btn.id : 'D');
                    setLookbackDays(btn.lookback);
                  }}
                  style={{
                    background: isActive ? '#3b82f6' : 'transparent',
                    color: isActive ? 'white' : '#94a3b8',
                    border: 'none',
                    padding: '4px 8px',
                    borderRadius: '4px',
                    fontSize: '11px',
                    fontWeight: '700',
                    cursor: 'pointer'
                  }}
                >
                  {btn.label}
                </button>
              );
            })}
          </div>

          {/* Lookback Days Selection (Dropdown) */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            background: 'rgba(0,0,0,0.35)',
            padding: '2px 6px',
            borderRadius: '6px',
            border: '1px solid rgba(139, 92, 246, 0.35)'
          }}>
            <select
              value={lookbackDays}
              onChange={(e) => setLookbackDays(Number(e.target.value))}
              style={{
                background: 'transparent',
                color: '#a78bfa',
                border: 'none',
                borderRadius: '4px',
                padding: '3px 4px',
                fontSize: '11px',
                fontWeight: '700',
                cursor: 'pointer',
                outline: 'none'
              }}
              title="Select Lookback Days"
            >
              {[5, 10, 15, 20, 25, 30].map((d) => (
                <option key={d} value={d} style={{ background: '#0f172a', color: '#ffffff' }}>
                  {d}D
                </option>
              ))}
            </select>
          </div>

          {/* Mode Selector Chips (T-V, T, V, T/V, GV, GVN) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '3px', background: 'rgba(0,0,0,0.3)', padding: '2px', borderRadius: '6px' }}>
            {[
              { id: 'T-V', label: 'T-V (Split)' },
              { id: 'T', label: 'T (TPO Only)' },
              { id: 'V', label: 'V (Vol Only)' },
              { id: 'T/V', label: 'T/V (Combined)' },
              { id: 'GV', label: 'GV' },
              { id: 'GVN', label: 'GVN' }
            ].map((m) => (
              <button
                key={m.id}
                onClick={() => setViewMode(m.id as any)}
                style={{
                  background: viewMode === m.id ? '#00f0ff' : 'transparent',
                  color: viewMode === m.id ? '#000000' : '#94a3b8',
                  border: 'none',
                  padding: '4px 8px',
                  borderRadius: '4px',
                  fontSize: '11px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
                title={`View Mode: ${m.label}`}
              >
                {m.label}
              </button>
            ))}
          </div>

          {/* 2-Day Balance Toggle */}
          <button
            onClick={() => setShowTwoDayBalance(prev => !prev)}
            style={{
              background: showTwoDayBalance ? 'rgba(245, 158, 11, 0.2)' : 'rgba(0,0,0,0.3)',
              color: showTwoDayBalance ? '#fbbf24' : '#94a3b8',
              border: `1px solid ${showTwoDayBalance ? '#f59e0b' : 'rgba(255,255,255,0.08)'}`,
              padding: '4px 10px',
              borderRadius: '6px',
              fontSize: '11px',
              fontWeight: '700',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
            title="Two-Day Balance Structure (High-Confidence Breakout Edge)"
          >
            <span>📦</span> 2D Balance {showTwoDayBalance ? 'ON' : 'OFF'}
          </button>
        </div>

        {/* Row 2: Symbol Context & Secondary Action Controls */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px', paddingTop: '4px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <div style={{ background: '#ea580c', color: '#ffffff', fontWeight: '900', padding: '3px 8px', borderRadius: '4px', fontSize: '11px', letterSpacing: '0.5px' }}>
              Pro TPO
            </div>

            {/* Symbol Selector */}
            <select
              value={symbol}
              onChange={(e) => {
                const newSym = e.target.value;
                setSymbol(newSym);
                if (onSymbolSelect) onSymbolSelect(newSym);
              }}
              style={{
                background: '#1e293b',
                color: '#ffffff',
                border: '1px solid rgba(255,255,255,0.15)',
                borderRadius: '4px',
                padding: '4px 8px',
                fontSize: '11px',
                fontWeight: '800',
                cursor: 'pointer',
                outline: 'none'
              }}
            >
              {QUICK_SYMBOLS.map(qs => (
                <option key={qs.symbol} value={qs.symbol} style={{ background: '#1e293b', color: '#ffffff' }}>
                  {qs.label}
                </option>
              ))}
            </select>

            {/* Dynamic Date & Time Range text */}
            {dateRangeStr && (
              <span style={{ fontSize: '11px', color: '#94a3b8', fontFamily: '"JetBrains Mono", monospace' }}>
                {dateRangeStr}
              </span>
            )}
          </div>

          {/* Action Buttons: Pin, Screenshot, Refresh, Pop Out, Fullscreen, Chart */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
            <button
              onClick={() => {
                if (pinnedInfo) {
                  setPinnedInfo(null);
                } else if (hoverInfo) {
                  setPinnedInfo(hoverInfo);
                } else if (dayProfiles.length > 0) {
                  const latestProf = dayProfiles[dayProfiles.length - 1];
                  const pocBin = latestProf.bins.find(b => b.price === latestProf.pocPrice) || latestProf.bins[0];
                  setPinnedInfo({
                    profile: latestProf,
                    bin: pocBin,
                    x: 150,
                    y: 110
                  });
                }
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '3px',
                background: pinnedInfo ? 'rgba(16, 185, 129, 0.22)' : 'rgba(0,0,0,0.4)',
                color: pinnedInfo ? '#10b981' : '#9ca3af',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '4px',
                padding: '4px 8px',
                fontSize: '11px',
                fontWeight: '700',
                cursor: 'pointer'
              }}
              title="Pin Session Info (P)"
            >
              {pinnedInfo ? <PinOff size={12} /> : <Pin size={12} />}
              <span>Pin Info (P)</span>
            </button>

            <button
              onClick={handleTakeScreenshot}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '3px',
                background: 'rgba(0,0,0,0.4)',
                color: '#00f0ff',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '4px',
                padding: '4px 8px',
                fontSize: '11px',
                fontWeight: '700',
                cursor: 'pointer'
              }}
              title="Take Screenshot"
            >
              <Camera size={12} />
              <span>Screenshot</span>
            </button>

            <button
              onClick={() => fetchCandles(false)}
              style={{
                background: 'rgba(0,0,0,0.4)',
                border: '1px solid rgba(255,255,255,0.1)',
                color: '#9ca3af',
                cursor: 'pointer',
                padding: '4px 8px',
                borderRadius: '4px',
                display: 'flex',
                alignItems: 'center'
              }}
              title="Refresh Data"
            >
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            </button>

            <button
              onClick={handlePopOut}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '3px',
                background: 'rgba(0,0,0,0.4)',
                color: '#9ca3af',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '4px',
                padding: '4px 8px',
                fontSize: '11px',
                fontWeight: '700',
                cursor: 'pointer'
              }}
              title="Pop out into new window"
            >
              <ExternalLink size={12} />
              <span>Pop Out</span>
            </button>

            <button
              onClick={toggleFullscreen}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '3px',
                background: isExpanded ? '#1d4ed8' : 'rgba(0,0,0,0.4)',
                color: isExpanded ? '#ffffff' : '#9ca3af',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '4px',
                padding: '4px 8px',
                fontSize: '11px',
                fontWeight: '700',
                cursor: 'pointer'
              }}
              title={isExpanded ? 'Exit Fullscreen' : 'Fullscreen'}
            >
              {isExpanded ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
              <span>Fullscreen</span>
            </button>

            {onSwitchToChart && (
              <button
                onClick={onSwitchToChart}
                style={{ background: '#10b981', border: 'none', color: '#ffffff', padding: '4px 10px', borderRadius: '4px', fontSize: '11px', fontWeight: '800', cursor: 'pointer' }}
              >
                CHART
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Canvas Viewport */}
      <div 
        ref={canvasContainerRef}
        style={{ 
          position: 'relative', 
          width: '100%', 
          flex: isExpanded || isStandalone ? 1 : 'none',
          minHeight: isExpanded || isStandalone ? '400px' : '620px', 
          height: isExpanded || isStandalone ? 'calc(100vh - 65px)' : '680px',
          background: isDark ? '#000000' : '#ffffff', 
          borderRadius: '6px', 
          border: `1px solid ${isDark ? '#1f1f1f' : '#cbd5e1'}`,
          overflow: 'hidden'
        }}
      >
        <canvas
          ref={canvasRef}
          onMouseDown={handleCanvasMouseDown}
          onMouseMove={handleCanvasMouseMove}
          onMouseUp={handleCanvasMouseUp}
          onTouchStart={handleCanvasTouchStart}
          onTouchMove={handleCanvasTouchMove}
          onTouchEnd={handleCanvasTouchEnd}
          onTouchCancel={handleCanvasTouchEnd}
          onMouseLeave={() => {
            setDragMode('none');
            setCrosshairPos(null);
            if (!pinnedInfo) setHoverInfo(null);
          }}
          style={{ cursor: cursorStyle, display: 'block', touchAction: 'none' }}
        />

        {/* Hover / Pinned Tooltip Overlay */}
        {(pinnedInfo || hoverInfo) && dragMode === 'none' && (() => {
          const activeDisplay = pinnedInfo || hoverInfo;
          if (!activeDisplay) return null;
          const isItemPinned = !!pinnedInfo;

          return (
            <div
              style={{
                position: 'absolute',
                top: `${activeDisplay.y}px`,
                left: `${activeDisplay.x}px`,
                background: isDark ? 'rgba(11, 25, 46, 0.96)' : 'rgba(255, 255, 255, 0.97)',
                color: isDark ? '#ffffff' : '#0f172a',
                border: isItemPinned ? '2px solid #10b981' : `1px solid ${isDark ? '#1e3a8a' : '#cbd5e1'}`,
                borderRadius: '6px',
                padding: '10px 12px',
                fontSize: '11px',
                boxShadow: isItemPinned ? '0 8px 30px rgba(16, 185, 129, 0.35)' : '0 6px 20px rgba(0,0,0,0.4)',
                zIndex: 100,
                minWidth: '240px',
                pointerEvents: 'auto',
                backdropFilter: 'blur(8px)',
                fontFamily: '"Outfit", sans-serif'
              }}
            >
              {/* Header with Pin badge & actions */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`, paddingBottom: '6px', marginBottom: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <span style={{ fontWeight: 'bold', color: '#60a5fa' }}>
                    {formatDateHeader(activeDisplay.profile.dateStr)}
                  </span>
                  {isItemPinned && (
                    <span style={{ fontSize: '9px', background: '#10b981', color: '#000', padding: '1px 5px', borderRadius: '3px', fontWeight: 'bold' }}>
                      📌 PINNED
                    </span>
                  )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <button
                    onClick={() => {
                      if (pinnedInfo) {
                        setPinnedInfo(null);
                      } else {
                        setPinnedInfo(activeDisplay);
                      }
                    }}
                    style={{
                      background: isItemPinned ? 'rgba(16, 185, 129, 0.25)' : 'rgba(255,255,255,0.08)',
                      border: isItemPinned ? '1px solid #10b981' : 'none',
                      color: isItemPinned ? '#10b981' : '#94a3b8',
                      cursor: 'pointer',
                      padding: '2px 4px',
                      borderRadius: '3px',
                      display: 'flex',
                      alignItems: 'center'
                    }}
                    title={isItemPinned ? "Unpin (Esc)" : "Pin for Screenshot (P)"}
                  >
                    {isItemPinned ? <PinOff size={12} /> : <Pin size={12} />}
                  </button>

                  <button
                    onClick={handleTakeScreenshot}
                    style={{
                      background: 'rgba(59, 130, 246, 0.15)',
                      border: 'none',
                      color: '#60a5fa',
                      cursor: 'pointer',
                      padding: '2px 4px',
                      borderRadius: '3px',
                      display: 'flex',
                      alignItems: 'center'
                    }}
                    title="Take Screenshot"
                  >
                    <Camera size={12} />
                  </button>

                  {isItemPinned && (
                    <button
                      onClick={() => setPinnedInfo(null)}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#ef4444',
                        cursor: 'pointer',
                        padding: '2px',
                        display: 'flex',
                        alignItems: 'center'
                      }}
                      title="Close Pin"
                    >
                      <X size={13} />
                    </button>
                  )}
                </div>
              </div>

              {/* Price Bin info */}
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
                <span style={{ color: isDark ? '#94a3b8' : '#64748b' }}>Price Level:</span>
                <span style={{ fontWeight: 'bold', color: isDark ? '#ffffff' : '#0f172a' }}>
                  ₹{typeof activeDisplay?.bin?.price === 'number' && !isNaN(activeDisplay.bin.price) ? activeDisplay.bin.price.toFixed(2) : '--'}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
                <span style={{ color: isDark ? '#94a3b8' : '#64748b' }}>TPOs:</span>
                <span style={{ fontWeight: 'bold', color: '#f59e0b' }}>
                  {activeDisplay.bin?.tpos?.length || 0} ({activeDisplay.bin?.tpos?.join('') || ''})
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
                <span style={{ color: isDark ? '#94a3b8' : '#64748b' }}>Volume:</span>
                <span style={{ fontWeight: 'bold', color: '#3b82f6' }}>
                  {Math.round(activeDisplay.bin?.volume || 0).toLocaleString()}
                </span>
              </div>

              {/* Special Level Badges */}
              {activeDisplay.bin?.price === activeDisplay.profile?.pocPrice && (
                <div style={{ color: '#000', backgroundColor: '#00f0ff', fontWeight: 'bold', fontSize: '9px', textAlign: 'center', padding: '2px 4px', borderRadius: '3px', marginTop: '5px', textTransform: 'uppercase' }}>
                  ⭐ Point of Control (POC)
                </div>
              )}
              {activeDisplay.bin?.price === activeDisplay.profile?.vahPrice && (
                <div style={{ color: '#a855f7', fontWeight: 'bold', fontSize: '9px', marginTop: '3px' }}>
                  🟣 Value Area High (VAH)
                </div>
              )}
              {activeDisplay.bin?.price === activeDisplay.profile?.valPrice && (
                <div style={{ color: '#a855f7', fontWeight: 'bold', fontSize: '9px', marginTop: '3px' }}>
                  🟣 Value Area Low (VAL)
                </div>
              )}

              {/* Session Summary Details */}
              <div style={{ marginTop: '8px', paddingTop: '6px', borderTop: `1px dashed ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`, display: 'flex', flexDirection: 'column', gap: '2px', fontSize: '9.5px', color: isDark ? '#cbd5e1' : '#475569' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Session Range:</span>
                  <span>₹{typeof activeDisplay.profile?.low === 'number' && !isNaN(activeDisplay.profile.low) ? activeDisplay.profile.low.toFixed(2) : '--'} - ₹{typeof activeDisplay.profile?.high === 'number' && !isNaN(activeDisplay.profile.high) ? activeDisplay.profile.high.toFixed(2) : '--'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>VA Range (70%):</span>
                  <span style={{ color: '#c084fc', fontWeight: 'bold' }}>₹{typeof activeDisplay.profile?.valPrice === 'number' && !isNaN(activeDisplay.profile.valPrice) ? activeDisplay.profile.valPrice.toFixed(2) : '--'} - ₹{typeof activeDisplay.profile?.vahPrice === 'number' && !isNaN(activeDisplay.profile.vahPrice) ? activeDisplay.profile.vahPrice.toFixed(2) : '--'}</span>
                </div>
                {typeof activeDisplay.profile?.ibHigh === 'number' && typeof activeDisplay.profile?.ibLow === 'number' && !isNaN(activeDisplay.profile.ibHigh) && !isNaN(activeDisplay.profile.ibLow) && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Initial Balance:</span>
                    <span style={{ color: '#fbbf24' }}>₹{activeDisplay.profile.ibLow.toFixed(2)} - ₹{activeDisplay.profile.ibHigh.toFixed(2)}</span>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Total Volume:</span>
                  <span style={{ color: '#38bdf8' }}>{Math.round(activeDisplay.profile.totalVolume).toLocaleString()}</span>
                </div>
              </div>

              {/* Shortcut info footer */}
              <div style={{ marginTop: '8px', paddingTop: '6px', borderTop: `1px dashed ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '9px', color: isDark ? '#94a3b8' : '#64748b' }}>
                <span>💡 {isItemPinned ? 'Ready for screenshot! Press Win+Shift+S or Capture' : 'Click profile or press [P] to Pin'}</span>
                <span>{isItemPinned ? 'Press [Esc] to Unpin' : '[P] Pin'}</span>
              </div>
            </div>
          );
        })()}
      </div>

      {/* Quick Symbol Switcher Tabs Bar (Directly matching the bottom of reference screenshot) */}
      {!isExpanded && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '2px',
          background: '#181818',
          padding: '4px 8px',
          borderRadius: '4px',
          border: '1px solid #333333',
          overflowX: 'auto'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
            <span style={{ color: '#6b7280', fontSize: '11px', padding: '0 4px', cursor: 'pointer' }}>◀</span>
            {QUICK_SYMBOLS.map((qs) => {
              const isActive = symbol === qs.symbol || (qs.label === 'BNF' && symbol.includes('BANKNIFTY')) || (qs.label === 'NIFTY_I' && symbol.includes('NIFTY') && !symbol.includes('BANK') && !symbol.includes('FIN') && !symbol.includes('MIDCP'));
              return (
                <button
                  key={qs.label}
                  onClick={() => {
                    setSymbol(qs.symbol);
                    if (onSymbolSelect) onSymbolSelect(qs.symbol);
                  }}
                  style={{
                    background: isActive ? '#0369a1' : '#262626',
                    color: isActive ? '#ffffff' : '#9ca3af',
                    border: isActive ? '1px solid #38bdf8' : '1px solid #383838',
                    padding: '3px 8px',
                    borderRadius: '2px',
                    fontSize: '11px',
                    fontWeight: isActive ? '800' : '600',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {qs.label}
                </button>
              );
            })}
            <button
              onClick={() => {}}
              style={{
                background: '#262626',
                color: '#9ca3af',
                border: '1px solid #383838',
                padding: '3px 6px',
                borderRadius: '2px',
                fontSize: '11px',
                fontWeight: '600',
                cursor: 'pointer'
              }}
            >
              +
            </button>
          </div>
        </div>
      )}

      {/* Bottom Horizontal Quick Scroll Bar & Touch Zoom Controls (Matches Market Profile bottom bar) */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '10px',
        padding: '8px 12px',
        background: '#0b111b',
        borderTop: '1px solid rgba(255,255,255,0.08)',
        borderRadius: '4px',
        flexWrap: 'wrap'
      }}>
        <button
          onClick={() => setPanOffset(prev => ({ ...prev, x: prev.x + 240 }))}
          style={{
            background: '#1e293b',
            border: '1px solid rgba(0, 240, 255, 0.3)',
            color: '#60a5fa',
            padding: '7px 14px',
            borderRadius: '6px',
            fontSize: '11px',
            fontWeight: '800',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '5px'
          }}
          title="Scroll chart to the left to view older sessions"
        >
          <ChevronLeft size={16} /> ◀ SCROLL LEFT (OLDER)
        </button>

        <button
          onClick={() => { setPanOffset({ x: 0, y: 0 }); setZoomLevel(1.0); }}
          style={{
            background: 'rgba(0, 240, 255, 0.15)',
            border: '1px solid #00f0ff',
            color: '#00f0ff',
            padding: '7px 16px',
            borderRadius: '6px',
            fontSize: '11px',
            fontWeight: '800',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '5px'
          }}
          title="Reset zoom & return to the latest session"
        >
          🎯 RESET TO LATEST
        </button>

        <button
          onClick={() => setPanOffset(prev => ({ ...prev, x: prev.x - 240 }))}
          style={{
            background: '#1e293b',
            border: '1px solid rgba(0, 240, 255, 0.3)',
            color: '#60a5fa',
            padding: '7px 14px',
            borderRadius: '6px',
            fontSize: '11px',
            fontWeight: '800',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '5px'
          }}
          title="Scroll chart to the right to view recent sessions"
        >
          SCROLL RIGHT (RECENT) ▶ <ChevronRight size={16} />
        </button>

        {/* Touch Zoom Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginLeft: '6px' }}>
          <button
            onClick={() => setZoomLevel(prev => Math.min(prev * 1.25, 4.0))}
            style={{
              background: '#1e293b',
              border: '1px solid rgba(255,255,255,0.2)',
              color: '#38bdf8',
              padding: '6px 12px',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: '800',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
            title="Zoom In"
          >
            <ZoomIn size={14} /> +
          </button>
          <button
            onClick={() => setZoomLevel(prev => Math.max(prev * 0.8, 0.25))}
            style={{
              background: '#1e293b',
              border: '1px solid rgba(255,255,255,0.2)',
              color: '#38bdf8',
              padding: '6px 12px',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: '800',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
            title="Zoom Out"
          >
            <ZoomOut size={14} /> -
          </button>
        </div>
      </div>

      {/* Bottom Mode Selector Toolbar */}
      {!isExpanded && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#0a0a0a', padding: '6px 10px', borderRadius: '4px', border: '1px solid #1f1f1f', flexWrap: 'wrap', gap: '6px' }}>
          
          {/* Left Side: Period Buttons (D, W, W_S, M_S, Y) */}
          <div style={{ display: 'flex', gap: '3px' }}>
            {(['D', 'W', 'W_S', 'M_S', 'Y'] as const).map(p => (
              <button
                key={p}
                onClick={() => {
                  setSessionPeriod(p);
                  if (p === 'Y') {
                    setTimeframe('D');
                    setLookbackDays(6);
                  } else if (p === 'M_S') {
                    setTimeframe('D');
                    setLookbackDays(25);
                  } else if (p === 'W' || p === 'W_S') {
                    setTimeframe('D');
                    setLookbackDays(50);
                  } else {
                    setLookbackDays(5);
                  }
                }}
                style={{
                  background: sessionPeriod === p ? '#2563eb' : '#262626',
                  color: sessionPeriod === p ? '#ffffff' : '#9ca3af',
                  border: '1px solid #444444',
                  padding: '3px 8px',
                  borderRadius: '3px',
                  fontSize: '10px',
                  fontWeight: '800',
                  cursor: 'pointer'
                }}
              >
                {p === 'Y' ? 'Y (6Y)' : p === 'M_S' ? 'M (25M)' : p === 'W' ? 'W (50W)' : p === 'W_S' ? 'W_S (50W)' : p}
              </button>
            ))}
          </div>

          {/* Middle: Display View Mode Chips (T-V, T, V, T/V) */}
          <div style={{ display: 'flex', gap: '3px', flexWrap: 'wrap' }}>
            {(['T-V', 'T', 'V', 'T/V', 'GV', 'GVN'] as const).map(m => (
              <button
                key={m}
                onClick={() => setViewMode(m as any)}
                style={{
                  background: viewMode === m ? '#2563eb' : '#262626',
                  color: viewMode === m ? '#ffffff' : '#9ca3af',
                  border: '1px solid #444444',
                  padding: '3px 6px',
                  borderRadius: '3px',
                  fontSize: '10px',
                  fontWeight: '800',
                  cursor: 'pointer'
                }}
              >
                {m}
              </button>
            ))}
          </div>

          {/* Right Side: Quick Action Controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <button
              onClick={() => setPanOffset({ x: 0, y: 0 })}
              style={{ background: '#262626', border: '1px solid #444444', color: '#60a5fa', padding: '3px 8px', borderRadius: '3px', fontSize: '10px', fontWeight: '800', cursor: 'pointer' }}
            >
              RESET PAN
            </button>
          </div>

        </div>
      )}

    </div>
  );
};
