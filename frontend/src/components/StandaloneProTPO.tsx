import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Camera, ZoomIn, ZoomOut, RefreshCw, Maximize2, Minimize2, 
  Pin, PinOff, X, Layers, Sliders, ChevronLeft, ChevronRight 
} from 'lucide-react';

// ==========================================
// 1. DATA TYPES & INTERFACES
// ==========================================

export interface Candle {
  time: number; // Unix timestamp in seconds
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface TPOBin {
  price: number;
  tpos: string[];
  volume: number;
}

export interface DayProfile {
  dateStr: string;
  symbol?: string;
  openPrice: number;
  closePrice: number;
  startTime?: number;
  dayHigh: number;
  dayLow: number;
  tickSize: number;
  bins: TPOBin[];
  pocPrice: number;
  vahPrice: number;
  valPrice: number;
  ibHigh: number;
  ibLow: number;
  totalTPOs: number;
  totalVolume: number;
}

export interface SinglePrintZone {
  id: string;
  sIdx: number;
  dateStr: string;
  highPrice: number;
  lowPrice: number;
  type: 'buying' | 'selling';
  isCleared: boolean;
  clearedDateStr?: string;
  letters: string[];
}

export interface StandaloneProTPOProps {
  initialSymbol?: string;
  candles?: Candle[];
  onSymbolSelect?: (symbol: string) => void;
  className?: string;
  style?: React.CSSProperties;
}

// ==========================================
// 2. HELPER UTILITIES & CALCULATIONS
// ==========================================

export const PERIOD_COLORS: string[] = [
  '#10b981', // A: Emerald Green
  '#14b8a6', // B: Teal
  '#0ea5e9', // C: Sky Blue
  '#3b82f6', // D: Royal Blue
  '#6366f1', // E: Indigo
  '#8b5cf6', // F: Purple
  '#a855f7', // G: Violet
  '#d946ef', // H: Fuchsia
  '#ec4899', // I: Vibrant Pink
  '#f43f5e', // J: Rose
  '#f59e0b', // K: Amber
  '#f97316', // L: Orange
  '#06b6d4', // M: Cyan
  '#84cc16', // N: Lime
  '#eab308', // O: Yellow
  '#e11d48'  // P: Crimson
];

export function getPeriodLetter(periodIndex: number): string {
  if (periodIndex < 26) return String.fromCharCode(65 + periodIndex);
  if (periodIndex < 52) return String.fromCharCode(97 + (periodIndex - 26));
  return String.fromCharCode(65 + (periodIndex % 26)) + Math.floor(periodIndex / 26);
}

export function getLetterColor(letter: string): string {
  const code = letter.toUpperCase().charCodeAt(0);
  if (code >= 65 && code <= 66) return '#c084fc'; // A-B Initial Balance Purple
  if (code >= 67 && code <= 70) return '#38bdf8'; // C-F Morning Cyan/Blue
  if (code >= 71 && code <= 74) return '#22c55e'; // G-J Midday Green
  if (code >= 75 && code <= 78) return '#ffffff'; // K-N Afternoon White
  if (code >= 79 && code <= 82) return '#f97316'; // O-R Pre-Close Orange
  return '#ef4444'; // S-Z Red
}

function getRoundedTickSize(rawTick: number, avgPrice: number): number {
  if (avgPrice > 20000) {
    if (rawTick <= 2) return 2;
    if (rawTick <= 5) return 5;
    if (rawTick <= 10) return 10;
    if (rawTick <= 25) return 25;
    return 50;
  }
  if (rawTick <= 0.25) return 0.25;
  if (rawTick <= 0.5) return 0.5;
  if (rawTick <= 1) return 1;
  if (rawTick <= 2) return 2;
  if (rawTick <= 5) return 5;
  return 10;
}

export function groupCandlesBySessionPeriod(
  candles: Candle[],
  period: 'D' | 'W' | 'M_S' | 'Y'
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

  if (period === 'W') {
    for (const c of candles) {
      const d = new Date(c.time * 1000);
      const dayOfWeek = d.getDay();
      const diffToMon = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
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

export function calculateDayProfile(
  dateStr: string,
  dayCandles: Candle[],
  binCount: number = 40,
  sessionPeriod: 'daily' | 'weekly' | 'monthly' | 'yearly' = 'daily',
  parentTickSize?: number,
  symbol?: string
): DayProfile {
  const sorted = [...dayCandles].sort((a, b) => a.time - b.time);

  let dayHigh = -Infinity;
  let dayLow = Infinity;
  let totalVolume = 0;

  for (const c of sorted) {
    if (c.high > dayHigh) dayHigh = c.high;
    if (c.low < dayLow) dayLow = c.low;
    totalVolume += c.volume || 1000;
  }

  if (dayHigh === -Infinity || dayLow === Infinity || dayHigh === dayLow) {
    return {
      dateStr,
      openPrice: 0,
      closePrice: 0,
      dayHigh: 0,
      dayLow: 0,
      tickSize: 1,
      bins: [],
      pocPrice: 0,
      vahPrice: 0,
      valPrice: 0,
      ibHigh: 0,
      ibLow: 0,
      totalTPOs: 0,
      totalVolume: 0
    };
  }

  let tickSize = parentTickSize !== undefined ? parentTickSize : 0;
  if (!tickSize) {
    const range = dayHigh - dayLow;
    const rawTick = range / binCount;
    const avgPrice = (dayHigh + dayLow) / 2;
    tickSize = getRoundedTickSize(rawTick, avgPrice);
  }

  const binsMap: Record<number, TPOBin> = {};
  const prices: number[] = [];

  const startPrice = Math.floor(dayLow / tickSize) * tickSize;
  const endPrice = Math.ceil(dayHigh / tickSize) * tickSize;

  for (let p = startPrice; p <= endPrice + tickSize / 2; p += tickSize) {
    const roundedPrice = Math.round(p * 100) / 100;
    binsMap[roundedPrice] = {
      price: roundedPrice,
      tpos: [],
      volume: 0
    };
    prices.push(roundedPrice);
  }

  const periodRanges: Record<number, { high: number; low: number }> = {};

  for (let idx = 0; idx < sorted.length; idx++) {
    const c = sorted[idx];
    let periodIndex = 0;

    if (sessionPeriod === 'yearly') {
      const d = new Date(c.time * 1000);
      periodIndex = d.getMonth(); // 0-11
    } else if (sessionPeriod === 'monthly' || sessionPeriod === 'weekly') {
      periodIndex = Math.min(25, Math.floor(idx / Math.max(1, Math.floor(sorted.length / 12))));
    } else {
      // 30-min intraday blocks
      const istSeconds = c.time + 19800; // +5:30 IST
      const istDate = new Date(istSeconds * 1000);
      const hour = istDate.getUTCHours();
      const min = istDate.getUTCMinutes();
      const minsFromOpen = (hour * 60 + min) - (9 * 60 + 15);
      periodIndex = Math.max(0, Math.floor(minsFromOpen / 30));
    }

    if (!periodRanges[periodIndex]) {
      periodRanges[periodIndex] = { high: -Infinity, low: Infinity };
    }
    if (c.high > periodRanges[periodIndex].high) periodRanges[periodIndex].high = c.high;
    if (c.low < periodRanges[periodIndex].low) periodRanges[periodIndex].low = c.low;

    const candleSpanBins = prices.filter(p => p >= c.low - tickSize / 2 && p <= c.high + tickSize / 2);
    const binsToFill = candleSpanBins.length > 0 ? candleSpanBins : [prices[0]];
    const volPerBin = (c.volume || 1000) / binsToFill.length;
    for (const p of binsToFill) {
      binsMap[p].volume += volPerBin;
    }
  }

  Object.entries(periodRanges).forEach(([pIdxStr, r]) => {
    const pIdx = parseInt(pIdxStr, 10);
    const letter = getPeriodLetter(pIdx);
    prices.forEach(p => {
      if (r.high >= p - tickSize / 2 && r.low <= p + tickSize / 2) {
        binsMap[p].tpos.push(letter);
      }
    });
  });

  const bins = prices.map(p => binsMap[p]).reverse();

  let totalTPOs = 0;
  bins.forEach(b => { totalTPOs += b.tpos.length; });

  let maxTPOs = 0;
  let pocIdx = bins.length - 1;
  for (let i = bins.length - 1; i >= 0; i--) {
    if (bins[i].tpos.length > maxTPOs) {
      maxTPOs = bins[i].tpos.length;
      pocIdx = i;
    }
  }

  let pocPrice = bins[pocIdx]?.price || dayLow;
  let vahPrice = pocPrice;
  let valPrice = pocPrice;

  // Steidlmayer 70% Value Area algorithm
  if (totalTPOs > 0 && maxTPOs > 0) {
    const targetTPOs = Math.round(totalTPOs * 0.70);
    let currentTPOs = maxTPOs;
    const isIncluded = new Array(bins.length).fill(false);
    isIncluded[pocIdx] = true;

    let L = 1;
    let N = 1;
    const len = bins.length;

    while (currentTPOs < targetTPOs) {
      const aboveIdx = pocIdx - N;
      const belowIdx = pocIdx + L;
      const H = aboveIdx >= 0 ? bins[aboveIdx].tpos.length : 0;
      const V = belowIdx < len ? bins[belowIdx].tpos.length : 0;

      if (V <= H && aboveIdx >= 0) {
        currentTPOs += H;
        isIncluded[aboveIdx] = true;
        N++;
      } else if (belowIdx < len) {
        currentTPOs += V;
        isIncluded[belowIdx] = true;
        L++;
      } else {
        break;
      }
      if (L > len && N > len) break;
    }

    let firstIdx = -1;
    let lastIdx = -1;
    for (let i = 0; i < len; i++) {
      if (isIncluded[i]) {
        if (firstIdx === -1) firstIdx = i;
        lastIdx = i;
      }
    }
    if (firstIdx !== -1) {
      vahPrice = bins[firstIdx].price;
      valPrice = bins[lastIdx].price;
    }
  }

  // Initial Balance: First 60 minutes (Periods A and B)
  let ibHigh = dayHigh;
  let ibLow = dayLow;
  if (periodRanges[0]) {
    ibHigh = periodRanges[0].high;
    ibLow = periodRanges[0].low;
    if (periodRanges[1]) {
      ibHigh = Math.max(ibHigh, periodRanges[1].high);
      ibLow = Math.min(ibLow, periodRanges[1].low);
    }
  }

  return {
    dateStr,
    symbol,
    openPrice: sorted[0].open,
    closePrice: sorted[sorted.length - 1].close,
    startTime: sorted[0].time,
    dayHigh,
    dayLow,
    tickSize,
    bins,
    pocPrice,
    vahPrice,
    valPrice,
    ibHigh,
    ibLow,
    totalTPOs,
    totalVolume
  };
}

export function calculateSinglePrintZones(dayProfiles: DayProfile[], liveLtp?: number): SinglePrintZone[] {
  const zones: SinglePrintZone[] = [];
  dayProfiles.forEach((profile: DayProfile, sIdx: number) => {
    if (!profile.bins || profile.bins.length === 0) return;
    const step = profile.tickSize || 5;
    const sortedBins = [...profile.bins].sort((a, b) => a.price - b.price);

    let currentRun: typeof sortedBins = [];
    const processRun = (run: typeof sortedBins) => {
      if (run.length === 0) return;
      const minPrice = run[0].price;
      const maxPrice = run[run.length - 1].price;
      if (run.length === 1 && (minPrice === profile.dayLow || maxPrice === profile.dayHigh)) return;

      const lowPrice = minPrice - step / 2;
      const highPrice = maxPrice + step / 2;
      const letters = Array.from(new Set(run.flatMap((b: TPOBin) => b.tpos)));
      const isBuying = profile.closePrice >= highPrice;

      let isCleared = false;
      let clearedDateStr: string | undefined;

      for (let fIdx = sIdx + 1; fIdx < dayProfiles.length; fIdx++) {
        const fut = dayProfiles[fIdx];
        if (fut.dayLow <= lowPrice && fut.dayHigh >= highPrice) {
          isCleared = true;
          clearedDateStr = fut.dateStr;
          break;
        }
      }

      zones.push({
        id: `sp-${profile.dateStr}-${minPrice}`,
        sIdx,
        dateStr: profile.dateStr,
        highPrice,
        lowPrice,
        type: isBuying ? 'buying' : 'selling',
        isCleared,
        clearedDateStr,
        letters
      });
    };

    sortedBins.forEach((bin: TPOBin) => {
      if (bin.tpos.length === 1 && bin.price !== profile.dayHigh && bin.price !== profile.dayLow) {
        currentRun.push(bin);
      } else {
        processRun(currentRun);
        currentRun = [];
      }
    });
    processRun(currentRun);
  });
  return zones;
}

// Generate Realistic Multi-Session Candles for Drop-in Demo
export function generateMockCandles(symbol: string = 'NSE:NIFTY'): Candle[] {
  const candles: Candle[] = [];
  const basePrice = symbol.includes('BANKNIFTY') ? 51200 : (symbol.includes('CRUDE') ? 6100 : 24200);
  const now = Math.floor(Date.now() / 1000);
  const days = 10;
  const periodsPerDay = 13; // 09:15 to 15:30 (13 x 30m periods)

  let currentPrice = basePrice;
  for (let d = days; d >= 0; d--) {
    const dayStart = now - d * 86400;
    // Set 09:15 AM
    const dateObj = new Date(dayStart * 1000);
    dateObj.setHours(9, 15, 0, 0);
    let sessionTime = Math.floor(dateObj.getTime() / 1000);

    const dayTrend = (Math.random() - 0.48) * (basePrice * 0.012);
    for (let p = 0; p < periodsPerDay; p++) {
      const open = currentPrice;
      const change = (Math.random() - 0.49) * (basePrice * 0.003) + (dayTrend / periodsPerDay);
      const close = open + change;
      const high = Math.max(open, close) + Math.random() * (basePrice * 0.002);
      const low = Math.min(open, close) - Math.random() * (basePrice * 0.002);
      const volume = Math.floor(20000 + Math.random() * 80000);

      candles.push({
        time: sessionTime + p * 1800,
        open,
        high,
        low,
        close,
        volume
      });
      currentPrice = close;
    }
  }
  return candles;
}

// ==========================================
// 3. MAIN REACT COMPONENT
// ==========================================

export const StandaloneProTPO: React.FC<StandaloneProTPOProps> = ({
  initialSymbol = 'NSE:NIFTY',
  candles: externalCandles,
  onSymbolSelect,
  className = '',
  style = {}
}: StandaloneProTPOProps) => {
  const [symbol, setSymbol] = useState<string>(initialSymbol);
  const [sessionPeriod, setSessionPeriod] = useState<'D' | 'W' | 'M_S' | 'Y'>('D');
  const [viewMode, setViewMode] = useState<'T-V' | 'T' | 'V' | 'GV'>('T-V');
  const [zoomLevel, setZoomLevel] = useState<number>(1.0);
  const [yScale, setYScale] = useState<number>(1.0);
  const [xScale, setXScale] = useState<number>(1.0);
  const [panOffset, setPanOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const [highlightSinglePrints, setHighlightSinglePrints] = useState<boolean>(true);
  const [showIbLine, setShowIbLine] = useState<boolean>(true);
  const [screenshotStatus, setScreenshotStatus] = useState<string>('');

  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Mouse / Dragging state
  const [dragMode, setDragMode] = useState<'none' | 'pan' | 'y-axis' | 'x-axis'>('none');
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [initialYScale, setInitialYScale] = useState<number>(1.0);
  const [initialXScale, setInitialXScale] = useState<number>(1.0);
  const [crosshairPos, setCrosshairPos] = useState<{ x: number; y: number } | null>(null);

  // Candles (prop or generated mock)
  const rawCandles = useMemo(() => {
    if (externalCandles && externalCandles.length > 0) return externalCandles;
    return generateMockCandles(symbol);
  }, [externalCandles, symbol]);

  // Grouped Profiles
  const { keys, grouped, sessionPeriodType } = useMemo(() => {
    return groupCandlesBySessionPeriod(rawCandles, sessionPeriod);
  }, [rawCandles, sessionPeriod]);

  const dayProfiles = useMemo(() => {
    return keys.map((k: string) => calculateDayProfile(k, grouped[k], 40, sessionPeriodType, undefined, symbol));
  }, [keys, grouped, sessionPeriodType, symbol]);

  const liveLtp = useMemo(() => {
    if (rawCandles.length === 0) return undefined;
    return rawCandles[rawCandles.length - 1].close;
  }, [rawCandles]);

  const singlePrintZones = useMemo(() => {
    return calculateSinglePrintZones(dayProfiles, liveLtp);
  }, [dayProfiles, liveLtp]);

  // Canvas Dimensions
  const [dimensions, setDimensions] = useState<{ width: number; height: number }>({ width: 1200, height: 750 });

  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current) {
        const { clientWidth, clientHeight } = containerRef.current;
        setDimensions({
          width: Math.max(600, clientWidth),
          height: Math.max(450, clientHeight - 90)
        });
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Canvas Render Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const { width, height } = dimensions;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.scale(dpr, dpr);

    // Dark Background
    ctx.fillStyle = '#0d1117';
    ctx.fillRect(0, 0, width, height);

    if (dayProfiles.length === 0) {
      ctx.fillStyle = '#64748b';
      ctx.font = '14px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('No profile data available for this timeframe.', width / 2, height / 2);
      return;
    }

    const padding = { top: 35, right: 75, bottom: 35, left: 20 };
    const chartW = width - padding.left - padding.right;
    const chartH = height - padding.top - padding.bottom;

    const baseColW = Math.max(160, Math.min(240, chartW / 5));
    const colWidth = baseColW * zoomLevel * xScale;
    const colGap = Math.max(8, 12 * zoomLevel * xScale);

    // Global Min / Max from visible sessions
    let globalMin = Infinity;
    let globalMax = -Infinity;
    dayProfiles.forEach((p: DayProfile) => {
      if (p.dayLow < globalMin) globalMin = p.dayLow;
      if (p.dayHigh > globalMax) globalMax = p.dayHigh;
    });

    if (globalMin === Infinity || globalMax === -Infinity || globalMin >= globalMax) return;

    const margin = (globalMax - globalMin) * 0.08;
    const rawMin = globalMin - margin;
    const rawMax = globalMax + margin;
    const rawRange = rawMax - rawMin;

    const centerPrice = (rawMax + rawMin) / 2 - (panOffset.y / chartH) * rawRange;
    const visibleRange = rawRange / (zoomLevel * yScale);
    const minPrice = centerPrice - visibleRange / 2;
    const maxPrice = centerPrice + visibleRange / 2;
    const priceRange = maxPrice - minPrice;

    const getPriceY = (p: number) => padding.top + ((maxPrice - p) / priceRange) * chartH;

    // Price Grid & Axis
    const ticksCount = 10;
    const rawStep = priceRange / ticksCount;
    const niceSteps = [1, 2, 5, 10, 20, 25, 50, 100, 200, 500];
    const step = niceSteps.find(s => s >= rawStep) || Math.ceil(rawStep / 50) * 50;

    const startTick = Math.floor(minPrice / step) * step;
    const endTick = Math.ceil(maxPrice / step) * step;

    ctx.font = '10px "JetBrains Mono", monospace';
    ctx.textAlign = 'left';

    for (let p = startTick; p <= endTick; p += step) {
      const y = getPriceY(p);
      if (y >= padding.top && y <= height - padding.bottom) {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
        ctx.lineWidth = 1;
        ctx.setLineDash([2, 4]);
        ctx.beginPath();
        ctx.moveTo(padding.left, y);
        ctx.lineTo(width - padding.right, y);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.fillStyle = '#94a3b8';
        ctx.fillText(p.toFixed(1), width - padding.right + 8, y + 3.5);
      }
    }

    // Clip Profile Drawing Area
    ctx.save();
    ctx.beginPath();
    ctx.rect(padding.left, padding.top, chartW, chartH);
    ctx.clip();

    dayProfiles.forEach((profile: DayProfile, sIdx: number) => {
      const colStartX = padding.left + panOffset.x + sIdx * (colWidth + colGap);
      const colEndX = colStartX + colWidth;
      if (colEndX < padding.left || colStartX > width - padding.right) return;

      // Date Header / Footer
      ctx.fillStyle = '#94a3b8';
      ctx.font = '10px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(profile.dateStr, colStartX + colWidth / 2, height - padding.bottom + 16);

      const bins = profile.bins;
      if (bins.length === 0) return;

      const binStep = bins.length > 1 ? Math.abs(bins[0].price - bins[1].price) : profile.tickSize;
      const rowHeight = Math.max(3, (binStep / priceRange) * chartH);
      const blockSize = Math.max(2, Math.min(18, rowHeight - 0.5));
      const showLetters = blockSize >= 7 && viewMode !== 'V';
      const maxVol = Math.max(...bins.map((b: TPOBin) => b.volume), 1);
      const tpoW = viewMode === 'T' ? colWidth : Math.max(28, colWidth * 0.44);
      const volW = colWidth - tpoW;
      const isUp = profile.closePrice >= profile.openPrice;

      bins.forEach((bin: TPOBin) => {
        const binY = getPriceY(bin.price) - rowHeight / 2;
        if (binY < padding.top - rowHeight || binY > height - padding.bottom) return;

        const isPoc = bin.price === profile.pocPrice;
        const inVA = bin.price >= profile.valPrice && bin.price <= profile.vahPrice;

        if (viewMode === 'V') {
          const barW = (bin.volume / maxVol) * (colWidth - 6);
          ctx.fillStyle = inVA ? (isUp ? '#ef4444' : '#2563eb') : '#475569';
          ctx.fillRect(colStartX, binY + 0.5, Math.max(2, barW), Math.max(1, rowHeight - 1));
        } else {
          // TPO Letters
          if (bin.tpos.length > 0) {
            bin.tpos.forEach((letter: string, colIdx: number) => {
              const x = colStartX + colIdx * (blockSize + 1);
              if (x + blockSize <= colStartX + tpoW) {
                if (highlightSinglePrints && bin.tpos.length === 1 && bin.price !== profile.dayHigh && bin.price !== profile.dayLow && colIdx === 0) {
                  ctx.fillStyle = 'rgba(245, 158, 11, 0.35)';
                  ctx.fillRect(x - 1, binY - 1, blockSize + 2, blockSize + 2);
                }

                ctx.fillStyle = getLetterColor(letter);
                if (showLetters) {
                  ctx.font = `bold ${Math.max(7, Math.floor(blockSize * 0.75))}px "JetBrains Mono", monospace`;
                  ctx.textAlign = 'center';
                  ctx.fillText(letter, x + blockSize / 2, binY + rowHeight / 2 + (blockSize * 0.28));
                } else {
                  ctx.fillRect(x, binY + (rowHeight - blockSize) / 2, blockSize, blockSize);
                }
              }
            });

            // POC Letter outline
            if (isPoc) {
              const pocLetters = Math.min(bin.tpos.length, Math.floor((tpoW - 4) / (blockSize + 1)));
              const boxW = Math.max(blockSize + 2, pocLetters * (blockSize + 1));
              ctx.strokeStyle = '#ef4444';
              ctx.lineWidth = 1;
              ctx.strokeRect(colStartX - 1, binY - 1, boxW + 2, blockSize + 2);
            }
          }

          // Volume Profile Histogram on right of letters
          if (viewMode !== 'T') {
            const barStartX = colStartX + tpoW;
            const barW = (bin.volume / maxVol) * (volW - 6);
            ctx.fillStyle = inVA ? (isUp ? '#ef4444' : '#2563eb') : '#475569';
            ctx.fillRect(barStartX, binY + 0.5, Math.max(2, barW), Math.max(1, rowHeight - 1));
          }
        }
      });

      // IB Bracket
      if (showIbLine && profile.ibHigh && profile.ibLow) {
        const topY = getPriceY(profile.ibHigh);
        const botY = getPriceY(profile.ibLow);
        const ibX = colStartX - 4;
        ctx.strokeStyle = '#c084fc';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(ibX, topY);
        ctx.lineTo(ibX, botY);
        ctx.moveTo(ibX - 3, topY);
        ctx.lineTo(ibX + 3, topY);
        ctx.moveTo(ibX - 3, botY);
        ctx.lineTo(ibX + 3, botY);
        ctx.stroke();
      }

      // VAH / VAL Lines (White)
      if (profile.vahPrice) {
        const y = getPriceY(profile.vahPrice);
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(colStartX, y);
        ctx.lineTo(colStartX + colWidth, y);
        ctx.stroke();
      }
      if (profile.valPrice) {
        const y = getPriceY(profile.valPrice);
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(colStartX, y);
        ctx.lineTo(colStartX + colWidth, y);
        ctx.stroke();
      }

      // POC (Yellow) with Tested Level Stopping Logic
      if (profile.pocPrice) {
        const pocY = getPriceY(profile.pocPrice);
        ctx.strokeStyle = '#facc15';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(colStartX, pocY);
        ctx.lineTo(colStartX + colWidth, pocY);
        ctx.stroke();

        let testedIdx: number | null = null;
        for (let fIdx = sIdx + 1; fIdx < dayProfiles.length; fIdx++) {
          const fut = dayProfiles[fIdx];
          if (profile.pocPrice >= fut.dayLow && profile.pocPrice <= fut.dayHigh) {
            testedIdx = fIdx;
            break;
          }
        }

        if (testedIdx !== null) {
          // Tested POC: Stops at first touch session
          const futX = padding.left + panOffset.x + testedIdx * (colWidth + colGap) + colWidth * 0.4;
          const endX = Math.max(colStartX + colWidth, futX);
          ctx.strokeStyle = 'rgba(250, 204, 21, 0.45)';
          ctx.lineWidth = 1;
          ctx.setLineDash([2, 2]);
          ctx.beginPath();
          ctx.moveTo(colStartX + colWidth, pocY);
          ctx.lineTo(endX, pocY);
          ctx.stroke();
          ctx.setLineDash([]);
          // Test Dot
          ctx.fillStyle = 'rgba(250, 204, 21, 0.7)';
          ctx.beginPath();
          ctx.arc(endX, pocY, 2, 0, Math.PI * 2);
          ctx.fill();
        } else {
          // Virgin nPOC: Extends forward to right price scale
          const endX = width - padding.right;
          if (endX > colStartX + colWidth) {
            ctx.strokeStyle = '#facc15';
            ctx.lineWidth = 1.2;
            ctx.setLineDash([4, 4]);
            ctx.beginPath();
            ctx.moveTo(colStartX + colWidth, pocY);
            ctx.lineTo(endX, pocY);
            ctx.stroke();
            ctx.setLineDash([]);

            ctx.fillStyle = '#facc15';
            ctx.font = 'bold 9px "JetBrains Mono", monospace';
            ctx.textAlign = 'right';
            ctx.fillText(`nPOC: ${profile.pocPrice.toFixed(1)}`, width - padding.right - 6, pocY - 3);
          }
        }
      }
    });

    // Single Print Zones projection boxes
    if (highlightSinglePrints && singlePrintZones.length > 0) {
      singlePrintZones.forEach((z: SinglePrintZone) => {
        if (z.isCleared) return;
        const sX = padding.left + panOffset.x + z.sIdx * (colWidth + colGap) + colWidth;
        const eX = width - padding.right;
        const topY = getPriceY(z.highPrice);
        const botY = getPriceY(z.lowPrice);
        const zH = Math.max(2, botY - topY);

        ctx.fillStyle = z.type === 'buying' ? 'rgba(34, 197, 94, 0.12)' : 'rgba(239, 68, 68, 0.12)';
        ctx.fillRect(sX, topY, eX - sX, zH);
        ctx.strokeStyle = z.type === 'buying' ? 'rgba(34, 197, 94, 0.5)' : 'rgba(239, 68, 68, 0.5)';
        ctx.setLineDash([3, 3]);
        ctx.strokeRect(sX, topY, eX - sX, zH);
        ctx.setLineDash([]);
      });
    }

    ctx.restore();

    // Crosshair HUD
    if (crosshairPos) {
      const { x, y } = crosshairPos;
      if (x >= padding.left && x <= width - padding.right && y >= padding.top && y <= height - padding.bottom) {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(padding.left, y);
        ctx.lineTo(width - padding.right, y);
        ctx.moveTo(x, padding.top);
        ctx.lineTo(x, height - padding.bottom);
        ctx.stroke();
        ctx.setLineDash([]);

        // Price badge on right
        const hoverPrice = maxPrice - ((y - padding.top) / chartH) * priceRange;
        ctx.fillStyle = '#00f0ff';
        ctx.fillRect(width - padding.right + 2, y - 9, 68, 18);
        ctx.fillStyle = '#000000';
        ctx.font = 'bold 10px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.fillText(hoverPrice.toFixed(1), width - padding.right + 36, y + 4);
      }
    }
  }, [dayProfiles, dimensions, viewMode, zoomLevel, panOffset, yScale, xScale, highlightSinglePrints, showIbLine, crosshairPos]);

  // High-Resolution Screenshot Export (Includes Watermark, Active SP Zones & Session Stats)
  const handleScreenshot = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    try {
      setScreenshotStatus('Capturing...');
      const dpr = window.devicePixelRatio || 1;
      const exportCanvas = document.createElement('canvas');
      exportCanvas.width = canvas.width;
      exportCanvas.height = canvas.height;
      const ctx = exportCanvas.getContext('2d');
      if (!ctx) return;

      // 1. Draw chart
      ctx.drawImage(canvas, 0, 0);

      // 2. Scale logical coordinates for HUD overlays
      ctx.save();
      ctx.scale(dpr, dpr);
      const w = dimensions.width;

      // Top Watermark Banner
      ctx.fillStyle = 'rgba(15, 23, 42, 0.95)';
      ctx.fillRect(0, 0, w, 36);
      ctx.strokeStyle = 'rgba(0, 240, 255, 0.4)';
      ctx.lineWidth = 1;
      ctx.strokeRect(0, 0, w, 36);

      ctx.fillStyle = '#ea580c';
      ctx.fillRect(10, 8, 70, 20);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('PRO TPO', 45, 22);

      ctx.fillStyle = '#f8fafc';
      ctx.font = 'bold 12px "JetBrains Mono", monospace';
      ctx.textAlign = 'left';
      ctx.fillText(`${symbol} • ${sessionPeriod} View • TPO Market Profile`, 90, 22);

      const timeStr = new Date().toLocaleString();
      ctx.fillStyle = '#94a3b8';
      ctx.textAlign = 'right';
      ctx.font = '10px "JetBrains Mono", monospace';
      ctx.fillText(timeStr, w - 15, 22);

      // Active Single Print Zones Summary Card
      const activeZones = singlePrintZones.filter((z: SinglePrintZone) => !z.isCleared);
      if (activeZones.length > 0) {
        const hudW = 280;
        const hudH = 26 + activeZones.slice(0, 3).length * 16;
        const hudX = 20;
        const hudY = 48;

        ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
        ctx.fillRect(hudX, hudY, hudW, hudH);
        ctx.strokeStyle = 'rgba(245, 158, 11, 0.5)';
        ctx.strokeRect(hudX, hudY, hudW, hudH);

        ctx.fillStyle = '#fbbf24';
        ctx.font = 'bold 10px sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(`⚡ ACTIVE SINGLE PRINT (SP) ZONES (${activeZones.length})`, hudX + 8, hudY + 16);

        activeZones.slice(0, 3).forEach((z: SinglePrintZone, i: number) => {
          ctx.fillStyle = z.type === 'buying' ? '#4ade80' : '#f87171';
          ctx.font = '9px "JetBrains Mono", monospace';
          ctx.fillText(`${z.dateStr}: ${z.lowPrice.toFixed(1)} - ${z.highPrice.toFixed(1)} (${z.type.toUpperCase()})`, hudX + 12, hudY + 32 + i * 16);
        });
      }

      ctx.restore();

      // Download PNG
      const link = document.createElement('a');
      link.download = `ProTPO_${symbol}_${Date.now()}.png`;
      link.href = exportCanvas.toDataURL('image/png');
      link.click();
      setScreenshotStatus('Saved!');
      setTimeout(() => setScreenshotStatus(''), 2500);
    } catch (err) {
      console.error('Screenshot failed:', err);
      setScreenshotStatus('Failed');
      setTimeout(() => setScreenshotStatus(''), 2500);
    }
  };

  // Interactive Pan / Zoom Mouse Handlers
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (x > dimensions.width - 75) {
      setDragMode('y-axis');
      setDragStart({ x, y });
      setInitialYScale(yScale);
    } else if (y > dimensions.height - 35) {
      setDragMode('x-axis');
      setDragStart({ x, y });
      setInitialXScale(xScale);
    } else {
      setDragMode('pan');
      setDragStart({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setCrosshairPos({ x, y });

    if (dragMode === 'pan') {
      setPanOffset({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
    } else if (dragMode === 'y-axis') {
      const deltaY = dragStart.y - y;
      setYScale(Math.max(0.3, Math.min(6.0, initialYScale * (1 + deltaY * 0.008))));
    } else if (dragMode === 'x-axis') {
      const deltaX = x - dragStart.x;
      setXScale(Math.max(0.3, Math.min(4.0, initialXScale * (1 + deltaX * 0.008))));
    }
  };

  const handleMouseUp = () => setDragMode('none');

  return (
    <div 
      ref={containerRef}
      className={className}
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: '#090d16',
        color: '#f8fafc',
        fontFamily: 'Inter, system-ui, sans-serif',
        borderRadius: isExpanded ? '0' : '8px',
        overflow: 'hidden',
        border: isExpanded ? 'none' : '1px solid #1e293b',
        position: isExpanded ? 'fixed' : 'relative',
        top: isExpanded ? 0 : undefined,
        left: isExpanded ? 0 : undefined,
        right: isExpanded ? 0 : undefined,
        bottom: isExpanded ? 0 : undefined,
        zIndex: isExpanded ? 99999 : 1,
        ...style
      }}
    >
      {/* Top Action Toolbar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '8px 14px',
        background: '#0d1526',
        borderBottom: '1px solid #1e293b',
        flexWrap: 'wrap',
        gap: '8px'
      }}>
        {/* Left: Brand Badge & Timeframe Selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <div style={{
            background: '#ea580c',
            color: '#ffffff',
            fontWeight: 900,
            padding: '3px 8px',
            borderRadius: '4px',
            fontSize: '11px',
            letterSpacing: '0.5px'
          }}>
            PRO TPO
          </div>

          <div style={{ display: 'flex', background: 'rgba(0,0,0,0.4)', borderRadius: '6px', padding: '2px' }}>
            {[
              { id: 'D', label: 'Daily' },
              { id: 'W', label: '50W (Weekly)' },
              { id: 'M_S', label: '25M (Monthly)' },
              { id: 'Y', label: '6Y (Yearly)' }
            ].map(b => (
              <button
                key={b.id}
                onClick={() => setSessionPeriod(b.id as any)}
                style={{
                  background: sessionPeriod === b.id ? '#2563eb' : 'transparent',
                  color: sessionPeriod === b.id ? '#ffffff' : '#94a3b8',
                  border: 'none',
                  padding: '4px 8px',
                  borderRadius: '4px',
                  fontSize: '11px',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                {b.label}
              </button>
            ))}
          </div>

          {/* View Mode */}
          <div style={{ display: 'flex', background: 'rgba(0,0,0,0.4)', borderRadius: '6px', padding: '2px' }}>
            {[
              { id: 'T-V', label: 'T-V (Split)' },
              { id: 'T', label: 'T (TPO)' },
              { id: 'V', label: 'V (Vol)' },
              { id: 'GV', label: 'GV' }
            ].map(m => (
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
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                {m.label}
              </button>
            ))}
          </div>

          {/* Toggles */}
          <button
            onClick={() => setHighlightSinglePrints(!highlightSinglePrints)}
            style={{
              background: highlightSinglePrints ? 'rgba(245, 158, 11, 0.25)' : 'transparent',
              color: highlightSinglePrints ? '#f59e0b' : '#64748b',
              border: '1px solid rgba(245, 158, 11, 0.3)',
              padding: '3px 8px',
              borderRadius: '4px',
              fontSize: '11px',
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            SP Zones {highlightSinglePrints ? 'ON' : 'OFF'}
          </button>
          <button
            onClick={() => setShowIbLine(!showIbLine)}
            style={{
              background: showIbLine ? 'rgba(192, 132, 252, 0.25)' : 'transparent',
              color: showIbLine ? '#c084fc' : '#64748b',
              border: '1px solid rgba(192, 132, 252, 0.3)',
              padding: '3px 8px',
              borderRadius: '4px',
              fontSize: '11px',
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            IB {showIbLine ? 'ON' : 'OFF'}
          </button>
        </div>

        {/* Right: Zoom & Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <button
            onClick={() => setZoomLevel((prev: number) => Math.min(4.0, prev * 1.25))}
            style={{ background: 'rgba(255,255,255,0.06)', border: 'none', color: '#60a5fa', cursor: 'pointer', padding: '4px 6px', borderRadius: '4px' }}
            title="Zoom In"
          >
            <ZoomIn size={14} />
          </button>
          <button
            onClick={() => setZoomLevel((prev: number) => Math.max(0.4, prev * 0.8))}
            style={{ background: 'rgba(255,255,255,0.06)', border: 'none', color: '#60a5fa', cursor: 'pointer', padding: '4px 6px', borderRadius: '4px' }}
            title="Zoom Out"
          >
            <ZoomOut size={14} />
          </button>
          <button
            onClick={() => { setZoomLevel(1.0); setYScale(1.0); setXScale(1.0); setPanOffset({ x: 0, y: 0 }); }}
            style={{ background: 'rgba(255,255,255,0.06)', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '4px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600 }}
          >
            Reset
          </button>

          <button
            onClick={handleScreenshot}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              background: 'rgba(0, 240, 255, 0.15)',
              color: '#00f0ff',
              border: '1px solid rgba(0, 240, 255, 0.3)',
              padding: '4px 8px',
              borderRadius: '4px',
              fontSize: '11px',
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            <Camera size={13} />
            <span>{screenshotStatus || 'Screenshot'}</span>
          </button>

          <button
            onClick={() => setIsExpanded(!isExpanded)}
            style={{ background: 'rgba(255,255,255,0.06)', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '4px 6px', borderRadius: '4px' }}
            title="Toggle Fullscreen"
          >
            {isExpanded ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </button>
        </div>
      </div>

      {/* Main Interactive Canvas */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        <canvas
          ref={canvasRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={() => { handleMouseUp(); setCrosshairPos(null); }}
          style={{
            cursor: dragMode === 'pan' ? 'grabbing' : (dragMode === 'y-axis' ? 'ns-resize' : (dragMode === 'x-axis' ? 'ew-resize' : 'crosshair')),
            display: 'block'
          }}
        />
      </div>
    </div>
  );
};

export default StandaloneProTPO;
