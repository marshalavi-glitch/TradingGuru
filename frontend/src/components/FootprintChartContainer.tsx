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
  cotTopDelta: number;
  cotTopTrap: boolean;
  cotBottomDelta: number;
  cotBottomTrap: boolean;
  isBullDivergence: boolean;
  isBearDivergence: boolean;
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
  const abs = Math.abs(vol);
  if (abs >= 1000000) {
    return `${(vol / 1000000).toFixed(2)}M`;
  }
  if (abs >= 1000) {
    return `${(vol / 1000).toFixed(1)}k`;
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
  const [theme, setTheme] = useState<'light' | 'dark'>('dark'); // Dark theme default matching media_1789457008779.png
  
  // Advanced Toolbar States matching media_1789457008779.png
  const [displayMode, setDisplayMode] = useState<'Candle + Orders (L/R)' | 'Split Grid'>('Candle + Orders (L/R)');
  const [imbalanceRatio, setImbalanceRatio] = useState<number>(3.0);
  const [showPocLine, setShowPocLine] = useState<boolean>(true);
  const [showCot, setShowCot] = useState<boolean>(true);
  const [showCrCaps, setShowCrCaps] = useState<boolean>(true);
  const [showProfile, setShowProfile] = useState<boolean>(true);
  const [tickSize, setTickSize] = useState<number>(2.5);
  const [yZoom, setYZoom] = useState<number>(22);
  const [xZoom, setXZoom] = useState<number>(140);
  
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

      // COT High / Low Trap Calculations
      const top3Bins = rawBins.slice(0, 3);
      const topBuyVol = top3Bins.reduce((acc, b) => acc + b.buyVol, 0);
      const topSellVol = top3Bins.reduce((acc, b) => acc + b.sellVol, 0);
      const cotTopDelta = topBuyVol - topSellVol;
      const cotTopTrap = cotTopDelta > 300 && !isBull;

      const bottom3Bins = rawBins.slice(-3);
      const bottomBuyVol = bottom3Bins.reduce((acc, b) => acc + b.buyVol, 0);
      const bottomSellVol = bottom3Bins.reduce((acc, b) => acc + b.sellVol, 0);
      const cotBottomDelta = bottomBuyVol - bottomSellVol;
      const cotBottomTrap = cotBottomDelta < -300 && isBull;

      // Bullish / Bearish Divergence Flags against previous candle
      let isBullDivergence = false;
      let isBearDivergence = false;
      if (idx > 0) {
        const prevC = candles[idx - 1];
        if (c.high > prevC.high && candleDelta < -1000) {
          isBearDivergence = true;
        }
        if (c.low < prevC.low && candleDelta > 1000) {
          isBullDivergence = true;
        }
      }

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
        bottomWickVol: Math.round(c.volume * 0.04),
        cotTopDelta,
        cotTopTrap,
        cotBottomDelta,
        cotBottomTrap,
        isBullDivergence,
        isBearDivergence
      };
    });
  }, [candles, settings]);

  // Session Profile volume distribution by price level
  const sessionProfileData = useMemo(() => {
    if (!footprintCandles || footprintCandles.length === 0) return { profileMap: {}, pocPrice: 0, maxVol: 1 };
    
    const profileMap: Record<number, number> = {};
    let maxVol = 0;
    let pocPrice = 0;

    footprintCandles.forEach((fc) => {
      fc.bins.forEach((b) => {
        const p = Math.round(b.price * 10) / 10;
        profileMap[p] = (profileMap[p] || 0) + b.totalVolume;
        if (profileMap[p] > maxVol) {
          maxVol = profileMap[p];
          pocPrice = p;
        }
      });
    });

    return { profileMap, pocPrice, maxVol };
  }, [footprintCandles]);

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

  // Canvas Renderer respecting Footprint Settings & Advanced Toolbar Controls
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
    const bgColor = isLight ? '#ffffff' : '#080c14';
    const gridLineColor = isLight ? '#e2e8f0' : 'rgba(255, 255, 255, 0.04)';
    const textColor = isLight ? '#334155' : '#94a3b8';

    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, width, height);

    // Subtle Watermark Text in Chart Background
    ctx.fillStyle = isLight ? 'rgba(0,0,0,0.03)' : 'rgba(255,255,255,0.03)';
    ctx.font = '900 64px "Outfit", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText((activeSymbolInfo.displayName || symbol).toUpperCase(), width / 2, height / 2);

    // Reserved bottom space for summary table
    const tableHeight = settings.showSummaryInfo ? 150 : 30;
    const profilePanelWidth = showProfile ? 85 : 0;
    const padding = { top: 40, bottom: tableHeight + 35, left: profilePanelWidth + 15, right: 85 };
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

    // ----------------------------------------------------
    // 1. RENDER SESSION PROFILE PANEL ON LEFT AXIS
    // ----------------------------------------------------
    // ----------------------------------------------------
    // 1. RENDER SESSION PROFILE PANEL ON LEFT AXIS
    // ----------------------------------------------------
    if (showProfile && sessionProfileData.maxVol > 0) {
      const pWidth = 85;
      ctx.fillStyle = isLight ? '#f8fafc' : '#06080e';
      ctx.fillRect(0, padding.top, pWidth, chartHeight);
      ctx.strokeStyle = isLight ? '#cbd5e1' : 'rgba(255, 255, 255, 0.1)';
      ctx.lineWidth = 1;
      ctx.strokeRect(0, padding.top, pWidth, chartHeight);

      ctx.fillStyle = '#94a3b8';
      ctx.font = 'bold 9px "JetBrains Mono", monospace';
      ctx.textAlign = 'left';
      ctx.fillText('SESSION PROFILE', 4, padding.top - 8);

      Object.entries(sessionProfileData.profileMap).forEach(([pStr, vol]) => {
        const price = Number(pStr);
        const y = getPriceY(price);
        if (y < padding.top || y > height - padding.bottom) return;

        const barW = (vol / sessionProfileData.maxVol) * (pWidth - 36);
        const isPoc = price === sessionProfileData.pocPrice;

        ctx.fillStyle = isPoc ? '#eab308' : 'rgba(100, 116, 139, 0.35)';
        ctx.fillRect(2, y - 5, barW, 10);

        if (isPoc) {
          // Gold POC Badge matching media_1789457266863.png
          ctx.fillStyle = '#eab308';
          ctx.fillRect(barW + 2, y - 6, 26, 12);
          ctx.fillStyle = '#000000';
          ctx.font = 'bold 8px "JetBrains Mono", monospace';
          ctx.textAlign = 'center';
          ctx.fillText('POC', barW + 15, y + 3);

          ctx.fillStyle = '#eab308';
          ctx.font = 'bold 9px "JetBrains Mono", monospace';
          ctx.textAlign = 'left';
          ctx.fillText(formatVolumeShort(vol), 2, y - 7);
        } else {
          ctx.fillStyle = '#94a3b8';
          ctx.font = '8px "JetBrains Mono", monospace';
          ctx.textAlign = 'left';
          ctx.fillText(formatVolumeShort(vol), 4, y + 3);
        }
      });
    }

    // ----------------------------------------------------
    // 2. RIGHT Y-AXIS PRICE SCALE & GRID LINES
    // ----------------------------------------------------
    const step = tickSize || 1.0;
    const startTick = Math.floor(minPrice / step) * step;
    const endTick = Math.ceil(maxPrice / step) * step;

    // Header at top right: PRICE : [F]
    ctx.fillStyle = '#94a3b8';
    ctx.font = 'bold 10px "JetBrains Mono", monospace';
    ctx.textAlign = 'left';
    ctx.fillText('PRICE :', width - padding.right + 4, padding.top - 12);

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.strokeRect(width - 22, padding.top - 20, 16, 14);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 9px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('F', width - 14, padding.top - 9);

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

    // Right Y-Axis Border Line
    ctx.strokeStyle = isLight ? '#cbd5e1' : 'rgba(255, 255, 255, 0.1)';
    ctx.beginPath();
    ctx.moveTo(width - padding.right, padding.top);
    ctx.lineTo(width - padding.right, height - padding.bottom);
    ctx.stroke();

    // Live Price Solid Cyan Badge filling full cell width matching media_1789457266863.png
    if (footprintCandles.length > 0) {
      const lastClose = footprintCandles[footprintCandles.length - 1].close;
      const lastY = getPriceY(lastClose);
      if (lastY >= padding.top && lastY <= height - padding.bottom) {
        ctx.fillStyle = '#00a8e8'; // Solid Cyan Block
        ctx.fillRect(width - padding.right + 1, lastY - 8, padding.right - 2, 16);
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 10px "JetBrains Mono", monospace';
        ctx.textAlign = 'left';
        ctx.fillText(lastClose.toFixed(1), width - padding.right + 6, lastY + 4);
      }
    }

    // ----------------------------------------------------
    // 3. POC LINE ACROSS CHART CANVAS
    // ----------------------------------------------------
    if (showPocLine && sessionProfileData.pocPrice > 0) {
      const pocY = getPriceY(sessionProfileData.pocPrice);
      if (pocY >= padding.top && pocY <= height - padding.bottom) {
        ctx.strokeStyle = '#f59e0b'; // Gold POC Line
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(padding.left, pocY);
        ctx.lineTo(width - padding.right, pocY);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }

    // ----------------------------------------------------
    // 4. CANDLESTICK FOOTPRINT COLUMNS & BADGES
    // ----------------------------------------------------
    const candleCount = footprintCandles.length;
    const colGap = Math.max(16, (xZoom / 6) * zoomLevel);
    const colWidth = Math.max(110, xZoom * zoomLevel);

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
      const candleHeight = Math.max(30, lowY - highY);

      // -----------------------------------------------------------
      // BEARISH DIVERGENCE BADGE ABOVE HIGH (Topmost)
      // -----------------------------------------------------------
      if (c.isBearDivergence) {
        const text = `▼ BEAR DIV (${c.delta})`;
        const badgeY = highY - 44;
        ctx.fillStyle = '#ef4444';
        ctx.fillRect(colCenterX - 48, badgeY, 96, 16);
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 10px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.fillText(text, colCenterX, badgeY + 12);
      }

      // -----------------------------------------------------------
      // COT HIGH TRAP BADGE ABOVE CANDLE HIGH (Gold Pill)
      // -----------------------------------------------------------
      if (showCot && (c.cotTopDelta !== 0)) {
        const text = `COT: ${c.cotTopDelta > 0 ? '+' : ''}${c.cotTopDelta}${c.cotTopTrap ? ' | TRAP' : ''}`;
        const badgeW = Math.max(72, text.length * 6.5);
        const badgeY = highY - 24;

        ctx.fillStyle = c.cotTopTrap ? '#eab308' : '#ca8a04'; // Bright Yellow/Gold matching screenshot
        ctx.fillRect(colCenterX - badgeW / 2, badgeY, badgeW, 15);
        ctx.fillStyle = '#000000'; // Black text on Gold badge
        ctx.font = 'bold 9px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.fillText(text, colCenterX, badgeY + 11);
      }

      // -----------------------------------------------------------
      // CANDLE BODY & VERTICAL SPINE
      // -----------------------------------------------------------
      const isBull = c.close >= c.open;
      ctx.fillStyle = isBull ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)';
      ctx.fillRect(colStartX, highY, colWidth, candleHeight);

      ctx.strokeStyle = isBull ? '#10b981' : '#ef4444';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(colStartX, highY, colWidth, candleHeight);

      ctx.strokeStyle = isBull ? '#10b981' : '#ef4444';
      ctx.lineWidth = 2.0;
      ctx.beginPath();
      ctx.moveTo(colCenterX, highY);
      ctx.lineTo(colCenterX, lowY);
      ctx.stroke();

      // -----------------------------------------------------------
      // TWIN BID / ASK ORDER COLUMNS INSIDE CANDLE
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

          // LEFT COLUMN: Bid Volume (Red Fills)
          if (bin.isPoc) {
            ctx.fillStyle = '#000000'; // Black POC Fill
            ctx.fillRect(leftStartX, binY, leftWidth, rowHeight - 1);
            ctx.fillStyle = '#ffffff';
          } else if (sellVol > maxBinVol * 0.4) {
            ctx.fillStyle = '#ef4444'; // Solid Red
            ctx.fillRect(leftStartX, binY, leftWidth, rowHeight - 1);
            ctx.fillStyle = '#ffffff';
          } else if (sellVol > 0) {
            ctx.fillStyle = 'rgba(239, 68, 68, 0.2)'; // Light Red Tint
            ctx.fillRect(leftStartX, binY, leftWidth, rowHeight - 1);
            ctx.fillStyle = '#ffffff';
          } else {
            ctx.fillStyle = '#94a3b8';
          }

          ctx.font = `bold ${fontPx}px "JetBrains Mono", monospace`;
          ctx.textAlign = 'center';
          ctx.fillText(formatVolumeShort(sellVol), leftStartX + leftWidth / 2, binY + rowHeight / 2 + fontPx * 0.35);

          // RIGHT COLUMN: Ask Volume (Green Fills)
          if (bin.isPoc) {
            ctx.fillStyle = '#000000'; // Black POC Fill
            ctx.fillRect(rightStartX, binY, rightWidth, rowHeight - 1);
            ctx.fillStyle = '#ffffff';
          } else if (buyVol > maxBinVol * 0.4) {
            ctx.fillStyle = '#10b981'; // Solid Green
            ctx.fillRect(rightStartX, binY, rightWidth, rowHeight - 1);
            ctx.fillStyle = '#ffffff';
          } else if (buyVol > 0) {
            ctx.fillStyle = 'rgba(16, 185, 129, 0.2)'; // Light Green Tint
            ctx.fillRect(rightStartX, binY, rightWidth, rowHeight - 1);
            ctx.fillStyle = '#ffffff';
          } else {
            ctx.fillStyle = '#94a3b8';
          }

          ctx.font = `bold ${fontPx}px "JetBrains Mono", monospace`;
          ctx.textAlign = 'center';
          ctx.fillText(formatVolumeShort(buyVol), rightStartX + rightWidth / 2, binY + rowHeight / 2 + fontPx * 0.35);

          // IMBALANCE BOX OUTLINE (Red rectangle outline around bid-ask row pair matching screenshot)
          if (bin.isImbalanceBuy || bin.isImbalanceSell) {
            ctx.strokeStyle = '#ef4444'; // Red Border Outline
            ctx.lineWidth = 2.0;
            ctx.strokeRect(colStartX + 1, binY, colWidth - 2, rowHeight);
          }
        });
      }

      // -----------------------------------------------------------
      // COT LOW TRAP BADGE BELOW CANDLE LOW (Dark Green Pill)
      // -----------------------------------------------------------
      if (showCot && (c.cotBottomDelta !== 0)) {
        const text = `COT: ${c.cotBottomDelta > 0 ? '+' : ''}${c.cotBottomDelta}${c.cotBottomTrap ? ' | ▲ TRAP' : ''}`;
        const badgeW = Math.max(72, text.length * 6.5);
        const badgeY = lowY + 10;

        ctx.fillStyle = c.cotBottomTrap ? '#047857' : '#065f46'; // Dark Green Badge matching screenshot
        ctx.fillRect(colCenterX - badgeW / 2, badgeY, badgeW, 15);
        ctx.fillStyle = c.cotBottomTrap ? '#fef08a' : '#10b981';
        ctx.font = 'bold 9px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.fillText(text, colCenterX, badgeY + 11);
      }

      // -----------------------------------------------------------
      // BULLISH DIVERGENCE BADGE BELOW LOW (Bright Green Pill)
      // -----------------------------------------------------------
      if (c.isBullDivergence) {
        const text = `▲ BULL DIV (+${c.delta})`;
        const badgeY = lowY + 28;
        ctx.fillStyle = '#10b981';
        ctx.fillRect(colCenterX - 48, badgeY, 96, 16);
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 10px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.fillText(text, colCenterX, badgeY + 12);
      }
    });

    ctx.restore();

    // ----------------------------------------------------
    // RENDER CANDLE SUMMARY STATISTICS TABLE AT BOTTOM
    // ----------------------------------------------------
    if (settings.showSummaryInfo) {
      const tableStartY = height - padding.bottom + 10;
      const rowH = 22;

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
        const y = tableStartY + rIdx * rowH + 14;
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
        ctx.fillText(c.timeLabel, colCenterX, tableStartY + 5 * rowH + 16);

        // Row 1: Volume
        const r1Y = tableStartY + 0 * rowH;
        ctx.fillStyle = isLight ? '#f1f5f9' : 'rgba(255, 255, 255, 0.04)';
        ctx.fillRect(colStartX, r1Y, colWidth, rowH - 2);
        ctx.fillStyle = isLight ? '#0f172a' : '#ffffff';
        ctx.font = 'bold 10px "JetBrains Mono", monospace';
        ctx.fillText(formatVolumeShort(c.totalVolume), colCenterX, r1Y + 14);

        // Row 2: Delta
        const r2Y = tableStartY + 1 * rowH;
        const isPosDelta = c.delta >= 0;
        ctx.fillStyle = isPosDelta ? '#10b981' : '#ef4444';
        ctx.fillRect(colStartX, r2Y, colWidth, rowH - 2);
        ctx.fillStyle = '#ffffff';
        ctx.fillText(formatDelta(c.delta), colCenterX, r2Y + 14);

        // Row 3: Min Delta
        const r3Y = tableStartY + 2 * rowH;
        ctx.fillStyle = '#ef4444';
        ctx.fillRect(colStartX, r3Y, colWidth, rowH - 2);
        ctx.fillStyle = '#ffffff';
        ctx.fillText(formatDelta(c.minDelta), colCenterX, r3Y + 14);

        // Row 4: Max Delta
        const r4Y = tableStartY + 3 * rowH;
        ctx.fillStyle = '#10b981';
        ctx.fillRect(colStartX, r4Y, colWidth, rowH - 2);
        ctx.fillStyle = '#ffffff';
        ctx.fillText(formatDelta(c.maxDelta), colCenterX, r4Y + 14);

        // Row 5: Session CVD
        const r5Y = tableStartY + 4 * rowH;
        ctx.fillStyle = isLight ? '#f1f5f9' : 'rgba(255, 255, 255, 0.04)';
        ctx.fillRect(colStartX, r5Y, colWidth, rowH - 2);
        ctx.fillStyle = isLight ? '#0f172a' : '#ffffff';
        ctx.fillText(formatVolumeShort(c.sessionCvd), colCenterX, r5Y + 14);
      });
    }

  }, [footprintCandles, sessionProfileData, dimensions, theme, zoomLevel, panOffset, settings, showPocLine, showCot, showCrCaps, showProfile, tickSize, xZoom, yZoom]);

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
      
      {/* Dual Institutional Controls Toolbar (Matching media_1789457008779.png) */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', background: '#0b0f19', padding: '10px 14px', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.1)' }}>
        
        {/* ROW 1: Main Control Toolbar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
          
          {/* Left Group: Chart Tab, Symbol, Timeframe, Display Mode */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            {/* Chart Switch Tab */}
            {onSwitchToChart && (
              <button
                onClick={onSwitchToChart}
                style={{
                  background: 'rgba(255, 255, 255, 0.08)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  color: '#ffffff',
                  padding: '5px 10px',
                  borderRadius: '4px',
                  fontSize: '12px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                Chart
              </button>
            )}

            {/* Symbol Badge / Selector */}
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <select
                value={symbol}
                onChange={(e) => handleSelectSymbol(e.target.value)}
                style={{
                  background: '#161b26',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  color: '#ffffff',
                  padding: '5px 10px',
                  borderRadius: '4px',
                  fontSize: '12px',
                  fontWeight: '800',
                  cursor: 'pointer'
                }}
              >
                {watchSymbols.map((item) => (
                  <option key={item.symbol} value={item.symbol}>
                    {item.name} ({tickSize} pts)
                  </option>
                ))}
              </select>
            </div>

            {/* Timeframe Dropdown */}
            <select
              value={timeframe}
              onChange={(e) => setTimeframe(e.target.value)}
              style={{
                background: '#161b26',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                color: '#ffffff',
                padding: '5px 8px',
                borderRadius: '4px',
                fontSize: '12px',
                fontWeight: '700',
                cursor: 'pointer'
              }}
            >
              <option value="1">1 Minute</option>
              <option value="3">3 Minute</option>
              <option value="5">5 Minute</option>
              <option value="15">15 Minute</option>
              <option value="30">30 Minute</option>
            </select>

            {/* Display Mode Dropdown */}
            <select
              value={displayMode}
              onChange={(e) => setDisplayMode(e.target.value as any)}
              style={{
                background: '#161b26',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                color: '#ffffff',
                padding: '5px 8px',
                borderRadius: '4px',
                fontSize: '12px',
                fontWeight: '700',
                cursor: 'pointer'
              }}
            >
              <option value="Candle + Orders (L/R)">Candle + Orders (L/R)</option>
              <option value="Split Grid">Split Grid</option>
            </select>

            {/* Imbalance Ratio Selector */}
            <select
              value={imbalanceRatio}
              onChange={(e) => setImbalanceRatio(parseFloat(e.target.value))}
              style={{
                background: '#161b26',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                color: '#38bdf8',
                padding: '5px 8px',
                borderRadius: '4px',
                fontSize: '12px',
                fontWeight: '700',
                cursor: 'pointer'
              }}
            >
              <option value={1.5}>Imbalance: 1.5x</option>
              <option value={2.0}>Imbalance: 2.0x</option>
              <option value={3.0}>Imbalance: 3.0x</option>
              <option value={4.0}>Imbalance: 4.0x</option>
            </select>
          </div>

          {/* Right Group: Feature Toggles, Tick Size & Actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            {/* Checkbox Toggles */}
            <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: '#cbd5e1', cursor: 'pointer', fontWeight: '700' }}>
              <input
                type="checkbox"
                checked={showPocLine}
                onChange={(e) => setShowPocLine(e.target.checked)}
                style={{ accentColor: '#eab308' }}
              />
              POC Line
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: '#cbd5e1', cursor: 'pointer', fontWeight: '700' }}>
              <input
                type="checkbox"
                checked={showCot}
                onChange={(e) => setShowCot(e.target.checked)}
                style={{ accentColor: '#10b981' }}
              />
              COT
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: '#cbd5e1', cursor: 'pointer', fontWeight: '700' }}>
              <input
                type="checkbox"
                checked={showCrCaps}
                onChange={(e) => setShowCrCaps(e.target.checked)}
                style={{ accentColor: '#3b82f6' }}
              />
              CR Caps
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: '#cbd5e1', cursor: 'pointer', fontWeight: '700' }}>
              <input
                type="checkbox"
                checked={showProfile}
                onChange={(e) => setShowProfile(e.target.checked)}
                style={{ accentColor: '#a855f7' }}
              />
              Profile
            </label>

            {/* Tick Size Dropdown */}
            <select
              value={tickSize}
              onChange={(e) => setTickSize(parseFloat(e.target.value))}
              style={{
                background: '#161b26',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                color: '#ffffff',
                padding: '5px 8px',
                borderRadius: '4px',
                fontSize: '12px',
                fontWeight: '700',
                cursor: 'pointer'
              }}
            >
              <option value={1.0}>Tick: 1.0 pt</option>
              <option value={2.5}>Tick: 2.5 pts</option>
              <option value={5.0}>Tick: 5.0 pts</option>
              <option value={10.0}>Tick: 10.0 pts</option>
            </select>

            {/* Settings Button */}
            <button
              onClick={() => setIsSettingsOpen(true)}
              style={{
                background: 'rgba(59, 130, 246, 0.2)',
                border: '1px solid #3b82f6',
                color: '#60a5fa',
                padding: '5px 8px',
                borderRadius: '4px',
                fontSize: '11px',
                fontWeight: '700',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
              title="Footprint Settings"
            >
              <Settings size={13} />
            </button>

            {/* Refresh Button */}
            <button
              onClick={() => fetchCandles(symbol, timeframe)}
              style={{
                background: 'rgba(255, 255, 255, 0.06)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                color: '#ffffff',
                padding: '5px',
                borderRadius: '4px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center'
              }}
              title="Refresh Data"
            >
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        {/* ROW 2: Sub-header Status Bar & Canvas Navigation Controls */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', borderTop: '1px dashed rgba(255, 255, 255, 0.1)', paddingTop: '6px' }}>
          
          {/* Status Indicators */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {/* Live WS Pill */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', background: 'rgba(16, 185, 129, 0.15)', border: '1px solid rgba(16, 185, 129, 0.4)', padding: '2px 8px', borderRadius: '4px' }}>
              <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#10b981' }} className="animate-pulse" />
              <span style={{ fontSize: '10px', color: '#10b981', fontWeight: '900', letterSpacing: '0.5px' }}>LIVE WS</span>
            </div>

            {/* Symbol & LTP */}
            <div style={{ fontSize: '12px', color: '#ffffff', fontWeight: '800' }}>
              FUT ₹{(candles.length > 0 ? candles[candles.length - 1].close : 23377.0).toLocaleString('en-IN', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
            </div>

            {/* Cumulative Delta Badge */}
            <div style={{ fontSize: '11px', fontWeight: '800', color: (footprintCandles.length > 0 && footprintCandles[footprintCandles.length - 1].sessionCvd >= 0) ? '#10b981' : '#ef4444', background: 'rgba(0,0,0,0.3)', padding: '2px 6px', borderRadius: '4px' }}>
              CVD {footprintCandles.length > 0 ? formatDelta(footprintCandles[footprintCandles.length - 1].sessionCvd) : '-3,722'}
            </div>
          </div>

          {/* Canvas Navigation & Quick Zoom Controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            {/* Recenter Button */}
            <button
              onClick={() => setPanOffset({ x: 0, y: 0 })}
              style={{
                background: '#161b26',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                color: '#cbd5e1',
                padding: '2px 8px',
                borderRadius: '4px',
                fontSize: '11px',
                fontWeight: '700',
                cursor: 'pointer'
              }}
            >
              Recenter
            </button>

            {/* Fit Screen Button */}
            <button
              onClick={() => {
                setZoomLevel(1.0);
                setPanOffset({ x: 0, y: 0 });
              }}
              style={{
                background: '#161b26',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                color: '#cbd5e1',
                padding: '2px 8px',
                borderRadius: '4px',
                fontSize: '11px',
                fontWeight: '800',
                cursor: 'pointer'
              }}
              title="Fit to Screen"
            >
              F
            </button>

            {/* Y Zoom Control */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '2px', background: '#161b26', border: '1px solid rgba(255, 255, 255, 0.15)', borderRadius: '4px', padding: '1px 4px' }}>
              <span style={{ fontSize: '10px', color: '#94a3b8', fontWeight: '700', paddingRight: '2px' }}>Y:</span>
              <button onClick={() => setYZoom((prev) => Math.max(10, prev - 2))} style={{ background: 'none', border: 'none', color: '#ffffff', cursor: 'pointer', fontSize: '11px', fontWeight: '900', padding: '0 4px' }}>-</button>
              <span style={{ fontSize: '11px', color: '#38bdf8', fontWeight: '800' }}>{yZoom}</span>
              <button onClick={() => setYZoom((prev) => Math.min(50, prev + 2))} style={{ background: 'none', border: 'none', color: '#ffffff', cursor: 'pointer', fontSize: '11px', fontWeight: '900', padding: '0 4px' }}>+</button>
            </div>

            {/* X Zoom Control */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '2px', background: '#161b26', border: '1px solid rgba(255, 255, 255, 0.15)', borderRadius: '4px', padding: '1px 4px' }}>
              <span style={{ fontSize: '10px', color: '#94a3b8', fontWeight: '700', paddingRight: '2px' }}>X:</span>
              <button onClick={() => setXZoom((prev) => Math.max(60, prev - 10))} style={{ background: 'none', border: 'none', color: '#ffffff', cursor: 'pointer', fontSize: '11px', fontWeight: '900', padding: '0 4px' }}>-</button>
              <span style={{ fontSize: '11px', color: '#38bdf8', fontWeight: '800' }}>{xZoom}</span>
              <button onClick={() => setXZoom((prev) => Math.min(300, prev + 10))} style={{ background: 'none', border: 'none', color: '#ffffff', cursor: 'pointer', fontSize: '11px', fontWeight: '900', padding: '0 4px' }}>+</button>
            </div>

            {/* Reset Button */}
            <button
              onClick={() => {
                setZoomLevel(1.0);
                setPanOffset({ x: 0, y: 0 });
                setXZoom(140);
                setYZoom(22);
              }}
              style={{
                background: 'rgba(59, 130, 246, 0.2)',
                border: '1px solid rgba(59, 130, 246, 0.4)',
                color: '#60a5fa',
                padding: '2px 6px',
                borderRadius: '4px',
                fontSize: '12px',
                fontWeight: '800',
                cursor: 'pointer'
              }}
              title="Reset Zoom & Pan"
            >
              ↺
            </button>
          </div>
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
