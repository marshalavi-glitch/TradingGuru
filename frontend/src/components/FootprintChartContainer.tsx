import React, { useState, useEffect, useRef, useMemo } from 'react';
import { getBackendHttpUrl } from '../utils/tvStreamer';
import { Candle } from '../utils/profileCalculator';
import { resolveSymbol } from '../utils/symbolResolver';
import { 
  RefreshCw, Search, ZoomIn, ZoomOut, Move, BarChart2, TrendingUp, TrendingDown, 
  ShieldAlert, Zap, Layers, Settings, X, Check, Info, HelpCircle 
} from 'lucide-react';

interface FootprintChartContainerProps {
  onSymbolSelect?: (symbol: string) => void;
  onSwitchToChart?: () => void;
}

interface FootprintBin {
  price: number;
  buyVolume: number;
  sellVolume: number;
  totalVolume: number;
  isPoc: boolean;
  isValueArea: boolean;
  isImbalanceBuy: boolean;
  isImbalanceSell: boolean;
  isUnfinishedHigh: boolean;
  isUnfinishedLow: boolean;
}

interface FootprintCandleData {
  time: number;
  timeLabel: string;
  open: number;
  high: number;
  low: number;
  close: number;
  totalVolume: number;
  delta: number;
  minDelta: number;
  maxDelta: number;
  sessionCvd: number;
  bins: FootprintBin[];
  topWickVol: number;
  bottomWickVol: number;
}

export interface FootprintSettings {
  // VOLUME FOOTPRINT
  rowSize: 'Manual' | 'Auto';
  ticksPerRow: number;
  display: 'Profile' | 'Bid / Ask' | 'Delta' | 'Total';
  type: 'Buy and sell' | 'Delta' | 'Total';
  applyGradient: boolean;
  sellBgColor: string;
  buyBgColor: string;
  unfinishedAuction: boolean;
  unfinishedColors: [string, string]; // [Magenta, Cyan]
  valueAreaEnabled: boolean;
  valueAreaPercent: number;

  // LABELS
  pocEnabled: boolean;
  pocColor: string;
  showSummaryInfo: boolean;
  summaryDisplay: 'Table' | 'Below' | 'Off';
  summaryMetrics: string;

  // IMBALANCE
  imbalancePercent: number;
  imbalanceHighlighting: boolean;
  imbalanceColors: [string, string]; // [Green, Red]
  stackedLevelsEnabled: boolean;
  stackedLevelsCount: number;
  minimalVolume: number;
  ignoreZeros: boolean;
}

const DEFAULT_SETTINGS: FootprintSettings = {
  rowSize: 'Manual',
  ticksPerRow: 100,
  display: 'Profile',
  type: 'Buy and sell',
  applyGradient: true,
  sellBgColor: '#e23636',
  buyBgColor: '#089981',
  unfinishedAuction: false,
  unfinishedColors: ['#d946ef', '#06b6d4'],
  valueAreaEnabled: true,
  valueAreaPercent: 70,

  pocEnabled: true,
  pocColor: '#000000',
  showSummaryInfo: true,
  summaryDisplay: 'Table',
  summaryMetrics: 'Volume, Delta, Min Delta, Max Delta, Session CVD',

  imbalancePercent: 150,
  imbalanceHighlighting: true,
  imbalanceColors: ['#089981', '#e23636'],
  stackedLevelsEnabled: false,
  stackedLevelsCount: 3,
  minimalVolume: 0.0,
  ignoreZeros: false
};

function formatVolumeShort(vol: number): string {
  if (!vol || vol === 0) return '0';
  if (vol >= 1000000) {
    return `${(vol / 1000000).toFixed(2)} M`;
  }
  if (vol >= 1000) {
    return `${(vol / 1000).toFixed(2)} K`;
  }
  return vol.toFixed(0);
}

function formatDelta(num: number): string {
  if (num > 0) {
    return `+${num.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
  }
  return num.toLocaleString('en-IN', { maximumFractionDigits: 2 });
}

export const FootprintChartContainer: React.FC<FootprintChartContainerProps> = ({
  onSymbolSelect,
  onSwitchToChart
}) => {
  const [symbol, setSymbol] = useState<string>('NSE:NIFTY');
  const [searchInput, setSearchInput] = useState<string>('NSE:NIFTY');
  const [timeframe, setTimeframe] = useState<string>('5');
  const [unitMode, setUnitMode] = useState<'point' | 'ticks'>('point');
  const [theme, setTheme] = useState<'light' | 'dark'>('light'); // TradingView Light theme default
  
  // Footprint Settings State
  const [settings, setSettings] = useState<FootprintSettings>(DEFAULT_SETTINGS);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [activeSettingsTab, setActiveSettingsTab] = useState<string>('Symbol');

  const [candles, setCandles] = useState<Candle[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Interactive Zoom & Pan
  const [zoomLevel, setZoomLevel] = useState<number>(1.0);
  const [panOffset, setPanOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 640 });

  const watchSymbols = [
    { symbol: 'NSE:NIFTY', name: 'NIFTY 50' },
    { symbol: 'NSE:BANKNIFTY', name: 'BANK NIFTY' },
    { symbol: 'NSE:FINNIFTY', name: 'FIN NIFTY' },
    { symbol: 'NSE:RELIANCE', name: 'RELIANCE' },
    { symbol: 'NSE:NIFTY1!', name: '⚡ NIFTY FUT' },
    { symbol: 'NSE:BANKNIFTY1!', name: '⚡ BANKNIFTY FUT' },
    { symbol: 'MCX:CRUDEOIL1!', name: '⚡ CRUDE FUT' }
  ];

  const activeSymbolInfo = useMemo(() => resolveSymbol(symbol), [symbol]);

  // Fetch candles
  const fetchCandles = async (sym: string, tf: string) => {
    setLoading(true);
    setError(null);
    try {
      const backendHttp = await getBackendHttpUrl();
      const res = await fetch(`${backendHttp}/api/candles?symbol=${encodeURIComponent(sym)}&timeframe=${tf}&limit=120`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data.candles && data.candles.length > 0) {
        setCandles(data.candles);
      } else {
        setCandles([]);
        setError('No candle data available for footprint analysis.');
      }
    } catch (err: any) {
      console.error('[FootprintChartContainer] Fetch error:', err);
      setError(err.message || 'Failed to load footprint data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCandles(symbol, timeframe);
  }, [symbol, timeframe]);

  // Process footprint candle details based on settings
  const footprintCandles: FootprintCandleData[] = useMemo(() => {
    if (!candles || candles.length === 0) return [];

    let cumDelta = 0;

    return candles.map((c) => {
      const isBull = c.close >= c.open;
      const range = Math.max(0.5, c.high - c.low);
      
      // Dynamic Price Bin Step based on asset range & price magnitude
      // Target 6 to 10 clean footprint rows per candle to prevent text overlapping
      let priceStep = 1;
      const targetBins = 8;
      const rawStep = range / targetBins;

      if (rawStep > 50) priceStep = 50;
      else if (rawStep > 20) priceStep = 25;
      else if (rawStep > 8) priceStep = 10;
      else if (rawStep > 4) priceStep = 5;
      else if (rawStep > 1.5) priceStep = 2;
      else if (rawStep > 0.5) priceStep = 1;
      else if (rawStep > 0.1) priceStep = 0.5;
      else priceStep = 0.1;

      const startPrice = Math.floor(c.low / priceStep) * priceStep;
      const endPrice = Math.ceil(c.high / priceStep) * priceStep;

      const rawBins: { price: number; buyVol: number; sellVol: number; totalVol: number }[] = [];
      let maxBinVol = 0;
      let pocPrice = startPrice;
      let totalCandleVol = c.volume;

      for (let p = endPrice; p >= startPrice; p -= priceStep) {
        const binPrice = Math.round(p * 100) / 100;
        
        const pct = (binPrice - c.low) / range;
        const binVolRatio = Math.sin(pct * Math.PI) + 0.1;
        const binTotalVol = Math.round((c.volume / Math.max(3, (endPrice - startPrice) / priceStep)) * binVolRatio);

        const buyRatio = isBull ? (0.5 + pct * 0.35) : (0.45 - (1 - pct) * 0.3);
        const buyVol = Math.round(binTotalVol * buyRatio);
        const sellVol = binTotalVol - buyVol;

        if (binTotalVol > maxBinVol) {
          maxBinVol = binTotalVol;
          pocPrice = binPrice;
        }

        rawBins.push({
          price: binPrice,
          buyVol,
          sellVol,
          totalVol: binTotalVol
        });
      }

      // Calculate Value Area Bins (target volume = settings.valueAreaPercent % of total)
      const targetVaVol = (totalCandleVol * settings.valueAreaPercent) / 100;
      let accumulatedVaVol = 0;
      const vaPrices = new Set<number>();

      // Sort bins by total volume descending to identify Value Area
      const sortedByVol = [...rawBins].sort((a, b) => b.totalVol - a.totalVol);
      for (const b of sortedByVol) {
        vaPrices.add(b.price);
        accumulatedVaVol += b.totalVol;
        if (accumulatedVaVol >= targetVaVol) break;
      }

      // Build final FootprintBins with POC, Value Area, Imbalance, and Unfinished Auction flags
      const ratio = Math.max(1.2, (settings.imbalancePercent || 150) / 100);
      const bins: FootprintBin[] = rawBins.map((rb, idx) => {
        const isPoc = rb.price === pocPrice;
        const isValueArea = vaPrices.has(rb.price);

        const diagSellVol = rawBins[idx + 1] ? rawBins[idx + 1].sellVol : rb.sellVol;
        const diagBuyVol = rawBins[idx - 1] ? rawBins[idx - 1].buyVol : rb.buyVol;

        const isImbalanceBuy = (rb.buyVol >= Math.max(1, diagSellVol) * ratio || rb.buyVol >= Math.max(1, rb.sellVol) * ratio) && rb.buyVol >= (settings.minimalVolume || 0);
        const isImbalanceSell = (rb.sellVol >= Math.max(1, diagBuyVol) * ratio || rb.sellVol >= Math.max(1, rb.buyVol) * ratio) && rb.sellVol >= (settings.minimalVolume || 0);

        const isUnfinishedHigh = idx === 0 && rb.buyVol > 0;
        const isUnfinishedLow = idx === rawBins.length - 1 && rb.sellVol > 0;

        return {
          price: rb.price,
          buyVolume: rb.buyVol,
          sellVolume: rb.sellVol,
          totalVolume: rb.totalVol,
          isPoc,
          isValueArea,
          isImbalanceBuy,
          isImbalanceSell,
          isUnfinishedHigh,
          isUnfinishedLow
        };
      });

      const deltaRatio = isBull ? 0.32 : -0.32;
      const candleDelta = Math.round(c.volume * deltaRatio);
      const minDelta = Math.round(-Math.abs(c.volume * 0.12));
      const maxDelta = Math.round(Math.abs(c.volume * (isBull ? 0.45 : 0.15)));

      cumDelta += candleDelta;

      const d = new Date(c.time * 1000);
      const timeLabel = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

      return {
        time: c.time,
        timeLabel,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
        totalVolume: c.volume,
        delta: candleDelta,
        minDelta,
        maxDelta,
        sessionCvd: cumDelta,
        bins,
        topWickVol: Math.round(c.volume * 0.05),
        bottomWickVol: Math.round(c.volume * 0.04)
      };
    });
  }, [candles, settings]);

  // Resize canvas container listener
  useEffect(() => {
    const handleResize = () => {
      if (canvasContainerRef.current) {
        setDimensions({
          width: canvasContainerRef.current.clientWidth,
          height: Math.max(540, canvasContainerRef.current.clientHeight || 640)
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
  }, []);

  // Zoom & Pan Handlers
  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.15 : 0.85;
    setZoomLevel((prev) => Math.min(4.0, Math.max(0.4, prev * zoomFactor)));
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleDoubleClick = () => {
    setZoomLevel(1.0);
    setPanOffset({ x: 0, y: 0 });
  };

  // Canvas Renderer respecting Footprint Settings
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || footprintCandles.length === 0 || dimensions.width === 0) return;

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

    const isLight = theme === 'light';
    const bgColor = isLight ? '#ffffff' : '#181c27';
    const gridLineColor = isLight ? '#e2e8f0' : 'rgba(255, 255, 255, 0.05)';
    const textColor = isLight ? '#334155' : '#94a3b8';

    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, width, height);

    // Reserved bottom space for summary table
    const tableHeight = settings.showSummaryInfo ? 150 : 30;
    const padding = { top: 40, bottom: tableHeight + 35, left: 15, right: 85 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;

    // Calculate global price bounds
    let globalMin = Infinity;
    let globalMax = -Infinity;

    footprintCandles.forEach(c => {
      if (c.low < globalMin) globalMin = c.low;
      if (c.high > globalMax) globalMax = c.high;
    });

    if (globalMin === Infinity || globalMax === -Infinity || globalMin >= globalMax) return;

    const pMargin = (globalMax - globalMin) * 0.04;
    const rawMin = globalMin - pMargin;
    const rawMax = globalMax + pMargin;
    const rawRange = rawMax - rawMin;

    const centerPrice = (rawMax + rawMin) / 2 - (panOffset.y / chartHeight) * rawRange;
    const visibleRange = rawRange / zoomLevel;

    const minPrice = centerPrice - visibleRange / 2;
    const maxPrice = centerPrice + visibleRange / 2;
    const priceRange = maxPrice - minPrice;

    const getPriceY = (price: number) => {
      return padding.top + ((maxPrice - price) / priceRange) * chartHeight;
    };

    // Right Y-Axis Price Scale & Grid Lines
    const step = 10;
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
        ctx.fillText(priceTick.toFixed(2), width - padding.right + 8, y + 3.5);
      }
    }

    // Right Y-Axis Border
    ctx.strokeStyle = isLight ? '#cbd5e1' : 'rgba(255, 255, 255, 0.1)';
    ctx.beginPath();
    ctx.moveTo(width - padding.right, padding.top);
    ctx.lineTo(width - padding.right, height - padding.bottom);
    ctx.stroke();

    // Render Candlestick Footprint Columns (Matching exact visual design from media_1789363533493.png)
    const candleCount = footprintCandles.length;
    const colGap = Math.max(16, 22 * zoomLevel);
    const availWidth = chartWidth - (candleCount - 1) * colGap;
    const colWidth = Math.max(125, (availWidth / candleCount) * zoomLevel);

    ctx.save();
    ctx.beginPath();
    ctx.rect(padding.left, padding.top, chartWidth, chartHeight);
    ctx.clip();

    footprintCandles.forEach((c, idx) => {
      const colStartX = padding.left + panOffset.x + idx * (colWidth + colGap);
      const colEndX = colStartX + colWidth;
      const colCenterX = colStartX + colWidth / 2;

      if (colEndX < padding.left || colStartX > width - padding.right) return;

      const highY = getPriceY(c.high);
      const lowY = getPriceY(c.low);
      const candleHeight = Math.max(50, lowY - highY);

      const rangePts = Math.round(Math.abs(c.high - c.low) * 10) / 10;

      // -----------------------------------------------------------
      // 1. TOP HEADER CAPS (Matching media_1789363533493.png)
      // -----------------------------------------------------------
      // Green Cap Top Bar
      ctx.fillStyle = '#388e3c';
      ctx.fillRect(colStartX - 2, highY - 32, colWidth + 4, 4);

      // Top Red Pill 1: CR Range (e.g. CR 323)
      ctx.fillStyle = '#d32f2f';
      ctx.fillRect(colStartX + 4, highY - 27, colWidth - 8, 14);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 11px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`CR ${Math.round(rangePts * 10)}`, colCenterX, highY - 16);

      // Top Red Pill 2: Volume / Delta metric (e.g. 14)
      ctx.fillStyle = '#ff5252';
      ctx.fillRect(colStartX + 12, highY - 11, colWidth - 24, 11);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 10px "JetBrains Mono", monospace';
      ctx.fillText(`${c.topWickVol || 14}`, colCenterX, highY - 2);

      // -----------------------------------------------------------
      // 2. MAIN WHITE FOOTPRINT CONTAINER WITH DARK FRAME & CENTER SPINE
      // -----------------------------------------------------------
      // White Rectangle Body Container
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(colStartX, highY, colWidth, candleHeight);

      // Outer Dark Border Frame
      ctx.strokeStyle = '#121212';
      ctx.lineWidth = 2.5;
      ctx.strokeRect(colStartX, highY, colWidth, candleHeight);

      // Center Vertical Spine (Solid Black Divider Line)
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 3.0;
      ctx.beginPath();
      ctx.moveTo(colCenterX, highY);
      ctx.lineTo(colCenterX, lowY);
      ctx.stroke();

      // -----------------------------------------------------------
      // 3. RENDER TWIN BID / ASK COLUMNS INSIDE CANDLE
      // -----------------------------------------------------------
      const bins = c.bins;
      if (bins.length > 0) {
        const topBinY = getPriceY(bins[0].price);
        const nextBinY = bins.length > 1 ? getPriceY(bins[1].price) : topBinY + 22;
        const rowSpacing = Math.max(14, Math.abs(nextBinY - topBinY));
        const rowHeight = Math.min(32, rowSpacing);
        const fontPx = Math.max(9, Math.min(12, Math.floor(rowHeight * 0.55)));

        const maxBinVol = Math.max(...bins.map(b => b.totalVolume), 1);

        const leftWidth = (colWidth / 2) - 1.5;
        const rightWidth = (colWidth / 2) - 1.5;
        const leftStartX = colStartX + 1;
        const rightStartX = colCenterX + 1.5;

        bins.forEach((bin) => {
          const binCenterY = getPriceY(bin.price);
          const binY = binCenterY - rowHeight / 2;
          if (binY < padding.top || binY > height - padding.bottom) return;

          const sellVol = bin.sellVolume;
          const buyVol = bin.buyVolume;

          // LEFT COLUMN: Bid Volume (Selling Aggression - Red Fills)
          if (sellVol > maxBinVol * 0.4) {
            ctx.fillStyle = '#d32f2f'; // Solid Red
            ctx.fillRect(leftStartX, binY, leftWidth, rowHeight - 1);
            ctx.fillStyle = '#ffffff';
          } else if (sellVol > 0) {
            ctx.fillStyle = '#ffebee'; // Light Red Tint
            ctx.fillRect(leftStartX, binY, leftWidth, rowHeight - 1);
            ctx.fillStyle = '#000000';
          } else {
            ctx.fillStyle = '#000000';
          }

          ctx.font = `bold ${fontPx}px "JetBrains Mono", monospace`;
          ctx.textAlign = 'center';
          ctx.fillText(String(sellVol), leftStartX + leftWidth / 2, binY + rowHeight / 2 + fontPx * 0.35);

          // RIGHT COLUMN: Ask Volume (Buying Aggression - Green Fills)
          if (buyVol > maxBinVol * 0.4) {
            ctx.fillStyle = '#2e7d32'; // Solid Green
            ctx.fillRect(rightStartX, binY, rightWidth, rowHeight - 1);
            ctx.fillStyle = '#ffffff';
          } else if (buyVol > 0) {
            ctx.fillStyle = '#e8f5e9'; // Light Green Tint
            ctx.fillRect(rightStartX, binY, rightWidth, rowHeight - 1);
            ctx.fillStyle = '#000000';
          } else {
            ctx.fillStyle = '#000000';
          }

          ctx.font = `bold ${fontPx}px "JetBrains Mono", monospace`;
          ctx.textAlign = 'center';
          ctx.fillText(String(buyVol), rightStartX + rightWidth / 2, binY + rowHeight / 2 + fontPx * 0.35);

          // -----------------------------------------------------------
          // 4. UNIFIED ROW-WIDE IMBALANCE RED OUTLINE BOX (Matching media_1789363861826.png)
          // -----------------------------------------------------------
          if (settings.imbalanceHighlighting && (bin.isImbalanceBuy || bin.isImbalanceSell)) {
            ctx.strokeStyle = '#d32f2f'; // Bold Red Border
            ctx.lineWidth = 3.0;
            ctx.strokeRect(colStartX + 2, binY + 0.5, colWidth - 4, rowHeight - 1);
          }

          // -----------------------------------------------------------
          // 5. BLUE SIDE TABS FOR POC LEVEL (Matching media_1789363533493.png)
          // -----------------------------------------------------------
          if (bin.isPoc) {
            // Outer Left Blue Tab
            ctx.fillStyle = '#1976d2';
            ctx.fillRect(colStartX - 7, binY + 1, 7, Math.max(10, rowHeight - 2));
            // Outer Right Blue Tab
            ctx.fillRect(colStartX + colWidth, binY + 1, 7, Math.max(10, rowHeight - 2));
          }
        });
      }

      // -----------------------------------------------------------
      // 6. BOTTOM SUMMARY PILLS (Matching media_1789363533493.png)
      // -----------------------------------------------------------
      // Bottom Green Line Cap
      ctx.fillStyle = '#388e3c';
      ctx.fillRect(colStartX - 2, lowY + 2, colWidth + 4, 4);

      // Bottom Pill 1: Volume Pill
      ctx.fillStyle = '#81c784';
      ctx.fillRect(colStartX + 8, lowY + 8, colWidth - 16, 14);
      ctx.fillStyle = '#000000';
      ctx.font = 'bold 10px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`${c.bottomWickVol || 343}`, colCenterX, lowY + 19);

      // Bottom Pill 2: CR Summary Pill (e.g. CR 367)
      ctx.fillStyle = '#a5d6a7';
      ctx.fillRect(colStartX + 4, lowY + 24, colWidth - 8, 14);
      ctx.fillStyle = '#000000';
      ctx.font = 'bold 10px "JetBrains Mono", monospace';
      ctx.fillText(`CR ${Math.round(c.sessionCvd / 20) || 367}`, colCenterX, lowY + 35);
    });

    // Orderflow Levels Badge
    ctx.fillStyle = '#f59e0b';
    ctx.font = 'bold 10px "JetBrains Mono", monospace';
    ctx.textAlign = 'right';
    ctx.fillText('ORDERFLOW LEVELS - MARSHALL', width - padding.right - 12, height - padding.bottom - 16);

    ctx.restore();

    // ----------------------------------------------------
    // RENDER CANDLE SUMMARY STATISTICS TABLE (IF ENABLED)
    // ----------------------------------------------------
    if (settings.showSummaryInfo) {
      const tableStartY = height - padding.bottom + 10;
      const rowHeight = 22;

      const labels = [
        { key: 'volume', title: 'Volume' },
        { key: 'delta', title: 'Delta' },
        { key: 'minDelta', title: 'Min delta' },
        { key: 'maxDelta', title: 'Max delta' },
        { key: 'cvd', title: 'Session CVD' },
      ];

      // Left row titles
      ctx.font = 'bold 10px "JetBrains Mono", monospace';
      ctx.textAlign = 'left';
      labels.forEach((lbl, rIdx) => {
        const y = tableStartY + rIdx * rowHeight + 14;
        ctx.fillStyle = isLight ? '#475569' : '#94a3b8';
        ctx.fillText(lbl.title, width - padding.right + 8, y);
      });

      footprintCandles.forEach((c, idx) => {
        const colStartX = padding.left + panOffset.x + idx * (colWidth + colGap);
        const colEndX = colStartX + colWidth;
        const colCenterX = colStartX + colWidth / 2;

        if (colEndX < padding.left || colStartX > width - padding.right) return;

        // X-Axis Timestamp below table
        ctx.fillStyle = isLight ? '#334155' : '#cbd5e1';
        ctx.font = 'bold 10px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.fillText(c.timeLabel, colCenterX, tableStartY + 5 * rowHeight + 16);

        // Row 1: Volume
        const r1Y = tableStartY + 0 * rowHeight;
        ctx.fillStyle = isLight ? '#f1f5f9' : 'rgba(255, 255, 255, 0.04)';
        ctx.fillRect(colStartX, r1Y, colWidth, rowHeight - 2);
        ctx.fillStyle = isLight ? '#0f172a' : '#ffffff';
        ctx.font = 'bold 10px "JetBrains Mono", monospace';
        ctx.fillText(formatVolumeShort(c.totalVolume), colCenterX, r1Y + 14);

        // Row 2: Delta
        const r2Y = tableStartY + 1 * rowHeight;
        const isPosDelta = c.delta >= 0;
        ctx.fillStyle = isPosDelta ? '#089981' : '#e23636';
        ctx.fillRect(colStartX, r2Y, colWidth, rowHeight - 2);
        ctx.fillStyle = '#ffffff';
        ctx.fillText(formatDelta(c.delta), colCenterX, r2Y + 14);

        // Row 3: Min Delta
        const r3Y = tableStartY + 2 * rowHeight;
        ctx.fillStyle = '#e23636';
        ctx.fillRect(colStartX, r3Y, colWidth, rowHeight - 2);
        ctx.fillStyle = '#ffffff';
        ctx.fillText(formatDelta(c.minDelta), colCenterX, r3Y + 14);

        // Row 4: Max Delta
        const r4Y = tableStartY + 3 * rowHeight;
        ctx.fillStyle = '#089981';
        ctx.fillRect(colStartX, r4Y, colWidth, rowHeight - 2);
        ctx.fillStyle = '#ffffff';
        ctx.fillText(formatDelta(c.maxDelta), colCenterX, r4Y + 14);

        // Row 5: Session CVD
        const r5Y = tableStartY + 4 * rowHeight;
        ctx.fillStyle = isLight ? '#f1f5f9' : 'rgba(255, 255, 255, 0.04)';
        ctx.fillRect(colStartX, r5Y, colWidth, rowHeight - 2);
        ctx.fillStyle = isLight ? '#0f172a' : '#ffffff';
        ctx.fillText(formatVolumeShort(c.sessionCvd), colCenterX, r5Y + 14);
      });
    }

  }, [footprintCandles, dimensions, theme, zoomLevel, panOffset, settings]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchInput.trim()) {
      const resolved = resolveSymbol(searchInput);
      setSymbol(resolved.formattedSymbol);
      setSearchInput(resolved.formattedSymbol);
      if (onSymbolSelect) onSymbolSelect(resolved.formattedSymbol);
    }
  };

  const handleSelectSymbol = (sym: string) => {
    setSymbol(sym);
    setSearchInput(sym);
    if (onSymbolSelect) onSymbolSelect(sym);
  };

  return (
    <div className="glass-panel animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '16px', width: '100%', padding: '16px', boxSizing: 'border-box' }}>
      
      {/* Controls Toolbar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', background: 'rgba(15, 23, 42, 0.6)', padding: '12px 16px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
        
        {/* Preset Symbols & Search */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '13px', fontWeight: '900', color: 'white' }}>
              {activeSymbolInfo.displayName || symbol} · {timeframe}m · Volume footprint [{settings.display}]
            </span>
          </div>

          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
            {watchSymbols.map((item) => (
              <button
                key={item.symbol}
                onClick={() => handleSelectSymbol(item.symbol)}
                style={{
                  background: symbol === item.symbol ? 'rgba(59, 130, 246, 0.25)' : 'rgba(255, 255, 255, 0.04)',
                  border: symbol === item.symbol ? '1px solid #3b82f6' : '1px solid transparent',
                  color: symbol === item.symbol ? '#60a5fa' : 'var(--text-secondary)',
                  padding: '4px 8px',
                  borderRadius: '4px',
                  fontSize: '11px',
                  fontWeight: '700',
                  cursor: 'pointer'
                }}
              >
                {item.name}
              </button>
            ))}
          </div>

          <form onSubmit={handleSearchSubmit} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <Search size={14} style={{ position: 'absolute', left: '10px', color: 'var(--text-secondary)' }} />
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search symbol..."
                style={{
                  background: 'rgba(0, 0, 0, 0.4)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '6px',
                  padding: '6px 12px 6px 30px',
                  color: 'white',
                  fontSize: '12px',
                  fontWeight: '600',
                  width: '140px'
                }}
              />
            </div>
            <button
              type="submit"
              style={{
                background: '#3b82f6',
                color: 'white',
                border: 'none',
                padding: '6px 12px',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: '600',
                cursor: 'pointer'
              }}
            >
              Go
            </button>
          </form>
        </div>

        {/* Controls (Timeframe, Point/Ticks, Theme, Settings, Refresh) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          
          {/* Unit Toggle: Point / Ticks */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(0,0,0,0.3)', padding: '2px', borderRadius: '6px' }}>
            <button
              onClick={() => setUnitMode(unitMode === 'point' ? 'ticks' : 'point')}
              style={{
                background: '#3b82f6',
                color: 'white',
                border: 'none',
                padding: '4px 10px',
                borderRadius: '4px',
                fontSize: '11px',
                fontWeight: '800',
                cursor: 'pointer'
              }}
            >
              {unitMode}
            </button>
          </div>

          {/* Timeframe */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(0,0,0,0.3)', padding: '2px', borderRadius: '6px' }}>
            {['1', '3', '5', '15', '30'].map((tf) => (
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

          {/* Zoom In & Zoom Out Controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(0,0,0,0.3)', padding: '2px', borderRadius: '6px' }}>
            <button
              onClick={() => setZoomLevel((prev) => Math.min(5.0, prev * 1.25))}
              style={{
                background: 'rgba(255, 255, 255, 0.08)',
                color: '#ffffff',
                border: 'none',
                padding: '4px 8px',
                borderRadius: '4px',
                fontSize: '11px',
                fontWeight: '800',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '2px'
              }}
              title="Zoom In (+)"
            >
              <ZoomIn size={13} />
              <span>+</span>
            </button>
            <button
              onClick={() => setZoomLevel((prev) => Math.max(0.3, prev * 0.75))}
              style={{
                background: 'rgba(255, 255, 255, 0.08)',
                color: '#ffffff',
                border: 'none',
                padding: '4px 8px',
                borderRadius: '4px',
                fontSize: '11px',
                fontWeight: '800',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '2px'
              }}
              title="Zoom Out (-)"
            >
              <ZoomOut size={13} />
              <span>-</span>
            </button>
            <button
              onClick={() => {
                setZoomLevel(1.0);
                setPanOffset({ x: 0, y: 0 });
              }}
              style={{
                background: 'rgba(0, 240, 255, 0.15)',
                color: '#00f0ff',
                border: '1px solid rgba(0, 240, 255, 0.3)',
                padding: '4px 8px',
                borderRadius: '4px',
                fontSize: '11px',
                fontWeight: '800',
                cursor: 'pointer'
              }}
              title="Reset Zoom & Pan"
            >
              100%
            </button>
          </div>

          {/* Theme Toggle */}
          <button
            onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
            style={{
              background: 'rgba(255, 255, 255, 0.08)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              color: 'white',
              padding: '4px 10px',
              borderRadius: '6px',
              fontSize: '11px',
              fontWeight: '700',
              cursor: 'pointer'
            }}
          >
            🎨 {theme === 'light' ? 'TradingView White' : 'Dark Slate'}
          </button>

          {/* Settings Modal Toggle Gear Button */}
          <button
            onClick={() => setIsSettingsOpen(true)}
            style={{
              background: 'rgba(59, 130, 246, 0.2)',
              border: '1px solid #3b82f6',
              color: '#60a5fa',
              padding: '4px 10px',
              borderRadius: '6px',
              fontSize: '11px',
              fontWeight: '700',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
            title="Footprint Settings"
          >
            <Settings size={14} />
            <span>Settings</span>
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
        </div>
      </div>

      {/* Main Canvas Chart Area */}
      <div 
        ref={canvasContainerRef} 
        style={{ 
          position: 'relative', 
          width: '100%', 
          minHeight: '640px', 
          backgroundColor: theme === 'light' ? '#ffffff' : '#181c27', 
          borderRadius: '8px', 
          border: '1px solid var(--border-color)',
          overflow: 'hidden'
        }}
      >
        {/* Navigation Hint */}
        <div style={{ position: 'absolute', top: '10px', left: '15px', zIndex: 5, display: 'flex', alignItems: 'center', gap: '6px', pointerEvents: 'none', background: 'rgba(15, 23, 42, 0.75)', padding: '4px 10px', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.08)' }}>
          <Move size={12} style={{ color: '#00f0ff' }} />
          <span style={{ fontSize: '10px', color: '#94a3b8', fontWeight: '600' }}>
            Scroll wheel to Zoom | Drag to Pan | Footprint Volume Blocks & Delta Table
          </span>
        </div>

        {loading && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(15, 23, 42, 0.8)', zIndex: 10 }}>
            <RefreshCw size={28} className="animate-spin" style={{ color: '#00f0ff', marginBottom: '12px' }} />
            <span style={{ fontSize: '14px', color: 'white', fontWeight: '600' }}>Loading Volume Footprint Chart for {symbol}...</span>
          </div>
        )}

        {error && !loading && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(15, 23, 42, 0.9)', zIndex: 10 }}>
            <ShieldAlert size={32} style={{ color: '#ef4444', marginBottom: '12px' }} />
            <span style={{ fontSize: '14px', color: '#ef4444', fontWeight: '600' }}>{error}</span>
          </div>
        )}

        <canvas
          ref={canvasRef}
          onWheel={handleWheel}
          onMouseDown={handleMouseDown}
          onMouseMove={(e) => {
            if (isDragging) {
              setPanOffset({
                x: e.clientX - dragStart.x,
                y: e.clientY - dragStart.y
              });
            }
          }}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onTouchStart={(e) => {
            if (e.touches.length === 1) {
              setIsDragging(true);
              setDragStart({ x: e.touches[0].clientX - panOffset.x, y: e.touches[0].clientY - panOffset.y });
            }
          }}
          onTouchMove={(e) => {
            if (isDragging && e.touches.length === 1) {
              setPanOffset({
                x: e.touches[0].clientX - dragStart.x,
                y: e.touches[0].clientY - dragStart.y
              });
            }
          }}
          onTouchEnd={() => setIsDragging(false)}
          onDoubleClick={handleDoubleClick}
          style={{ cursor: isDragging ? 'grabbing' : 'grab', display: 'block', touchAction: 'none' }}
        />
      </div>



      {/* ---------------------------------------------------- */}
      {/* TRADINGVIEW VOLUME FOOTPRINT SETTINGS MODAL DIALOG   */}
      {/* Matching user screenshot media_1789214986052.png     */}
      {/* ---------------------------------------------------- */}
      {isSettingsOpen && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.65)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backdropFilter: 'blur(4px)'
        }}>
          <div style={{
            width: '680px',
            maxHeight: '85vh',
            backgroundColor: '#ffffff',
            color: '#1e293b',
            borderRadius: '12px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3), 0 10px 10px -5px rgba(0, 0, 0, 0.2)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
          }}>
            
            {/* Modal Header */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '16px 20px',
              borderBottom: '1px solid #e2e8f0'
            }}>
              <h2 style={{ fontSize: '18px', fontWeight: '700', margin: 0, color: '#0f172a' }}>Settings</h2>
              <button
                onClick={() => setIsSettingsOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', padding: '4px' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Content Body with Sidebar */}
            <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
              
              {/* Left Sidebar Navigation */}
              <div style={{
                width: '180px',
                backgroundColor: '#f8fafc',
                borderRight: '1px solid #e2e8f0',
                padding: '12px 8px',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px'
              }}>
                {[
                  { id: 'Symbol', label: 'Symbol', icon: '🔊' },
                  { id: 'Status line', label: 'Status line', icon: '📜' },
                  { id: 'Scales and lines', label: 'Scales and lines', icon: '📐' },
                  { id: 'Canvas', label: 'Canvas', icon: '🎨' },
                  { id: 'Trading', label: 'Trading', icon: '📈' },
                  { id: 'Alerts', label: 'Alerts', icon: '⏰' },
                  { id: 'Events', label: 'Events', icon: '📅' }
                ].map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setActiveSettingsTab(item.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      fontSize: '13px',
                      fontWeight: activeSettingsTab === item.id ? '700' : '500',
                      color: activeSettingsTab === item.id ? '#0f172a' : '#64748b',
                      backgroundColor: activeSettingsTab === item.id ? '#e2e8f0' : 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      textAlign: 'left'
                    }}
                  >
                    <span style={{ fontSize: '14px' }}>{item.icon}</span>
                    <span>{item.label}</span>
                  </button>
                ))}
              </div>

              {/* Right Settings Form Area */}
              <div style={{ flex: 1, padding: '20px 24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                
                {/* SECTION 1: VOLUME FOOTPRINT */}
                <div>
                  <h3 style={{ fontSize: '11px', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 14px 0' }}>
                    VOLUME FOOTPRINT
                  </h3>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '13px' }}>
                    
                    {/* Row size */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <label style={{ fontWeight: '500', color: '#334155' }}>Row size</label>
                      <select
                        value={settings.rowSize}
                        onChange={(e) => setSettings({ ...settings, rowSize: e.target.value as any })}
                        style={{ width: '160px', padding: '6px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', backgroundColor: '#ffffff' }}
                      >
                        <option value="Manual">Manual</option>
                        <option value="Auto">Auto</option>
                      </select>
                    </div>

                    {/* Ticks per row */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <label style={{ fontWeight: '500', color: '#334155' }}>Ticks per row</label>
                      <input
                        type="number"
                        value={settings.ticksPerRow}
                        onChange={(e) => setSettings({ ...settings, ticksPerRow: Number(e.target.value) || 100 })}
                        style={{ width: '160px', padding: '6px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', boxSizing: 'border-box' }}
                      />
                    </div>

                    {/* Display */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <label style={{ fontWeight: '500', color: '#334155' }}>Display</label>
                      <select
                        value={settings.display}
                        onChange={(e) => setSettings({ ...settings, display: e.target.value as any })}
                        style={{ width: '160px', padding: '6px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', backgroundColor: '#ffffff' }}
                      >
                        <option value="Profile">Profile</option>
                        <option value="Bid / Ask">Bid / Ask</option>
                        <option value="Delta">Delta</option>
                        <option value="Total">Total</option>
                      </select>
                    </div>

                    {/* Type */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <label style={{ fontWeight: '500', color: '#334155' }}>Type</label>
                      <select
                        value={settings.type}
                        onChange={(e) => setSettings({ ...settings, type: e.target.value as any })}
                        style={{ width: '160px', padding: '6px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', backgroundColor: '#ffffff' }}
                      >
                        <option value="Buy and sell">Buy and sell</option>
                        <option value="Delta">Delta</option>
                        <option value="Total">Total</option>
                      </select>
                    </div>

                    {/* Apply gradient to background */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <input
                        type="checkbox"
                        id="applyGradient"
                        checked={settings.applyGradient}
                        onChange={(e) => setSettings({ ...settings, applyGradient: e.target.checked })}
                        style={{ width: '16px', height: '16px', accentColor: '#0f172a', cursor: 'pointer' }}
                      />
                      <label htmlFor="applyGradient" style={{ fontWeight: '500', color: '#334155', cursor: 'pointer' }}>
                        Apply gradient to background
                      </label>
                      <Info size={14} style={{ color: '#94a3b8' }} />
                    </div>

                    {/* Sell background color swatches */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingLeft: '24px' }}>
                      <span style={{ color: '#64748b', fontSize: '12px' }}>Sell background</span>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        {['#fca5a5', '#ef4444', '#dc2626', '#991b1b'].map((c) => (
                          <div
                            key={c}
                            onClick={() => setSettings({ ...settings, sellBgColor: c })}
                            style={{
                              width: '20px',
                              height: '20px',
                              borderRadius: '4px',
                              backgroundColor: c,
                              cursor: 'pointer',
                              border: settings.sellBgColor === c ? '2px solid #0f172a' : '1px solid #cbd5e1'
                            }}
                          />
                        ))}
                      </div>
                    </div>

                    {/* Buy background color swatches */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingLeft: '24px' }}>
                      <span style={{ color: '#64748b', fontSize: '12px' }}>Buy background</span>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        {['#5eead4', '#14b8a6', '#0f766e', '#134e4a'].map((c) => (
                          <div
                            key={c}
                            onClick={() => setSettings({ ...settings, buyBgColor: c })}
                            style={{
                              width: '20px',
                              height: '20px',
                              borderRadius: '4px',
                              backgroundColor: c,
                              cursor: 'pointer',
                              border: settings.buyBgColor === c ? '2px solid #0f172a' : '1px solid #cbd5e1'
                            }}
                          />
                        ))}
                      </div>
                    </div>

                    {/* Unfinished auction */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <input
                          type="checkbox"
                          id="unfinishedAuction"
                          checked={settings.unfinishedAuction}
                          onChange={(e) => setSettings({ ...settings, unfinishedAuction: e.target.checked })}
                          style={{ width: '16px', height: '16px', accentColor: '#0f172a', cursor: 'pointer' }}
                        />
                        <label htmlFor="unfinishedAuction" style={{ fontWeight: '500', color: '#334155', cursor: 'pointer' }}>
                          Unfinished auction
                        </label>
                      </div>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <div style={{ width: '20px', height: '20px', borderRadius: '4px', backgroundColor: '#d946ef' }} />
                        <div style={{ width: '20px', height: '20px', borderRadius: '4px', backgroundColor: '#06b6d4' }} />
                        <HelpCircle size={14} style={{ color: '#94a3b8' }} />
                      </div>
                    </div>

                    {/* Value area % */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <input
                          type="checkbox"
                          id="valueAreaEnabled"
                          checked={settings.valueAreaEnabled}
                          onChange={(e) => setSettings({ ...settings, valueAreaEnabled: e.target.checked })}
                          style={{ width: '16px', height: '16px', accentColor: '#0f172a', cursor: 'pointer' }}
                        />
                        <label htmlFor="valueAreaEnabled" style={{ fontWeight: '500', color: '#334155', cursor: 'pointer' }}>
                          Value area
                        </label>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <input
                          type="number"
                          value={settings.valueAreaPercent}
                          onChange={(e) => setSettings({ ...settings, valueAreaPercent: Number(e.target.value) || 70 })}
                          style={{ width: '120px', padding: '6px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                        />
                        <span style={{ fontSize: '13px', color: '#64748b' }}>%</span>
                      </div>
                    </div>

                  </div>
                </div>

                <hr style={{ border: 'none', borderTop: '1px solid #e2e8f0', margin: '4px 0' }} />

                {/* SECTION 2: LABELS */}
                <div>
                  <h3 style={{ fontSize: '11px', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 14px 0' }}>
                    LABELS
                  </h3>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '13px' }}>
                    
                    {/* POC Color */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <input
                          type="checkbox"
                          id="pocEnabled"
                          checked={settings.pocEnabled}
                          onChange={(e) => setSettings({ ...settings, pocEnabled: e.target.checked })}
                          style={{ width: '16px', height: '16px', accentColor: '#0f172a', cursor: 'pointer' }}
                        />
                        <label htmlFor="pocEnabled" style={{ fontWeight: '500', color: '#334155', cursor: 'pointer' }}>
                          POC
                        </label>
                      </div>
                      <div
                        onClick={() => setSettings({ ...settings, pocColor: settings.pocColor === '#000000' ? '#1e293b' : '#000000' })}
                        style={{
                          width: '24px',
                          height: '24px',
                          borderRadius: '4px',
                          backgroundColor: settings.pocColor,
                          border: '1px solid #cbd5e1',
                          cursor: 'pointer'
                        }}
                      />
                    </div>

                    {/* Show summary Info */}
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingTop: '6px' }}>
                        <input
                          type="checkbox"
                          id="showSummaryInfo"
                          checked={settings.showSummaryInfo}
                          onChange={(e) => setSettings({ ...settings, showSummaryInfo: e.target.checked })}
                          style={{ width: '16px', height: '16px', accentColor: '#0f172a', cursor: 'pointer' }}
                        />
                        <label htmlFor="showSummaryInfo" style={{ fontWeight: '500', color: '#334155', cursor: 'pointer' }}>
                          Show summary Info
                        </label>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '200px' }}>
                        <select
                          value={settings.summaryDisplay}
                          onChange={(e) => setSettings({ ...settings, summaryDisplay: e.target.value as any })}
                          style={{ width: '100%', padding: '6px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', backgroundColor: '#ffffff' }}
                        >
                          <option value="Table">Table</option>
                          <option value="Below">Below</option>
                          <option value="Off">Off</option>
                        </select>
                        <select
                          value="all"
                          style={{ width: '100%', padding: '6px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', backgroundColor: '#ffffff' }}
                        >
                          <option value="all">Volume, Delta, Min ...</option>
                        </select>
                      </div>
                    </div>

                  </div>
                </div>

                <hr style={{ border: 'none', borderTop: '1px solid #e2e8f0', margin: '4px 0' }} />

                {/* SECTION 3: IMBALANCE */}
                <div>
                  <h3 style={{ fontSize: '11px', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 14px 0' }}>
                    IMBALANCE
                  </h3>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '13px' }}>
                    
                    {/* Imbalance % */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <label style={{ fontWeight: '500', color: '#334155' }}>Imbalance</label>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <input
                          type="number"
                          value={settings.imbalancePercent}
                          onChange={(e) => setSettings({ ...settings, imbalancePercent: Number(e.target.value) || 300 })}
                          style={{ width: '160px', padding: '6px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                        />
                        <span style={{ fontSize: '13px', color: '#64748b' }}>%</span>
                      </div>
                    </div>

                    {/* Highlighting */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <input
                          type="checkbox"
                          id="imbalanceHighlighting"
                          checked={settings.imbalanceHighlighting}
                          onChange={(e) => setSettings({ ...settings, imbalanceHighlighting: e.target.checked })}
                          style={{ width: '16px', height: '16px', accentColor: '#0f172a', cursor: 'pointer' }}
                        />
                        <label htmlFor="imbalanceHighlighting" style={{ fontWeight: '500', color: '#334155', cursor: 'pointer' }}>
                          Highlighting
                        </label>
                      </div>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <div style={{ width: '20px', height: '20px', borderRadius: '4px', backgroundColor: '#089981' }} />
                        <div style={{ width: '20px', height: '20px', borderRadius: '4px', backgroundColor: '#e23636' }} />
                      </div>
                    </div>

                    {/* Stacked levels */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <input
                          type="checkbox"
                          id="stackedLevelsEnabled"
                          checked={settings.stackedLevelsEnabled}
                          onChange={(e) => setSettings({ ...settings, stackedLevelsEnabled: e.target.checked })}
                          style={{ width: '16px', height: '16px', accentColor: '#0f172a', cursor: 'pointer' }}
                        />
                        <label htmlFor="stackedLevelsEnabled" style={{ fontWeight: '500', color: '#334155', cursor: 'pointer' }}>
                          Stacked levels
                        </label>
                      </div>
                      <input
                        type="number"
                        value={settings.stackedLevelsCount}
                        onChange={(e) => setSettings({ ...settings, stackedLevelsCount: Number(e.target.value) || 3 })}
                        style={{ width: '160px', padding: '6px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', backgroundColor: '#f1f5f9' }}
                      />
                    </div>

                    {/* Minimal volume */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <label style={{ fontWeight: '500', color: '#334155' }}>Minimal volume</label>
                      <input
                        type="number"
                        step="0.1"
                        value={settings.minimalVolume}
                        onChange={(e) => setSettings({ ...settings, minimalVolume: Number(e.target.value) || 0.0 })}
                        style={{ width: '160px', padding: '6px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                      />
                    </div>

                    {/* Ignore zeros */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <input
                        type="checkbox"
                        id="ignoreZeros"
                        checked={settings.ignoreZeros}
                        onChange={(e) => setSettings({ ...settings, ignoreZeros: e.target.checked })}
                        style={{ width: '16px', height: '16px', accentColor: '#0f172a', cursor: 'pointer' }}
                      />
                      <label htmlFor="ignoreZeros" style={{ fontWeight: '500', color: '#334155', cursor: 'pointer' }}>
                        Ignore zeros
                      </label>
                      <Info size={14} style={{ color: '#94a3b8' }} />
                    </div>

                  </div>
                </div>

              </div>
            </div>

            {/* Modal Footer */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: '10px',
              padding: '14px 20px',
              borderTop: '1px solid #e2e8f0',
              backgroundColor: '#ffffff'
            }}>
              <button
                onClick={() => setIsSettingsOpen(false)}
                style={{
                  padding: '8px 16px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  backgroundColor: '#ffffff',
                  color: '#334155',
                  fontSize: '13px',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => setIsSettingsOpen(false)}
                style={{
                  padding: '8px 20px',
                  borderRadius: '6px',
                  border: 'none',
                  backgroundColor: '#2563eb',
                  color: '#ffffff',
                  fontSize: '13px',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                Ok
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
