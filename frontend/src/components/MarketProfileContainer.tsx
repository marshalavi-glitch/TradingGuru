import React, { useState, useEffect, useRef, useMemo } from 'react';
import { getBackendHttpUrl } from '../utils/tvStreamer';
import { groupCandlesByDay, calculateDayProfile, Candle, DayProfile, TPOBin } from '../utils/profileCalculator';
import { RefreshCw, Search, ZoomIn, ZoomOut, Maximize2, Move, BarChart2, TrendingUp, TrendingDown, ShieldAlert } from 'lucide-react';

interface MarketProfileContainerProps {
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

export const MarketProfileContainer: React.FC<MarketProfileContainerProps> = ({
  onSymbolSelect,
  onSwitchToChart
}) => {
  const [symbol, setSymbol] = useState<string>('NSE:NIFTY');
  const [searchInput, setSearchInput] = useState<string>('NSE:NIFTY');
  const [timeframe, setTimeframe] = useState<string>('30'); // 30m default for standard TPO
  const [lookbackDays, setLookbackDays] = useState<number>(10);
  const [profileMode, setProfileMode] = useState<'tpo-collapsed' | 'tpo-split' | 'volume'>('tpo-collapsed');
  const [theme, setTheme] = useState<'dark-slate' | 'dark'>('dark-slate');

  // Interactive Zoom & Pan State
  const [zoomLevel, setZoomLevel] = useState<number>(1.0);
  const [panOffset, setPanOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  const [candles, setCandles] = useState<Candle[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 620 });
  const [hoverInfo, setHoverInfo] = useState<{
    profile: DayProfile;
    bin: TPOBin;
    x: number;
    y: number;
  } | null>(null);

  const watchSymbols = [
    { symbol: 'NSE:NIFTY', name: 'NIFTY 50' },
    { symbol: 'NSE:BANKNIFTY', name: 'BANK NIFTY' },
    { symbol: 'NSE:FINNIFTY', name: 'FIN NIFTY' },
    { symbol: 'NSE:RELIANCE', name: 'Reliance Ind.' },
    { symbol: 'NSE:HDFCBANK', name: 'HDFC Bank' },
    { symbol: 'NSE:ICICIBANK', name: 'ICICI Bank' },
    { symbol: 'NSE:INFY', name: 'Infosys' },
    { symbol: 'NSE:TCS', name: 'TCS' },
    { symbol: 'NSE:SBIN', name: 'State Bank of India' }
  ];

  // Fetch candles
  const fetchCandles = async (sym: string, tf: string) => {
    setLoading(true);
    setError(null);
    try {
      const backendHttp = getBackendHttpUrl();
      const res = await fetch(`${backendHttp}/api/candles?symbol=${encodeURIComponent(sym)}&timeframe=${tf}&limit=2000`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data.candles && data.candles.length > 0) {
        setCandles(data.candles);
      } else {
        setCandles([]);
        setError('No candle data available for this symbol.');
      }
    } catch (err: any) {
      console.error('[MarketProfileContainer] Fetch error:', err);
      setError(err.message || 'Failed to fetch historical market profile data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCandles(symbol, timeframe);
  }, [symbol, timeframe]);

  // Compute daily profiles sorted chronologically
  const dayProfiles: DayProfile[] = useMemo(() => {
    if (!candles || candles.length === 0) return [];
    const grouped = groupCandlesByDay(candles);
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
    return profiles;
  }, [candles, lookbackDays, symbol]);

  // Resize canvas container listener
  useEffect(() => {
    const handleResize = () => {
      if (canvasContainerRef.current) {
        setDimensions({
          width: canvasContainerRef.current.clientWidth,
          height: Math.max(540, canvasContainerRef.current.clientHeight || 620)
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

  // Reset zoom & pan when symbol, timeframe, or lookback changes
  useEffect(() => {
    setZoomLevel(1.0);
    setPanOffset({ x: 0, y: 0 });
  }, [symbol, timeframe, lookbackDays]);

  // Handle Mouse Wheel Zooming
  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.15 : 0.85;
    setZoomLevel((prev) => Math.min(5.0, Math.max(0.4, prev * zoomFactor)));
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

  // Multi-session Canvas Renderer with Dynamic Zoom, Pan & TPO Letter Rendering
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

    const isDarkSlate = theme === 'dark-slate';
    const bgColor = isDarkSlate ? '#181c27' : '#0d1017';
    const gridLineColor = isDarkSlate ? 'rgba(255, 255, 255, 0.05)' : 'rgba(255, 255, 255, 0.03)';
    const textColor = isDarkSlate ? '#94a3b8' : '#6b7280';

    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, width, height);

    const padding = { top: 40, bottom: 40, left: 15, right: 75 };
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

    // Zoom centers around middle price unless panned
    const centerPrice = (rawMax + rawMin) / 2 - (panOffset.y / baseChartHeight) * rawRange;
    const visibleRange = rawRange / zoomLevel;

    const minPrice = centerPrice - visibleRange / 2;
    const maxPrice = centerPrice + visibleRange / 2;
    const priceRange = maxPrice - minPrice;

    const getPriceY = (price: number) => {
      return padding.top + ((maxPrice - price) / priceRange) * baseChartHeight;
    };

    // Draw horizontal grid lines & Right Y-Axis Price Scale
    const numTicks = Math.max(6, Math.floor(12 * zoomLevel));
    const tickStep = priceRange / numTicks;

    ctx.font = '10px "JetBrains Mono", monospace';
    ctx.textAlign = 'left';

    for (let i = 0; i <= numTicks; i++) {
      const priceTick = minPrice + i * tickStep;
      const y = getPriceY(priceTick);

      if (y >= padding.top && y <= height - padding.bottom) {
        // Grid line
        ctx.strokeStyle = gridLineColor;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(padding.left, y);
        ctx.lineTo(width - padding.right, y);
        ctx.stroke();

        // Price tick label on right Y axis
        ctx.fillStyle = textColor;
        ctx.fillText(priceTick.toFixed(1), width - padding.right + 8, y + 3.5);
      }
    }

    // Vertical Y-axis border
    ctx.strokeStyle = isDarkSlate ? 'rgba(255, 255, 255, 0.1)' : 'rgba(255, 255, 255, 0.06)';
    ctx.beginPath();
    ctx.moveTo(width - padding.right, padding.top);
    ctx.lineTo(width - padding.right, height - padding.bottom);
    ctx.stroke();

    // Render session columns side by side with panOffset.x support
    const sessionCount = dayProfiles.length;
    const colGap = Math.max(4, 8 * zoomLevel);
    const availWidthForCols = baseChartWidth - (sessionCount - 1) * colGap;
    const colWidth = (availWidthForCols / sessionCount) * zoomLevel;

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

      // Session X-axis date label
      const dateLabel = formatDateShort(profile.dateStr);
      ctx.fillStyle = isDarkSlate ? '#cbd5e1' : '#9ca3af';
      ctx.font = `bold ${Math.max(9, Math.min(13, 11 * Math.sqrt(zoomLevel)))}px "Outfit", sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(dateLabel, colStartX + colWidth / 2, height - padding.bottom + 20);

      // Light column background highlight
      ctx.fillStyle = isDarkSlate ? 'rgba(255, 255, 255, 0.015)' : 'rgba(255, 255, 255, 0.01)';
      ctx.fillRect(colStartX, padding.top, colWidth, baseChartHeight);

      // Session separator vertical line
      if (sIdx > 0) {
        ctx.strokeStyle = isDarkSlate ? 'rgba(255, 255, 255, 0.06)' : 'rgba(255, 255, 255, 0.03)';
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(colStartX - colGap / 2, padding.top);
        ctx.lineTo(colStartX - colGap / 2, height - padding.bottom);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // Value Area Shading Box (subtle background box between VAH and VAL)
      if (profile.vahPrice && profile.valPrice) {
        const vahY = getPriceY(profile.vahPrice);
        const valY = getPriceY(profile.valPrice);
        if (vahY < height - padding.bottom && valY > padding.top) {
          ctx.fillStyle = 'rgba(168, 85, 247, 0.05)';
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
      bins.forEach(b => {
        if (b.tpos.length > maxTpoCountInBin) maxTpoCountInBin = b.tpos.length;
        if (b.volume > maxVolInBin) maxVolInBin = b.volume;
      });

      // Determine block size & whether to show TPO letter text inside blocks
      const baseBlockSize = Math.max(2, Math.min(22, (rowHeight - 0.5)));
      const showLetters = baseBlockSize >= 9 && profileMode !== 'volume';
      const blockGap = showLetters ? 1 : 0.5;

      // Render TPOs or Volume per price bin
      bins.forEach((bin) => {
        const binY = getPriceY(bin.price) - rowHeight / 2;
        if (binY < padding.top - rowHeight || binY > height - padding.bottom) return;

        const isPoc = bin.price === profile.pocPrice;
        const isAbovePoc = bin.price > profile.pocPrice;

        if (profileMode === 'volume') {
          // Volume Profile bars
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
        } else {
          // TPO Block Distribution
          const tpoCount = bin.tpos.length;
          if (tpoCount === 0) return;

          if (isPoc) {
            // Solid BLACK row background for POC level (exact match to TradingView screenshot)
            const pocLabelWidth = showLetters ? 36 : 28;
            const pocRowWidth = Math.min(colWidth * 0.98, tpoCount * (baseBlockSize + blockGap) + pocLabelWidth);
            
            ctx.fillStyle = '#000000';
            ctx.fillRect(colStartX, binY - 0.5, pocRowWidth, Math.max(rowHeight + 1, baseBlockSize + 1));

            // Left text badge: POC ▶
            ctx.fillStyle = '#ffffff';
            ctx.font = `bold ${Math.max(7, Math.min(10, baseBlockSize * 0.75))}px "JetBrains Mono", monospace`;
            ctx.textAlign = 'left';
            ctx.fillText('POC ▶', colStartX + 2, binY + rowHeight / 2 + (baseBlockSize * 0.28));

            // Draw POC TPO blocks in solid black row with crisp white letters inside
            bin.tpos.forEach((letter, colIdx) => {
              const x = colStartX + pocLabelWidth + colIdx * (baseBlockSize + blockGap);
              if (x + baseBlockSize <= colEndX) {
                // Individual block border/fill
                ctx.fillStyle = '#111111';
                ctx.fillRect(x, binY + (rowHeight - baseBlockSize) / 2, baseBlockSize, baseBlockSize);
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
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
            // Upper TPOs: Red/Pink square blocks. Lower TPOs: Emerald Green square blocks
            const blockBgColor = isAbovePoc ? '#e23636' : '#089981';

            bin.tpos.forEach((letter, colIdx) => {
              const x = colStartX + colIdx * (baseBlockSize + blockGap);
              if (x + baseBlockSize <= colEndX) {
                ctx.fillStyle = blockBgColor;
                ctx.fillRect(x, binY + (rowHeight - baseBlockSize) / 2, baseBlockSize, baseBlockSize);

                if (showLetters) {
                  // Subtle border between blocks
                  ctx.strokeStyle = 'rgba(0, 0, 0, 0.15)';
                  ctx.lineWidth = 0.5;
                  ctx.strokeRect(x, binY + (rowHeight - baseBlockSize) / 2, baseBlockSize, baseBlockSize);

                  // White bold TPO letter inside block (A, B, C, D, E, F, G, H, I, J, K, L, M...)
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

      // Overlay horizontal dotted purple VAH & VAL lines
      const drawMarkerLine = (price: number, label: string, color: string) => {
        const lineY = getPriceY(price);
        if (lineY < padding.top || lineY > height - padding.bottom) return;

        ctx.strokeStyle = color;
        ctx.lineWidth = 1.2;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(colStartX, lineY);
        ctx.lineTo(colEndX, lineY);
        ctx.stroke();
        ctx.setLineDash([]);

        // Label on left of line
        ctx.fillStyle = color;
        ctx.font = 'bold 9px "JetBrains Mono", monospace';
        ctx.textAlign = 'left';
        ctx.fillText(`${label} ▶`, colStartX + 2, lineY - 2);
      };

      if (profile.vahPrice) drawMarkerLine(profile.vahPrice, 'VAH', '#a855f7');
      if (profile.valPrice) drawMarkerLine(profile.valPrice, 'VAL', '#a855f7');
    });

    ctx.restore(); // Restore clipping region

  }, [dayProfiles, dimensions, profileMode, theme, zoomLevel, panOffset]);

  // Canvas Mouse Move Handler for Hover Tooltip & Panning Drag
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isDragging) {
      setPanOffset({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      });
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas || dayProfiles.length === 0) return;

    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const padding = { top: 40, bottom: 40, left: 15, right: 75 };
    const baseChartWidth = rect.width - padding.left - padding.right;
    const baseChartHeight = rect.height - padding.top - padding.bottom;

    if (mouseY < padding.top || mouseY > rect.height - padding.bottom || mouseX < padding.left || mouseX > rect.width - padding.right) {
      setHoverInfo(null);
      return;
    }

    const sessionCount = dayProfiles.length;
    const colGap = Math.max(4, 8 * zoomLevel);
    const availWidthForCols = baseChartWidth - (sessionCount - 1) * colGap;
    const colWidth = (availWidthForCols / sessionCount) * zoomLevel;

    // Find hovered session index
    let hoveredSessionIdx = -1;
    for (let i = 0; i < sessionCount; i++) {
      const colStartX = padding.left + panOffset.x + i * (colWidth + colGap);
      if (mouseX >= colStartX && mouseX <= colStartX + colWidth) {
        hoveredSessionIdx = i;
        break;
      }
    }

    if (hoveredSessionIdx === -1) {
      setHoverInfo(null);
      return;
    }

    const profile = dayProfiles[hoveredSessionIdx];
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
    const visibleRange = rawRange / zoomLevel;

    const minPrice = centerPrice - visibleRange / 2;
    const maxPrice = centerPrice + visibleRange / 2;
    const priceRange = maxPrice - minPrice;

    const clickPct = (mouseY - padding.top) / baseChartHeight;
    const hoveredPrice = maxPrice - clickPct * priceRange;

    // Find closest bin
    let closestBin: TPOBin | null = null;
    let minDiff = Infinity;
    profile.bins.forEach(b => {
      const diff = Math.abs(b.price - hoveredPrice);
      if (diff < minDiff) {
        minDiff = diff;
        closestBin = b;
      }
    });

    if (closestBin) {
      setHoverInfo({
        profile,
        bin: closestBin,
        x: mouseX + 15,
        y: mouseY
      });
    } else {
      setHoverInfo(null);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchInput.trim()) {
      let formatted = searchInput.trim().toUpperCase();
      if (!formatted.includes(':')) {
        formatted = `NSE:${formatted}`;
      }
      setSymbol(formatted);
    }
  };

  return (
    <div className="glass-panel animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '16px', width: '100%', padding: '16px', boxSizing: 'border-box' }}>
      
      {/* Controls Toolbar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', background: 'rgba(15, 23, 42, 0.6)', padding: '12px 16px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
        
        {/* Preset Symbols & Search */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
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
                  width: '130px'
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

          <div style={{ height: '20px', width: '1px', backgroundColor: 'rgba(255,255,255,0.1)' }}></div>

          {/* Quick preset buttons */}
          <div style={{ display: 'flex', gap: '4px' }}>
            {watchSymbols.map((item) => (
              <button
                key={item.symbol}
                onClick={() => {
                  setSymbol(item.symbol);
                  setSearchInput(item.symbol);
                }}
                style={{
                  background: symbol === item.symbol ? 'rgba(59, 130, 246, 0.25)' : 'rgba(255, 255, 255, 0.04)',
                  border: symbol === item.symbol ? '1px solid #3b82f6' : '1px solid transparent',
                  color: symbol === item.symbol ? '#60a5fa' : 'var(--text-secondary)',
                  padding: '4px 8px',
                  borderRadius: '4px',
                  fontSize: '11px',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                {item.name}
              </button>
            ))}
          </div>
        </div>

        {/* Timeframe & Lookback & Zoom Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          
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

          {/* Lookback Days */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(0,0,0,0.3)', padding: '2px', borderRadius: '6px' }}>
            {[5, 10, 15, 30].map((days) => (
              <button
                key={days}
                onClick={() => setLookbackDays(days)}
                style={{
                  background: lookbackDays === days ? '#8b5cf6' : 'transparent',
                  color: lookbackDays === days ? 'white' : 'var(--text-secondary)',
                  border: 'none',
                  padding: '4px 8px',
                  borderRadius: '4px',
                  fontSize: '11px',
                  fontWeight: '700',
                  cursor: 'pointer'
                }}
              >
                {days}D
              </button>
            ))}
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
                cursor: 'pointer'
              }}
            >
              TPO Letters
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
                cursor: 'pointer'
              }}
            >
              Volume Profile
            </button>
          </div>

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

      {/* Chart Canvas Area */}
      <div 
        ref={canvasContainerRef} 
        style={{ 
          position: 'relative', 
          width: '100%', 
          minHeight: '620px', 
          backgroundColor: theme === 'dark-slate' ? '#181c27' : '#0d1017', 
          borderRadius: '8px', 
          border: '1px solid var(--border-color)',
          overflow: 'hidden'
        }}
      >
        {/* Navigation / Zoom hint overlay */}
        <div style={{ position: 'absolute', top: '10px', left: '15px', zIndex: 5, display: 'flex', alignItems: 'center', gap: '8px', pointerEvents: 'none', background: 'rgba(15, 23, 42, 0.7)', padding: '4px 10px', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.08)' }}>
          <Move size={12} style={{ color: '#00f0ff' }} />
          <span style={{ fontSize: '10px', color: '#94a3b8', fontWeight: '600' }}>
            Scroll wheel to Zoom In/Out | Drag to Pan | Double-click to Reset
          </span>
        </div>

        {loading && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(15, 23, 42, 0.8)', zIndex: 10 }}>
            <RefreshCw size={28} className="animate-spin" style={{ color: '#00f0ff', marginBottom: '12px' }} />
            <span style={{ fontSize: '14px', color: 'white', fontWeight: '600' }}>Calculating Multi-Session TPO Market Profiles...</span>
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
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onDoubleClick={handleDoubleClick}
          style={{ cursor: isDragging ? 'grabbing' : 'grab', display: 'block' }}
        />

        {/* Hover Tooltip */}
        {hoverInfo && !isDragging && (
          <div
            style={{
              position: 'absolute',
              top: `${hoverInfo.y}px`,
              left: `${hoverInfo.x}px`,
              transform: 'translateY(-50%)',
              backgroundColor: 'rgba(15, 23, 42, 0.95)',
              border: '1px solid rgba(0, 240, 255, 0.4)',
              borderRadius: '6px',
              padding: '10px 14px',
              pointerEvents: 'none',
              zIndex: 100,
              boxShadow: '0 8px 24px rgba(0, 0, 0, 0.5)',
              fontSize: '11px',
              color: 'white',
              minWidth: '190px'
            }}
          >
            <div style={{ fontWeight: 'bold', color: '#00f0ff', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '4px', marginBottom: '6px' }}>
              📅 Session: {formatDateShort(hoverInfo.profile.dateStr)} ({hoverInfo.profile.dateStr})
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Price Bin:</span>
              <span style={{ fontWeight: 'bold', color: 'white' }}>{hoverInfo.bin.price.toFixed(2)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
              <span style={{ color: 'var(--text-secondary)' }}>TPOs:</span>
              <span style={{ fontWeight: 'bold', color: '#f59e0b' }}>{hoverInfo.bin.tpos.length} ({hoverInfo.bin.tpos.join('')})</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Volume:</span>
              <span style={{ fontWeight: 'bold', color: '#3b82f6' }}>{Math.round(hoverInfo.bin.volume).toLocaleString()}</span>
            </div>
            {hoverInfo.bin.price === hoverInfo.profile.pocPrice && (
              <div style={{ color: '#000', backgroundColor: '#00f0ff', fontWeight: 'bold', fontSize: '9px', textAlign: 'center', padding: '2px 4px', borderRadius: '3px', marginTop: '6px', textTransform: 'uppercase' }}>
                ⭐ Point of Control (POC)
              </div>
            )}
            {hoverInfo.bin.price === hoverInfo.profile.vahPrice && (
              <div style={{ color: '#a855f7', fontWeight: 'bold', fontSize: '9px', marginTop: '4px' }}>
                🟣 Value Area High (VAH)
              </div>
            )}
            {hoverInfo.bin.price === hoverInfo.profile.valPrice && (
              <div style={{ color: '#a855f7', fontWeight: 'bold', fontSize: '9px', marginTop: '4px' }}>
                🟣 Value Area Low (VAL)
              </div>
            )}
          </div>
        )}
      </div>

      {/* Analytics & Session Statistics Table */}
      <div style={{ background: 'rgba(15, 23, 42, 0.6)', borderRadius: '8px', border: '1px solid var(--border-color)', padding: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <BarChart2 size={16} style={{ color: '#00f0ff' }} />
            <span style={{ fontSize: '14px', fontWeight: '700', color: 'white' }}>Session Market Profile Analytics</span>
            <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>({dayProfiles.length} Daily Sessions)</span>
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
                <th style={{ padding: '8px 12px', color: '#00f0ff' }}>POC</th>
                <th style={{ padding: '8px 12px', color: '#a855f7' }}>VAH</th>
                <th style={{ padding: '8px 12px', color: '#a855f7' }}>VAL</th>
                <th style={{ padding: '8px 12px' }}>Total TPOs</th>
                <th style={{ padding: '8px 12px' }}>Structure / Bias</th>
              </tr>
            </thead>
            <tbody>
              {dayProfiles.map((p, idx) => {
                const isBullish = p.closePrice >= p.openPrice;
                const priceChange = p.closePrice - p.openPrice;
                const changePct = p.openPrice ? ((priceChange / p.openPrice) * 100).toFixed(2) : '0.00';

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
                    <td style={{ padding: '8px 12px', color: '#a855f7' }}>{p.vahPrice.toFixed(2)}</td>
                    <td style={{ padding: '8px 12px', color: '#a855f7' }}>{p.valPrice.toFixed(2)}</td>
                    <td style={{ padding: '8px 12px', color: '#f59e0b', fontWeight: '600' }}>{p.totalTPOs}</td>
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

    </div>
  );
};
