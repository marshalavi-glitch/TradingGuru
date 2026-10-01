import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { getBackendHttpUrl } from '../utils/tvStreamer';
import { ChevronDown, Check, Crosshair, Target, ZoomIn, ZoomOut, Maximize2, Minimize2, RotateCcw, MoveVertical, MoveHorizontal, ExternalLink } from 'lucide-react';

export interface FootprintChartContainerProps {
  onSymbolSelect?: (symbol: string) => void;
  onTimeframeChange?: (timeframe: string) => void;
  onSwitchToChart?: () => void;
  selectedSymbol?: string;
  selectedTimeframe?: string | number;
}

interface InstrumentConfig {
  symbol: string;
  label: string;
  type: 'FUTURES' | 'COMMODITY' | 'INDEX' | 'STOCK';
  defaultTick: number;
}

const INSTRUMENTS: InstrumentConfig[] = [
  { symbol: 'NIFTYFUT', label: '$NIFTY', type: 'FUTURES', defaultTick: 2.5 },
  { symbol: 'BANKNIFTYFUT', label: '$BANKNIFTY', type: 'FUTURES', defaultTick: 10 },
  { symbol: 'CRUDEOILFUT', label: '$CRUDEOIL', type: 'COMMODITY', defaultTick: 5 },
  { symbol: 'NIFTY', label: 'NIFTY 50', type: 'INDEX', defaultTick: 2.5 },
  { symbol: 'BANKNIFTY', label: 'BANK NIFTY', type: 'INDEX', defaultTick: 10 },
  { symbol: 'RELIANCE', label: 'RELIANCE', type: 'STOCK', defaultTick: 1 },
  { symbol: 'HDFCBANK', label: 'HDFCBANK', type: 'STOCK', defaultTick: 1 },
  { symbol: 'ICICIBANK', label: 'ICICIBANK', type: 'STOCK', defaultTick: 1 },
  { symbol: 'SBIN', label: 'SBIN', type: 'STOCK', defaultTick: 1 },
  { symbol: 'TCS', label: 'TCS', type: 'STOCK', defaultTick: 2 },
  { symbol: 'INFY', label: 'INFY', type: 'STOCK', defaultTick: 1 },
];

const TIMEFRAMES = [
  { value: '1', label: '1 Minute' },
  { value: '3', label: '3 Minute' },
  { value: '5', label: '5 Minute' },
  { value: '15', label: '15 Minute' },
  { value: '30', label: '30 Minute' },
  { value: '60', label: '60 Minute' }
];

interface PriceLevel {
  price: number;
  bidVol: number;
  askVol: number;
  totalVol: number;
  delta: number;
}

interface CotPoint {
  net: number;
  oi: number;
  cotIndex: number;
}

interface FootprintCandle {
  timestamp: number;
  timeStr: string;
  dateStr?: string;
  isNewDay?: boolean;
  period: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  delta: number;
  cvd: number;
  minDelta: number;
  maxDelta: number;
  priceLevels: PriceLevel[];
  cot?: {
    top: CotPoint;
    btm: CotPoint;
  };
  pocPrice?: number;
  hasUfbLow?: boolean;
  ufbLowPrice?: number;
  hasUfbHigh?: boolean;
  ufbHighPrice?: number;
}

interface UfbExtension {
  candleIdx: number;
  price: number;
  type: 'LOW' | 'HIGH';
  startIdx: number;
  endIdx: number;
  isTested: boolean;
  volume: number;
}

interface OrderflowState {
  success: boolean;
  activeSymbol: string;
  symbol: string;
  timeframe: number | string;
  tickSize: number;
  lastPrice: number;
  runningCvd: number;
  connected: boolean;
  totalTicksReceived: number;
  compositePoc: number;
  compositeProfile: { price: number; volume: number }[];
  candles: FootprintCandle[];
}

function getCandleDateStr(c: FootprintCandle): string {
  if (c.dateStr) return c.dateStr;
  const ms = c.timestamp < 1e11 ? c.timestamp * 1000 : c.timestamp;
  const d = new Date(ms);
  const day = String(d.getDate()).padStart(2, '0');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${day} ${months[d.getMonth()]}`;
}

function checkIfNewDay(c: FootprintCandle, prevC?: FootprintCandle): boolean {
  if (c.isNewDay !== undefined) return c.isNewDay;
  if (!prevC) return true;
  const ms1 = c.timestamp < 1e11 ? c.timestamp * 1000 : c.timestamp;
  const ms2 = prevC.timestamp < 1e11 ? prevC.timestamp * 1000 : prevC.timestamp;
  const d1 = new Date(ms1);
  const d2 = new Date(ms2);
  return d1.toDateString() !== d2.toDateString();
}

function aggregateLevelsToTick(levels: PriceLevel[], targetTick: number): PriceLevel[] {
  if (!levels || levels.length === 0 || targetTick <= 0) return levels || [];
  const map = new Map<number, PriceLevel>();
  const decimals = targetTick < 0.1 ? 3 : (targetTick < 1 ? 2 : (targetTick < 10 ? 1 : 0));

  for (const lvl of levels) {
    const binnedPrice = parseFloat((Math.round(lvl.price / targetTick) * targetTick).toFixed(decimals));
    const cur = map.get(binnedPrice);
    if (cur) {
      cur.bidVol += (lvl.bidVol || 0);
      cur.askVol += (lvl.askVol || 0);
      cur.totalVol += (lvl.totalVol || (lvl.bidVol || 0) + (lvl.askVol || 0));
      cur.delta += (lvl.delta || ((lvl.askVol || 0) - (lvl.bidVol || 0)));
    } else {
      map.set(binnedPrice, {
        price: binnedPrice,
        bidVol: lvl.bidVol || 0,
        askVol: lvl.askVol || 0,
        totalVol: lvl.totalVol || ((lvl.bidVol || 0) + (lvl.askVol || 0)),
        delta: lvl.delta || ((lvl.askVol || 0) - (lvl.bidVol || 0))
      });
    }
  }

  return Array.from(map.values()).sort((a, b) => b.price - a.price);
}

export const TestContainer: React.FC<FootprintChartContainerProps> = ({
  onSymbolSelect,
  onTimeframeChange,
  onSwitchToChart,
  selectedSymbol,
  selectedTimeframe,
}) => {
  const [symbol, setSymbol] = useState<string>(() => {
    if (selectedSymbol) return selectedSymbol.replace('NSE:', '').replace('NFO:', '').trim();
    return 'NIFTYFUT';
  });
  const [timeframe, setTimeframe] = useState<string | number>(() => {
    return selectedTimeframe || '5';
  });
  const [data, setData] = useState<OrderflowState | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [backendUrl, setBackendUrl] = useState<string>('');

  // Dropdown states
  const [showSymbolDropdown, setShowSymbolDropdown] = useState<boolean>(false);
  const [showTimeframeDropdown, setShowTimeframeDropdown] = useState<boolean>(false);
  const [showModeDropdown, setShowModeDropdown] = useState<boolean>(false);
  const [chartMode, setChartMode] = useState<string>('Bid/Ask Imbalance');
  const [showTable, setShowTable] = useState<boolean>(true);
  const [showProfile, setShowProfile] = useState<boolean>(true);
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

  // Layout scales - Bell OrderFlow Pro calibrated dimensions
  const [rungHeight, setRungHeight] = useState<number>(20);
  const [candleWidth, setCandleWidth] = useState<number>(126);
  const [autoScroll, setAutoScroll] = useState<boolean>(true);

  // Crosshair
  const [crosshairEnabled, setCrosshairEnabled] = useState<boolean>(true);
  const [crosshair, setCrosshair] = useState<{
    x: number;
    y: number;
    price: number | null;
    candle: FootprintCandle | null;
  } | null>(null);

  // Pan / drag state
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const dragRef = useRef<{ startX: number; startY: number; scrollLeft: number; scrollTop: number } | null>(null);

  // Scroll container refs
  const chartScrollRef = useRef<HTMLDivElement | null>(null);
  const profileScrollRef = useRef<HTMLDivElement | null>(null);
  const priceScrollRef = useRef<HTMLDivElement | null>(null);
  const tableScrollRef = useRef<HTMLDivElement | null>(null);
  const timeBarScrollRef = useRef<HTMLDivElement | null>(null);
  const miniCandlesScrollRef = useRef<HTMLDivElement | null>(null);

  // Two-way interactive scaling states & drag refs (Price Y-axis & Time X-axis)
  const [isDraggingPriceScale, setIsDraggingPriceScale] = useState<boolean>(false);
  const [isDraggingTimeScale, setIsDraggingTimeScale] = useState<boolean>(false);
  const priceScaleDragRef = useRef<{ y: number; initialRung: number } | null>(null);
  const timeScaleDragRef = useRef<{ x: number; initialWidth: number } | null>(null);

  // Persistent user scroll position trackers to prevent snapback when inspecting history
  const initialFitDoneRef = useRef<boolean>(false);
  const isAtRightEdgeRef = useRef<boolean>(true);

  // Tick Size & Imbalance interactive configuration (initialized from URL if popped out)
  const [customTick, setCustomTick] = useState<number | null>(() => {
    try {
      const p = new URLSearchParams(window.location.search);
      const t = p.get('tick');
      if (t && !isNaN(parseFloat(t)) && parseFloat(t) > 0) return parseFloat(t);
    } catch (e) {}
    return null;
  });
  const [tickInput, setTickInput] = useState<string>(() => {
    try {
      const p = new URLSearchParams(window.location.search);
      const t = p.get('tick');
      if (t) return t;
    } catch (e) {}
    return '';
  });
  const [showTickDropdown, setShowTickDropdown] = useState<boolean>(false);

  const [imbalanceRatio, setImbalanceRatio] = useState<number>(() => {
    try {
      const p = new URLSearchParams(window.location.search);
      const im = p.get('imbalance');
      if (im && !isNaN(parseFloat(im)) && parseFloat(im) > 0) return parseFloat(im);
    } catch (e) {}
    return 3.0;
  });
  const [imbalanceInput, setImbalanceInput] = useState<string>(() => {
    try {
      const p = new URLSearchParams(window.location.search);
      const im = p.get('imbalance');
      if (im) return im;
    } catch (e) {}
    return '3.0';
  });
  const [showImbalanceDropdown, setShowImbalanceDropdown] = useState<boolean>(false);

  const activeInstrument = INSTRUMENTS.find((inst) => inst.symbol.toUpperCase() === symbol.toUpperCase());
  const baseTickSize = data?.tickSize || (activeInstrument ? activeInstrument.defaultTick : null) || 2.5;
  const tickSize = (customTick !== null && customTick > 0) ? customTick : baseTickSize;

  // Toggle Fullscreen: covers dashboard with fixed overlay + native fullscreen
  const toggleFullscreen = useCallback(() => {
    setIsExpanded((prev) => {
      const next = !prev;
      if (next) {
        if (containerRef.current && containerRef.current.requestFullscreen) {
          containerRef.current.requestFullscreen().catch(() => {});
        }
      } else {
        if (document.fullscreenElement && document.exitFullscreen) {
          document.exitFullscreen().catch(() => {});
        }
      }
      return next;
    });
  }, []);

  // Pop Out into new browser tab / window
  const handlePopOut = useCallback(() => {
    const origin = window.location.origin;
    const pathname = window.location.pathname;
    const params = new URLSearchParams();
    params.set('tab', 'test');
    params.set('symbol', symbol);
    params.set('timeframe', String(timeframe));
    if (customTick) params.set('tick', String(customTick));
    if (imbalanceRatio) params.set('imbalance', String(imbalanceRatio));
    params.set('standalone', 'true');
    window.open(`${origin}${pathname}?${params.toString()}`, '_blank');
  }, [symbol, timeframe, customTick, imbalanceRatio]);

  // Sync with Escape key and fullscreenchange event
  useEffect(() => {
    const handleFsChange = () => {
      if (!document.fullscreenElement && isExpanded) {
        setIsExpanded(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isExpanded) {
        setIsExpanded(false);
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

  // Sync selectedSymbol if passed from parent
  useEffect(() => {
    if (selectedSymbol) {
      const clean = selectedSymbol.replace('NSE:', '').replace('NFO:', '').trim();
      if (clean && clean !== symbol) {
        initialFitDoneRef.current = false;
        isAtRightEdgeRef.current = true;
        setSymbol(clean);
        setCustomTick(null);
        setTickInput('');
        setData(null);
        setLoading(true);
      }
    }
  }, [selectedSymbol]);

  // Sync selectedTimeframe if passed from parent
  useEffect(() => {
    if (selectedTimeframe !== undefined && selectedTimeframe !== null) {
      const cleanTf = String(selectedTimeframe).trim();
      if (cleanTf && cleanTf !== String(timeframe)) {
        initialFitDoneRef.current = false;
        isAtRightEdgeRef.current = true;
        setTimeframe(cleanTf);
        setData(null);
        setLoading(true);
      }
    }
  }, [selectedTimeframe]);

  // Resolve backend URL
  useEffect(() => {
    let isMounted = true;
    getBackendHttpUrl().then((url) => {
      if (isMounted && url) {
        setBackendUrl(url.replace(/\/+$/, ''));
      }
    });
    return () => { isMounted = false; };
  }, []);

  // Fetch OrderFlow State
  const fetchOrderflowState = useCallback(async () => {
    let base = backendUrl;
    if (!base) {
      base = await getBackendHttpUrl();
      if (base) setBackendUrl(base.replace(/\/+$/, ''));
    }
    if (!base) return;

    try {
      const tickParam = customTick ? `&tick=${customTick}` : '';
      const url = `${base}/api/orderflow/state?symbol=${encodeURIComponent(symbol)}&timeframe=${encodeURIComponent(String(timeframe))}${tickParam}&_t=${Date.now()}`;
      const res = await fetch(url, { headers: { 'bypass-tunnel-reminder': 'true' } });
      if (!res.ok) return;
      const json: OrderflowState = await res.json();
      if (json && json.success) {
        setData(json);
      }
    } catch (err) {
      // Polling fallback
    } finally {
      setLoading(false);
    }
  }, [backendUrl, symbol, timeframe, customTick]);

  // Main polling interval
  useEffect(() => {
    fetchOrderflowState();
    const interval = setInterval(fetchOrderflowState, 1000);
    return () => clearInterval(interval);
  }, [fetchOrderflowState]);

  // Switch timeframe handler
  const handleSwitchTimeframe = (newTf: string | number) => {
    const cleanTf = String(newTf).trim();
    initialFitDoneRef.current = false;
    isAtRightEdgeRef.current = true;
    setTimeframe(cleanTf);
    if (onTimeframeChange) onTimeframeChange(cleanTf);
    setData(null);
    setLoading(true);
    setShowTimeframeDropdown(false);
  };

  // Switch symbol handler
  const handleSwitchSymbol = async (newSym: string) => {
    initialFitDoneRef.current = false;
    isAtRightEdgeRef.current = true;
    if (onSymbolSelect) onSymbolSelect(newSym);
    setSymbol(newSym);
    setCustomTick(null);
    setTickInput('');
    setData(null);
    setLoading(true);
    setShowSymbolDropdown(false);

    let base = backendUrl;
    if (!base) base = await getBackendHttpUrl();
    if (base) {
      try {
        await fetch(`${base}/api/orderflow/switch`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ symbol: newSym, timeframe: String(timeframe) })
        });
        await fetchOrderflowState();
      } catch (err) {
        console.error('Failed to switch symbol:', err);
      } finally {
        setLoading(false);
      }
    }
  };

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = () => {
      setShowSymbolDropdown(false);
      setShowTimeframeDropdown(false);
      setShowModeDropdown(false);
      setShowTickDropdown(false);
      setShowImbalanceDropdown(false);
    };
    window.addEventListener('click', handleClickOutside);
    return () => window.removeEventListener('click', handleClickOutside);
  }, []);

  // Bin & aggregate candle price levels dynamically to effective tickSize
  const displayCandles = useMemo(() => {
    if (!data?.candles || data.candles.length === 0) return [];
    return data.candles.map(c => {
      const aggregatedLevels = aggregateLevelsToTick(c.priceLevels || [], tickSize);
      let pocLvl = aggregatedLevels[0];
      for (const lvl of aggregatedLevels) {
        const curVol = lvl.totalVol || ((lvl.bidVol || 0) + (lvl.askVol || 0));
        const maxVol = pocLvl ? (pocLvl.totalVol || ((pocLvl.bidVol || 0) + (pocLvl.askVol || 0))) : 0;
        if (curVol > maxVol) {
          pocLvl = lvl;
        }
      }
      return {
        ...c,
        pocPrice: pocLvl ? pocLvl.price : c.pocPrice,
        priceLevels: aggregatedLevels
      };
    });
  }, [data?.candles, tickSize]);

  // Bin & aggregate composite session profile dynamically to effective tickSize
  const compositeProfile = useMemo(() => {
    if (!data?.compositeProfile || data.compositeProfile.length === 0) return [];
    const map = new Map<number, { price: number; volume: number }>();
    const decimals = tickSize < 0.1 ? 3 : (tickSize < 1 ? 2 : (tickSize < 10 ? 1 : 0));
    for (const cp of data.compositeProfile) {
      const binned = parseFloat((Math.round(cp.price / tickSize) * tickSize).toFixed(decimals));
      const cur = map.get(binned);
      if (cur) {
        cur.volume += (cp.volume || 0);
      } else {
        map.set(binned, { price: binned, volume: cp.volume || 0 });
      }
    }
    return Array.from(map.values()).sort((a, b) => b.price - a.price);
  }, [data?.compositeProfile, tickSize]);

  // Compute price scale rungs
  const priceRungs = useMemo(() => {
    if (!displayCandles || displayCandles.length === 0) return [];
    let minP = Infinity;
    let maxP = -Infinity;

    displayCandles.forEach((c) => {
      if (c.low < minP) minP = c.low;
      if (c.high > maxP) maxP = c.high;
    });

    if (minP === Infinity) {
      minP = (data?.lastPrice ? data.lastPrice - 20 * tickSize : 100);
      maxP = (data?.lastPrice ? data.lastPrice + 20 * tickSize : 120);
    }

    const step = tickSize;
    const roundedMin = Math.floor(minP / step) * step;
    const roundedMax = Math.ceil(maxP / step) * step;
    const padMin = Math.max(0, roundedMin - 12 * step);
    const padMax = roundedMax + 12 * step;

    const rungs: number[] = [];
    const decimals = step < 0.1 ? 3 : (step < 1 ? 2 : (step < 10 ? 1 : 0));
    for (let p = padMax; p >= padMin; p = parseFloat((p - step).toFixed(decimals))) {
      rungs.push(parseFloat(p.toFixed(decimals)));
      if (rungs.length > 2500) break;
    }
    return rungs;
  }, [displayCandles, data?.lastPrice, tickSize]);

  // Compute Max Volume & Value Area for Session Profile
  const { maxCompVolume, vahPrice, valPrice } = useMemo(() => {
    if (!compositeProfile || compositeProfile.length === 0) {
      return { maxCompVolume: 1, vahPrice: 0, valPrice: 0 };
    }
    const maxV = Math.max(1, ...compositeProfile.map((cp) => cp.volume));
    const sorted = [...compositeProfile].sort((a, b) => b.price - a.price);
    const totalVol = sorted.reduce((sum, item) => sum + item.volume, 0);
    const targetVaVol = totalVol * 0.70;

    const pocObj = sorted.reduce((max, item) => item.volume > max.volume ? item : max, sorted[0]);
    let currentVaVol = pocObj.volume;
    let upIdx = sorted.findIndex(item => item.price === pocObj.price) - 1;
    let dnIdx = sorted.findIndex(item => item.price === pocObj.price) + 1;

    let highestPrice = pocObj.price;
    let lowestPrice = pocObj.price;

    while (currentVaVol < targetVaVol && (upIdx >= 0 || dnIdx < sorted.length)) {
      const upVol = upIdx >= 0 ? sorted[upIdx].volume : 0;
      const dnVol = dnIdx < sorted.length ? sorted[dnIdx].volume : 0;

      if (upVol >= dnVol && upIdx >= 0) {
        currentVaVol += upVol;
        highestPrice = sorted[upIdx].price;
        upIdx--;
      } else if (dnIdx < sorted.length) {
        currentVaVol += dnVol;
        lowestPrice = sorted[dnIdx].price;
        dnIdx++;
      } else if (upIdx >= 0) {
        currentVaVol += upVol;
        highestPrice = sorted[upIdx].price;
        upIdx--;
      } else {
        break;
      }
    }

    return { maxCompVolume: maxV, vahPrice: highestPrice, valPrice: lowestPrice };
  }, [compositeProfile]);

  // Calculate Naked POC Extensions across future candles
  const nakedPocExtensions = useMemo(() => {
    if (!displayCandles || displayCandles.length === 0) return [];
    const extensions: { price: number; startIdx: number; endIdx: number; isMajor: boolean }[] = [];

    const avgVol = displayCandles.reduce((sum, c) => sum + (c.volume || 0), 0) / displayCandles.length;

    displayCandles.forEach((c, idx) => {
      if (!c.pocPrice) return;
      const poc = c.pocPrice;
      let testedIdx = displayCandles.length - 1;

      for (let j = idx + 1; j < displayCandles.length; j++) {
        if (poc >= displayCandles[j].low && poc <= displayCandles[j].high) {
          testedIdx = j;
          break;
        }
      }

      extensions.push({
        price: poc,
        startIdx: idx,
        endIdx: testedIdx,
        isMajor: (c.volume || 0) >= avgVol * 1.15 || Math.abs(poc - (data?.compositePoc || 0)) < tickSize / 2
      });
    });

    return extensions;
  }, [displayCandles, data?.compositePoc, tickSize]);

  // Calculate UFB (Unfinished Business / Unfinished Auction) Extensions across future candles
  const ufbExtensions = useMemo(() => {
    if (!displayCandles || displayCandles.length === 0) return [];
    const extensions: UfbExtension[] = [];

    displayCandles.forEach((c, idx) => {
      const sortedLevels = [...(c.priceLevels || [])].sort((a, b) => b.price - a.price);
      if (sortedLevels.length === 0) return;
      const btmLevel = sortedLevels[sortedLevels.length - 1];
      const topLevel = sortedLevels[0];

      // 1. UFB Low: Left side 0 and right side number (bidVol === 0 && askVol > 0)
      const isUfbLow = c.hasUfbLow || (btmLevel && btmLevel.bidVol === 0 && btmLevel.askVol > 0);
      if (isUfbLow && btmLevel) {
        const ufbPrice = btmLevel.price;
        let testedIdx: number | null = null;
        for (let j = idx + 1; j < displayCandles.length; j++) {
          if (displayCandles[j].low <= ufbPrice) {
            testedIdx = j;
            break;
          }
        }
        extensions.push({
          candleIdx: idx,
          price: ufbPrice,
          type: 'LOW',
          startIdx: idx,
          endIdx: testedIdx !== null ? testedIdx : displayCandles.length - 1,
          isTested: testedIdx !== null,
          volume: btmLevel.askVol
        });
      }

      // 2. UFB High: Right side 0 and left side number (askVol === 0 && bidVol > 0)
      const isUfbHigh = c.hasUfbHigh || (topLevel && topLevel.askVol === 0 && topLevel.bidVol > 0);
      if (isUfbHigh && topLevel) {
        const ufbPrice = topLevel.price;
        let testedIdx: number | null = null;
        for (let j = idx + 1; j < displayCandles.length; j++) {
          if (displayCandles[j].high >= ufbPrice) {
            testedIdx = j;
            break;
          }
        }
        extensions.push({
          candleIdx: idx,
          price: ufbPrice,
          type: 'HIGH',
          startIdx: idx,
          endIdx: testedIdx !== null ? testedIdx : displayCandles.length - 1,
          isTested: testedIdx !== null,
          volume: topLevel.bidVol
        });
      }
    });

    return extensions;
  }, [displayCandles]);

  // Scroll to live candle (right edge)
  const scrollToLiveCandle = useCallback(() => {
    if (!chartScrollRef.current) return;
    const maxScroll = chartScrollRef.current.scrollWidth - chartScrollRef.current.clientWidth;
    if (maxScroll > 0) {
      chartScrollRef.current.scrollLeft = maxScroll;
      if (tableScrollRef.current) tableScrollRef.current.scrollLeft = maxScroll;
      if (timeBarScrollRef.current) timeBarScrollRef.current.scrollLeft = maxScroll;
      if (miniCandlesScrollRef.current) miniCandlesScrollRef.current.scrollLeft = maxScroll;
    }
  }, []);

  // Fit price scale to screen
  const fitPriceScale = useCallback(() => {
    if (!chartScrollRef.current || !data?.lastPrice || priceRungs.length === 0) return;
    const lastPrice = data.lastPrice;
    const rungIdx = Math.max(0, Math.min(priceRungs.length - 1, Math.round((priceRungs[0] - lastPrice) / tickSize)));
    if (rungIdx >= 0) {
      const targetY = (rungIdx * rungHeight) - (chartScrollRef.current.clientHeight / 2);
      chartScrollRef.current.scrollTop = Math.max(0, targetY);
      if (priceScrollRef.current) priceScrollRef.current.scrollTop = Math.max(0, targetY);
      if (profileScrollRef.current) profileScrollRef.current.scrollTop = Math.max(0, targetY);
    }
  }, [data?.lastPrice, priceRungs, rungHeight, tickSize]);

  // Fit both Price and Time (User pressed [ F ] Fit button)
  const fitAll = useCallback(() => {
    isAtRightEdgeRef.current = true;
    fitPriceScale();
    scrollToLiveCandle();
  }, [fitPriceScale, scrollToLiveCandle]);

  // Handle Initial Load and Live Polling Updates WITHOUT jerking or resetting user scroll
  useEffect(() => {
    if (!data?.candles?.length) return;

    // 1. Initial Load for this symbol/timeframe: center price and jump to live candle
    if (!initialFitDoneRef.current) {
      initialFitDoneRef.current = true;
      requestAnimationFrame(() => {
        fitPriceScale();
        scrollToLiveCandle();
      });
      return;
    }

    // 2. Periodic Live Polling (every 1s):
    // NEVER touch scrollTop so user's vertical panning is completely stable.
    // ONLY stick to right edge IF autoScroll is active AND user is currently at the right edge!
    if (autoScroll && isAtRightEdgeRef.current && chartScrollRef.current && !isDragging) {
      const el = chartScrollRef.current;
      const maxScroll = el.scrollWidth - el.clientWidth;
      if (maxScroll > 0) {
        el.scrollLeft = maxScroll;
        if (tableScrollRef.current) tableScrollRef.current.scrollLeft = maxScroll;
        if (timeBarScrollRef.current) timeBarScrollRef.current.scrollLeft = maxScroll;
        if (miniCandlesScrollRef.current) miniCandlesScrollRef.current.scrollLeft = maxScroll;
      }
    }
  }, [data?.candles?.length, autoScroll, fitPriceScale, scrollToLiveCandle, isDragging]);

  // Synchronized Vertical & Horizontal Scrolling between Profile, Chart Grid, Table, and Time Ladder
  const handleChartScroll = () => {
    if (!chartScrollRef.current) return;
    const el = chartScrollRef.current;
    const sTop = el.scrollTop;
    const sLeft = el.scrollLeft;

    // Detect if user has scrolled away from the live candle to inspect history
    const maxScroll = el.scrollWidth - el.clientWidth;
    isAtRightEdgeRef.current = maxScroll <= 0 || (maxScroll - sLeft) <= 60;

    if (profileScrollRef.current) profileScrollRef.current.scrollTop = sTop;
    if (priceScrollRef.current) priceScrollRef.current.scrollTop = sTop;
    if (tableScrollRef.current) tableScrollRef.current.scrollLeft = sLeft;
    if (timeBarScrollRef.current) timeBarScrollRef.current.scrollLeft = sLeft;
    if (miniCandlesScrollRef.current) miniCandlesScrollRef.current.scrollLeft = sLeft;
  };

  // Wheel zoom handler
  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey) {
      e.preventDefault();
      if (e.deltaY < 0) {
        setRungHeight(h => Math.min(42, h + 1));
      } else {
        setRungHeight(h => Math.max(14, h - 1));
      }
    } else if (e.shiftKey) {
      e.preventDefault();
      if (e.deltaY < 0) {
        setCandleWidth(w => Math.min(220, w + 6));
      } else {
        setCandleWidth(w => Math.max(85, w - 6));
      }
    }
  };

  // Drag canvas for free panning
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0 || !chartScrollRef.current) return;
    setIsDragging(true);
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      scrollLeft: chartScrollRef.current.scrollLeft,
      scrollTop: chartScrollRef.current.scrollTop
    };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging && dragRef.current && chartScrollRef.current) {
      const dx = e.clientX - dragRef.current.startX;
      const dy = e.clientY - dragRef.current.startY;
      const newLeft = dragRef.current.scrollLeft - dx;
      const newTop = dragRef.current.scrollTop - dy;

      chartScrollRef.current.scrollLeft = newLeft;
      chartScrollRef.current.scrollTop = newTop;
      if (tableScrollRef.current) tableScrollRef.current.scrollLeft = newLeft;
      if (timeBarScrollRef.current) timeBarScrollRef.current.scrollLeft = newLeft;
      if (miniCandlesScrollRef.current) miniCandlesScrollRef.current.scrollLeft = newLeft;
      if (profileScrollRef.current) profileScrollRef.current.scrollTop = newTop;
      if (priceScrollRef.current) priceScrollRef.current.scrollTop = newTop;

      const maxScroll = chartScrollRef.current.scrollWidth - chartScrollRef.current.clientWidth;
      isAtRightEdgeRef.current = maxScroll <= 0 || (maxScroll - newLeft) <= 60;
      return;
    }

    // Crosshair positioning
    if (crosshairEnabled && chartScrollRef.current && priceRungs.length > 0) {
      const rect = chartScrollRef.current.getBoundingClientRect();
      const clientX = e.clientX - rect.left;
      const clientY = e.clientY - rect.top;
      const totalY = clientY + chartScrollRef.current.scrollTop;
      const rungIdx = Math.floor(totalY / rungHeight);
      const price = priceRungs[rungIdx] || null;

      const totalX = clientX + chartScrollRef.current.scrollLeft;
      const candleIdx = Math.floor(totalX / candleWidth);
      const candle = (displayCandles && displayCandles[candleIdx]) || null;

      setCrosshair({ x: clientX, y: clientY, price, candle });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    dragRef.current = null;
  };

  const handleMouseLeave = () => {
    setIsDragging(false);
    dragRef.current = null;
    setCrosshair(null);
  };

  // Two-Way Interactive Scale Drag Handlers (Y-axis Price & X-axis Time)
  const handlePriceScaleDragStart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    priceScaleDragRef.current = { y: e.clientY, initialRung: rungHeight };
    setIsDraggingPriceScale(true);
  };

  const handleTimeScaleDragStart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    timeScaleDragRef.current = { x: e.clientX, initialWidth: candleWidth };
    setIsDraggingTimeScale(true);
  };

  // Global mouse move & mouse up listeners for smooth scale dragging across entire screen
  useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => {
      // 1. Interactive Price Scale drag-resize (Y-axis): Drag up to expand, drag down to compress
      if (priceScaleDragRef.current) {
        const deltaY = e.clientY - priceScaleDragRef.current.y;
        const change = Math.round(-deltaY * 0.22);
        setRungHeight(Math.max(14, Math.min(60, priceScaleDragRef.current.initialRung + change)));
      }

      // 2. Interactive Time Scale drag-resize (X-axis): Drag right to expand, drag left to compress
      if (timeScaleDragRef.current) {
        const deltaX = e.clientX - timeScaleDragRef.current.x;
        const change = Math.round(deltaX * 0.4);
        setCandleWidth(Math.max(70, Math.min(260, timeScaleDragRef.current.initialWidth + change)));
      }
    };

    const handleGlobalMouseUp = () => {
      if (priceScaleDragRef.current) {
        priceScaleDragRef.current = null;
        setIsDraggingPriceScale(false);
      }
      if (timeScaleDragRef.current) {
        timeScaleDragRef.current = null;
        setIsDraggingTimeScale(false);
      }
    };

    window.addEventListener('mousemove', handleGlobalMouseMove);
    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleGlobalMouseMove);
      window.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, []);

  const lastPrice = data?.lastPrice || (displayCandles && displayCandles.length > 0 ? displayCandles[displayCandles.length - 1].close : 0);

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
        height: isExpanded || isStandalone ? '100vh' : 'calc(100vh - 265px)',
        backgroundColor: '#000000',
        color: '#ffffff',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        overflow: 'hidden',
        boxSizing: 'border-box',
        userSelect: 'none'
      }}
    >
      {/* 1. TOP TOOLBAR */}
      <div
        style={{
          height: '34px',
          minHeight: '34px',
          backgroundColor: '#262626',
          borderBottom: '1px solid #333333',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 8px',
          fontSize: '11px',
          zIndex: 40
        }}
      >
        {/* Left Toolbar Items */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {/* Red [Chart] Tab Button */}
          <div
            style={{
              backgroundColor: '#d32f2f',
              color: '#ffffff',
              fontWeight: 800,
              fontSize: '11px',
              padding: '4px 10px',
              borderRadius: '2px',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              cursor: 'pointer',
              boxShadow: '0 1px 3px rgba(0,0,0,0.5)'
            }}
          >
            <span>Chart</span>
          </div>

          {/* Symbol Selector Dropdown: e.g. $NIFTY */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={(e) => { e.stopPropagation(); setShowSymbolDropdown(!showSymbolDropdown); }}
              style={{
                backgroundColor: '#333333',
                color: '#ffffff',
                border: '1px solid #484848',
                borderRadius: '2px',
                padding: '3px 8px',
                fontSize: '11px',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              <span>${symbol.replace('FUT', '')}</span>
              <ChevronDown size={11} color="#cccccc" />
            </button>

            {showSymbolDropdown && (
              <div
                style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  marginTop: '2px',
                  backgroundColor: '#1f1f1f',
                  border: '1px solid #444444',
                  borderRadius: '3px',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.8)',
                  zIndex: 100,
                  minWidth: '150px',
                  maxHeight: '300px',
                  overflowY: 'auto'
                }}
              >
                {INSTRUMENTS.map((inst) => (
                  <div
                    key={inst.symbol}
                    onClick={() => handleSwitchSymbol(inst.symbol)}
                    style={{
                      padding: '6px 12px',
                      cursor: 'pointer',
                      fontSize: '11px',
                      fontWeight: inst.symbol === symbol ? 800 : 500,
                      color: inst.symbol === symbol ? '#38bdf8' : '#e2e8f0',
                      backgroundColor: inst.symbol === symbol ? '#2d3748' : 'transparent',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between'
                    }}
                  >
                    <span>{inst.label}</span>
                    {inst.symbol === symbol && <Check size={12} color="#38bdf8" />}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Timeframe Selector Dropdown: e.g. 5 Minute */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={(e) => { e.stopPropagation(); setShowTimeframeDropdown(!showTimeframeDropdown); }}
              style={{
                backgroundColor: '#333333',
                color: '#ffffff',
                border: '1px solid #484848',
                borderRadius: '2px',
                padding: '3px 8px',
                fontSize: '11px',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              <span>{TIMEFRAMES.find(t => t.value === String(timeframe))?.label || `${timeframe} Minute`}</span>
              <ChevronDown size={11} color="#cccccc" />
            </button>

            {showTimeframeDropdown && (
              <div
                style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  marginTop: '2px',
                  backgroundColor: '#1f1f1f',
                  border: '1px solid #444444',
                  borderRadius: '3px',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.8)',
                  zIndex: 100,
                  minWidth: '110px'
                }}
              >
                {TIMEFRAMES.map((tf) => (
                  <div
                    key={tf.value}
                    onClick={() => handleSwitchTimeframe(tf.value)}
                    style={{
                      padding: '6px 12px',
                      cursor: 'pointer',
                      fontSize: '11px',
                      fontWeight: tf.value === String(timeframe) ? 800 : 500,
                      color: tf.value === String(timeframe) ? '#38bdf8' : '#e2e8f0',
                      backgroundColor: tf.value === String(timeframe) ? '#2d3748' : 'transparent',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between'
                    }}
                  >
                    <span>{tf.label}</span>
                    {tf.value === String(timeframe) && <Check size={12} color="#38bdf8" />}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={{ width: '1px', height: '18px', backgroundColor: '#3e3e3e', margin: '0 3px' }} />

          {/* Quick Toolbar Tool Icons */}
          <button
            onClick={() => setCrosshairEnabled(!crosshairEnabled)}
            title="Crosshair (+)"
            style={{
              background: crosshairEnabled ? '#3b4252' : 'transparent',
              border: 'none',
              color: crosshairEnabled ? '#38bdf8' : '#cccccc',
              padding: '3px 6px',
              borderRadius: '2px',
              cursor: 'pointer'
            }}
          >
            <Crosshair size={13} />
          </button>

          <button
            onClick={fitAll}
            title="Auto-Fit (Recenter & Fit)"
            style={{
              background: 'transparent',
              border: 'none',
              color: '#cccccc',
              padding: '3px 6px',
              borderRadius: '2px',
              cursor: 'pointer'
            }}
          >
            <Target size={13} />
          </button>

          <button
            onClick={() => setRungHeight(h => Math.min(40, h + 2))}
            title="Zoom In (Y)"
            style={{
              background: 'transparent',
              border: 'none',
              color: '#cccccc',
              padding: '3px 6px',
              borderRadius: '2px',
              cursor: 'pointer'
            }}
          >
            <ZoomIn size={13} />
          </button>

          <button
            onClick={() => setRungHeight(h => Math.max(14, h - 2))}
            title="Zoom Out (Y)"
            style={{
              background: 'transparent',
              border: 'none',
              color: '#cccccc',
              padding: '3px 6px',
              borderRadius: '2px',
              cursor: 'pointer'
            }}
          >
            <ZoomOut size={13} />
          </button>

          <div style={{ width: '1px', height: '18px', backgroundColor: '#3e3e3e', margin: '0 3px' }} />

          {/* Mode Dropdown: Bid/Ask Imbalance */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={(e) => { e.stopPropagation(); setShowModeDropdown(!showModeDropdown); }}
              style={{
                backgroundColor: '#333333',
                color: '#ffffff',
                border: '1px solid #484848',
                borderRadius: '2px',
                padding: '3px 8px',
                fontSize: '11px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '5px'
              }}
            >
              <span>{chartMode}</span>
              <ChevronDown size={11} color="#cccccc" />
            </button>

            {showModeDropdown && (
              <div
                style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  marginTop: '2px',
                  backgroundColor: '#1f1f1f',
                  border: '1px solid #444444',
                  borderRadius: '3px',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.8)',
                  zIndex: 100,
                  minWidth: '160px'
                }}
              >
                {['Bid/Ask Imbalance', 'Bid/Ask', 'Delta', 'Volume'].map((mode) => (
                  <div
                    key={mode}
                    onClick={() => { setChartMode(mode); setShowModeDropdown(false); }}
                    style={{
                      padding: '6px 12px',
                      cursor: 'pointer',
                      fontSize: '11px',
                      fontWeight: mode === chartMode ? 800 : 500,
                      color: mode === chartMode ? '#38bdf8' : '#e2e8f0',
                      backgroundColor: mode === chartMode ? '#2d3748' : 'transparent',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between'
                    }}
                  >
                    <span>{mode}</span>
                    {mode === chartMode && <Check size={12} color="#38bdf8" />}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Tick Size Custom Input & Quick Selector */}
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                backgroundColor: '#262626',
                border: '1px solid #444444',
                borderRadius: '3px',
                padding: '2px 6px',
                gap: '5px'
              }}
            >
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#94a3b8' }}>Tick:</span>
              <input
                type="number"
                step="any"
                min="0.01"
                value={tickInput !== '' ? tickInput : String(tickSize)}
                onChange={(e) => {
                  const valStr = e.target.value;
                  setTickInput(valStr);
                  const val = parseFloat(valStr);
                  if (!isNaN(val) && val > 0) {
                    setCustomTick(val);
                  } else if (valStr === '') {
                    setCustomTick(null);
                  }
                }}
                onBlur={() => {
                  if (customTick !== null) {
                    setTickInput(String(customTick));
                  } else {
                    setTickInput('');
                  }
                }}
                style={{
                  width: '44px',
                  backgroundColor: '#121212',
                  color: '#38bdf8',
                  border: '1px solid #3b4252',
                  borderRadius: '2px',
                  padding: '1px 4px',
                  fontSize: '11px',
                  fontWeight: 800,
                  textAlign: 'center',
                  outline: 'none'
                }}
                title="Enter custom Tick Size for ladder aggregation"
              />
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowTickDropdown(!showTickDropdown);
                  setShowImbalanceDropdown(false);
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#94a3b8',
                  cursor: 'pointer',
                  padding: 0,
                  display: 'flex',
                  alignItems: 'center'
                }}
                title="Select predefined Tick Size"
              >
                <ChevronDown size={11} />
              </button>
            </div>

            {showTickDropdown && (
              <div
                style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  marginTop: '2px',
                  backgroundColor: '#1f1f1f',
                  border: '1px solid #444444',
                  borderRadius: '3px',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.85)',
                  zIndex: 100,
                  minWidth: '110px',
                  padding: '4px 0'
                }}
              >
                <div style={{ padding: '3px 8px', fontSize: '9.5px', color: '#64748b', fontWeight: 800, textTransform: 'uppercase' }}>
                  Tick Presets
                </div>
                {[0.05, 0.1, 0.5, 1, 2, 2.5, 5, 10, 20].map((t) => (
                  <div
                    key={t}
                    onClick={() => {
                      setCustomTick(t);
                      setTickInput(String(t));
                      setShowTickDropdown(false);
                    }}
                    style={{
                      padding: '5px 12px',
                      cursor: 'pointer',
                      fontSize: '11px',
                      fontWeight: tickSize === t ? 800 : 500,
                      color: tickSize === t ? '#38bdf8' : '#e2e8f0',
                      backgroundColor: tickSize === t ? '#2d3748' : 'transparent',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between'
                    }}
                  >
                    <span>{t}</span>
                    {tickSize === t && <Check size={11} color="#38bdf8" />}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Imbalance Ratio Custom Input & Quick Selector */}
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                backgroundColor: '#262626',
                border: '1px solid #444444',
                borderRadius: '3px',
                padding: '2px 6px',
                gap: '5px'
              }}
            >
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#94a3b8' }}>Imbalance:</span>
              <input
                type="number"
                step="0.1"
                min="1.0"
                max="20.0"
                value={imbalanceInput}
                onChange={(e) => {
                  const valStr = e.target.value;
                  setImbalanceInput(valStr);
                  const val = parseFloat(valStr);
                  if (!isNaN(val) && val > 0) {
                    setImbalanceRatio(val);
                  }
                }}
                onBlur={() => {
                  setImbalanceInput(String(imbalanceRatio));
                }}
                style={{
                  width: '38px',
                  backgroundColor: '#121212',
                  color: '#f59e0b',
                  border: '1px solid #3b4252',
                  borderRadius: '2px',
                  padding: '1px 4px',
                  fontSize: '11px',
                  fontWeight: 800,
                  textAlign: 'center',
                  outline: 'none'
                }}
                title="Enter custom Imbalance Ratio (e.g., 3.0 for 300%)"
              />
              <span style={{ fontSize: '11px', fontWeight: 800, color: '#f59e0b' }}>x</span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowImbalanceDropdown(!showImbalanceDropdown);
                  setShowTickDropdown(false);
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#94a3b8',
                  cursor: 'pointer',
                  padding: 0,
                  display: 'flex',
                  alignItems: 'center'
                }}
                title="Select predefined Imbalance Multiplier"
              >
                <ChevronDown size={11} />
              </button>
            </div>

            {showImbalanceDropdown && (
              <div
                style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  marginTop: '2px',
                  backgroundColor: '#1f1f1f',
                  border: '1px solid #444444',
                  borderRadius: '3px',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.85)',
                  zIndex: 100,
                  minWidth: '110px',
                  padding: '4px 0'
                }}
              >
                <div style={{ padding: '3px 8px', fontSize: '9.5px', color: '#64748b', fontWeight: 800, textTransform: 'uppercase' }}>
                  Ratio Presets
                </div>
                {[1.5, 2.0, 2.5, 3.0, 3.5, 4.0, 5.0].map((r) => (
                  <div
                    key={r}
                    onClick={() => {
                      setImbalanceRatio(r);
                      setImbalanceInput(String(r));
                      setShowImbalanceDropdown(false);
                    }}
                    style={{
                      padding: '5px 12px',
                      cursor: 'pointer',
                      fontSize: '11px',
                      fontWeight: imbalanceRatio === r ? 800 : 500,
                      color: imbalanceRatio === r ? '#f59e0b' : '#e2e8f0',
                      backgroundColor: imbalanceRatio === r ? '#2d3748' : 'transparent',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between'
                    }}
                  >
                    <span>{r}x ({Math.round(r * 100)}%)</span>
                    {imbalanceRatio === r && <Check size={11} color="#f59e0b" />}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={{ width: '1px', height: '18px', backgroundColor: '#3e3e3e', margin: '0 2px' }} />

          {/* Table Toggle Button / Dropdown */}
          <button
            onClick={() => setShowTable(!showTable)}
            style={{
              backgroundColor: showTable ? '#3b4252' : '#333333',
              color: '#ffffff',
              border: '1px solid #484848',
              borderRadius: '2px',
              padding: '3px 8px',
              fontSize: '11px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            <span>Table</span>
            <ChevronDown size={11} color="#cccccc" />
          </button>

          {/* Profile Toggle */}
          <button
            onClick={() => setShowProfile(!showProfile)}
            style={{
              backgroundColor: showProfile ? '#3b4252' : '#333333',
              color: '#ffffff',
              border: '1px solid #484848',
              borderRadius: '2px',
              padding: '3px 8px',
              fontSize: '11px',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            <span>TPO Profile</span>
          </button>

          {/* UFB Status Badge */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              backgroundColor: '#451a03',
              border: '1px solid #d97706',
              borderRadius: '2px',
              padding: '2px 8px',
              fontSize: '11px',
              fontWeight: 800,
              color: '#fef3c7',
              cursor: 'default'
            }}
            title="Unfinished Business (UFB): Displays candles where auction low has 0 Bid & >0 Ask, with extension rays"
          >
            <span style={{ color: '#f59e0b' }}>⚡ UFB</span>
            <span
              style={{
                backgroundColor: '#d97706',
                color: '#000000',
                borderRadius: '8px',
                padding: '0 5px',
                fontSize: '9.5px',
                fontWeight: 900
              }}
            >
              {ufbExtensions.filter(e => !e.isTested).length} Active
            </span>
          </div>
        </div>

        {/* Right Toolbar Items: Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>

          {/* F (Fit) Button */}
          <button
            onClick={fitPriceScale}
            style={{
              backgroundColor: '#333333',
              color: '#ffffff',
              border: '1px solid #555555',
              borderRadius: '2px',
              width: '22px',
              height: '22px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '11px',
              fontWeight: 900,
              cursor: 'pointer'
            }}
            title="Fit Scale (F)"
          >
            F
          </button>

          {/* Pop Out into New Browser Tab / Window Button */}
          <button
            onClick={handlePopOut}
            style={{
              backgroundColor: '#262626',
              color: '#38bdf8',
              border: '1px solid #444444',
              borderRadius: '2px',
              width: '24px',
              height: '22px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'background-color 0.15s'
            }}
            title="Pop out into new browser tab / window"
          >
            <ExternalLink size={12} />
          </button>

          {/* Expand Fullscreen Button (Covers Entire Dashboard) */}
          <button
            onClick={toggleFullscreen}
            style={{
              backgroundColor: isExpanded ? '#1d4ed8' : '#262626',
              color: isExpanded ? '#ffffff' : '#e2e8f0',
              border: isExpanded ? '1px solid #3b82f6' : '1px solid #444444',
              borderRadius: '2px',
              width: '24px',
              height: '22px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'all 0.15s'
            }}
            title={isExpanded ? 'Exit Fullscreen (Esc)' : 'Fullscreen (Covers Dashboard)'}
          >
            {isExpanded ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
          </button>
        </div>
      </div>

      {/* 2. MAIN CHART AREA (Left Volume Profile + Center Footprint Canvas + Right Price Scale) */}
      <div
        style={{
          display: 'flex',
          flex: 1,
          minHeight: 0,
          position: 'relative',
          backgroundColor: '#000000',
          overflow: 'hidden'
        }}
        onWheel={handleWheel}
      >
        {/* Left Side: Session Volume Profile (TPO Profile with Volume Counts) */}
        {showProfile && (
          <div
            ref={profileScrollRef}
            style={{
              width: '110px',
              minWidth: '110px',
              backgroundColor: '#000000',
              borderRight: '1px solid #222222',
              display: 'flex',
              flexDirection: 'column',
              overflowY: 'hidden',
              overflowX: 'hidden',
              flexShrink: 0,
              position: 'relative'
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {priceRungs.map((price) => {
                const profileItem = data?.compositeProfile?.find((cp) => Math.abs(cp.price - price) < tickSize / 2);
                const vol = profileItem?.volume || 0;
                const isPoc = Math.abs(price - (data?.compositePoc || 0)) < tickSize / 2;
                const isInVa = price <= vahPrice && price >= valPrice;
                const barWidthPct = (vol / maxCompVolume) * 100;

                return (
                  <div
                    key={price}
                    style={{
                      height: `${rungHeight}px`,
                      minHeight: `${rungHeight}px`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'flex-start',
                      padding: '0 4px',
                      position: 'relative',
                      borderBottom: '1px solid rgba(255, 255, 255, 0.02)',
                      boxSizing: 'border-box'
                    }}
                  >
                    {/* Horizontal Volume Bar (Warm Coral/Salmon) */}
                    <div
                      style={{
                        position: 'absolute',
                        left: 0,
                        top: '1px',
                        bottom: '1px',
                        width: `${Math.min(95, barWidthPct)}%`,
                        backgroundColor: isPoc ? '#6d4c41' : '#e57373',
                        opacity: isPoc ? 0.95 : 0.75,
                        zIndex: 1
                      }}
                    />

                    {/* Value Area Overlaid Green Vertical Band */}
                    {isInVa && (
                      <div
                        style={{
                          position: 'absolute',
                          left: '78px',
                          top: 0,
                          bottom: 0,
                          width: '6px',
                          backgroundColor: '#4caf50',
                          opacity: 0.9,
                          zIndex: 2
                        }}
                      />
                    )}

                    {/* Volume Number Text */}
                    {vol > 0 && (
                      <span
                        style={{
                          position: 'relative',
                          zIndex: 3,
                          fontSize: '9px',
                          fontWeight: 700,
                          fontFamily: 'monospace',
                          color: '#ffffff',
                          paddingLeft: '3px'
                        }}
                      >
                        {vol}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Center: Footprint Chart Grid Canvas */}
        <div
          ref={chartScrollRef}
          onScroll={handleChartScroll}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseLeave}
          style={{
            flex: 1,
            height: '100%',
            overflowX: 'auto',
            overflowY: 'auto',
            position: 'relative',
            backgroundColor: '#000000',
            cursor: isDragging ? 'grabbing' : crosshairEnabled ? 'crosshair' : 'default',
            scrollbarWidth: 'none',
            msOverflowStyle: 'none'
          }}
        >
          {/* Main Chart Content Area */}
          <div
            style={{
              position: 'relative',
              width: `${Math.max(1200, (displayCandles.length || 0) * candleWidth + 200)}px`,
              height: `${priceRungs.length * rungHeight}px`
            }}
          >
            {/* Background Horizontal Grid Lines */}
            <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
              {priceRungs.map((price, rIdx) => (
                <div
                  key={`grid-${price}-${rIdx}`}
                  style={{
                    position: 'absolute',
                    top: `${rIdx * rungHeight}px`,
                    left: 0,
                    right: 0,
                    height: '1px',
                    backgroundColor: '#161616'
                  }}
                />
              ))}
            </div>

            {/* Horizontal Naked POC (VPOC) Extension Bands across the chart */}
            {nakedPocExtensions.map((ext, idx) => {
              const rIdx = priceRungs.length > 0 ? Math.round((priceRungs[0] - ext.price) / tickSize) : -1;
              if (rIdx < 0 || rIdx >= priceRungs.length) return null;
              const topY = rIdx * rungHeight;
              const leftX = ext.startIdx * candleWidth;
              const widthX = (ext.endIdx - ext.startIdx + 1) * candleWidth;

              return (
                <div
                  key={`vpoc-${idx}`}
                  style={{
                    position: 'absolute',
                    top: `${topY}px`,
                    left: `${leftX}px`,
                    width: `${widthX}px`,
                    height: `${rungHeight}px`,
                    backgroundColor: ext.isMajor ? 'rgba(109, 76, 65, 0.45)' : 'rgba(51, 65, 85, 0.40)',
                    borderTop: ext.isMajor ? '1px solid rgba(141, 110, 99, 0.8)' : '1px solid rgba(100, 116, 139, 0.5)',
                    borderBottom: ext.isMajor ? '1px solid rgba(141, 110, 99, 0.8)' : '1px solid rgba(100, 116, 139, 0.5)',
                    zIndex: 2,
                    pointerEvents: 'none'
                  }}
                />
              );
            })}

            {/* Horizontal UFB (Unfinished Business / Unfinished Auction) Extension Rays */}
            {ufbExtensions.map((ext, idx) => {
              const rIdx = priceRungs.length > 0 ? Math.round((priceRungs[0] - ext.price) / tickSize) : -1;
              if (rIdx < 0 || rIdx >= priceRungs.length) return null;
              const topY = rIdx * rungHeight;
              const leftX = ext.startIdx * candleWidth;
              const widthX = Math.max(candleWidth, (ext.endIdx - ext.startIdx + 1) * candleWidth);

              return (
                <div
                  key={`ufb-ext-${idx}`}
                  style={{
                    position: 'absolute',
                    top: `${topY + Math.round(rungHeight / 2)}px`,
                    left: `${leftX}px`,
                    width: `${widthX}px`,
                    height: '0px',
                    borderTop: ext.isTested ? '1.5px dashed rgba(245, 158, 11, 0.45)' : '2px dashed #f59e0b',
                    zIndex: 6,
                    pointerEvents: 'none',
                    display: 'flex',
                    alignItems: 'center'
                  }}
                >
                  <span
                    style={{
                      position: 'absolute',
                      right: ext.isTested ? '-48px' : '-65px',
                      backgroundColor: ext.isTested ? 'rgba(180, 83, 9, 0.75)' : '#f59e0b',
                      color: '#000000',
                      fontWeight: 900,
                      fontSize: '8px',
                      padding: '1px 4px',
                      borderRadius: '2px',
                      boxShadow: '0 0 6px rgba(245, 158, 11, 0.8)',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {ext.isTested ? `UFB ${ext.type} (Tested)` : `⚡ UFB ${ext.type}`}
                  </span>
                </div>
              );
            })}

            {/* Footprint Candle Columns */}
            <div style={{ display: 'flex', position: 'relative', zIndex: 10 }}>
              {displayCandles.map((candle, cIdx) => {
                const isBull = candle.close >= candle.open;
                const sortedLevels = [...(candle.priceLevels || [])].sort((a, b) => b.price - a.price);

                const topLevel = sortedLevels.length > 0 ? sortedLevels[0] : null;
                const btmLevel = sortedLevels.length > 0 ? sortedLevels[sortedLevels.length - 1] : null;

                const topVol = topLevel ? topLevel.totalVol : 0;
                let topCR = '0.02';
                if (candle.cot?.top?.cotIndex !== undefined) {
                  topCR = (candle.cot.top.cotIndex >= 10 ? (candle.cot.top.cotIndex / 100) : candle.cot.top.cotIndex).toFixed(2);
                } else if (topLevel && topLevel.bidVol > 0) {
                  topCR = (topLevel.askVol / topLevel.bidVol).toFixed(2);
                } else if (topLevel && topLevel.totalVol > 0) {
                  topCR = (topLevel.askVol / topLevel.totalVol).toFixed(2);
                }

                const btmVol = btmLevel ? btmLevel.totalVol : 0;
                let btmCR = '98.90';
                if (candle.cot?.btm?.cotIndex !== undefined) {
                  btmCR = (candle.cot.btm.cotIndex >= 10 ? (candle.cot.btm.cotIndex / 100) : candle.cot.btm.cotIndex).toFixed(2);
                } else if (btmLevel && btmLevel.bidVol > 0) {
                  btmCR = (btmLevel.totalVol / btmLevel.bidVol).toFixed(2);
                } else if (btmLevel && btmLevel.totalVol > 0) {
                  btmCR = (btmLevel.askVol / btmLevel.totalVol).toFixed(2);
                }

                const topRungIdx = priceRungs.length > 0 ? Math.max(0, Math.round((priceRungs[0] - candle.high) / tickSize)) : -1;
                const btmRungIdx = priceRungs.length > 0 ? Math.min(priceRungs.length - 1, Math.round((priceRungs[0] - candle.low) / tickSize)) : -1;

                // Exact Candlestick Spine Coordinates (in-between the ladder)
                const padMax = priceRungs.length > 0 ? priceRungs[0] : 0;
                const candleHighY = padMax > 0 ? ((padMax - candle.high) / tickSize) * rungHeight : 0;
                const candleLowY = padMax > 0 ? ((padMax - candle.low) / tickSize) * rungHeight : 0;
                const openCloseMax = Math.max(candle.open, candle.close);
                const openCloseMin = Math.min(candle.open, candle.close);
                const bodyTopY = padMax > 0 ? ((padMax - openCloseMax) / tickSize) * rungHeight : 0;
                const bodyBtmY = padMax > 0 ? ((padMax - openCloseMin) / tickSize) * rungHeight : 0;
                const bodyHeight = Math.max(2, bodyBtmY - bodyTopY);
                const candleColor = isBull ? '#22c55e' : '#ef4444';
                const wickColor = isBull ? '#4ade80' : '#f87171';

                // Exact Ladder Y-bounds: ladder starts at topRungIdx * rungHeight and ends after sortedLevels
                const ladderTopY = topRungIdx >= 0 ? topRungIdx * rungHeight : 0;
                const ladderBtmY = ladderTopY + (sortedLevels.length * rungHeight);
                const trueTopY = Math.min(ladderTopY, candleHighY > 0 ? candleHighY : ladderTopY);
                const trueBtmY = Math.max(ladderBtmY, candleLowY > 0 ? candleLowY : ladderBtmY);

                // Top Box Y (strictly ABOVE the ladder and upper wick, with 4px clear margin)
                const topBoxTop = Math.max(2, trueTopY - 32);

                // Bottom Box Y (strictly BELOW the ladder and lower wick, with 4px clear margin)
                const btmBoxTop = trueBtmY + 4;

                const prevCandle = cIdx > 0 ? displayCandles[cIdx - 1] : undefined;
                const isNewDay = checkIfNewDay(candle, prevCandle);
                const candleDateStr = getCandleDateStr(candle);

                return (
                  <div
                    key={candle.timestamp || cIdx}
                    style={{
                      width: `${candleWidth}px`,
                      minWidth: `${candleWidth}px`,
                      position: 'relative',
                      display: 'flex',
                      flexDirection: 'column',
                      borderRight: '1px solid #1a1a1a',
                      borderLeft: isNewDay ? '2px dashed #0284c7' : 'none',
                      backgroundColor: isNewDay ? 'rgba(2, 132, 199, 0.03)' : 'transparent',
                      boxSizing: 'border-box'
                    }}
                  >
                    {/* New Day Session Boundary Header Tag */}
                    {isNewDay && (
                      <div
                        style={{
                          position: 'absolute',
                          top: `${Math.max(4, topBoxTop - 18)}px`,
                          left: '50%',
                          transform: 'translateX(-50%)',
                          backgroundColor: '#0284c7',
                          color: '#ffffff',
                          fontSize: '8.5px',
                          fontWeight: 900,
                          padding: '1px 6px',
                          borderRadius: '2px',
                          boxShadow: '0 2px 6px rgba(0,0,0,0.8)',
                          zIndex: 25,
                          whiteSpace: 'nowrap',
                          letterSpacing: '0.4px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '3px'
                        }}
                      >
                        <span>📅 {candleDateStr}</span>
                      </div>
                    )}

                    {/* In-Between The Ladder: Authentic Japanese Candlestick (Wicks & Solid Body) */}
                    {padMax > 0 && (
                      <>
                        {/* Upper Wick */}
                        {candleHighY < bodyTopY && (
                          <div
                            style={{
                              position: 'absolute',
                              top: `${candleHighY}px`,
                              left: 'calc(50% - 0.75px)',
                              width: '1.5px',
                              height: `${Math.max(1, bodyTopY - candleHighY)}px`,
                              backgroundColor: wickColor,
                              zIndex: 15,
                              pointerEvents: 'none'
                            }}
                          />
                        )}

                        {/* Solid Candlestick Body */}
                        <div
                          style={{
                            position: 'absolute',
                            top: `${bodyTopY}px`,
                            left: 'calc(50% - 3px)',
                            width: '6px',
                            height: `${bodyHeight}px`,
                            backgroundColor: candleColor,
                            border: `1px solid ${isBull ? '#15803d' : '#991b1b'}`,
                            borderRadius: '1px',
                            zIndex: 16,
                            pointerEvents: 'none',
                            boxShadow: '0 0 3px rgba(0,0,0,0.8)'
                          }}
                        />

                        {/* Lower Wick */}
                        {candleLowY > bodyBtmY && (
                          <div
                            style={{
                              position: 'absolute',
                              top: `${bodyBtmY}px`,
                              left: 'calc(50% - 0.75px)',
                              width: '1.5px',
                              height: `${Math.max(1, candleLowY - bodyBtmY)}px`,
                              backgroundColor: wickColor,
                              zIndex: 15,
                              pointerEvents: 'none'
                            }}
                          />
                        )}
                      </>
                    )}

                    {/* Top Stacked CR & Volume Boxes (Red / Salmon) - Positioned STRICTLY ABOVE the candle ladder */}
                    {topRungIdx >= 0 && (
                      <div
                        style={{
                          position: 'absolute',
                          top: `${topBoxTop}px`,
                          left: '10px',
                          right: '10px',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: '2px',
                          zIndex: 20
                        }}
                      >
                        <div
                          style={{
                            width: '100%',
                            backgroundColor: '#e57373',
                            color: '#000000',
                            fontSize: '9.5px',
                            fontWeight: 800,
                            padding: '1px 0',
                            textAlign: 'center',
                            borderRadius: '1px'
                          }}
                        >
                          CR {topCR}
                        </div>
                        <div
                          style={{
                            width: '100%',
                            backgroundColor: '#e57373',
                            color: '#000000',
                            fontSize: '9.5px',
                            fontWeight: 800,
                            padding: '1px 0',
                            textAlign: 'center',
                            borderRadius: '1px'
                          }}
                        >
                          {topVol}
                        </div>
                      </div>
                    )}

                    {/* Bottom Stacked Volume & CR Boxes (Green / Mint) - Positioned STRICTLY BELOW the candle ladder */}
                    {btmRungIdx >= 0 && (
                      <div
                        style={{
                          position: 'absolute',
                          top: `${btmBoxTop}px`,
                          left: '10px',
                          right: '10px',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: '2px',
                          zIndex: 20
                        }}
                      >
                        <div
                          style={{
                            width: '100%',
                            backgroundColor: '#81c784',
                            color: '#000000',
                            fontSize: '9.5px',
                            fontWeight: 800,
                            padding: '1px 0',
                            textAlign: 'center',
                            borderRadius: '1px'
                          }}
                        >
                          {btmVol}
                        </div>
                        <div
                          style={{
                            width: '100%',
                            backgroundColor: '#81c784',
                            color: '#000000',
                            fontSize: '9.5px',
                            fontWeight: 800,
                            padding: '1px 0',
                            textAlign: 'center',
                            borderRadius: '1px'
                          }}
                        >
                          CR {btmCR}
                        </div>

                        {/* UFB Badge Tag below bottom box when low has 0 Bid & >0 Ask */}
                        {(candle.hasUfbLow || (btmLevel && btmLevel.bidVol === 0 && btmLevel.askVol > 0)) && (
                          <div
                            style={{
                              width: '100%',
                              backgroundColor: '#f59e0b',
                              color: '#000000',
                              fontSize: '9px',
                              fontWeight: 900,
                              padding: '1px 0',
                              textAlign: 'center',
                              borderRadius: '2px',
                              boxShadow: '0 0 6px rgba(245, 158, 11, 0.8)',
                              letterSpacing: '0.5px'
                            }}
                          >
                            ⚡ UFB 0x{btmVol}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Top spacer to align price levels with exact price ladder offset */}
                    {topRungIdx > 0 && (
                      <div style={{ height: `${topRungIdx * rungHeight}px`, flexShrink: 0 }} />
                    )}

                    {/* Candle Rungs (Bid / Ask Columns) - Clean White Cells as per media_1790791651800.png */}
                    {sortedLevels.map((level) => {
                      const price = level.price;
                      const isPoc = Math.abs(price - (candle.pocPrice || 0)) < tickSize / 2;
                      const bidVol = level.bidVol || 0;
                      const askVol = level.askVol || 0;

                      // Diagonal Imbalance calculation
                      const nextLowerLevel = candle.priceLevels?.find(l => Math.abs(l.price - (price - tickSize)) < tickSize / 2);
                      const nextHigherLevel = candle.priceLevels?.find(l => Math.abs(l.price - (price + tickSize)) < tickSize / 2);

                      const isAskImbalance = (chartMode === 'Bid/Ask Imbalance') && nextLowerLevel && askVol >= nextLowerLevel.bidVol * imbalanceRatio && askVol > 0;
                      const isBidImbalance = (chartMode === 'Bid/Ask Imbalance') && nextHigherLevel && bidVol >= nextHigherLevel.askVol * imbalanceRatio && bidVol > 0;

                      // UFB Check: Left side 0 and right side number on candle low
                      const isCandleLowLevel = (Math.abs(price - candle.low) < tickSize / 2) || (level === btmLevel);
                      const isCandleHighLevel = (Math.abs(price - candle.high) < tickSize / 2) || (level === topLevel);
                      const isLevelUfbLow = isCandleLowLevel && bidVol === 0 && askVol > 0;
                      const isLevelUfbHigh = isCandleHighLevel && askVol === 0 && bidVol > 0;

                      return (
                        <div
                          key={price}
                          style={{
                            height: `${rungHeight}px`,
                            minHeight: `${rungHeight}px`,
                            display: 'flex',
                            alignItems: 'center',
                            position: 'relative',
                            backgroundColor: '#ffffff',
                            border: isPoc ? '2px solid #ff1744' : (isLevelUfbLow || isLevelUfbHigh ? '1.5px solid #f59e0b' : 'none'),
                            borderBottom: isPoc ? '2px solid #ff1744' : '1px solid #e2e8f0',
                            boxSizing: 'border-box',
                            margin: '0 4px',
                            flexShrink: 0
                          }}
                        >
                          {/* Prominent UFB Marker Tag at Candle Low */}
                          {isLevelUfbLow && (
                            <div
                              style={{
                                position: 'absolute',
                                left: '-36px',
                                top: '50%',
                                transform: 'translateY(-50%)',
                                backgroundColor: '#f59e0b',
                                color: '#000000',
                                fontSize: '8.5px',
                                fontWeight: 900,
                                padding: '1px 3px',
                                borderRadius: '2px',
                                boxShadow: '0 0 6px rgba(245, 158, 11, 0.9)',
                                zIndex: 30,
                                pointerEvents: 'none',
                                whiteSpace: 'nowrap'
                              }}
                            >
                              UFB
                            </div>
                          )}

                          {/* Prominent UFB Marker Tag at Candle High */}
                          {isLevelUfbHigh && (
                            <div
                              style={{
                                position: 'absolute',
                                right: '-36px',
                                top: '50%',
                                transform: 'translateY(-50%)',
                                backgroundColor: '#f59e0b',
                                color: '#000000',
                                fontSize: '8.5px',
                                fontWeight: 900,
                                padding: '1px 3px',
                                borderRadius: '2px',
                                boxShadow: '0 0 6px rgba(245, 158, 11, 0.9)',
                                zIndex: 30,
                                pointerEvents: 'none',
                                whiteSpace: 'nowrap'
                              }}
                            >
                              UFB
                            </div>
                          )}

                          {/* Bid Volume Cell (Left) */}
                          <div
                            style={{
                              flex: 1,
                              height: '100%',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'flex-end',
                              paddingRight: '6px',
                              backgroundColor: isBidImbalance ? '#c62828' : (isLevelUfbLow ? '#fef3c7' : '#ffffff'),
                              color: isBidImbalance ? '#ffffff' : (isLevelUfbLow ? '#b45309' : '#000000'),
                              fontSize: '10px',
                              fontWeight: 700,
                              fontFamily: 'monospace',
                              zIndex: 2
                            }}
                          >
                            {bidVol !== undefined ? bidVol : 0}
                          </div>

                          {/* Center Candlestick Channel (8px gap between Bid and Ask for candle) */}
                          <div style={{ width: '8px', minWidth: '8px', height: '100%', backgroundColor: '#ffffff', zIndex: 1 }} />

                          {/* Ask Volume Cell (Right) */}
                          <div
                            style={{
                              flex: 1,
                              height: '100%',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'flex-start',
                              paddingLeft: '6px',
                              backgroundColor: isAskImbalance ? '#2e7d32' : (isLevelUfbHigh ? '#fef3c7' : '#ffffff'),
                              color: isAskImbalance ? '#ffffff' : (isLevelUfbHigh ? '#b45309' : '#000000'),
                              fontSize: '10px',
                              fontWeight: 700,
                              fontFamily: 'monospace',
                              zIndex: 2
                            }}
                          >
                            {askVol !== undefined ? askVol : 0}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>

            {/* Interactive Crosshair Guideline */}
            {crosshair && crosshairEnabled && (
              <>
                <div
                  style={{
                    position: 'absolute',
                    top: `${crosshair.y + (chartScrollRef.current?.scrollTop || 0)}px`,
                    left: 0,
                    right: 0,
                    height: '1px',
                    borderTop: '1px dashed #00bcd4',
                    pointerEvents: 'none',
                    zIndex: 50
                  }}
                />
                <div
                  style={{
                    position: 'absolute',
                    left: `${crosshair.x + (chartScrollRef.current?.scrollLeft || 0)}px`,
                    top: 0,
                    bottom: 0,
                    width: '1px',
                    borderLeft: '1px dashed #00bcd4',
                    pointerEvents: 'none',
                    zIndex: 50
                  }}
                />
              </>
            )}
          </div>
        </div>

        {/* Right Side: Price Ladder & Real-Time LTP Tag with Two-Way Resize Handle */}
        <div
          ref={priceScrollRef}
          onMouseDown={handlePriceScaleDragStart}
          style={{
            width: '88px',
            minWidth: '88px',
            backgroundColor: '#000000',
            borderLeft: '1px solid #222222',
            display: 'flex',
            flexDirection: 'column',
            overflowY: 'hidden',
            flexShrink: 0,
            position: 'relative',
            cursor: 'ns-resize',
            userSelect: 'none'
          }}
          title="Price Scale (Y-axis): Drag vertically to scale price (↕). Double-click to auto-fit (F)."
        >
          {/* Two-Way Resize Handle on Price Scale Header */}
          <div
            style={{
              position: 'sticky',
              top: 0,
              zIndex: 30,
              backgroundColor: '#0a0a0a',
              borderBottom: '1px solid #262626',
              padding: '3px 4px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '2px'
            }}
          >
            <div
              onMouseDown={handlePriceScaleDragStart}
              onDoubleClick={(e) => { e.stopPropagation(); fitPriceScale(); }}
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '3px',
                backgroundColor: isDraggingPriceScale ? '#0284c7' : '#1e1e1e',
                color: isDraggingPriceScale ? '#ffffff' : '#00e5ff',
                border: `1px solid ${isDraggingPriceScale ? '#38bdf8' : '#333333'}`,
                borderRadius: '2px',
                padding: '2px 4px',
                fontSize: '9.5px',
                fontWeight: 800,
                cursor: 'ns-resize',
                userSelect: 'none',
                boxShadow: isDraggingPriceScale ? '0 0 8px rgba(0, 229, 255, 0.6)' : 'none'
              }}
              title="↕ Drag vertically to resize Price Scale (Double-click to Auto-fit)"
            >
              <MoveVertical size={13} strokeWidth={2.5} />
              <span>PRICE SCALE</span>
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); fitPriceScale(); }}
              style={{
                backgroundColor: '#1e1e1e',
                color: '#ffffff',
                border: '1px solid #333333',
                borderRadius: '2px',
                padding: '2px 5px',
                fontSize: '9px',
                fontWeight: 900,
                cursor: 'pointer'
              }}
              title="Auto-Fit Price Scale (F)"
            >
              F
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {priceRungs.map((price) => {
              const isLtp = Math.abs(price - lastPrice) < tickSize / 2;

              return (
                <div
                  key={price}
                  style={{
                    height: `${rungHeight}px`,
                    minHeight: `${rungHeight}px`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'flex-end',
                    paddingRight: '6px',
                    position: 'relative',
                    borderBottom: '1px solid rgba(255, 255, 255, 0.02)',
                    boxSizing: 'border-box'
                  }}
                >
                  {isLtp ? (
                    <div
                      style={{
                        backgroundColor: '#000000',
                        border: '1.5px solid #ffffff',
                        color: '#ffffff',
                        fontWeight: 900,
                        fontSize: '10px',
                        padding: '1px 5px',
                        borderRadius: '2px',
                        boxShadow: '0 0 8px rgba(255,255,255,0.4)',
                        zIndex: 10
                      }}
                    >
                      {price.toFixed(1)}
                    </div>
                  ) : (
                    <span
                      style={{
                        fontSize: '9.5px',
                        fontWeight: 600,
                        fontFamily: 'monospace',
                        color: '#71717a'
                      }}
                    >
                      {price.toFixed(1)}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 3. MINI CANDLESTICK ROW DIRECTLY ABOVE TABLE */}
      {showTable && (
        <div
          style={{
            height: '32px',
            minHeight: '32px',
            backgroundColor: '#000000',
            borderTop: '1px solid #222222',
            borderBottom: '1px solid #222222',
            display: 'flex',
            alignItems: 'center'
          }}
        >
          {/* Left spacing to align with profile */}
          {showProfile && (
            <div
              style={{
                width: '110px',
                minWidth: '110px',
                backgroundColor: '#000000',
                borderRight: '1px solid #222222',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '9px',
                fontWeight: 700,
                color: '#666666'
              }}
            >
              Candlestick
            </div>
          )}

          {/* Mini Candlesticks Scroller */}
          <div
            ref={miniCandlesScrollRef}
            style={{
              flex: 1,
              overflowX: 'hidden',
              display: 'flex',
              height: '100%',
              backgroundColor: '#000000',
              scrollbarWidth: 'none',
              msOverflowStyle: 'none'
            }}
          >
            <div
              style={{
                display: 'flex'
              }}
            >
              {displayCandles.map((c, idx) => {
                const isBull = c.close >= c.open;
                const candleRange = Math.max(1, c.high - c.low);
                const bodyRange = Math.max(1, Math.abs(c.close - c.open));
                const bodyHeight = Math.max(4, Math.min(22, (bodyRange / candleRange) * 24));
                const prevC = idx > 0 ? displayCandles[idx - 1] : undefined;
                const isNewDay = checkIfNewDay(c, prevC);

                return (
                  <div
                    key={`mini-${c.timestamp || idx}`}
                    style={{
                      width: `${candleWidth}px`,
                      minWidth: `${candleWidth}px`,
                      height: '32px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      position: 'relative',
                      borderLeft: isNewDay ? '2px solid #0284c7' : '1px solid rgba(255, 255, 255, 0.05)',
                      backgroundColor: isNewDay ? 'rgba(2, 132, 199, 0.08)' : 'transparent',
                      boxSizing: 'border-box'
                    }}
                  >
                    {/* Wick */}
                    <div
                      style={{
                        position: 'absolute',
                        top: '4px',
                        bottom: '4px',
                        width: '1px',
                        backgroundColor: isBull ? '#00e676' : '#ff5252'
                      }}
                    />
                    {/* Body */}
                    <div
                      style={{
                        width: '7px',
                        height: `${bodyHeight}px`,
                        backgroundColor: isBull ? '#00e676' : '#ff5252',
                        borderRadius: '1px',
                        zIndex: 2
                      }}
                    />
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right spacing for price ladder */}
          <div style={{ width: '84px', minWidth: '84px', backgroundColor: '#000000', borderLeft: '1px solid #222222' }} />
        </div>
      )}

      {/* 4. THE BELL ORDERFLOW TABLE (COMPACT 5 ROWS: Period, Delta, Max Delta, Min Delta, Cum Delta) */}
      {showTable && (
        <div
          style={{
            height: '78px',
            minHeight: '78px',
            backgroundColor: '#0a0a0a',
            borderBottom: '1px solid #222222',
            display: 'flex'
          }}
        >
          {/* Row Labels (Left Column) */}
          <div
            style={{
              width: showProfile ? '110px' : '90px',
              minWidth: showProfile ? '110px' : '90px',
              backgroundColor: '#0f0f0f',
              borderRight: '1px solid #222222',
              display: 'flex',
              flexDirection: 'column',
              fontSize: '9.5px',
              fontWeight: 800,
              color: '#aaaaaa',
              flexShrink: 0
            }}
          >
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', paddingLeft: '8px', borderBottom: '1px solid #1a1a1a' }}>Period</div>
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', paddingLeft: '8px', borderBottom: '1px solid #1a1a1a' }}>Delta</div>
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', paddingLeft: '8px', borderBottom: '1px solid #1a1a1a' }}>Max Delta</div>
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', paddingLeft: '8px', borderBottom: '1px solid #1a1a1a' }}>Min Delta</div>
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', paddingLeft: '8px' }}>Cum Delta</div>
          </div>

          {/* Data Columns (Scrollable and synchronized with chart) */}
          <div
            ref={tableScrollRef}
            style={{
              flex: 1,
              overflowX: 'hidden',
              display: 'flex',
              scrollbarWidth: 'none',
              msOverflowStyle: 'none'
            }}
          >
            {displayCandles.map((c, idx) => {
              const isBull = c.close >= c.open;
              const periodChar = c.period ? c.period.charAt(0).toUpperCase() : String.fromCharCode(65 + (idx % 26));
              const prevC = idx > 0 ? displayCandles[idx - 1] : undefined;
              const isNewDay = checkIfNewDay(c, prevC);

              return (
                <div
                  key={`tbl-${c.timestamp || idx}`}
                  style={{
                    width: `${candleWidth}px`,
                    minWidth: `${candleWidth}px`,
                    display: 'flex',
                    flexDirection: 'column',
                    borderRight: '1px solid #1e1e1e',
                    borderLeft: isNewDay ? '2px solid #0284c7' : 'none',
                    textAlign: 'center',
                    fontSize: '9.5px',
                    fontWeight: 700,
                    boxSizing: 'border-box'
                  }}
                >
                  {/* Row 1: Period Header (Soft Mint for Bull, Soft Coral for Bear) */}
                  <div
                    style={{
                      flex: 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: isBull ? '#81c784' : '#e57373',
                      color: '#000000',
                      fontWeight: 900,
                      borderBottom: '1px solid #222222'
                    }}
                  >
                    {periodChar}
                  </div>

                  {/* Row 2: Bar Delta */}
                  <div
                    style={{
                      flex: 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: c.delta >= 0 ? '#a5d6a7' : '#ef9a9a',
                      color: '#000000',
                      borderBottom: '1px solid #222222'
                    }}
                  >
                    {c.delta}
                  </div>

                  {/* Row 3: Max Delta */}
                  <div
                    style={{
                      flex: 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: '#a5d6a7',
                      color: '#000000',
                      borderBottom: '1px solid #222222'
                    }}
                  >
                    {c.maxDelta}
                  </div>

                  {/* Row 4: Min Delta */}
                  <div
                    style={{
                      flex: 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: c.minDelta < 0 ? '#ef9a9a' : '#a5d6a7',
                      color: '#000000',
                      borderBottom: '1px solid #222222'
                    }}
                  >
                    {c.minDelta}
                  </div>

                  {/* Row 5: Cumulative Delta (CVD) */}
                  <div
                    style={{
                      flex: 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: c.cvd >= 0 ? '#a5d6a7' : '#ef9a9a',
                      color: '#000000'
                    }}
                  >
                    {c.cvd}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Right filler for price ladder alignment */}
          <div style={{ width: '84px', minWidth: '84px', backgroundColor: '#0f0f0f', borderLeft: '1px solid #222222' }} />
        </div>
      )}

      {/* 5. BOTTOM STATUS BAR & TIME AXIS FOOTER */}
      <div
        style={{
          height: '34px',
          minHeight: '34px',
          backgroundColor: '#181818',
          borderTop: '1px solid #282828',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: '10px',
          color: '#888888',
          padding: '0 6px',
          zIndex: 40
        }}
      >
        {/* Left: Tab selectors & Copyright */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {/* Active Symbol Tab */}
          <div
            style={{
              backgroundColor: '#0284c7',
              color: '#ffffff',
              padding: '2px 8px',
              borderRadius: '2px',
              fontSize: '10px',
              fontWeight: 800
            }}
          >
            ${symbol.replace('FUT', '')}
          </div>

          <div
            style={{
              backgroundColor: '#262626',
              color: '#888888',
              padding: '2px 8px',
              borderRadius: '2px',
              fontSize: '10px',
              fontWeight: 600
            }}
          >
            NIFTY_I
          </div>

          <div style={{ color: '#666666', cursor: 'pointer', padding: '0 4px', fontWeight: 900 }}>
            +
          </div>

          {/* Two-Way Resize Handle for Time Scale (X-axis) */}
          <div
            onMouseDown={handleTimeScaleDragStart}
            onDoubleClick={(e) => { e.stopPropagation(); setCandleWidth(85); }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '2px 8px',
              backgroundColor: isDraggingTimeScale ? '#0284c7' : '#1e1e1e',
              border: `1px solid ${isDraggingTimeScale ? '#38bdf8' : '#333333'}`,
              borderRadius: '2px',
              color: isDraggingTimeScale ? '#ffffff' : '#00e5ff',
              fontSize: '9.5px',
              fontWeight: 800,
              cursor: 'ew-resize',
              userSelect: 'none',
              boxShadow: isDraggingTimeScale ? '0 0 8px rgba(0, 229, 255, 0.6)' : 'none',
              marginLeft: '8px',
              flexShrink: 0
            }}
            title="↔ Drag horizontally to resize Time Scale / Candle Width (Double-click to reset)"
          >
            <MoveHorizontal size={13} strokeWidth={2.5} />
            <span>TIME SCALE</span>
          </div>
        </div>

        {/* Center: Scrollable Time Ticks with Interactive Horizontal Scaling & New Day Dates */}
        <div
          ref={timeBarScrollRef}
          onMouseDown={handleTimeScaleDragStart}
          style={{
            flex: 1,
            overflowX: 'hidden',
            display: 'flex',
            margin: '0 12px',
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
            cursor: 'ew-resize',
            userSelect: 'none'
          }}
          title="Time Scale (X-axis): Drag left/right to scale candle width. Double-click to reset."
        >
          <div
            style={{
              display: 'flex'
            }}
          >
            {displayCandles.map((c, idx) => {
              const prevC = idx > 0 ? displayCandles[idx - 1] : undefined;
              const isNewDay = checkIfNewDay(c, prevC);
              const dateStr = getCandleDateStr(c);
              const timeOnly = c.timeStr || '';

              return (
                <div
                  key={`time-${c.timestamp || idx}`}
                  style={{
                    width: `${candleWidth}px`,
                    minWidth: `${candleWidth}px`,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderLeft: isNewDay ? '2px solid #0284c7' : '1px solid rgba(255, 255, 255, 0.05)',
                    backgroundColor: isNewDay ? 'rgba(2, 132, 199, 0.20)' : 'transparent',
                    boxSizing: 'border-box',
                    padding: '1px 0',
                    flexShrink: 0
                  }}
                >
                  {isNewDay ? (
                    <>
                      <div
                        style={{
                          backgroundColor: '#0284c7',
                          color: '#ffffff',
                          fontSize: '8.5px',
                          fontWeight: 900,
                          padding: '1px 5px',
                          borderRadius: '2px',
                          lineHeight: 1.1,
                          boxShadow: '0 0 6px rgba(2, 132, 199, 0.6)',
                          whiteSpace: 'nowrap',
                          letterSpacing: '0.3px'
                        }}
                      >
                        📅 {dateStr}
                      </div>
                      <span style={{ fontSize: '8px', color: '#38bdf8', fontWeight: 800, marginTop: '1px', fontFamily: 'monospace' }}>
                        {timeOnly}
                      </span>
                    </>
                  ) : (
                    <span
                      style={{
                        fontSize: '9.5px',
                        color: '#94a3b8',
                        fontFamily: 'monospace',
                        fontWeight: 600
                      }}
                    >
                      {timeOnly}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', backgroundColor: data?.connected ? '#22c55e' : '#ef4444' }} />
          <span style={{ fontSize: '9.5px', color: '#aaaaaa' }}>
            {data?.connected ? 'Real-Time Tick Feed Active' : 'Connecting...'}
          </span>
        </div>
      </div>
    </div>
  );
};

export default TestContainer;