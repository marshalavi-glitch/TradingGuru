import React, { useState, useEffect, useRef, useMemo } from 'react';
import { getBackendHttpUrl } from '../utils/tvStreamer';
import { groupCandlesByDay, calculateDayProfile, Candle, DayProfile, TPOBin } from '../utils/profileCalculator';
import { resolveSymbol } from '../utils/symbolResolver';
import { 
  RefreshCw, Search, ZoomIn, ZoomOut, Move, BarChart2, TrendingUp, TrendingDown, 
  ShieldAlert, Zap, Sliders, ChevronLeft, ChevronRight, Menu, Maximize2, Layers
} from 'lucide-react';

interface ProMarketProfileContainerProps {
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

function groupCandlesBySessionPeriod(
  candles: Candle[],
  period: 'D' | 'W' | 'W_S' | 'M_S' | 'Y'
): { keys: string[]; grouped: Record<string, Candle[]>; sessionPeriodType: 'daily' | 'weekly' | 'monthly' } {
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
    return { keys: Object.keys(grouped).sort(), grouped, sessionPeriodType: 'monthly' };
  }
  
  return { keys: [], grouped: {}, sessionPeriodType: 'daily' };
}

function getLetterColor(letter: string): string {
  const code = letter.toUpperCase().charCodeAt(0);
  if (code >= 65 && code <= 66) return '#ec4899'; // A-B Initial Balance Pink/Magenta
  if (code >= 67 && code <= 70) return '#3b82f6'; // C-F Morning Blue
  if (code >= 71 && code <= 74) return '#00f0ff'; // G-J Midday Cyan
  if (code >= 75 && code <= 78) return '#8b5cf6'; // K-N Afternoon Purple
  if (code >= 79 && code <= 82) return '#f59e0b'; // O-R Pre-Close Amber
  return '#ef4444'; // S-Z Red
}

export const ProMarketProfileContainer: React.FC<ProMarketProfileContainerProps> = ({
  onSymbolSelect,
  onSwitchToChart
}) => {
  const [symbol, setSymbol] = useState<string>('NSE:NIFTY');
  const [searchInput, setSearchInput] = useState<string>('NSE:NIFTY');
  const [timeframe, setTimeframe] = useState<string>('30');
  const [lookbackDays, setLookbackDays] = useState<number>(12);
  const [sessionPeriod, setSessionPeriod] = useState<'D' | 'W' | 'W_S' | 'M_S' | 'Y'>('D');
  const [viewMode, setViewMode] = useState<'GV' | 'GVN' | 'T' | 'T-V' | 'T/V' | 'V' | 'VN' | 'T-VA' | 'V-VA' | 'H-VA'>('T-V');

  // Customization State
  const [tpoStep, setTpoStep] = useState<number>(4); // TPO Tick step (default 4 as in screenshot)
  const [zoomLevel, setZoomLevel] = useState<number>(1.0);
  const [panOffset, setPanOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  const [candles, setCandles] = useState<Candle[]>([]);
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

  const watchSymbols = [
    { symbol: 'NSE:NIFTY', name: 'NIFTY 50' },
    { symbol: 'NSE:BANKNIFTY', name: 'BANK NIFTY' },
    { symbol: 'NSE:FINNIFTY', name: 'FIN NIFTY' },
    { symbol: 'NSE:RELIANCE', name: 'RELIANCE' },
    { symbol: 'NSE:TCS', name: 'TCS' },
    { symbol: 'NSE:HDFCBANK', name: 'HDFC BANK' },
    { symbol: 'NSE:INFY', name: 'INFOSYS' },
    { symbol: 'NSE:ICICIBANK', name: 'ICICI BANK' }
  ];

  // Fetch candles with auto-retry
  const fetchCandles = async () => {
    setLoading(true);
    setError(null);
    let attempts = 0;
    const maxAttempts = 2;

    while (attempts < maxAttempts) {
      try {
        attempts++;
        const backendHttp = getBackendHttpUrl();
        const resolved = resolveSymbol(symbol);
        const limit = 2000;
        const url = `${backendHttp}/api/candles?symbol=${encodeURIComponent(resolved.formattedSymbol)}&timeframe=${timeframe}&limit=${limit}`;
        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          if (data.candles && data.candles.length > 0) {
            setCandles(data.candles);
            setError(null);
            setLoading(false);
            return;
          }
        }
      } catch (err: any) {
        console.warn(`[ProMarketProfileContainer] Fetch attempt ${attempts} failed:`, err);
      }
      if (attempts < maxAttempts) {
        await new Promise(r => setTimeout(r, 600));
      }
    }

    setError('Connecting to market feed...');
    setLoading(false);
  };

  useEffect(() => {
    fetchCandles();
  }, [symbol, timeframe]);

  // Group candles and build profiles
  const dayProfiles: DayProfile[] = useMemo(() => {
    if (!candles || candles.length === 0) return [];
    const { keys, grouped, sessionPeriodType } = groupCandlesBySessionPeriod(candles, sessionPeriod);
    
    // Slice keys based on session period
    let lookbackLimit = lookbackDays;
    if (sessionPeriod === 'W' || sessionPeriod === 'W_S') {
      lookbackLimit = Math.max(4, Math.ceil(lookbackDays / 3));
    } else if (sessionPeriod === 'M_S') {
      lookbackLimit = Math.max(3, Math.ceil(lookbackDays / 10));
    } else if (sessionPeriod === 'Y') {
      lookbackLimit = Math.max(2, Math.ceil(lookbackDays / 50));
    }
    
    const activeKeys = keys.slice(Math.max(0, keys.length - lookbackLimit));
    
    return activeKeys.map(kStr => {
      return calculateDayProfile(kStr, grouped[kStr], 40, sessionPeriodType, undefined, tpoStep, symbol);
    });
  }, [candles, lookbackDays, sessionPeriod, tpoStep, symbol]);

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

  // Handle Resize
  useEffect(() => {
    const handleResize = () => {
      if (canvasContainerRef.current) {
        setDimensions({
          width: canvasContainerRef.current.clientWidth,
          height: Math.max(600, canvasContainerRef.current.clientHeight)
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

    // Deep Midnight Navy Theme matching Vtrender layout
    const bgColor = '#071326';
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, width, height);

    const padding = { top: 35, bottom: 45, left: 130, right: 75 }; // left 130px for left volume histogram
    const baseChartWidth = width - padding.left - padding.right;
    const baseChartHeight = height - padding.top - padding.bottom;

    // Calculate Global Price Bounds
    let globalMin = Infinity;
    let globalMax = -Infinity;
    dayProfiles.forEach(p => {
      if (p.dayLow < globalMin) globalMin = p.dayLow;
      if (p.dayHigh > globalMax) globalMax = p.dayHigh;
    });

    if (globalMin === Infinity || globalMax === -Infinity || globalMin >= globalMax) return;

    const pMargin = (globalMax - globalMin) * 0.03;
    const rawMin = globalMin - pMargin;
    const rawMax = globalMax + pMargin;
    const rawRange = rawMax - rawMin;

    const centerPrice = (rawMax + rawMin) / 2 - (panOffset.y / baseChartHeight) * rawRange;
    const visibleRange = rawRange / zoomLevel;

    const minPrice = centerPrice - visibleRange / 2;
    const maxPrice = centerPrice + visibleRange / 2;
    const priceRange = maxPrice - minPrice;

    const getPriceY = (price: number) => {
      return padding.top + ((maxPrice - price) / priceRange) * baseChartHeight;
    };

    // 1. Draw Grid Lines & Right Price Scale
    const step = tpoStep > 0 ? tpoStep * 5 : 20;
    const startTick = Math.floor(minPrice / step) * step;
    const endTick = Math.ceil(maxPrice / step) * step;

    ctx.font = '10px "JetBrains Mono", monospace';
    ctx.textAlign = 'left';

    for (let priceTick = startTick; priceTick <= endTick; priceTick += step) {
      const y = getPriceY(priceTick);
      if (y >= padding.top && y <= height - padding.bottom) {
        ctx.strokeStyle = 'rgba(30, 58, 138, 0.4)';
        ctx.lineWidth = 1;
        ctx.setLineDash([2, 4]);
        ctx.beginPath();
        ctx.moveTo(padding.left, y);
        ctx.lineTo(width - padding.right, y);
        ctx.stroke();
        ctx.setLineDash([]);

        // Right Price Scale Label
        ctx.fillStyle = '#60a5fa';
        ctx.fillText(priceTick.toFixed(0), width - padding.right + 6, y + 3);
      }
    }

    // 2. Draw Left Edge Composite Volume Profile Histogram
    if (viewMode.includes('GV') || viewMode.includes('T-V') || viewMode.includes('V')) {
      const leftHistWidth = 110;
      const maxVol = globalVolumeProfile.maxVolume || 1;

      // Vertical separator line between Left Hist and Sessions
      ctx.strokeStyle = '#1e3a8a';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(leftHistWidth + 10, padding.top);
      ctx.lineTo(leftHistWidth + 10, height - padding.bottom);
      ctx.stroke();

      globalVolumeProfile.bins.forEach(bin => {
        const binY = getPriceY(bin.price);
        if (binY >= padding.top && binY <= height - padding.bottom) {
          const barW = (bin.volume / maxVol) * leftHistWidth;
          ctx.fillStyle = 'rgba(16, 185, 129, 0.45)'; // Vibrant Emerald Green
          ctx.fillRect(10, binY - 1, barW, Math.max(1, (priceRange / baseChartHeight) * 10));
        }
      });
    }

    // 3. Render Session Columns
    const sessionCount = dayProfiles.length;
    const colGap = Math.max(4, 10 * zoomLevel);
    const availWidthForCols = baseChartWidth - (sessionCount - 1) * colGap;
    const colWidth = (availWidthForCols / sessionCount) * zoomLevel;

    ctx.save();
    ctx.beginPath();
    ctx.rect(padding.left, padding.top, baseChartWidth, baseChartHeight);
    ctx.clip();

    dayProfiles.forEach((profile, sIdx) => {
      const colStartX = padding.left + panOffset.x + sIdx * (colWidth + colGap);
      const colEndX = colStartX + colWidth;

      if (colEndX < padding.left || colStartX > width - padding.right) return;

      // Top X-Axis Date Label (DD-MM-YYYY)
      const dateHeader = formatDateHeader(profile.dateStr);
      ctx.fillStyle = '#94a3b8';
      ctx.font = 'bold 9px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(dateHeader, colStartX + colWidth / 2, padding.top - 10);

      // Top Vertical Guideline
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(colStartX + colWidth / 2, padding.top - 5);
      ctx.lineTo(colStartX + colWidth / 2, padding.top);
      ctx.stroke();

      // Session separator
      if (sIdx > 0) {
        ctx.strokeStyle = 'rgba(30, 58, 138, 0.5)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(colStartX - colGap / 2, padding.top);
        ctx.lineTo(colStartX - colGap / 2, height - padding.bottom);
        ctx.stroke();
      }

      // Value Area Shading Box (Pink Tint)
      if (profile.vahPrice && profile.valPrice) {
        const vahY = getPriceY(profile.vahPrice);
        const valY = getPriceY(profile.valPrice);
        if (vahY < height - padding.bottom && valY > padding.top) {
          ctx.fillStyle = 'rgba(217, 70, 239, 0.12)';
          ctx.fillRect(colStartX, Math.max(padding.top, vahY), colWidth, Math.min(baseChartHeight, valY - vahY));
        }
      }

      const bins = profile.bins;
      if (bins.length === 0) return;

      const binStep = bins.length > 1 ? Math.abs(bins[0].price - bins[1].price) : profile.tickSize;
      const rawRowHeight = (binStep / priceRange) * baseChartHeight;
      const rowHeight = Math.max(2, rawRowHeight);

      const baseBlockSize = Math.max(2, Math.min(20, rowHeight - 0.5));
      const showLetters = baseBlockSize >= 8 && viewMode !== 'V';
      const blockGap = showLetters ? 1 : 0.5;

      const uniqueLetters = Array.from(new Set(bins.flatMap(b => b.tpos))).sort((a, b) => {
        const getIdx = (l: string) => (l.charCodeAt(0) >= 97 ? l.charCodeAt(0) - 97 + 26 : l.charCodeAt(0) - 65);
        return getIdx(a) - getIdx(b);
      });

      const splitStep = Math.max(8, Math.min(20, colWidth / Math.max(1, uniqueLetters.length)));
      const splitWidth = Math.max(6, splitStep - 1);

      // Render Bins
      bins.forEach(bin => {
        const binY = getPriceY(bin.price) - rowHeight / 2;
        if (binY < padding.top - rowHeight || binY > height - padding.bottom) return;

        const isPoc = bin.price === profile.pocPrice;
        const isIb = bin.price <= profile.ibHigh && bin.price >= profile.ibLow;

        if (viewMode === 'V') {
          // Pure Volume Bar Mode
          const barW = (bin.volume / (profile.totalVolume || 1)) * colWidth * 2;
          ctx.fillStyle = isPoc ? '#10b981' : isIb ? '#d946ef' : '#3b82f6';
          ctx.fillRect(colStartX, binY, Math.min(colWidth, barW), Math.max(1, rowHeight - 0.5));
        } else if (viewMode === 'T/V') {
          // Split View
          bin.tpos.forEach(letter => {
            const uIdx = uniqueLetters.indexOf(letter);
            if (uIdx === -1) return;
            const x = colStartX + uIdx * splitStep;
            if (x + splitWidth <= colEndX) {
              ctx.fillStyle = getLetterColor(letter);
              ctx.fillRect(x, binY, splitWidth, Math.max(1, rowHeight - 0.5));
              if (showLetters) {
                ctx.fillStyle = '#ffffff';
                ctx.font = `bold ${Math.max(7, Math.floor(splitWidth * 0.75))}px "JetBrains Mono", monospace`;
                ctx.textAlign = 'center';
                ctx.fillText(letter, x + splitWidth / 2, binY + rowHeight / 2 + (splitWidth * 0.28));
              }
            }
          });
        } else {
          // Merged TPO View
          if (bin.tpos.length === 0) return;

          if (isPoc) {
            // POC Row Highlight
            ctx.fillStyle = '#10b981'; // Green POC
            ctx.fillRect(colStartX, binY, colWidth * 0.95, Math.max(1, rowHeight));
            ctx.fillStyle = '#000000';
            ctx.font = `bold ${Math.max(8, Math.floor(baseBlockSize * 0.75))}px "JetBrains Mono", monospace`;
            ctx.textAlign = 'center';
            bin.tpos.forEach((letter, colIdx) => {
              const x = colStartX + colIdx * (baseBlockSize + blockGap);
              if (x + baseBlockSize <= colEndX) {
                ctx.fillText(letter, x + baseBlockSize / 2, binY + rowHeight / 2 + (baseBlockSize * 0.28));
              }
            });
          } else {
            let blockBgColor = '#fbbf24'; // Yellow Amber default TPO letters
            if (bin.tpos.includes('A') || bin.tpos.includes('B')) {
              blockBgColor = '#ec4899'; // Initial Balance Pink
            }

            bin.tpos.forEach((letter, colIdx) => {
              const x = colStartX + colIdx * (baseBlockSize + blockGap);
              if (x + baseBlockSize <= colEndX) {
                ctx.fillStyle = blockBgColor;
                ctx.fillRect(x, binY + (rowHeight - baseBlockSize) / 2, baseBlockSize, baseBlockSize);

                ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
                ctx.lineWidth = 0.5;
                ctx.strokeRect(x, binY + (rowHeight - baseBlockSize) / 2, baseBlockSize, baseBlockSize);

                if (showLetters) {
                  ctx.fillStyle = '#0f172a';
                  ctx.font = `bold ${Math.max(8, Math.floor(baseBlockSize * 0.75))}px "JetBrains Mono", monospace`;
                  ctx.textAlign = 'center';
                  ctx.fillText(letter, x + baseBlockSize / 2, binY + rowHeight / 2 + (baseBlockSize * 0.28));
                }
              }
            });
          }
        }
      });

      // Draw VAH and VAL Lines
      if (profile.vahPrice) {
        const vahY = getPriceY(profile.vahPrice);
        if (vahY >= padding.top && vahY <= height - padding.bottom) {
          ctx.strokeStyle = '#d946ef';
          ctx.lineWidth = 1.5;
          ctx.setLineDash([3, 3]);
          ctx.beginPath();
          ctx.moveTo(colStartX, vahY);
          ctx.lineTo(colStartX + colWidth, vahY);
          ctx.stroke();
          ctx.setLineDash([]);
        }
      }

      if (profile.valPrice) {
        const valY = getPriceY(profile.valPrice);
        if (valY >= padding.top && valY <= height - padding.bottom) {
          ctx.strokeStyle = '#c084fc';
          ctx.lineWidth = 1.5;
          ctx.setLineDash([3, 3]);
          ctx.beginPath();
          ctx.moveTo(colStartX, valY);
          ctx.lineTo(colStartX + colWidth, valY);
          ctx.stroke();
          ctx.setLineDash([]);
        }
      }
    });

    ctx.restore();

  }, [dayProfiles, dimensions, viewMode, zoomLevel, panOffset, tpoStep, globalVolumeProfile]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchInput.trim()) {
      const resolved = resolveSymbol(searchInput);
      setSymbol(resolved.formattedSymbol);
      setSearchInput(resolved.formattedSymbol);
      if (onSymbolSelect) onSymbolSelect(resolved.formattedSymbol);
    }
  };

  const handleSelectPreset = (sym: string) => {
    setSymbol(sym);
    setSearchInput(sym);
    if (onSymbolSelect) onSymbolSelect(sym);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%', minHeight: '85vh', background: '#040d1a', color: '#e2e8f0', padding: '10px', borderRadius: '8px', boxSizing: 'border-box' }}>
      
      {/* Top Header Bar Mirroring Vtrender Layout (Cleaned of all external logos) */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#0b192e', padding: '8px 14px', borderRadius: '6px', border: '1px solid #1e3a8a', flexWrap: 'wrap', gap: '10px' }}>
        
        {/* Left Menu & Symbol Selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button style={{ background: 'transparent', border: 'none', color: '#60a5fa', cursor: 'pointer', padding: '2px' }}>
            <Menu size={18} />
          </button>
          
          <form onSubmit={handleSearchSubmit} style={{ display: 'flex', alignItems: 'center', background: '#071326', borderRadius: '4px', border: '1px solid #1e3a8a', padding: '2px 6px' }}>
            <span style={{ fontSize: '12px', fontWeight: '900', color: '#ffffff', marginRight: '6px' }}>{symbol.replace('NSE:', '')}</span>
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Symbol..."
              style={{ background: 'transparent', border: 'none', color: '#60a5fa', fontSize: '11px', outline: 'none', width: '90px' }}
            />
          </form>

          {/* Quick Preset Buttons */}
          <div style={{ display: 'flex', gap: '4px' }}>
            {watchSymbols.slice(0, 4).map(item => (
              <button
                key={item.symbol}
                onClick={() => handleSelectPreset(item.symbol)}
                style={{
                  background: symbol === item.symbol ? '#1d4ed8' : '#071326',
                  color: symbol === item.symbol ? '#ffffff' : '#94a3b8',
                  border: '1px solid #1e3a8a',
                  padding: '3px 8px',
                  borderRadius: '4px',
                  fontSize: '10px',
                  fontWeight: '700',
                  cursor: 'pointer'
                }}
              >
                {item.name}
              </button>
            ))}
          </div>
        </div>

        {/* Center/Right Step & Zoom Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button onClick={fetchCandles} style={{ background: 'transparent', border: 'none', color: '#60a5fa', cursor: 'pointer' }} title="Refresh">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>

          {/* TPO Tick Step Dropdown */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: '#071326', padding: '2px 6px', borderRadius: '4px', border: '1px solid #1e3a8a' }}>
            <span style={{ fontSize: '10px', fontWeight: '800', color: '#94a3b8' }}>TPO</span>
            <select
              value={tpoStep}
              onChange={(e) => setTpoStep(Number(e.target.value))}
              style={{
                background: '#0b192e',
                color: '#60a5fa',
                border: '1px solid #1e3a8a',
                borderRadius: '3px',
                padding: '2px 6px',
                fontSize: '11px',
                fontWeight: '800',
                outline: 'none',
                cursor: 'pointer'
              }}
            >
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 12, 16, 18, 24, 30, 36, 40, 48].map((stepVal) => (
                <option key={stepVal} value={stepVal} style={{ background: '#0b192e', color: '#ffffff' }}>
                  {stepVal}
                </option>
              ))}
            </select>
          </div>

          {/* Zoom Buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: '#071326', padding: '2px 6px', borderRadius: '4px', border: '1px solid #1e3a8a' }}>
            <button onClick={() => setZoomLevel(prev => Math.max(0.4, prev * 0.8))} style={{ background: 'transparent', border: 'none', color: '#60a5fa', cursor: 'pointer', fontWeight: '900' }}>
              -
            </button>
            <span style={{ fontSize: '10px', fontWeight: '800', color: '#00f0ff', padding: '0 4px' }}>
              {Math.round(zoomLevel * 100)}%
            </span>
            <button onClick={() => setZoomLevel(prev => Math.min(5.0, prev * 1.25))} style={{ background: 'transparent', border: 'none', color: '#60a5fa', cursor: 'pointer', fontWeight: '900' }}>
              +
            </button>
          </div>

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

      {/* Main Canvas Viewport */}
      <div 
        ref={canvasContainerRef}
        style={{ 
          position: 'relative', 
          width: '100%', 
          minHeight: '620px', 
          background: '#071326', 
          borderRadius: '6px', 
          border: '1px solid #1e3a8a',
          overflow: 'hidden'
        }}
      >
        {/* Floating Scroll Arrows */}
        <button
          onClick={() => setPanOffset(prev => ({ ...prev, x: prev.x + 240 }))}
          style={{
            position: 'absolute',
            left: '140px',
            top: '50%',
            transform: 'translateY(-50%)',
            zIndex: 15,
            background: 'rgba(11, 25, 46, 0.85)',
            border: '1px solid #1e3a8a',
            color: '#60a5fa',
            padding: '10px 6px',
            borderRadius: '6px',
            cursor: 'pointer'
          }}
          title="Scroll Left"
        >
          <ChevronLeft size={20} />
        </button>

        <button
          onClick={() => setPanOffset(prev => ({ ...prev, x: prev.x - 240 }))}
          style={{
            position: 'absolute',
            right: '85px',
            top: '50%',
            transform: 'translateY(-50%)',
            zIndex: 15,
            background: 'rgba(11, 25, 46, 0.85)',
            border: '1px solid #1e3a8a',
            color: '#60a5fa',
            padding: '10px 6px',
            borderRadius: '6px',
            cursor: 'pointer'
          }}
          title="Scroll Right"
        >
          <ChevronRight size={20} />
        </button>

        <canvas
          ref={canvasRef}
          onMouseDown={(e) => {
            setIsDragging(true);
            setDragStart({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y });
          }}
          onMouseMove={(e) => {
            if (isDragging) {
              setPanOffset({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
            }
          }}
          onMouseUp={() => setIsDragging(false)}
          onMouseLeave={() => setIsDragging(false)}
          style={{ cursor: isDragging ? 'grabbing' : 'grab', display: 'block' }}
        />
      </div>

      {/* Bottom Mode Selector Toolbar (Mirroring Screenshot Layout exactly) */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#0b192e', padding: '8px 12px', borderRadius: '6px', border: '1px solid #1e3a8a', flexWrap: 'wrap', gap: '8px' }}>
        
        {/* Left Side: Period Buttons (D, W, W_S, M_S, Y) */}
        <div style={{ display: 'flex', gap: '3px' }}>
          {(['D', 'W', 'W_S', 'M_S', 'Y'] as const).map(p => (
            <button
              key={p}
              onClick={() => setSessionPeriod(p)}
              style={{
                background: sessionPeriod === p ? '#1d4ed8' : '#071326',
                color: sessionPeriod === p ? '#ffffff' : '#94a3b8',
                border: '1px solid #1e3a8a',
                padding: '4px 10px',
                borderRadius: '3px',
                fontSize: '11px',
                fontWeight: '900',
                cursor: 'pointer'
              }}
            >
              {p}
            </button>
          ))}
        </div>

        {/* Middle: Display View Mode Chips (GV, GVN, T, T-V, T/V, V, VN, T-VA, V-VA, H-VA) */}
        <div style={{ display: 'flex', gap: '3px', flexWrap: 'wrap' }}>
          {(['GV', 'GVN', 'T', 'T-V', 'T/V', 'V', 'VN', 'T-VA', 'V-VA', 'H-VA'] as const).map(m => (
            <button
              key={m}
              onClick={() => setViewMode(m)}
              style={{
                background: viewMode === m ? '#1d4ed8' : '#071326',
                color: viewMode === m ? '#ffffff' : '#94a3b8',
                border: '1px solid #1e3a8a',
                padding: '4px 8px',
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
            style={{ background: '#071326', border: '1px solid #1e3a8a', color: '#00f0ff', padding: '4px 10px', borderRadius: '3px', fontSize: '10px', fontWeight: '800', cursor: 'pointer' }}
          >
            RESET PAN
          </button>
        </div>

      </div>

    </div>
  );
};
