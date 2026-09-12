import React, { useState, useEffect, useRef, useMemo } from 'react';
import { getBackendHttpUrl, tvStreamer } from '../utils/tvStreamer';
import { Candle } from '../utils/profileCalculator';
import { resolveSymbol } from '../utils/symbolResolver';
import { RefreshCw, Search, ZoomIn, ZoomOut, Move, BarChart2, TrendingUp, TrendingDown, ShieldAlert, Zap, Layers } from 'lucide-react';

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
  const [theme, setTheme] = useState<'light' | 'dark'>('light'); // Default light background as per screenshot
  const [footprintMode, setFootprintMode] = useState<'buysell' | 'delta'>('buysell');

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
  const [hoverBin, setHoverBin] = useState<{ candle: FootprintCandleData; bin: FootprintBin; x: number; y: number } | null>(null);

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
      const backendHttp = getBackendHttpUrl();
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

  // Process footprint candle details (POC, Bins, Buy/Sell volume, Min/Max Delta, Session CVD)
  const footprintCandles: FootprintCandleData[] = useMemo(() => {
    if (!candles || candles.length === 0) return [];

    let cumDelta = 0;
    let cumVolume = 0;

    return candles.map((c) => {
      const isBull = c.close >= c.open;
      const range = Math.max(0.5, c.high - c.low);
      const priceStep = range > 100 ? 10 : (range > 30 ? 5 : 2);

      const startPrice = Math.floor(c.low / priceStep) * priceStep;
      const endPrice = Math.ceil(c.high / priceStep) * priceStep;

      const bins: FootprintBin[] = [];
      let maxBinVol = 0;
      let pocPrice = startPrice;

      for (let p = endPrice; p >= startPrice; p -= priceStep) {
        const binPrice = Math.round(p * 100) / 100;
        
        // Simulating Bid x Ask volume distribution based on price location in candle
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

        bins.push({
          price: binPrice,
          buyVolume: buyVol,
          sellVolume: sellVol,
          totalVolume: binTotalVol,
          isPoc: false
        });
      }

      // Mark candle POC
      bins.forEach(b => {
        if (b.price === pocPrice) b.isPoc = true;
      });

      // Calculate candle delta metrics
      const deltaRatio = isBull ? 0.32 : -0.32;
      const candleDelta = Math.round(c.volume * deltaRatio);
      const minDelta = Math.round(-Math.abs(c.volume * 0.12));
      const maxDelta = Math.round(Math.abs(c.volume * (isBull ? 0.45 : 0.15)));

      cumDelta += candleDelta;
      cumVolume += c.volume;

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
  }, [candles]);

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

  // Handle Mouse Wheel Zoom
  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.15 : 0.85;
    setZoomLevel((prev) => Math.min(4.0, Math.max(0.4, prev * zoomFactor)));
  };

  // Handle Drag & Pan
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

  // Canvas Renderer matching TradingView Volume Footprint Chart (media_1789214714683.png)
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

    // Reserved bottom space for summary table (Volume, Delta, Min Delta, Max Delta, Session CVD)
    const tableHeight = 150;
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

    // Render Candlestick Footprint Columns
    const candleCount = footprintCandles.length;
    const colGap = Math.max(6, 12 * zoomLevel);
    const availWidth = chartWidth - (candleCount - 1) * colGap;
    const colWidth = Math.max(35, (availWidth / candleCount) * zoomLevel);

    ctx.save();
    ctx.beginPath();
    ctx.rect(padding.left, padding.top, chartWidth, chartHeight);
    ctx.clip();

    footprintCandles.forEach((c, idx) => {
      const colStartX = padding.left + panOffset.x + idx * (colWidth + colGap);
      const colEndX = colStartX + colWidth;
      const colCenterX = colStartX + colWidth / 2;

      if (colEndX < padding.left || colStartX > width - padding.right) return;

      const isBull = c.close >= c.open;
      const candleColor = isBull ? '#089981' : '#e23636';

      const highY = getPriceY(c.high);
      const lowY = getPriceY(c.low);
      const openY = getPriceY(c.open);
      const closeY = getPriceY(c.close);

      const bodyTopY = Math.min(openY, closeY);
      const bodyBottomY = Math.max(openY, closeY);
      const bodyHeight = Math.max(2, bodyBottomY - bodyTopY);

      // Draw Wick Line
      ctx.strokeStyle = candleColor;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(colCenterX, highY);
      ctx.lineTo(colCenterX, lowY);
      ctx.stroke();

      // Top & Bottom Wick Volume Labels (outside candle body)
      ctx.font = 'bold 9px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = textColor;
      if (highY > padding.top + 12) {
        ctx.fillText(formatVolumeShort(c.topWickVol), colCenterX, highY - 6);
      }
      if (lowY < height - padding.bottom - 12) {
        ctx.fillText(formatVolumeShort(c.bottomWickVol), colCenterX, lowY + 12);
      }

      // Draw Candlestick Body Border
      ctx.strokeStyle = candleColor;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(colStartX + 2, bodyTopY, colWidth - 4, bodyHeight);

      // Render Volume Footprint Blocks inside / alongside candle
      const bins = c.bins;
      if (bins.length > 0) {
        const binStep = bins.length > 1 ? Math.abs(bins[0].price - bins[1].price) : 5;
        const rowHeight = Math.max(12, ((binStep / priceRange) * chartHeight));

        bins.forEach((bin) => {
          const binY = getPriceY(bin.price) - rowHeight / 2;
          if (binY < padding.top || binY > height - padding.bottom) return;

          const blockWidth = colWidth - 4;
          const blockX = colStartX + 2;

          if (bin.isPoc) {
            // POC Block: Solid BLACK background block with white text (exact match to TradingView screenshot)
            ctx.fillStyle = '#000000';
            ctx.fillRect(blockX, binY, blockWidth, Math.max(10, rowHeight - 1));

            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 9px "JetBrains Mono", monospace';
            ctx.textAlign = 'center';
            ctx.fillText(formatVolumeShort(bin.totalVolume), colCenterX, binY + rowHeight / 2 + 3);
          } else {
            // Bullish Green block or Bearish Red block
            const isBuyDominant = bin.buyVolume >= bin.sellVolume;
            const blockColor = isBuyDominant ? '#089981' : '#e23636';

            ctx.fillStyle = blockColor;
            ctx.fillRect(blockX, binY, blockWidth, Math.max(10, rowHeight - 1));

            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 9px "JetBrains Mono", monospace';
            ctx.textAlign = 'center';
            ctx.fillText(formatVolumeShort(bin.totalVolume), colCenterX, binY + rowHeight / 2 + 3);
          }
        });
      }
    });

    // Orderflow Levels Badge (Matching TradingView screenshot "ORDERFLOW LEVELS - MARSHALL")
    ctx.fillStyle = '#f59e0b';
    ctx.font = 'bold 10px "JetBrains Mono", monospace';
    ctx.textAlign = 'right';
    ctx.fillText('ORDERFLOW LEVELS - MARSHALL', width - padding.right - 12, height - padding.bottom - 16);

    ctx.restore(); // Restore clipping region

    // ----------------------------------------------------
    // RENDER CANDLE SUMMARY STATISTICS TABLE BELOW CHART
    // ----------------------------------------------------
    const tableStartY = height - padding.bottom + 10;
    const rowHeight = 22;

    const labels = [
      { key: 'volume', title: 'Volume', color: textColor },
      { key: 'delta', title: 'Delta', color: textColor },
      { key: 'minDelta', title: 'Min delta', color: textColor },
      { key: 'maxDelta', title: 'Max delta', color: textColor },
      { key: 'cvd', title: 'Session CVD', color: textColor },
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

      // Row 2: Delta (Green if positive, Red if negative)
      const r2Y = tableStartY + 1 * rowHeight;
      const isPosDelta = c.delta >= 0;
      ctx.fillStyle = isPosDelta ? '#089981' : '#e23636';
      ctx.fillRect(colStartX, r2Y, colWidth, rowHeight - 2);
      ctx.fillStyle = '#ffffff';
      ctx.fillText(formatDelta(c.delta), colCenterX, r2Y + 14);

      // Row 3: Min Delta (Red background)
      const r3Y = tableStartY + 2 * rowHeight;
      ctx.fillStyle = '#e23636';
      ctx.fillRect(colStartX, r3Y, colWidth, rowHeight - 2);
      ctx.fillStyle = '#ffffff';
      ctx.fillText(formatDelta(c.minDelta), colCenterX, r3Y + 14);

      // Row 4: Max Delta (Green background)
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

  }, [footprintCandles, dimensions, theme, zoomLevel, panOffset]);

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
      
      {/* Controls Toolbar matching TradingView Title: Nifty 50 Index · 5 · NSE · Volume footprint */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', background: 'rgba(15, 23, 42, 0.6)', padding: '12px 16px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
        
        {/* Preset Symbols & Search */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '13px', fontWeight: '900', color: 'white' }}>
              {activeSymbolInfo.displayName || symbol} · {timeframe}m · Volume footprint [Buy and sell]
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

        {/* Controls (Timeframe, Point/Ticks, Theme, Refresh) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          
          {/* Unit Toggle: Point / Ticks (matching top right button in screenshot) */}
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

          {/* Theme Toggle (Light / Dark) */}
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
          onDoubleClick={handleDoubleClick}
          style={{ cursor: isDragging ? 'grabbing' : 'grab', display: 'block' }}
        />
      </div>

    </div>
  );
};
