import React, { useState, useEffect, useRef, useMemo } from 'react';
import { getBackendHttpUrl } from '../utils/tvStreamer';
import { groupCandlesByDay, calculateDayProfile, Candle, DayProfile, TPOBin } from '../utils/profileCalculator';
import { resolveSymbol } from '../utils/symbolResolver';
import { RefreshCw, Search, ZoomIn, ZoomOut, Move, BarChart2, TrendingUp, TrendingDown, ShieldAlert, Zap, Sliders } from 'lucide-react';

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

function formatDayNumber(dateStr: string): string {
  const parts = dateStr.split('-');
  if (parts.length < 3) return dateStr;
  return parseInt(parts[2], 10).toString();
}

export const MarketProfileContainer: React.FC<MarketProfileContainerProps> = ({
  onSymbolSelect,
  onSwitchToChart
}) => {
  const [symbol, setSymbol] = useState<string>('NSE:NIFTY1!');
  const [searchInput, setSearchInput] = useState<string>('NSE:NIFTY1!');
  const [symbolCategory, setSymbolCategory] = useState<'futures' | 'indices' | 'all'>('futures');
  const [timeframe, setTimeframe] = useState<string>('30'); // 30m default for standard TPO
  const [lookbackDays, setLookbackDays] = useState<number>(10);
  const [profileMode, setProfileMode] = useState<'tpo-collapsed' | 'tpo-split' | 'volume'>('tpo-collapsed');
  const [theme, setTheme] = useState<'dark-slate' | 'dark'>('dark-slate');

  // Customization Options
  const [gridStep, setGridStep] = useState<number>(20); // 20 points price step as requested
  const [highlightSinglePrints, setHighlightSinglePrints] = useState<boolean>(true);
  const [showIbLine, setShowIbLine] = useState<boolean>(true);
  const [extendPocMode, setExtendPocMode] = useState<'untested_only' | 'all' | 'none'>('untested_only');

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
  const [dimensions, setDimensions] = useState({ width: 0, height: 640 });
  const [hoverInfo, setHoverInfo] = useState<{
    profile: DayProfile;
    bin: TPOBin;
    x: number;
    y: number;
    isSinglePrint?: boolean;
  } | null>(null);

  const watchSymbols = [
    // Futures Contracts
    { symbol: 'NSE:NIFTY1!', name: 'NIFTY FUT', category: 'futures' },
    { symbol: 'NSE:BANKNIFTY1!', name: 'BANK NIFTY FUT', category: 'futures' },
    { symbol: 'NSE:FINNIFTY1!', name: 'FIN NIFTY FUT', category: 'futures' },
    { symbol: 'NSE:RELIANCE1!', name: 'RELIANCE FUT', category: 'futures' },
    { symbol: 'MCX:CRUDEOIL1!', name: 'CRUDE OIL FUT', category: 'futures' },
    { symbol: 'MCX:NATURALGAS1!', name: 'NAT GAS FUT', category: 'futures' },
    { symbol: 'MCX:GOLD1!', name: 'GOLD FUT', category: 'futures' },

    // Indices / Spot
    { symbol: 'NSE:NIFTY', name: 'NIFTY 50 Spot', category: 'indices' },
    { symbol: 'NSE:BANKNIFTY', name: 'BANK NIFTY Spot', category: 'indices' },
    { symbol: 'NSE:FINNIFTY', name: 'FIN NIFTY Spot', category: 'indices' },
    { symbol: 'BSE:SENSEX', name: 'SENSEX', category: 'indices' }
  ];

  const filteredSymbols = useMemo(() => {
    if (symbolCategory === 'all') return watchSymbols;
    return watchSymbols.filter(s => s.category === symbolCategory);
  }, [symbolCategory]);

  const activeSymbolInfo = useMemo(() => {
    return resolveSymbol(symbol);
  }, [symbol]);

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
        setError('No candle data available for this contract.');
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

  // Resize canvas container listener
  useEffect(() => {
    const handleResize = () => {
      if (canvasContainerRef.current) {
        setDimensions({
          width: canvasContainerRef.current.clientWidth,
          height: Math.max(560, canvasContainerRef.current.clientHeight || 640)
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

    const isDarkSlate = theme === 'dark-slate';
    const bgColor = isDarkSlate ? '#181c27' : '#0d1017';
    const gridLineColor = isDarkSlate ? 'rgba(255, 255, 255, 0.06)' : 'rgba(255, 255, 255, 0.04)';
    const textColor = isDarkSlate ? '#94a3b8' : '#6b7280';

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
    const visibleRange = rawRange / zoomLevel;

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
      bins.forEach(b => {
        if (b.tpos.length > maxTpoCountInBin) maxTpoCountInBin = b.tpos.length;
        if (b.volume > maxVolInBin) maxVolInBin = b.volume;
      });

      const baseBlockSize = Math.max(2, Math.min(22, (rowHeight - 0.5)));
      const showLetters = baseBlockSize >= 9 && profileMode !== 'volume';
      const blockGap = showLetters ? 1 : 0.5;

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

      // VAH & VAL Reference Lines
      const drawLocalMarkerLine = (price: number, label: string, color: string) => {
        const lineY = getPriceY(price);
        if (lineY < padding.top || lineY > height - padding.bottom) return;

        ctx.strokeStyle = color;
        ctx.lineWidth = 1.2;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(colStartX, lineY);
        ctx.lineTo(width - padding.right, lineY);
        ctx.stroke();
        ctx.setLineDash([]);

        const labelText = `${label} ▶`;
        ctx.font = 'bold 9px "JetBrains Mono", monospace';
        const txtWidth = ctx.measureText(labelText).width;

        ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
        ctx.fillRect(colStartX - txtWidth - 4, lineY - 6, txtWidth + 4, 12);

        ctx.fillStyle = color;
        ctx.textAlign = 'right';
        ctx.fillText(labelText, colStartX - 2, lineY + 3);
      };

      if (profile.vahPrice) drawLocalMarkerLine(profile.vahPrice, 'VAH', '#000000');
      if (profile.valPrice) drawLocalMarkerLine(profile.valPrice, 'VAL', '#000000');
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

    ctx.restore(); // Restore clipping region

  }, [dayProfiles, dimensions, profileMode, theme, zoomLevel, panOffset, gridStep, highlightSinglePrints, showIbLine, extendPocMode, pocTestStatusMap]);

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

    const padding = { top: 40, bottom: 45, left: 20, right: 75 };
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
        y: mouseY,
        isSinglePrint: closestBin.tpos.length === 1
      });
    } else {
      setHoverInfo(null);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchInput.trim()) {
      const resolved = resolveSymbol(searchInput);
      setSymbol(resolved.formattedSymbol);
      setSearchInput(resolved.formattedSymbol);
      if (onSymbolSelect) {
        onSymbolSelect(resolved.formattedSymbol);
      }
    }
  };

  const handleSelectSymbol = (sym: string) => {
    setSymbol(sym);
    setSearchInput(sym);
    if (onSymbolSelect) {
      onSymbolSelect(sym);
    }
  };

  const isFuturesContract = symbol.endsWith('1!') || activeSymbolInfo.type === 'futures';

  return (
    <div className="glass-panel animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '16px', width: '100%', padding: '16px', boxSizing: 'border-box' }}>
      
      {/* Controls Toolbar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', background: 'rgba(15, 23, 42, 0.6)', padding: '12px 16px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
        
        {/* Preset Symbols, Category Filter & Search */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          
          {/* Symbol Category Selector */}
          <div style={{ display: 'flex', background: 'rgba(0,0,0,0.4)', padding: '2px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.08)' }}>
            <button
              onClick={() => setSymbolCategory('futures')}
              style={{
                background: symbolCategory === 'futures' ? '#00f0ff' : 'transparent',
                color: symbolCategory === 'futures' ? '#000000' : 'var(--text-secondary)',
                border: 'none',
                padding: '4px 10px',
                borderRadius: '4px',
                fontSize: '11px',
                fontWeight: '800',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              <Zap size={12} /> Futures
            </button>
            <button
              onClick={() => setSymbolCategory('indices')}
              style={{
                background: symbolCategory === 'indices' ? '#3b82f6' : 'transparent',
                color: symbolCategory === 'indices' ? 'white' : 'var(--text-secondary)',
                border: 'none',
                padding: '4px 10px',
                borderRadius: '4px',
                fontSize: '11px',
                fontWeight: '700',
                cursor: 'pointer'
              }}
            >
              Indices / Spot
            </button>
            <button
              onClick={() => setSymbolCategory('all')}
              style={{
                background: symbolCategory === 'all' ? 'rgba(255,255,255,0.15)' : 'transparent',
                color: symbolCategory === 'all' ? 'white' : 'var(--text-secondary)',
                border: 'none',
                padding: '4px 8px',
                borderRadius: '4px',
                fontSize: '11px',
                fontWeight: '600',
                cursor: 'pointer'
              }}
            >
              All
            </button>
          </div>

          {/* Quick preset buttons */}
          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
            {filteredSymbols.map((item) => (
              <button
                key={item.symbol}
                onClick={() => handleSelectSymbol(item.symbol)}
                style={{
                  background: symbol === item.symbol 
                    ? (item.category === 'futures' ? 'rgba(0, 240, 255, 0.25)' : 'rgba(59, 130, 246, 0.25)') 
                    : 'rgba(255, 255, 255, 0.04)',
                  border: symbol === item.symbol 
                    ? (item.category === 'futures' ? '1px solid #00f0ff' : '1px solid #3b82f6') 
                    : '1px solid transparent',
                  color: symbol === item.symbol 
                    ? (item.category === 'futures' ? '#00f0ff' : '#60a5fa') 
                    : 'var(--text-secondary)',
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
                placeholder="e.g. NIFTY1! or RELIANCE FUT"
                style={{
                  background: 'rgba(0, 0, 0, 0.4)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '6px',
                  padding: '6px 12px 6px 30px',
                  color: 'white',
                  fontSize: '12px',
                  fontWeight: '600',
                  width: '160px'
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

        {/* Customization & View Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          
          {/* POC Extension Mode (Tested vs Untested Naked POC) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(0,0,0,0.4)', padding: '3px 8px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.1)' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: '600' }}>POC Ext:</span>
            <select
              value={extendPocMode}
              onChange={(e) => setExtendPocMode(e.target.value as any)}
              style={{
                background: 'transparent',
                color: '#00f0ff',
                border: 'none',
                fontSize: '11px',
                fontWeight: '800',
                cursor: 'pointer',
                outline: 'none'
              }}
            >
              <option value="untested_only" style={{ background: '#1e293b' }}>Stop when Tested (Req)</option>
              <option value="all" style={{ background: '#1e293b' }}>Extend All</option>
              <option value="none" style={{ background: '#1e293b' }}>None</option>
            </select>
          </div>

          {/* Axis Grid Step (20 points step default) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(0,0,0,0.4)', padding: '3px 8px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.1)' }}>
            <Sliders size={12} style={{ color: '#00f0ff' }} />
            <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: '600' }}>Grid:</span>
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
                outline: 'none'
              }}
            >
              <option value={10} style={{ background: '#1e293b' }}>10 pts</option>
              <option value={20} style={{ background: '#1e293b' }}>20 pts</option>
              <option value={50} style={{ background: '#1e293b' }}>50 pts</option>
              <option value={100} style={{ background: '#1e293b' }}>100 pts</option>
            </select>
          </div>

          {/* IB & Single Prints Toggles */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(0,0,0,0.3)', padding: '2px', borderRadius: '6px' }}>
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
            >
              Single Prints
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
          minHeight: '640px', 
          backgroundColor: theme === 'dark-slate' ? '#181c27' : '#0d1017', 
          borderRadius: '8px', 
          border: '1px solid var(--border-color)',
          overflow: 'hidden'
        }}
      >
        {/* Navigation & Active Contract Header */}
        <div style={{ position: 'absolute', top: '10px', left: '15px', zIndex: 5, display: 'flex', alignItems: 'center', gap: '10px', pointerEvents: 'none' }}>
          {isFuturesContract && (
            <span style={{ fontSize: '11px', fontWeight: '800', color: '#00f0ff', backgroundColor: 'rgba(0, 240, 255, 0.15)', border: '1px solid rgba(0, 240, 255, 0.4)', padding: '3px 8px', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Zap size={12} /> {activeSymbolInfo.displayName || symbol} (Futures)
            </span>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(15, 23, 42, 0.75)', padding: '4px 10px', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.08)' }}>
            <Move size={12} style={{ color: '#60a5fa' }} />
            <span style={{ fontSize: '10px', color: '#94a3b8', fontWeight: '600' }}>
              Tested POCs stop extending at testing session | Untested (Naked POC) extend to right
            </span>
          </div>
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
              minWidth: '200px'
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
            {hoverInfo.isSinglePrint && (
              <div style={{ color: '#f59e0b', backgroundColor: 'rgba(245, 158, 11, 0.2)', fontWeight: 'bold', fontSize: '9px', textAlign: 'center', padding: '2px 4px', borderRadius: '3px', marginTop: '4px' }}>
                ⚡ Single Print Imbalance Level
              </div>
            )}
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

    </div>
  );
};
