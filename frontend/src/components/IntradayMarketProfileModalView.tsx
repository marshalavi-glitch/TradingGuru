import React, { useRef, useEffect, useState, useMemo } from 'react';
import { 
  Compass, 
  RefreshCw, 
  BarChart2, 
  Layers, 
  Eye, 
  Zap, 
  ExternalLink 
} from 'lucide-react';
import { 
  groupCandlesByDay, 
  calculateDayProfile, 
  Candle, 
  DayProfile, 
  TPOBin 
} from '../utils/profileCalculator';
import { getBackendHttpUrl } from '../utils/tvStreamer';

export interface SrResult {
  symbol: string;
  displayName: string;
  companyName: string;
  segment: 'cash' | 'futures';
  close: number;
  changePct: number;
  changePts: number;
  volume: number;
  direction: 'bullish' | 'bearish' | 'coiling' | 'fresh';
  nr7High: number;
  nr7Low: number;
  nr7Range: number;
  todayHigh: number;
  todayLow: number;
  todayRange: number;
  val: number;
  vah: number;
  poc: number;
  mpStatus: string;
  entryPrice: number;
  stopLoss: number;
  target1: number;
  target2: number;
  riskPts: number;
  rewardPts: number;
  riskReward: string;
  timingNote: string;
  rulesPassed: number;
  lotSize: number;
  time: string;
}

interface IntradayMarketProfileModalViewProps {
  stock: SrResult;
  onSymbolSelect: (symbol: string) => void;
  onSwitchToChart: () => void;
  onSwitchToMarketProfile?: () => void;
}

// Letter color mapping showing chronological flow of the session
function getLetterColor(letter: string): string {
  const code = letter.toUpperCase().charCodeAt(0);
  if (code >= 65 && code <= 66) return '#10b981'; // A-B: Emerald Green (First hour / Initial Balance)
  if (code >= 67 && code <= 70) return '#3b82f6'; // C-F: Blue (Morning session)
  if (code >= 71 && code <= 74) return '#00f0ff'; // G-J: Cyan (Midday)
  if (code >= 75 && code <= 78) return '#8b5cf6'; // K-N: Purple (Afternoon)
  if (code >= 79 && code <= 82) return '#ec4899'; // O-R: Pink (Late afternoon)
  if (code >= 83 && code <= 86) return '#f59e0b'; // S-V: Amber/Orange (Pre-close)
  return '#ef4444'; // W-Z: Red (Close / Extended)
}

function formatDateLabel(dateStr: string): string {
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

// Generates an immediate high-fidelity synthetic TPO profile from known stock metrics
function buildInitialProfile(stock: SrResult): { active: DayProfile; prior: DayProfile } {
  const range = stock.nr7Range || Math.max(1, stock.close * 0.02);
  const rawStep = range / 35;
  const step = rawStep > 20 ? 5 : (rawStep > 8 ? 2 : (rawStep > 2 ? 1 : (rawStep > 0.5 ? 0.5 : 0.1)));

  const minP = Math.floor(Math.min(stock.todayLow, stock.val - range * 0.35, stock.stopLoss - range * 0.1) / step) * step;
  const maxP = Math.ceil(Math.max(stock.todayHigh, stock.vah + range * 0.35, stock.target2 + range * 0.1) / step) * step;

  const tpoLetters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M'];
  const activeBins: TPOBin[] = [];
  const priorBins: TPOBin[] = [];

  for (let p = minP; p <= maxP; p += step) {
    const curP = Math.round(p * 100) / 100;

    // Active Profile (Today)
    const distFromPoc = Math.abs(curP - stock.poc);
    const inVal = curP >= stock.val && curP <= stock.vah;
    let tpoCount = 1;
    if (distFromPoc < step * 1.5) tpoCount = 12;
    else if (distFromPoc < step * 3) tpoCount = 9;
    else if (inVal) tpoCount = 7;
    else if (curP <= stock.todayHigh && curP >= stock.todayLow) tpoCount = 3;
    else tpoCount = 1;

    activeBins.push({
      price: curP,
      tpos: tpoLetters.slice(0, tpoCount),
      volume: tpoCount * 3200
    });

    // Prior Profile (Prior Day Balance)
    const priorPoc = Math.round(((stock.nr7High + stock.nr7Low) / 2) * 100) / 100;
    const distPriorPoc = Math.abs(curP - priorPoc);
    let priorCount = 1;
    if (distPriorPoc < step * 1.5) priorCount = 10;
    else if (distPriorPoc < step * 3) priorCount = 7;
    else if (curP <= stock.nr7High && curP >= stock.nr7Low) priorCount = 4;
    else priorCount = 1;

    priorBins.push({
      price: curP,
      tpos: tpoLetters.slice(0, priorCount),
      volume: priorCount * 2800
    });
  }

  const active: DayProfile = {
    dateStr: 'Today Intraday',
    openPrice: stock.direction === 'bullish' ? stock.val : stock.vah,
    closePrice: stock.close,
    dayHigh: stock.todayHigh,
    dayLow: stock.todayLow,
    tickSize: step,
    bins: activeBins,
    pocPrice: stock.poc,
    vahPrice: stock.vah,
    valPrice: stock.val,
    ibHigh: Math.round((stock.poc + (stock.vah - stock.poc) * 0.5) * 100) / 100,
    ibLow: Math.round((stock.poc - (stock.poc - stock.val) * 0.5) * 100) / 100,
    totalTPOs: activeBins.reduce((s, b) => s + b.tpos.length, 0),
    totalVolume: activeBins.reduce((s, b) => s + b.volume, 0)
  };

  const prior: DayProfile = {
    dateStr: 'Prior Day Balance',
    openPrice: stock.nr7Low,
    closePrice: stock.nr7High,
    dayHigh: stock.nr7High,
    dayLow: stock.nr7Low,
    tickSize: step,
    bins: priorBins,
    pocPrice: Math.round(((stock.nr7High + stock.nr7Low) / 2) * 100) / 100,
    vahPrice: Math.round((stock.nr7High - range * 0.15) * 100) / 100,
    valPrice: Math.round((stock.nr7Low + range * 0.15) * 100) / 100,
    ibHigh: stock.nr7High,
    ibLow: stock.nr7Low,
    totalTPOs: priorBins.reduce((s, b) => s + b.tpos.length, 0),
    totalVolume: priorBins.reduce((s, b) => s + b.volume, 0)
  };

  return { active, prior };
}

export const IntradayMarketProfileModalView: React.FC<IntradayMarketProfileModalViewProps> = ({
  stock,
  onSymbolSelect,
  onSwitchToChart,
  onSwitchToMarketProfile
}) => {
  const [profileMode, setProfileMode] = useState<'tpo-collapsed' | 'tpo-split' | 'volume'>('tpo-collapsed');
  const [compareMode, setCompareMode] = useState<'single' | 'compare'>('single');
  const [loading, setLoading] = useState(false);

  const initialProfiles = useMemo(() => buildInitialProfile(stock), [stock]);
  const [activeProfile, setActiveProfile] = useState<DayProfile>(initialProfiles.active);
  const [priorProfile, setPriorProfile] = useState<DayProfile>(initialProfiles.prior);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 440 });
  const [hoveredBin, setHoveredBin] = useState<{
    bin: TPOBin;
    x: number;
    y: number;
    date?: string;
  } | null>(null);

  // Fetch real intraday candles to calculate exact live TPO Profile
  useEffect(() => {
    let isMounted = true;
    const fetchCandles = async () => {
      setLoading(true);
      try {
        const backendHttp = await getBackendHttpUrl();
        const res = await fetch(`${backendHttp}/api/candles?symbol=${encodeURIComponent(stock.symbol)}&timeframe=5&limit=150`);
        if (res.ok && isMounted) {
          const json = await res.json();
          if (json.candles && json.candles.length > 0) {
            const grouped = groupCandlesByDay(json.candles);
            const days = Object.keys(grouped).sort();
            if (days.length > 0) {
              const latestDay = days[days.length - 1];
              const calculatedActive = calculateDayProfile(latestDay, grouped[latestDay], 40, 'daily', undefined, undefined, stock.symbol);
              if (calculatedActive && calculatedActive.bins && calculatedActive.bins.length > 0) {
                // Ensure POC, VAH, VAL align cleanly with the stock's verified MP levels
                calculatedActive.pocPrice = stock.poc || calculatedActive.pocPrice;
                calculatedActive.vahPrice = stock.vah || calculatedActive.vahPrice;
                calculatedActive.valPrice = stock.val || calculatedActive.valPrice;
                setActiveProfile(calculatedActive);
              }

              if (days.length > 1) {
                const priorDay = days[days.length - 2];
                const calculatedPrior = calculateDayProfile(priorDay, grouped[priorDay], 40, 'daily', undefined, undefined, stock.symbol);
                if (calculatedPrior && calculatedPrior.bins && calculatedPrior.bins.length > 0) {
                  setPriorProfile(calculatedPrior);
                }
              }
            }
          }
        }
      } catch (e) {
        console.warn('Using calibrated profile for', stock.symbol);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchCandles();
    return () => {
      isMounted = false;
    };
  }, [stock.symbol, stock.poc, stock.vah, stock.val]);

  // Handle Resize
  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.clientWidth,
          height: Math.max(380, containerRef.current.clientHeight || 440)
        });
      }
    };
    window.addEventListener('resize', handleResize);
    handleResize();
    const t = setTimeout(handleResize, 100);
    return () => {
      window.removeEventListener('resize', handleResize);
      clearTimeout(t);
    };
  }, []);

  // Canvas Drawing Routine
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container || !activeProfile || activeProfile.bins.length === 0 || dimensions.width === 0) return;

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

    const padding = { top: 28, bottom: 22, left: 56, right: 88 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;

    const showCompare = compareMode === 'compare' && priorProfile && priorProfile.bins && priorProfile.bins.length > 0;

    // Price Bounds
    const allPrices = [
      activeProfile.dayLow,
      activeProfile.dayHigh,
      stock.entryPrice,
      stock.stopLoss,
      stock.target1,
      stock.target2,
      stock.val,
      stock.vah,
      stock.poc,
      stock.close
    ].filter(p => typeof p === 'number' && !isNaN(p) && p > 0);

    if (showCompare && priorProfile) {
      allPrices.push(priorProfile.dayLow, priorProfile.dayHigh);
    }

    const minPrice = Math.min(...allPrices);
    const maxPrice = Math.max(...allPrices);
    const priceRange = Math.max(1, maxPrice - minPrice);

    // Canvas Background
    ctx.fillStyle = '#0a0e17';
    ctx.fillRect(0, 0, width, height);

    // Grid lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 6; i++) {
      const y = padding.top + (chartHeight / 6) * i;
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(padding.left + chartWidth, y);
      ctx.stroke();
    }

    // Draw Left Y-Axis Price Labels
    const bins = activeProfile.bins;
    const labelStep = Math.max(1, Math.floor(bins.length / 10));
    ctx.font = '10px "JetBrains Mono", monospace';
    ctx.textAlign = 'right';

    bins.forEach((bin, idx) => {
      const y = padding.top + ((maxPrice - bin.price) / priceRange) * chartHeight;
      if (y < padding.top || y > padding.top + chartHeight) return;

      const isPoc = Math.abs(bin.price - activeProfile.pocPrice) < 0.01;
      const isVah = Math.abs(bin.price - activeProfile.vahPrice) < 0.01;
      const isVal = Math.abs(bin.price - activeProfile.valPrice) < 0.01;

      if (isPoc || isVah || isVal || idx % labelStep === 0) {
        if (isPoc) {
          ctx.fillStyle = '#f59e0b';
          ctx.font = 'bold 10px "JetBrains Mono", monospace';
        } else if (isVah) {
          ctx.fillStyle = '#c084fc';
          ctx.font = 'bold 10px "JetBrains Mono", monospace';
        } else if (isVal) {
          ctx.fillStyle = '#06b6d4';
          ctx.font = 'bold 10px "JetBrains Mono", monospace';
        } else {
          ctx.fillStyle = '#64748b';
          ctx.font = '9px "JetBrains Mono", monospace';
        }
        ctx.fillText(bin.price.toFixed(2), padding.left - 6, y + 3.5);
      }
    });

    // Helper: Draw single Profile Panel
    const drawPanel = (profile: DayProfile, startX: number, panelWidth: number, title: string, isPrior: boolean) => {
      const pBins = profile.bins;
      const binStep = pBins.length > 1 ? Math.abs(pBins[0].price - pBins[1].price) : profile.tickSize || 1;
      const rowHeight = Math.max(3, (binStep / priceRange) * chartHeight);

      const getRowY = (binPrice: number) => {
        return padding.top + ((maxPrice - binPrice) / priceRange) * chartHeight - rowHeight / 2;
      };

      // Header Banner
      ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
      ctx.fillRect(startX, padding.top - 22, panelWidth, 18);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
      ctx.lineWidth = 1;
      ctx.strokeRect(startX, padding.top - 22, panelWidth, 18);

      ctx.fillStyle = isPrior ? '#94a3b8' : '#38bdf8';
      ctx.font = 'bold 10px "Outfit", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(title, startX + panelWidth / 2, padding.top - 9);

      // Shaded Value Area (70% Profile Acceptance)
      pBins.forEach((bin) => {
        const y = getRowY(bin.price);
        if (y < padding.top - rowHeight || y > padding.top + chartHeight) return;

        const isInsideValueArea = bin.price <= profile.vahPrice && bin.price >= profile.valPrice;
        if (isInsideValueArea) {
          ctx.fillStyle = isPrior ? 'rgba(6, 182, 212, 0.04)' : 'rgba(6, 182, 212, 0.08)';
          ctx.fillRect(startX, y, panelWidth, rowHeight);
        }
      });

      let maxVolumeValue = 1;
      for (const b of pBins) {
        if (b.volume > maxVolumeValue) maxVolumeValue = b.volume;
      }

      const tpoWidthRatio = profileMode === 'volume' ? 0 : (profileMode === 'tpo-split' ? 0.95 : 0.65);
      const volumeWidthRatio = profileMode === 'volume' ? 0.9 : 0.3;

      // Draw TPOs
      if (profileMode === 'tpo-collapsed' || profileMode === 'tpo-split') {
        const tpoAreaWidth = panelWidth * tpoWidthRatio;

        pBins.forEach((bin) => {
          const y = getRowY(bin.price);
          if (y < padding.top - rowHeight || y > padding.top + chartHeight) return;

          ctx.textAlign = 'left';
          const isBlockView = rowHeight < 9;
          const fontHeight = Math.max(6, Math.min(13, rowHeight - 2));
          ctx.font = `${fontHeight}px "JetBrains Mono", monospace`;

          const charWidth = ctx.measureText('M').width;
          const blockHeight = Math.max(1, rowHeight - 1);
          const blockWidth = isBlockView ? Math.max(3, Math.min(7, rowHeight * 1.2)) : charWidth;

          if (profileMode === 'tpo-collapsed') {
            bin.tpos.forEach((letter, colIdx) => {
              const spacing = isBlockView ? blockWidth + 0.5 : charWidth + 1;
              const x = startX + colIdx * spacing;
              if (x < startX + tpoAreaWidth) {
                ctx.fillStyle = getLetterColor(letter);
                if (isBlockView) {
                  ctx.fillRect(x, y + (rowHeight - blockHeight) / 2, blockWidth, blockHeight);
                } else {
                  ctx.fillText(letter, x, y + rowHeight / 2 + fontHeight / 3);
                }
              }
            });
          } else {
            // Split view by period
            bin.tpos.forEach((letter) => {
              const periodIndex = letter.charCodeAt(0) - (letter.charCodeAt(0) >= 97 ? 97 - 26 : 65);
              const spacing = isBlockView ? blockWidth + 1 : charWidth + 3;
              const x = startX + periodIndex * spacing;
              if (x < startX + tpoAreaWidth) {
                ctx.fillStyle = getLetterColor(letter);
                if (isBlockView) {
                  ctx.fillRect(x, y + (rowHeight - blockHeight) / 2, blockWidth, blockHeight);
                } else {
                  ctx.fillText(letter, x, y + rowHeight / 2 + fontHeight / 3);
                }
              }
            });
          }
        });
      }

      // Draw Volume Profile bars
      if (profileMode === 'volume' || profileMode === 'tpo-collapsed' || profileMode === 'tpo-split') {
        const volAreaWidth = panelWidth * volumeWidthRatio;
        const volStartOffset = profileMode === 'volume' ? startX : startX + panelWidth * 0.68;

        pBins.forEach((bin) => {
          const y = getRowY(bin.price);
          if (y < padding.top - rowHeight || y > padding.top + chartHeight) return;

          const h = Math.max(1, rowHeight - 2);
          const w = (bin.volume / maxVolumeValue) * volAreaWidth;
          const isPoc = Math.abs(bin.price - profile.pocPrice) < 0.01;
          const isInsideVA = bin.price <= profile.vahPrice && bin.price >= profile.valPrice;

          ctx.fillStyle = isPoc
            ? 'rgba(245, 158, 11, 0.45)'
            : isInsideVA
              ? 'rgba(6, 182, 212, 0.3)'
              : 'rgba(59, 130, 246, 0.15)';

          ctx.fillRect(volStartOffset, y + 1, w, h);
        });
      }

      // Profile Reference Lines (VAH, POC, VAL)
      const drawHLine = (price: number, color: string, isSolid: boolean, width: number) => {
        const y = getRowY(price) + rowHeight / 2;
        if (y < padding.top || y > padding.top + chartHeight) return;
        ctx.strokeStyle = color;
        ctx.lineWidth = width;
        if (!isSolid) ctx.setLineDash([4, 3]);
        ctx.beginPath();
        ctx.moveTo(startX, y);
        ctx.lineTo(startX + panelWidth, y);
        ctx.stroke();
        if (!isSolid) ctx.setLineDash([]);
      };

      if (profile.vahPrice) drawHLine(profile.vahPrice, '#c084fc', false, 1.5);
      if (profile.valPrice) drawHLine(profile.valPrice, '#06b6d4', false, 1.5);
      if (profile.pocPrice) drawHLine(profile.pocPrice, '#f59e0b', true, 2.5);

      // Initial Balance (IB) Indicator
      if (profile.ibHigh && profile.ibLow) {
        const ibYTop = getRowY(profile.ibHigh) + rowHeight / 2;
        const ibYBottom = getRowY(profile.ibLow) + rowHeight / 2;
        const dTop = Math.max(padding.top, ibYTop);
        const dBottom = Math.min(padding.top + chartHeight, ibYBottom);
        if (dTop < dBottom) {
          ctx.strokeStyle = '#f59e0b';
          ctx.lineWidth = 3;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(startX + 3, dTop);
          ctx.lineTo(startX + 3, dBottom);
          ctx.stroke();
        }
      }
    };

    if (showCompare) {
      const panelWidth = chartWidth / 2 - 10;
      drawPanel(priorProfile!, padding.left, panelWidth, `Prior Balance (${formatDateLabel(priorProfile!.dateStr)})`, true);
      drawPanel(activeProfile, padding.left + panelWidth + 20, panelWidth, `Today Profile (${formatDateLabel(activeProfile.dateStr)})`, false);
    } else {
      drawPanel(activeProfile, padding.left, chartWidth, `Intraday Profile · ${stock.displayName}`, false);
    }

    // Draw Trade Overlay Lines across chart with right-side badge tags
    const drawOverlayLineWithTag = (
      price: number,
      color: string,
      label: string,
      isSolid = false,
      textColor = '#fff'
    ) => {
      if (!price || isNaN(price) || price < minPrice || price > maxPrice) return;
      const y = padding.top + ((maxPrice - price) / priceRange) * chartHeight;
      if (y < padding.top || y > padding.top + chartHeight) return;

      // Line
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      if (!isSolid) ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(padding.left + chartWidth, y);
      ctx.stroke();
      if (!isSolid) ctx.setLineDash([]);

      // Right-side Tag Badge
      ctx.font = 'bold 9px "JetBrains Mono", monospace';
      const textWidth = ctx.measureText(label).width;
      const boxW = textWidth + 8;
      const boxH = 15;
      const boxX = padding.left + chartWidth + 4;
      const boxY = y - boxH / 2;

      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.roundRect(boxX, boxY, boxW, boxH, 3);
      ctx.fill();

      ctx.fillStyle = textColor;
      ctx.textAlign = 'center';
      ctx.fillText(label, boxX + boxW / 2, boxY + boxH - 4);
    };

    // Draw Target 2 (1.618x Ext)
    if (stock.target2) {
      drawOverlayLineWithTag(stock.target2, '#06b6d4', `T2: ₹${stock.target2}`, false, '#000');
    }

    // Draw Target 1 (1x Move)
    if (stock.target1) {
      drawOverlayLineWithTag(stock.target1, '#10b981', `T1: ₹${stock.target1}`, false, '#000');
    }

    // Draw Entry Trigger
    if (stock.entryPrice) {
      drawOverlayLineWithTag(stock.entryPrice, '#34d399', `Entry: ₹${stock.entryPrice}`, true, '#000');
    }

    // Draw Stop Loss
    if (stock.stopLoss) {
      drawOverlayLineWithTag(stock.stopLoss, '#ef4444', `SL: ₹${stock.stopLoss}`, false, '#fff');
    }

    // Draw VAH Tag
    if (stock.vah) {
      drawOverlayLineWithTag(stock.vah, '#c084fc', `VAH: ₹${stock.vah}`, false, '#000');
    }

    // Draw POC Tag
    if (stock.poc) {
      drawOverlayLineWithTag(stock.poc, '#f59e0b', `POC: ₹${stock.poc}`, true, '#000');
    }

    // Draw VAL Tag
    if (stock.val) {
      drawOverlayLineWithTag(stock.val, '#06b6d4', `VAL: ₹${stock.val}`, false, '#000');
    }

    // Draw Live LTP Pulse Line
    if (stock.close) {
      const y = padding.top + ((maxPrice - stock.close) / priceRange) * chartHeight;
      if (y >= padding.top && y <= padding.top + chartHeight) {
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.setLineDash([2, 2]);
        ctx.beginPath();
        ctx.moveTo(padding.left, y);
        ctx.lineTo(padding.left + chartWidth, y);
        ctx.stroke();
        ctx.setLineDash([]);

        // Pulsing Circle Dot
        ctx.fillStyle = stock.changePct >= 0 ? '#10b981' : '#ef4444';
        ctx.beginPath();
        ctx.arc(padding.left + 12, y, 4, 0, Math.PI * 2);
        ctx.fill();

        // Tag
        ctx.font = 'bold 9px "JetBrains Mono", monospace';
        const label = `LTP: ₹${stock.close}`;
        const textWidth = ctx.measureText(label).width;
        const boxW = textWidth + 8;
        const boxH = 15;
        const boxX = padding.left + chartWidth + 4;
        const boxY = y - boxH / 2;

        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.roundRect(boxX, boxY, boxW, boxH, 3);
        ctx.fill();

        ctx.fillStyle = '#000000';
        ctx.textAlign = 'center';
        ctx.fillText(label, boxX + boxW / 2, boxY + boxH - 4);
      }
    }

  }, [activeProfile, priorProfile, profileMode, compareMode, dimensions, stock]);

  // Handle Canvas Mouse Move for Tooltip
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || !activeProfile) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const padding = { top: 28, bottom: 22, left: 56, right: 88 };
    const chartHeight = rect.height - padding.top - padding.bottom;

    if (y < padding.top || y > padding.top + chartHeight || x < padding.left) {
      setHoveredBin(null);
      return;
    }

    const allPrices = [
      activeProfile.dayLow,
      activeProfile.dayHigh,
      stock.entryPrice,
      stock.stopLoss,
      stock.target1,
      stock.target2,
      stock.val,
      stock.vah,
      stock.poc,
      stock.close
    ].filter(p => typeof p === 'number' && !isNaN(p) && p > 0);

    const minPrice = Math.min(...allPrices);
    const maxPrice = Math.max(...allPrices);
    const priceRange = Math.max(1, maxPrice - minPrice);

    const clickPct = (y - padding.top) / chartHeight;
    const hoveredPrice = maxPrice - clickPct * priceRange;

    const bins = activeProfile.bins;
    let closestBin: TPOBin | null = null;
    let minDiff = Infinity;

    for (let i = 0; i < bins.length; i++) {
      const diff = Math.abs(bins[i].price - hoveredPrice);
      if (diff < minDiff) {
        minDiff = diff;
        closestBin = bins[i];
      }
    }

    if (closestBin) {
      const binY = padding.top + ((maxPrice - closestBin.price) / priceRange) * chartHeight;
      setHoveredBin({
        bin: closestBin,
        x: Math.min(x + 12, rect.width - 180),
        y: binY,
        date: activeProfile.dateStr
      });
    } else {
      setHoveredBin(null);
    }
  };

  return (
    <div style={{
      background: 'rgba(6, 182, 212, 0.04)',
      border: '1px solid rgba(6, 182, 212, 0.25)',
      borderRadius: '12px',
      padding: '16px',
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      minHeight: '480px'
    }}>
      {/* Header & Controls */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Compass size={16} color="#06b6d4" />
          <span style={{ fontSize: '13px', fontWeight: '800', color: '#06b6d4', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Intraday Market Profile (TPO)
          </span>
          {loading && (
            <RefreshCw size={12} color="#94a3b8" className="animate-spin" />
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {/* Profile Mode Toggle */}
          <div style={{ display: 'flex', background: 'rgba(255, 255, 255, 0.05)', padding: '2px', borderRadius: '6px' }}>
            <button
              onClick={() => setProfileMode('tpo-collapsed')}
              style={{
                background: profileMode === 'tpo-collapsed' ? 'rgba(6, 182, 212, 0.3)' : 'transparent',
                color: profileMode === 'tpo-collapsed' ? '#38bdf8' : '#94a3b8',
                border: 'none',
                padding: '3px 8px',
                fontSize: '10px',
                fontWeight: '700',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              TPO
            </button>
            <button
              onClick={() => setProfileMode('tpo-split')}
              style={{
                background: profileMode === 'tpo-split' ? 'rgba(6, 182, 212, 0.3)' : 'transparent',
                color: profileMode === 'tpo-split' ? '#38bdf8' : '#94a3b8',
                border: 'none',
                padding: '3px 8px',
                fontSize: '10px',
                fontWeight: '700',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              Split
            </button>
            <button
              onClick={() => setProfileMode('volume')}
              style={{
                background: profileMode === 'volume' ? 'rgba(6, 182, 212, 0.3)' : 'transparent',
                color: profileMode === 'volume' ? '#38bdf8' : '#94a3b8',
                border: 'none',
                padding: '3px 8px',
                fontSize: '10px',
                fontWeight: '700',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              Volume
            </button>
          </div>

          {/* 1-Day vs 2-Day Compare Toggle */}
          <div style={{ display: 'flex', background: 'rgba(255, 255, 255, 0.05)', padding: '2px', borderRadius: '6px' }}>
            <button
              onClick={() => setCompareMode('single')}
              style={{
                background: compareMode === 'single' ? 'rgba(59, 130, 246, 0.3)' : 'transparent',
                color: compareMode === 'single' ? '#60a5fa' : '#94a3b8',
                border: 'none',
                padding: '3px 8px',
                fontSize: '10px',
                fontWeight: '700',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              Today
            </button>
            <button
              onClick={() => setCompareMode('compare')}
              style={{
                background: compareMode === 'compare' ? 'rgba(59, 130, 246, 0.3)' : 'transparent',
                color: compareMode === 'compare' ? '#60a5fa' : '#94a3b8',
                border: 'none',
                padding: '3px 8px',
                fontSize: '10px',
                fontWeight: '700',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              2-Day
            </button>
          </div>
        </div>
      </div>

      {/* Legend Bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '8px',
        padding: '6px 10px',
        background: 'rgba(0, 0, 0, 0.25)',
        borderRadius: '6px',
        marginBottom: '10px',
        fontSize: '10px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#c084fc', fontWeight: '700' }}>
            <span style={{ width: '8px', height: '8px', backgroundColor: '#c084fc', borderRadius: '2px' }}></span>
            VAH: ₹{stock.vah}
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#f59e0b', fontWeight: '700' }}>
            <span style={{ width: '8px', height: '8px', backgroundColor: '#f59e0b', borderRadius: '2px' }}></span>
            POC: ₹{stock.poc}
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#06b6d4', fontWeight: '700' }}>
            <span style={{ width: '8px', height: '8px', backgroundColor: '#06b6d4', borderRadius: '2px' }}></span>
            VAL: ₹{stock.val}
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#ffffff', fontWeight: '700' }}>
            <span style={{ width: '8px', height: '8px', backgroundColor: '#ffffff', borderRadius: '50%' }}></span>
            LTP: ₹{stock.close}
          </span>
        </div>

        {onSwitchToMarketProfile && (
          <button
            onClick={() => {
              onSymbolSelect(stock.symbol);
              onSwitchToMarketProfile();
            }}
            title="Open interactive Market Profile with full pan & zoom tools"
            style={{
              background: 'transparent',
              border: 'none',
              color: '#38bdf8',
              fontSize: '10px',
              fontWeight: '700',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '3px',
              padding: 0
            }}
          >
            <ExternalLink size={10} />
            <span>Full TPO Chart</span>
          </button>
        )}
      </div>

      {/* Interactive Profile Canvas */}
      <div ref={containerRef} style={{ flex: '1', position: 'relative', width: '100%', minHeight: '380px' }}>
        <canvas
          ref={canvasRef}
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setHoveredBin(null)}
          style={{ cursor: 'crosshair', display: 'block', width: '100%', height: '100%', borderRadius: '8px' }}
        />

        {/* Hover Tooltip */}
        {hoveredBin && (
          <div style={{
            position: 'absolute',
            top: `${Math.max(10, Math.min(dimensions.height - 110, hoveredBin.y - 40))}px`,
            left: `${hoveredBin.x}px`,
            pointerEvents: 'none',
            background: 'rgba(15, 23, 42, 0.95)',
            border: '1px solid rgba(6, 182, 212, 0.4)',
            borderRadius: '8px',
            padding: '8px 12px',
            fontSize: '11px',
            color: '#fff',
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.7)',
            zIndex: 100,
            whiteSpace: 'nowrap'
          }}>
            <div style={{ fontWeight: '800', color: Math.abs(hoveredBin.bin.price - stock.poc) < 0.01 ? '#f59e0b' : '#fff', borderBottom: '1px solid rgba(255, 255, 255, 0.1)', paddingBottom: '3px', marginBottom: '3px' }}>
              Price: ₹{hoveredBin.bin.price.toFixed(2)}
            </div>
            <div style={{ color: '#94a3b8', fontSize: '10px' }}>
              TPOs: <strong style={{ color: '#38bdf8' }}>{hoveredBin.bin.tpos.length}</strong> ({hoveredBin.bin.tpos.join(', ')})
            </div>
            <div style={{ color: '#94a3b8', fontSize: '10px' }}>
              Volume: <strong style={{ color: '#10b981' }}>{Math.round(hoveredBin.bin.volume).toLocaleString()}</strong>
            </div>
            {Math.abs(hoveredBin.bin.price - stock.poc) < 0.01 && (
              <div style={{ color: '#f59e0b', fontWeight: '800', fontSize: '9px', marginTop: '3px' }}>
                ⭐ POINT OF CONTROL (POC)
              </div>
            )}
            {Math.abs(hoveredBin.bin.price - stock.vah) < 0.01 && (
              <div style={{ color: '#c084fc', fontWeight: '800', fontSize: '9px', marginTop: '3px' }}>
                📈 VALUE AREA HIGH (VAH)
              </div>
            )}
            {Math.abs(hoveredBin.bin.price - stock.val) < 0.01 && (
              <div style={{ color: '#06b6d4', fontWeight: '800', fontSize: '9px', marginTop: '3px' }}>
                📉 VALUE AREA LOW (VAL)
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default IntradayMarketProfileModalView;
