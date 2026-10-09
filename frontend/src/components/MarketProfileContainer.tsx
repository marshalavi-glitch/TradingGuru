import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { getBackendHttpUrl, tvStreamer } from '../utils/tvStreamer';
import { groupCandlesByDay, calculateDayProfile, Candle, DayProfile, TPOBin, detectOpeningType, OpeningTypeAnalysis, detectDayType, DayTypeAnalysis, detectValuePlacement, ValuePlacementAnalysis, StandardValuePlacement } from '../utils/profileCalculator';
import { resolveSymbol } from '../utils/symbolResolver';
import { filterMarketHoursCandles, isWithinMarketHours } from '../utils/marketHours';
import { RefreshCw, ZoomIn, ZoomOut, Move, BarChart2, TrendingUp, TrendingDown, ShieldAlert, Zap, Sliders, ChevronLeft, ChevronRight, ArrowLeft, ArrowRight, RotateCcw, Pin, PinOff, Camera, Check, Copy, X, Maximize2, Minimize2, ExternalLink } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

interface MarketProfileContainerProps {
  selectedSymbol?: string;
  onSymbolSelect?: (symbol: string) => void;
  onSwitchToChart?: () => void;
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

function formatDayNumber(dateStr: string): string {
  const parts = dateStr.split('-');
  if (parts.length < 3) return dateStr;
  return parseInt(parts[2], 10).toString();
}

function getLetterColor(letter: string): string {
  const code = letter.toUpperCase().charCodeAt(0);
  if (code >= 65 && code <= 66) return '#10b981'; // A-B: Initial Balance Green
  if (code >= 67 && code <= 70) return '#3b82f6'; // C-F: Royal Blue (Morning Session)
  if (code >= 71 && code <= 74) return '#00f0ff'; // G-J: Cyan (Midday)
  if (code >= 75 && code <= 78) return '#8b5cf6'; // K-N: Purple (Afternoon)
  if (code >= 79 && code <= 82) return '#ec4899'; // O-R: Pink (Late Afternoon)
  if (code >= 83 && code <= 86) return '#f59e0b'; // S-V: Amber/Orange (Pre-Close)
  return '#ef4444'; // W-Z and lower: Red
}

export const MarketProfileContainer: React.FC<MarketProfileContainerProps> = ({
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
    return selectedSymbol || 'NSE:NIFTY1!';
  });
  const [timeframe, setTimeframe] = useState<string>(() => {
    try {
      const p = new URLSearchParams(window.location.search);
      const tf = p.get('timeframe');
      if (tf) return tf;
    } catch (e) {}
    return '30';
  }); // 30m default for standard TPO
  const [lookbackDays, setLookbackDays] = useState<number>(10);
  const [profileMode, setProfileMode] = useState<'tpo-collapsed' | 'tpo-split' | 'volume' | 'mp-vp'>('tpo-collapsed');
  const [theme, setTheme] = useState<'dark-slate' | 'dark'>('dark-slate');

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
  const [yScale, setYScale] = useState<number>(1.0); // Vertical price scale multiplier
  const [xScale, setXScale] = useState<number>(1.0); // Horizontal time/session scale multiplier

  // Saved scales to restore on exit
  const prevScaleRef = useRef<{ yScale: number; xScale: number; zoomLevel: number }>({ yScale: 1.0, xScale: 1.0, zoomLevel: 1.0 });

  // Toggle Fullscreen: covers dashboard with fixed overlay + native fullscreen and increases scale
  const toggleFullscreen = useCallback(() => {
    setIsExpanded((prev) => {
      const next = !prev;
      if (next) {
        // Save current scale and boost scale so profiles, letters and price axis are enlarged & clear
        prevScaleRef.current = { yScale, xScale, zoomLevel };
        setYScale(prevY => Math.max(1.85, prevY * 1.6));
        setXScale(prevX => Math.max(1.35, prevX * 1.3));
        setZoomLevel(prevZ => Math.max(1.2, prevZ * 1.2));

        if (containerRef.current && containerRef.current.requestFullscreen) {
          containerRef.current.requestFullscreen().catch(() => {});
        }
      } else {
        // Restore scale when exiting fullscreen
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
    params.set('tab', 'market_profile');
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

  // Customization Options
  const [gridStep, setGridStep] = useState<number>(20); // 20 points price step as requested
  const [highlightSinglePrints, setHighlightSinglePrints] = useState<boolean>(true);
  const [showIbLine, setShowIbLine] = useState<boolean>(true);
  const [showPoorHighLow, setShowPoorHighLow] = useState<boolean>(true);
  const [extendPocMode, setExtendPocMode] = useState<'untested_only' | 'all' | 'none'>('untested_only');
  const [showTwoDayBalance, setShowTwoDayBalance] = useState<boolean>(true);

  // Decoupled Interactive Scaling & Axis Dragging State
  const [panOffset, setPanOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [dragMode, setDragMode] = useState<'none' | 'pan' | 'y-axis' | 'x-axis'>('none');
  const [dragStartPos, setDragStartPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [initialYScale, setInitialYScale] = useState<number>(1.0);
  const [initialXScale, setInitialXScale] = useState<number>(1.0);
  const [initialPanOffset, setInitialPanOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [hoveredAxis, setHoveredAxis] = useState<'none' | 'y-axis' | 'x-axis'>('none');
  const [cursorStyle, setCursorStyle] = useState<string>('crosshair');

  const [candles, setCandles] = useState<Candle[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Real-Time Current Price (LTP) & Live Streamer Synchronization State
  const [liveLtp, setLiveLtp] = useState<number | null>(null);
  const [lastTickTime, setLastTickTime] = useState<number | null>(null);
  const [streamStatus, setStreamStatus] = useState<'LIVE' | 'DISCONNECTED'>('LIVE');
  const liveLtpRef = useRef<number | null>(null);
  const lastTickTimeRef = useRef<number | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 640 });
  const [hoveredSessionIdx, setHoveredSessionIdx] = useState<number>(-1);
  const [hoverInfo, setHoverInfo] = useState<{
    profile: DayProfile;
    bin: TPOBin;
    x: number;
    y: number;
    isSinglePrint?: boolean;
  } | null>(null);
  const [pinnedInfo, setPinnedInfo] = useState<{
    profile: DayProfile;
    bin: TPOBin;
    x: number;
    y: number;
    isSinglePrint?: boolean;
  } | null>(null);
  const [screenshotStatus, setScreenshotStatus] = useState<string | null>(null);
  const [crosshairPos, setCrosshairPos] = useState<{
    x: number;
    y: number;
    price: number;
    dateStr?: string;
  } | null>(null);

  // Sync with incoming selectedSymbol from App.tsx (e.g. from watchlist, search, options chain, or other tabs)
  useEffect(() => {
    if (selectedSymbol && selectedSymbol !== symbol) {
      setSymbol(selectedSymbol);
      const isOpt = selectedSymbol.startsWith('NFO:') || selectedSymbol.includes('CE') || selectedSymbol.includes('PE');
      if (isOpt) {
        setGridStep(1); // Auto-adapt 1 point grid step for options contracts
      } else if (selectedSymbol.includes('1!') || selectedSymbol.includes('FUT')) {
        if (selectedSymbol.includes('NIFTY') && !selectedSymbol.includes('BANK')) setGridStep(20);
      } else if (selectedSymbol.includes('NIFTY') || selectedSymbol.includes('SENSEX')) {
        if (selectedSymbol.includes('NIFTY') && !selectedSymbol.includes('BANK')) setGridStep(20);
      } else {
        setGridStep(5);
      }
    }
  }, [selectedSymbol]);

  const activeSymbolInfo = useMemo(() => {
    return resolveSymbol(symbol);
  }, [symbol]);

  // Fetch candles with auto-retry & symbol fallback
  const fetchCandles = async (sym: string, tf: string, daysCount: number = lookbackDays, silent: boolean = false) => {
    if (!silent) setLoading(true);
    if (!silent) setError(null);
    let attempts = 0;
    const maxAttempts = 3;
    const multiplier = tf === '5' ? 85 : tf === '15' ? 40 : 35;
    const reqLimit = Math.min(1500, Math.max(450, (daysCount + 1) * multiplier));
    
    while (attempts < maxAttempts) {
      try {
        attempts++;
        const backendHttp = await getBackendHttpUrl();
        const res = await fetch(`${backendHttp}/api/candles?symbol=${encodeURIComponent(sym)}&timeframe=${tf}&limit=${reqLimit}`);
        if (res.ok) {
          const data = await res.json();
          if (data.candles && data.candles.length > 0) {
            setCandles(filterMarketHoursCandles(data.candles, sym, tf));
            const last = data.candles[data.candles.length - 1];
            if (last && typeof last.close === 'number') {
              setLiveLtp(last.close);
              liveLtpRef.current = last.close;
              const now = Date.now();
              setLastTickTime(now);
              lastTickTimeRef.current = now;
              setStreamStatus('LIVE');
            }
            setError(null);
            if (!silent) setLoading(false);
            return;
          } else if (sym.includes('1!')) {
            const fallbackSym = sym.replace('1!', '');
            const fbRes = await fetch(`${backendHttp}/api/candles?symbol=${encodeURIComponent(fallbackSym)}&timeframe=${tf}&limit=${reqLimit}`);
            if (fbRes.ok) {
              const fbData = await fbRes.json();
              if (fbData.candles && fbData.candles.length > 0) {
                setCandles(filterMarketHoursCandles(fbData.candles, fallbackSym, tf));
                const last = fbData.candles[fbData.candles.length - 1];
                if (last && typeof last.close === 'number') {
                  setLiveLtp(last.close);
                  liveLtpRef.current = last.close;
                  const now = Date.now();
                  setLastTickTime(now);
                  lastTickTimeRef.current = now;
                  setStreamStatus('LIVE');
                }
                setError(null);
                if (!silent) setLoading(false);
                return;
              }
            }
          }
        }
      } catch (err: any) {
        console.warn(`[MarketProfileContainer] Fetch attempt ${attempts} failed:`, err);
      }
      if (attempts < maxAttempts) {
        await new Promise(r => setTimeout(r, attempts * 800));
      }
    }
    
    if (!silent) {
      setError(`Market feed connecting for ${sym}...`);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCandles(symbol, timeframe, lookbackDays);
  }, [symbol, timeframe, lookbackDays]);

  // Real-Time Tick-by-Tick Synchronization from Dashboard's Centralized Live Market Data Stream (tvStreamer)
  useEffect(() => {
    let isMounted = true;

    // 1. Initial cached quote check
    const cached = tvStreamer.getLatestLtp(symbol);
    if (cached) {
      setLiveLtp(cached.ltp);
      liveLtpRef.current = cached.ltp;
      setLastTickTime(cached.timestamp);
      lastTickTimeRef.current = cached.timestamp;
      setStreamStatus('LIVE');
    }

    // 2. Subscribe to centralized WebSocket / polling stream
    const unsubscribeStream = tvStreamer.subscribe(
      symbol,
      timeframe,
      (payload) => {
        if (!isMounted) return;
        if (payload.candles && payload.candles.length > 0) {
          const lastCandle = payload.candles[payload.candles.length - 1];
          if (lastCandle && typeof lastCandle.close === 'number') {
            const now = Date.now();
            setLiveLtp(lastCandle.close);
            liveLtpRef.current = lastCandle.close;
            setLastTickTime(now);
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

    // 3. Centralized tick listener to capture instantaneous ticks across all tabs
    const unsubscribeTicks = tvStreamer.addTickListener((tick) => {
      if (!isMounted) return;
      const cleanTarget = symbol.replace(/^(NSE:|BSE:|MCX:|NFO:)/, '').trim().toUpperCase();
      const cleanTick = tick.symbol.replace(/^(NSE:|BSE:|MCX:|NFO:)/, '').trim().toUpperCase();
      if (cleanTarget === cleanTick) {
        setLiveLtp(tick.ltp);
        liveLtpRef.current = tick.ltp;
        setLastTickTime(tick.timestamp);
        lastTickTimeRef.current = tick.timestamp;
        setStreamStatus('LIVE');

        // Dynamically update latest candle high/low/close only during official market hours
        if (!isWithinMarketHours(Math.floor(Date.now() / 1000), symbol, timeframe)) {
          return; // Do not alter completed candles during pre-open (9:00-9:15 AM) or after 3:30 PM
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

    // 5. Silent background refresh interval (5s) to guarantee zero lag even during network hiccups
    const pollInterval = setInterval(() => {
      if (isMounted) {
        fetchCandles(symbol, timeframe, lookbackDays, true);
      }
    }, 5000);

    return () => {
      isMounted = false;
      unsubscribeStream();
      unsubscribeTicks();
      unsubscribeStatus();
      clearInterval(pollInterval);
    };
  }, [symbol, timeframe]);

  // Continuous Live Stream Monitor: Maintain 100% active LIVE feed
  useEffect(() => {
    const timer = setInterval(() => {
      const tvStatus = tvStreamer.getStatus();
      if (tvStatus === 'disconnected') {
        setStreamStatus('DISCONNECTED');
        return;
      }

      setStreamStatus('LIVE');
      const now = Date.now();
      const lastTime = lastTickTimeRef.current;
      if (!lastTime || now - lastTime > 2500) {
        lastTickTimeRef.current = now;
        setLastTickTime(now);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Compute daily profiles sorted chronologically
  const dayProfiles: DayProfile[] = useMemo(() => {
    if (!candles || candles.length === 0) return [];
    const grouped = groupCandlesByDay(candles, symbol);
    const sortedDates = Object.keys(grouped).sort();
    
    // Slice to recent lookback days
    const targetDates = sortedDates.slice(-lookbackDays);
    
    const profiles: DayProfile[] = [];
    for (const dateStr of targetDates) {
      const dayCandles = grouped[dateStr];
      if (dayCandles && dayCandles.length > 0) {
        const prof = calculateDayProfile(dateStr, dayCandles, 50, 'daily', undefined, undefined, symbol);
        if (prof.bins && prof.bins.length > 0) {
          profiles.push(prof);
        }
      }
    }

    for (let i = 0; i < profiles.length; i++) {
      const prior = i > 0 ? profiles[i - 1] : undefined;
      profiles[i].valuePlacementInfo = detectValuePlacement(profiles[i], prior) || undefined;
    }

    return profiles;
  }, [candles, lookbackDays, symbol]);

  // Keyboard shortcut listener for Pin/Unpin (P) and Unpin (Esc)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }
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
            x: 80,
            y: 120
          });
        }
      } else if (e.key === 'Escape') {
        setPinnedInfo(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [pinnedInfo, hoverInfo, dayProfiles]);

  // Calculate POC Test / Extension Status across sessions
  const pocTestStatusMap = useMemo(() => {
    return dayProfiles.map((p, i) => {
      const poc = p.pocPrice;
      let testedIdx = -1;
      let testedDate = '';

      for (let j = i + 1; j < dayProfiles.length; j++) {
        const nextDay = dayProfiles[j];
        if (nextDay.dayLow <= poc && poc <= nextDay.dayHigh) {
          testedIdx = j;
          testedDate = nextDay.dateStr;
          break;
        }
      }

      return {
        sessionIdx: i,
        dateStr: p.dateStr,
        pocPrice: poc,
        isTested: testedIdx !== -1,
        testedSessionIdx: testedIdx,
        testedDate
      };
    });
  }, [dayProfiles]);

  // Calculate 2-Day Balances with Inner Logic: Previous Day value is inside One Day Prior value
  const twoDayBalances = useMemo(() => {
    if (!dayProfiles || dayProfiles.length < 2) return [];
    const list: Array<{
      priorIdx: number;
      prevIdx: number;
      priorDate: string;
      prevDate: string;
      balanceHigh: number;
      balanceLow: number;
      balanceVah: number;
      balanceVal: number;
      balancePoc: number;
      isVaInner: boolean;
      isRangeInner: boolean;
      isStrictInner: boolean;
      breakoutStatus: 'BULLISH' | 'BEARISH' | 'IN_BALANCE';
    }> = [];

    for (let i = 1; i < dayProfiles.length; i++) {
      const prior = dayProfiles[i - 1]; // Day T-2 (One Day Prior)
      const prev = dayProfiles[i];     // Day T-1 (Previous Day)

      const isVaInner = prev.vahPrice <= (prior.vahPrice * 1.001) && prev.valPrice >= (prior.valPrice * 0.999);
      const isRangeInner = prev.dayHigh <= (prior.dayHigh * 1.001) && prev.dayLow >= (prior.dayLow * 0.999);

      if (isVaInner || isRangeInner) {
        const balanceHigh = Math.max(prior.dayHigh, prev.dayHigh);
        const balanceLow = Math.min(prior.dayLow, prev.dayLow);
        const balanceVah = Math.max(prior.vahPrice, prev.vahPrice);
        const balanceVal = Math.min(prior.valPrice, prev.valPrice);
        const balancePoc = (prior.pocPrice + prev.pocPrice) / 2;

        let breakoutStatus: 'BULLISH' | 'BEARISH' | 'IN_BALANCE' = 'IN_BALANCE';
        const nextDay = (i + 1 < dayProfiles.length) ? dayProfiles[i + 1] : null;
        if (nextDay) {
          if (nextDay.closePrice > balanceHigh || nextDay.dayHigh > balanceHigh) {
            breakoutStatus = 'BULLISH';
          } else if (nextDay.closePrice < balanceLow || nextDay.dayLow < balanceLow) {
            breakoutStatus = 'BEARISH';
          }
        }

        list.push({
          priorIdx: i - 1,
          prevIdx: i,
          priorDate: prior.dateStr,
          prevDate: prev.dateStr,
          balanceHigh,
          balanceLow,
          balanceVah,
          balanceVal,
          balancePoc,
          isVaInner,
          isRangeInner,
          isStrictInner: isVaInner && isRangeInner,
          breakoutStatus
        });
      }
    }
    return list;
  }, [dayProfiles]);

  // Calculate Poor / Weak High & Low Status across sessions (Dalton Unfinished Business)
  const poorHighLowStatusMap = useMemo(() => {
    return dayProfiles.map((p, i) => {
      const bins = p.bins;
      if (!bins || bins.length === 0) {
        return {
          sessionIdx: i,
          dateStr: p.dateStr,
          isPoorHigh: false,
          isWeakHigh: false,
          highPrice: p.dayHigh,
          isHighUnfinished: false,
          highRepairedSessionIdx: -1,
          highRepairedDate: '',
          highTpoCount: 0,
          isPoorLow: false,
          isWeakLow: false,
          lowPrice: p.dayLow,
          isLowUnfinished: false,
          lowRepairedSessionIdx: -1,
          lowRepairedDate: '',
          lowTpoCount: 0
        };
      }

      // Top bin (Extreme High)
      const topBin = bins[0];
      const highTpoCount = topBin ? topBin.tpos.length : 0;
      // Poor High: Flat top without excess tail (>= 2 TPOs at absolute extreme)
      const isPoorHigh = highTpoCount >= 2;
      // Weak High: Exactly 1 TPO at extreme, but bin below has >= 2 TPOs (1-tick single print; lacking Dalton 2+ tick excess tail)
      const isWeakHigh = !isPoorHigh && highTpoCount === 1 && (bins.length > 1 && bins[1].tpos.length >= 2);

      // Bottom bin (Extreme Low)
      const btmBin = bins[bins.length - 1];
      const lowTpoCount = btmBin ? btmBin.tpos.length : 0;
      // Poor Low: Flat bottom without excess tail (>= 2 TPOs at absolute extreme)
      const isPoorLow = lowTpoCount >= 2;
      // Weak Low: Exactly 1 TPO at extreme, but bin above has >= 2 TPOs (1-tick single print; lacking Dalton 2+ tick excess tail)
      const isWeakLow = !isPoorLow && lowTpoCount === 1 && (bins.length > 1 && bins[bins.length - 2].tpos.length >= 2);

      // Subsequent session resolution (Unfinished Business check)
      let highRepairedIdx = -1;
      let highRepairedDate = '';
      if (isPoorHigh || isWeakHigh) {
        for (let j = i + 1; j < dayProfiles.length; j++) {
          const nextDay = dayProfiles[j];
          if (nextDay.dayHigh >= p.dayHigh) {
            highRepairedIdx = j;
            highRepairedDate = nextDay.dateStr;
            break;
          }
        }
      }

      let lowRepairedIdx = -1;
      let lowRepairedDate = '';
      if (isPoorLow || isWeakLow) {
        for (let j = i + 1; j < dayProfiles.length; j++) {
          const nextDay = dayProfiles[j];
          if (nextDay.dayLow <= p.dayLow) {
            lowRepairedIdx = j;
            lowRepairedDate = nextDay.dateStr;
            break;
          }
        }
      }

      return {
        sessionIdx: i,
        dateStr: p.dateStr,
        isPoorHigh,
        isWeakHigh,
        highPrice: p.dayHigh,
        isHighUnfinished: (isPoorHigh || isWeakHigh) && highRepairedIdx === -1,
        highRepairedSessionIdx: highRepairedIdx,
        highRepairedDate,
        highTpoCount,
        isPoorLow,
        isWeakLow,
        lowPrice: p.dayLow,
        isLowUnfinished: (isPoorLow || isWeakLow) && lowRepairedIdx === -1,
        lowRepairedSessionIdx: lowRepairedIdx,
        lowRepairedDate,
        lowTpoCount
      };
    });
  }, [dayProfiles]);

  // Resize canvas container listener
  useEffect(() => {
    const handleResize = () => {
      if (canvasContainerRef.current) {
        const clientH = canvasContainerRef.current.clientHeight;
        const targetH = isExpanded || isStandalone
          ? Math.max(650, window.innerHeight - 65)
          : Math.max(560, clientH || 640);
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

  // Reset zoom, scale & pan when symbol, timeframe, or lookback changes
  useEffect(() => {
    setZoomLevel(1.0);
    setYScale(1.0);
    setXScale(1.0);
    setPanOffset({ x: 0, y: 0 });
  }, [symbol, timeframe, lookbackDays]);

  // Window-level mouseup listener to guarantee clean drag release anywhere on screen
  useEffect(() => {
    const handleGlobalMouseUp = () => {
      setDragMode('none');
    };
    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => window.removeEventListener('mouseup', handleGlobalMouseUp);
  }, []);

  // Handle Mouse Wheel Zooming, Horizontal Pan, and Axis Scaling
  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const padding = { top: 40, bottom: 45, left: 20, right: 75 };

    if (mouseX >= rect.width - padding.right) {
      // Mouse wheel over Price Axis (Y) scales price vertically!
      const factor = e.deltaY < 0 ? 1.12 : 0.88;
      setYScale(prev => Math.min(10.0, Math.max(0.15, prev * factor)));
      return;
    }

    if (mouseY >= rect.height - padding.bottom) {
      // Mouse wheel over Time Axis (X) scales sessions horizontally!
      const factor = e.deltaY < 0 ? 1.12 : 0.88;
      setXScale(prev => Math.min(10.0, Math.max(0.2, prev * factor)));
      return;
    }

    if (e.shiftKey || Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
      setPanOffset((prev) => ({ ...prev, x: prev.x - (e.deltaX || e.deltaY) * 0.8 }));
    } else {
      const zoomFactor = e.deltaY < 0 ? 1.15 : 0.85;
      setZoomLevel((prev) => Math.min(5.0, Math.max(0.4, prev * zoomFactor)));
    }
  };

  // Handle Mouse Down on Canvas: Detect Click on Price Axis, Time Axis, or Chart Area
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const padding = { top: 40, bottom: 45, left: 20, right: 75 };

    setDragStartPos({ x: e.clientX, y: e.clientY });
    setInitialYScale(yScale);
    setInitialXScale(xScale);
    setInitialPanOffset(panOffset);

    if (mouseX >= rect.width - padding.right) {
      // User clicked on Right Y-Axis (Price Axis)
      setDragMode('y-axis');
      setCursorStyle('ns-resize');
    } else if (mouseY >= rect.height - padding.bottom) {
      // User clicked on Bottom X-Axis (Time Axis)
      setDragMode('x-axis');
      setCursorStyle('ew-resize');
    } else {
      // User clicked on Chart Canvas (Pan)
      setDragMode('pan');
      setCursorStyle('grabbing');
    }
  };

  const handleMouseUp = (e?: React.MouseEvent<HTMLCanvasElement>) => {
    if (e && dragStartPos) {
      const dist = Math.hypot(e.clientX - dragStartPos.x, e.clientY - dragStartPos.y);
      if (dist < 6) {
        // Quick click on chart: toggle pin!
        if (hoverInfo) {
          if (pinnedInfo && pinnedInfo.profile.dateStr === hoverInfo.profile.dateStr && Math.abs(pinnedInfo.bin.price - hoverInfo.bin.price) < 0.01) {
            setPinnedInfo(null);
          } else {
            setPinnedInfo(hoverInfo);
          }
        }
      }
    }
    setDragMode('none');
  };

  const handleMouseLeave = () => {
    setDragMode('none');
    setCrosshairPos(null);
    if (!pinnedInfo) {
      setHoverInfo(null);
    }
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
      ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
      ctx.fillRect(0, 0, exportCanvas.width, 36);
      ctx.strokeStyle = 'rgba(0, 240, 255, 0.4)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, 36);
      ctx.lineTo(exportCanvas.width, 36);
      ctx.stroke();

      ctx.fillStyle = '#00f0ff';
      ctx.font = 'bold 13px "Outfit", sans-serif';
      ctx.fillText(`📊 Trading Guru • Market Profile • ${symbol} (${timeframe}m)`, 16, 23);

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
        const cardY = Math.max(50, Math.min(exportCanvas.height - 330, infoToRender.y - 40));
        const cardW = 280;
        const cardH = 265;

        // Card background
        ctx.fillStyle = 'rgba(11, 19, 38, 0.96)';
        ctx.beginPath();
        ctx.roundRect(cardX, cardY, cardW, cardH, 8);
        ctx.fill();

        ctx.strokeStyle = '#00f0ff';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Card Title
        ctx.fillStyle = '#00f0ff';
        ctx.font = 'bold 11px "Outfit", sans-serif';
        ctx.fillText(`📅 Session: ${formatDateShort(infoToRender.profile.dateStr)} (${infoToRender.profile.dateStr})`, cardX + 12, cardY + 22);

        // Opening Type
        const op = infoToRender.profile.openingTypeInfo || detectOpeningType(infoToRender.profile);
        ctx.fillStyle = op.badgeColor;
        ctx.font = 'bold 11px "JetBrains Mono", monospace';
        ctx.fillText(`Opening: ${op.type} ${op.direction !== 'Neutral' ? `(${op.direction})` : ''}`, cardX + 12, cardY + 44);

        // Day Type
        const dt = infoToRender.profile.dayTypeInfo || detectDayType(infoToRender.profile);
        ctx.fillStyle = dt.badgeColor;
        ctx.fillText(`Day Type: ${dt.type} • IB: ${dt.ibType}`, cardX + 12, cardY + 64);

        // Value Area & POC
        ctx.fillStyle = '#ffffff';
        ctx.font = '10.5px "JetBrains Mono", monospace';
        ctx.fillText(`VAH: ₹${infoToRender.profile.vahPrice.toFixed(2)}`, cardX + 12, cardY + 90);
        ctx.fillStyle = '#00f0ff';
        ctx.fillText(`POC: ₹${infoToRender.profile.pocPrice.toFixed(2)} (Point of Control)`, cardX + 12, cardY + 108);
        ctx.fillStyle = '#ffffff';
        ctx.fillText(`VAL: ₹${infoToRender.profile.valPrice.toFixed(2)}`, cardX + 12, cardY + 126);

        // IB High / Low
        ctx.fillStyle = '#fbbf24';
        ctx.fillText(`IB High: ₹${infoToRender.profile.ibHigh.toFixed(2)} | IB Low: ₹${infoToRender.profile.ibLow.toFixed(2)}`, cardX + 12, cardY + 148);

        // Volume & TPO Count
        ctx.fillStyle = '#cbd5e1';
        ctx.font = '10px "JetBrains Mono", monospace';
        ctx.fillText(`Session Volume: ${Math.round(infoToRender.profile.totalVolume).toLocaleString()}`, cardX + 12, cardY + 172);
        ctx.fillText(`Total TPOs: ${infoToRender.profile.totalTpoCount} prints`, cardX + 12, cardY + 190);

        // Selected Level
        ctx.fillStyle = '#38bdf8';
        ctx.fillText(`Price Level: ₹${infoToRender.bin.price.toFixed(2)} (${infoToRender.bin.tpos.length} TPOs: ${infoToRender.bin.tpos.join('')})`, cardX + 12, cardY + 212);

        // Badge Footer
        ctx.fillStyle = 'rgba(0, 240, 255, 0.15)';
        ctx.fillRect(cardX + 10, cardY + 228, cardW - 20, 24);
        ctx.fillStyle = '#00f0ff';
        ctx.font = 'bold 10px "Outfit", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`📌 PINNED TRADING GURU PROFILE`, cardX + cardW / 2, cardY + 244);

        ctx.restore();
      }

      // Convert to blob
      exportCanvas.toBlob(async (blob) => {
        if (!blob) return;

        // Copy to clipboard
        try {
          if (navigator.clipboard && (window as any).ClipboardItem) {
            await navigator.clipboard.write([
              new ClipboardItem({ 'image/png': blob })
            ]);
            setScreenshotStatus('Copied to Clipboard!');
          }
        } catch (e) {}

        // Trigger file download
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        const cleanSym = symbol.replace(/[^a-zA-Z0-9]/g, '_');
        link.download = `MarketProfile_${cleanSym}_${new Date().toISOString().slice(0, 10)}.png`;
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

  const handleDoubleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const padding = { top: 40, bottom: 45, left: 20, right: 75 };

    if (mouseX >= rect.width - padding.right) {
      // Reset only Y price scale
      setYScale(1.0);
      setPanOffset(prev => ({ ...prev, y: 0 }));
    } else if (mouseY >= rect.height - padding.bottom) {
      // Reset only X time scale
      setXScale(1.0);
      setPanOffset(prev => ({ ...prev, x: 0 }));
    } else {
      // Reset all scales and pans
      setZoomLevel(1.0);
      setYScale(1.0);
      setXScale(1.0);
      setPanOffset({ x: 0, y: 0 });
    }
  };

  // Multi-session Canvas Renderer with POC Testing / Extension logic
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

    const isDarkSlate = isDark && theme === 'dark-slate';
    const bgColor = !isDark ? '#ffffff' : (isDarkSlate ? '#181c27' : '#0d1017');
    const gridLineColor = !isDark ? 'rgba(0, 0, 0, 0.06)' : (isDarkSlate ? 'rgba(255, 255, 255, 0.06)' : 'rgba(255, 255, 255, 0.04)');
    const textColor = !isDark ? '#334155' : (isDarkSlate ? '#94a3b8' : '#6b7280');

    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, width, height);

    const padding = { top: 40, bottom: 45, left: 20, right: 75 };
    const baseChartWidth = width - padding.left - padding.right;
    const baseChartHeight = height - padding.top - padding.bottom;

    // Calculate global price bounds across all visible profiles
    let globalMin = Infinity;
    let globalMax = -Infinity;

    dayProfiles.forEach(p => {
      if (p.dayLow < globalMin) globalMin = p.dayLow;
      if (p.dayHigh > globalMax) globalMax = p.dayHigh;
    });

    if (globalMin === Infinity || globalMax === -Infinity || globalMin >= globalMax) return;

    // Apply Zoom & Pan to price range and vertical scaling
    const pMargin = (globalMax - globalMin) * 0.03;
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

    // 1. Draw Price Axis Grid Lines Spaced by 20 Points
    const step = gridStep > 0 ? gridStep : 20;
    const startTick = Math.floor(minPrice / step) * step;
    const endTick = Math.ceil(maxPrice / step) * step;

    ctx.font = '10px "JetBrains Mono", monospace';
    ctx.textAlign = 'left';

    for (let priceTick = startTick; priceTick <= endTick; priceTick += step) {
      const y = getPriceY(priceTick);

      if (y >= padding.top && y <= height - padding.bottom) {
        ctx.strokeStyle = gridLineColor;
        ctx.lineWidth = 1;
        ctx.setLineDash([2, 4]);
        ctx.beginPath();
        ctx.moveTo(padding.left, y);
        ctx.lineTo(width - padding.right, y);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.fillStyle = textColor;
        ctx.fillText(priceTick.toFixed(1), width - padding.right + 8, y + 3.5);
      }
    }

    // Vertical Y-axis border
    ctx.strokeStyle = isDarkSlate ? 'rgba(255, 255, 255, 0.12)' : 'rgba(255, 255, 255, 0.08)';
    ctx.beginPath();
    ctx.moveTo(width - padding.right, padding.top);
    ctx.lineTo(width - padding.right, height - padding.bottom);
    ctx.stroke();

    // Render session columns side by side with panOffset.x support
    const sessionCount = dayProfiles.length;
    const colGap = Math.max(3, 8 * zoomLevel * xScale);
    const availWidthForCols = baseChartWidth - (sessionCount - 1) * colGap;
    const minColW = (profileMode === 'tpo-split' ? 70 : (profileMode === 'mp-vp' ? 85 : 26)) * zoomLevel * xScale;
    const colWidth = Math.max(minColW, (availWidthForCols / sessionCount) * zoomLevel * xScale);

    // Clip rendering area inside padding boundaries
    ctx.save();
    ctx.beginPath();
    ctx.rect(padding.left, padding.top, baseChartWidth, baseChartHeight);
    ctx.clip();

    dayProfiles.forEach((profile, sIdx) => {
      const colStartX = padding.left + panOffset.x + sIdx * (colWidth + colGap);
      const colEndX = colStartX + colWidth;

      // Skip rendering if column is entirely outside visible canvas horizontal bounds
      if (colEndX < padding.left || colStartX > width - padding.right) return;

      // 2. TradingView Style X-Axis Date & Time Plotting
      const dayNum = formatDayNumber(profile.dateStr);
      ctx.fillStyle = isDarkSlate ? '#f1f5f9' : '#ffffff';
      ctx.font = `bold ${Math.max(10, Math.min(13, 11 * Math.sqrt(zoomLevel)))}px "Outfit", sans-serif`;
      ctx.textAlign = 'center';
      
      // Top row: Day Date Number (e.g. 8, 9, 10, 11, 15, 16)
      ctx.fillText(dayNum, colStartX + colWidth * 0.25, height - padding.bottom + 18);

      // Sub-row: Intraday Time Marker (e.g. 12:15 midpoint as in TradingView)
      ctx.fillStyle = isDarkSlate ? '#94a3b8' : '#6b7280';
      ctx.font = '10px "JetBrains Mono", monospace';
      ctx.fillText('12:15', colStartX + colWidth * 0.75, height - padding.bottom + 18);

      // Small vertical tick mark on bottom X axis
      ctx.strokeStyle = isDarkSlate ? 'rgba(255, 255, 255, 0.2)' : 'rgba(255, 255, 255, 0.1)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(colStartX + colWidth * 0.75, height - padding.bottom);
      ctx.lineTo(colStartX + colWidth * 0.75, height - padding.bottom + 5);
      ctx.stroke();

      // Opening Type Short Badge on bottom ruler
      const opInfo = profile.openingTypeInfo || detectOpeningType(profile);
      const isHoveredCol = hoveredSessionIdx === sIdx;
      const opLabel = opInfo.type === 'Open-Rejection-Reverse' ? 'ORR' : (opInfo.type === 'Open-Test-Drive' ? 'OTD' : (opInfo.type === 'Open-Drive' ? 'OD' : (opInfo.type === 'Open-Auction' ? 'OA' : 'Unclass')));
      const dirArrow = opInfo.direction === 'Bullish' ? '▲' : (opInfo.direction === 'Bearish' ? '▼' : '');
      const opTag = `${opLabel} ${dirArrow}`.trim();

      ctx.font = `bold ${isHoveredCol ? '10px' : '9px'} "JetBrains Mono", monospace`;
      const opTagWidth = ctx.measureText(opTag).width;
      const opPillX = colStartX + colWidth / 2 - opTagWidth / 2 - 3;
      const opPillY = height - padding.bottom + 32;

      if (isHoveredCol) {
        ctx.fillStyle = isDarkSlate ? 'rgba(0, 0, 0, 0.75)' : 'rgba(255, 255, 255, 0.95)';
        ctx.fillRect(opPillX, opPillY - 9, opTagWidth + 6, 12);
        ctx.strokeStyle = opInfo.badgeColor;
        ctx.lineWidth = 1;
        ctx.strokeRect(opPillX, opPillY - 9, opTagWidth + 6, 12);
      }

      ctx.fillStyle = isHoveredCol ? opInfo.badgeColor : (isDarkSlate ? 'rgba(255, 255, 255, 0.6)' : '#475569');
      ctx.textAlign = 'center';
      ctx.fillText(opTag, colStartX + colWidth / 2, opPillY);

      // Light column background highlight
      ctx.fillStyle = isDarkSlate ? 'rgba(255, 255, 255, 0.015)' : 'rgba(255, 255, 255, 0.01)';
      ctx.fillRect(colStartX, padding.top, colWidth, baseChartHeight);

      // Session separator vertical line
      if (sIdx > 0) {
        ctx.strokeStyle = isDarkSlate ? 'rgba(255, 255, 255, 0.08)' : 'rgba(255, 255, 255, 0.04)';
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(colStartX - colGap / 2, padding.top);
        ctx.lineTo(colStartX - colGap / 2, height - padding.bottom);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // Pink / Purple Value Area Shading Box
      if (profile.vahPrice && profile.valPrice) {
        const vahY = getPriceY(profile.vahPrice);
        const valY = getPriceY(profile.valPrice);
        if (vahY < height - padding.bottom && valY > padding.top) {
          ctx.fillStyle = 'rgba(236, 72, 153, 0.08)';
          ctx.fillRect(colStartX, Math.max(padding.top, vahY), colWidth, Math.min(baseChartHeight, valY - vahY));
        }
      }

      const bins = profile.bins;
      if (bins.length === 0) return;

      const binStep = bins.length > 1 ? Math.abs(bins[0].price - bins[1].price) : profile.tickSize;
      const rawRowHeight = (binStep / priceRange) * baseChartHeight;
      const rowHeight = Math.max(2, rawRowHeight);

      let maxTpoCountInBin = 1;
      let maxVolInBin = 1;
      let maxVolPrice = profile.pocPrice;
      bins.forEach(b => {
        if (b.tpos.length > maxTpoCountInBin) maxTpoCountInBin = b.tpos.length;
        if (b.volume > maxVolInBin) {
          maxVolInBin = b.volume;
          maxVolPrice = b.price;
        }
      });

      const baseBlockSize = Math.max(2, Math.min(22, (rowHeight - 0.5)));
      const showLetters = baseBlockSize >= 9 && profileMode !== 'volume';
      const blockGap = showLetters ? 1 : 0.5;

      const uniqueLetters = Array.from(new Set(
        bins.flatMap(b => b.tpos)
      )).sort((a, b) => {
        const getIdx = (l: string) => {
          const code = l.charCodeAt(0);
          return code >= 97 ? code - 97 + 26 : code - 65;
        };
        return getIdx(a) - getIdx(b);
      });

      const splitStep = Math.max(9, Math.min(22, (colWidth / Math.max(1, uniqueLetters.length))));
      const splitWidth = Math.max(7, splitStep - 1);

      if (profileMode === 'tpo-split') {
        uniqueLetters.forEach((letter, uIdx) => {
          const subX = colStartX + uIdx * splitStep;
          if (subX + splitWidth <= colEndX) {
            // Top Header Box for TPO Letter
            ctx.fillStyle = getLetterColor(letter);
            ctx.fillRect(subX, padding.top - 18, splitWidth, 14);
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 9px "JetBrains Mono", monospace';
            ctx.textAlign = 'center';
            ctx.fillText(letter, subX + splitWidth / 2, padding.top - 7);

            // Subtle Period Vertical Guide Line
            ctx.strokeStyle = isDarkSlate ? 'rgba(255, 255, 255, 0.05)' : 'rgba(255, 255, 255, 0.03)';
            ctx.lineWidth = 0.5;
            ctx.beginPath();
            ctx.moveTo(subX, padding.top);
            ctx.lineTo(subX, height - padding.bottom);
            ctx.stroke();
          }
        });

        // POC Line across Split Columns
        if (profile.pocPrice) {
          const pocY = getPriceY(profile.pocPrice);
          if (pocY >= padding.top && pocY <= height - padding.bottom) {
            ctx.strokeStyle = '#00f0ff';
            ctx.lineWidth = 1.5;
            ctx.setLineDash([3, 3]);
            ctx.beginPath();
            ctx.moveTo(colStartX, pocY);
            ctx.lineTo(colStartX + uniqueLetters.length * splitStep, pocY);
            ctx.stroke();
            ctx.setLineDash([]);
          }
        }
      }

      // Render TPOs or Volume per price bin
      bins.forEach((bin) => {
        const binY = getPriceY(bin.price) - rowHeight / 2;
        if (binY < padding.top - rowHeight || binY > height - padding.bottom) return;

        const isPoc = bin.price === profile.pocPrice;
        const isAbovePoc = bin.price > profile.pocPrice;
        const isSinglePrint = bin.tpos.length === 1 && highlightSinglePrints;

        if (profileMode === 'volume') {
          const barWidth = (bin.volume / maxVolInBin) * (colWidth * 0.85);
          if (isPoc) {
            ctx.fillStyle = '#000000';
            ctx.fillRect(colStartX, binY, colWidth * 0.95, Math.max(2, rowHeight));
            ctx.fillStyle = '#00f0ff';
            ctx.fillRect(colStartX, binY + 0.5, barWidth, Math.max(1, rowHeight - 1));
          } else if (isAbovePoc) {
            ctx.fillStyle = 'rgba(239, 68, 68, 0.7)';
            ctx.fillRect(colStartX, binY, barWidth, Math.max(1, rowHeight - 0.5));
          } else {
            ctx.fillStyle = 'rgba(16, 185, 129, 0.7)';
            ctx.fillRect(colStartX, binY, barWidth, Math.max(1, rowHeight - 0.5));
          }
        } else if (profileMode === 'tpo-split') {
          if (bin.tpos.length === 0) return;

          bin.tpos.forEach((letter) => {
            const uIdx = uniqueLetters.indexOf(letter);
            if (uIdx === -1) return;
            const x = colStartX + uIdx * splitStep;
            if (x + splitWidth <= colEndX) {
              ctx.fillStyle = getLetterColor(letter);
              ctx.fillRect(x, binY + (rowHeight - splitWidth) / 2, splitWidth, splitWidth);

              if (isPoc) {
                ctx.strokeStyle = '#00f0ff';
                ctx.lineWidth = 1.5;
                ctx.strokeRect(x, binY + (rowHeight - splitWidth) / 2, splitWidth, splitWidth);
              } else {
                ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
                ctx.lineWidth = 0.5;
                ctx.strokeRect(x, binY + (rowHeight - splitWidth) / 2, splitWidth, splitWidth);
              }

              if (showLetters && splitWidth >= 8) {
                ctx.fillStyle = '#ffffff';
                ctx.font = `bold ${Math.max(7, Math.floor(splitWidth * 0.75))}px "JetBrains Mono", monospace`;
                ctx.textAlign = 'center';
                ctx.fillText(letter, x + splitWidth / 2, binY + rowHeight / 2 + (splitWidth * 0.28));
              }
            }
          });
        } else if (profileMode === 'mp-vp') {
          // Combined MP + VP: MP with Value Area on Left, and Volume Profile on Right
          const mpWidth = Math.max(38, Math.min(colWidth * 0.60, colWidth - 36));
          const mpStartX = colStartX;
          const mpEndX = colStartX + mpWidth;
          const vpGap = 8;
          const vpStartX = mpEndX + vpGap;
          const vpWidth = Math.max(26, colEndX - vpStartX);

          // 1. Draw Market Profile with Value Area on Left (MP)
          const tpoCount = bin.tpos.length;
          if (tpoCount > 0) {
            const isInsideVa = (profile.vahPrice && profile.valPrice)
              ? (bin.price <= profile.vahPrice && bin.price >= profile.valPrice)
              : false;

            if (isPoc) {
              // Solid black POC row matching TradingView POC bar
              const pocLabelWidth = showLetters ? 38 : 28;
              const pocRowWidth = Math.min(mpEndX - mpStartX, tpoCount * (baseBlockSize + blockGap) + pocLabelWidth);

              ctx.fillStyle = '#000000';
              ctx.fillRect(mpStartX, binY - 0.5, pocRowWidth, Math.max(rowHeight + 1, baseBlockSize + 1));

              ctx.fillStyle = '#ffffff';
              ctx.font = `bold ${Math.max(7, Math.min(10, baseBlockSize * 0.75))}px "JetBrains Mono", monospace`;
              ctx.textAlign = 'left';
              ctx.fillText('POC ▶', mpStartX + 2, binY + rowHeight / 2 + (baseBlockSize * 0.28));

              bin.tpos.forEach((letter, colIdx) => {
                const x = mpStartX + pocLabelWidth + colIdx * (baseBlockSize + blockGap);
                if (x + baseBlockSize <= mpEndX) {
                  ctx.fillStyle = '#111111';
                  ctx.fillRect(x, binY + (rowHeight - baseBlockSize) / 2, baseBlockSize, baseBlockSize);
                  ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
                  ctx.lineWidth = 0.5;
                  ctx.strokeRect(x, binY + (rowHeight - baseBlockSize) / 2, baseBlockSize, baseBlockSize);

                  if (showLetters) {
                    ctx.fillStyle = '#ffffff';
                    ctx.font = `bold ${Math.max(8, Math.floor(baseBlockSize * 0.75))}px "JetBrains Mono", monospace`;
                    ctx.textAlign = 'center';
                    ctx.fillText(letter, x + baseBlockSize / 2, binY + rowHeight / 2 + (baseBlockSize * 0.28));
                  } else {
                    ctx.fillStyle = '#00f0ff';
                    ctx.fillRect(x + 1, binY + (rowHeight - baseBlockSize) / 2 + 1, baseBlockSize - 2, baseBlockSize - 2);
                  }
                }
              });
            } else {
              // Separate VA Coloring:
              // Inside VA: Green (above POC), Pink/Rose (below POC)
              // Outside VA: Cyan / Teal blocks (above VAH and below VAL)
              let blockBgColor = '#38bdf8'; // Default outside VA: Cyan
              if (isInsideVa) {
                blockBgColor = isAbovePoc ? '#10b981' : '#f43f5e'; // Green above POC, Pink below POC
              } else {
                blockBgColor = isAbovePoc ? 'rgba(56, 189, 248, 0.85)' : 'rgba(56, 189, 248, 0.72)'; // Cyan outside VA
              }

              if (isSinglePrint) {
                blockBgColor = isAbovePoc ? '#fb7185' : '#34d399';
              }

              bin.tpos.forEach((letter, colIdx) => {
                const x = mpStartX + colIdx * (baseBlockSize + blockGap);
                if (x + baseBlockSize <= mpEndX) {
                  ctx.fillStyle = blockBgColor;
                  ctx.fillRect(x, binY + (rowHeight - baseBlockSize) / 2, baseBlockSize, baseBlockSize);

                  if (isSinglePrint) {
                    ctx.strokeStyle = '#f59e0b';
                    ctx.lineWidth = 1;
                    ctx.strokeRect(x, binY + (rowHeight - baseBlockSize) / 2, baseBlockSize, baseBlockSize);
                  } else {
                    ctx.strokeStyle = 'rgba(0, 0, 0, 0.15)';
                    ctx.lineWidth = 0.5;
                    ctx.strokeRect(x, binY + (rowHeight - baseBlockSize) / 2, baseBlockSize, baseBlockSize);
                  }

                  if (showLetters) {
                    ctx.fillStyle = '#ffffff';
                    ctx.font = `bold ${Math.max(8, Math.floor(baseBlockSize * 0.75))}px "JetBrains Mono", monospace`;
                    ctx.textAlign = 'center';
                    ctx.fillText(letter, x + baseBlockSize / 2, binY + rowHeight / 2 + (baseBlockSize * 0.28));
                  }
                }
              });
            }
          }

          // 2. Draw Volume Profile on Right (VP)
          if (bin.volume > 0 && maxVolInBin > 0) {
            const vpBarWidth = (bin.volume / maxVolInBin) * (vpWidth - 2);
            const isVpPoc = bin.price === maxVolPrice;

            // Cyan volume bar matching TradingView screenshot
            ctx.fillStyle = isVpPoc ? '#00e5ff' : 'rgba(56, 189, 248, 0.78)';
            ctx.fillRect(vpStartX, binY + 0.5, vpBarWidth, Math.max(1, rowHeight - 1));

            // Solid black POC line across VP at Volume POC
            if (isVpPoc) {
              ctx.strokeStyle = '#000000';
              ctx.lineWidth = 2;
              ctx.beginPath();
              ctx.moveTo(vpStartX, binY + rowHeight / 2);
              ctx.lineTo(vpStartX + vpWidth, binY + rowHeight / 2);
              ctx.stroke();
            }
          }
        } else {
          const tpoCount = bin.tpos.length;
          if (tpoCount === 0) return;

          if (isPoc) {
            const pocLabelWidth = showLetters ? 38 : 28;
            const pocRowWidth = Math.min(colWidth * 0.98, tpoCount * (baseBlockSize + blockGap) + pocLabelWidth);
            
            ctx.fillStyle = '#000000';
            ctx.fillRect(colStartX, binY - 0.5, pocRowWidth, Math.max(rowHeight + 1, baseBlockSize + 1));

            ctx.fillStyle = '#ffffff';
            ctx.font = `bold ${Math.max(7, Math.min(10, baseBlockSize * 0.75))}px "JetBrains Mono", monospace`;
            ctx.textAlign = 'left';
            ctx.fillText('POC ▶', colStartX + 2, binY + rowHeight / 2 + (baseBlockSize * 0.28));

            bin.tpos.forEach((letter, colIdx) => {
              const x = colStartX + pocLabelWidth + colIdx * (baseBlockSize + blockGap);
              if (x + baseBlockSize <= colEndX) {
                ctx.fillStyle = '#111111';
                ctx.fillRect(x, binY + (rowHeight - baseBlockSize) / 2, baseBlockSize, baseBlockSize);
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
                ctx.lineWidth = 0.5;
                ctx.strokeRect(x, binY + (rowHeight - baseBlockSize) / 2, baseBlockSize, baseBlockSize);

                if (showLetters) {
                  ctx.fillStyle = '#ffffff';
                  ctx.font = `bold ${Math.max(8, Math.floor(baseBlockSize * 0.75))}px "JetBrains Mono", monospace`;
                  ctx.textAlign = 'center';
                  ctx.fillText(letter, x + baseBlockSize / 2, binY + rowHeight / 2 + (baseBlockSize * 0.28));
                } else {
                  ctx.fillStyle = '#00f0ff';
                  ctx.fillRect(x + 1, binY + (rowHeight - baseBlockSize) / 2 + 1, baseBlockSize - 2, baseBlockSize - 2);
                }
              }
            });
          } else {
            let blockBgColor = isAbovePoc ? '#e23636' : '#089981';
            if (isSinglePrint) {
              blockBgColor = isAbovePoc ? '#f43f5e' : '#10b981';
            }

            bin.tpos.forEach((letter, colIdx) => {
              const x = colStartX + colIdx * (baseBlockSize + blockGap);
              if (x + baseBlockSize <= colEndX) {
                ctx.fillStyle = blockBgColor;
                ctx.fillRect(x, binY + (rowHeight - baseBlockSize) / 2, baseBlockSize, baseBlockSize);

                if (isSinglePrint) {
                  ctx.strokeStyle = '#f59e0b';
                  ctx.lineWidth = 1;
                  ctx.strokeRect(x, binY + (rowHeight - baseBlockSize) / 2, baseBlockSize, baseBlockSize);
                } else {
                  ctx.strokeStyle = 'rgba(0, 0, 0, 0.15)';
                  ctx.lineWidth = 0.5;
                  ctx.strokeRect(x, binY + (rowHeight - baseBlockSize) / 2, baseBlockSize, baseBlockSize);
                }

                if (showLetters) {
                  ctx.fillStyle = '#ffffff';
                  ctx.font = `bold ${Math.max(8, Math.floor(baseBlockSize * 0.75))}px "JetBrains Mono", monospace`;
                  ctx.textAlign = 'center';
                  ctx.fillText(letter, x + baseBlockSize / 2, binY + rowHeight / 2 + (baseBlockSize * 0.28));
                }
              }
            });
          }
        }
      });

      // Initial Balance (IB) Vertical Line
      if (showIbLine && profile.ibHigh && profile.ibLow) {
        const ibYTop = getPriceY(profile.ibHigh);
        const ibYBottom = getPriceY(profile.ibLow);

        if (ibYTop < height - padding.bottom && ibYBottom > padding.top) {
          const drawTop = Math.max(padding.top, ibYTop);
          const drawBottom = Math.min(height - padding.bottom, ibYBottom);
          const ibX = colStartX - 4;

          ctx.strokeStyle = '#000000';
          ctx.lineWidth = 3.5;
          ctx.beginPath();
          ctx.moveTo(ibX, drawTop);
          ctx.lineTo(ibX, drawBottom);
          ctx.stroke();

          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.moveTo(ibX, drawTop);
          ctx.lineTo(ibX, drawBottom);
          ctx.stroke();

          ctx.strokeStyle = '#000000';
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.moveTo(ibX - 4, drawTop);
          ctx.lineTo(ibX + 4, drawTop);
          ctx.moveTo(ibX - 4, drawBottom);
          ctx.lineTo(ibX + 4, drawBottom);
          ctx.stroke();

          ctx.fillStyle = isDarkSlate ? '#cbd5e1' : '#ffffff';
          ctx.font = 'bold 9px "JetBrains Mono", monospace';
          ctx.textAlign = 'right';
          ctx.fillText('IB', ibX - 6, drawTop + 3);
        }
      }

      // VAH & VAL Reference Lines (Vibrant Pink & Purple)
      const drawLocalMarkerLine = (price: number, label: string, color: string) => {
        const lineY = getPriceY(price);
        if (lineY < padding.top || lineY > height - padding.bottom) return;

        const mpOffset = profileMode === 'mp-vp' ? (Math.max(26, Math.min(colWidth * 0.36, 110)) + 8) : 0;
        const lineStartX = colStartX + mpOffset;

        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(lineStartX, lineY);
        ctx.lineTo(colStartX + colWidth, lineY);
        ctx.stroke();
        ctx.setLineDash([]);

        const labelText = `${label} ▶`;
        ctx.font = 'bold 9px "JetBrains Mono", monospace';
        const txtWidth = ctx.measureText(labelText).width;

        ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
        ctx.fillRect(lineStartX - txtWidth - 4, lineY - 6, txtWidth + 4, 12);

        ctx.fillStyle = color;
        ctx.textAlign = 'right';
        ctx.fillText(labelText, lineStartX - 2, lineY + 3);

        // Also draw price tag on right Y-axis for the latest session profile
        if (sIdx === dayProfiles.length - 1) {
          ctx.fillStyle = color;
          ctx.fillRect(width - padding.right + 2, lineY - 8, padding.right - 4, 16);
          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 9px "JetBrains Mono", monospace';
          ctx.textAlign = 'left';
          ctx.fillText(`${label} ${price.toFixed(1)}`, width - padding.right + 5, lineY + 3);
        }
      };

      if (profile.vahPrice) drawLocalMarkerLine(profile.vahPrice, 'VAH', '#ec4899');
      if (profile.valPrice) drawLocalMarkerLine(profile.valPrice, 'VAL', '#a855f7');
    });

    // 5. TESTED vs UNTESTED (NAKED) POC EXTENSION ENGINE
    // "when poc is already tested it should not extend"
    dayProfiles.forEach((profile, sIdx) => {
      const testInfo = pocTestStatusMap[sIdx];
      if (!testInfo) return;

      const colStartX = padding.left + panOffset.x + sIdx * (colWidth + colGap);
      const lineY = getPriceY(profile.pocPrice);

      if (lineY < padding.top || lineY > height - padding.bottom) return;

      if (extendPocMode === 'none') return;

      let lineEndX = width - padding.right; // Untested POC extends all the way to right edge
      let isTested = testInfo.isTested;
      let lineColor = '#00f0ff'; // Vibrant Cyan for Untested / Naked POC
      let lineLabel = 'nPOC ▶';

      if (isTested) {
        if (extendPocMode === 'untested_only') {
          // If mode is 'untested_only', tested POC line terminates at the testing session column!
          const testingColEndX = padding.left + panOffset.x + testInfo.testedSessionIdx * (colWidth + colGap) + colWidth;
          lineEndX = Math.min(width - padding.right, testingColEndX);
          lineColor = 'rgba(0, 240, 255, 0.35)';
          lineLabel = 'POC (Tested) ▶';
        }
      }

      // Skip drawing if tested line is completely behind left boundary
      if (lineEndX < padding.left || colStartX > width - padding.right) return;

      ctx.strokeStyle = lineColor;
      ctx.lineWidth = isTested ? 1.0 : 1.8;
      ctx.setLineDash(isTested ? [2, 3] : [4, 4]);
      ctx.beginPath();
      ctx.moveTo(colStartX, lineY);
      ctx.lineTo(lineEndX, lineY);
      ctx.stroke();
      ctx.setLineDash([]);

      // Draw label on left of session column
      if (colStartX >= padding.left && colStartX <= width - padding.right) {
        ctx.font = 'bold 9px "JetBrains Mono", monospace';
        const txtWidth = ctx.measureText(lineLabel).width;
        ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
        ctx.fillRect(colStartX - txtWidth - 4, lineY - 6, txtWidth + 4, 12);

        ctx.fillStyle = lineColor;
        ctx.textAlign = 'right';
        ctx.fillText(lineLabel, colStartX - 2, lineY + 3);
      }
    });

    // 5B. 2-DAY BALANCE & INNER VALUE BRACKET VISUALIZER
    if (showTwoDayBalance && twoDayBalances.length > 0) {
      twoDayBalances.forEach(bal => {
        const priorColX = padding.left + panOffset.x + bal.priorIdx * (colWidth + colGap);
        const prevColX = padding.left + panOffset.x + bal.prevIdx * (colWidth + colGap);
        const bracketStartX = priorColX;
        const bracketEndX = prevColX + colWidth;

        if (bracketEndX < padding.left || bracketStartX > width - padding.right) return;

        const highY = getPriceY(bal.balanceHigh);
        const lowY = getPriceY(bal.balanceLow);
        const pocY = getPriceY(bal.balancePoc);

        const isBull = bal.breakoutStatus === 'BULLISH';
        const isBear = bal.breakoutStatus === 'BEARISH';
        const borderColor = isBull ? '#10b981' : (isBear ? '#ef4444' : '#f59e0b');
        const fillColor = isBull ? 'rgba(16, 185, 129, 0.07)' : (isBear ? 'rgba(239, 68, 68, 0.07)' : 'rgba(245, 158, 11, 0.06)');

        // Shaded 2-Day Balance Bounding Box
        ctx.fillStyle = fillColor;
        ctx.fillRect(bracketStartX, highY, bracketEndX - bracketStartX, lowY - highY);

        // Dashed 2-Day Balance Border
        ctx.strokeStyle = borderColor;
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 4]);
        ctx.strokeRect(bracketStartX, highY, bracketEndX - bracketStartX, lowY - highY);
        ctx.setLineDash([]);

        // Balance POC Midline
        if (pocY >= padding.top && pocY <= height - padding.bottom) {
          ctx.strokeStyle = borderColor;
          ctx.lineWidth = 1;
          ctx.setLineDash([2, 4]);
          ctx.beginPath();
          ctx.moveTo(bracketStartX, pocY);
          ctx.lineTo(bracketEndX, pocY);
          ctx.stroke();
          ctx.setLineDash([]);
        }

        // Header Tag
        const badgeY = Math.max(padding.top + 14, highY - 14);
        const badgeText = `⚖️ 2D BALANCE (${bal.isStrictInner ? 'STRICT' : 'INNER'}) ${isBull ? '🚀 BREAKOUT' : isBear ? '🔻 BREAKDOWN' : '⏳ COILING'}`;
        ctx.font = 'bold 9px "JetBrains Mono", monospace';
        const textWidth = ctx.measureText(badgeText).width;

        ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
        ctx.fillRect(bracketStartX, badgeY - 10, textWidth + 10, 14);
        ctx.strokeStyle = borderColor;
        ctx.lineWidth = 1;
        ctx.strokeRect(bracketStartX, badgeY - 10, textWidth + 10, 14);

        ctx.fillStyle = isBull ? '#34d399' : (isBear ? '#f87171' : '#fbbf24');
        ctx.textAlign = 'left';
        ctx.fillText(badgeText, bracketStartX + 5, badgeY);
      });
    }

    // 5C. POOR / WEAK HIGH & LOW UNFINISHED BUSINESS MARKERS
    if (showPoorHighLow && poorHighLowStatusMap.length > 0) {
      poorHighLowStatusMap.forEach(info => {
        const sIdx = info.sessionIdx;
        const colStartX = padding.left + panOffset.x + sIdx * (colWidth + colGap);

        // --- HIGH EXTREME (Poor High or Weak High) ---
        if (info.isPoorHigh || info.isWeakHigh) {
          const lineY = getPriceY(info.highPrice);
          if (lineY >= padding.top - 12 && lineY <= height - padding.bottom + 12) {
            const isUnfinished = info.isHighUnfinished;
            const isPoor = info.isPoorHigh;

            let lineEndX = colStartX + colWidth;
            if (isUnfinished) {
              lineEndX = width - padding.right; // Active unfinished business extends across all subsequent sessions
            } else if (info.highRepairedSessionIdx !== -1) {
              const repairColX = padding.left + panOffset.x + info.highRepairedSessionIdx * (colWidth + colGap) + colWidth;
              lineEndX = Math.min(width - padding.right, Math.max(colStartX + colWidth, repairColX));
            }

            if (lineEndX >= padding.left && colStartX <= width - padding.right) {
              const strokeColor = isUnfinished
                ? (isPoor ? '#ef4444' : '#f97316') // Vivid Red for Poor High, Neon Orange for Weak High
                : (isDark ? 'rgba(239, 68, 68, 0.4)' : 'rgba(220, 38, 38, 0.35)');

              ctx.save();
              ctx.strokeStyle = strokeColor;
              ctx.lineWidth = isUnfinished ? 2.0 : 1.2;
              ctx.setLineDash(isUnfinished ? [5, 3] : [2, 4]);

              ctx.beginPath();
              ctx.moveTo(colStartX, lineY);
              ctx.lineTo(lineEndX, lineY);
              ctx.stroke();
              ctx.setLineDash([]);

              // Solid flat top cap at session column
              ctx.fillStyle = strokeColor;
              ctx.fillRect(colStartX, lineY - 1.5, colWidth, 3);

              // Session badge label
              const badgeText = isPoor
                ? (isUnfinished ? '⚠️ POOR HIGH [UNFINISHED]' : 'POOR HIGH [REPAIRED]')
                : (isUnfinished ? '⚠️ WEAK HIGH (NO TAIL) [UNFINISHED]' : 'WEAK HIGH [REPAIRED]');

              ctx.font = 'bold 9px "JetBrains Mono", monospace';
              const txtW = ctx.measureText(badgeText).width;
              const badgeX = Math.max(padding.left, Math.min(width - padding.right - txtW - 8, colStartX));
              const badgeY = Math.max(padding.top + 10, lineY - 6);

              ctx.fillStyle = isUnfinished
                ? (isDark ? 'rgba(15, 23, 42, 0.92)' : 'rgba(255, 255, 255, 0.95)')
                : (isDark ? 'rgba(15, 23, 42, 0.7)' : 'rgba(241, 245, 249, 0.85)');
              ctx.fillRect(badgeX - 2, badgeY - 10, txtW + 8, 13);

              ctx.strokeStyle = strokeColor;
              ctx.lineWidth = 1;
              ctx.strokeRect(badgeX - 2, badgeY - 10, txtW + 8, 13);

              ctx.fillStyle = isUnfinished ? (isPoor ? '#f87171' : '#fb923c') : (isDark ? '#94a3b8' : '#64748b');
              ctx.textAlign = 'left';
              ctx.fillText(badgeText, badgeX + 2, badgeY);

              // If active unfinished, draw magnetic target arrow at right edge
              if (isUnfinished && lineEndX >= width - padding.right - 2) {
                ctx.fillStyle = strokeColor;
                ctx.beginPath();
                ctx.moveTo(lineEndX - 6, lineY - 4);
                ctx.lineTo(lineEndX, lineY);
                ctx.lineTo(lineEndX - 6, lineY + 4);
                ctx.closePath();
                ctx.fill();
              }

              ctx.restore();
            }
          }
        }

        // --- LOW EXTREME (Poor Low or Weak Low) ---
        if (info.isPoorLow || info.isWeakLow) {
          const lineY = getPriceY(info.lowPrice);
          if (lineY >= padding.top - 12 && lineY <= height - padding.bottom + 12) {
            const isUnfinished = info.isLowUnfinished;
            const isPoor = info.isPoorLow;

            let lineEndX = colStartX + colWidth;
            if (isUnfinished) {
              lineEndX = width - padding.right; // Active unfinished business extends across all subsequent sessions
            } else if (info.lowRepairedSessionIdx !== -1) {
              const repairColX = padding.left + panOffset.x + info.lowRepairedSessionIdx * (colWidth + colGap) + colWidth;
              lineEndX = Math.min(width - padding.right, Math.max(colStartX + colWidth, repairColX));
            }

            if (lineEndX >= padding.left && colStartX <= width - padding.right) {
              const strokeColor = isUnfinished
                ? (isPoor ? '#06b6d4' : '#0ea5e9') // Cyan for Poor Low, Sky Blue for Weak Low
                : (isDark ? 'rgba(6, 182, 212, 0.4)' : 'rgba(2, 132, 199, 0.35)');

              ctx.save();
              ctx.strokeStyle = strokeColor;
              ctx.lineWidth = isUnfinished ? 2.0 : 1.2;
              ctx.setLineDash(isUnfinished ? [5, 3] : [2, 4]);

              ctx.beginPath();
              ctx.moveTo(colStartX, lineY);
              ctx.lineTo(lineEndX, lineY);
              ctx.stroke();
              ctx.setLineDash([]);

              // Solid flat bottom cap at session column
              ctx.fillStyle = strokeColor;
              ctx.fillRect(colStartX, lineY - 1.5, colWidth, 3);

              // Session badge label
              const badgeText = isPoor
                ? (isUnfinished ? '⚠️ POOR LOW [UNFINISHED]' : 'POOR LOW [REPAIRED]')
                : (isUnfinished ? '⚠️ WEAK LOW (NO TAIL) [UNFINISHED]' : 'WEAK LOW [REPAIRED]');

              ctx.font = 'bold 9px "JetBrains Mono", monospace';
              const txtW = ctx.measureText(badgeText).width;
              const badgeX = Math.max(padding.left, Math.min(width - padding.right - txtW - 8, colStartX));
              const badgeY = Math.min(height - padding.bottom - 4, lineY + 12);

              ctx.fillStyle = isUnfinished
                ? (isDark ? 'rgba(15, 23, 42, 0.92)' : 'rgba(255, 255, 255, 0.95)')
                : (isDark ? 'rgba(15, 23, 42, 0.7)' : 'rgba(241, 245, 249, 0.85)');
              ctx.fillRect(badgeX - 2, badgeY - 10, txtW + 8, 13);

              ctx.strokeStyle = strokeColor;
              ctx.lineWidth = 1;
              ctx.strokeRect(badgeX - 2, badgeY - 10, txtW + 8, 13);

              ctx.fillStyle = isUnfinished ? (isPoor ? '#22d3ee' : '#38bdf8') : (isDark ? '#94a3b8' : '#64748b');
              ctx.textAlign = 'left';
              ctx.fillText(badgeText, badgeX + 2, badgeY);

              // If active unfinished, draw magnetic target arrow at right edge
              if (isUnfinished && lineEndX >= width - padding.right - 2) {
                ctx.fillStyle = strokeColor;
                ctx.beginPath();
                ctx.moveTo(lineEndX - 6, lineY - 4);
                ctx.lineTo(lineEndX, lineY);
                ctx.lineTo(lineEndX - 6, lineY + 4);
                ctx.closePath();
                ctx.fill();
              }

              ctx.restore();
            }
          }
        }
      });
    }

    ctx.restore(); // Restore clipping region

    // 6. DRAW X-AXIS DATE/TIME RULER & Y-AXIS PRICE SCALE RULER LINES
    const rulerY = height - padding.bottom;
    const rulerX = width - padding.right;

    // Visual feedback & Two-Way Resize Arrow Handles on axes
    const isYActive = hoveredAxis === 'y-axis' || dragMode === 'y-axis';
    const isXActive = hoveredAxis === 'x-axis' || dragMode === 'x-axis';

    if (isYActive) {
      ctx.fillStyle = 'rgba(0, 240, 255, 0.08)';
      ctx.fillRect(rulerX, padding.top, padding.right, rulerY - padding.top);
    }

    if (isXActive) {
      ctx.fillStyle = 'rgba(0, 240, 255, 0.08)';
      ctx.fillRect(padding.left, rulerY, rulerX - padding.left, padding.bottom);
    }

    // Two-Way Resize Arrow Handle on Y-Axis (Price Scale)
    const yHandleX = rulerX + padding.right / 2;
    const yHandleY = padding.top + 16;
    const yHandleW = 64;
    const yHandleH = 20;

    ctx.save();
    ctx.fillStyle = isYActive ? 'rgba(0, 240, 255, 0.3)' : (isDarkSlate ? 'rgba(15, 23, 42, 0.9)' : 'rgba(241, 245, 249, 0.9)');
    ctx.strokeStyle = isYActive ? '#00f0ff' : (isDarkSlate ? 'rgba(0, 240, 255, 0.5)' : 'rgba(0, 240, 255, 0.4)');
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.roundRect(yHandleX - yHandleW / 2, yHandleY - yHandleH / 2, yHandleW, yHandleH, 4);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = isYActive ? '#00f0ff' : (isDarkSlate ? '#94a3b8' : '#334155');
    ctx.font = 'bold 9.5px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText(dragMode === 'y-axis' ? '↕ SCALING' : '↕ SCALE', yHandleX, yHandleY + 3.5);
    ctx.restore();

    // Two-Way Resize Arrow Handle on X-Axis (Time Scale)
    const xHandleX = (padding.left + rulerX) / 2;
    const xHandleY = rulerY + 22;
    const xHandleW = 95;
    const xHandleH = 20;

    ctx.save();
    ctx.fillStyle = isXActive ? 'rgba(0, 240, 255, 0.3)' : (isDarkSlate ? 'rgba(15, 23, 42, 0.9)' : 'rgba(241, 245, 249, 0.9)');
    ctx.strokeStyle = isXActive ? '#00f0ff' : (isDarkSlate ? 'rgba(0, 240, 255, 0.5)' : 'rgba(0, 240, 255, 0.4)');
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.roundRect(xHandleX - xHandleW / 2, xHandleY - xHandleH / 2, xHandleW, xHandleH, 4);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = isXActive ? '#00f0ff' : (isDarkSlate ? '#94a3b8' : '#334155');
    ctx.font = 'bold 9.5px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText(dragMode === 'x-axis' ? '↔ SCALING TIME' : '↔ SCALE TIME', xHandleX, xHandleY + 3.5);
    ctx.restore();

    // X-Axis Horizontal Ruler Line
    ctx.strokeStyle = (hoveredAxis === 'x-axis' || dragMode === 'x-axis') ? '#00f0ff' : (isDarkSlate ? '#334155' : '#475569');
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(padding.left, rulerY);
    ctx.lineTo(rulerX, rulerY);
    ctx.stroke();

    // Y-Axis Vertical Ruler Line
    ctx.strokeStyle = (hoveredAxis === 'y-axis' || dragMode === 'y-axis') ? '#00f0ff' : (isDarkSlate ? '#334155' : '#475569');
    ctx.beginPath();
    ctx.moveTo(rulerX, padding.top);
    ctx.lineTo(rulerX, rulerY);
    ctx.stroke();

    // Price Scale Ticks on Right Y-Axis Ruler
    for (let priceTick = startTick; priceTick <= endTick; priceTick += step) {
      const y = getPriceY(priceTick);
      if (y >= padding.top && y <= rulerY) {
        ctx.strokeStyle = isDarkSlate ? 'rgba(255, 255, 255, 0.3)' : 'rgba(255, 255, 255, 0.2)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(rulerX, y);
        ctx.lineTo(rulerX + 5, y);
        ctx.stroke();
      }
    }

    // 6.5 DRAW REAL-TIME CURRENT PRICE (LTP) MARKER & RIGHT PRICE AXIS BADGE
    const activeLtp = liveLtp ?? (candles.length > 0 ? candles[candles.length - 1].close : (dayProfiles.length > 0 ? dayProfiles[dayProfiles.length - 1].closePrice : null));

    if (activeLtp !== null && !isNaN(activeLtp) && activeLtp > 0) {
      ctx.save();
      const liveY = getPriceY(activeLtp);
      const isLive = streamStatus === 'LIVE';

      // Colors matching live connectivity status
      const accentColor = isLive ? '#10b981' : '#ef4444';
      const glowColor = isLive ? 'rgba(16, 185, 129, 0.45)' : 'rgba(239, 68, 68, 0.35)';
      const badgeBg = isLive ? '#064e3b' : '#7f1d1d';
      const badgeBorder = isLive ? '#10b981' : '#ef4444';

      const isInsideChart = liveY >= padding.top && liveY <= rulerY;
      const isAboveChart = liveY < padding.top;
      const isBelowChart = liveY > rulerY;

      // 1. Horizontal dashed marker line across profile canvas (padding.left to rulerX)
      if (isInsideChart) {
        ctx.strokeStyle = accentColor;
        ctx.lineWidth = 1.6;
        ctx.setLineDash([5, 4]);
        ctx.shadowColor = glowColor;
        ctx.shadowBlur = 6;

        ctx.beginPath();
        ctx.moveTo(padding.left, liveY);
        ctx.lineTo(rulerX, liveY);
        ctx.stroke();

        ctx.shadowBlur = 0;
        ctx.setLineDash([]);

        // Small indicator bead at right axis boundary
        ctx.fillStyle = accentColor;
        ctx.beginPath();
        ctx.arc(rulerX, liveY, 2.5, 0, Math.PI * 2);
        ctx.fill();
      } else if (isAboveChart) {
        // High price alert indicator at top chart boundary
        ctx.strokeStyle = accentColor;
        ctx.lineWidth = 2;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(padding.left, padding.top);
        ctx.lineTo(rulerX, padding.top);
        ctx.stroke();
        ctx.setLineDash([]);
      } else if (isBelowChart) {
        // Low price alert indicator at bottom chart boundary
        ctx.strokeStyle = accentColor;
        ctx.lineWidth = 2;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(padding.left, rulerY);
        ctx.lineTo(rulerX, rulerY);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // 2. Right Price Axis Dedicated Marker Badge
      // Clamped Y position so the marker is ALWAYS visible even if price is outside visible chart / TPO profile
      const clampedY = Math.max(padding.top + 15, Math.min(rulerY - 15, liveY));

      const badgeX = rulerX + 1;
      const badgeW = padding.right - 2;
      const badgeH = 26;
      const badgeTop = clampedY - badgeH / 2;

      // Outer glow for badge
      ctx.shadowColor = glowColor;
      ctx.shadowBlur = 8;

      // Rounded rectangle container
      ctx.fillStyle = badgeBg;
      ctx.strokeStyle = badgeBorder;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(badgeX, badgeTop, badgeW, badgeH, 4);
      ctx.fill();
      ctx.stroke();

      ctx.shadowBlur = 0; // reset shadow

      // Exact formatted price text with directional arrow if outside view
      let priceDisplay = activeLtp.toFixed(2);
      if (isAboveChart) {
        priceDisplay = `▲ ${activeLtp.toFixed(2)}`;
      } else if (isBelowChart) {
        priceDisplay = `▼ ${activeLtp.toFixed(2)}`;
      }

      // Line 1: Exact Price in JetBrains Mono
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 10px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(priceDisplay, badgeX + badgeW / 2, badgeTop + 11);

      // Line 2: Status label (LIVE / OFFLINE)
      const statusLabel = isLive ? '● LIVE' : '● OFFLINE';
      ctx.font = 'bold 8px "Outfit", sans-serif';
      ctx.fillStyle = accentColor;
      ctx.fillText(statusLabel, badgeX + badgeW / 2, badgeTop + 22);

      ctx.restore();
    }

    // 7. DRAW INTERACTIVE CROSSHAIR & PRICE/DATE RULER BADGES
    if (crosshairPos && crosshairPos.x >= padding.left && crosshairPos.x <= rulerX && crosshairPos.y >= padding.top && crosshairPos.y <= rulerY) {
      ctx.save();

      // Crosshair Vertical & Horizontal Cyan Lines
      ctx.strokeStyle = '#00f0ff';
      ctx.lineWidth = 1.0;
      ctx.setLineDash([4, 4]);

      // Vertical Crosshair Line
      ctx.beginPath();
      ctx.moveTo(crosshairPos.x, padding.top);
      ctx.lineTo(crosshairPos.x, rulerY);
      ctx.stroke();

      // Horizontal Crosshair Line
      ctx.beginPath();
      ctx.moveTo(padding.left, crosshairPos.y);
      ctx.lineTo(rulerX, crosshairPos.y);
      ctx.stroke();

      ctx.setLineDash([]);

      // Price Ruler Badge Tag on Right Axis
      const priceText = crosshairPos.price.toFixed(2);
      ctx.font = 'bold 10px "JetBrains Mono", monospace';
      const priceMetrics = ctx.measureText(priceText);
      const priceBadgeW = priceMetrics.width + 12;
      const priceBadgeH = 20;

      ctx.fillStyle = '#00f0ff';
      ctx.fillRect(rulerX, crosshairPos.y - priceBadgeH / 2, priceBadgeW, priceBadgeH);

      ctx.fillStyle = '#000000';
      ctx.textAlign = 'center';
      ctx.fillText(priceText, rulerX + priceBadgeW / 2, crosshairPos.y + 3.5);

      // Date/Time Ruler Badge Tag on Bottom Axis
      if (crosshairPos.dateStr) {
        const dateText = formatDateShort(crosshairPos.dateStr);
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

  }, [dayProfiles, dimensions, profileMode, theme, isDark, zoomLevel, yScale, xScale, panOffset, gridStep, highlightSinglePrints, showIbLine, showPoorHighLow, extendPocMode, pocTestStatusMap, poorHighLowStatusMap, showTwoDayBalance, twoDayBalances, crosshairPos, hoveredAxis, dragMode, hoveredSessionIdx, liveLtp, streamStatus]);

  // Canvas Mouse Move Handler for Hover Tooltip, Axis Drag Scaling & Chart Panning
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || dayProfiles.length === 0) return;

    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const padding = { top: 40, bottom: 45, left: 20, right: 75 };
    const baseChartWidth = rect.width - padding.left - padding.right;
    const baseChartHeight = rect.height - padding.top - padding.bottom;

    // Handle Active Dragging Modes
    if (dragMode === 'y-axis') {
      const deltaY = e.clientY - dragStartPos.y;
      const factor = Math.exp(-deltaY * 0.006);
      const newYScale = Math.min(10.0, Math.max(0.15, initialYScale * factor));
      setYScale(newYScale);
      setCursorStyle('ns-resize');
      return;
    }

    if (dragMode === 'x-axis') {
      const deltaX = e.clientX - dragStartPos.x;
      const factor = Math.exp(deltaX * 0.005);
      const newXScale = Math.min(10.0, Math.max(0.2, initialXScale * factor));
      setXScale(newXScale);
      setCursorStyle('ew-resize');
      return;
    }

    if (dragMode === 'pan') {
      setPanOffset({
        x: initialPanOffset.x + (e.clientX - dragStartPos.x),
        y: initialPanOffset.y + (e.clientY - dragStartPos.y)
      });
      setCursorStyle('grabbing');
      return;
    }

    // Check if mouse is hovering over Price Axis (Y) or Time Axis (X)
    if (mouseX >= rect.width - padding.right) {
      setHoveredAxis('y-axis');
      setCursorStyle('ns-resize');
      if (!pinnedInfo) setHoverInfo(null);
      setCrosshairPos(null);
      return;
    } else if (mouseY >= rect.height - padding.bottom) {
      setHoveredAxis('x-axis');
      setCursorStyle('ew-resize');
      if (!pinnedInfo) setHoverInfo(null);
      setCrosshairPos(null);
      return;
    } else {
      setHoveredAxis('none');
      setCursorStyle('crosshair');
    }

    if (mouseY < padding.top || mouseX < padding.left) {
      if (!pinnedInfo) setHoverInfo(null);
      setCrosshairPos(null);
      return;
    }

    const sessionCount = dayProfiles.length;
    const colGap = Math.max(3, 8 * zoomLevel * xScale);
    const availWidthForCols = baseChartWidth - (sessionCount - 1) * colGap;
    const minColW = (profileMode === 'tpo-split' ? 70 : (profileMode === 'mp-vp' ? 85 : 26)) * zoomLevel * xScale;
    const colWidth = Math.max(minColW, (availWidthForCols / sessionCount) * zoomLevel * xScale);

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

      setHoveredSessionIdx(hoveredSessionIdx);

      if (closestBin) {
        const tooltipX = mouseX + 270 > rect.width ? Math.max(10, mouseX - 250) : mouseX + 15;
        const tooltipY = Math.max(10, Math.min(rect.height - 240, mouseY - 50));

        if (!pinnedInfo) {
          setHoverInfo({
            profile,
            bin: closestBin,
            x: tooltipX,
            y: tooltipY,
            isSinglePrint: closestBin.tpos.length === 1
          });
        }
      } else {
        if (!pinnedInfo) setHoverInfo(null);
      }
    } else {
      setHoveredSessionIdx(-1);
      if (!pinnedInfo) setHoverInfo(null);
    }
  };

  const isFuturesContract = symbol.endsWith('1!') || activeSymbolInfo.type === 'futures';

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
        height: isExpanded || isStandalone ? '100vh' : 'auto',
        margin: 0,
        padding: isExpanded ? '10px 14px' : '16px',
        backgroundColor: isExpanded ? (!isDark ? '#f8fafc' : (theme === 'dark-slate' ? '#0f172a' : '#090d16')) : undefined,
        gap: isExpanded ? '10px' : '16px',
        boxSizing: 'border-box',
        overflowY: isExpanded || isStandalone ? 'hidden' : 'auto'
      }}
    >
      
      {/* Controls Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '12px', background: 'rgba(15, 23, 42, 0.6)', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
        
        {/* Customization & View Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          
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

          {/* IB, Single Prints & Poor H/L Toggles */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: isDark ? 'rgba(0,0,0,0.3)' : 'rgba(241, 245, 249, 0.9)', padding: '2px', borderRadius: '6px', border: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid #cbd5e1' }}>
            <button
              onClick={() => setShowIbLine(!showIbLine)}
              style={{
                background: showIbLine ? 'rgba(59, 130, 246, 0.25)' : 'transparent',
                color: showIbLine ? '#60a5fa' : 'var(--text-secondary)',
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
                color: highlightSinglePrints ? '#f59e0b' : 'var(--text-secondary)',
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
                color: showPoorHighLow ? '#f87171' : 'var(--text-secondary)',
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
              title="Toggle Poor/Weak High & Low Unfinished Business Markers"
            >
              <span>⚠️</span> Poor H/L
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
              Latest 🎯
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

          {/* Lookback Days Selection (Dropdown Only) */}
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
              title="Select Market Profile timeframe up to 100 days"
            >
              {[5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 60, 70, 75, 80, 90, 100].map((d) => (
                <option key={d} value={d} style={{ background: isDark ? '#0f172a' : '#ffffff', color: isDark ? '#ffffff' : '#0f172a' }}>
                  {d}D {d === 5 ? '(1 Wk)' : d === 20 ? '(1 Mo)' : d === 45 ? '(2 Mo)' : d === 60 ? '(Qtr)' : d === 100 ? '(Max 100D)' : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Profile Mode Toggle */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(0,0,0,0.3)', padding: '2px', borderRadius: '6px' }}>
            <button
              onClick={() => setProfileMode('tpo-collapsed')}
              style={{
                background: profileMode === 'tpo-collapsed' ? '#00f0ff' : 'transparent',
                color: profileMode === 'tpo-collapsed' ? '#000000' : 'var(--text-secondary)',
                border: 'none',
                padding: '4px 10px',
                borderRadius: '4px',
                fontSize: '11px',
                fontWeight: '700',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
              title="Market Profile (Daily Composite TPO Profile)"
            >
              Market Profile
            </button>
            <button
              onClick={() => setProfileMode('tpo-split')}
              style={{
                background: profileMode === 'tpo-split' ? '#00f0ff' : 'transparent',
                color: profileMode === 'tpo-split' ? '#000000' : 'var(--text-secondary)',
                border: 'none',
                padding: '4px 10px',
                borderRadius: '4px',
                fontSize: '11px',
                fontWeight: '700',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
              title="Split Profile into 30-min Chronological TPO Columns"
            >
              Split Profile
            </button>
            <button
              onClick={() => setProfileMode('volume')}
              style={{
                background: profileMode === 'volume' ? '#00f0ff' : 'transparent',
                color: profileMode === 'volume' ? '#000000' : 'var(--text-secondary)',
                border: 'none',
                padding: '4px 10px',
                borderRadius: '4px',
                fontSize: '11px',
                fontWeight: '700',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
              title="Volume Distribution Profile"
            >
              Volume Profile
            </button>
            <button
              onClick={() => setProfileMode('mp-vp')}
              style={{
                background: profileMode === 'mp-vp' ? '#00f0ff' : 'transparent',
                color: profileMode === 'mp-vp' ? '#000000' : 'var(--text-secondary)',
                border: 'none',
                padding: '4px 10px',
                borderRadius: '4px',
                fontSize: '11px',
                fontWeight: '700',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
              title="Market Profile (TPO) + Volume Profile Combined on Same Chart"
            >
              MP + VP
            </button>
          </div>

          {/* 2-Day Balance Toggle */}
          <button
            onClick={() => setShowTwoDayBalance(prev => !prev)}
            style={{
              background: showTwoDayBalance ? 'rgba(245, 158, 11, 0.2)' : 'rgba(0,0,0,0.3)',
              color: showTwoDayBalance ? '#f59e0b' : 'var(--text-secondary)',
              border: showTwoDayBalance ? '1px solid #f59e0b' : '1px solid rgba(255,255,255,0.08)',
              padding: '4px 10px',
              borderRadius: '6px',
              fontSize: '11px',
              fontWeight: '700',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
            title="Toggle 2-Day Balance & Inner Logic Highlight"
          >
            ⚖️ 2D Balance {showTwoDayBalance ? 'ON' : 'OFF'}
          </button>

          {/* Pin / Unpin Info Tooltip */}
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
                  x: 75,
                  y: 110
                });
              }
            }}
            style={{
              background: pinnedInfo ? 'rgba(16, 185, 129, 0.22)' : 'rgba(0,0,0,0.3)',
              color: pinnedInfo ? '#10b981' : 'var(--text-secondary)',
              border: pinnedInfo ? '1px solid #10b981' : '1px solid rgba(255,255,255,0.08)',
              padding: '4px 10px',
              borderRadius: '6px',
              fontSize: '11px',
              fontWeight: '700',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '5px'
            }}
            title={pinnedInfo ? "Unpin Info Tooltip (Shortcut: P or Esc)" : "Pin Session Info on Screen for Screenshot (Shortcut: P)"}
          >
            {pinnedInfo ? <PinOff size={13} /> : <Pin size={13} />}
            {pinnedInfo ? '📌 Unpin Info' : '📌 Pin Info (P)'}
          </button>

          {/* Screenshot Button */}
          <button
            onClick={handleTakeScreenshot}
            style={{
              background: 'rgba(0, 240, 255, 0.12)',
              border: '1px solid rgba(0, 240, 255, 0.4)',
              color: '#00f0ff',
              padding: '4px 10px',
              borderRadius: '6px',
              fontSize: '11px',
              fontWeight: '700',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '5px'
            }}
            title="Take Screenshot of Chart & Pinned Info (Downloads PNG & Copies to Clipboard)"
          >
            <Camera size={13} />
            {screenshotStatus || 'Screenshot'}
          </button>

          {/* Refresh */}
          <button
            onClick={() => fetchCandles(symbol, timeframe)}
            style={{
              background: 'rgba(255, 255, 255, 0.06)',
              border: 'none',
              color: 'var(--text-primary)',
              padding: '6px',
              borderRadius: '6px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center'
            }}
            title="Refresh Chart"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>

          {/* Pop Out into New Browser Tab / Window Button */}
          <button
            onClick={handlePopOut}
            style={{
              background: 'rgba(56, 189, 248, 0.12)',
              border: '1px solid rgba(56, 189, 248, 0.35)',
              color: '#38bdf8',
              padding: '4px 10px',
              borderRadius: '6px',
              fontSize: '11px',
              fontWeight: '700',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              transition: 'all 0.15s'
            }}
            title="Pop out Market Profile into new browser tab / window"
          >
            <ExternalLink size={13} />
            <span>Pop Out</span>
          </button>

          {/* Fullscreen Button */}
          <button
            onClick={toggleFullscreen}
            style={{
              background: isExpanded ? 'rgba(59, 130, 246, 0.25)' : 'rgba(255, 255, 255, 0.06)',
              border: isExpanded ? '1px solid #3b82f6' : '1px solid rgba(255, 255, 255, 0.1)',
              color: isExpanded ? '#60a5fa' : 'var(--text-primary)',
              padding: '4px 10px',
              borderRadius: '6px',
              fontSize: '11px',
              fontWeight: '700',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              transition: 'all 0.15s'
            }}
            title={isExpanded ? 'Exit Fullscreen (Esc)' : 'Fullscreen (Covers Dashboard)'}
          >
            {isExpanded ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
            <span>{isExpanded ? 'Exit Fullscreen' : 'Fullscreen'}</span>
          </button>
        </div>
      </div>

      {/* Chart Canvas Area */}
      <div 
        ref={canvasContainerRef} 
        style={{ 
          position: 'relative', 
          width: '100%', 
          flex: isExpanded || isStandalone ? 1 : 'none',
          minHeight: isExpanded || isStandalone ? '550px' : '640px',
          height: isExpanded || isStandalone ? 'calc(100vh - 65px)' : '640px',
          backgroundColor: !isDark ? '#ffffff' : (theme === 'dark-slate' ? '#181c27' : '#0d1017'), 
          borderRadius: isExpanded ? '0' : '8px', 
          border: `1px solid ${!isDark ? '#cbd5e1' : 'var(--border-color)'}`,
          overflow: 'hidden'
        }}
      >
        {/* Navigation & Active Contract Header */}
        <div style={{
          position: 'absolute',
          top: isExpanded ? '6px' : '10px',
          left: isExpanded ? '10px' : '15px',
          right: isExpanded ? '10px' : 'auto',
          zIndex: 5,
          display: 'flex',
          alignItems: 'center',
          gap: isExpanded ? '6px' : '10px',
          pointerEvents: 'none',
          flexWrap: isExpanded ? 'nowrap' : 'wrap',
          overflowX: isExpanded ? 'auto' : 'visible'
        }}>
          {isFuturesContract && (
            <span style={{ fontSize: '11px', fontWeight: '800', color: '#00f0ff', backgroundColor: 'rgba(0, 240, 255, 0.15)', border: '1px solid rgba(0, 240, 255, 0.4)', padding: '3px 8px', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Zap size={12} /> {activeSymbolInfo.displayName || symbol} (Futures)
            </span>
          )}
          {twoDayBalances.length > 0 && showTwoDayBalance && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(245, 158, 11, 0.2)', padding: '4px 10px', borderRadius: '4px', border: '1px solid rgba(245, 158, 11, 0.5)' }}>
              <span style={{ fontSize: '10px', color: '#f59e0b', fontWeight: '800' }}>
                ⚡ 2D BALANCE: {twoDayBalances[twoDayBalances.length - 1].prevDate} inner to {twoDayBalances[twoDayBalances.length - 1].priorDate} (₹{twoDayBalances[twoDayBalances.length - 1].balanceLow} - ₹{twoDayBalances[twoDayBalances.length - 1].balanceHigh})
              </span>
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(15, 23, 42, 0.75)', padding: '4px 10px', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.08)' }}>
            <Move size={12} style={{ color: '#60a5fa' }} />
            <span style={{ fontSize: '10px', color: '#94a3b8', fontWeight: '600' }}>
              Tested POCs stop extending at testing session | Untested (nPOC) & Unfinished Poor H/L extend to right
            </span>
          </div>
          {showPoorHighLow && poorHighLowStatusMap.some(p => p.isHighUnfinished || p.isLowUnfinished) && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(239, 68, 68, 0.2)', padding: '4px 10px', borderRadius: '4px', border: '1px solid rgba(239, 68, 68, 0.5)' }}>
              <span style={{ fontSize: '10px', color: '#f87171', fontWeight: '800' }}>
                ⚠️ UNFINISHED BUSINESS: {poorHighLowStatusMap.filter(p => p.isHighUnfinished).length} Poor High(s), {poorHighLowStatusMap.filter(p => p.isLowUnfinished).length} Poor Low(s) Active
              </span>
            </div>
          )}
          {(() => {
            const activeProfile = (hoverInfo && hoverInfo.profile) || (dayProfiles.length > 0 ? dayProfiles[dayProfiles.length - 1] : null);
            if (!activeProfile) return null;
            const op = activeProfile.openingTypeInfo || detectOpeningType(activeProfile);
            return (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                background: isDark ? 'rgba(15, 23, 42, 0.85)' : '#ffffff',
                padding: '4px 10px',
                borderRadius: '4px',
                border: `1px solid ${op.badgeColor}77`,
                boxShadow: `0 2px 8px ${op.badgeColor}25`
              }}>
                <span style={{ fontSize: '10px', color: isDark ? '#94a3b8' : '#64748b', fontWeight: '700' }}>
                  Opening Type ({formatDateShort(activeProfile.dateStr)}):
                </span>
                <span style={{ fontSize: '11px', color: op.badgeColor, fontWeight: '900' }}>
                  {op.type} {op.direction !== 'Neutral' ? `(${op.direction})` : ''}
                </span>
                {op.confidence === 'Developing' && (
                  <span style={{ fontSize: '8px', fontWeight: '700', color: '#f59e0b', backgroundColor: 'rgba(245, 158, 11, 0.2)', padding: '1px 4px', borderRadius: '3px' }}>
                    LIVE
                  </span>
                )}
              </div>
            );
          })()}
          {(() => {
            const activeProfile = (hoverInfo && hoverInfo.profile) || (dayProfiles.length > 0 ? dayProfiles[dayProfiles.length - 1] : null);
            if (!activeProfile) return null;
            const dt = activeProfile.dayTypeInfo || detectDayType(activeProfile);
            return (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                background: isDark ? 'rgba(15, 23, 42, 0.85)' : '#ffffff',
                padding: '4px 10px',
                borderRadius: '4px',
                border: `1px solid ${dt.badgeColor}77`,
                boxShadow: `0 2px 8px ${dt.badgeColor}25`
              }}>
                <span style={{ fontSize: '10px', color: isDark ? '#94a3b8' : '#64748b', fontWeight: '700' }}>
                  Day Type ({formatDateShort(activeProfile.dateStr)}):
                </span>
                <span style={{ fontSize: '11px', color: dt.badgeColor, fontWeight: '900' }}>
                  {dt.type}
                </span>
                <span style={{ fontSize: '9.5px', color: isDark ? '#cbd5e1' : '#475569', fontWeight: '600' }}>
                  • {dt.ibType}
                </span>
              </div>
            );
          })()}
          {(() => {
            const activeProfile = (hoverInfo && hoverInfo.profile) || (dayProfiles.length > 0 ? dayProfiles[dayProfiles.length - 1] : null);
            if (!activeProfile) return null;
            const activeIdx = dayProfiles.findIndex(dp => dp.dateStr === activeProfile.dateStr);
            const priorProfile = activeIdx > 0 ? dayProfiles[activeIdx - 1] : undefined;
            const vp = activeProfile.valuePlacementInfo || detectValuePlacement(activeProfile, priorProfile);
            if (!vp) return null;
            return (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                background: isDark ? 'rgba(15, 23, 42, 0.85)' : '#ffffff',
                padding: '4px 10px',
                borderRadius: '4px',
                border: `1px solid ${vp.badgeColor}77`,
                boxShadow: `0 2px 8px ${vp.badgeColor}25`
              }}>
                <span style={{ fontSize: '10px', color: isDark ? '#94a3b8' : '#64748b', fontWeight: '700' }}>
                  Value Placement ({formatDateShort(activeProfile.dateStr)}):
                </span>
                <span style={{ fontSize: '11px', color: vp.badgeColor, fontWeight: '900' }}>
                  {vp.type}
                </span>
                <span style={{ fontSize: '9.5px', color: isDark ? '#cbd5e1' : '#475569', fontWeight: '600' }}>
                  • {vp.bias}
                </span>
              </div>
            );
          })()}
        </div>

        {loading && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(15, 23, 42, 0.8)', zIndex: 10 }}>
            <RefreshCw size={28} className="animate-spin" style={{ color: '#00f0ff', marginBottom: '12px' }} />
            <span style={{ fontSize: '14px', color: 'white', fontWeight: '600' }}>Calculating Multi-Session TPO Market Profiles for {symbol}...</span>
          </div>
        )}

        {error && !loading && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(15, 23, 42, 0.9)', zIndex: 10 }}>
            <ShieldAlert size={32} style={{ color: '#ef4444', marginBottom: '12px' }} />
            <span style={{ fontSize: '14px', color: '#ef4444', fontWeight: '600', marginBottom: '12px' }}>{error}</span>
            <button
              onClick={() => fetchCandles(symbol, timeframe)}
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

        <canvas
          ref={canvasRef}
          onWheel={handleWheel}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseLeave}
          onTouchStart={(e) => {
            if (e.touches.length === 1) {
              setDragMode('pan');
              setDragStartPos({ x: e.touches[0].clientX, y: e.touches[0].clientY });
              setInitialPanOffset(panOffset);
            }
          }}
          onTouchMove={(e) => {
            if (dragMode === 'pan' && e.touches.length === 1) {
              setPanOffset({
                x: initialPanOffset.x + (e.touches[0].clientX - dragStartPos.x),
                y: initialPanOffset.y + (e.touches[0].clientY - dragStartPos.y)
              });
            }
          }}
          onTouchEnd={() => setDragMode('none')}
          onDoubleClick={handleDoubleClick}
          style={{ cursor: cursorStyle, display: 'block', touchAction: 'none' }}
        />

        {/* Floating Left Scroll Arrow (View Older Sessions) */}
        <button
          onClick={() => setPanOffset(prev => ({ ...prev, x: prev.x + 240 }))}
          style={{
            position: 'absolute',
            left: '12px',
            top: '50%',
            transform: 'translateY(-50%)',
            zIndex: 25,
            background: 'rgba(15, 23, 42, 0.85)',
            border: '1px solid rgba(0, 240, 255, 0.4)',
            color: '#00f0ff',
            padding: '12px 8px',
            borderRadius: '8px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 14px rgba(0,0,0,0.6)',
            backdropFilter: 'blur(6px)',
            transition: 'all 0.15s'
          }}
          title="Scroll Left (View Older Sessions)"
        >
          <ChevronLeft size={24} />
        </button>

        {/* Floating Right Scroll Arrow (View Newer Sessions) */}
        <button
          onClick={() => setPanOffset(prev => ({ ...prev, x: prev.x - 240 }))}
          style={{
            position: 'absolute',
            right: '12px',
            top: '50%',
            transform: 'translateY(-50%)',
            zIndex: 25,
            background: 'rgba(15, 23, 42, 0.85)',
            border: '1px solid rgba(0, 240, 255, 0.4)',
            color: '#00f0ff',
            padding: '12px 8px',
            borderRadius: '8px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 14px rgba(0,0,0,0.6)',
            backdropFilter: 'blur(6px)',
            transition: 'all 0.15s'
          }}
          title="Scroll Right (View Newer Sessions)"
        >
          <ChevronRight size={24} />
        </button>

        {/* Hover / Pinned Tooltip */}
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
                transform: 'translateY(-50%)',
                backgroundColor: isDark ? 'rgba(15, 23, 42, 0.96)' : 'rgba(255, 255, 255, 0.98)',
                border: isItemPinned ? '1.5px solid #00f0ff' : '1px solid rgba(0, 240, 255, 0.4)',
                borderRadius: '8px',
                padding: '12px 14px',
                pointerEvents: 'auto',
                zIndex: 100,
                boxShadow: isItemPinned ? '0 0 24px rgba(0, 240, 255, 0.35), 0 10px 30px rgba(0, 0, 0, 0.7)' : '0 8px 24px rgba(0, 0, 0, 0.5)',
                fontSize: '11px',
                color: isDark ? 'white' : '#0f172a',
                minWidth: '240px',
                maxWidth: '320px',
                backdropFilter: 'blur(8px)',
                userSelect: 'text'
              }}
            >
              {/* Header Bar with Pin / Unpin & Screenshot Controls */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)'}`, paddingBottom: '6px', marginBottom: '8px' }}>
                <div style={{ fontWeight: 'bold', color: '#00f0ff', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  {isItemPinned ? (
                    <span style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      background: 'rgba(16, 185, 129, 0.22)',
                      border: '1px solid #10b981',
                      color: '#10b981',
                      padding: '2px 7px',
                      borderRadius: '4px',
                      fontSize: '9.5px',
                      fontWeight: '800'
                    }}>
                      <Pin size={11} /> PINNED FOR SCREENSHOT
                    </span>
                  ) : (
                    <span>📅 {formatDateShort(activeDisplay.profile.dateStr)} ({activeDisplay.profile.dateStr})</span>
                  )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  {/* Pin / Unpin Button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (pinnedInfo) {
                        setPinnedInfo(null);
                      } else {
                        setPinnedInfo(activeDisplay);
                      }
                    }}
                    style={{
                      background: isItemPinned ? 'rgba(239, 68, 68, 0.2)' : 'rgba(0, 240, 255, 0.15)',
                      border: `1px solid ${isItemPinned ? '#ef4444' : '#00f0ff'}`,
                      color: isItemPinned ? '#f87171' : '#00f0ff',
                      padding: '3px 7px',
                      borderRadius: '4px',
                      fontSize: '10px',
                      fontWeight: '700',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                    title={isItemPinned ? "Unpin Tooltip (Esc or P)" : "Pin Tooltip for Screenshot (Click or P)"}
                  >
                    {isItemPinned ? <><PinOff size={11} /> Unpin</> : <><Pin size={11} /> Pin</>}
                  </button>

                  {/* Screenshot Button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleTakeScreenshot();
                    }}
                    style={{
                      background: 'rgba(16, 185, 129, 0.18)',
                      border: '1px solid #10b981',
                      color: '#10b981',
                      padding: '3px 7px',
                      borderRadius: '4px',
                      fontSize: '10px',
                      fontWeight: '700',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                    title="Capture Chart & Pinned Info as PNG Image"
                  >
                    <Camera size={11} /> {screenshotStatus || 'Capture'}
                  </button>

                  {isItemPinned && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setPinnedInfo(null);
                      }}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: isDark ? '#94a3b8' : '#64748b',
                        cursor: 'pointer',
                        padding: '2px',
                        display: 'flex',
                        alignItems: 'center'
                      }}
                      title="Close / Unpin (Esc)"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
              </div>

              {isItemPinned && (
                <div style={{ fontSize: '9.5px', color: isDark ? '#94a3b8' : '#64748b', marginBottom: '8px', fontStyle: 'italic', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span>📅 Session: {formatDateShort(activeDisplay.profile.dateStr)} ({activeDisplay.profile.dateStr})</span>
                  <span style={{ color: '#00f0ff', fontWeight: '700' }}>[P] to Unpin</span>
                </div>
              )}

            {/* Opening Type */}
            {(() => {
              const opening = activeDisplay.profile.openingTypeInfo || detectOpeningType(activeDisplay.profile);
              return (
                <div style={{
                  margin: '6px 0 8px 0',
                  padding: '7px 9px',
                  borderRadius: '6px',
                  background: isDark ? 'rgba(0, 0, 0, 0.45)' : '#f8fafc',
                  border: `1px solid ${opening.badgeColor}55`,
                  boxShadow: `0 2px 8px ${opening.badgeColor}18`
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '4px' }}>
                    <span style={{ fontSize: '9px', fontWeight: '800', color: isDark ? '#94a3b8' : '#64748b', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
                      Opening Type
                    </span>
                    {opening.confidence === 'Developing' ? (
                      <span style={{ fontSize: '8px', fontWeight: '700', color: '#f59e0b', backgroundColor: 'rgba(245, 158, 11, 0.15)', padding: '1px 5px', borderRadius: '3px' }}>
                        ● Developing
                      </span>
                    ) : (
                      <span style={{ fontSize: '8px', fontWeight: '700', color: isDark ? '#94a3b8' : '#64748b' }}>
                        Confirmed
                      </span>
                    )}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '3px', gap: '6px' }}>
                    <span style={{ fontSize: '13px', fontWeight: '900', color: opening.badgeColor, letterSpacing: '-0.2px' }}>
                      {opening.type}
                    </span>
                    {opening.direction && opening.direction !== 'Neutral' && (
                      <span style={{
                        fontSize: '9px',
                        fontWeight: '800',
                        padding: '1px 6px',
                        borderRadius: '4px',
                        backgroundColor: `${opening.badgeColor}22`,
                        color: opening.badgeColor,
                        border: `1px solid ${opening.badgeColor}44`
                      }}>
                        {opening.direction}
                      </span>
                    )}
                  </div>

                  <div style={{ fontSize: '9.5px', color: isDark ? '#cbd5e1' : '#334155', marginTop: '4px', lineHeight: '1.35', fontWeight: '500' }}>
                    {opening.description}
                  </div>
                </div>
              );
            })()}

            {/* Day Type & IB Type Info Card */}
            {(() => {
              const dayType = activeDisplay.profile.dayTypeInfo || detectDayType(activeDisplay.profile);
              return (
                <div style={{
                  margin: '0 0 8px 0',
                  padding: '7px 9px',
                  borderRadius: '6px',
                  background: isDark ? 'rgba(0, 0, 0, 0.45)' : '#f8fafc',
                  border: `1px solid ${dayType.badgeColor}55`,
                  boxShadow: `0 2px 8px ${dayType.badgeColor}18`
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '4px' }}>
                    <span style={{ fontSize: '9px', fontWeight: '800', color: isDark ? '#94a3b8' : '#64748b', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
                      Day Type
                    </span>
                    <span style={{ fontSize: '9px', fontWeight: '700', color: dayType.badgeColor }}>
                      {dayType.extensionType}
                    </span>
                  </div>

                  <div style={{ marginTop: '2px', fontSize: '13px', fontWeight: '900', color: dayType.badgeColor, letterSpacing: '-0.2px' }}>
                    {dayType.type}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '4px', paddingTop: '4px', borderTop: `1px dashed ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`, fontSize: '9.5px' }}>
                    <span style={{ color: isDark ? '#94a3b8' : '#64748b', fontWeight: '600' }}>IB Type:</span>
                    <span style={{ color: isDark ? '#f1f5f9' : '#0f172a', fontWeight: '700' }}>{dayType.ibType}</span>
                  </div>
                </div>
              );
            })()}

            {/* Value Placement Info Card (vs Prior Day) */}
            {(() => {
              const hoveredIdx = dayProfiles.findIndex(dp => dp.dateStr === activeDisplay.profile.dateStr);
              const priorProfile = hoveredIdx > 0 ? dayProfiles[hoveredIdx - 1] : undefined;
              const vp = activeDisplay.profile.valuePlacementInfo || detectValuePlacement(activeDisplay.profile, priorProfile);

              return (
                <div style={{
                  margin: '0 0 8px 0',
                  padding: '7px 9px',
                  borderRadius: '6px',
                  background: isDark ? 'rgba(0, 0, 0, 0.45)' : '#f8fafc',
                  border: `1px solid ${vp ? vp.badgeColor : '#64748b'}55`,
                  boxShadow: `0 2px 8px ${vp ? vp.badgeColor : '#64748b'}18`
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '4px' }}>
                    <span style={{ fontSize: '9px', fontWeight: '800', color: isDark ? '#94a3b8' : '#64748b', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
                      Value Placement
                    </span>
                    {vp ? (
                      <span style={{
                        fontSize: '8.5px',
                        fontWeight: '800',
                        color: vp.badgeColor,
                        backgroundColor: `${vp.badgeColor}18`,
                        padding: '1px 5px',
                        borderRadius: '3px',
                        border: `1px solid ${vp.badgeColor}33`
                      }}>
                        {vp.bias}
                      </span>
                    ) : (
                      <span style={{ fontSize: '8.5px', fontWeight: '700', color: isDark ? '#94a3b8' : '#64748b' }}>
                        Baseline (Day 1)
                      </span>
                    )}
                  </div>

                  <div style={{ marginTop: '2px', fontSize: '13px', fontWeight: '900', color: vp ? vp.badgeColor : (isDark ? '#e2e8f0' : '#1e293b'), letterSpacing: '-0.2px' }}>
                    {vp ? vp.type : 'First Session (No Prior Day)'}
                  </div>

                  <div style={{ fontSize: '9.5px', color: isDark ? '#cbd5e1' : '#334155', marginTop: '4px', lineHeight: '1.35', fontWeight: '500' }}>
                    {vp ? vp.description : 'Initial session in current lookback period; prior session Value Area required for value comparison.'}
                  </div>

                  {vp && (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '4px', paddingTop: '4px', borderTop: `1px dashed ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`, fontSize: '9px', color: isDark ? '#94a3b8' : '#64748b' }}>
                      <span>Prior VA: <strong style={{ color: isDark ? '#f1f5f9' : '#0f172a' }}>{vp.priorVal.toFixed(2)} - {vp.priorVah.toFixed(2)}</strong></span>
                      <span>Today VA: <strong style={{ color: isDark ? '#f1f5f9' : '#0f172a' }}>{vp.todayVal.toFixed(2)} - {vp.todayVah.toFixed(2)}</strong></span>
                    </div>
                  )}
                </div>
              );
            })()}

            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
              <span style={{ color: isDark ? 'var(--text-secondary)' : '#64748b' }}>Price Bin:</span>
              <span style={{ fontWeight: 'bold', color: isDark ? 'white' : '#0f172a' }}>{activeDisplay.bin.price.toFixed(2)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
              <span style={{ color: isDark ? 'var(--text-secondary)' : '#64748b' }}>TPOs:</span>
              <span style={{ fontWeight: 'bold', color: '#f59e0b' }}>{activeDisplay.bin.tpos.length} ({activeDisplay.bin.tpos.join('')})</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
              <span style={{ color: isDark ? 'var(--text-secondary)' : '#64748b' }}>Volume:</span>
              <span style={{ fontWeight: 'bold', color: '#3b82f6' }}>{Math.round(activeDisplay.bin.volume).toLocaleString()}</span>
            </div>
            {activeDisplay.isSinglePrint && (
              <div style={{ color: '#f59e0b', backgroundColor: 'rgba(245, 158, 11, 0.2)', fontWeight: 'bold', fontSize: '9px', textAlign: 'center', padding: '2px 4px', borderRadius: '3px', marginTop: '4px' }}>
                ⚡ Single Print Imbalance Level
              </div>
            )}
            {activeDisplay.bin.price === activeDisplay.profile.pocPrice && (
              <div style={{ color: '#000', backgroundColor: '#00f0ff', fontWeight: 'bold', fontSize: '9px', textAlign: 'center', padding: '2px 4px', borderRadius: '3px', marginTop: '6px', textTransform: 'uppercase' }}>
                ⭐ Point of Control (POC)
              </div>
            )}
            {activeDisplay.bin.price === activeDisplay.profile.vahPrice && (
              <div style={{ color: '#a855f7', fontWeight: 'bold', fontSize: '9px', marginTop: '4px' }}>
                🟣 Value Area High (VAH)
              </div>
            )}
            {activeDisplay.bin.price === activeDisplay.profile.valPrice && (
              <div style={{ color: '#a855f7', fontWeight: 'bold', fontSize: '9px', marginTop: '4px' }}>
                🟣 Value Area Low (VAL)
              </div>
            )}
            {(() => {
              const sessionInfo = poorHighLowStatusMap[activeDisplay.profile.bins.length > 0 ? dayProfiles.findIndex(dp => dp.dateStr === activeDisplay.profile.dateStr) : -1];
              const isTopBin = activeDisplay.bin === activeDisplay.profile.bins[0];
              const isBottomBin = activeDisplay.bin === activeDisplay.profile.bins[activeDisplay.profile.bins.length - 1];

              if (isTopBin && sessionInfo && (sessionInfo.isPoorHigh || sessionInfo.isWeakHigh)) {
                return (
                  <div style={{
                    color: sessionInfo.isHighUnfinished ? '#ef4444' : '#94a3b8',
                    backgroundColor: sessionInfo.isHighUnfinished ? 'rgba(239, 68, 68, 0.18)' : 'rgba(255, 255, 255, 0.06)',
                    fontWeight: 'bold',
                    fontSize: '9px',
                    textAlign: 'center',
                    padding: '3px 6px',
                    borderRadius: '4px',
                    marginTop: '5px',
                    border: `1px solid ${sessionInfo.isHighUnfinished ? 'rgba(239, 68, 68, 0.45)' : 'rgba(255,255,255,0.1)'}`
                  }}>
                    {sessionInfo.isPoorHigh ? '⚠️ POOR HIGH (Flat Top - Unfinished Business)' : '⚠️ WEAK HIGH (1-Tick Print - No Excess Tail)'}
                    <div style={{ fontSize: '8px', marginTop: '2px', opacity: 0.9 }}>
                      {sessionInfo.isHighUnfinished ? '🔴 Active Unfinished Business (Revisit Target)' : `✅ Repaired by later session (${sessionInfo.highRepairedDate})`}
                    </div>
                  </div>
                );
              }

              if (isBottomBin && sessionInfo && (sessionInfo.isPoorLow || sessionInfo.isWeakLow)) {
                return (
                  <div style={{
                    color: sessionInfo.isLowUnfinished ? '#06b6d4' : '#94a3b8',
                    backgroundColor: sessionInfo.isLowUnfinished ? 'rgba(6, 182, 212, 0.18)' : 'rgba(255, 255, 255, 0.06)',
                    fontWeight: 'bold',
                    fontSize: '9px',
                    textAlign: 'center',
                    padding: '3px 6px',
                    borderRadius: '4px',
                    marginTop: '5px',
                    border: `1px solid ${sessionInfo.isLowUnfinished ? 'rgba(6, 182, 212, 0.45)' : 'rgba(255,255,255,0.1)'}`
                  }}>
                    {sessionInfo.isPoorLow ? '⚠️ POOR LOW (Flat Bottom - Unfinished Business)' : '⚠️ WEAK LOW (1-Tick Print - No Excess Tail)'}
                    <div style={{ fontSize: '8px', marginTop: '2px', opacity: 0.9 }}>
                      {sessionInfo.isLowUnfinished ? '🔵 Active Unfinished Business (Revisit Target)' : `✅ Repaired by later session (${sessionInfo.lowRepairedDate})`}
                    </div>
                  </div>
                );
              }

              return null;
            })()}

            {/* Shortcut info footer */}
            <div style={{ marginTop: '8px', paddingTop: '6px', borderTop: `1px dashed ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '9px', color: isDark ? '#94a3b8' : '#64748b' }}>
              <span>💡 {isItemPinned ? 'Ready for screenshot! Press Win+Shift+S or Capture' : 'Click chart or press [P] to Pin'}</span>
              <span>{isItemPinned ? 'Press [Esc] to Unpin' : '[P] Pin'}</span>
            </div>
          </div>
        );
      })()}
      </div>

      {/* Bottom Horizontal Quick Scroll Bar Track & Statistics Table (Hidden in Fullscreen so 100% of screen is dedicated to the chart) */}
      {!isExpanded && (
        <>
          {/* Bottom Horizontal Quick Scroll Bar Track */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(15, 23, 42, 0.6)', padding: '8px 14px', borderRadius: '8px', border: '1px solid var(--border-color)', gap: '10px' }}>
            <button
              onClick={() => setPanOffset(prev => ({ ...prev, x: prev.x + 280 }))}
              style={{ background: '#1e293b', border: '1px solid rgba(0, 240, 255, 0.3)', color: '#60a5fa', padding: '8px 16px', borderRadius: '6px', fontSize: '12px', fontWeight: '800', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
              title="Scroll chart to the left to view older daily sessions"
            >
              <ChevronLeft size={18} /> ◀ SCROLL LEFT (OLDER SESSIONS)
            </button>

            <button
              onClick={handleDoubleClick}
              style={{ background: 'rgba(0, 240, 255, 0.15)', border: '1px solid #00f0ff', color: '#00f0ff', padding: '8px 18px', borderRadius: '6px', fontSize: '12px', fontWeight: '800', cursor: 'pointer' }}
              title="Reset zoom & return to the latest session"
            >
              🎯 RESET TO LATEST SESSION
            </button>

            <button
              onClick={() => setPanOffset(prev => ({ ...prev, x: prev.x - 280 }))}
              style={{ background: '#1e293b', border: '1px solid rgba(0, 240, 255, 0.3)', color: '#60a5fa', padding: '8px 16px', borderRadius: '6px', fontSize: '12px', fontWeight: '800', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
              title="Scroll chart to the right to view recent daily sessions"
            >
              SCROLL RIGHT (RECENT) ▶ <ChevronRight size={18} />
            </button>
          </div>

          {/* Analytics & Session Statistics Table */}
          <div style={{ background: 'rgba(15, 23, 42, 0.6)', borderRadius: '8px', border: '1px solid var(--border-color)', padding: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <BarChart2 size={16} style={{ color: '#00f0ff' }} />
                <span style={{ fontSize: '14px', fontWeight: '700', color: 'white' }}>Session Market Profile Analytics</span>
                <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>({symbol} - {dayProfiles.length} Daily Sessions)</span>
              </div>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
                    <th style={{ padding: '8px 12px' }}>Date</th>
                    <th style={{ padding: '8px 12px' }}>Open</th>
                    <th style={{ padding: '8px 12px' }}>High</th>
                    <th style={{ padding: '8px 12px' }}>Low</th>
                    <th style={{ padding: '8px 12px' }}>Close</th>
                    <th style={{ padding: '8px 12px', color: '#00f0ff' }}>POC Price</th>
                    <th style={{ padding: '8px 12px' }}>POC Status</th>
                    <th style={{ padding: '8px 12px', color: '#a855f7' }}>VAH</th>
                    <th style={{ padding: '8px 12px', color: '#a855f7' }}>VAL</th>
                    <th style={{ padding: '8px 12px', color: '#f59e0b' }}>IB Range</th>
                    <th style={{ padding: '8px 12px' }}>Structure / Bias</th>
                  </tr>
                </thead>
                <tbody>
                  {dayProfiles.map((p, idx) => {
                    const isBullish = p.closePrice >= p.openPrice;
                    const priceChange = p.closePrice - p.openPrice;
                    const changePct = p.openPrice ? ((priceChange / p.openPrice) * 100).toFixed(2) : '0.00';
                    const ibWidth = p.ibHigh && p.ibLow ? (p.ibHigh - p.ibLow).toFixed(1) : '-';
                    const pocStatus = pocTestStatusMap[idx];

                    return (
                      <tr 
                        key={p.dateStr}
                        style={{ 
                          borderBottom: '1px solid rgba(255, 255, 255, 0.03)',
                          backgroundColor: idx % 2 === 0 ? 'transparent' : 'rgba(255, 255, 255, 0.015)'
                        }}
                      >
                        <td style={{ padding: '8px 12px', fontWeight: '700', color: 'white' }}>{formatDateShort(p.dateStr)}</td>
                        <td style={{ padding: '8px 12px' }}>{p.openPrice.toFixed(2)}</td>
                        <td style={{ padding: '8px 12px', color: '#10b981' }}>{p.dayHigh.toFixed(2)}</td>
                        <td style={{ padding: '8px 12px', color: '#ef4444' }}>{p.dayLow.toFixed(2)}</td>
                        <td style={{ padding: '8px 12px', fontWeight: '600', color: isBullish ? '#10b981' : '#ef4444' }}>
                          {p.closePrice.toFixed(2)} ({isBullish ? '+' : ''}{changePct}%)
                        </td>
                        <td style={{ padding: '8px 12px', fontWeight: '800', color: '#00f0ff' }}>{p.pocPrice.toFixed(2)}</td>
                        <td style={{ padding: '8px 12px' }}>
                          {pocStatus?.isTested ? (
                            <span style={{ fontSize: '10px', color: '#94a3b8', backgroundColor: 'rgba(255,255,255,0.06)', padding: '2px 6px', borderRadius: '4px' }}>
                              Tested @ {formatDateShort(pocStatus.testedDate)}
                            </span>
                          ) : (
                            <span style={{ fontSize: '10px', color: '#00f0ff', fontWeight: '700', backgroundColor: 'rgba(0, 240, 255, 0.15)', padding: '2px 6px', borderRadius: '4px' }}>
                              ⚡ Untested (Naked POC)
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '8px 12px', color: '#a855f7' }}>{p.vahPrice.toFixed(2)}</td>
                        <td style={{ padding: '8px 12px', color: '#a855f7' }}>{p.valPrice.toFixed(2)}</td>
                        <td style={{ padding: '8px 12px', color: '#f59e0b', fontWeight: '700' }}>
                          {p.ibLow.toFixed(1)} - {p.ibHigh.toFixed(1)} ({ibWidth} pts)
                        </td>
                        <td style={{ padding: '8px 12px' }}>
                          <span style={{ 
                            display: 'inline-flex', 
                            alignItems: 'center', 
                            gap: '4px',
                            padding: '2px 8px', 
                            borderRadius: '4px', 
                            fontSize: '11px',
                            fontWeight: '700',
                            backgroundColor: isBullish ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                            color: isBullish ? '#34d399' : '#f87171'
                          }}>
                            {isBullish ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                            {isBullish ? 'Bullish Session' : 'Bearish Session'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

    </div>
  );
};
